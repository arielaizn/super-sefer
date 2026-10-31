// מסך משותף לעריכה ספרותית (lit) ולשונית (ling)
import { h, call, toast, fail, busy, fmt, select } from './lib.js';
import { diffReview } from './diffreview.js';

export default async function editStage(root, ctx, kind) {
  const { S, refresh, render: rr } = ctx;
  const isLit = kind === 'lit';
  const chs = S.proj.chapters.filter((c) => !['dedication', 'epigraph'].includes(c.kind));
  if (!chs.length) { root.append(h('div', { class: 'empty' }, 'אין פרקים לעריכה עדיין. התחילו בשלב הכתיבה.')); return; }
  if (!chs.find((c) => c.id === S.chapterId)) S.chapterId = chs[0].id;
  const c = S.proj.chapters.find((x) => x.id === S.chapterId);
  const orig = await call('chapter:read', c.id);
  const sel = select(chs.map((x) => [x.id, `${x.title} · ${fmt(x.words)} מילים${x.status && x.status[kind] ? ' ✓' : ''}`]), c.id, (v) => { S.chapterId = v; rr(); }, { style: 'max-width:420px' });
  const out = h('div');
  const bar = h('div', { class: 'row wrap', style: 'margin-bottom:14px' }, sel,
    h('button', { class: 'btn primary', onclick: async (e) => { if (!orig.trim()) return toast('הפרק ריק', 'err'); await busy(e.currentTarget, async () => { const r = await call(isLit ? 'ai:lit' : 'ai:ling', { id: c.id }); showResult(r); }, isLit ? 'עורך…' : 'מגיה לשון…'); } }, isLit ? '✐ הרץ עריכה ספרותית' : 'א הרץ עריכה לשונית'),
    h('button', { class: 'btn sm', onclick: () => call('ai:cancel', kind) }, 'ביטול'),
    h('span', { class: 'muted small' }, 'המנוע: ' + (S.proj.data.engine.llm === 'codex' ? 'Codex' : 'Claude Code') + ' · הפרופיל הסגנוני נטען אוטומטית' + (S.proj.data.style.profile && S.proj.data.style.profile.ready ? ' ✓' : ' (לא נבנה עדיין — כדאי)')));
  root.append(bar, out);
  out.append(h('div', { class: 'card hint' }, isLit ? 'העורך/ת קוראים את הפרק לאור הספר כולו, מאתרים מקומות שבהם הקצב, הבהירות, הדיאלוג או הדימויים לא עובדים — ומציעים תיקון מינימלי בקול שלכם. אתם מחליטים על כל שינוי.' : 'התיקונים כוללים כתיב, פיסוק, התאמה ותחביר, עקביות ושמות. הדיבוריות שלכם נשמרת. תיקוני טיפוגרפיה (מירכאות, מקפים) נעשים בשלב ההגהה.'));

  function showResult(r) {
    out.innerHTML = '';
    if (!r.revised) { out.append(h('div', { class: 'card' }, 'המודל לא החזיר נוסח מתוקן. ', h('details', {}, h('summary', {}, 'פלט גולמי'), h('pre', { style: 'white-space:pre-wrap' }, r.raw || '')))); return; }
    const dr = diffReview(orig.trim(), r.revised.trim(), { onChange: upd });
    const stat = h('span', { class: 'pill teal' });
    const upd = () => { const s = dr.stats(); stat.textContent = `${s.accepted} מתוך ${s.total} שינויים יאושרו`; };
    upd();
    const findingsBox = h('div');
    const fl = r.findings || [];
    fl.forEach((f) => findingsBox.append(h('div', { class: 'finding sev-' + (f.severity || f.confidence === 'low' ? 'low' : 'medium'), onclick: () => dr.jump(f.quote) },
      h('div', { class: 'row' }, h('span', { class: 'pill' }, f.type || f.category || ''), f.severity ? h('span', { class: 'pill ' + (f.severity === 'high' ? 'err' : f.severity === 'medium' ? 'warn' : '') }, f.severity) : null, f.rule ? h('span', { class: 'muted small' }, f.rule) : null),
      f.quote ? h('div', { class: 'q' }, '“' + f.quote + '”') : null,
      h('div', { class: 's' }, f.issue || '', f.suggestion ? h('div', { class: 'muted' }, '← ' + f.suggestion) : null, f.fix ? h('div', { class: 'muted' }, '← ' + f.fix) : null))));
    const side = h('div', { style: 'position:sticky;top:0;align-self:start;max-height:calc(100vh - 220px);overflow:auto;padding-inline-start:2px' },
      r.summary ? h('div', { class: 'card', style: 'padding:12px 14px;margin-bottom:10px' }, h('b', {}, 'סיכום העורך/ת'), h('div', { style: 'margin-top:4px;line-height:1.55' }, r.summary)) : null,
      r.queries && r.queries.length ? h('div', { class: 'card', style: 'padding:12px 14px;margin-bottom:10px' }, h('b', {}, 'שאלות אליכם'), h('ul', { style: 'margin:6px 0 0;padding-inline-start:18px' }, r.queries.map((q) => h('li', {}, q)))) : null,
      h('b', { class: 'small muted', style: 'display:block;margin:8px 0' }, `ממצאים (${fl.length})`), findingsBox);
    out.append(h('div', { class: 'row wrap', style: 'margin-bottom:10px' }, stat,
      h('button', { class: 'btn sm', onclick: () => dr.setAll(true) }, 'אשר הכול'), h('button', { class: 'btn sm', onclick: () => dr.setAll(false) }, 'דחה הכול'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn accent', onclick: async (e) => busy(e.currentTarget, async () => { const text = dr.result().trimEnd() + '\n'; await call('chapter:write', { id: c.id, text }); await call('stage:mark', { id: c.id, stage: kind, val: { findings: fl.length } }); await refresh(); toast('נשמר. הגרסה הקודמת בהיסטוריה.', 'ok'); const idx = chs.findIndex((x) => x.id === c.id); if (chs[idx + 1]) { S.chapterId = chs[idx + 1].id; } rr(); }) }, 'שמור את השינויים המאושרים ←')),
      h('div', { style: 'display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px' }, h('div', {}, h('div', { class: 'small muted', style: 'margin-bottom:6px' }, 'ירוק = הצעה חדשה · אדום = מקור. לחצו על שינוי כדי לבטל/לאשר אותו.'), dr.el), side));
  }
}
