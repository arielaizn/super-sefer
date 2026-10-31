// שלבי העבודה: בניית פרומפטים (מבוססי מסמכי הידע), הרצה והחלת תוצאות
const fs = require('fs');
const path = require('path');
const { ask, tag, parseJSONLoose } = require('./engine');
const style = require('./style');
const heb = require('./hebrew');
const { KINDS } = require('./project');

function knowledgeDir() {
  const c = [path.join(__dirname, '..', '..', 'knowledge'), path.join(process.resourcesPath || '', 'knowledge')];
  return c.find((d) => fs.existsSync(d)) || c[0];
}
const K = (n) => { const f = fs.readdirSync(knowledgeDir()).find((x) => x.startsWith(n)); return fs.readFileSync(path.join(knowledgeDir(), f), 'utf8'); };

const STAGES = [
  { id: 'write', n: 1, label: 'כתיבה', icon: '✎' },
  { id: 'lit', n: 2, label: 'עריכה ספרותית', icon: '✐' },
  { id: 'ling', n: 3, label: 'עריכה לשונית', icon: 'א' },
  { id: 'proof', n: 4, label: 'הגהה', icon: '✓' },
  { id: 'layout', n: 5, label: 'עימוד', icon: '▤' },
  { id: 'postproof', n: 6, label: 'הגהה אחרי עימוד', icon: '⌕' },
  { id: 'cover', n: 7, label: 'עיצוב כריכה', icon: '▣' },
  { id: 'visual', n: 8, label: 'שפה גרפית ואיורים', icon: '❖' },
  { id: 'export', n: 9, label: 'ייצוא PDF', icon: '⇩' },
];

const SYSTEM = 'אתה עורך, מגיה ומעצב ספרים ישראלי מקצועי ברמה הגבוהה ביותר. אתה כותב ועובד בעברית תקנית ושוטפת. אתה שומר על קולו של המחבר/ת, פועל במינימום התערבות, ועונה אך ורק בפורמט שנדרש ממך, בלי הקדמות ובלי הסברים מיותרים.';

function styleBlock(project) {
  const m = project.data.style.profile;
  return style.toPromptBlock(m, { guide: project.data.style.guide });
}

// ---------- בניית פרומפטים ----------
function promptWrite(project, chapter, { brief = '', words = 1200 } = {}) {
  const idx = project.chapters().indexOf(chapter);
  const prev = idx > 0 ? project.readChapter(project.chapters()[idx - 1]) : '';
  const tail = prev.slice(-1800);
  const existing = project.readChapter(chapter);
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: כתיבת פרק בקול המחבר/ת', K('01-writing'),
      '# הקשר הספר', project.bookContext(),
      '# ' + 'טביעת האצבע של המחבר/ת', styleBlock(project),
      tail ? `# סוף הפרק הקודם (להמשכיות בקול/זמן/קצב)\n${tail}` : '',
      existing.trim() ? `# טיוטה/קטעים קיימים של הפרק (להמשיך או לשכתב בהתאם לבריף)\n${existing.slice(0, 6000)}` : '',
      `# הפרק לכתיבה\nכותרת: ${chapter.title}\nסוג: ${KINDS[chapter.kind] || chapter.kind}\nאורך יעד: כ־${words} מילים.\nבריף/הערות המחבר/ת: ${brief || chapter.summary || '(אין — כתבו לפי מבנה הספר והסיפור עד כה)'}`,
      'החזר את טקסט הפרק בלבד, ב-Markdown, בתוך התג <chapter>…</chapter>.',
    ].filter(Boolean).join('\n\n'),
  };
}

function promptLit(project, chapter) {
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: עריכה ספרותית (line edit) של פרק', K('02-literary'),
      '# הקשר הספר', project.bookContext(),
      '# טביעת האצבע של המחבר/ת (לשמר!)', styleBlock(project),
      `# הפרק לעריכה: ${chapter.title}\n\n<text>\n${project.readChapter(chapter)}\n</text>`,
      'החזר בדיוק בפורמט:\n<summary>2–3 משפטים למחבר/ת</summary>\n<findings>JSON: מערך של {"quote","type","severity","issue","suggestion"}</findings>\n<revised>הפרק המלא אחרי העריכה, Markdown, ללא שינוי בקול</revised>',
    ].join('\n\n'),
  };
}

function promptLing(project, chapter) {
  const text = project.readChapter(chapter);
  const lint = heb.summarize(heb.lintText(text));
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: עריכה לשונית של פרק (עברית)', K('03-linguistic'),
      '# הקשר הספר', project.bookContext(),
      '# טביעת האצבע של המחבר/ת (לשמר!)', styleBlock(project),
      `# סטטוס בדיקות טיפוגרפיות אוטומטיות (יתוקנו בנפרד, אל תתעסקו בהן): ${JSON.stringify(lint.byRule)}`,
      `# הפרק לעריכה: ${chapter.title}\n\n<text>\n${text}\n</text>`,
      'החזר בדיוק בפורמט:\n<findings>JSON: מערך של {"quote","fix","category","rule","confidence"}</findings>\n<queries>JSON: מערך מחרוזות — שאלות למחבר/ת</queries>\n<revised>הפרק המלא אחרי התיקון הלשוני, Markdown</revised>',
    ].join('\n\n'),
  };
}

// הגהה: חלונות עם דוח lint
function proofWindows(text, size = 2000) {
  const paras = text.split(/(\n{2,})/);
  const wins = [];
  let cur = '', start = 0, pos = 0;
  for (let i = 0; i < paras.length; i++) {
    const seg = paras[i];
    if (cur && (cur + seg).length > size && i % 2 === 0) { wins.push({ start, text: cur }); cur = ''; start = pos; }
    cur += seg; pos += seg.length;
  }
  if (cur.trim()) wins.push({ start, text: cur });
  return wins;
}

function promptProofWindow(project, chapter, win, i, n) {
  const issues = heb.lintText(win.text).filter((x) => x.severity !== 'info').slice(0, 20).map((x) => `${x.rule}: “${x.match}” (שורה ${x.line})`);
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: הגהה אות אחר אות', K('04-proofreading'),
      `# שם הספר: ${project.data.title}; פרק: ${chapter.title}; חלון ${i + 1}/${n}`,
      issues.length ? `# ממצאי הכלי האוטומטי בחלון (כבר יטופלו — אל תכפילו):\n- ${issues.join('\n- ')}` : '# הכלי האוטומטי לא מצא בעיות בחלון זה.',
      `<text>\n${win.text}\n</text>`,
      'עברו על הטקסט *מילה אחר מילה* ואות אחר אות. החזר בדיוק:\n<corrections>JSON: מערך של {"find","replace","reason"} — find חייב להיות מחרוזת מדויקת וייחודית מהטקסט (עם הקשר של 8–20 תווים)</corrections>\n<queries>JSON: מערך מחרוזות — ספקות</queries>\nאם הכול תקין: <corrections>[]</corrections>',
    ].join('\n\n'),
  };
}

function promptPostProof(project, report, frontText) {
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: הגהה אחרי עימוד (עמודי חזית וכותרות)', K('06-post-layout'),
      `# נתוני הספר: שם: ${project.data.title}; כותרת משנה: ${project.data.subtitle}; מחבר/ת: ${project.data.author}; הוצאה: ${project.data.publisher}; שנה: ${project.data.year}; ISBN: ${project.data.isbn}`,
      '# טקסט שחולץ מעמודי החזית ומתוכן העניינים ב-PDF:', frontText,
      '# דוח בדיקות אוטומטיות:', JSON.stringify(report.summary || report, null, 1).slice(0, 4000),
      'בדקו מילה־מילה: איות, התאמת כותרות, עקביות מול נתוני הספר. החזר:\n<report>JSON: {"passed":bool,"blockers":[{"page","issue","fix"}],"warnings":[...],"notes":[...]}</report>',
    ].join('\n\n'),
  };
}

function promptCover(project) {
  const d = project.data;
  const bible = d.visual.bible ? JSON.stringify(d.visual.bible) : '(עדיין אין שפה גרפית — הציעו כזו שתתאים)';
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: שלושה קונספטים לכריכה', K('07-cover'),
      '# הקשר הספר', project.bookContext(),
      `# תקציר לכריכה אחורית (אם קיים): ${d.cover.blurbSource || '(אין)'}`,
      `# שפה גרפית קיימת: ${bible}`,
      'החזר:\n<concepts>JSON: מערך של 3 קונספטים שונים באמת. כל אחד: {"name","rationale","layout":"classic|fullbleed|typographic|band|frame|arch","palette":{"bg","fg","accent","muted"},"fonts":{"title","body"},"title","subtitle","tagline","blurb","bio","imagePrompt","imageMode":"full|front|none"}. גופנים רק מהרשימה: Frank Ruhl Libre, David Libre, Noto Serif Hebrew, Miriam Libre, Bellefair, Heebo, Assistant, Rubik, Noto Sans Hebrew, Alef, Varela Round, Secular One, Suez One, Amatic SC. imagePrompt באנגלית, ללא טקסט בתמונה, עם מקום לכותרת.</concepts>',
    ].join('\n\n'),
  };
}

function promptVisual(project, brief = '') {
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: יצירת שפה גרפית אחידה (Style Bible) לספר', K('08-visual'),
      '# הקשר הספר', project.bookContext(),
      brief ? `# הנחיות המחבר/ת: ${brief}` : '',
      project.data.cover.design ? `# כריכה נוכחית: ${JSON.stringify({ palette: project.data.cover.design.palette, fonts: project.data.cover.design.fonts })}` : '',
      'החזר:\n<bible>JSON: {"name","mood","medium","palette":[{"name","hex","role"}],"lineQuality","composition","lighting","motifs":[],"characters":[{"name","description"}],"typographyPairing":{"title","body"},"stylePrefix","negative","chapterImageRatio","consistencyRules":[]}</bible>',
    ].filter(Boolean).join('\n\n'),
  };
}

function promptIllustration(project, chapter) {
  const b = project.data.visual.bible;
  return {
    system: SYSTEM,
    prompt: [
      '# משימה: תכנון איור לפרק', K('08-visual'),
      `# שפה גרפית (Style Bible): ${b ? JSON.stringify(b) : '(חסרה — צרו קודם שפה גרפית)'}`,
      `# הפרק: ${chapter.title}\n${chapter.summary || ''}\n\n${project.readChapter(chapter).slice(0, 5000)}`,
      'בחרו רגע ויזואלי אחד חזק שמייצג את הפרק (לא ספוילר מיותר). החזר:\n<illustration>JSON: {"scene","alt","caption","prompt"} — prompt באנגלית: stylePrefix מהשפה הגרפית מילה־במילה + תיאור הסצנה + קומפוזיציה + negative. ללא טקסט בתמונה.</illustration>',
    ].join('\n\n'),
  };
}

// ---------- הרצה ----------
function llmOpts(project, o = {}) {
  const e = project.data.engine;
  return { engine: o.engine || e.llm || 'claude', model: o.model || e.model || '', effort: o.effort || e.effort || '', signal: o.signal, onData: o.onData };
}

async function runWrite(project, chapter, o = {}) {
  const p = promptWrite(project, chapter, o);
  const out = await ask({ ...llmOpts(project, o), ...p });
  const text = (tag(out, 'chapter') || out).trim();
  return { text };
}

async function runLit(project, chapter, o = {}) {
  const p = promptLit(project, chapter);
  const out = await ask({ ...llmOpts(project, o), ...p });
  return { summary: tag(out, 'summary') || '', findings: parseJSONLoose(tag(out, 'findings')) || [], revised: (tag(out, 'revised') || '').trim(), raw: out };
}

async function runLing(project, chapter, o = {}) {
  const p = promptLing(project, chapter);
  const out = await ask({ ...llmOpts(project, o), ...p });
  return { findings: parseJSONLoose(tag(out, 'findings')) || [], queries: parseJSONLoose(tag(out, 'queries')) || [], revised: (tag(out, 'revised') || '').trim(), raw: out };
}

// הגהה מלאה: lint דטרמיניסטי + מעבר מודל לפי חלונות. מחזיר תיקונים שהוחלו ושאלות.
async function runProof(project, chapter, o = {}) {
  let text = project.readChapter(chapter);
  const before = heb.lintText(text);
  const fixed = heb.applyFixes(text, before, heb.SAFE_FIX_RULES);
  text = fixed.text;
  const wins = proofWindows(text);
  const applied = [], queries = [], rejected = [];
  if (o.ai !== false) {
    for (let i = 0; i < wins.length; i++) {
      o.onProgress && o.onProgress({ i, n: wins.length });
      const p = promptProofWindow(project, chapter, wins[i], i, wins.length);
      let out;
      try { out = await ask({ ...llmOpts(project, o), ...p }); } catch (e) { rejected.push({ window: i, error: e.message }); continue; }
      const corr = parseJSONLoose(tag(out, 'corrections')) || [];
      for (const c of corr) {
        if (!c || typeof c.find !== 'string' || typeof c.replace !== 'string' || c.find === c.replace) continue;
        const cnt = text.split(c.find).length - 1;
        if (cnt !== 1) { rejected.push({ ...c, why: cnt === 0 ? 'לא נמצא' : 'לא ייחודי' }); continue; }
        // הגנה: תיקון הגהה אינו אמור לשנות יותר מדי
        if (Math.abs(c.replace.length - c.find.length) > Math.max(12, c.find.length * 0.5)) { rejected.push({ ...c, why: 'שינוי גדול מדי להגהה' }); continue; }
        text = text.replace(c.find, () => c.replace);
        applied.push(c);
      }
      for (const q of parseJSONLoose(tag(out, 'queries')) || []) queries.push(q);
    }
  }
  return { text, autoFixed: fixed.fixed, applied, queries, rejected, remaining: heb.summarize(heb.lintText(text)) };
}

async function runCover(project, o = {}) {
  const p = promptCover(project);
  const out = await ask({ ...llmOpts(project, o), ...p });
  return parseJSONLoose(tag(out, 'concepts')) || [];
}
async function runVisual(project, brief, o = {}) {
  const p = promptVisual(project, brief);
  const out = await ask({ ...llmOpts(project, o), ...p });
  return parseJSONLoose(tag(out, 'bible'));
}
async function runIllustrationPlan(project, chapter, o = {}) {
  const p = promptIllustration(project, chapter);
  const out = await ask({ ...llmOpts(project, o), ...p });
  return parseJSONLoose(tag(out, 'illustration'));
}

// מדריך קול איכותני (מודל) על בסיס הטקסט שהוקלד
async function runStyleGuide(project, o = {}) {
  const m = project.data.style.profile;
  const texts = project.chapters().map((c) => project.readChapter(c)).filter((t) => t.trim());
  const sample = texts.join('\n\n').slice(0, 14000);
  const out = await ask({ ...llmOpts(project, o), system: SYSTEM, prompt: [
    '# משימה: מדריך קול איכותני', K('01-writing'),
    '# נתונים מדודים', style.toPromptBlock(m),
    '# טקסט של המחבר/ת', sample,
    'כתבו מדריך קול של 8–12 נקודות קצרות וקונקרטיות שמסביר איך המחבר/ת כותבים (קצב, מילים, בחירות, דימויים, מה הם אף פעם לא יעשו, מה סימן ההיכר). בעברית. החזר בתוך <guide>…</guide>.',
  ].join('\n\n') });
  return (tag(out, 'guide') || out).trim();
}

module.exports = { STAGES, SYSTEM, K, promptWrite, promptLit, promptLing, promptProofWindow, proofWindows, promptPostProof, promptCover, promptVisual, promptIllustration, runWrite, runLit, runLing, runProof, runCover, runVisual, runIllustrationPlan, runStyleGuide, styleBlock, llmOpts };
