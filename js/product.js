import { renderChrome, esc, asset, money, $, $$, Cart, toast, isBuyable, imgTag, showError } from './site.js';
const app = $('#app');
const arrow = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="${d === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function mountGallery(el, images, alt) {
  const n = images.length; let i = 0;
  el.innerHTML = `${n > 1 ? `<div class="gal-thumbs" role="tablist" aria-label="Product images">${images.map((im, k) => `<button role="tab" aria-label="Image ${k + 1} of ${n}" ${k === 0 ? 'aria-current="true"' : ''}><img src="${esc(asset(im.url))}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
    <div class="gal-main" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(alt)} images"><div class="gal-track">${images.map((im, k) => `<img src="${esc(asset(im.url))}" alt="${esc(alt)} \u2014 image ${k + 1}" ${k === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} draggable="false">`).join('')}</div>
    ${n > 1 ? `<button class="gal-arrow prev" aria-label="Previous image">${arrow('l')}</button><button class="gal-arrow next" aria-label="Next image">${arrow('r')}</button><span class="gal-count" aria-live="polite">1 / ${n}</span>` : ''}</div>`;
  if (n < 2) return;
  const track = $('.gal-track', el), main = $('.gal-main', el), thumbs = $$('.gal-thumbs button', el), count = $('.gal-count', el);
  const go = (k) => { i = (k + n) % n; track.style.transition = ''; track.style.transform = `translateX(${-i * 100}%)`; thumbs.forEach((t, j) => t.setAttribute('aria-current', j === i)); count.textContent = `${i + 1} / ${n}`; };
  $('.prev', el).onclick = () => go(i - 1); $('.next', el).onclick = () => go(i + 1); thumbs.forEach((t, k) => t.onclick = () => go(k));
  main.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
  let sx = null, sy = 0, dx = 0, lock = null;      // swipe / drag (touch and mouse): the track follows the finger, then snaps
  main.addEventListener('pointerdown', e => { if (e.target.closest('.gal-arrow')) return; sx = e.clientX; sy = e.clientY; dx = 0; lock = null; });
  main.addEventListener('pointermove', e => { if (sx == null) return; dx = e.clientX - sx; if (lock == null && Math.abs(dx) > 6) lock = Math.abs(dx) > Math.abs(e.clientY - sy); if (lock) { try { main.setPointerCapture(e.pointerId); } catch { } track.style.transition = 'none'; track.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`; } });
  const end = () => { if (sx == null) return; const w = main.clientWidth; sx = null; if (lock && Math.abs(dx) > Math.min(60, w * 0.18)) go(i + (dx < 0 ? 1 : -1)); else go(i); };
  main.addEventListener('pointerup', end); main.addEventListener('pointercancel', end);
}
(async () => {
  const slug = new URLSearchParams(location.search).get('p');
  let v; try { v = await renderChrome('hd'); } catch { return showError(app, 'We could not load this product right now. Please refresh in a moment.'); }
  const p = v.products.find(x => x.slug === slug);
  if (!p) { app.innerHTML = '<div class="wrap"><div class="state" style="padding-top:200px"><h1 class="h-lg">We couldn\u2019t find that product.</h1><p><a class="btn" href="her-district.html">Back to the collection</a></p></div></div>'; return; }
  const b = v.brandById[p.brand_id]; document.title = `${p.name} \u2014 ${b.name}`;
  const buyable = isBuyable(p, v); let qty = 1;
  app.innerHTML = `<div class="wrap"><div class="pdp"><div class="gal" id="gal"></div>
    <div class="pinfo"><p class="crumbs"><a href="index.html">Home</a> / <a href="${esc(b.slug)}.html">${esc(b.name)}</a></p><h1>${esc(p.name)}</h1><p class="price">${money(p.price)}</p>
      <p class="avail${buyable ? '' : ' out'}">${buyable ? 'Available' : (b.coming_soon || p.availability === 'dropping_soon' ? 'Dropping soon' : 'Sold out')}</p>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      ${p.sizes.length ? `<fieldset style="border:0"><legend class="eyebrow" style="margin-bottom:10px">Size</legend><div class="sizes" id="sizes">${p.sizes.map(s => `<label><input type="radio" name="size" value="${esc(s)}"><span>${esc(s)}</span></label>`).join('')}</div></fieldset>` : ''}
      <div class="buy"><div class="qty" role="group" aria-label="Quantity"><button id="qm" aria-label="Decrease quantity">\u2212</button><output id="qv" aria-live="polite">1</output><button id="qp" aria-label="Increase quantity">+</button></div>
        <button class="btn solid" id="add" style="flex:1;min-width:200px" ${buyable ? '' : 'disabled'}>${buyable ? 'Add to bag' : (b.coming_soon || p.availability === 'dropping_soon' ? 'Dropping soon' : 'Sold out')}</button></div>
      <p class="err" id="perr" hidden></p>
      <div class="pmeta">${p.category ? `<span>Category \u00b7 ${esc(p.category)}</span>` : ''}<span>Brand \u00b7 ${esc(b.name)}</span></div></div></div><div id="more"></div></div>`;
  mountGallery($('#gal'), p.images.length ? p.images : [{ url: b.banner_url }], p.name);
  $('#qm').onclick = () => { qty = Math.max(1, qty - 1); $('#qv').textContent = qty; }; $('#qp').onclick = () => { qty = Math.min(20, qty + 1); $('#qv').textContent = qty; };
  $('#add').onclick = () => {
    let size = ''; if (p.sizes.length) { const c = $('input[name=size]:checked'); if (!c) { const e = $('#perr'); e.hidden = false; e.textContent = 'Please choose a size.'; return; } size = c.value; }
    $('#perr').hidden = true; Cart.add(p.id, qty, size); toast(`Added to bag \u2014 ${p.name}`); const a = $('#add'); a.textContent = 'Added \u2713'; setTimeout(() => a.textContent = 'Add to bag', 1600);
  };
  const others = v.products.filter(x => x.brand_id === p.brand_id && x.id !== p.id);
  if (others.length) $('#more').innerHTML = `<div class="sec-head" style="margin-top:20px"><span class="eyebrow">You may also like</span></div><div class="pgrid">${others.slice(0, 3).map(o => `<a class="pcard" href="product.html?p=${encodeURIComponent(o.slug)}"><div class="pcard-img">${o.images[0] ? imgTag(o.images[0].url, o.name) : ''}</div><div class="pcard-meta"><h3>${esc(o.name)}</h3><span class="price">${money(o.price)}</span></div></a>`).join('')}</div>`;
})();
