import { renderChrome, esc, asset, $, $$, showError } from './site.js';
const app = $('#app');
(async () => {
  let v; try { v = await renderChrome('look'); } catch { return showError(app, 'We could not load the lookbook right now. Please refresh in a moment.'); }
  const brands = v.brands.filter(b => v.lookbook.some(l => l.brand_id === b.id));
  let filter = 'all', cur = 0, list = [];
  const draw = () => {
    list = v.lookbook.filter(l => filter === 'all' || l.brand_id === filter);
    $('#grid').innerHTML = list.map((l, k) => { const b = v.brandById[l.brand_id]; return `<button class="mi" data-k="${k}" data-brand="${esc(l.brand_id || '')}" aria-label="Open image: ${esc(l.caption || (b && b.name) || 'Lookbook')}"><img src="${esc(asset(l.image_url))}" alt="${esc(l.caption || '')}" loading="lazy" decoding="async"><figcaption><span>${esc(l.caption || '')}</span>${b ? `<span class="tagb">${esc(b.name)}</span>` : ''}</figcaption></button>`; }).join('') || '<p class="state">No images yet.</p>';
  };
  app.innerHTML = `<div class="wrap"><div class="phead"><p class="crumbs"><a href="index.html">Home</a> / Lookbook</p><h1 class="h-xl">${esc(v.settings.lookbook_title || 'Lookbook')}</h1>${v.settings.lookbook_intro ? `<p style="margin-top:16px;max-width:56ch;opacity:.75">${esc(v.settings.lookbook_intro)}</p>` : ''}</div>
    ${brands.length > 1 ? `<div class="chips" role="group" aria-label="Filter by brand"><button class="chip" data-f="all" aria-pressed="true">All</button>${brands.map(b => `<button class="chip" data-f="${esc(b.id)}" aria-pressed="false">${esc(b.name)}</button>`).join('')}</div>` : ''}
    <div class="masonry" id="grid"></div></div><div style="height:90px"></div>
    <div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Image viewer"><button class="x" aria-label="Close">\u2715</button><button class="p" aria-label="Previous">\u2190</button><img alt=""><button class="n" aria-label="Next">\u2192</button><p class="cap"></p></div>`;
  draw();
  $$('.chip').forEach(c => c.onclick = () => { filter = c.dataset.f; $$('.chip').forEach(x => x.setAttribute('aria-pressed', x === c)); draw(); });
  const lb = $('#lb'), show = (k) => { cur = (k + list.length) % list.length; const l = list[cur]; $('img', lb).src = asset(l.image_url); $('img', lb).alt = l.caption || ''; $('.cap', lb).textContent = l.caption || ''; };
  $('#grid').addEventListener('click', e => { const m = e.target.closest('.mi'); if (!m) return; show(+m.dataset.k); lb.classList.add('on'); $('.x', lb).focus(); });
  const close = () => lb.classList.remove('on');
  $('.x', lb).onclick = close; $('.p', lb).onclick = () => show(cur - 1); $('.n', lb).onclick = () => show(cur + 1); lb.addEventListener('click', e => { if (e.target === lb) close(); });
  addEventListener('keydown', e => { if (!lb.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(cur - 1); if (e.key === 'ArrowRight') show(cur + 1); });
  let x0 = null; lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true }); lb.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); x0 = null; });
})();
