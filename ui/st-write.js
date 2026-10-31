import { h, call, toast, fail, busy, fmt, field, select, debounce, KIND_LABEL } from './lib.js';

export default async function render(root, ctx) {
  const { S, refresh, render: rr } = ctx;
  root.classList.add('flush');
  const p = S.proj;
  let cur = ctx.chapter();
  let tele = { typed: 0, deleted: 0 };
  let dirty = false;

  const list = h('div', { class: 'chlist' });
  const mid = h('div', { class: 'col mid' });
  const right = h('div', { class: 'col', style: 'padding:14px' });
  root.append(h('div', { class: 'cols write' }, h('div', { class: 'col' }, h('div', { class: 'row', style: 'padding:12px 12px 0' }, h('b', { class: 'serif', style: 'font-size:18px;flex:1' }, 'פרקים'),
    h('button', { class: 'btn sm primary', onclick: addChapter }, '+ פרק'), h('button', { class: 'btn sm', title: 'ייבוא קובץ Markdown/טקסט', onclick: async () => { try { const v = await call('chapter:import'); if (v) { S.proj = v; await refresh(); rr(); } } catch (e) { fail(e); } } }, '⇪')), list), mid, right));

  async function addChapter() {
    const kinds = Object.entries(KIND_LABEL);
    const r = await call('chapter:add', { title: '', kind: 'chapter' });
    S.proj = r.view; S.chapterId = r.c.id; rr();
  }

  function drawList() {
    list.innerHTML = '';
    if (!S.proj.chapters.length) list.append(h('div', { class: 'empty small' }, 'עוד אין פרקים. לחצו “+ פרק” והתחילו לכתוב — או ייבאו כתב־יד.'));
    S.proj.chapters.forEach((c, i) => list.append(h('div', { class: 'ch ' + (c.id === S.chapterId ? 'on' : ''), onclick: async () => { await save(); S.chapterId = c.id; rr(); } },
      h('span', { class: 'no' }, c.kind === 'chapter' ? S.proj.chapters.filter((x, j) => j <= i && x.kind === 'chapter').length : '·'),
      h('span', { class: 'tt' }, c.title), h('span', { class: 'wc' }, fmt(c.words)),
      h('span', { class: 'ctl' },
        h('button', { class: 'btn ghost sm', onclick: async (e) => { e.stopPropagation(); S.proj = await call('chapter:move', { id: c.id, to: i - 1 }); drawList(); } }, '▲'),
        h('button', { class: 'btn ghost sm', onclick: async (e) => { e.stopPropagation(); S.proj = await call('chapter:move', { id: c.id, to: i + 1 }); drawList(); } }, '▼')))));
  }

  async function save(autosave) {
    if (!cur || !dirty || !ta) return;
    const text = ta.value;
    const t = { ...tele }; tele = { typed: 0, deleted: 0 };
    dirty = false;
    try { const r = await call('chapter:write', { id: cur.id, text, telemetry: t, autosave: !!autosave }); const c = S.proj.chapters.find((x) => x.id === cur.id); if (c) c.words = r.words; wc.textContent = fmt(r.words) + ' מילים'; saved.textContent = 'נשמר ✓'; drawList(); } catch (e) { fail(e); }
  }
  const autosave = debounce(() => save(true), 1200);

  let ta, wc, saved;
  if (cur) {
    const text = await call('chapter:read', cur.id);
    ta = h('textarea', { class: 'body', spellcheck: 'true', lang: 'he', placeholder: 'כתבו כאן… הסגנון שלכם נלמד תוך כדי.', onbeforeinput: (e) => { if (e.inputType === 'insertText') tele.typed += (e.data || '').length; else if (/^delete/.test(e.inputType)) tele.deleted += 1; }, oninput: () => { dirty = true; saved.textContent = 'לא נשמר…'; wc.textContent = fmt((ta.value.match(/[\p{L}\p{N}]+/gu) || []).length) + ' מילים'; autosave(); } });
    ta.value = text;
    wc = h('span', {}, fmt(cur.words) + ' מילים'); saved = h('span', {}, 'נשמר ✓');
    const title = h('input', { class: 'title', type: 'text', value: cur.title, onchange: async (e) => { S.proj = await call('chapter:update', { id: cur.id, patch: { title: e.target.value } }); drawList(); } });
    const kind = select(Object.entries(KIND_LABEL), cur.kind, async (v) => { S.proj = await call('chapter:update', { id: cur.id, patch: { kind: v } }); drawList(); }, { style: 'width:140px' });
    const summary = h('input', { type: 'text', value: cur.summary || '', placeholder: 'תקציר קצר של הפרק (עוזר ל-AI ולעורך)', onchange: async (e) => { S.proj = await call('chapter:update', { id: cur.id, patch: { summary: e.target.value } }); }, style: 'margin:0 28px 4px;width:calc(100% - 56px)' });
    mid.append(h('div', { class: 'editor' }, h('div', { class: 'head' }, title, kind,
      h('button', { class: 'btn sm', onclick: async () => { const hs = await call('chapter:history', cur.id); if (!hs.length) return toast('אין גרסאות קודמות עדיין'); const picks = hs.slice(0, 12); const m = document.createElement('div'); await (await import('./lib.js')).modal('גרסאות קודמות', h('div', {}, picks.map((x) => h('div', { class: 'row', style: 'padding:6px 0;border-bottom:1px solid var(--line)' }, h('span', { class: 'grow small' }, x.name.replace(/__/g, ' · ').replace('.md', '')), h('button', { class: 'btn sm', onclick: async () => { ta.value = await call('chapter:restore', { id: cur.id, file: x.path }); dirty = false; toast('שוחזר', 'ok'); } }, 'שחזור')))), [{ label: 'סגירה' }]); } }, '↺ גרסאות'),
      h('button', { class: 'btn sm', onclick: async () => { if (confirm('להעביר את הפרק לפח?')) { S.proj = await call('chapter:remove', cur.id); S.chapterId = null; await refresh(); rr(); } } }, '🗑')), summary, ta,
      h('div', { class: 'status' }, wc, saved, h('span', { class: 'grow' }), h('span', {}, `הקלדה שנאספה ללמידת סגנון: ${fmt(S.proj.data.style.telemetry.typed)} תווים`))));
  } else mid.append(h('div', { class: 'empty' }, h('h3', {}, 'ברוכים הבאים'), h('p', {}, 'הוסיפו פרק ראשון והתחילו לכתוב. ככל שתכתבו יותר — פרופיל הסגנון יהיה מדויק יותר.'), h('button', { class: 'btn accent lg', onclick: addChapter }, 'פרק ראשון')));
  drawList();

  // ---- פאנל הקול ----
  const prof = p.data.style.profile;
  const vbox = h('div', { class: 'card', style: 'padding:14px' });
  const drawVoice = (m) => {
    vbox.innerHTML = '';
    vbox.append(h('h3', {}, 'הקול שלך'));
    if (!m || !m.ready) { vbox.append(h('div', { class: 'hint' }, m && m.note ? m.note : 'כתבו כמה פרקים ואז לחצו “נתח סגנון”. מומלץ לפחות 1,500 מילים.')); }
    else {
      const bar = (label, v, max, txt) => h('div', { class: 'meter' }, h('span', {}, label), h('div', { class: 'bar' }, h('i', { class: 'r', style: `width:${Math.min(100, (v / max) * 100)}%` })), h('span', { class: 'muted' }, txt ?? v));
      vbox.append(h('div', { class: 'row wrap', style: 'margin-bottom:6px' }, h('span', { class: 'pill teal' }, m.rhythm), h('span', { class: 'pill' }, 'רמת לשון: ' + m.register), h('span', { class: 'pill' }, fmt(m.totalWords) + ' מילים נותחו')),
        bar('אורך משפט', m.avgSentenceWords, 30, m.avgSentenceWords), bar('מגוון מילים', m.lexicalVariety, 60, m.lexicalVariety + '%'), bar('משפטים קצרים', m.shortSentenceShare, 60, m.shortSentenceShare + '%'), bar('דיאלוג', m.dialogueShare, 60, m.dialogueShare + '%'), bar('פסיקים /1000', m.punct.comma, 60, m.punct.comma), bar('פסקה (מילים)', m.avgParagraphWords, 200, m.avgParagraphWords),
        m.favoritePhrases.length ? h('div', { style: 'margin-top:8px' }, h('div', { class: 'small muted' }, 'צירופים חוזרים:'), h('div', { class: 'row wrap', style: 'gap:5px;margin-top:4px' }, m.favoritePhrases.slice(0, 8).map((f) => h('span', { class: 'pill' }, f.phrase)))) : null,
        S.proj.data.style.guide ? h('details', { style: 'margin-top:10px' }, h('summary', { class: 'small', style: 'cursor:pointer' }, 'מדריך קול (AI)'), h('div', { style: 'white-space:pre-wrap;font-size:14px;line-height:1.6;margin-top:6px' }, S.proj.data.style.guide)) : null);
    }
    vbox.append(h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn sm primary', onclick: async (e) => busy(e.currentTarget, async () => { await save(); const m2 = await call('style:analyze'); S.proj.data.style.profile = m2; drawVoice(m2); toast('הפרופיל עודכן', 'ok'); }) }, 'נתח סגנון'),
      h('button', { class: 'btn sm', onclick: async (e) => busy(e.currentTarget, async () => { await save(); const g = await call('style:guide'); S.proj.data.style.guide = g; drawVoice(S.proj.data.style.profile); }, 'מנתח…') }, 'מדריך קול (AI)')));
    [...vbox.childNodes].forEach((n) => { if (n.nodeType === 3 && n.textContent === 'null') n.remove(); });
  };
  drawVoice(prof);

  const brief = h('textarea', { rows: 4, placeholder: 'מה קורה בפרק? מי בו, מה משתנה, איזה רגש? (אפשר גם נקודות)' });
  const words = h('input', { type: 'number', value: 1200, min: 100, step: 100 });
  const draftBox = h('div');
  const aiCard = h('div', { class: 'card', style: 'padding:14px' }, h('h3', {}, 'כתבו איתי'), h('div', { class: 'hint', style: 'margin-bottom:8px' }, 'הטיוטה נכתבת בקול שלכם לפי הפרופיל, וממשיכה מסוף הפרק הקודם. אתם מחליטים אם לקבל.'),
    field('בריף לפרק', brief), field('אורך (מילים)', words),
    h('div', { class: 'row' }, h('button', { class: 'btn accent', id: 'wbtn', onclick: async (e) => { if (!cur) return toast('בחרו פרק', 'err'); await save(); await busy(e.currentTarget, async () => { const r = await call('ai:write', { id: cur.id, brief: brief.value, words: Number(words.value) }); showDraft(r.text); }, 'כותב…'); } }, '✎ כתוב טיוטה'), h('button', { class: 'btn sm', onclick: () => call('ai:cancel', 'write') }, 'ביטול')), draftBox);
  function showDraft(t) {
    draftBox.innerHTML = '';
    draftBox.append(h('div', { class: 'draft' }, t), h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { class: 'btn sm primary', onclick: async () => { ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n\n' : '') + t; dirty = true; await save(); draftBox.innerHTML = ''; toast('נוסף לסוף הפרק', 'ok'); } }, 'הוסף לסוף'),
      h('button', { class: 'btn sm', onclick: async () => { ta.value = t; dirty = true; await save(); draftBox.innerHTML = ''; toast('הפרק הוחלף (הגרסה הקודמת נשמרה בהיסטוריה)', 'ok'); } }, 'החלף את הפרק'),
      h('button', { class: 'btn sm ghost', onclick: () => { draftBox.innerHTML = ''; } }, 'התעלם')));
  }
  right.append(vbox, aiCard);
  window.addEventListener('beforeunload', () => save());
  root._cleanup = save;
}
