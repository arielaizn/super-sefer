// הפקת PDF פנים הספר: רינדור איטרטיבי (עמודים ריקים לפתיחת פרקים ב-recto, תוכן עניינים), הדבקת כותרות/מספרים
const fs = require('fs');
const path = require('path');
const layout = require('./layout');
const pdf = require('./pdf');
const stamp = require('./stamp');
const heb = require('./hebrew');
const F = require('./formats');
const { NO_TOC } = require('./project');

const norm = (s) => heb.normalizeForCompare(s);

// מאתר באיזה עמוד (1-based) נפתח כל פרק — לפי סימניות המסמך (כותרות h1), ובגיבוי לפי טקסט
async function measureStarts(pdfFile, pages, bodyChapters, tocOn) {
  const starts = {};
  const outline = (await pdf.extractOutline(pdfFile)).filter((o) => o.page != null);
  let oi = 0;
  if (outline.length) {
    if (tocOn) { const t = outline.findIndex((o) => /תוכן העניינים/.test(o.title)); oi = t >= 0 ? t + 1 : 0; }
    for (const c of bodyChapters) {
      const t = norm(c.title);
      for (let k = oi; k < outline.length; k++) {
        if (norm(outline[k].title) === t) { starts[c.id] = outline[k].page + 1; oi = k + 1; break; }
      }
    }
    if (Object.keys(starts).length === bodyChapters.length) return starts;
  }
  // גיבוי: חיפוש טקסט בראש העמוד, תוך דילוג על עמודי תוכן העניינים
  let cursor = 0;
  if (tocOn) { const i = pages.findIndex((p) => /תוכן העניינים/.test(p.text.slice(0, 40))); if (i >= 0) { cursor = i + 1; while (cursor < pages.length && (pages[cursor].text.match(/\d+\s*$/gm) || []).length > 5) cursor++; } }
  for (const c of bodyChapters) {
    const t = norm(c.title);
    for (let p = cursor; p < pages.length; p++) {
      if (t && norm(pages[p].lines.slice(0, 6).map((l) => l.text).join(' ')).includes(t)) { starts[c.id] = p + 1; cursor = p + 1; break; }
    }
  }
  return starts;
}

async function buildInterior(project, { outFile, onProgress = () => {}, smart = true } = {}) {
  const dir = project.p('build');
  fs.mkdirSync(dir, { recursive: true });
  const htmlFile = path.join(dir, 'interior.html');
  const tmpPdf = path.join(dir, 'interior.raw.pdf');
  const L = project.data.layout;
  const chapters = project.chapters();
  const body = chapters.filter((c) => c.kind !== 'dedication' && c.kind !== 'epigraph');
  if (!body.length) throw new Error('אין פרקים בספר');
  const g = layout.geometry(project);
  let plan = { blankBefore: new Set(), toc: {} };
  let pages, starts;

  for (let iter = 0; iter < 5; iter++) {
    onProgress({ step: 'render', iter: iter + 1, msg: `מעמד (סבב ${iter + 1})…` });
    fs.writeFileSync(htmlFile, layout.buildHtml(project, plan, { smart }));
    await pdf.htmlToPdf(htmlFile, { outFile: tmpPdf });
    pages = await pdf.extractPages(tmpPdf);
    starts = await measureStarts(tmpPdf, pages, body, L.toc);
    const nb = new Set(plan.blankBefore);
    let shift = 0;
    const shiftAt = {};
    body.forEach((c, i) => {
      const s = starts[c.id];
      if (s == null) return;
      const mustRecto = i === 0 || L.chapterStart === 'recto';
      if (mustRecto && (s + shift) % 2 === 0 && !plan.blankBefore.has(c.id)) { nb.add(c.id); shift++; }
      shiftAt[c.id] = shift;
    });
    const f0 = body[0].id;
    const front = (starts[f0] || 1) + (shiftAt[f0] || 0) - 1;
    const toc = {};
    body.forEach((c) => { if (starts[c.id] != null) toc[c.id] = starts[c.id] + shiftAt[c.id] - front; });
    const stable = shift === 0 && JSON.stringify(toc) === JSON.stringify(plan.toc);
    plan = { blankBefore: nb, toc };
    if (stable) break;
  }
  const startsFinal = starts;
  const frontCount = (startsFinal[body[0].id] || 1) - 1;
  const warnings = [];

  // עמודים ריקים (ללא טקסט) — לא מקבלים כותרת/מספר
  const blank = new Set();
  pages.forEach((p, i) => { if (!p.lines.length) blank.add(i); });
  const openers = new Set(Object.values(startsFinal).map((n) => n - 1));
  const chByPage = new Array(pages.length).fill('');
  let cur = '';
  body.forEach((c, k) => {
    const s = startsFinal[c.id]; if (!s) return;
    const e = (body[k + 1] && startsFinal[body[k + 1].id]) ? startsFinal[body[k + 1].id] - 1 : pages.length;
    for (let p = s - 1; p < e; p++) chByPage[p] = c.title;
  });
  const bookmarks = body.filter((c) => startsFinal[c.id] && !NO_TOC.has(c.kind)).map((c) => ({ title: c.title, page: startsFinal[c.id] - 1 }));
  onProgress({ step: 'stamp', msg: 'מוסיף מספרי עמודים וכותרות ריצה…' });
  const finalPdf = outFile || path.join(dir, 'interior.pdf');
  fs.copyFileSync(tmpPdf, finalPdf);
  await stamp.stampBook(finalPdf, {
    w: g.w, h: g.h, margins: g.margins, frontCount, openers, blankPages: blank, chapterByPage: (i) => chByPage[i], bookTitle: project.data.title, author: project.data.author,
    folio: L.folio === 'none' ? 'none' : L.folio === 'outer' ? 'outer' : 'center', header: L.headerStyle === 'none' ? 'none' : L.headerStyle === 'author' ? 'author' : 'running',
    fontHead: L.fontSans === 'Heebo' ? L.fontHead : L.fontHead, fontSans: L.fontHead, bookmarks,
  });
  // ריפוד לכפולה של 4
  let total = pages.length;
  let pad = 0;
  if (L.padSignature) { pad = F.padToSignature(total, 4); await stamp.padPages(finalPdf, pad); total += pad; }
  await pdf.setMetadata(finalPdf, { title: project.data.title + (project.data.subtitle ? ' — ' + project.data.subtitle : ''), author: project.data.author, subject: 'פנים הספר', keywords: project.data.genre });
  fs.rmSync(tmpPdf, { force: true });
  const result = { file: finalPdf, pages: total, contentPages: pages.length, padPages: pad, frontCount, starts: startsFinal, toc: plan.toc, warnings, blanks: [...blank].map((i) => i + 1), geometry: g };
  project.data.stages.layout = { at: new Date().toISOString(), pages: total, frontCount, starts: startsFinal, file: path.relative(project.dir, finalPdf) };
  project.save();
  return result;
}

module.exports = { buildInterior, measureStarts };

// ---- כריכה ----
const cover = require('./cover');
async function buildCover(project, { outFile, mode, pages, design, guides = false } = {}) {
  const dir = project.p('build');
  fs.mkdirSync(dir, { recursive: true });
  const d = project.data;
  const pc = pages || (d.stages.layout && d.stages.layout.pages) || 200;
  const des = design || d.cover.design || {};
  const m = mode || d.cover.pagesMode || 'spread';
  const { html, geometry } = cover.buildCoverHtml(project, des, { pages: pc, mode: m, guides });
  const htmlFile = path.join(dir, guides ? 'cover-guides.html' : 'cover.html');
  fs.writeFileSync(htmlFile, html);
  const out = outFile || path.join(dir, guides ? 'cover-guides.pdf' : 'cover.pdf');
  await pdf.htmlToPdf(htmlFile, { outFile: out, outline: false, tagged: false });
  await pdf.setMetadata(out, { title: 'כריכה — ' + d.title, author: d.author, subject: 'כריכה' });
  return { file: out, htmlFile, geometry, pages: pc, mode: m, dpi: cover.dpiReport(project, des, pc) };
}
module.exports.buildCover = buildCover;
