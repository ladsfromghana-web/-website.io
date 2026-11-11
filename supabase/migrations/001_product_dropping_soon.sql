-- Run ONCE in the Supabase SQL editor if your database was created before this change.
-- Lets a single product be marked "Dropping soon" (visible, not purchasable) without hiding the rest of the brand.
alter table products drop constraint if exists products_availability_check;
alter table products add constraint products_availability_check check (availability in ('available','dropping_soon','sold_out'));
