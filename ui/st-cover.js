import { h, call, toast, fail, busy, fmt, field, select, check, debounce, fileUrl } from './lib.js';

export default async function render(root, ctx) {
  const { S, refresh, render: rr } = ctx;
  root.classList.add('flush');
  const info = S.info; const d = S.proj.data;
  const pagesDefault = (d.stages.layout && d.stages.layout.pages) || 200;
  let design = d.cover.design ? JSON.parse(JSON.stringify(d.cover.design)) : null;
  if (!design) {
    const r0 = await call('cover:html', { design: {}, pages: pagesDefault });
    design = r0.design;
  }
  design.palette = design.palette || {}; design.fonts = design.fonts || {};
  let mode = d.cover.pagesMode || 'spread', guides = true, pages = pagesDefault;
  const prev = h('iframe', { style: 'width:900px;height:600px;position:absolute;top:0;left:0' });
  const info1 = h('div', { class: 'row wrap', style: 'padding:9px 14px;background:var(--panel);border-bottom:1px solid var(--line)' });
  const frame = h('div', { style: 'position:relative;flex:none;box-shadow:0 10px 40px #0005' }, prev);
  const holder = h('div', { class: 'cvprev' }, frame);
  const stage = h('div', { class: 'stage' }, info1, holder);
  const ctl = h('div', { class: 'ctl' });
  root.append(h('div', { class: 'split', style: 'grid-template-columns:430px 1fr' }, ctl, stage));

  const persist = debounce(async () => { S.proj = await call('cover:save', { design }); }, 500);
  let first = true;
  const refreshPreview = debounce(async () => {
    try {
      const r = await call('cover:html', { design, pages, mode, guides });
      const g = r.geometry; const W = mode === 'spread' ? g.totalW : g.trimW + g.bleed * 2, H = mode === 'spread' ? g.totalH : g.trimH + g.bleed * 2;
      const pxW = W * 3.7795, pxH = H * 3.7795;
      prev.style.width = pxW + 'px'; prev.style.height = (mode === 'spread' ? pxH : pxH * 2 + 10) + 'px';
      prev.src = 'file://' + encodeURI(r.file) + '?t=' + Date.now();
      const sc = Math.min((holder.clientWidth - 40) / pxW, (holder.clientHeight - 40) / (mode === 'spread' ? pxH : pxH * 2));
      const hh = mode === 'spread' ? pxH : pxH * 2 + 10;
      const k = Math.min(1.3, (holder.clientWidth - 40) / pxW, (holder.clientHeight - 40) / hh);
      prev.style.transformOrigin = 'top left'; prev.style.transform = `scale(${k})`; prev.style.margin = '0';
      frame.style.width = pxW * k + 'px'; frame.style.height = hh * k + 'px';
      info1.innerHTML = '';
      info1.append(h('span', { class: 'pill teal' }, `${g.totalW}×${g.totalH} מ״מ`), h('span', { class: 'pill' }, `שדרה ${g.spine} מ״מ`), h('span', { class: 'pill' }, `בליד ${g.bleed} מ״מ`), h('span', { class: 'pill' }, `${r.pages} עמודים`),
        ...(r.dpi ? [h('span', { class: 'pill ' + (r.dpi.dpi >= 200 ? 'ok' : 'warn'), title: r.dpi.level }, `תמונה: ${r.dpi.dpi} DPI`)] : []), h('span', { class: 'grow' }),
        h('div', { class: 'row' }, check('קווי חיתוך', guides, (v) => { guides = v; refreshPreview(); }), select([['spread', 'פריסה אחת'], ['pages', 'שני עמודים']], mode, (v) => { mode = v; refreshPreview(); }, { style: 'width:130px' })));
    } catch (e) { fail(e); }
  }, 150);

  const set = (obj, k, v) => { obj[k] = v; persist(); refreshPreview(); };
  const T = (k, label, rows) => field(label, rows ? h('textarea', { rows, onchange: (e) => set(design, k, e.target.value) }, design[k] || '') : h('input', { type: 'text', value: design[k] || '', onchange: (e) => set(design, k, e.target.value) }));
  const color = (k) => h('input', { type: 'color', value: design.palette[k] || '#000000', style: 'padding:0;height:34px', oninput: (e) => { design.palette[k] = e.target.value; persist(); refreshPreview(); } });
  const fontsList = info.fonts.map((f) => [f.name, f.label + ' — ' + f.name]);
  const conceptBox = h('div');

  function drawConcepts() {
    conceptBox.innerHTML = '';
    (d.cover.concepts || []).forEach((c, i) => conceptBox.append(h('div', { class: 'concept', onclick: async () => { design = { ...design, ...c, palette: { ...design.palette, ...c.palette }, fonts: { ...design.fonts, ...c.fonts } }; if (c.imageMode === 'full') design.layout = 'fullbleed'; persist(); toast('קונספט נבחר: ' + c.name, 'ok'); rr(); } },
      h('div', { class: 'row' }, h('b', {}, c.name), h('span', { class: 'pill' }, c.layout), h('span', { class: 'palrow' }, ['bg', 'fg', 'accent'].map((k) => h('span', { class: 'sw', style: 'background:' + (c.palette && c.palette[k]) })))), h('div', { class: 'small muted', style: 'margin-top:4px;line-height:1.5' }, c.rationale))));
    if (!(d.cover.concepts || []).length) conceptBox.append(h('div', { class: 'hint' }, 'אין קונספטים עדיין. לחצו “הצע קונספטים” והמעצב/ת יציעו שלושה כיוונים שונים באמת.'));
  }
  drawConcepts();

  const imgPrompt = h('textarea', { rows: 3, placeholder: 'Describe the cover art in English — no text in the image, leave calm space for the title', onchange: (e) => { design.imagePrompt = e.target.value; persist(); } }, design.imagePrompt || ((d.cover.concepts || [])[0] || {}).imagePrompt || '');
  const imgBox = h('div');
  const showImg = () => { imgBox.innerHTML = ''; if (design.image) imgBox.append(h('div', { class: 'row', style: 'margin:6px 0' }, h('img', { src: fileUrl(S.proj.dir + '/' + design.image), style: 'width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid var(--line)' }), h('div', { class: 'small muted grow' }, design.image), h('button', { class: 'btn sm', onclick: () => { design.image = null; persist(); refreshPreview(); showImg(); } }, 'הסר'))); };
  showImg();

  ctl.append(
    h('div', { class: 'sect' }, h('h3', {}, 'קונספטים'), h('div', { class: 'row', style: 'margin-bottom:8px' }, h('button', { class: 'btn primary', onclick: async (e) => busy(e.currentTarget, async () => { const c = await call('ai:cover'); S.proj.data.cover.concepts = c; d.cover.concepts = c; drawConcepts(); toast(`${c.length} קונספטים`, 'ok'); }, 'מעצב…') }, '✦ הצע קונספטים'), h('span', { class: 'small muted' }, 'לפי הז׳אנר, הקהל והשפה הגרפית')), conceptBox),
    h('div', { class: 'sect' }, h('h3', {}, 'פריסה'), h('div', { class: 'layouts' }, info.layouts.map((l) => h('div', { class: 'lay ' + (design.layout === l.id ? 'on' : ''), onclick: () => { design.layout = l.id; persist(); rr(); } }, l.label)))),
    h('div', { class: 'sect' }, h('h3', {}, 'צבע'), h('div', { class: 'palrow', style: 'margin-bottom:8px' }, info.palettes.map((p) => h('div', { class: 'pal', title: p.label, onclick: () => { design.palette = { bg: p.bg, fg: p.fg, accent: p.accent, muted: p.muted }; persist(); rr(); } }, [p.bg, p.fg, p.accent].map((c) => h('i', { style: 'background:' + c }))))),
      h('div', { class: 'grid4' }, field('רקע', color('bg')), field('טקסט', color('fg')), field('הדגשה', color('accent')), field('משני', color('muted')))),
    h('div', { class: 'sect' }, h('h3', {}, 'גופנים'), h('div', { class: 'grid2' }, field('כותרת', select(fontsList, design.fonts.title, (v) => set(design.fonts, 'title', v))), field('טקסט', select(fontsList, design.fonts.body, (v) => set(design.fonts, 'body', v)))),
      field('גודל כותרת', h('input', { type: 'range', min: 0.6, max: 1.5, step: 0.05, value: design.titleSize || 1, oninput: (e) => { design.titleSize = Number(e.target.value); persist(); refreshPreview(); } }))),
    h('div', { class: 'sect' }, h('h3', {}, 'טקסטים'), T('title', 'שם הספר'), T('subtitle', 'כותרת משנה'), T('author', 'מחבר/ת'), T('tagline', 'משפט לכידה (גב + חזית)'), T('blurb', 'תקציר לכריכה אחורית', 6), T('bio', 'על המחבר/ת (קצר)', 3), h('div', { class: 'grid2' }, T('publisher', 'הוצאה'), T('price', 'מחיר')), T('isbn', 'ISBN-13 (לברקוד)'),
      h('div', { class: 'grid2' }, check('ברקוד', design.barcode !== false, (v) => set(design, 'barcode', v)), check('טקסט בשדרה', design.spine !== false, (v) => set(design, 'spine', v))), field('כיוון טקסט בשדרה', select([['ttb', 'מלמעלה למטה'], ['btt', 'מלמטה למעלה']], design.spineDir || 'ttb', (v) => set(design, 'spineDir', v)))),
    h('div', { class: 'sect' }, h('h3', {}, 'תמונת כריכה'), imgBox, field('תיאור לאיור (Codex · gpt-image)', imgPrompt, 'נוצר במסגרת המנוי שלכם, עם השפה הגרפית של הספר כקידומת'),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn accent', onclick: async (e) => { if (!imgPrompt.value.trim()) return toast('כתבו תיאור', 'err'); await busy(e.currentTarget, async () => { const r = await call('image:generate', { prompt: imgPrompt.value, kind: 'cover', aspect: 'cover', useRef: true }); design.image = r.rel; design.imagePrompt = imgPrompt.value; await call('cover:save', { design }); S.proj = await call('project:view'); showImg(); refreshPreview(); toast('התמונה מוכנה', 'ok'); }, 'מצייר…'); } }, '✦ צור תמונה'),
        h('button', { class: 'btn', onclick: async () => { const f = await call('dialog:pickFile', [{ name: 'תמונות', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]); if (f) { const fs = f; design.image = fs; persist(); showImg(); refreshPreview(); } } }, 'בחירת קובץ…')),
      d.visual.images.filter((i) => i.kind === 'cover').length ? h('div', { class: 'row wrap', style: 'margin-top:8px' }, d.visual.images.filter((i) => i.kind === 'cover').slice(-6).map((i) => h('img', { src: fileUrl(S.proj.dir + '/' + i.file), style: 'width:54px;height:54px;object-fit:cover;border-radius:7px;cursor:pointer;border:1px solid var(--line)', onclick: () => { design.image = i.file; persist(); showImg(); refreshPreview(); } }))) : null,
      design.layout === 'fullbleed' ? field('עוצמת הכהיית ראש/תחתית', h('input', { type: 'range', min: 0, max: 0.9, step: 0.05, value: design.scrim ?? 0.6, oninput: (e) => { design.scrim = Number(e.target.value); persist(); refreshPreview(); } })) : null),
    h('div', { class: 'sect' }, h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async (e) => busy(e.currentTarget, async () => { await call('cover:save', { design }); const r = await call('cover:build', { design, mode }); toast('נשמר: ' + r.file.split('/').pop(), 'ok'); call('shell:reveal', r.file); }, 'מפיק…') }, '⇩ הפק PDF כריכה'), h('span', { class: 'small muted' }, 'עובי השדרה מחושב ממספר העמודים האחרון.'))));
  await new Promise((r) => setTimeout(r, 60));
  refreshPreview();
}
