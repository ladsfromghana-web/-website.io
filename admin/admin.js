import { Store, MODE, asset, uuid, validateImage } from '../js/store.js';
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => 'GH\u20b5' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdt = (i) => new Date(i).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const REV = ['confirmed', 'processing', 'shipped', 'delivered'];      // revenue = orders the admin has confirmed (and not cancelled)
const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const root = $('#root'); const S = { data: null, orders: [], user: null, route: 'overview' };
const slugify = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function toast(msg, err) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2800); }
function modal(title, html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hd"><h2>${esc(title)}</h2><button class="btn s" data-x>\u2715 Close</button></div><div class="mb">${html}</div></div>`; document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', k); }; const k = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', k);
  m.addEventListener('mousedown', e => { if (e.target === m) close(); }); $('[data-x]', m).onclick = close; return { el: m, close }; }
async function reload() { const [d, o] = await Promise.all([Store.loadAll(), Store.listOrders()]); S.data = d; S.orders = o; }
const brandName = (id) => { const b = (S.data.brands || []).find(x => x.id === id); return b ? b.name : '\u2014'; };
const brandOptions = (sel, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + S.data.brands.map(b => `<option value="${esc(b.id)}"${b.id === sel ? ' selected' : ''}>${esc(b.name)}</option>`).join('');
const thumb = (u) => u ? `<img class="thumb" src="${esc(asset(u))}" alt="">` : '<span class="thumb" style="display:inline-block"></span>';

/* ───────── image upload helper ───────── */
function pickImages(multiple = true) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp'; i.multiple = multiple; i.onchange = () => res(Array.from(i.files)); i.click(); }); }
async function uploadFiles(files, folder) { const urls = []; for (const f of files) { const bad = validateImage(f); if (bad) { toast(`${f.name}: ${bad}`, true); continue; } try { urls.push(await Store.upload(f, folder)); } catch (e) { toast(`${f.name}: ${e.message}`, true); } } return urls; }

/* ───────── boot / auth ───────── */
(async () => {
  if (MODE === 'static') return root.innerHTML = `<div class="login"><div class="login-card"><h1>Admin is not enabled</h1><p class="sub">The dashboard needs a backend. Add your Supabase URL and anon key to <code>js/config.js</code> (see README.md), then reload this page.</p><a class="btn" href="../index.html">Back to the website</a></div></div>`;
  S.user = await Store.user().catch(() => null);
  if (!S.user) return login();
  await start();
})();
function login() {
  root.innerHTML = `<div class="login"><form class="login-card" id="lf"><h1>Admin sign in</h1><p class="sub">Lads From Ghana \u00d7 Her District</p>
    ${MODE === 'local' ? '<div class="banner">Local preview only \u2014 sign in with <b>admin@local</b> / <b>admin</b>. This is not secure and is disabled outside localhost.</div>' : ''}
    <label class="f"><span>Email</span><input type="email" name="email" autocomplete="username" required></label><label class="f"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <p class="err" id="le" hidden></p><button class="btn p" style="width:100%;justify-content:center">Sign in</button></form></div>`;
  $('#lf').onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target), b = $('#lf button'); b.disabled = true; try { S.user = await Store.signIn(f.get('email'), f.get('password')); await start(); } catch (x) { const el = $('#le'); el.hidden = false; el.textContent = x.message; b.disabled = false; } };
}
async function start() { try { await reload(); } catch (e) { root.innerHTML = `<div class="login"><div class="login-card"><h1>Could not load data</h1><p class="err">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Retry</button></div></div>`; return; } shell(); addEventListener('hashchange', route); route(); }
const NAV = [['overview', 'Overview'], ['orders', 'Orders'], ['products', 'Products'], ['brands', 'Brands'], ['homepage', 'Homepage'], ['lookbook', 'Lookbook'], ['customers', 'Customers']];
function shell() {
  root.innerHTML = `<div class="shell"><aside class="side"><div class="brand"><img src="${asset('assets/img/lfg-logo.jpg')}" alt=""><span>ADMIN</span></div>${NAV.map(([k, l]) => `<a class="nav" href="#/${k}" data-r="${k}">${l}</a>`).join('')}<div class="grow"></div>
    <a class="nav" href="../index.html" target="_blank" rel="noopener">View website \u2197</a><div class="who">${esc(S.user.email || '')}</div><button class="btn s" id="so">Sign out</button></aside><main class="main" id="main"></main></div>`;
  $('#so').onclick = () => { Store.signOut(); location.hash = ''; location.reload(); };
}
function route() { const r = (location.hash.replace(/^#\/?/, '') || 'overview').split('/')[0]; S.route = PAGES[r] ? r : 'overview'; $$('.side a.nav[data-r]').forEach(a => a.removeAttribute('aria-current')); const a = $(`.side a[data-r="${S.route}"]`); if (a) a.setAttribute('aria-current', 'page'); const main = $('#main'); main.innerHTML = (MODE === 'local' ? '<div class="banner">LOCAL PREVIEW \u2014 data is stored in this browser only.</div>' : '') + '<div id="pg"></div>'; PAGES[S.route]($('#pg')); }
const refresh = async () => { await reload(); route(); };

/* ───────── overview + sales by brand ───────── */
const RANGE = { preset: sessionStorage.getItem('hd_range') || '30', from: '', to: '' };
function bounds() { const now = new Date(); if (RANGE.preset === 'all') return [null, null]; if (RANGE.preset === 'custom') return [RANGE.from ? new Date(RANGE.from + 'T00:00:00') : null, RANGE.to ? new Date(RANGE.to + 'T23:59:59') : null]; const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (parseInt(RANGE.preset, 10) - 1)); return [d, now]; }
const inRange = (o, [a, b]) => { const t = new Date(o.created_at); return (!a || t >= a) && (!b || t <= b); };
function compute(orders) {
  const rev = orders.filter(o => REV.includes(o.status)), per = {};
  S.data.brands.forEach(b => per[b.id] = { id: b.id, name: b.name, revenue: 0, units: 0, orders: new Set() });
  const sellers = {};
  rev.forEach(o => (o.order_items || []).forEach(i => { const k = i.brand_id || 'other'; per[k] ||= { id: k, name: 'Other', revenue: 0, units: 0, orders: new Set() }; const l = Number(i.line_total); per[k].revenue += l; per[k].units += i.quantity; per[k].orders.add(o.id); const sk = (i.product_id || i.product_name); sellers[sk] ||= { name: i.product_name, brand: i.brand_id, units: 0, revenue: 0 }; sellers[sk].units += i.quantity; sellers[sk].revenue += l; }));
  const customers = new Set(orders.filter(o => o.status !== 'cancelled').map(o => (o.phone || '').replace(/\D/g, '') || o.email || o.customer_name));
  return { rev, per: Object.values(per), revenue: rev.reduce((n, o) => n + Number(o.total), 0), pending: orders.filter(o => o.status === 'pending'), customers: customers.size, sellers: Object.values(sellers).sort((a, b) => b.units - a.units).slice(0, 5) };
}
function trend(rev, [a, b]) {
  if (!rev.length) return null; const dates = rev.map(o => new Date(o.created_at)); const from = a || new Date(Math.min(...dates)), to = b || new Date(Math.max(...dates)); const days = Math.max(1, Math.round((to - from) / 864e5) + 1); const month = days > 62; const key = (d) => month ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10); const m = {};
  rev.forEach(o => { const k = key(new Date(o.created_at)); m[k] = (m[k] || 0) + Number(o.total); });
  const keys = []; if (!month) { const d = new Date(from); d.setHours(12); for (let i = 0; i < days; i++) { keys.push(key(d)); d.setDate(d.getDate() + 1); } } else Object.keys(m).sort().forEach(k => keys.push(k));
  return { keys, vals: keys.map(k => m[k] || 0), month };
}
function pOverview(el) {
  const bd = bounds(), orders = S.orders.filter(o => inRange(o, bd)), c = compute(orders), t = trend(c.rev, bd), maxv = t ? Math.max(...t.vals, 1) : 1;
  const pubProducts = S.data.products.filter(p => p.published).length;
  el.innerHTML = `<div class="top"><h1>Overview</h1><div class="row"><select id="rp" aria-label="Date range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option><option value="custom">Custom\u2026</option></select>
      <span id="cr" ${RANGE.preset === 'custom' ? '' : 'hidden'}><input type="date" id="rf" value="${RANGE.from}"> <input type="date" id="rt" value="${RANGE.to}"></span></div></div>
    <div class="grid g4"><div class="card stat"><div class="lbl">Revenue</div><div class="val">${money(c.revenue)}</div><div class="sub">confirmed, processing, shipped &amp; delivered orders</div></div>
      <div class="card stat"><div class="lbl">Orders</div><div class="val">${orders.filter(o => o.status !== 'cancelled').length}</div><div class="sub">${c.pending.length} pending \u00b7 ${money(c.pending.reduce((n, o) => n + Number(o.total), 0))} awaiting confirmation</div></div>
      <div class="card stat"><div class="lbl">Products</div><div class="val">${S.data.products.length}</div><div class="sub">${pubProducts} published</div></div>
      <div class="card stat"><div class="lbl">Customers</div><div class="val">${c.customers}</div><div class="sub">unique, from order details</div></div></div>
    <div class="grid g2" style="margin-top:16px"><div class="card"><h2>Sales by brand</h2><div class="scroll"><table class="tbl"><thead><tr><th>Brand</th><th class="num">Revenue</th><th class="num">Orders</th><th class="num">Units</th></tr></thead><tbody>
      ${c.per.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${money(p.revenue)}</td><td class="num">${p.orders.size}</td><td class="num">${p.units}</td></tr>`).join('')}
      <tr><td><b>Combined</b></td><td class="num"><b>${money(c.revenue)}</b></td><td class="num"><b>${c.rev.length}</b></td><td class="num"><b>${c.per.reduce((n, p) => n + p.units, 0)}</b></td></tr></tbody></table></div>
      ${c.rev.length ? '' : '<p class="empty">No confirmed sales in this period yet.</p>'}</div>
      <div class="card"><h2>Revenue trend (${t && t.month ? 'by month' : 'by day'})</h2>${t ? `<div class="bars">${t.vals.map((v, i) => `<div style="height:${Math.max(2, v / maxv * 100)}%" title="${esc(t.keys[i])}: ${money(v)}"></div>`).join('')}</div><div class="bars-x"><span>${esc(t.keys[0])}</span><span>${esc(t.keys[t.keys.length - 1])}</span></div>` : '<p class="empty">No sales to chart yet.</p>'}</div></div>
    <div class="grid g2" style="margin-top:16px"><div class="card"><h2>Recent orders</h2>${S.orders.length ? `<table class="tbl"><tbody>${S.orders.slice(0, 6).map(o => `<tr class="click" data-o="${esc(o.id)}"><td><b>${esc(o.order_number)}</b><br><span class="hint">${fdt(o.created_at)}</span></td><td>${esc(o.customer_name)}</td><td class="num">${money(o.total)}</td><td><span class="badge ${esc(o.status)}">${esc(o.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="empty">No orders yet.</p>'}</div>
      <div class="card"><h2>Best-selling products</h2>${c.sellers.length ? `<table class="tbl"><tbody>${c.sellers.map(s => `<tr><td>${esc(s.name)}<br><span class="hint">${esc(brandName(s.brand))}</span></td><td class="num">${s.units} sold</td><td class="num">${money(s.revenue)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nothing sold yet.</p>'}</div></div>
    <p class="hint" style="margin-top:14px">Revenue counts orders whose status is confirmed, processing, shipped or delivered. Pending and cancelled orders are excluded. Figures come from saved order records only; payment is confirmed manually until an online payment provider is connected.</p>`;
  const sel = $('#rp'); sel.value = RANGE.preset; sel.onchange = () => { RANGE.preset = sel.value; sessionStorage.setItem('hd_range', RANGE.preset); pOverview(el); };
  if ($('#rf')) { $('#rf').onchange = () => { RANGE.from = $('#rf').value; pOverview(el); }; $('#rt').onchange = () => { RANGE.to = $('#rt').value; pOverview(el); }; }
  $$('tr[data-o]', el).forEach(r => r.onclick = () => orderModal(r.dataset.o));
}

/* ───────── orders ───────── */
const OF = { status: '', brand: '', q: '' };
function orderBrands(o) { return [...new Set((o.order_items || []).map(i => i.brand_id))].map(brandName).join(', '); }
function pOrders(el) {
  const list = S.orders.filter(o => (!OF.status || o.status === OF.status) && (!OF.brand || (o.order_items || []).some(i => i.brand_id === OF.brand)) && (!OF.q || [o.order_number, o.customer_name, o.phone, o.email].join(' ').toLowerCase().includes(OF.q.toLowerCase())));
  el.innerHTML = `<div class="top"><h1>Orders</h1><button class="btn" id="csv">Export CSV</button></div><div class="card"><div class="row" style="margin-bottom:14px"><select id="os"><option value="">All statuses</option>${STATUSES.map(s => `<option${s === OF.status ? ' selected' : ''}>${s}</option>`).join('')}</select>
    <select id="ob">${brandOptions(OF.brand, 'All brands')}</select><input type="text" id="oq" placeholder="Search order, name, phone\u2026" value="${esc(OF.q)}" style="max-width:260px"></div>
    ${list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Brand</th><th class="num">Items</th><th class="num">Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>${list.map(o => `<tr class="click" data-o="${esc(o.id)}"><td><b>${esc(o.order_number)}</b></td><td>${fdt(o.created_at)}</td><td>${esc(o.customer_name)}<br><span class="hint">${esc(o.phone)}</span></td><td>${esc(orderBrands(o))}</td><td class="num">${(o.order_items || []).reduce((n, i) => n + i.quantity, 0)}</td><td class="num">${money(o.total)}</td><td><span class="badge ${esc(o.status)}">${esc(o.status)}</span></td><td><span class="badge ${esc(o.payment_status)}">${esc(o.payment_status)}</span></td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${S.orders.length ? 'No orders match these filters.' : 'No orders yet. Orders placed on the website will appear here.'}</p>`}</div>`;
  $('#os').onchange = (e) => { OF.status = e.target.value; pOrders(el); }; $('#ob').onchange = (e) => { OF.brand = e.target.value; pOrders(el); };
  $('#oq').oninput = (e) => { OF.q = e.target.value; clearTimeout(pOrders.t); pOrders.t = setTimeout(() => { pOrders(el); const q = $('#oq'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
  $$('tr[data-o]', el).forEach(r => r.onclick = () => orderModal(r.dataset.o));
  $('#csv').onclick = () => { const rows = [['Order', 'Date', 'Status', 'Payment', 'Customer', 'Phone', 'Email', 'Address', 'Brand', 'Product', 'Size', 'Qty', 'Unit price', 'Line total']]; list.forEach(o => (o.order_items || []).forEach(i => rows.push([o.order_number, o.created_at, o.status, o.payment_status, o.customer_name, o.phone, o.email || '', o.address, brandName(i.brand_id), i.product_name, i.size || '', i.quantity, i.unit_price, i.line_total]))); const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'orders.csv'; a.click(); };
}
function orderModal(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const m = modal('Order ' + o.order_number, `<div class="two"><div><p><b>${esc(o.customer_name)}</b></p><p>${esc(o.phone)}${o.email ? '<br>' + esc(o.email) : ''}</p><p style="margin-top:8px">${esc(o.address)}</p>${o.notes ? `<p class="hint" style="margin-top:8px">Notes: ${esc(o.notes)}</p>` : ''}<p class="hint" style="margin-top:8px">Placed ${fdt(o.created_at)}</p></div>
      <div><label class="f"><span>Order status</span><select id="st">${STATUSES.map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
      <label class="f"><span>Payment status</span><select id="ps">${['unpaid', 'paid', 'refunded'].map(s => `<option${s === o.payment_status ? ' selected' : ''}>${s}</option>`).join('')}</select><div class="hint">Set manually only after you have verified the payment yourself. Online payments are not connected yet.</div></label></div></div>
    <table class="tbl"><thead><tr><th>Product</th><th>Brand</th><th>Size</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>${(o.order_items || []).map(i => `<tr><td>${esc(i.product_name)}</td><td>${esc(brandName(i.brand_id))}</td><td>${esc(i.size || '\u2014')}</td><td class="num">${i.quantity}</td><td class="num">${money(i.unit_price)}</td><td class="num">${money(i.line_total)}</td></tr>`).join('')}<tr><td colspan="5" class="num"><b>Total</b></td><td class="num"><b>${money(o.total)}</b></td></tr></tbody></table>
    <p class="err" id="oe" hidden></p><div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn p" id="sv">Save changes</button></div>`);
  $('#sv', m.el).onclick = async () => { const b = $('#sv', m.el); b.disabled = true; try { await Store.updateOrder(o.id, { status: $('#st', m.el).value, payment_status: $('#ps', m.el).value }); m.close(); toast('Order updated'); await refresh(); } catch (e) { const er = $('#oe', m.el); er.hidden = false; er.textContent = e.message; b.disabled = false; } };
}

/* ───────── products ───────── */
const PF = { brand: '' };
function pProducts(el) {
  const list = S.data.products.filter(p => !PF.brand || p.brand_id === PF.brand);
  el.innerHTML = `<div class="top"><h1>Products</h1><div class="row"><select id="pb">${brandOptions(PF.brand, 'All brands')}</select><button class="btn p" id="np">+ New product</button></div></div><div class="card">${list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th></th><th>Name</th><th>Brand</th><th class="num">Price</th><th>Status</th><th class="num">Stock</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td>${thumb(p.images[0] && p.images[0].url)}</td><td><b>${esc(p.name)}</b><br><span class="hint">${esc(p.category)}${p.featured ? ' \u00b7 featured' : ''}</span></td><td>${esc(brandName(p.brand_id))}</td><td class="num">${money(p.price)}</td><td><span class="badge ${p.published ? 'ok' : 'off'}">${p.published ? 'published' : 'draft'}</span> ${p.availability !== 'available' ? '<span class="badge off">sold out</span>' : ''}</td><td class="num">${p.stock == null ? '\u2014' : p.stock}</td><td class="num"><button class="btn s" data-e="${esc(p.id)}">Edit</button> <button class="btn s d" data-d="${esc(p.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No products yet. Click \u201cNew product\u201d to add one.</p>'}</div>`;
  $('#pb').onchange = (e) => { PF.brand = e.target.value; pProducts(el); }; $('#np').onclick = () => productModal(null);
  $$('[data-e]', el).forEach(b => b.onclick = () => productModal(b.dataset.e));
  $$('[data-d]', el).forEach(b => b.onclick = async () => { const p = S.data.products.find(x => x.id === b.dataset.d); if (!confirm(`Delete \u201c${p.name}\u201d? Past orders keep their record. This cannot be undone.`)) return; try { await Store.removeRow('products', p.id); toast('Product deleted'); await refresh(); } catch (e) { toast(e.message, true); } });
}
function productModal(id) {
  const p = id ? S.data.products.find(x => x.id === id) : null; const imgs = p ? p.images.map(i => ({ url: i.url })) : []; const defBrand = PF.brand || (S.data.brands.find(b => !b.coming_soon) || S.data.brands[0]).id;
  const m = modal(p ? 'Edit product' : 'New product', `<form id="pf" novalidate><div class="two"><label class="f"><span>Product name *</span><input type="text" name="name" value="${esc(p ? p.name : '')}" required maxlength="120"></label>
    <label class="f"><span>Brand *</span><select name="brand_id">${brandOptions(p ? p.brand_id : defBrand)}</select></label></div>
    <div class="two"><label class="f"><span>Price (GH\u20b5) *</span><input type="number" name="price" step="0.01" min="0" value="${p ? p.price : ''}" required></label><label class="f"><span>Category</span><input type="text" name="category" value="${esc(p ? p.category : '')}" placeholder="e.g. Tops"></label></div>
    <label class="f"><span>URL name (slug)</span><input type="text" name="slug" value="${esc(p ? p.slug : '')}" placeholder="auto from the name"><div class="hint">Used in the product link. Letters, numbers and dashes only.</div></label>
    <label class="f"><span>Description</span><textarea name="description" rows="4" placeholder="Shown on the product page. Leave empty to show nothing.">${esc(p ? p.description : '')}</textarea></label>
    <div class="two"><label class="f"><span>Availability</span><select name="availability"><option value="available"${p && p.availability !== 'available' ? '' : ' selected'}>Available</option><option value="sold_out"${p && p.availability === 'sold_out' ? ' selected' : ''}>Sold out</option></select></label>
      <label class="f"><span>Stock quantity</span><input type="number" name="stock" min="0" step="1" value="${p && p.stock != null ? p.stock : ''}" placeholder="blank = not tracked"></label></div>
    <label class="f"><span>Sizes (comma separated)</span><input type="text" name="sizes" value="${esc(p ? p.sizes.join(', ') : '')}" placeholder="e.g. S, M, L \u2014 leave empty for no size choice"></label>
    <div class="row"><label class="chk"><input type="checkbox" name="published"${p ? (p.published ? ' checked' : '') : ' checked'}> Published (visible in the shop)</label><label class="chk"><input type="checkbox" name="featured"${p && p.featured ? ' checked' : ''}> Featured</label></div>
    <label class="f"><span>Images \u2014 the first image is the main product image</span></label><div class="imgs" id="il"></div><div class="row" style="margin:10px 0"><button type="button" class="btn s" id="up">+ Upload images</button><span class="hint">JPG, PNG or WebP, up to 5 MB each.</span></div>
    <p class="err" id="pe" hidden></p><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-x2>Cancel</button><button class="btn p" id="ps">${p ? 'Save changes' : 'Create product'}</button></div></form>`);
  const drawImgs = () => { $('#il', m.el).innerHTML = imgs.length ? imgs.map((im, i) => `<div class="imgrow"><img src="${esc(asset(im.url))}" alt=""><div class="grow">${i === 0 ? '<span class="badge ok">Main image</span>' : 'Gallery image ' + (i + 1)}</div>${i > 0 ? `<button type="button" class="btn s" data-a="main" data-i="${i}">Make main</button>` : ''}<button type="button" class="btn s" data-a="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move earlier">\u2191</button><button type="button" class="btn s" data-a="dn" data-i="${i}" ${i === imgs.length - 1 ? 'disabled' : ''} aria-label="Move later">\u2193</button><button type="button" class="btn s d" data-a="rm" data-i="${i}">Remove</button></div>`).join('') : '<p class="hint">No images yet.</p>'; };
  drawImgs();
  $('#il', m.el).onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const i = +b.dataset.i, a = b.dataset.a; if (a === 'rm') imgs.splice(i, 1); else if (a === 'main') imgs.unshift(imgs.splice(i, 1)[0]); else if (a === 'up') [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]; else if (a === 'dn') [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]]; drawImgs(); };
  $('#up', m.el).onclick = async (e) => { const files = await pickImages(true); if (!files.length) return; e.target.disabled = true; e.target.textContent = 'Uploading\u2026'; (await uploadFiles(files, 'products')).forEach(u => imgs.push({ url: u })); e.target.disabled = false; e.target.textContent = '+ Upload images'; drawImgs(); };
  $('[data-x2]', m.el).onclick = m.close;
  $('#pf', m.el).onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), err = $('#pe', m.el), btn = $('#ps', m.el); const fail = (t) => { err.hidden = false; err.textContent = t; };
    const name = String(f.get('name')).trim(), price = parseFloat(f.get('price')), slug = slugify(f.get('slug') || name), stockRaw = String(f.get('stock')).trim(), published = f.get('published') === 'on';
    if (name.length < 2) return fail('Please enter a product name.'); if (!(price >= 0) || isNaN(price)) return fail('Please enter a valid price in GH\u20b5.');
    if (!slug) return fail('Please enter a URL name.'); if (S.data.products.some(x => x.slug === slug && x.id !== (p && p.id))) return fail('Another product already uses that URL name.');
    if (stockRaw !== '' && !(/^\d+$/.test(stockRaw))) return fail('Stock must be a whole number, or empty.'); if (published && !imgs.length) return fail('Add at least one image before publishing.');
    const row = { id: p ? p.id : uuid(), brand_id: f.get('brand_id'), name, slug, price: Math.round(price * 100) / 100, description: String(f.get('description')).trim(), category: String(f.get('category')).trim(), availability: f.get('availability'), published, featured: f.get('featured') === 'on', stock: stockRaw === '' ? null : parseInt(stockRaw, 10), sizes: String(f.get('sizes')).split(',').map(s => s.trim()).filter(Boolean), sort: p ? p.sort : (Math.max(0, ...S.data.products.map(x => x.sort || 0)) + 1), images: imgs };
    btn.disabled = true; try { await Store.saveProduct(row); m.close(); toast('Product saved'); await refresh(); } catch (x) { fail(x.message); btn.disabled = false; }
  };
}

/* ───────── brands ───────── */
function pBrands(el) {
  el.innerHTML = `<div class="top"><h1>Brands</h1></div><div class="grid g2">${S.data.brands.map(b => `<form class="card" data-b="${esc(b.id)}"><h2>${esc(b.name)}</h2>
    <div class="row" style="margin-bottom:12px">${thumb(b.logo_url).replace('class="thumb"', 'class="thumb" style="border-radius:50%;width:56px;height:56px"')}<button type="button" class="btn s" data-u="logo_url">Change logo</button>${thumb(b.banner_url)}<button type="button" class="btn s" data-u="banner_url">Change banner</button></div>
    <label class="f"><span>Brand name</span><input type="text" name="name" value="${esc(b.name)}" required></label><label class="f"><span>Description</span><textarea name="description" rows="3">${esc(b.description)}</textarea></label>
    <label class="f"><span>Instagram link</span><input type="url" name="instagram_url" value="${esc(b.instagram_url || '')}" placeholder="https://www.instagram.com/\u2026"></label>
    <div class="chk"><input type="checkbox" name="visible" id="v-${esc(b.id)}"${b.visible ? ' checked' : ''}><label for="v-${esc(b.id)}">Collection visible on the website</label></div>
    <div class="chk"><input type="checkbox" name="coming_soon" id="c-${esc(b.id)}"${b.coming_soon ? ' checked' : ''}><label for="c-${esc(b.id)}"><b>Coming soon</b> \u2014 shows \u201cDropping soon\u201d and blocks purchases</label></div>
    <label class="f"><span>Coming-soon message</span><input type="text" name="coming_soon_message" value="${esc(b.coming_soon_message || '')}"></label>
    <label class="f"><span>Collection preview images (used while coming soon)</span></label><div class="imgs" data-pv></div><div class="row" style="margin:8px 0 14px"><button type="button" class="btn s" data-u="preview">+ Add preview image</button></div>
    <p class="err" hidden></p><button class="btn p">Save ${esc(b.name)}</button></form>`).join('')}</div>`;
  $$('form[data-b]', el).forEach(f => {
    const b = S.data.brands.find(x => x.id === f.dataset.b), st = { ...b, preview_images: [...b.preview_images] };
    const draw = () => { $('[data-pv]', f).innerHTML = st.preview_images.length ? st.preview_images.map((u, i) => `<div class="imgrow"><img src="${esc(asset(u))}" alt=""><div class="grow">Preview ${i + 1}</div><button type="button" class="btn s" data-p="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>\u2191</button><button type="button" class="btn s d" data-p="rm" data-i="${i}">Remove</button></div>`).join('') : '<p class="hint">No preview images.</p>'; }; draw();
    f.onclick = async (e) => { const bt = e.target.closest('button'); if (!bt) return; if (bt.dataset.p) { const i = +bt.dataset.i; if (bt.dataset.p === 'rm') st.preview_images.splice(i, 1); else[st.preview_images[i - 1], st.preview_images[i]] = [st.preview_images[i], st.preview_images[i - 1]]; draw(); } else if (bt.dataset.u) { const k = bt.dataset.u; const files = await pickImages(k === 'preview'); if (!files.length) return; bt.disabled = true; const urls = await uploadFiles(files, 'brands'); bt.disabled = false; if (!urls.length) return; if (k === 'preview') { st.preview_images.push(...urls); draw(); } else { st[k] = urls[0]; bt.insertAdjacentHTML('beforebegin', `<img class="thumb" src="${esc(asset(urls[0]))}" alt="">`); toast('Image ready \u2014 click Save to apply'); } } };
    f.onsubmit = async (e) => { e.preventDefault(); const d = new FormData(f), er = $('.err', f); er.hidden = true; const name = String(d.get('name')).trim(); if (name.length < 2) { er.hidden = false; er.textContent = 'Brand name is required.'; return; }
      const row = { ...st, name, description: String(d.get('description')).trim(), instagram_url: String(d.get('instagram_url')).trim() || null, visible: d.get('visible') === 'on', coming_soon: d.get('coming_soon') === 'on', coming_soon_message: String(d.get('coming_soon_message')).trim() };
      try { await Store.saveRow('brands', row); toast(name + ' saved'); await refresh(); } catch (x) { er.hidden = false; er.textContent = x.message; } };
  });
}

/* ───────── homepage ───────── */
const SET_FIELDS = [['announcement_text', 'Announcement bar text', 'text'], ['announcement_visible', 'Show announcement bar', 'bool'], ['promo_label', 'Promotional label (shown under the collections)', 'text'], ['collections_eyebrow', 'Collections \u2014 small heading', 'text'], ['collections_title', 'Collections \u2014 title', 'text'], ['collections_intro', 'Collections \u2014 intro text', 'text'], ['lookbook_title', 'Lookbook \u2014 title', 'text'], ['lookbook_intro', 'Lookbook \u2014 intro text', 'text'], ['whatsapp_number', 'WhatsApp number for order confirmations (digits, with country code)', 'text']];
function pHome(el) {
  const sl = S.data.slides;
  el.innerHTML = `<div class="top"><h1>Homepage</h1><button class="btn p" id="ns">+ Add slide</button></div><div class="card"><h2>Hero slideshow</h2>${sl.length ? `<div class="scroll"><table class="tbl"><thead><tr><th></th><th>Headline</th><th>Layout</th><th>Brand</th><th>Visible</th><th></th></tr></thead><tbody>${sl.map((s, i) => `<tr><td>${thumb(s.image_url)}</td><td><b>${esc(s.headline)}</b><br><span class="hint">${esc(s.subtext || '')}</span></td><td>${esc(s.layout)}</td><td>${esc(brandName(s.brand_id))}</td><td><input type="checkbox" data-v="${esc(s.id)}" ${s.visible ? 'checked' : ''} aria-label="Visible"></td><td class="num"><button class="btn s" data-mv="up" data-id="${esc(s.id)}" ${i === 0 ? 'disabled' : ''}>\u2191</button> <button class="btn s" data-mv="dn" data-id="${esc(s.id)}" ${i === sl.length - 1 ? 'disabled' : ''}>\u2193</button> <button class="btn s" data-e="${esc(s.id)}">Edit</button> <button class="btn s d" data-d="${esc(s.id)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No slides. The homepage hero will be empty.</p>'}</div>
    <form class="card" id="sf" style="margin-top:16px"><h2>Homepage text &amp; labels</h2><div class="two">${SET_FIELDS.map(([k, l, t]) => t === 'bool' ? `<div class="chk"><input type="checkbox" name="${k}" id="s-${k}" ${S.data.settings[k] === 'true' ? 'checked' : ''}><label for="s-${k}">${esc(l)}</label></div>` : `<label class="f"><span>${esc(l)}</span><input type="text" name="${k}" value="${esc(S.data.settings[k] || '')}"></label>`).join('')}</div><button class="btn p">Save text</button></form>
    <p class="hint" style="margin-top:12px">Brand collection previews are managed under <a href="#/brands">Brands</a> (preview images, coming-soon status). Her District\u2019s preview uses its published products automatically.</p>`;
  $('#ns').onclick = () => slideModal(null);
  $$('[data-e]', el).forEach(b => b.onclick = () => slideModal(b.dataset.e));
  $$('[data-d]', el).forEach(b => b.onclick = async () => { if (!confirm('Delete this slide?')) return; try { await Store.removeRow('homepage_slides', b.dataset.d); toast('Slide deleted'); await refresh(); } catch (e) { toast(e.message, true); } });
  $$('[data-v]', el).forEach(c => c.onchange = async () => { try { await Store.patchRow('homepage_slides', c.dataset.v, { visible: c.checked }); toast('Saved'); await reload(); } catch (e) { toast(e.message, true); c.checked = !c.checked; } });
  $$('[data-mv]', el).forEach(b => b.onclick = async () => { const i = sl.findIndex(s => s.id === b.dataset.id), j = b.dataset.mv === 'up' ? i - 1 : i + 1, a = sl[i], c = sl[j]; try { await Promise.all([Store.patchRow('homepage_slides', a.id, { position: c.position }), Store.patchRow('homepage_slides', c.id, { position: a.position })]); await refresh(); } catch (e) { toast(e.message, true); } });
  $('#sf').onsubmit = async (e) => { e.preventDefault(); const d = new FormData(e.target), o = {}; SET_FIELDS.forEach(([k, , t]) => { o[k] = t === 'bool' ? (d.get(k) === 'on' ? 'true' : 'false') : String(d.get(k) || '').trim(); }); try { await Store.saveSettings(o); toast('Homepage text saved'); await refresh(); } catch (x) { toast(x.message, true); } };
}
function slideModal(id) {
  const s = id ? S.data.slides.find(x => x.id === id) : null; let img = s ? s.image_url : '';
  const m = modal(s ? 'Edit slide' : 'Add slide', `<form id="sl"><div class="row" style="margin-bottom:12px"><img class="thumb" id="si" ${img ? `src="${esc(asset(img))}"` : ''} alt="" style="width:70px;height:90px"><button type="button" class="btn s" id="su">${img ? 'Replace image' : 'Upload image'}</button></div>
    <label class="f"><span>Headline</span><input type="text" name="headline" value="${esc(s ? s.headline : '')}"></label><label class="f"><span>Sub-text</span><input type="text" name="subtext" value="${esc(s ? s.subtext : '')}"></label>
    <div class="two"><label class="f"><span>Button label</span><input type="text" name="cta_label" value="${esc(s ? s.cta_label : '')}"></label><label class="f"><span>Button link</span><input type="text" name="cta_url" value="${esc(s ? s.cta_url : '')}" placeholder="e.g. her-district.html"></label></div>
    <div class="two"><label class="f"><span>Layout</span><select name="layout"><option value="photo"${s && s.layout === 'photo' ? ' selected' : ''}>Photo \u2014 single image</option><option value="layered"${!s || s.layout === 'layered' ? ' selected' : ''}>Layered \u2014 brand logo behind the image</option></select></label><label class="f"><span>Brand</span><select name="brand_id">${brandOptions(s && s.brand_id, 'None')}</select></label></div>
    <label class="chk"><input type="checkbox" name="visible"${!s || s.visible ? ' checked' : ''}> Visible</label><p class="err" id="se" hidden></p><div class="row" style="justify-content:flex-end"><button class="btn p">${s ? 'Save slide' : 'Add slide'}</button></div></form>`);
  $('#su', m.el).onclick = async () => { const f = await pickImages(false); if (!f.length) return; const u = await uploadFiles(f, 'slides'); if (u[0]) { img = u[0]; $('#si', m.el).src = asset(img); } };
  $('#sl', m.el).onsubmit = async (e) => { e.preventDefault(); const d = new FormData(e.target), er = $('#se', m.el); if (!img) { er.hidden = false; er.textContent = 'Please upload an image.'; return; }
    const row = { id: s ? s.id : uuid(), image_url: img, headline: String(d.get('headline')).trim(), subtext: String(d.get('subtext')).trim(), cta_label: String(d.get('cta_label')).trim(), cta_url: String(d.get('cta_url')).trim(), layout: d.get('layout'), brand_id: d.get('brand_id') || null, visible: d.get('visible') === 'on', position: s ? s.position : Math.max(0, ...S.data.slides.map(x => x.position || 0)) + 1 };
    try { await Store.saveRow('homepage_slides', row); m.close(); toast('Slide saved'); await refresh(); } catch (x) { er.hidden = false; er.textContent = x.message; } };
}

/* ───────── lookbook ───────── */
function pLook(el) {
  const L = S.data.lookbook;
  el.innerHTML = `<div class="top"><h1>Lookbook</h1><div class="row"><select id="lb" aria-label="Brand for new images">${brandOptions('', 'New images: no brand')}</select><button class="btn p" id="la">+ Add images</button></div></div>
    ${L.length ? `<div class="lbgrid">${L.map((l, i) => `<div class="lbcard"><img src="${esc(asset(l.image_url))}" alt=""><div class="b"><input type="text" data-c="${esc(l.id)}" value="${esc(l.caption || '')}" placeholder="Caption" aria-label="Caption"><select data-br="${esc(l.id)}" aria-label="Brand">${brandOptions(l.brand_id, 'No brand')}</select>
      <label class="chk" style="margin:0"><input type="checkbox" data-v="${esc(l.id)}" ${l.visible ? 'checked' : ''}> Shown on the website</label><div class="row"><button class="btn s" data-mv="up" data-id="${esc(l.id)}" ${i === 0 ? 'disabled' : ''}>\u2191</button><button class="btn s" data-mv="dn" data-id="${esc(l.id)}" ${i === L.length - 1 ? 'disabled' : ''}>\u2193</button><button class="btn s d" data-d="${esc(l.id)}">Delete</button></div></div></div>`).join('')}</div>` : '<div class="card"><p class="empty">The lookbook is empty. Add images to show them on the website.</p></div>'}`;
  const patch = async (id, p) => { try { await Store.patchRow('lookbook_images', id, p); toast('Saved'); await reload(); } catch (e) { toast(e.message, true); } };
  $$('[data-c]', el).forEach(i => i.onchange = () => patch(i.dataset.c, { caption: i.value.trim() })); $$('[data-br]', el).forEach(i => i.onchange = () => patch(i.dataset.br, { brand_id: i.value || null })); $$('[data-v]', el).forEach(i => i.onchange = () => patch(i.dataset.v, { visible: i.checked }));
  $$('[data-d]', el).forEach(b => b.onclick = async () => { if (!confirm('Remove this image from the lookbook?')) return; try { await Store.removeRow('lookbook_images', b.dataset.d); toast('Removed'); await refresh(); } catch (e) { toast(e.message, true); } });
  $$('[data-mv]', el).forEach(b => b.onclick = async () => { const i = L.findIndex(s => s.id === b.dataset.id), j = b.dataset.mv === 'up' ? i - 1 : i + 1, a = L[i], c = L[j]; try { await Promise.all([Store.patchRow('lookbook_images', a.id, { position: c.position }), Store.patchRow('lookbook_images', c.id, { position: a.position })]); await refresh(); } catch (e) { toast(e.message, true); } });
  $('#la').onclick = async () => { const files = await pickImages(true); if (!files.length) return; const b = $('#la'); b.disabled = true; b.textContent = 'Uploading\u2026'; const urls = await uploadFiles(files, 'lookbook'); let pos = Math.max(0, ...L.map(x => x.position || 0)); const brand = $('#lb').value || null;
    try { for (const u of urls) await Store.saveRow('lookbook_images', { id: uuid(), image_url: u, brand_id: brand, caption: '', position: ++pos, visible: true }); if (urls.length) toast(urls.length + ' image(s) added'); } catch (e) { toast(e.message, true); } await refresh(); };
}

/* ───────── customers (built from order details) ───────── */
function pCust(el) {
  const m = {}; S.orders.filter(o => o.status !== 'cancelled').forEach(o => { const k = (o.phone || '').replace(/\D/g, '') || o.email || o.customer_name; const c = m[k] ||= { name: o.customer_name, phone: o.phone, email: o.email, orders: 0, spent: 0, last: o.created_at }; c.orders++; if (REV.includes(o.status)) c.spent += Number(o.total); if (o.created_at > c.last) c.last = o.created_at; });
  const list = Object.values(m).sort((a, b) => b.last.localeCompare(a.last));
  el.innerHTML = `<div class="top"><h1>Customers</h1></div><div class="card">${list.length ? `<div class="scroll"><table class="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Email</th><th class="num">Orders</th><th class="num">Confirmed spend</th><th>Last order</th></tr></thead><tbody>${list.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.phone)}</td><td>${esc(c.email || '\u2014')}</td><td class="num">${c.orders}</td><td class="num">${money(c.spent)}</td><td>${fdt(c.last)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No customers yet. They appear when orders are placed.</p>'}</div><p class="hint" style="margin-top:12px">Customer details are only visible to signed-in administrators.</p>`;
}
const PAGES = { overview: pOverview, orders: pOrders, products: pProducts, brands: pBrands, homepage: pHome, lookbook: pLook, customers: pCust };
