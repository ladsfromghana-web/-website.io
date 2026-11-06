-- Lads From Ghana x Her District — database schema (Supabase / PostgreSQL)
-- Run this whole file once in the Supabase SQL editor, then seed.sql, then follow README.md to create the admin.
create extension if not exists pgcrypto;

-- ───────────── administrators ─────────────
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from admins a where a.user_id = auth.uid()) $$;

-- ───────────── catalogue ─────────────
create table if not exists brands (
  id text primary key, slug text unique not null, name text not null,
  description text not null default '', logo_url text, banner_url text, instagram_url text,
  coming_soon boolean not null default false, coming_soon_message text not null default '',
  visible boolean not null default true, preview_images jsonb not null default '[]'::jsonb, sort int not null default 0
);
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null references brands(id) on update cascade,
  name text not null check (length(trim(name)) > 0), slug text unique not null,
  price numeric(10,2) not null check (price >= 0),            -- Ghana cedis (GHS)
  description text not null default '', category text not null default '',
  availability text not null default 'available' check (availability in ('available','sold_out')),
  published boolean not null default false, featured boolean not null default false,
  stock integer check (stock is null or stock >= 0),            -- null = not tracked
  sizes jsonb not null default '[]'::jsonb,                     -- e.g. ["S","M","L"]; empty = no size choice
  sort int not null default 0, created_at timestamptz not null default now()
);
create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null, position int not null default 0            -- position 0 = main image
);
create index if not exists product_images_product_idx on product_images(product_id, position);

-- ───────────── site content ─────────────
create table if not exists homepage_slides (
  id uuid primary key default gen_random_uuid(),
  brand_id text references brands(id) on update cascade on delete set null,
  layout text not null default 'photo' check (layout in ('photo','layered')),
  image_url text not null, headline text not null default '', subtext text not null default '',
  cta_label text not null default '', cta_url text not null default '',
  position int not null default 0, visible boolean not null default true
);
create table if not exists lookbook_images (
  id uuid primary key default gen_random_uuid(), image_url text not null,
  brand_id text references brands(id) on update cascade on delete set null,
  caption text not null default '', position int not null default 0, visible boolean not null default true
);
create table if not exists site_settings (key text primary key, value text not null default '');

-- ───────────── orders ─────────────
create sequence if not exists order_number_seq start 1001;
create table if not exists orders (
  id uuid primary key default gen_random_uuid(), order_number text unique not null,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refunded')),
  payment_reference text,
  customer_name text not null, phone text not null, email text, address text not null, notes text,
  subtotal numeric(12,2) not null default 0, total numeric(12,2) not null default 0, created_at timestamptz not null default now()
);
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  brand_id text references brands(id) on update cascade on delete set null,
  product_name text not null,                      -- snapshot, so history survives edits/deletes
  size text, unit_price numeric(10,2) not null,    -- price at time of purchase
  quantity integer not null check (quantity between 1 and 50), line_total numeric(12,2) not null
);
create index if not exists order_items_order_idx on order_items(order_id);
create index if not exists orders_created_idx on orders(created_at desc);

-- ───────────── placing an order (the ONLY way the public can create one) ─────────────
-- Prices, availability and stock come from the database, never from the browser.
-- Orders are created unpaid + pending. Nothing here marks an order paid.
create or replace function place_order(p_customer jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_number text; v_sub numeric(12,2) := 0; it jsonb; pr record; q int; sz text; v_name text; v_phone text; v_addr text;
begin
  v_name := trim(coalesce(p_customer->>'name','')); v_phone := trim(coalesce(p_customer->>'phone','')); v_addr := trim(coalesce(p_customer->>'address',''));
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Please enter your full name'; end if;
  if v_phone !~ '^[0-9+() \-]{7,20}$' then raise exception 'Please enter a valid phone number'; end if;
  if length(v_addr) < 4 or length(v_addr) > 300 then raise exception 'Please enter a delivery address'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then raise exception 'Your bag is empty'; end if;
  v_number := 'ORD-' || nextval('order_number_seq');
  insert into orders(order_number, customer_name, phone, email, address, notes)
    values (v_number, v_name, v_phone, nullif(left(trim(coalesce(p_customer->>'email','')),160),''), v_addr, nullif(left(trim(coalesce(p_customer->>'notes','')),600),''))
    returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'quantity')::int; sz := nullif(trim(coalesce(it->>'size','')),'');
    if q is null or q < 1 or q > 50 then raise exception 'Invalid quantity'; end if;
    select p.*, b.coming_soon as b_soon, b.visible as b_visible into pr from products p join brands b on b.id = p.brand_id where p.id = (it->>'product_id')::uuid;
    if not found or not pr.published or not pr.b_visible or pr.b_soon or pr.availability <> 'available' then raise exception 'An item in your bag is no longer available'; end if;
    if jsonb_array_length(pr.sizes) > 0 and (sz is null or not (pr.sizes ? sz)) then raise exception 'Please choose a size for %', pr.name; end if;
    if pr.stock is not null then
      update products set stock = stock - q where id = pr.id and stock >= q;
      if not found then raise exception 'Not enough stock for %', pr.name; end if;
    end if;
    insert into order_items(order_id, product_id, brand_id, product_name, size, unit_price, quantity, line_total)
      values (v_id, pr.id, pr.brand_id, pr.name, sz, pr.price, q, pr.price * q);
    v_sub := v_sub + pr.price * q;
  end loop;
  update orders set subtotal = v_sub, total = v_sub where id = v_id;
  return jsonb_build_object('order_number', v_number, 'total', v_sub);
end $$;
revoke all on function place_order(jsonb, jsonb) from public;
grant execute on function place_order(jsonb, jsonb) to anon, authenticated;

-- ───────────── row level security ─────────────
alter table admins enable row level security;          alter table brands enable row level security;
alter table products enable row level security;        alter table product_images enable row level security;
alter table homepage_slides enable row level security; alter table lookbook_images enable row level security;
alter table site_settings enable row level security;   alter table orders enable row level security;
alter table order_items enable row level security;

create policy admins_self_read on admins for select using (user_id = auth.uid());
create policy brands_read   on brands   for select using (visible or is_admin());
create policy brands_write  on brands   for all    using (is_admin()) with check (is_admin());
create policy products_read on products for select using ((published and exists (select 1 from brands b where b.id = brand_id and b.visible)) or is_admin());
create policy products_write on products for all   using (is_admin()) with check (is_admin());
create policy pimg_read     on product_images for select using (exists (select 1 from products p where p.id = product_id and p.published) or is_admin());
create policy pimg_write    on product_images for all    using (is_admin()) with check (is_admin());
create policy slides_read   on homepage_slides for select using (visible or is_admin());
create policy slides_write  on homepage_slides for all    using (is_admin()) with check (is_admin());
create policy look_read     on lookbook_images for select using (visible or is_admin());
create policy look_write    on lookbook_images for all    using (is_admin()) with check (is_admin());
create policy settings_read on site_settings for select using (true);
create policy settings_write on site_settings for all    using (is_admin()) with check (is_admin());
-- orders and customer details: administrators only. No public select/insert/update (orders arrive through place_order()).
create policy orders_admin  on orders      for all using (is_admin()) with check (is_admin());
create policy oitems_admin  on order_items for all using (is_admin()) with check (is_admin());

-- ───────────── image storage ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('site-media', 'site-media', true, 5242880, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy media_public_read  on storage.objects for select using (bucket_id = 'site-media');
create policy media_admin_insert on storage.objects for insert with check (bucket_id = 'site-media' and is_admin());
create policy media_admin_update on storage.objects for update using (bucket_id = 'site-media' and is_admin());
create policy media_admin_delete on storage.objects for delete using (bucket_id = 'site-media' and is_admin());
