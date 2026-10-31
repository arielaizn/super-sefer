// מודל הפרויקט: תיקייה על הדיסק עם project.json, פרקים כקבצי Markdown והיסטוריית גרסאות
const fs = require('fs');
const path = require('path');
const os = require('os');

const FILE = 'ספר.json';
const KINDS = {
  chapter: 'פרק', part: 'חלק', preface: 'פתח דבר', foreword: 'הקדמה', intro: 'מבוא', dedication: 'הקדשה', epigraph: 'מוטו',
  afterword: 'אחרית דבר', acknowledgments: 'תודות', about: 'על המחברת/המחבר', notes: 'הערות', appendix: 'נספח',
};
// סוגים שמופיעים בתוכן העניינים וכותרתם מוצגת
const NO_TOC = new Set(['dedication', 'epigraph']);

function defaults(title = 'ספר חדש', author = '') {
  return {
    version: 1,
    id: 'b' + Date.now().toString(36),
    title, subtitle: '', author, publisher: '', year: String(new Date().getFullYear()), isbn: '', language: 'he',
    genre: 'prose', audience: '', premise: '', tone: '',
    createdAt: new Date().toISOString(),
    chapters: [],
    style: { telemetry: { typed: 0, deleted: 0, sessions: 0 }, profileAt: null },
    layout: {
      trim: 'il-trade', customW: 148, customH: 210, paper: 'offset-80', binding: 'soft',
      margins: null, fontBody: 'Frank Ruhl Libre', fontHead: 'Frank Ruhl Libre', fontSans: 'Heebo', fontSize: null, lineHeight: null, weightBody: 400,
      justify: true, indent: 1.1, dropCap: false, chapterStart: 'recto', chapterTopSpace: 28, headerStyle: 'running', folio: 'bottom-center',
      sceneBreak: '❦', toc: true, halfTitle: true, titlePage: true, copyrightPage: true, padSignature: true, pageStart: 'body',
      orphans: 2, widows: 2, hangingQuotes: false, imagesInline: true, copyrightText: '', colophon: '',
    },
    cover: { design: null, concepts: [], image: null, backImage: null, spineText: true, spineDir: 'ttb', barcode: true, pagesMode: 'spread', bleed: null },
    visual: { bible: null, images: [], referenceImage: null },
    engine: { llm: 'claude', model: '', image: 'codex', imageModel: 'gpt-image-2.5', effort: '' },
    stages: {},
    log: [],
  };
}

function slug(s) { return String(s).trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40) || 'פרק'; }

class Project {
  constructor(dir, data) { this.dir = dir; this.data = data; }

  static defaultRoot() { return path.join(os.homedir(), 'Documents', 'סופר-ספר'); }

  static create(dir, { title, author, genre, ...rest } = {}) {
    if (fs.existsSync(path.join(dir, FILE))) throw new Error('כבר קיים פרויקט בתיקייה: ' + dir);
    fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
    const data = defaults(title, author);
    if (genre) data.genre = genre;
    Object.assign(data, rest);
    const p = new Project(dir, data);
    p.save();
    return p;
  }

  static open(dir) {
    const f = path.join(dir, FILE);
    if (!fs.existsSync(f)) throw new Error('לא נמצא פרויקט סופר-ספר בתיקייה: ' + dir);
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    const d = defaults();
    const data = { ...d, ...raw, layout: { ...d.layout, ...(raw.layout || {}) }, cover: { ...d.cover, ...(raw.cover || {}) }, visual: { ...d.visual, ...(raw.visual || {}) }, engine: { ...d.engine, ...(raw.engine || {}) }, style: { ...d.style, ...(raw.style || {}) } };
    return new Project(dir, data);
  }

  // מחפש פרויקט מהתיקייה הנוכחית כלפי מעלה
  static find(start = process.cwd()) {
    let d = path.resolve(start);
    for (;;) {
      if (fs.existsSync(path.join(d, FILE))) return Project.open(d);
      const up = path.dirname(d);
      if (up === d) throw new Error('לא נמצא פרויקט סופר-ספר (אין קובץ ' + FILE + '). הריצו: sofer-sefer new <תיקייה>');
      d = up;
    }
  }

  save() {
    const tmp = path.join(this.dir, FILE + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, path.join(this.dir, FILE));
  }

  p(...a) { return path.join(this.dir, ...a); }
  log(msg, stage) { this.data.log.push({ t: new Date().toISOString(), stage: stage || null, msg }); this.data.log = this.data.log.slice(-300); this.save(); }

  // ---- פרקים ----
  chapters() { return this.data.chapters; }
  chapter(ref) {
    const cs = this.data.chapters;
    if (ref == null || ref === '') throw new Error('חסר מזהה פרק');
    const n = Number(ref);
    if (Number.isInteger(n) && String(n) === String(ref).trim() && n >= 1 && n <= cs.length) return cs[n - 1];
    const c = cs.find((c) => c.id === ref || c.title === ref || c.file === ref);
    if (!c) throw new Error('פרק לא נמצא: ' + ref);
    return c;
  }
  chapterPath(c) { return this.p('chapters', c.file); }
  readChapter(c) { const f = this.chapterPath(typeof c === 'object' ? c : this.chapter(c)); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; }

  addChapter({ title, kind = 'chapter', text = '', at, summary = '' } = {}) {
    const cs = this.data.chapters;
    const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    const num = cs.length + 1;
    const file = `${String(num).padStart(2, '0')}-${id}.md`;
    const c = { id, title: title || `${KINDS[kind] || 'פרק'} ${num}`, kind, file, summary, words: 0, status: {}, illustration: null };
    if (at != null && at >= 0 && at < cs.length) cs.splice(at, 0, c); else cs.push(c);
    fs.writeFileSync(this.chapterPath(c), text);
    c.words = countWords(text);
    this.save();
    return c;
  }

  // כותבת טקסט לפרק; שומרת עותק גיבוי של הגרסה הקודמת אם הטקסט השתנה
  writeChapter(c, text, { reason = 'edit', keepHistory = true } = {}) {
    c = typeof c === 'object' ? c : this.chapter(c);
    const f = this.chapterPath(c);
    const prev = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (keepHistory && prev && prev !== text && reason !== 'autosave') {
      const hd = this.p('.history', c.id);
      fs.mkdirSync(hd, { recursive: true });
      fs.writeFileSync(path.join(hd, `${new Date().toISOString().replace(/[:.]/g, '-')}__${reason}.md`), prev);
    }
    fs.writeFileSync(f, text);
    c.words = countWords(text);
    this.save();
    return c;
  }

  history(c) {
    c = typeof c === 'object' ? c : this.chapter(c);
    const hd = this.p('.history', c.id);
    if (!fs.existsSync(hd)) return [];
    return fs.readdirSync(hd).sort().reverse().map((n) => ({ name: n, path: path.join(hd, n) }));
  }

  removeChapter(ref) {
    const c = this.chapter(ref);
    this.data.chapters = this.data.chapters.filter((x) => x !== c);
    const f = this.chapterPath(c);
    if (fs.existsSync(f)) { fs.mkdirSync(this.p('.trash'), { recursive: true }); fs.renameSync(f, this.p('.trash', c.file)); }
    this.save();
  }

  moveChapter(ref, to) {
    const cs = this.data.chapters;
    const c = this.chapter(ref);
    cs.splice(cs.indexOf(c), 1);
    cs.splice(Math.max(0, Math.min(cs.length, to)), 0, c);
    this.save();
  }

  setStage(c, stage, val) { c.status = c.status || {}; c.status[stage] = { ...val, at: new Date().toISOString() }; this.save(); }

  allText() { return this.data.chapters.map((c) => this.readChapter(c)).join('\n\n'); }
  totalWords() { return this.data.chapters.reduce((a, c) => a + (c.words || 0), 0); }

  // תקציר הספר לשימוש בפרומפטים: הקשר ופרקים
  bookContext() {
    const d = this.data;
    const lines = [`שם הספר: ${d.title}${d.subtitle ? ' — ' + d.subtitle : ''}`, `מחבר/ת: ${d.author || '(לא צוין)'}`, `ז׳אנר: ${d.genre}`];
    if (d.audience) lines.push(`קהל יעד: ${d.audience}`);
    if (d.premise) lines.push(`תקציר/רעיון מרכזי: ${d.premise}`);
    if (d.tone) lines.push(`טון רצוי: ${d.tone}`);
    lines.push('', 'מבנה הספר:');
    d.chapters.forEach((c, i) => lines.push(`${i + 1}. ${c.title} (${KINDS[c.kind] || c.kind}, ${c.words || 0} מילים)${c.summary ? ' — ' + c.summary : ''}`));
    return lines.join('\n');
  }
}

function countWords(s) { return (s.match(/[\p{L}\p{N}]+/gu) || []).length; }

module.exports = { Project, FILE, KINDS, NO_TOC, countWords, slug, defaults };
