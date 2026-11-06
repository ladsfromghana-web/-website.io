/* Data layer. One interface, three modes:
   remote : Supabase (production) — real auth, database, storage, row-level security
   local  : localhost only, no Supabase configured — data in this browser's localStorage (developer preview)
   static : deployed without Supabase configured — read-only storefront from data/seed.json, admin disabled          */
import { CONFIG } from './config.js';

export const ROOT = new URL('../', import.meta.url).href;
export const asset = (u) => !u ? '' : /^(https?:|data:|blob:)/i.test(u) ? u : ROOT + String(u).replace(/^\/+/, '');
const REMOTE = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const LOCAL_OK = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
export const MODE = REMOTE ? 'remote' : (LOCAL_OK ? 'local' : 'static');
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const clone = (x) => JSON.parse(JSON.stringify(x));
const byPos = (k) => (a, b) => (a[k] ?? 0) - (b[k] ?? 0);

function shape(raw) {
  const d = { brands: raw.brands || [], products: raw.products || [], slides: raw.slides || raw.homepage_slides || [], lookbook: raw.lookbook || raw.lookbook_images || [], settings: raw.settings || {} };
  if (Array.isArray(d.settings)) d.settings = Object.fromEntries(d.settings.map(r => [r.key, r.value]));
  d.products = d.products.map(p => { const imgs = (p.images || p.product_images || []).slice().sort(byPos('position')); const o = { ...p, images: imgs, sizes: Array.isArray(p.sizes) ? p.sizes : [], price: Number(p.price) }; delete o.product_images; return o; });
  d.brands = d.brands.map(b => ({ ...b, preview_images: Array.isArray(b.preview_images) ? b.preview_images : [] })).sort(byPos('sort'));
  d.products.sort(byPos('sort')); d.slides.sort(byPos('position')); d.lookbook.sort(byPos('position'));
  return d;
}

/* ───────── REMOTE (Supabase over plain fetch; no library needed) ───────── */
const SKEY = 'hd_admin_session';
const sess = { get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } }, set(s) { localStorage.setItem(SKEY, JSON.stringify(s)); }, clear() { localStorage.removeItem(SKEY); } };
async function token() {
  const s = sess.get(); if (!s) return null;
  if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
  const r = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
  if (!r.ok) { sess.clear(); return null; }
  const j = await r.json(); const n = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user || s.user }; sess.set(n); return n.access_token;
}
async function rest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const t = await token();
  const res = await fetch(`${CONFIG.supabaseUrl}/rest/v1/${path}`, { method, headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${t || CONFIG.supabaseAnonKey}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  if (!res.ok) { const e = new Error((json && (json.message || json.error_description || json.msg)) || `Request failed (${res.status})`); e.status = res.status; throw e; }
  return json;
}
const remote = {
  async loadAll() {
    const [brands, products, slides, lookbook, settings] = await Promise.all([
      rest('brands?select=*&order=sort.asc'), rest('products?select=*,product_images(id,url,position)&order=sort.asc'),
      rest('homepage_slides?select=*&order=position.asc'), rest('lookbook_images?select=*&order=position.asc'), rest('site_settings?select=key,value')]);
    return shape({ brands, products, slides, lookbook, settings });
  },
  async saveRow(table, row) { const r = await rest(`${table}?on_conflict=${table === 'site_settings' ? 'key' : 'id'}`, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation' }); return r && r[0]; },
  async patchRow(table, id, patch) { await rest(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  async removeRow(table, id) { await rest(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async saveProduct(p) {
    const { images, ...row } = p; row.id = row.id || uuid();
    await remote.saveRow('products', row);
    await rest(`product_images?product_id=eq.${row.id}`, { method: 'DELETE' });
    if (images && images.length) await rest('product_images', { method: 'POST', body: images.map((im, i) => ({ id: uuid(), product_id: row.id, url: im.url, position: i })) });
    return row.id;
  },
  async saveSettings(obj) { await rest('site_settings?on_conflict=key', { method: 'POST', body: Object.entries(obj).map(([key, value]) => ({ key, value: String(value) })), prefer: 'resolution=merge-duplicates' }); },
  async placeOrder(customer, items) { return rest('rpc/place_order', { method: 'POST', body: { p_customer: customer, p_items: items } }); },
  async listOrders() { return rest('orders?select=*,order_items(*)&order=created_at.desc&limit=2000'); },
  async updateOrder(id, patch) { await rest(`orders?id=eq.${id}`, { method: 'PATCH', body: patch }); },
  async signIn(email, password) {
    const r = await fetch(`${CONFIG.supabaseUrl}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error_description || j.msg || 'Sign-in failed');
    sess.set({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: j.user });
    if (!(await remote.isAdmin())) { sess.clear(); throw new Error('This account is not an authorised administrator.'); }
    return sess.get().user;
  },
  async isAdmin() { const s = sess.get(); if (!s) return false; try { const r = await rest(`admins?select=user_id&user_id=eq.${s.user.id}`); return Array.isArray(r) && r.length === 1; } catch { return false; } },
  async user() { const s = sess.get(); if (!s) return null; return (await remote.isAdmin()) ? s.user : null; },
  signOut() { sess.clear(); },
  async upload(file, folder = 'uploads') {
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type];
    const t = await token(); if (!t) throw new Error('Please sign in again.');
    const path = `${folder}/${uuid()}.${ext}`;
    const r = await fetch(`${CONFIG.supabaseUrl}/storage/v1/object/site-media/${path}`, { method: 'POST', headers: { apikey: CONFIG.supabaseAnonKey, Authorization: `Bearer ${t}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || 'Upload failed'); }
    return `${CONFIG.supabaseUrl}/storage/v1/object/public/site-media/${path}`;
  },
};

/* ───────── LOCAL preview (localhost only) ───────── */
const LKEY = 'hd_local_db_v1';
async function ldb() {
  const raw = localStorage.getItem(LKEY);
  if (!raw) { const seed = await (await fetch(ROOT + 'data/seed.json')).json(); const db = { ...clone(seed), orders: [], seq: 1000 }; localStorage.setItem(LKEY, JSON.stringify(db)); return db; }
  return JSON.parse(raw);
}
const lsave = (db) => localStorage.setItem(LKEY, JSON.stringify(db));
const LT = { products: 'products', brands: 'brands', homepage_slides: 'slides', lookbook_images: 'lookbook' };
// Local writes are queued so two quick saves (e.g. swapping two positions) can never overwrite each other.
let _q = Promise.resolve();
const serial = (f) => (...a) => { const r = _q.then(() => f(...a)); _q = r.catch(() => { }); return r; };
const local = {
  async loadAll() { return shape(clone(await ldb())); },
  async saveRow(table, row) { const db = await ldb(), k = LT[table]; row = { ...row }; if (table !== 'brands') row.id = row.id || uuid(); const i = db[k].findIndex(r => r.id === row.id); if (i >= 0) db[k][i] = { ...db[k][i], ...row }; else db[k].push(row); lsave(db); return row; },
  async patchRow(table, id, patch) { const db = await ldb(), k = LT[table]; const r = db[k].find(x => x.id === id); if (r) Object.assign(r, patch); lsave(db); },
  async removeRow(table, id) { const db = await ldb(), k = LT[table]; db[k] = db[k].filter(r => r.id !== id); lsave(db); },
  async saveProduct(p) { const db = await ldb(); const row = { ...p, id: p.id || uuid() }; row.images = (p.images || []).map((im, i) => ({ id: im.id || uuid(), url: im.url, position: i })); const i = db.products.findIndex(x => x.id === row.id); if (i >= 0) db.products[i] = row; else db.products.push(row); lsave(db); return row.id; },
  async saveSettings(obj) { const db = await ldb(); Object.entries(obj).forEach(([k, v]) => db.settings[k] = String(v)); lsave(db); },
  async placeOrder(c, items) {
    const db = await ldb(); const name = (c.name || '').trim(), phone = (c.phone || '').trim(), addr = (c.address || '').trim();
    if (name.length < 2) throw new Error('Please enter your full name'); if (!/^[0-9+() \-]{7,20}$/.test(phone)) throw new Error('Please enter a valid phone number'); if (addr.length < 4) throw new Error('Please enter a delivery address');
    if (!items || !items.length) throw new Error('Your bag is empty');
    const lines = []; let sub = 0; const stockMap = {};
    for (const it of items) {
      const p = db.products.find(x => x.id === it.product_id), b = p && db.brands.find(x => x.id === p.brand_id), q = parseInt(it.quantity, 10);
      if (!p || !p.published || !b || !b.visible || b.coming_soon || p.availability !== 'available') throw new Error('An item in your bag is no longer available');
      if (!(q >= 1 && q <= 50)) throw new Error('Invalid quantity');
      if ((p.sizes || []).length && !(p.sizes || []).includes(it.size)) throw new Error('Please choose a size for ' + p.name);
      if (p.stock != null) { stockMap[p.id] = (stockMap[p.id] ?? p.stock) - q; if (stockMap[p.id] < 0) throw new Error('Not enough stock for ' + p.name); }
      lines.push({ id: uuid(), product_id: p.id, brand_id: p.brand_id, product_name: p.name, size: it.size || null, unit_price: p.price, quantity: q, line_total: +(p.price * q).toFixed(2) }); sub += p.price * q;
    }
    Object.entries(stockMap).forEach(([id, s]) => { db.products.find(x => x.id === id).stock = s; });
    db.seq += 1; const o = { id: uuid(), order_number: 'ORD-' + db.seq, status: 'pending', payment_status: 'unpaid', payment_reference: null, customer_name: name, phone, email: (c.email || '').trim() || null, address: addr, notes: (c.notes || '').trim() || null, subtotal: +sub.toFixed(2), total: +sub.toFixed(2), created_at: new Date().toISOString(), order_items: lines };
    db.orders.unshift(o); lsave(db); return { order_number: o.order_number, total: o.total };
  },
  async listOrders() { return clone((await ldb()).orders); },
  async updateOrder(id, patch) { const db = await ldb(); const o = db.orders.find(x => x.id === id); if (o) Object.assign(o, patch); lsave(db); },
  async signIn(email, password) { if (email.trim().toLowerCase() === 'admin@local' && password === 'admin') { sessionStorage.setItem('hd_local_admin', '1'); return { id: 'local', email: 'admin@local' }; } throw new Error('Local preview sign-in is admin@local / admin'); },
  async isAdmin() { return sessionStorage.getItem('hd_local_admin') === '1'; },
  async user() { return (await local.isAdmin()) ? { id: 'local', email: 'admin@local' } : null; },
  signOut() { sessionStorage.removeItem('hd_local_admin'); },
  async upload(file) {   // downscale to keep localStorage small
    const bmp = await createImageBitmap(file); const s = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
  },
  reset() { localStorage.removeItem(LKEY); },
};

/* ───────── STATIC (read-only) ───────── */
const unavailable = () => { const e = new Error('Online ordering is not switched on yet.'); e.code = 'unavailable'; throw e; };
const stat = { async loadAll() { return shape(await (await fetch(ROOT + 'data/seed.json')).json()); }, placeOrder: unavailable, signIn: unavailable, isAdmin: async () => false, user: async () => null, signOut() { } };

for (const k of ['saveRow', 'patchRow', 'removeRow', 'saveProduct', 'saveSettings', 'placeOrder', 'updateOrder']) local[k] = serial(local[k]);
const impl = MODE === 'remote' ? remote : MODE === 'local' ? local : stat;
export const Store = Object.assign({ mode: MODE }, impl);
export const FILE_RULES = { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024 };
export function validateImage(file) { if (!FILE_RULES.types.includes(file.type)) return 'Only JPG, PNG or WebP images are allowed.'; if (file.size > FILE_RULES.maxBytes) return 'Image is larger than 5 MB.'; return null; }
