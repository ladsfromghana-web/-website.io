import { renderChrome, getView, esc, money, $, imgTag, revealOnScroll, showError, subscribe, toast, HD_INSTAGRAM } from './site.js';
const key = document.body.dataset.brand;            // 'lfg' | 'her-district'
const active = key === 'lfg' ? 'lfg' : 'hd';
const app = $('#app');
const igSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>';
(async () => {
  let v; try { v = await getView(); } catch { await renderChrome(active).catch(() => { }); return showError(app, 'We could not load this page right now. Please refresh in a moment.'); }
  const b = v.brandById[key];
  if (!b || !b.visible) { await renderChrome(active); app.innerHTML = '<div class="wrap"><div class="state" style="padding-top:200px"><h1 class="h-lg">This collection is not available.</h1><p><a class="btn" href="index.html">Back to home</a></p></div></div>'; return; }
  document.title = b.name + (b.coming_soon ? ' \u2014 Dropping soon' : ' \u2014 Shop');
  const ig = key === 'her-district' ? HD_INSTAGRAM : b.instagram_url;
  if (b.coming_soon) {
    document.body.classList.remove('light'); await renderChrome(active);
    const imgs = (b.preview_images.length ? b.preview_images : [b.banner_url]).slice(0, 2);
    app.innerHTML = `<section class="soon-hero"><div class="imgs">${imgs.map(u => imgTag(u, b.name)).join('')}</div><div class="shade"></div>
      <div class="soon-tag"><span><small>${esc(b.name)}</small>Dropping soon</span></div>
      <div class="wrap soon-body"><span class="eyebrow">${esc(b.name)}</span><h1 class="h-xl">Dropping <em>soon</em></h1>
        <p>${esc(b.coming_soon_message || 'The collection is dropping soon.')} ${esc(b.description)}</p>
        <form class="notify" id="nf"><input type="email" id="ne" placeholder="Your email \u2014 we\u2019ll let you know" required aria-label="Email address"><button class="btn solid" id="nb" type="submit">Notify me</button></form>
        ${ig ? `<a class="soc" href="${esc(ig)}" target="_blank" rel="noopener">${igSvg} Follow on Instagram</a>` : ''}</div></section>`;
    $('#nf').addEventListener('submit', async (e) => { e.preventDefault(); const btn = $('#nb'); btn.disabled = true; try { await subscribe($('#ne').value); toast('Thanks \u2014 we\u2019ll be in touch.'); $('#ne').value = ''; } catch { toast('Something went wrong. Please try again.', 'err'); } btn.disabled = false; });
    return;
  }
  document.body.classList.add('light'); await renderChrome(active);
  const prods = v.products.filter(p => p.brand_id === b.id);
  app.innerHTML = `<div class="wrap"><div class="phead"><p class="crumbs"><a href="index.html">Home</a> / ${esc(b.name)}</p><h1 class="h-xl">${esc(b.name)}</h1><p style="margin-top:16px;max-width:52ch;opacity:.75">${esc(b.description)}</p></div>
    ${prods.length ? `<div class="pgrid">${prods.map(p => { const im = p.images, soon = p.availability === 'dropping_soon', out = p.availability === 'sold_out'; return `<a class="pcard rv${soon ? ' is-soon' : ''}" href="product.html?p=${encodeURIComponent(p.slug)}"><div class="pcard-img">${soon ? '<span class="badge soon">Dropping soon</span>' : out ? '<span class="badge">Sold out</span>' : p.featured ? '<span class="badge">Featured</span>' : ''}${im[0] ? imgTag(im[0].url, p.name) : ''}${im[1] ? imgTag(im[1].url, '') : ''}${soon ? '<div class="soon-tag"><span><small>' + esc(b.name) + '</small>Dropping soon</span></div>' : ''}</div><div class="pcard-meta"><div><h3>${esc(p.name)}</h3>${p.category ? `<small>${esc(p.category)}</small>` : ''}</div><span class="price">${money(p.price)}</span></div></a>`; }).join('')}</div>` : `<div class="state"><h2 class="h-lg">New pieces are on the way.</h2><p>Check back soon.</p></div>`}
    <div class="cta-row"><div><span class="eyebrow">Follow ${esc(b.name)}</span><p style="margin-top:8px"><a class="soc big" href="${esc(ig || '#')}" target="_blank" rel="noopener" aria-label="${esc(b.name)} on Instagram">${igSvg} ${key === 'her-district' ? '@her.dst' : 'Instagram'}</a></p></div><a class="btn" href="cart.html">View bag</a></div></div><div style="height:90px"></div>`;
  revealOnScroll();
})();
