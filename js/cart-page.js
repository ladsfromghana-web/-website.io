import { renderChrome, esc, asset, money, $, Cart, Store, MODE, showError } from './site.js';
const app = $('#app'); let v;
const waLink = (num, lines, total, orderNo, c) => {
  const t = [orderNo ? `Hi! I just placed order ${orderNo} on the website:` : 'Hi! I\u2019d like to place an order:', ''];
  lines.forEach(l => t.push(`- ${l.p.name}${l.size ? ' (' + l.size + ')' : ''}  x${l.qty}  -  ${money(l.total)}`));
  t.push('', `TOTAL: ${money(total)}`, '', `Name: ${c.name}`, `Phone: ${c.phone}`, `Delivery address: ${c.address}`); if (c.notes) t.push(`Notes: ${c.notes}`);
  return `https://wa.me/${num}?text=${encodeURIComponent(t.join('\n'))}`;
};
function draw() {
  const lines = Cart.lines(v), bad = lines.some(l => !l.ok), good = lines.filter(l => l.ok), sub = good.reduce((n, l) => n + l.total, 0);
  if (!lines.length) { app.innerHTML = `<div class="wrap"><div class="phead"><h1 class="h-xl">Your bag</h1></div><div class="state"><h2 class="h-lg">Your bag is empty.</h2><p style="margin-bottom:26px">Find something you love.</p><a class="btn solid" href="her-district.html">Shop Her District</a></div></div>`; return; }
  const online = MODE !== 'static';
  app.innerHTML = `<div class="wrap"><div class="phead"><p class="crumbs"><a href="index.html">Home</a> / Bag</p><h1 class="h-xl">Your bag</h1></div>
   <div class="cart"><div id="lines">${lines.map(l => `<div class="line"><a href="product.html?p=${encodeURIComponent(l.p.slug)}"><img src="${esc(asset(l.p.images[0] && l.p.images[0].url))}" alt="${esc(l.p.name)}"></a>
      <div><h3>${esc(l.p.name)}</h3><small>${l.size ? 'Size ' + esc(l.size) + ' \u00b7 ' : ''}${money(l.p.price)} each</small>${l.ok ? '' : '<p class="warn">No longer available \u2014 please remove it.</p>'}
        <div style="display:flex;align-items:center"><div class="qty" role="group" aria-label="Quantity for ${esc(l.p.name)}"><button data-a="m" data-i="${l.idx}" aria-label="Decrease quantity">\u2212</button><output>${l.qty}</output><button data-a="p" data-i="${l.idx}" aria-label="Increase quantity">+</button></div><button class="rm" data-a="r" data-i="${l.idx}">Remove</button></div></div>
      <div class="lt">${money(l.total)}</div></div>`).join('')}</div>
    <aside class="sum"><h2>Order summary</h2><div class="row"><span>Subtotal</span><span id="st">${money(sub)}</span></div><div class="row tot"><span>Total</span><span>${money(sub)}</span></div>
      <p class="note">${online ? 'No online payment is taken on the site yet. We confirm your order, payment and delivery with you on WhatsApp.' : 'Online order records are not switched on yet \u2014 your order is sent to us on WhatsApp.'} Prices are in Ghana cedis (GHS).</p>
      <form id="co" novalidate><label class="fld"><span>Full name</span><input name="name" autocomplete="name" required></label><label class="fld"><span>Phone number</span><input name="phone" type="tel" autocomplete="tel" placeholder="e.g. 024 123 4567" required></label>
        <label class="fld"><span>Email (optional)</span><input name="email" type="email" autocomplete="email"></label><label class="fld"><span>Delivery address</span><input name="address" autocomplete="street-address" placeholder="e.g. East Legon, Accra" required></label>
        <label class="fld"><span>Notes (optional)</span><textarea name="notes" rows="2"></textarea></label><p class="err" id="cerr" hidden></p>
        <button class="btn solid" style="width:100%" id="place" ${bad ? 'disabled' : ''}>${online ? 'Place order' : 'Order on WhatsApp'}</button></form></aside></div></div>`;
  $('#lines').onclick = (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; const i = +b.dataset.i, it = Cart.items()[i]; if (!it) return; if (b.dataset.a === 'r') Cart.remove(i); else Cart.setQty(i, it.qty + (b.dataset.a === 'p' ? 1 : -1)); draw(); };
  $('#co').onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target), c = Object.fromEntries(['name', 'phone', 'email', 'address', 'notes'].map(k => [k, String(f.get(k) || '').trim()]));
    const err = $('#cerr'), btn = $('#place'); err.hidden = true;
    const fail = (m) => { err.textContent = m; err.hidden = false; btn.disabled = false; };
    if (c.name.length < 2) return fail('Please enter your full name.'); if (!/^[0-9+() \-]{7,20}$/.test(c.phone)) return fail('Please enter a valid phone number.'); if (c.address.length < 4) return fail('Please enter your delivery address.');
    const num = (v.settings.whatsapp_number || '233244126931').replace(/\D/g, ''); btn.disabled = true;
    try {
      if (!online) { open(waLink(num, good, sub, null, c), '_blank', 'noopener'); btn.disabled = false; return; }
      const r = await Store.placeOrder(c, good.map(l => ({ product_id: l.p.id, quantity: l.qty, size: l.size || '' })));
      const link = waLink(num, good, r.total, r.order_number, c); Cart.clear();
      app.innerHTML = `<div class="wrap"><div class="done"><span class="eyebrow">Order received</span><h1 class="h-xl" style="margin:12px 0 18px">Thank you.</h1><p style="margin-bottom:8px">Your order number is <strong>${esc(r.order_number)}</strong> \u2014 total <strong>${money(r.total)}</strong>.</p><p style="opacity:.75;margin-bottom:28px">Payment has not been taken. Send us your order on WhatsApp so we can confirm payment and delivery with you.</p><p style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn solid" href="${esc(link)}" target="_blank" rel="noopener">Confirm on WhatsApp</a><a class="btn" href="her-district.html">Continue shopping</a></p></div></div>`; scrollTo(0, 0);
    } catch (ex) { fail(ex.message || 'We could not place your order. Please try again.'); }
  };
}
(async () => { try { v = await renderChrome('cart'); } catch { return showError(app, 'We could not load your bag right now. Please refresh in a moment.'); } draw(); addEventListener('storage', draw); })();
