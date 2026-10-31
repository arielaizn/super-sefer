import { h, call, on, toast, fail, modal, busy, fmt, field, select, check } from './lib.js';

export const S = { info: null, proj: null, stage: 'write', chapterId: null, progress: null };
const STAGES = [
  { id: 'write', label: 'כתיבה בקול שלך', sub: 'כתבו פרק אחר פרק — סופר-ספר לומד את הסגנון שלכם מההקלדה, ויכול להמשיך אתכם בקול שלכם.' },
  { id: 'lit', label: 'עריכה ספרותית', sub: 'עריכת שורה בהתערבות מינימלית: קצב, בהירות, דיאלוג, דימויים — בלי לשנות את הקול. כל שינוי ניתן לאישור או לדחייה.' },
  { id: 'ling', label: 'עריכה לשונית', sub: 'כתיב, פיסוק, התאמה, תחביר ועקביות לפי כללי האקדמיה — עם שמירה על הדיבוריות שבחרתם.' },
  { id: 'proof', label: 'הגהה', sub: 'בדיקה אות אחר אות: כלי דטרמיניסטי על כל תו, ואחריו מעבר מילה־מילה של מודל — תיקונים בטוחים בלבד.' },
  { id: 'layout', label: 'עימוד', sub: 'גודל ספר, שוליים, גופנים וטיפוגרפיה עברית נכונה — מבוסס מחקר, עם תצוגת כפולות ימין־לשמאל.' },
  { id: 'postproof', label: 'הגהה אחרי עימוד', sub: 'בדיקת נאמנות מול המקור, עמודים, תוכן עניינים ומספור — רגע לפני שהספר נולד.' },
  { id: 'cover', label: 'עיצוב כריכה', sub: 'קונספטים, פריסות, צבע וטיפוגרפיה, שדרה מחושבת ברזולוציית דפוס.' },
  { id: 'visual', label: 'שפה גרפית ואיורים', sub: 'Style Bible אחד לכל הספר — כריכה ואיורים באותה יד, דרך Codex ומודל התמונות.' },
  { id: 'export', label: 'ייצוא PDF', sub: 'שני קבצים מוכנים להדפסה: פנים הספר, וכריכה (חזית וגב).' },
];
export const stageMeta = (id) => STAGES.find((s) => s.id === id);

const mods = {};
async function loadStage(id) {
  if (!mods[id]) mods[id] = await import(`./st-${id}.js`);
  return mods[id];
}

const app = document.getElementById('app');

export async function refresh() { S.proj = await call('project:view'); if (!S.chapterId || !S.proj.chapters.find((c) => c.id === S.chapterId)) S.chapterId = S.proj.chapters[0] && S.proj.chapters[0].id; return S.proj; }
export function chapter() { return S.proj.chapters.find((c) => c.id === S.chapterId); }
export async function go(stage) { S.stage = stage; await render(); }

function stageStatus(id) {
  const p = S.proj, d = p.data, cs = p.chapters;
  const n = cs.length || 1;
  const cnt = (k) => cs.filter((c) => c.status && c.status[k]).length;
  switch (id) {
    case 'write': return p.totalWords > 0 ? (d.style.profile && d.style.profile.ready ? 'ok' : 'part') : '';
    case 'lit': return cnt('lit') === 0 ? '' : cnt('lit') >= cs.filter((c) => c.kind !== 'dedication' && c.kind !== 'epigraph').length ? 'ok' : 'part';
    case 'ling': return cnt('ling') === 0 ? '' : cnt('ling') >= cs.length * .8 ? 'ok' : 'part';
    case 'proof': return cnt('proof') === 0 ? '' : cnt('proof') >= cs.length * .8 ? 'ok' : 'part';
    case 'layout': return d.stages.layout ? 'ok' : '';
    case 'postproof': return d.stages.postproof ? (d.stages.postproof.passed ? 'ok' : 'part') : '';
    case 'cover': return d.cover.design ? 'ok' : '';
    case 'visual': return d.visual.bible ? (d.visual.images.length ? 'ok' : 'part') : '';
    case 'export': return d.stages.export ? 'ok' : '';
  }
  return '';
}

async function render() {
  if (!S.proj) return renderHome();
  const meta = stageMeta(S.stage);
  const side = h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('div', { class: 'mark' }, 'ס'), h('div', {}, h('b', {}, 'סופר-ספר'), h('small', {}, 'יצירת ספרים מקצה לקצה'))),
    h('div', { class: 'bookbox' }, h('div', { class: 't' }, S.proj.data.title), h('div', { class: 'm' }, `${S.proj.data.author || 'מחבר/ת ללא שם'} · ${fmt(S.proj.totalWords)} מילים · ${S.proj.chapters.length} פרקים`)),
    STAGES.map((s, i) => h('div', { class: 'step ' + (S.stage === s.id ? 'on' : ''), onclick: () => go(s.id) }, h('span', { class: 'n' }, i + 1), s.label, h('span', { class: 'dot ' + stageStatus(s.id) }))),
    h('div', { class: 'sp' }),
    h('div', { class: 'foot' },
      h('button', { class: 'btn sm', onclick: openSettings }, '⚙ הגדרות'),
      h('button', { class: 'btn sm', onclick: () => call('shell:reveal', S.proj.dir + '/ספר.json') }, '📁 תיקיית הספר'),
      h('button', { class: 'btn sm', onclick: async () => { await call('project:close'); S.proj = null; render(); } }, '⌂ ספרים')));
  const top = h('div', { class: 'top' }, h('div', {}, h('h2', {}, `${STAGES.findIndex((s) => s.id === S.stage) + 1}. ${meta.label}`), h('div', { class: 'sub' }, meta.sub)), h('div', { class: 'grow' }),
    S.progress ? h('span', { class: 'pill teal' }, h('span', { class: 'spinner' }), S.progress) : null);
  const view = h('div', { class: 'view', id: 'view' });
  app.innerHTML = '';
  app.append(h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, view)));
  const m = await loadStage(S.stage);
  try { await m.default(view, { S, refresh, go, render, chapter, flush: () => view.classList.add('flush') }); } catch (e) { fail(e); view.append(h('div', { class: 'empty' }, 'שגיאה בטעינת השלב: ' + e.message)); }
}
export const rerender = render;
window.__go = (s) => go(s);
window.__home = async () => { const p = S.proj; S.proj = null; await render(); S.proj = p; };

// ----- מסך בית -----
async function renderHome() {
  const info = S.info;
  const eng = (n, ok) => h('span', { class: 'pill ' + (ok ? 'ok' : 'warn') }, (ok ? '✓ ' : '! ') + n);
  const title = h('input', { type: 'text', placeholder: 'שם הספר' });
  const author = h('input', { type: 'text', placeholder: 'שם המחבר/ת' });
  const genre = select([['prose', 'פרוזה / רומן'], ['nonfiction', 'עיון / עסקים'], ['poetry', 'שירה'], ['kids', 'ילדים']], 'prose', () => {});
  app.innerHTML = '';
  app.append(h('div', { class: 'home' }, h('div', { class: 'home-in' },
    h('div', { class: 'hero' }, h('div', { class: 'brand', style: 'margin:0 0 16px' }, h('div', { class: 'mark' }, 'ס')),
      h('h1', { class: 'serif' }, 'סופר', h('em', {}, '־'), 'ספר'),
      h('p', {}, 'מערכת שלמה ליצירת ספר — מהמילה הראשונה ועד קובץ ה-PDF שהולך לדפוס. כתיבה בקול שלכם, עריכה, הגהה, עימוד, כריכה ואיורים באותה שפה גרפית.'),
      h('div', { class: 'flow' }, ['כתיבה', 'עריכה ספרותית', 'עריכה לשונית', 'הגהה', 'עימוד', 'הגהה אחרי עימוד', 'כריכה', 'שפה גרפית', 'PDF'].map((s, i) => h('span', {}, `${i + 1} · ${s}`))),
      h('div', { class: 'row wrap', style: 'margin-top:20px' }, eng('Claude Code', !!info.engines.claude), eng('Codex', !!info.engines.codex), h('span', { class: 'muted small' }, 'גרסה ' + info.version)),
      h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn sm', onclick: openSettings }, '⚙ התקנת CLI ותוספים / הגדרות מנוע'))),
    h('div', {},
      h('div', { class: 'card' }, h('h3', {}, 'ספר חדש'), field('שם הספר', title), field('מחבר/ת', author), field('סוג', genre),
        h('button', { class: 'btn accent lg', style: 'width:100%;justify-content:center', onclick: async (e) => { if (!title.value.trim()) return toast('נא להזין שם לספר', 'err'); await busy(e.currentTarget, async () => { S.proj = await call('project:create', { title: title.value.trim(), author: author.value.trim(), genre: genre.value }); await afterOpen(); }); } }, 'התחלה ←')),
      h('div', { class: 'card' }, h('h3', {}, 'ספרים אחרונים'),
        h('div', { class: 'recent' }, info.recent.length ? info.recent.map((d) => h('button', { onclick: async () => { try { S.proj = await call('project:open', d); await afterOpen(); } catch (e) { fail(e); } } }, h('b', {}, d.split('/').pop()), h('div', { class: 'small muted' }, d))) : h('div', { class: 'muted small' }, 'אין עדיין.')),
        h('button', { class: 'btn', style: 'margin-top:10px', onclick: async () => { try { const v = await call('project:pick'); if (v) { S.proj = v; await afterOpen(); } } catch (e) { fail(e); } } }, 'פתיחת תיקיית ספר…'))))));
}
async function afterOpen() { S.chapterId = null; await refresh(); S.stage = S.proj.chapters.length ? 'write' : 'write'; await render(); }

// ----- הגדרות -----
function openSettings() {
  const e = S.proj ? S.proj.data.engine : { llm: 'claude', model: '', imageModel: 'gpt-image-2.5', effort: '' };
  const out = h('pre', { style: 'background:#241f19;color:#efe7d6;padding:12px;border-radius:10px;font-size:12.5px;max-height:220px;overflow:auto;white-space:pre-wrap;direction:ltr;text-align:left;display:none' });
  const llm = select([['claude', 'Claude Code (המנוי שלך)'], ['codex', 'Codex (המנוי שלך)']], e.llm, () => {});
  const model = h('input', { type: 'text', value: e.model, placeholder: 'ריק = ברירת מחדל (למשל opus / sonnet)' });
  const effort = select([['', 'ברירת מחדל'], ['low', 'low'], ['medium', 'medium'], ['high', 'high'], ['xhigh', 'xhigh']], e.effort, () => {});
  const imgm = h('input', { type: 'text', value: e.imageModel });
  const body = h('div', {},
    S.proj ? h('div', {}, h('div', { class: 'grid2' }, field('מנוע כתיבה ועריכה', llm), field('מודל (אופציונלי)', model)), h('div', { class: 'grid2' }, field('עומק חשיבה', effort), field('מודל תמונות (דרך Codex)', imgm, 'ההרצה היא דרך כלי image_gen של Codex במסגרת המנוי')), h('hr', { class: 'sep' })) : null,
    h('h3', { style: 'margin-bottom:6px' }, 'התקנת סביבת העבודה'),
    h('p', { class: 'hint muted' }, 'מתקין את פקודת sofer-sefer בטרמינל, את תוסף Claude Code (כישורים ופקודות), כישורי Codex, ואת codex-plugin-cc ליצירת איורים. ההתקנה רצה אוטומטית בהפעלה הראשונה.'),
    h('div', { class: 'row wrap', style: 'margin:8px 0' },
      h('button', { class: 'btn primary', onclick: async (ev) => { out.style.display = 'block'; out.textContent = 'מתקין…'; await busy(ev.currentTarget, async () => { const r = await call('setup:run', {}); out.textContent = JSON.stringify(r, null, 1); toast('ההתקנה הושלמה', 'ok'); }); } }, 'התקנה / עדכון'),
      h('button', { class: 'btn', onclick: async (ev) => { out.style.display = 'block'; out.textContent = 'בודק…'; await busy(ev.currentTarget, async () => { out.textContent = JSON.stringify(await call('setup:doctor'), null, 1); }); } }, 'בדיקת סביבה')),
    out);
  modal('הגדרות', body, [S.proj ? { label: 'שמירה', cls: 'accent', fn: async () => { try { S.proj = await call('engine:set', { llm: llm.value, model: model.value.trim(), effort: effort.value, imageModel: imgm.value.trim() || 'gpt-image-2.5' }); toast('נשמר', 'ok'); } catch (er) { fail(er); } } } : null, { label: 'סגירה' }].filter(Boolean));
}

// ----- אתחול -----
on('progress', (p) => { S.progress = p.msg ? `${p.msg}` : null; const el = document.querySelector('.top .pill.teal'); if (p.stage === 'setup' && p.done) toast('התקנת ה-CLI והתוספים הושלמה ✓', 'ok'); if (el) el.lastChild.textContent = ' ' + (p.msg || ''); document.dispatchEvent(new CustomEvent('ss-progress', { detail: p })); });
on('menu', (m) => { if (m === 'setup') openSettings(); if (m === 'new') { S.proj = null; render(); } if (m === 'open') call('project:pick').then(async (v) => { if (v) { S.proj = v; await afterOpen(); } }).catch(fail); });
(async () => {
  try {
    S.info = await call('app:info');
    try { const v = await call('project:view'); S.proj = v; await refresh(); } catch { S.proj = null; }
    await render();
  } catch (e) { app.textContent = 'שגיאת אתחול: ' + e.message; }
})();
