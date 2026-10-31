import { h, call, toast, fail, busy, fmt, field, select, debounce, modal, fileUrl } from './lib.js';

export default async function render(root, ctx) {
  const { S, refresh, render: rr } = ctx;
  const d = S.proj.data;
  let bible = d.visual.bible ? JSON.parse(JSON.stringify(d.visual.bible)) : null;
  const saveBible = debounce(async () => { S.proj = await call('project:update', { visual: { bible } }); }, 500);
  const bibleBox = h('div', { class: 'card bible' });
  const brief = h('textarea', { rows: 3, placeholder: 'כיוון כללי (אופציונלי): למשל "צבעי מים רכים בגווני ים וחול, תחושת געגוע, בלי דמויות פנים"' });

  function drawBible() {
    bibleBox.innerHTML = '';
    bibleBox.append(h('div', { class: 'row' }, h('h3', { style: 'margin:0;flex:1' }, 'השפה הגרפית (Style Bible)'), bible ? h('span', { class: 'pill ok' }, 'פעילה לכל הספר') : null),
      h('div', { class: 'hint', style: 'margin:6px 0 10px' }, 'מסמך אחד שמכתיב צבע, מדיום, קו, קומפוזיציה ומוטיבים — וכל איור וכריכה נגזרים ממנו, כדי שייראו כמו יד אחת.'),
      field('כיוון', brief),
      h('button', { class: 'btn primary', onclick: async (e) => busy(e.currentTarget, async () => { bible = await call('ai:visual', { brief: brief.value }); S.proj = await call('project:view'); drawBible(); toast('השפה הגרפית נוצרה', 'ok'); }, 'מגבש שפה…') }, bible ? '↻ צור מחדש' : '✦ צור שפה גרפית'));
    if (!bible) return;
    const set = (k, v) => { bible[k] = v; saveBible(); };
    bibleBox.append(h('hr', { class: 'sep' }), h('div', { class: 'grid2' }, field('שם', h('input', { type: 'text', value: bible.name || '', onchange: (e) => set('name', e.target.value) })), field('מדיום', h('input', { type: 'text', value: bible.medium || '', onchange: (e) => set('medium', e.target.value) }))),
      field('אווירה', h('input', { type: 'text', value: bible.mood || '', onchange: (e) => set('mood', e.target.value) })),
      h('div', { class: 'field' }, h('label', { class: 'f' }, 'פלטת צבעים'), h('div', { class: 'palrow' }, (bible.palette || []).map((c, i) => h('div', { class: 'pal' }, h('input', { type: 'color', value: c.hex, style: 'width:30px;height:26px;padding:0;border:0;background:none', onchange: (e) => { bible.palette[i].hex = e.target.value; saveBible(); } }), h('span', { class: 'small' }, `${c.name || ''}${c.role ? ' · ' + c.role : ''}`))))),
      h('div', { class: 'grid2' }, field('אופי הקו', h('input', { type: 'text', value: bible.lineQuality || '', onchange: (e) => set('lineQuality', e.target.value) })), field('תאורה', h('input', { type: 'text', value: bible.lighting || '', onchange: (e) => set('lighting', e.target.value) }))),
      field('קומפוזיציה', h('input', { type: 'text', value: bible.composition || '', onchange: (e) => set('composition', e.target.value) })),
      field('מוטיבים חוזרים (מופרדים בפסיק)', h('input', { type: 'text', value: (bible.motifs || []).join(', '), onchange: (e) => set('motifs', e.target.value.split(',').map((x) => x.trim()).filter(Boolean)) })),
      field('Style prefix (אנגלית) — מועתק מילה במילה לכל פרומפט', h('textarea', { rows: 4, style: 'direction:ltr;text-align:left', onchange: (e) => set('stylePrefix', e.target.value) }, bible.stylePrefix || '')),
      field('Negative (אנגלית)', h('input', { type: 'text', style: 'direction:ltr;text-align:left', value: bible.negative || '', onchange: (e) => set('negative', e.target.value) })),
      field('יחס איורי פנים', select([['square', 'ריבוע'], ['landscape', 'רוחבי'], ['portrait', 'לאורך']], bible.chapterImageRatio || 'square', (v) => set('chapterImageRatio', v))),
      (bible.consistencyRules || []).length ? h('div', {}, h('b', { class: 'small' }, 'כללי עקביות'), h('ul', { style: 'padding-inline-start:18px;margin:4px 0' }, bible.consistencyRules.map((r) => h('li', { class: 'small' }, r)))) : null);
  }
  drawBible();

  // ---- איורים ----
  const imgChapters = S.proj.chapters.filter((c) => ['chapter', 'preface', 'foreword', 'intro', 'part', 'afterword'].includes(c.kind));
  const rows = h('div');
  const prog = h('div');
  async function genOne(c, auto) {
    const plan = await call('ai:illustrationPlan', { id: c.id });
    if (!plan || !plan.prompt) throw new Error('לא התקבלה תכנית איור');
    let prompt = plan.prompt;
    if (!auto) {
      const ta = h('textarea', { rows: 8, style: 'direction:ltr;text-align:left' }, prompt);
      const cap = h('input', { type: 'text', value: plan.caption || '' });
      const ok = await new Promise((res) => modal(`איור לפרק: ${c.title}`, h('div', {}, h('div', { class: 'hint', style: 'margin-bottom:8px' }, plan.scene || ''), field('פרומפט (אפשר לערוך)', ta), field('כיתוב מתחת לאיור (אופציונלי)', cap)), [{ label: 'צור איור', cls: 'accent', fn: () => { prompt = ta.value; plan.caption = cap.value; res(true); } }, { label: 'ביטול', fn: () => res(false) }]));
      if (!ok) return;
    }
    const r = await call('image:generate', { prompt, kind: 'ill', id: c.id, aspect: (bible && bible.chapterImageRatio) || 'square', useRef: true });
    await call('image:use', { kind: 'ill', id: c.id, rel: r.rel, plan: { ...plan, prompt }, placement: 'opener' });
    S.proj = await call('project:view');
  }
  function drawRows() {
    rows.innerHTML = '';
    if (!imgChapters.length) rows.append(h('div', { class: 'hint' }, 'אין פרקים לאיור.'));
    imgChapters.forEach((c0) => { const c = S.proj.chapters.find((x) => x.id === c0.id); const ill = c.illustration;
      rows.append(h('div', { class: 'row', style: 'padding:8px 0;border-bottom:1px solid var(--line)' },
        ill ? h('img', { src: fileUrl(S.proj.dir + '/' + ill.file), style: 'width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--line)' }) : h('div', { style: 'width:56px;height:56px;border-radius:8px;border:1px dashed var(--line2)' }),
        h('div', { class: 'grow' }, h('b', {}, c.title), h('div', { class: 'small muted' }, ill ? (ill.placement === 'full' ? 'עמוד שלם' : 'בפתיחת הפרק') + (ill.caption ? ' · ' + ill.caption : '') : 'ללא איור')),
        ill ? select([['opener', 'בפתיחת הפרק'], ['full', 'עמוד שלם']], ill.placement || 'opener', async (v) => { await call('image:use', { kind: 'ill', id: c.id, rel: ill.file, plan: ill, placement: v }); S.proj = await call('project:view'); }, { style: 'width:130px' }) : null,
        ill ? h('button', { class: 'btn sm ghost', onclick: async () => { await call('chapter:update', { id: c.id, patch: { illustration: null } }); S.proj = await call('project:view'); drawRows(); } }, 'הסר') : null,
        h('button', { class: 'btn sm ' + (ill ? '' : 'primary'), onclick: async (e) => busy(e.currentTarget, async () => { await genOne(c); drawRows(); drawGallery(); }, 'מצייר…') }, ill ? '↻ מחדש' : '✦ איור'))); });
  }
  const gal = h('div', { class: 'gal' });
  function drawGallery() {
    gal.innerHTML = '';
    const imgs = [...S.proj.data.visual.images].reverse();
    if (!imgs.length) gal.append(h('div', { class: 'hint' }, 'התמונות שנוצרו יופיעו כאן.'));
    imgs.forEach((i) => gal.append(h('div', { class: 'it ' + (S.proj.data.visual.referenceImage === i.file ? 'sel' : '') }, h('img', { src: fileUrl(S.proj.dir + '/' + i.file), onclick: () => call('shell:open', S.proj.dir + '/' + i.file) }),
      h('div', { class: 'cap' }, h('div', { class: 'small muted' }, i.kind === 'cover' ? 'כריכה' : i.kind === 'ill' ? 'איור' : 'תמונה'), h('button', { class: 'btn sm', onclick: async () => { await call('image:setRef', i.file); S.proj = await call('project:view'); drawGallery(); toast('נקבעה כתמונת ייחוס לסגנון', 'ok'); } }, S.proj.data.visual.referenceImage === i.file ? '★ ייחוס' : '☆ קבע כייחוס')))));
  }
  drawRows(); drawGallery();
  root.append(h('div', { class: 'grid2', style: 'align-items:start;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)' }, h('div', {}, bibleBox),
    h('div', {}, h('div', { class: 'card' }, h('div', { class: 'row' }, h('h3', { style: 'margin:0;flex:1' }, 'איורי פרקים'), h('button', { class: 'btn sm primary', onclick: async (e) => busy(e.currentTarget, async () => { for (const c of imgChapters) { if (S.proj.chapters.find((x) => x.id === c.id).illustration) continue; prog.textContent = `מצייר: ${c.title}…`; try { await genOne(c, true); } catch (er) { fail(er); break; } drawRows(); drawGallery(); } prog.textContent = ''; toast('הסתיים', 'ok'); }, 'מצייר את כולם…') }, 'צור לכל הפרקים')),
      h('div', { class: 'hint', style: 'margin:6px 0' }, 'האיורים נוצרים ב-Codex (כלי image_gen) במסגרת המנוי שלכם, עם תמונת הייחוס כעוגן סגנון. תהליך איור אחד אורך כדקה.'), prog, rows),
      h('div', { class: 'card' }, h('h3', {}, 'גלריה'), gal))));
}
