import { Store, asset, MODE } from './store.js';
export { Store, asset, MODE };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = (n) => 'GH\u20b5' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const HD_INSTAGRAM = 'https://www.instagram.com/her.dst/?__pwa=1#';

/* ───────── public data view ───────── */
let _view;
export async function getView() {
  if (_view) return _view;
  const d = await Store.loadAll();
  const brands = d.brands.filter(b => b.visible);
  const brandById = Object.fromEntries(d.brands.map(b => [b.id, b]));
  const products = d.products.filter(p => p.published && brandById[p.brand_id] && brandById[p.brand_id].visible);
  _view = { brands, brandById, products, slides: d.slides.filter(s => s.visible), lookbook: d.lookbook.filter(l => l.visible), settings: d.settings, all: d };
  return _view;
}
export const isBuyable = (p, v) => !!p && p.availability === 'available' && !(v.brandById[p.brand_id] || {}).coming_soon;

/* ───────── cart (stores ids + quantity only; prices always come from product data) ───────── */
const CK = 'hd_cart_v1';
const read = () => { try { const c = JSON.parse(localStorage.getItem(CK)); return Array.isArray(c) ? c : []; } catch { return []; } };
const write = (c) => { localStorage.setItem(CK, JSON.stringify(c)); window.dispatchEvent(new Event('cart:change')); };
export const Cart = {
  items: read,
  count: () => read().reduce((n, i) => n + i.qty, 0),
  add(product_id, qty = 1, size = '') { const c = read(); const i = c.find(x => x.product_id === product_id && (x.size || '') === (size || '')); if (i) i.qty = Math.min(50, i.qty + qty); else c.push({ product_id, size: size || '', qty: Math.min(50, qty) }); write(c); },
  setQty(idx, qty) { const c = read(); if (!c[idx]) return; if (qty < 1) c.splice(idx, 1); else c[idx].qty = Math.min(50, qty); write(c); },
  remove(idx) { const c = read(); c.splice(idx, 1); write(c); },
  clear() { write([]); },
  lines(v) { return read().map((i, idx) => { const p = v.products.find(x => x.id === i.product_id); return p ? { idx, p, qty: i.qty, size: i.size, ok: isBuyable(p, v), total: p.price * i.qty } : null; }).filter(Boolean); },
};

export function toast(msg, kind = '') {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.className = 'toast show ' + kind; t.textContent = msg; clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ───────── newsletter (the original site's EmailJS integration, preserved) ───────── */
export async function subscribe(email) {
  if (!window.emailjs) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js'; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
  window.emailjs.init('hbrFQ7DoQDBt9-R_T'); await window.emailjs.send('service_cg4k57m', 'template_79e1pw9', { email });
}

/* ───────── header / footer ───────── */
const igIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>';
const bagIcon = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3L5 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

export async function renderChrome(active, { transparentTop = false } = {}) {
  const v = await getView().catch(() => null);
  const s = (v && v.settings) || {};
  const lfg = v && v.brandById['lfg'], hd = v && v.brandById['her-district'];
  const nav = [['home', 'Home', 'index.html'], ['lfg', 'Lads From Ghana', 'lads-from-ghana.html'], ['hd', 'Her District', 'her-district.html'], ['look', 'Lookbook', 'lookbook.html'], ['coll', 'Collections', 'index.html#collections']];
  const ann = s.announcement_visible === 'true' && s.announcement_text ? `<div class="announce">${esc(s.announcement_text)}</div>` : '';
  const hdr = document.createElement('div');
  hdr.innerHTML = `${ann}<header class="hdr${transparentTop ? ' over-hero' : ''}" id="hdr"><div class="hdr-in">
    <a class="marks" href="index.html" aria-label="Lads From Ghana × Her District — home"><img src="${asset('assets/img/lfg-logo.jpg')}" alt="" width="38" height="38"><img src="${asset('assets/img/her-district-logo.jpg')}" alt="" width="38" height="38"></a>
    <nav class="nav" aria-label="Main">${nav.map(([k, l, h]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
    <div class="hdr-right"><a class="icon-btn" href="cart.html" aria-label="Open bag"><span class="bag">${bagIcon}</span><span class="count" id="cartCount">0</span></a>
    <button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><i></i><i></i></button></div></div>
    <div class="mnav" id="mnav">${nav.map(([k, l, h]) => `<a href="${h}">${l}</a>`).join('')}<a href="cart.html">Bag</a><a class="ig" href="${HD_INSTAGRAM}" target="_blank" rel="noopener">${igIcon} @her.dst</a></div></header>`;
  document.body.prepend(hdr);
  const h = $('#hdr'); const onScroll = () => h.classList.toggle('solid', !transparentTop || scrollY > 40); onScroll(); addEventListener('scroll', onScroll, { passive: true });
  $('#burger').addEventListener('click', () => { const o = h.classList.toggle('open'); $('#burger').setAttribute('aria-expanded', o); });
  $$('#mnav a').forEach(a => a.addEventListener('click', () => h.classList.remove('open')));
  const upd = () => { const n = Cart.count(); const c = $('#cartCount'); c.textContent = n; c.classList.toggle('on', n > 0); };
  upd(); addEventListener('cart:change', upd); addEventListener('storage', upd);

  const f = document.createElement('footer'); f.className = 'ftr';
  f.innerHTML = `<div class="ftr-in"><div class="ftr-brands">
      <div><p class="eyebrow">Lads From Ghana</p><p class="ftr-copy">${esc((lfg && lfg.description) || '')}</p>${lfg && lfg.instagram_url ? `<a class="soc" href="${esc(lfg.instagram_url)}" target="_blank" rel="noopener">${igIcon} Instagram</a>` : ''}</div>
      <div><p class="eyebrow">Her District</p><p class="ftr-copy">${esc((hd && hd.description) || '')}</p><a class="soc" href="${HD_INSTAGRAM}" target="_blank" rel="noopener" aria-label="Her District on Instagram">${igIcon} @her.dst</a></div></div>
    <form class="news" id="newsForm"><p class="eyebrow">Stay in the loop</p><div class="news-row"><input type="email" id="newsEmail" placeholder="Your email" required aria-label="Email address"><button class="btn small" type="submit" id="newsBtn">Join</button></div></form>
    <div class="ftr-bot"><span>\u00a9 ${new Date().getFullYear()} Lads From Ghana \u00d7 Her District</span><span class="ftr-links"><a href="index.html">Home</a><a href="lookbook.html">Lookbook</a><a href="cart.html">Bag</a><a href="mailto:lfgclothing25@gmail.com">lfgclothing25@gmail.com</a></span></div></div>`;
  document.body.appendChild(f);
  $('#newsForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const b = $('#newsBtn'), em = $('#newsEmail'); b.disabled = true; b.textContent = '\u2026';
    try { await subscribe(em.value); b.textContent = 'Done'; em.value = ''; toast('Thanks \u2014 you\u2019re on the list.'); } catch { toast('Something went wrong. Please try again.', 'err'); b.textContent = 'Join'; }
    setTimeout(() => { b.disabled = false; b.textContent = 'Join'; }, 2200);
  });
  if (MODE === 'local') { const b = document.createElement('div'); b.className = 'devbar'; b.textContent = 'LOCAL PREVIEW \u2014 data lives in this browser only'; document.body.appendChild(b); }
  return v;
}

export function imgTag(url, alt = '', cls = '', extra = '') { return `<img class="${cls}" src="${esc(asset(url))}" alt="${esc(alt)}" loading="lazy" decoding="async" ${extra}>`; }
export function showError(el, msg) { el.innerHTML = `<div class="state"><p>${esc(msg)}</p></div>`; }
export function revealOnScroll() { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 }); $$('.rv').forEach(el => io.observe(el)); }
