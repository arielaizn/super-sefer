import { h, call, toast, fail, busy, fmt, field, check } from './lib.js';

export default async function render(root, ctx) {
  const { S, refresh, go } = ctx;
  const d = S.proj.data;
  const lint = await call('lint:all');
  const bad = lint.reduce((a, x) => a + x.summary.errors, 0);
  const st = d.stages;
  let out = S.info.downloads + '/' + d.title.replace(/[\\/:*?"<>|]+/g, '').trim();
  let both = false;
  const items = [
    ['כתיבה', S.proj.totalWords > 0, `${fmt(S.proj.totalWords)} מילים ב-${S.proj.chapters.length} פרקים`, 'write'],
    ['עריכה ספרותית', S.proj.chapters.some((c) => c.status && c.status.lit), 'לא חובה, אבל מומלץ', 'lit'],
    ['עריכה לשונית', S.proj.chapters.some((c) => c.status && c.status.ling), 'לא חובה, אבל מומלץ', 'ling'],
    ['הגהה', bad === 0, bad ? `${bad} שגיאות טיפוגרפיה/אותיות פתוחות` : 'אין שגיאות ידועות', 'proof'],
    ['עימוד', !!st.layout, st.layout ? `${st.layout.pages} עמודים` : 'ייבנה אוטומטית בייצוא', 'layout'],
    ['הגהה אחרי עימוד', !!(st.postproof && st.postproof.passed), st.postproof ? (st.postproof.passed ? 'עברה' : 'יש חסמים') : 'טרם הורצה', 'postproof'],
    ['כריכה', !!d.cover.design, d.cover.design ? 'עיצוב קיים' : 'ייווצר עיצוב ברירת מחדל', 'cover'],
    ['שפה גרפית', !!d.visual.bible, d.visual.bible ? d.visual.bible.name : 'לא הוגדרה (לא חובה)', 'visual'],
  ];
  const res = h('div');
  const dir = h('input', { type: 'text', value: out, onchange: (e) => { out = e.target.value; } });
  root.append(h('div', { class: 'grid2', style: 'grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);align-items:start' },
    h('div', { class: 'card' }, h('h3', {}, 'בדיקת מוכנות'), items.map(([t, ok, note, st2]) => h('div', { class: 'check', style: 'cursor:pointer', onclick: () => go(st2) }, h('span', { class: 'ic ' + (ok ? 'ok' : 'no') }, ok ? '✓' : '!'), h('b', { style: 'width:130px;font-weight:500' }, t), h('span', { class: 'muted small grow' }, note))), h('div', { class: 'hint', style: 'margin-top:10px' }, 'אפשר לייצא בכל שלב — הייצוא בונה מחדש את העימוד והכריכה מהמצב הנוכחי.')),
    h('div', {}, h('div', { class: 'card' }, h('h3', {}, 'ייצוא'), field('תיקיית יעד', h('div', { class: 'row' }, dir, h('button', { class: 'btn sm', onclick: async () => { const p = await call('dialog:pickDir'); if (p) { out = p; dir.value = p; } } }, 'בחירה…'))),
      check('להפיק גם כריכה כשני עמודים (חזית וגב נפרדים)', both, (v) => { both = v; }),
      h('div', { class: 'hint', style: 'margin:8px 0 12px;line-height:1.7' }, h('b', {}, 'קובץ 1 — פנים הספר: '), 'PDF אחד מהעמוד הראשון ועד האחרון: שער, זכויות, הקדשה, תוכן עניינים, פרקים.', h('br'), h('b', {}, 'קובץ 2 — כריכה: '), 'PDF פרוס (גב · שדרה · חזית) בצורה מושלמת להדפסה, עם בליד ושדרה מחושבת.'),
      h('button', { class: 'btn accent lg', style: 'width:100%;justify-content:center', onclick: async (e) => busy(e.currentTarget, async () => { res.innerHTML = ''; const r = await call('export:run', { out: dir.value, both }); await refresh(); res.append(h('div', { class: 'card', style: 'background:var(--ok-l);border-color:#bfe0cb;margin-top:12px' }, h('b', { style: 'font-size:17px' }, '✓ הספר מוכן'), h('div', { class: 'kv', style: 'margin:8px 0' }, h('b', {}, 'פנים'), h('span', {}, `${r.interior.file.split('/').pop()} · ${r.interior.pages} עמודים`), h('b', {}, 'כריכה'), h('span', {}, `${r.cover.file.split('/').pop()} · שדרה ${r.cover.geometry.spine} מ״מ`), r.cover.dpi ? h('b', {}, 'DPI תמונה') : null, r.cover.dpi ? h('span', {}, `${r.cover.dpi.dpi} — ${r.cover.dpi.level}`) : null), r.interior.warnings.length ? h('div', { class: 'small', style: 'color:var(--warn)' }, r.interior.warnings.join(' · ')) : null, h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => call('shell:reveal', r.interior.file) }, 'הצג בתיקייה'), h('button', { class: 'btn', onclick: () => call('shell:open', r.interior.file) }, 'פתח פנים'), h('button', { class: 'btn', onclick: () => call('shell:open', r.cover.file) }, 'פתח כריכה')))); toast('הייצוא הושלם', 'ok'); }, 'מפיק PDF…') }, '⇩ ייצא PDF'), res),
      h('div', { class: 'card hint' }, h('b', {}, 'לפני הדפוס'), h('ul', { style: 'padding-inline-start:18px;margin:6px 0;line-height:1.8' }, h('li', {}, 'בקשו מהדפוס הדפסת ניסיון (proof).'), h('li', {}, 'אשרו מולו את עובי השדרה הסופי לפי הנייר שבחרתם.'), h('li', {}, 'אם נדרש PDF/X או המרת CMYK — הדפוס יבצע, או השתמשו ב-Acrobat Preflight.'))))));
}
