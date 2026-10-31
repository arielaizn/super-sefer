// מציג PDF בפריסת כפולות (ימין לשמאל: עמוד אי־זוגי בשמאל) באמצעות pdf.js
import * as pdfjs from '../node_modules/pdfjs-dist/build/pdf.mjs';
import { h, call } from './lib.js';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

export async function pdfViewer(root, file, { rtl = true, spread = true, startPage = 1, onPage, marks = {} } = {}) {
  root.innerHTML = '';
  const b64 = await call('pdf:read', file);
  const bin = atob(b64); const data = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const doc = await pdfjs.getDocument({ data }).promise;
  const N = doc.numPages;
  let mode = spread ? 'spread' : 'single';
  let zoom = 1;
  let cur = startPage;
  const area = h('div', { class: 'canvasarea' });
  const label = h('span', { class: 'small muted' });
  const nav = (d) => go(cur + d * (mode === 'spread' ? 2 : 1));
  const bar = h('div', { class: 'bar' },
    h('button', { class: 'btn sm', onclick: () => nav(1) }, '‹ הבא'), h('button', { class: 'btn sm', onclick: () => nav(-1) }, 'הקודם ›'), label,
    h('span', { style: 'flex:1' }),
    h('button', { class: 'btn sm', onclick: () => { zoom = Math.max(.4, zoom - .15); go(cur); } }, '−'), h('button', { class: 'btn sm', onclick: () => { zoom = Math.min(2.4, zoom + .15); go(cur); } }, '+'),
    h('button', { class: 'btn sm', onclick: () => { mode = mode === 'spread' ? 'single' : 'spread'; go(cur); } }, 'כפולה / עמוד'),
    h('input', { type: 'number', min: 1, max: N, value: 1, style: 'width:70px', onchange: (e) => go(Number(e.target.value)) }));
  root.append(h('div', { class: 'pv' }, bar, area));
  const input = bar.querySelector('input');

  async function renderPage(n) {
    const wrap = h('div', { class: 'pg' });
    if (n < 1 || n > N) { wrap.classList.add('blankpg'); const r = await doc.getPage(1); const vp = r.getViewport({ scale: 1 }); const k = scaleFor(vp); wrap.style.width = vp.width * k + 'px'; wrap.style.height = vp.height * k + 'px'; return wrap; }
    const pg = await doc.getPage(n);
    const vp0 = pg.getViewport({ scale: 1 });
    const k = scaleFor(vp0);
    const dpr = window.devicePixelRatio || 1;
    const vp = pg.getViewport({ scale: k * dpr });
    const c = h('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = vp.width / dpr + 'px'; c.style.height = vp.height / dpr + 'px';
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    wrap.append(c);
    if (marks[n]) wrap.append(h('div', { style: 'position:absolute;inset:0;border:3px solid #c33;pointer-events:none' }));
    return wrap;
  }
  function scaleFor(vp) {
    const availH = Math.max(300, area.clientHeight - 44);
    const availW = Math.max(300, area.clientWidth - 44);
    const kH = availH / vp.height;
    const kW = (mode === 'spread' ? availW / 2 : availW) / vp.width;
    return Math.min(kH, kW) * zoom;
  }
  async function go(n) {
    n = Math.max(1, Math.min(N, Math.round(n)));
    if (mode === 'spread') { n = n % 2 === 0 ? n : n; } // spread: even on right, odd on left
    cur = n; input.value = n; area.innerHTML = '';
    const sp = h('div', { class: 'spread' });
    if (mode === 'spread') {
      const even = n % 2 === 0 ? n : n - 1; const odd = even + 1;
      // dir=rtl: הילד הראשון מופיע בימין → עמוד זוגי בימין, אי־זוגי בשמאל
      sp.append(await renderPage(even), await renderPage(odd));
      label.textContent = `עמודים ${even || '—'}–${odd <= N ? odd : '—'} מתוך ${N}`;
    } else { sp.append(await renderPage(n)); label.textContent = `עמוד ${n} מתוך ${N}`; }
    area.append(sp);
    onPage && onPage(n);
  }
  await new Promise((r) => requestAnimationFrame(r));
  await go(startPage);
  return { go, pages: N, destroy: () => doc.destroy() };
}
