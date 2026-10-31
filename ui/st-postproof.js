import { h, call, toast, fail, busy, fmt } from './lib.js';
import { pdfViewer } from './pdfviewer.js';

export default async function render(root, ctx) {
  const { S, refresh, go } = ctx;
  const st = S.proj.data.stages.layout;
  if (!st) { root.append(h('div', { class: 'empty' }, h('p', {}, 'כדי להריץ הגהה אחרי עימוד צריך קודם PDF מעומד.'), h('button', { class: 'btn accent', onclick: () => go('layout') }, 'לשלב העימוד ←'))); return; }
  root.classList.add('flush');
  const left = h('div', { class: 'ctl', style: 'padding:16px 18px;overflow:auto;background:var(--panel2)' });
  const pv = h('div', { class: 'stage' }, h('div', { style: 'flex:1;min-height:0' }));
  root.append(h('div', { class: 'split', style: 'grid-template-columns:480px 1fr' }, left, pv));
  let viewer = null; const marks = {};
  const pvRoot = pv.firstChild;
  const open = async (n) => { if (viewer) return viewer.go(n); viewer = await pdfViewer(pvRoot, S.proj.dir + '/' + st.file, { startPage: n || 1, marks }); };
  await open(1);
  let rep = null;
  const res = h('div');
  const aiBox = h('div', { style: 'margin-top:10px' });
  const li = (x, cls) => h('div', { class: 'check', style: 'cursor:' + (x.page ? 'pointer' : 'default'), onclick: () => x.page && open(x.page) }, h('span', { class: 'ic ' + cls }, cls === 'bad' ? '✖' : cls === 'no' ? '!' : 'i'), h('div', { style: 'flex:1' }, h('div', {}, x.issue), x.fix ? h('div', { class: 'small muted' }, '← ' + x.fix) : null), x.page ? h('span', { class: 'pill' }, 'עמ׳ ' + x.page) : null);
  function show(r) {
    res.innerHTML = '';
    const f = r.fidelity;
    res.append(h('div', { class: 'card', style: 'padding:14px' }, h('div', { class: 'row' }, h('span', { style: 'font-size:34px' }, r.passed ? '✅' : '⛔'), h('div', {}, h('b', { class: 'serif', style: 'font-size:20px' }, r.passed ? 'הספר עבר את הבדיקות' : 'יש חסמים לפני הדפוס'), h('div', { class: 'small muted' }, `${r.pages} עמודים`))),
      h('div', { class: 'kv', style: 'margin-top:10px' }, h('b', {}, 'נאמנות טקסט'), h('span', {}, `${f.matched + f.reorderedBidi} מתוך ${f.paragraphs} פסקאות נמצאו ב-PDF`), h('b', {}, 'חסרות'), h('span', { style: f.missing ? 'color:var(--err);font-weight:600' : '' }, f.missing)),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, 'הבדיקה משווה את טקסט המקור לטקסט שחולץ מה-PDF, כדי לוודא שלא נעלמו או נחתכו פסקאות.')));
    if (r.blockers.length) res.append(h('div', { class: 'card' }, h('h3', { style: 'color:var(--err)' }, `חסמים (${r.blockers.length})`), r.blockers.map((x) => li(x, 'bad'))));
    if (r.warnings.length) res.append(h('div', { class: 'card' }, h('h3', { style: 'color:var(--warn)' }, `אזהרות (${r.warnings.length})`), r.warnings.map((x) => li(x, 'no'))));
    if (r.notes.length) res.append(h('div', { class: 'card' }, h('h3', {}, 'הערות'), r.notes.map((x) => li(x, 'ok'))));
    res.append(h('div', { class: 'card' }, h('h3', {}, 'קריאה אחרונה של עמודי החזית (מודל)'), h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'מילה־מילה על שער, זכויות, הקדשה ותוכן עניינים — המקום שבו נשארות הטעויות האחרונות.'),
      h('button', { class: 'btn primary', onclick: async (e) => busy(e.currentTarget, async () => { const a = await call('postproof:ai', { report: r }); aiBox.innerHTML = ''; if (!a) return aiBox.append(h('div', { class: 'muted' }, 'לא התקבלה תשובה תקינה')); aiBox.append(h('div', { class: 'row' }, h('span', { class: 'pill ' + (a.passed ? 'ok' : 'err') }, a.passed ? 'עבר' : 'יש ממצאים')), [...(a.blockers || []).map((x) => li({ page: x.page, issue: x.issue || JSON.stringify(x), fix: x.fix }, 'bad')), ...(a.warnings || []).map((x) => li({ page: x.page, issue: x.issue || JSON.stringify(x), fix: x.fix }, 'no')), ...(a.notes || []).map((x) => li({ issue: typeof x === 'string' ? x : x.issue || JSON.stringify(x) }, 'ok'))]); }, 'קורא…') }, 'הרץ בדיקת מודל'), aiBox));
  }
  left.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('button', { class: 'btn accent', onclick: async (e) => busy(e.currentTarget, async () => { rep = await call('postproof:run'); await refresh(); show(rep); (rep.blockers.concat(rep.warnings)).forEach((x) => { if (x.page) marks[x.page] = true; }); toast(rep.passed ? 'עבר ✓' : 'יש חסמים', rep.passed ? 'ok' : 'err'); }, 'בודק…') }, '⌕ הרץ הגהה אחרי עימוד'), h('button', { class: 'btn', onclick: () => go('layout') }, '← חזרה לעימוד')), res);
  if (S.proj.data.stages.postproof) res.append(h('div', { class: 'hint' }, `הרצה אחרונה: ${S.proj.data.stages.postproof.at.slice(0, 16).replace('T', ' ')} — ${S.proj.data.stages.postproof.passed ? 'עברה' : 'עם חסמים'}. הריצו שוב לתוצאות מפורטות.`));
}
