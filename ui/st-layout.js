import { h, call, toast, fail, busy, fmt, field, select, check, debounce } from './lib.js';
import { pdfViewer } from './pdfviewer.js';

export default async function render(root, ctx) {
  const { S, refresh, render: rr } = ctx;
  root.classList.add('flush');
  const d = S.proj.data; const L = d.layout; const info = S.info;
  const save = debounce(async (patch) => { S.proj = await call('project:update', patch); }, 300);
  const setL = (k, v) => { L[k] = v; save({ layout: { [k]: v } }); };
  const fonts = info.fonts;
  const fontOpts = (kinds) => fonts.filter((f) => !kinds || kinds.includes(f.kind)).map((f) => [f.name, `${f.label} — ${f.name}`]);
  const est = Math.max(60, Math.round(S.proj.totalWords / 230) + 12);
  const rec = await call('layout:recommend', { trim: L.trim === 'custom' ? 'a5' : L.trim, pages: (d.stages.layout && d.stages.layout.pages) || est });
  const geo = await call('layout:geometry');
  const trim = info.trims.find((t) => t.id === L.trim);

  const num = (k, ph, step = 0.5) => h('input', { type: 'number', step, value: (L.margins && L.margins[k]) ?? '', placeholder: ph, onchange: (e) => { L.margins = { ...(L.margins || {}) }; if (e.target.value === '') delete L.margins[k]; else L.margins[k] = Number(e.target.value); save({ layout: { margins: L.margins } }); } });
  const fontPrev = h('div', { class: 'serif', style: 'margin-top:6px;padding:10px 12px;background:#fff;border:1px solid var(--line);border-radius:9px;font-size:16px;line-height:1.7' }, 'בֵּין הַשְּׁמָשׁוֹת — “הים לא שואל שאלות”, אמרה. אחת-עשרה שורות של שקט, וקול אחד.');
  const updFont = () => { fontPrev.style.fontFamily = `'${L.fontBody}', serif`; fontPrev.style.fontSize = (L.fontSize || rec.fontSize) + 'pt'; fontPrev.style.lineHeight = L.lineHeight || rec.lineHeight; };

  const ctl = h('div', { class: 'ctl' },
    h('div', { class: 'sect' }, h('h3', {}, 'גודל הספר'),
      field('גודל חיתוך', select(info.trims.map((t) => [t.id, `${t.label}${t.id !== 'custom' ? ` (${t.w}×${t.h})` : ''}`]), L.trim, (v) => { L.trim = v; L.margins = null; save({ layout: { trim: v, margins: null } }).then(() => {}); setTimeout(rr, 450); }), trim ? trim.use : ''),
      L.trim === 'custom' ? h('div', { class: 'grid2' }, field('רוחב (מ״מ)', h('input', { type: 'number', value: L.customW, onchange: (e) => setL('customW', Number(e.target.value)) })), field('גובה (מ״מ)', h('input', { type: 'number', value: L.customH, onchange: (e) => setL('customH', Number(e.target.value)) }))) : null,
      h('div', { class: 'grid2' }, field('נייר', select(info.papers.map((p) => [p.id, `${p.label} (${p.mm} מ״מ)`]), L.paper, (v) => setL('paper', v))), field('כריכה', select(info.bindings.map((b) => [b.id, b.label]), L.binding, (v) => setL('binding', v)))),
      h('div', { class: 'card', style: 'padding:10px 12px;background:#fff' }, h('div', { class: 'small' }, `המלצה לגודל זה: גופן ${rec.fontSize}pt · ריווח ${rec.lineHeight} · כ־${rec.charsPerLine} תווים בשורה`), rec.notes.map((n) => h('div', { class: 'small muted' }, '• ' + n)))),
    h('div', { class: 'sect' }, h('h3', {}, 'טיפוגרפיה'),
      field('גופן טקסט', select(fontOpts(['serif', 'sans']), L.fontBody, (v) => { setL('fontBody', v); updFont(); })),
      field('גופן כותרות וכותרות ריצה', select(fontOpts(), L.fontHead, (v) => setL('fontHead', v))), fontPrev,
      h('div', { class: 'grid2', style: 'margin-top:10px' }, field('גודל (pt)', h('input', { type: 'number', step: 0.25, value: L.fontSize ?? '', placeholder: rec.fontSize, onchange: (e) => { setL('fontSize', e.target.value === '' ? null : Number(e.target.value)); updFont(); } })), field('ריווח שורות', h('input', { type: 'number', step: 0.05, value: L.lineHeight ?? '', placeholder: rec.lineHeight, onchange: (e) => { setL('lineHeight', e.target.value === '' ? null : Number(e.target.value)); updFont(); } }))),
      h('div', { class: 'grid2' }, field('הזחת פסקה (em)', h('input', { type: 'number', step: 0.1, value: L.indent, onchange: (e) => setL('indent', Number(e.target.value)) })), field('מפריד סצנות', h('input', { type: 'text', value: L.sceneBreak, onchange: (e) => setL('sceneBreak', e.target.value) }))),
      h('div', { class: 'grid2' }, check('יישור דו־צדדי', L.justify, (v) => setL('justify', v)), check('אות פותחת גדולה', L.dropCap, (v) => setL('dropCap', v)))),
    h('div', { class: 'sect' }, h('h3', {}, 'שוליים (מ״מ)'), h('div', { class: 'grid4' }, field('עליון', num('top', rec.margins.top)), field('תחתון', num('bottom', rec.margins.bottom)), field('פנימי', num('inner', rec.margins.inner)), field('חיצוני', num('outer', rec.margins.outer))), h('div', { class: 'small muted' }, 'ריק = לפי המלצה. פנימי = בצד השדרה (ימין בספר עברי).')),
    h('div', { class: 'sect' }, h('h3', {}, 'מבנה'),
      field('פתיחת פרק', select([['recto', 'תמיד בעמוד אי־זוגי (שמאלי) — קלאסי'], ['any', 'מיד אחרי הפרק הקודם']], L.chapterStart, (v) => setL('chapterStart', v))),
      h('div', { class: 'grid2' }, field('מספר עמוד', select([['center', 'תחתון באמצע'], ['outer', 'בצד חיצוני'], ['none', 'ללא']], L.folio, (v) => setL('folio', v))), field('כותרת ריצה', select([['running', 'שם הפרק / שם הספר'], ['author', 'שם הפרק / שם המחבר'], ['none', 'ללא']], L.headerStyle, (v) => setL('headerStyle', v)))),
      field('מרווח עליון בפתיחת פרק (מ״מ)', h('input', { type: 'number', value: L.chapterTopSpace, onchange: (e) => setL('chapterTopSpace', Number(e.target.value)) })),
      h('div', { class: 'grid2' }, check('שער חצי', L.halfTitle, (v) => setL('halfTitle', v)), check('עמוד שער', L.titlePage, (v) => setL('titlePage', v)), check('עמוד זכויות', L.copyrightPage, (v) => setL('copyrightPage', v)), check('תוכן עניינים', L.toc, (v) => setL('toc', v))),
      check('ריפוד לכפולה של 4 עמודים (דפוס)', L.padSignature, (v) => setL('padSignature', v))),
    h('div', { class: 'sect' }, h('h3', {}, 'עמוד זכויות ופרטים'),
      h('div', { class: 'grid2' }, field('הוצאה', h('input', { type: 'text', value: d.publisher, onchange: (e) => save({ publisher: e.target.value }) })), field('ISBN', h('input', { type: 'text', value: d.isbn, placeholder: '978-…', onchange: (e) => save({ isbn: e.target.value }) }))),
      h('div', { class: 'grid2' }, field('שנה', h('input', { type: 'text', value: d.year, onchange: (e) => save({ year: e.target.value }) })), field('כותרת משנה', h('input', { type: 'text', value: d.subtitle, onchange: (e) => save({ subtitle: e.target.value }) }))),
      field('טקסט זכויות מותאם (אופציונלי)', h('textarea', { rows: 3, onchange: (e) => setL('copyrightText', e.target.value) }, L.copyrightText || ''))));
  updFont();

  const stage = h('div', { class: 'stage' });
  const pvRoot = h('div', { style: 'flex:1;min-height:0' });
  const stat = h('div', { class: 'row wrap', style: 'padding:10px 14px;background:var(--panel);border-bottom:1px solid var(--line)' });
  stage.append(stat, pvRoot);
  root.append(h('div', { class: 'split' }, ctl, stage));

  async function showPdf() {
    const st = (await call('project:view')).data.stages.layout; S.proj.data.stages.layout = st;
    stat.innerHTML = '';
    const buildBtn = h('button', { class: 'btn accent', onclick: async (e) => busy(e.currentTarget, async () => { const r = await call('layout:build'); await refresh(); toast(`הועמד: ${r.pages} עמודים`, 'ok'); showPdf(); }, 'מעמד…') }, st ? '↻ בנה מחדש' : '▤ בנה עימוד');
    stat.append(buildBtn);
    if (st) {
      const g = geo;
      stat.append(h('span', { class: 'pill teal' }, `${st.pages} עמודים`), h('span', { class: 'pill' }, `${st.frontCount} עמודי חזית`), h('span', { class: 'pill' }, `שדרה ≈ ${(st.pages * (info.papers.find((p) => p.id === L.paper) || { mm: .05 }).mm).toFixed(1)} מ״מ`), h('span', { class: 'pill' }, `${g.w}×${g.h} מ״מ`), h('span', { class: 'pill' }, `גופן ${L.fontSize || g.fontSize}pt / ${L.lineHeight || g.lineHeight}`),
        h('span', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => call('shell:reveal', d && S.proj.dir + '/' + st.file) }, 'הצג בתיקייה'));
      try { await pdfViewer(pvRoot, S.proj.dir + '/' + st.file, { startPage: 1 }); } catch (e) { pvRoot.innerHTML = ''; pvRoot.append(h('div', { class: 'empty' }, 'לא ניתן להציג: ' + e.message)); }
    } else pvRoot.append(h('div', { class: 'empty', style: 'color:#5a5040' }, h('div', { style: 'font-size:48px' }, '▤'), h('b', {}, 'עוד לא נבנה עימוד'), h('div', {}, 'הגדירו בצד, ולחצו “בנה עימוד”. התצוגה היא כפולות ימין־לשמאל, כמו בספר אמיתי.')));
  }
  await showPdf();
}
