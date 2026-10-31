import { h, call, toast, fail, busy, fmt, select } from './lib.js';

const RULE_LABEL = { 'double-space': 'רווח כפול', 'space-before-punct': 'רווח לפני פיסוק', 'no-space-after-punct': 'חסר רווח אחרי פיסוק', 'straight-quote': 'מירכאות ישרות', 'gershayim': 'גרשיים', 'geresh': 'גרש', 'hyphen-dash': 'קו מפריד', 'dialogue-dash': 'מקף דיבור', 'ellipsis': 'שלוש נקודות', 'maqaf': 'מקף עברי', 'final-letter-missing': 'אות סופית חסרה', 'final-letter-mid': 'אות סופית באמצע', 'repeated-word': 'מילה כפולה', 'unbalanced': 'סימן לא מאוזן', 'mixed-script': 'עברית+לטינית צמודות', 'multi-punct': 'פיסוק חוזר', 'paren-space': 'רווח בסוגריים', 'invisible': 'תו בלתי נראה', 'trailing-space': 'רווח בסוף שורה', 'period-no-space': 'נקודה בלי רווח', 'digit-mix': 'ספרות ערביות' };

export default async function render(root, ctx) {
  const { S, refresh, render: rr } = ctx;
  const chs = S.proj.chapters.filter((c) => !['dedication', 'epigraph'].includes(c.kind));
  if (!chs.length) { root.append(h('div', { class: 'empty' }, 'אין פרקים להגהה.')); return; }
  if (!chs.find((c) => c.id === S.chapterId)) S.chapterId = chs[0].id;
  const c = S.proj.chapters.find((x) => x.id === S.chapterId);
  const text = await call('chapter:read', c.id);
  const lint = await call('lint:chapter', c.id);
  const overview = await call('lint:all');

  const sel = select(chs.map((x) => { const o = overview.find((y) => y.id === x.id); return [x.id, `${x.title} — ${o ? o.summary.errors + o.summary.warns : 0} ממצאים${x.status && x.status.proof ? ' ✓' : ''}`]; }), c.id, (v) => { S.chapterId = v; rr(); }, { style: 'max-width:420px' });
  const list = h('div', { class: 'card', style: 'padding:0;max-height:560px;overflow:auto' });
  let filter = null;
  const sum = lint.summary;
  const chips = h('div', { class: 'row wrap', style: 'margin:10px 0' });

  function ctxOf(i) { const a = Math.max(0, i.index - 28), b = Math.min(text.length, i.index + i.length + 28); return [text.slice(a, i.index), text.slice(i.index, i.index + Math.max(1, i.length)), text.slice(i.index + i.length, b)]; }
  function drawList() {
    list.innerHTML = '';
    const items = lint.issues.filter((i) => (!filter || i.rule === filter));
    if (!items.length) list.append(h('div', { class: 'empty' }, h('div', { style: 'font-size:34px' }, '✓'), 'לא נמצאו ממצאים' + (filter ? ' בקטגוריה זו' : '')));
    items.slice(0, 250).forEach((i) => { const [a, m, b] = ctxOf(i);
      list.append(h('div', { class: 'issue' }, h('span', { class: 'sevdot ' + i.severity }),
        h('div', {}, h('div', { class: 'small', style: 'font-weight:500' }, `${i.message} · שורה ${i.line}`), h('div', { class: 'ctx' }, a.replace(/\n/g, ' '), h('mark', {}, m.replace(/\n/g, '↵') || '∅'), b.replace(/\n/g, ' ')), i.fix !== null ? h('div', { class: 'small muted' }, `→ “${i.fix}”`) : null),
        i.fix !== null ? h('button', { class: 'btn sm', onclick: async (e) => { const t2 = text.slice(0, i.index) + i.fix + text.slice(i.index + i.length); await call('chapter:write', { id: c.id, text: t2 }); toast('תוקן', 'ok'); rr(); } }, 'תקן') : null)); });
    if (items.length > 250) list.append(h('div', { class: 'empty small' }, `ועוד ${items.length - 250}… (תקנו את הבטוחים ורעננו)`));
  }
  const drawChips = () => { chips.innerHTML = ''; chips.append(h('button', { class: 'pill ' + (!filter ? 'teal' : ''), style: 'cursor:pointer', onclick: () => { filter = null; drawChips(); drawList(); } }, `הכול ${sum.total}`));
    Object.entries(sum.byRule).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => chips.append(h('button', { class: 'pill ' + (filter === r ? 'teal' : ''), style: 'cursor:pointer', onclick: () => { filter = r; drawChips(); drawList(); } }, `${RULE_LABEL[r] || r} ${n}`))); };

  const aiOut = h('div');
  root.append(
    h('div', { class: 'row wrap', style: 'margin-bottom:14px' }, sel,
      h('button', { class: 'btn primary', onclick: async (e) => busy(e.currentTarget, async () => { const r = await call('lint:fix', { id: c.id }); toast(`תוקנו ${r.fixed} מקרים בבטחה`, 'ok'); await refresh(); rr(); }) }, '✓ תקן הכול בבטחה'),
      h('button', { class: 'btn accent', onclick: async (e) => busy(e.currentTarget, async () => { aiOut.innerHTML = ''; const r = await call('ai:proof', { id: c.id, ai: true }); await call('chapter:write', { id: c.id, text: r.text }); await call('stage:mark', { id: c.id, stage: 'proof', val: { ai: true, applied: r.applied.length } }); await refresh(); showAI(r); toast(`הגהה הושלמה: ${r.autoFixed} אוטומטיים + ${r.applied.length} ממודל`, 'ok'); }, 'מגיה מילה־מילה…') }, 'הגהה מלאה (כלי + מודל)'),
      h('button', { class: 'btn sm', onclick: () => call('ai:cancel', 'proof') }, 'ביטול'),
      h('button', { class: 'btn', onclick: async (e) => busy(e.currentTarget, async () => { for (const x of chs) await call('lint:fix', { id: x.id }); await refresh(); toast('כל הפרקים עברו תיקון בטוח', 'ok'); rr(); }) }, 'תקן בטוח בכל הספר')),
    h('div', { class: 'grid2', style: 'align-items:start' }, h('div', {}, h('div', { class: 'row' }, h('b', { class: 'serif', style: 'font-size:18px' }, 'בדיקה תו־תו'), h('span', { class: 'pill ' + (sum.errors ? 'err' : 'ok') }, `${sum.errors} שגיאות`), h('span', { class: 'pill ' + (sum.warns ? 'warn' : 'ok') }, `${sum.warns} אזהרות`), h('span', { class: 'pill' }, `${sum.infos} מידע`)), chips, list),
      h('div', {}, h('b', { class: 'serif', style: 'font-size:18px' }, 'מעבר מודל'), h('div', { class: 'hint', style: 'margin:6px 0 10px' }, 'הטקסט נבדק בחלונות קטנים עם דוח הכלי האוטומטי. כל תיקון מוחל רק אם מחרוזת המקור ייחודית וקרובה בגודלה — אחרת הוא נדחה. אפשר תמיד לשחזר מההיסטוריה.'), aiOut,
        h('div', { class: 'card', style: 'margin-top:12px' }, h('b', {}, 'מה הכלי בודק'), h('div', { class: 'hint', style: 'line-height:1.8;margin-top:4px' }, 'אותיות סופיות (ך ם ן ף ץ) · גרשיים וגרש · מירכאות חכמות ואיזון · קו מפריד מול מקף · שלוש נקודות · רווחים כפולים וחסרים · פיסוק חוזר · סוגריים · מילים כפולות · עברית+לטינית צמודות · תווי כיווניות נסתרים'))));
  drawChips(); drawList();
  function showAI(r) {
    aiOut.innerHTML = '';
    aiOut.append(h('div', { class: 'card', style: 'padding:12px 14px' }, h('div', { class: 'row wrap' }, h('span', { class: 'pill ok' }, `${r.autoFixed} תיקונים אוטומטיים`), h('span', { class: 'pill teal' }, `${r.applied.length} תיקוני מודל`), h('span', { class: 'pill' }, `${r.rejected.length} נדחו`)),
      r.applied.length ? h('div', { style: 'margin-top:8px' }, r.applied.map((a) => h('div', { class: 'issue', style: 'grid-template-columns:1fr' }, h('div', { class: 'ctx' }, h('del', { style: 'background:#f9d9d4;text-decoration:none;padding:0 3px;border-radius:3px' }, a.find), ' → ', h('ins', { style: 'background:#d9efdf;text-decoration:none;padding:0 3px;border-radius:3px' }, a.replace)), h('div', { class: 'small muted' }, a.reason || '')))) : h('div', { class: 'muted', style: 'margin-top:8px' }, 'המודל לא מצא שגיאות נוספות.'),
      r.queries.length ? h('div', { style: 'margin-top:10px' }, h('b', { class: 'small' }, 'שאלות/ספקות'), h('ul', { style: 'padding-inline-start:18px;margin:4px 0' }, r.queries.map((q) => h('li', {}, q)))) : null));
  }
}
