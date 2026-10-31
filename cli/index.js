#!/usr/bin/env node
// סופר-ספר CLI — שליטה מלאה בתהליך יצירת הספר מ-Claude Code, Codex או מהטרמינל.
// רץ כ-Node (ELECTRON_RUN_AS_NODE=1). משימות רינדור מועברות לתהליך Electron נסתר (--job).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const root = path.join(__dirname, '..');
const core = (m) => require(path.join(root, 'src', 'core', m));

const pkg = require(path.join(root, 'package.json'));

// ---------- ניתוח ארגומנטים ----------
function parse(argv) {
  const a = { _: [], f: {} };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) {
      const [k, v] = x.slice(2).split(/=(.*)/s);
      if (v !== undefined) a.f[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a.f[k] = argv[++i];
      else a.f[k] = true;
    } else a._.push(x);
  }
  return a;
}
const A = parse(process.argv.slice(2));
const JSON_OUT = !!A.f.json;
const out = (o, human) => { if (JSON_OUT) console.log(JSON.stringify(o, null, 1)); else console.log(human !== undefined ? human : (typeof o === 'string' ? o : JSON.stringify(o, null, 1))); };
const die = (m, code = 1) => { if (JSON_OUT) console.log(JSON.stringify({ error: m })); else console.error('שגיאה: ' + m); process.exit(code); };
const proj = () => { const { Project } = core('project'); return A.f.project ? Project.open(path.resolve(A.f.project)) : Project.find(process.cwd()); };
const readInput = () => { if (A.f.file) return fs.readFileSync(path.resolve(A.f.file), 'utf8'); if (A.f.text) return String(A.f.text); if (!process.stdin.isTTY) return fs.readFileSync(0, 'utf8'); return ''; };
const engOpts = () => ({ engine: A.f.engine, model: A.f.model, effort: A.f.effort });
const num = (v, d) => (v === undefined || v === true ? d : Number(v));

// ---------- משימות רינדור ----------
function renderJob(job) {
  return new Promise((resolve, reject) => {
    const jf = path.join(os.tmpdir(), `ss-job-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(jf, JSON.stringify({ ...job, result: jf + '.out' }));
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const args = [root, '--job', jf];
    const ch = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    ch.stdout.on('data', (d) => { const s = String(d); for (const l of s.split('\n')) { if (l.startsWith('@@progress ')) { if (!JSON_OUT) console.error('… ' + l.slice(11)); } } });
    let err = '';
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('close', (code) => {
      const rf = jf + '.out';
      try {
        const r = JSON.parse(fs.readFileSync(rf, 'utf8')); fs.rmSync(rf, { force: true }); fs.rmSync(jf, { force: true });
        if (r.error) reject(new Error(r.error)); else resolve(r.result);
      } catch { reject(new Error('הרינדור נכשל' + (err ? ': ' + err.split('\n').filter((l) => !/ERROR:|task_policy/.test(l)).slice(-5).join(' ') : ` (קוד ${code})`))); }
    });
  });
}

// ---------- עזרי הצגה ----------
const table = (rows) => rows.map((r) => r.join('  ')).join('\n');
const sevIcon = { error: '✖', warn: '▲', info: '·' };

const HELP = `סופר-ספר ${pkg.version} — יצירת ספרים מקצה לקצה

שימוש: sofer-sefer <פקודה> [אפשרויות]   (אפשר --json לפלט למכונה, --project <תיקייה>)

פרויקט
  new <תיקייה> --title "שם" --author "שם" [--genre prose|nonfiction|poetry|kids]
  status                       מצב הספר ושלבי העבודה
  chapters                     רשימת פרקים
  chapter add "כותרת" [--kind chapter|preface|foreword|intro|dedication|epigraph|afterword|acknowledgments|about] [--file f.md | --text "…"]
  chapter show <פרק>           (מספר/מזהה/כותרת)
  chapter set <פרק> [--title ..] [--summary ..] [--kind ..] [--file f.md]
  chapter rm <פרק> | chapter mv <פרק> <מיקום> | chapter history <פרק>
  import <file.md|txt> [--split]   ייבוא כתב־יד (פיצול לפי כותרות #)
  meta set key=value ...       פרטי הספר (title, subtitle, author, publisher, isbn, year, genre, audience, premise, tone)

1 כתיבה בקול שלך
  style analyze                בניית פרופיל סגנון מכל מה שהוקלד
  style show | style prompt    הצגת הפרופיל / בלוק הסגנון כפרומפט
  style guide [--engine claude|codex]   מדריך קול איכותני
  write <פרק> --brief "…" [--words 1200] [--apply]

2–3 עריכה
  edit lit <פרק> [--apply]     עריכה ספרותית
  edit ling <פרק> [--apply]    עריכה לשונית
4 הגהה
  proof lint [<פרק>|all] [--fix]   בדיקת תו־תו דטרמיניסטית (+ תיקון בטוח)
  proof ai <פרק> [--no-write]      מעבר הגהה מלא (כלי + מודל)
Agent mode (ל-Claude Code / Codex עצמם):
  prompt <write|lit|ling|proof|postproof|cover|visual|illustration> [<פרק>] [--brief ..]   מדפיס את הפרומפט המלא של השלב
  apply <write|lit|ling|proof> <פרק> --file result.md            כותב תוצאה לפרק (עם גיבוי גרסה)
  apply cover --file concepts.json | apply visual --file bible.json | apply guide --file guide.md

5 עימוד
  layout sizes                 גדלי ספר ונתוני נייר
  layout recommend [--trim a5] [--pages 200]
  layout set key=value ...     (trim, paper, binding, fontBody, fontHead, fontSans, fontSize, lineHeight, indent, justify, dropCap, chapterStart=recto|any, folio=center|outer|none, headerStyle=running|author|none, toc, halfTitle, titlePage, copyrightPage, padSignature, sceneBreak, margins.top …)
  layout fonts                 גופני עברית זמינים
  layout build [--out file.pdf]    מפיק PDF פנים הספר
6 הגהה אחרי עימוד
  postproof [--ai]             בדיקות נאמנות, עמודים, תוכן עניינים ומספור
7 כריכה
  cover concepts [--engine ..] שלושה קונספטים לכריכה
  cover set key=value ...      (layout, title, subtitle, author, tagline, blurb, bio, publisher, isbn, price, image, imageMode, palette.bg, palette.fg, palette.accent, fonts.title, fonts.body, spineDir)
  cover use <1|2|3>            בחירת קונספט
  cover build [--mode spread|pages] [--out f.pdf] [--guides]
  cover geometry [--pages N]   מידות כריכה ושדרה
8 שפה גרפית ואיורים
  visual bible [--brief "…"]   יצירת שפה גרפית (Style Bible)
  visual show
  illustrate <פרק|cover> [--prompt "…"] [--ref file] [--placement opener|full]
  image --prompt "…" --out file.png [--ref file] [--aspect square|portrait|landscape]
9 ייצוא
  export [--out תיקייה] [--both]   ברירת מחדל: ~/Downloads/<שם הספר>/
מערכת
  setup [--no-cli --no-claude --no-codex]   התקנת CLI ותוספים
  doctor                       בדיקת סביבה
  gui                          פתיחת האפליקציה
`;

// ---------- פקודות ----------
const cmds = {};

cmds.new = async () => {
  const { Project } = core('project');
  const dir = path.resolve(A._[1] || path.join(Project.defaultRoot(), A.f.title || 'ספר חדש'));
  const p = Project.create(dir, { title: A.f.title || path.basename(dir), author: A.f.author || '', genre: A.f.genre });
  out({ dir }, `נוצר פרויקט: ${dir}`);
  return p;
};

cmds.status = async () => {
  const p = proj(); const d = p.data;
  const lint = core('hebrew');
  let issues = 0;
  for (const c of p.chapters()) issues += lint.lintText(p.readChapter(c)).filter((i) => i.severity !== 'info').length;
  const o = { title: d.title, author: d.author, chapters: p.chapters().length, words: p.totalWords(), styleReady: !!(d.style.profile && d.style.profile.ready), styleWords: d.style.profile && d.style.profile.totalWords, lintIssues: issues, bible: !!d.visual.bible, coverDesign: !!d.cover.design, layout: d.stages.layout || null, postproof: d.stages.postproof || null, export: d.stages.export || null, engine: d.engine };
  out(o, `📖 ${d.title}${d.subtitle ? ' — ' + d.subtitle : ''}\nמחבר/ת: ${d.author || '—'}\nפרקים: ${o.chapters} · מילים: ${o.words}\nפרופיל סגנון: ${o.styleReady ? 'מוכן (' + o.styleWords + ' מילים)' : 'טרם נבנה'}\nבעיות הגהה אוטומטיות פתוחות: ${issues}\nשפה גרפית: ${o.bible ? 'קיימת' : 'אין'} · עיצוב כריכה: ${o.coverDesign ? 'קיים' : 'אין'}\nעימוד: ${o.layout ? o.layout.pages + ' עמודים (' + o.layout.at.slice(0, 16) + ')' : 'לא נבנה'} · הגהה אחרי עימוד: ${o.postproof ? (o.postproof.passed ? 'עברה' : 'יש חסמים') : 'לא הורצה'}\nייצוא אחרון: ${o.export ? o.export.dir : '—'}`);
};

cmds.chapters = async () => {
  const p = proj();
  const rows = p.chapters().map((c, i) => [String(i + 1).padStart(2), c.id, (c.kind || '').padEnd(14), String(c.words || 0).padStart(6) + ' מילים', c.title]);
  out(p.chapters().map((c, i) => ({ n: i + 1, id: c.id, kind: c.kind, title: c.title, words: c.words, summary: c.summary })), rows.length ? table(rows) : 'אין פרקים עדיין. sofer-sefer chapter add "כותרת"');
};

cmds.chapter = async () => {
  const p = proj(); const sub = A._[1];
  if (sub === 'add') {
    const text = A.f.file || A.f.text ? readInput() : '';
    const c = p.addChapter({ title: A._[2], kind: A.f.kind || 'chapter', text, summary: A.f.summary || '' });
    return out(c, `נוסף: ${c.title} (${c.id})`);
  }
  const ref = A._[2];
  if (sub === 'show') { const c = p.chapter(ref); return console.log(p.readChapter(c)); }
  if (sub === 'set') {
    const c = p.chapter(ref);
    if (A.f.title) c.title = A.f.title; if (A.f.summary) c.summary = A.f.summary; if (A.f.kind) c.kind = A.f.kind;
    if (A.f.file || A.f.text) p.writeChapter(c, readInput(), { reason: 'cli-set' });
    p.save(); return out(c, 'עודכן');
  }
  if (sub === 'rm') { p.removeChapter(ref); return out({ ok: true }, 'הפרק הועבר לפח (.trash)'); }
  if (sub === 'mv') { p.moveChapter(ref, Number(A._[3]) - 1); return out({ ok: true }, 'הועבר'); }
  if (sub === 'history') return out(p.history(ref), p.history(ref).map((h) => h.name).join('\n'));
  die('שימוש: chapter add|show|set|rm|mv|history');
};

cmds.import = async () => {
  const p = proj(); const f = A._[1]; if (!f) die('חסר קובץ');
  const txt = fs.readFileSync(path.resolve(f), 'utf8');
  const parts = A.f.split ? txt.split(/^(?=#\s+)/m).filter((s) => s.trim()) : [txt];
  const added = parts.map((s, i) => { const m = s.match(/^#\s+(.+)\n/); return p.addChapter({ title: m ? m[1].trim() : (A.f.title || path.basename(f, path.extname(f))) + (parts.length > 1 ? ' ' + (i + 1) : ''), text: m ? s.slice(m[0].length).trim() + '\n' : s }); });
  out(added.map((c) => c.id), `יובאו ${added.length} פרקים`);
};

cmds.meta = async () => {
  const p = proj();
  if (A._[1] === 'set') { for (const kv of A._.slice(2)) { const [k, ...v] = kv.split('='); p.data[k] = v.join('='); } p.save(); }
  const d = p.data; out({ title: d.title, subtitle: d.subtitle, author: d.author, publisher: d.publisher, isbn: d.isbn, year: d.year, genre: d.genre, audience: d.audience, premise: d.premise, tone: d.tone });
};

cmds.style = async () => {
  const p = proj(); const S = core('style'); const sub = A._[1] || 'show';
  const texts = () => p.chapters().filter((c) => !['dedication', 'epigraph'].includes(c.kind)).map((c) => p.readChapter(c)).filter((t) => t.trim());
  if (sub === 'analyze') {
    const m = S.analyze(texts(), p.data.style.telemetry); p.data.style.profile = m; p.data.style.profileAt = new Date().toISOString(); p.save();
    return out(m, m.ready ? S.toPromptBlock(m) : m.note);
  }
  if (sub === 'guide') { const st = core('stages'); if (!p.data.style.profile) p.data.style.profile = S.analyze(texts(), p.data.style.telemetry); const g = await st.runStyleGuide(p, engOpts()); p.data.style.guide = g; p.save(); return out({ guide: g }, g); }
  if (sub === 'prompt') return console.log(S.toPromptBlock(p.data.style.profile, { guide: p.data.style.guide }));
  out(p.data.style.profile || { ready: false }, p.data.style.profile ? S.toPromptBlock(p.data.style.profile, { guide: p.data.style.guide }) : 'אין פרופיל. הריצו style analyze');
};

cmds.write = async () => {
  const p = proj(); const st = core('stages'); const c = p.chapter(A._[1]);
  const r = await st.runWrite(p, c, { brief: A.f.brief || '', words: num(A.f.words, 1200), ...engOpts() });
  if (A.f.apply) { p.writeChapter(c, r.text, { reason: 'ai-write' }); p.setStage(c, 'write', { ai: true }); }
  out(r, r.text + (A.f.apply ? '\n\n✔ נשמר (גרסה קודמת בהיסטוריה)' : '\n\n(לא נשמר — הוסיפו --apply)'));
};

cmds.edit = async () => {
  const p = proj(); const st = core('stages'); const kind = A._[1]; const c = p.chapter(A._[2]);
  if (kind === 'lit') {
    const r = await st.runLit(p, c, engOpts());
    if (A.f.apply && r.revised) { p.writeChapter(c, r.revised + '\n', { reason: 'ai-lit' }); p.setStage(c, 'lit', { findings: r.findings.length }); }
    return out(r, `${r.summary}\n\nממצאים (${r.findings.length}):\n` + r.findings.map((f, i) => `${i + 1}. [${f.severity}] ${f.type}: ${f.issue}\n   “${(f.quote || '').slice(0, 80)}” → ${f.suggestion}`).join('\n') + (A.f.apply ? '\n\n✔ הנוסח המתוקן נשמר' : '\n\n(לא נשמר — הוסיפו --apply)'));
  }
  if (kind === 'ling') {
    const r = await st.runLing(p, c, engOpts());
    if (A.f.apply && r.revised) { p.writeChapter(c, r.revised + '\n', { reason: 'ai-ling' }); p.setStage(c, 'ling', { findings: r.findings.length }); }
    return out(r, `תיקונים (${r.findings.length}):\n` + r.findings.map((f, i) => `${i + 1}. ${f.category}: “${(f.quote || '').slice(0, 60)}” → “${(f.fix || '').slice(0, 60)}” (${f.rule || ''})`).join('\n') + (r.queries.length ? '\n\nשאלות למחבר/ת:\n- ' + r.queries.join('\n- ') : '') + (A.f.apply ? '\n\n✔ נשמר' : '\n\n(לא נשמר — הוסיפו --apply)'));
  }
  die('edit lit|ling <פרק>');
};

cmds.proof = async () => {
  const p = proj(); const H = core('hebrew'); const sub = A._[1] || 'lint';
  if (sub === 'lint') {
    const target = A._[2] || 'all';
    const list = target === 'all' ? p.chapters() : [p.chapter(target)];
    const all = []; let fixedTotal = 0;
    for (const c of list) {
      let text = p.readChapter(c); let issues = H.lintText(text);
      if (A.f.fix) { const r = H.applyFixes(text, issues, A.f.rules ? String(A.f.rules).split(',') : H.SAFE_FIX_RULES); if (r.fixed) { p.writeChapter(c, r.text, { reason: 'proof-fix' }); fixedTotal += r.fixed; text = r.text; issues = H.lintText(text); } }
      issues.forEach((i) => all.push({ chapter: c.title, ...i }));
      p.setStage(c, 'proof', { lint: H.summarize(issues) });
    }
    const sum = H.summarize(all);
    return out({ summary: sum, fixed: fixedTotal, issues: all }, (A.f.fix ? `תוקנו ${fixedTotal} מקרים.\n` : '') + `נמצאו ${sum.total} (שגיאות ${sum.errors}, אזהרות ${sum.warns}, מידע ${sum.infos})\n` + all.filter((i) => i.severity !== 'info' || A.f.all).slice(0, num(A.f.limit, 60)).map((i) => `${sevIcon[i.severity]} ${i.chapter}:${i.line}:${i.col} [${i.rule}] ${i.message} “${i.match.replace(/\n/g, ' ')}”${i.fix !== null ? ' → “' + i.fix + '”' : ''}`).join('\n'));
  }
  if (sub === 'ai') {
    const st = core('stages'); const c = p.chapter(A._[2]);
    const r = await st.runProof(p, c, { ...engOpts(), onProgress: (x) => !JSON_OUT && console.error(`… חלון ${x.i + 1}/${x.n}`) });
    if (!A.f['no-write']) { p.writeChapter(c, r.text, { reason: 'ai-proof' }); p.setStage(c, 'proof', { ai: true, applied: r.applied.length }); }
    return out(r, `תיקון אוטומטי: ${r.autoFixed} · תיקוני מודל: ${r.applied.length} · נדחו: ${r.rejected.length}\n` + r.applied.map((a) => `• “${a.find}” → “${a.replace}” (${a.reason || ''})`).join('\n') + (r.queries.length ? '\n\nשאלות:\n- ' + r.queries.join('\n- ') : ''));
  }
  die('proof lint|ai');
};

cmds.prompt = async () => {
  const p = proj(); const st = core('stages'); const stage = A._[1]; const ref = A._[2];
  let r;
  if (stage === 'write') r = st.promptWrite(p, p.chapter(ref), { brief: A.f.brief || '', words: num(A.f.words, 1200) });
  else if (stage === 'lit') r = st.promptLit(p, p.chapter(ref));
  else if (stage === 'ling') r = st.promptLing(p, p.chapter(ref));
  else if (stage === 'proof') { const c = p.chapter(ref); const w = st.proofWindows(p.readChapter(c)); const i = num(A.f.window, 0); r = st.promptProofWindow(p, c, w[i], i, w.length); }
  else if (stage === 'cover') r = st.promptCover(p);
  else if (stage === 'visual') r = st.promptVisual(p, A.f.brief || '');
  else if (stage === 'illustration') r = st.promptIllustration(p, p.chapter(ref));
  else if (stage === 'postproof') { const rep = A.f.report ? JSON.parse(fs.readFileSync(A.f.report, 'utf8')) : {}; r = st.promptPostProof(p, rep, A.f.front ? fs.readFileSync(A.f.front, 'utf8') : ''); }
  else die('שלב לא מוכר');
  console.log(JSON_OUT ? JSON.stringify(r) : `${r.system}\n\n${r.prompt}`);
};

cmds.apply = async () => {
  const p = proj(); const what = A._[1]; const { parseJSONLoose, tag } = core('engine');
  const raw = readInput();
  if (['write', 'lit', 'ling', 'proof'].includes(what)) {
    const c = p.chapter(A._[2]); const t = (tag(raw, 'chapter') || tag(raw, 'revised') || raw).trim();
    p.writeChapter(c, t + '\n', { reason: 'agent-' + what }); p.setStage(c, what, { agent: true });
    return out({ ok: true, words: c.words }, `נשמר: ${c.title} (${c.words} מילים). הגרסה הקודמת בהיסטוריה.`);
  }
  if (what === 'cover') { const j = parseJSONLoose(tag(raw, 'concepts') || raw); p.data.cover.concepts = j; p.save(); return out({ concepts: j.length }, `נשמרו ${j.length} קונספטים`); }
  if (what === 'visual') { const j = parseJSONLoose(tag(raw, 'bible') || raw); p.data.visual.bible = j; p.save(); return out({ ok: true }, 'שפה גרפית נשמרה'); }
  if (what === 'guide') { p.data.style.guide = (tag(raw, 'guide') || raw).trim(); p.save(); return out({ ok: true }, 'מדריך קול נשמר'); }
  die('apply write|lit|ling|proof|cover|visual|guide');
};

cmds.layout = async () => {
  const p = proj(); const F = core('formats'); const sub = A._[1] || 'show'; const L = p.data.layout;
  if (sub === 'sizes') return out({ trims: F.TRIMS, papers: F.PAPERS, bindings: F.BINDINGS }, F.TRIMS.map((t) => `${t.id.padEnd(10)} ${String(t.w).padStart(5)}×${String(t.h).padEnd(5)} ${t.label} — ${t.use}`).join('\n') + '\n\nניירות:\n' + F.PAPERS.map((x) => `${x.id.padEnd(16)} ${x.mm} מ״מ/עמוד  ${x.label}`).join('\n'));
  if (sub === 'recommend') { const r = F.recommend(A.f.trim || L.trim, num(A.f.pages, 200), p.data.genre); return out(r, `שוליים (מ״מ): עליון ${r.margins.top}, תחתון ${r.margins.bottom}, פנימי ${r.margins.inner}, חיצוני ${r.margins.outer}\nגופן ${r.fontSize}pt, ריווח ${r.lineHeight}, ~${r.charsPerLine} תווים בשורה\n` + r.notes.join('\n')); }
  if (sub === 'fonts') { const l = core('layout').fontList(); return out(l, l.map((f) => `${f.kind.padEnd(8)} ${f.name} (${f.label})`).join('\n')); }
  if (sub === 'set') {
    for (const kv of A._.slice(2)) {
      const [k, ...rest] = kv.split('='); let v = rest.join('='); if (v === 'true') v = true; else if (v === 'false') v = false; else if (v !== '' && !isNaN(v)) v = Number(v);
      if (k.startsWith('margins.')) { L.margins = L.margins || {}; L.margins[k.slice(8)] = v; } else L[k] = v;
    }
    p.save();
  }
  if (sub === 'build') {
    const r = await renderJob({ type: 'interior', dir: p.dir, out: A.f.out ? path.resolve(A.f.out) : undefined });
    return out(r, `✔ ${r.file}\n${r.pages} עמודים (${r.frontCount} חזית${r.padPages ? ', ' + r.padPages + ' עמודי ריפוד' : ''})` + (r.warnings.length ? '\n▲ ' + r.warnings.join('\n▲ ') : ''));
  }
  out(L);
};

cmds.postproof = async () => {
  const p = proj();
  const r = await renderJob({ type: 'postproof', dir: p.dir });
  let ai = null;
  if (A.f.ai) { const st = core('stages'); const { ask, tag, parseJSONLoose } = core('engine'); const pr = st.promptPostProof(p, r, r.frontText); const o = await ask({ ...st.llmOpts(p, engOpts()), ...pr }); ai = parseJSONLoose(tag(o, 'report')); }
  const fmt = (l) => l.map((x) => `  • ${x.page ? 'עמ׳ ' + x.page + ': ' : ''}${x.issue}${x.fix ? ' → ' + x.fix : ''}`).join('\n');
  out({ ...r, frontText: undefined, ai }, `${r.passed ? '✔ עבר' : '✖ יש חסמים'} — ${r.pages} עמודים · נאמנות טקסט: ${r.fidelity.matched}/${r.fidelity.paragraphs} פסקאות (${r.fidelity.reorderedBidi} עם סדר כיווניות שונה, ${r.fidelity.missing} חסרות)\n${r.blockers.length ? 'חסמים:\n' + fmt(r.blockers) + '\n' : ''}${r.warnings.length ? 'אזהרות:\n' + fmt(r.warnings) + '\n' : ''}${r.notes.length ? 'הערות:\n' + fmt(r.notes) : ''}${ai ? '\n\nבדיקת מודל:\n' + JSON.stringify(ai, null, 1) : ''}`);
};

cmds.cover = async () => {
  const p = proj(); const C = core('cover'); const sub = A._[1] || 'show'; const cv = p.data.cover;
  const getDesign = () => cv.design || C.defaultDesign(p);
  if (sub === 'concepts') { const st = core('stages'); const c = await st.runCover(p, engOpts()); cv.concepts = c; p.save(); return out(c, c.map((x, i) => `${i + 1}. ${x.name} [${x.layout}] — ${x.rationale}\n   כותרת: ${x.title} | תמונה: ${(x.imagePrompt || '').slice(0, 90)}`).join('\n') + '\n\nבחירה: sofer-sefer cover use <מספר>'); }
  if (sub === 'use') { const c = cv.concepts[Number(A._[2]) - 1]; if (!c) die('קונספט לא קיים'); cv.design = { ...C.defaultDesign(p), ...c, imageMode: c.imageMode }; p.save(); return out(cv.design, 'קונספט נבחר'); }
  if (sub === 'set') {
    const d = getDesign();
    for (const kv of A._.slice(2)) { const [k, ...r] = kv.split('='); let v = r.join('='); if (v === 'true') v = true; else if (v === 'false') v = false; else if (v !== '' && !isNaN(v) && !/isbn/i.test(k)) v = Number(v); const parts = k.split('.'); let o = d; while (parts.length > 1) { const q = parts.shift(); o[q] = o[q] || {}; o = o[q]; } o[parts[0]] = v; }
    cv.design = d; p.save(); return out(d, 'עודכן');
  }
  if (sub === 'geometry') { const pages = num(A.f.pages, (p.data.stages.layout && p.data.stages.layout.pages) || 200); const g = C.geoFor(p, pages); return out(g, `חיתוך ${g.trimW}×${g.trimH} מ״מ · שדרה ${g.spine} מ״מ · בליד ${g.bleed} · פריסה ${g.totalW}×${g.totalH} מ״מ (ל-${pages} עמודים)`); }
  if (sub === 'build') {
    const r = await renderJob({ type: 'cover', dir: p.dir, out: A.f.out ? path.resolve(A.f.out) : undefined, mode: A.f.mode, pages: A.f.pages && Number(A.f.pages), guides: !!A.f.guides });
    return out(r, `✔ ${r.file}\nפריסה ${r.geometry.totalW}×${r.geometry.totalH} מ״מ, שדרה ${r.geometry.spine} מ״מ` + (r.dpi ? `\nרזולוציית תמונה: ${r.dpi.dpi} DPI — ${r.dpi.level}` : ''));
  }
  out(getDesign());
};

cmds.visual = async () => {
  const p = proj(); const sub = A._[1] || 'show';
  if (sub === 'bible') { const st = core('stages'); const b = await st.runVisual(p, A.f.brief || '', engOpts()); if (!b) die('לא התקבלה שפה גרפית תקינה'); p.data.visual.bible = b; p.save(); return out(b, `✔ שפה גרפית: ${b.name}\n${b.mood}\nסגנון: ${b.medium}\nפלטה: ${(b.palette || []).map((c) => c.hex).join(' ')}`); }
  out(p.data.visual.bible || { bible: null }, p.data.visual.bible ? JSON.stringify(p.data.visual.bible, null, 1) : 'אין שפה גרפית. visual bible');
};

cmds.image = async () => {
  const { generateImage } = core('images');
  const o = path.resolve(A.f.out || 'image.png');
  const r = await generateImage({ prompt: A.f.prompt, out: o, refs: A.f.ref ? [].concat(A.f.ref).map((x) => path.resolve(x)) : [], aspect: A.f.aspect || 'square', model: A.f.model || 'gpt-image-2.5', onLog: (t) => !JSON_OUT && console.error('… ' + t.slice(0, 100)) });
  out(r, `✔ ${r.file} (${r.size ? r.size.w + '×' + r.size.h : ''})`);
};

cmds.illustrate = async () => {
  const p = proj(); const st = core('stages'); const { generateImage } = core('images'); const target = A._[1];
  const refs = A.f.ref ? [path.resolve(A.f.ref)] : (p.data.visual.referenceImage ? [p.p(p.data.visual.referenceImage)] : []);
  const model = p.data.engine.imageModel || 'gpt-image-2.5';
  if (target === 'cover') {
    const d = p.data.cover.design || core('cover').defaultDesign(p);
    const prompt = A.f.prompt || d.imagePrompt || (p.data.cover.concepts[0] || {}).imagePrompt; if (!prompt) die('חסר פרומפט: --prompt או קונספט כריכה');
    const rel = `assets/cover-${Date.now()}.png`;
    const r = await generateImage({ prompt: (p.data.visual.bible ? p.data.visual.bible.stylePrefix + ' ' : '') + prompt, out: p.p(rel), refs, aspect: 'cover', model, onLog: (t) => !JSON_OUT && console.error('… ' + t.slice(0, 90)) });
    p.data.cover.design = { ...d, image: rel }; if (!p.data.visual.referenceImage) p.data.visual.referenceImage = rel; p.save();
    return out(r, `✔ תמונת כריכה: ${rel} (${r.size ? r.size.w + '×' + r.size.h : ''})`);
  }
  const c = p.chapter(target);
  let plan = A.f.prompt ? { prompt: A.f.prompt, alt: c.title, caption: '' } : await st.runIllustrationPlan(p, c, engOpts());
  if (!plan || !plan.prompt) die('לא נוצרה תכנית איור');
  const rel = `assets/ill-${c.id}-${Date.now()}.png`;
  const r = await generateImage({ prompt: plan.prompt, out: p.p(rel), refs, aspect: p.data.visual.bible && p.data.visual.bible.chapterImageRatio === 'landscape' ? 'landscape' : 'square', model, onLog: (t) => !JSON_OUT && console.error('… ' + t.slice(0, 90)) });
  c.illustration = { file: rel, alt: plan.alt || c.title, caption: plan.caption || '', placement: A.f.placement || 'opener', prompt: plan.prompt };
  if (!p.data.visual.referenceImage) p.data.visual.referenceImage = rel; p.save();
  out({ ...r, plan }, `✔ איור לפרק “${c.title}”: ${rel}`);
};

cmds.export = async () => {
  const p = proj();
  const r = await renderJob({ type: 'export', dir: p.dir, out: A.f.out ? path.resolve(A.f.out) : undefined, both: !!A.f.both });
  out(r, `✔ יוצא אל ${r.dir}\n  פנים הספר: ${path.basename(r.interior.file)} (${r.interior.pages} עמודים)\n  כריכה: ${path.basename(r.cover.file)} (שדרה ${r.cover.geometry.spine} מ״מ)` + (r.cover.dpi ? `\n  רזולוציית תמונת כריכה: ${r.cover.dpi.dpi} DPI — ${r.cover.dpi.level}` : ''));
};

cmds.setup = async () => {
  const I = core('install');
  const r = I.setup({ cli: !A.f['no-cli'], claude: !A.f['no-claude'], codex: !A.f['no-codex'], ccplugin: !A.f['no-codex-plugin-cc'], log: (m) => !JSON_OUT && console.error('… ' + m.slice(0, 200)) });
  out(r, 'ההתקנה הושלמה:\n' + JSON.stringify(r, null, 1));
};
cmds.doctor = async () => { const d = core('install').doctor(); out(d, Object.entries(d).map(([k, v]) => `${k.padEnd(14)} ${v}`).join('\n')); };
cmds.gui = async () => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  spawn(process.execPath, [root, ...(A._[1] ? [path.resolve(A._[1])] : [])], { env, detached: true, stdio: 'ignore' }).unref();
  out({ ok: true }, 'פותח את סופר-ספר…');
};
cmds.version = async () => out({ version: pkg.version }, pkg.version);
cmds.help = async () => console.log(HELP);

(async () => {
  const c = A._[0];
  if (!c || c === 'help' || A.f.help || A.f.h) return console.log(HELP);
  if (c === '--version' || A.f.version) return console.log(pkg.version);
  const fn = cmds[c];
  if (!fn) { console.error(`פקודה לא מוכרת: ${c}\n`); console.log(HELP); process.exit(2); }
  try { await fn(); } catch (e) { die(e.message || String(e)); }
})();
