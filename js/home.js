import { renderChrome, esc, asset, $, $$, imgTag, revealOnScroll, showError } from './site.js';
const app = $('#app');
(async () => {
  let v; try { v = await renderChrome('home', { transparentTop: true }); } catch (e) { return showError(app, 'We could not load the site right now. Please refresh in a moment.'); }
  const s = v.settings, slides = v.slides;
  const slideHTML = (sl, i) => {
    const b = sl.brand_id && v.brandById[sl.brand_id], img = asset(sl.image_url), layered = sl.layout === 'layered';
    return `<article class="slide${i === 0 ? ' on' : ''}" data-brand="${esc(sl.brand_id || '')}" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}">
      <div class="s-back" style="background-image:url('${esc(img)}')"></div>
      ${layered && b && b.logo_url ? `<img class="s-logo" src="${esc(asset(b.logo_url))}" alt="" aria-hidden="true">` : ''}
      <div class="s-shade"></div>
      <img class="s-photo${layered ? '' : ' contain'}" src="${esc(img)}" alt="${esc(sl.headline || '')}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
      <div class="s-copy">${b ? `<span class="eyebrow">${esc(b.name)}</span>` : '<span class="eyebrow">Two brands \u00b7 One district</span>'}
        <h2>${esc(sl.headline)}</h2>${sl.subtext ? `<p>${esc(sl.subtext)}</p>` : '<p></p>'}
        ${sl.cta_label ? `<a class="btn solid" href="${esc(sl.cta_url || '#')}">${esc(sl.cta_label)}</a>` : ''}</div></article>`;
  };
  const brandCard = (b) => {
    const prods = v.products.filter(p => p.brand_id === b.id); let imgs, cls = '';
    if (b.coming_soon) { imgs = (b.preview_images.length ? b.preview_images : [b.banner_url]).slice(0, 2); cls = 'soon'; }
    else if (prods.length) { imgs = prods.slice(0, 2).map(p => p.images[0] && p.images[0].url).filter(Boolean); cls = 'products'; }
    else imgs = [b.banner_url];
    return `<a class="bcard rv" href="${esc(b.slug)}.html" data-brand="${esc(b.id)}" aria-label="${esc(b.name)}${b.coming_soon ? ' \u2014 dropping soon' : ''}">
      <div class="bcard-imgs ${imgs.length < 2 ? 'one' : ''} ${cls}">${imgs.map(u => imgTag(u, b.name)).join('')}${b.coming_soon ? '<div class="soon-tag"><span><small>' + esc(b.name) + '</small>Dropping soon</span></div>' : ''}</div>
      <div class="bcard-foot"><img class="logo" src="${esc(asset(b.logo_url))}" alt="" width="46" height="46"><div style="flex:1"><h3>${esc(b.name)}</h3><p>${b.coming_soon ? 'Collection preview' : esc(prods.length + (prods.length === 1 ? ' piece' : ' pieces') + ' available')}</p></div><span class="go">${b.coming_soon ? 'Explore Collection' : 'Shop ' + esc(b.name)}</span></div></a>`;
  };
  const look = v.lookbook.slice(0, 4);
  app.innerHTML = `<section class="hero" aria-roledescription="carousel" aria-label="Featured">${slides.map(slideHTML).join('')}
      <div class="h-ctl"><div class="dots" role="tablist">${slides.map((_, i) => `<button role="tab" aria-label="Slide ${i + 1}"${i === 0 ? ' class="on"' : ''}><i></i></button>`).join('')}</div>
      <div class="arrows"><button id="hp" aria-label="Previous slide">\u2190</button><button id="hn" aria-label="Next slide">\u2192</button></div></div></section>
    <section class="sec" id="collections"><div class="wrap"><div class="sec-head rv"><span class="eyebrow">${esc(s.collections_eyebrow || 'Collections')}</span><h2 class="h-lg">${esc(s.collections_title || 'Choose a brand')}</h2>${s.collections_intro ? `<p>${esc(s.collections_intro)}</p>` : ''}</div>
      <div class="brands">${v.brands.map(brandCard).join('')}</div>${s.promo_label ? `<p class="eyebrow rv" style="margin-top:26px">${esc(s.promo_label)}</p>` : ''}</div></section>
    ${look.length ? `<section class="sec" style="padding-top:0"><div class="wrap"><div class="sec-head rv"><span class="eyebrow">Lookbook</span><h2 class="h-lg">${esc(s.lookbook_title || 'Lookbook')}</h2></div>
      <div class="strip">${look.map(l => `<a class="rv" href="lookbook.html">${imgTag(l.image_url, l.caption)}</a>`).join('')}</div>
      <p style="margin-top:30px"><a class="btn" href="lookbook.html">View the lookbook</a></p></div></section>` : ''}`;
  const els = $$('.slide'), dots = $$('.dots button'); let i = 0, timer = null; const DUR = 6500;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (n) => { i = (n + els.length) % els.length; els.forEach((e, k) => e.classList.toggle('on', k === i)); dots.forEach((d, k) => { d.classList.remove('on'); d.style.setProperty('--dur', DUR + 'ms'); if (k === i) { void d.offsetWidth; d.classList.add('on'); } }); restart(); };
  const restart = () => { clearTimeout(timer); if (els.length > 1 && !reduce) timer = setTimeout(() => go(i + 1), DUR); };
  if (els.length > 1) {
    $('#hp').onclick = () => go(i - 1); $('#hn').onclick = () => go(i + 1); dots.forEach((d, k) => d.onclick = () => go(k));
    const hero = $('.hero'); hero.addEventListener('mouseenter', () => clearTimeout(timer)); hero.addEventListener('mouseleave', restart);
    document.addEventListener('visibilitychange', () => document.hidden ? clearTimeout(timer) : restart());
    let x0 = null; hero.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    hero.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 45) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
    addEventListener('keydown', e => { if (e.key === 'ArrowLeft') go(i - 1); if (e.key === 'ArrowRight') go(i + 1); });
    go(0);
  } else { const c = $('.h-ctl'); if (c) c.style.display = 'none'; }
  revealOnScroll();
})();
