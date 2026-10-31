// יצירת PDF מ-HTML דרך Chromium (printToPDF), חילוץ טקסט לכל עמוד, המרת עמודים לתמונות, מטא-דאטה
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let electron;
function E() { return electron || (electron = require('electron')); }

const rootDir = path.join(__dirname, '..', '..');

async function htmlToPdf(htmlFile, { outFile, waitMs = 300, outline = true, tagged = true } = {}) {
  const { BrowserWindow } = E();
  const win = new BrowserWindow({ show: false, width: 1000, height: 1400, webPreferences: { offscreen: false, sandbox: false, contextIsolation: true, backgroundThrottling: false } });
  try {
    await win.loadURL(pathToFileURL(htmlFile).href);
    await win.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
    await new Promise((r) => setTimeout(r, waitMs));
    const buf = await win.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true, generateDocumentOutline: outline, generateTaggedPDF: tagged, displayHeaderFooter: false, margins: { marginType: 'none' } });
    if (outFile) fs.writeFileSync(outFile, buf);
    return buf;
  } finally { win.destroy(); }
}

let pdfjsP;
function pdfjs() {
  // pdf.js (legacy) מצפה ל-DOMMatrix וכד׳ בסביבת Node; לחילוץ טקסט אין בהם שימוש
  for (const n of ['DOMMatrix', 'Path2D', 'ImageData']) if (!globalThis[n]) globalThis[n] = class { constructor() { this.a = 1; this.d = 1; } };
  if (!pdfjsP) pdfjsP = import(pathToFileURL(path.join(rootDir, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs').replace('app.asar', 'app.asar.unpacked')).href);
  return pdfjsP;
}

// מבנה הסימניות (מכותרות המסמך): [{title, page(0-based), depth}]
async function extractOutline(pdfFile) {
  const lib = await pdfjs();
  const data = new Uint8Array(fs.readFileSync(pdfFile));
  const doc = await lib.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const out = [];
  const walk = async (items, depth) => {
    for (const it of items || []) {
      let page = null;
      try {
        let dest = it.dest;
        if (typeof dest === 'string') dest = await doc.getDestination(dest);
        if (dest && dest[0] != null) page = typeof dest[0] === 'object' ? await doc.getPageIndex(dest[0]) : dest[0];
      } catch {}
      out.push({ title: (it.title || '').trim(), page, depth });
      await walk(it.items, depth + 1);
    }
  };
  await walk(await doc.getOutline(), 0);
  await doc.destroy();
  return out;
}

// טקסט לכל עמוד: [{n, text, lines:[{y,text}], w, h}]
async function extractPages(pdfFile) {
  const lib = await pdfjs();
  const data = new Uint8Array(fs.readFileSync(pdfFile));
  const doc = await lib.getDocument({ data, useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str) continue;
      const y = Math.round(vp.height - it.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str, w: it.width });
    }
    const lines = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([y, arr]) => {
      arr.sort((a, b) => b.x - a.x); // RTL
      const x0 = Math.min(...arr.map((a) => a.x)), x1 = Math.max(...arr.map((a) => a.x + a.w));
      return { y, text: arr.map((a) => a.s).join('').replace(/\s+/g, ' ').trim(), x0, x1 };
    }).filter((l) => l.text);
    pages.push({ n, w: vp.width, h: vp.height, lines, text: lines.map((l) => l.text).join('\n') });
    pg.cleanup();
  }
  await doc.destroy();
  return pages;
}

// המרת עמודים לתמונות PNG (dataURL) בעזרת pdf.js בחלון נסתר — לתצוגה מקדימה ובדיקות
async function rasterize(pdfFile, { pages, scale = 1, outDir } = {}) {
  const { BrowserWindow } = E();
  const win = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { sandbox: false, contextIsolation: false, nodeIntegration: true } });
  try {
    await win.loadFile(path.join(rootDir, 'ui', 'raster.html'));
    const b64 = fs.readFileSync(pdfFile).toString('base64');
    const res = await win.webContents.executeJavaScript(`window.rasterize(${JSON.stringify(b64)}, ${JSON.stringify(pages || null)}, ${scale})`);
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      res.pages.forEach((r) => fs.writeFileSync(path.join(outDir, `p${String(r.n).padStart(3, '0')}.png`), Buffer.from(r.data.split(',')[1], 'base64')));
    }
    return res;
  } finally { win.destroy(); }
}

// מטא-דאטה ומיזוג
async function setMetadata(pdfFile, { title, author, subject, keywords, lang = 'he-IL', creator = 'סופר-ספר' } = {}) {
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.load(fs.readFileSync(pdfFile), { updateMetadata: false });
  if (title) doc.setTitle(title);
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  if (keywords) doc.setKeywords(Array.isArray(keywords) ? keywords : [String(keywords)]);
  doc.setCreator(creator); doc.setProducer('סופר-ספר (Chromium)');
  doc.setCreationDate(new Date()); doc.setModificationDate(new Date());
  try { doc.catalog.set(doc.context.obj('Lang'), require('pdf-lib').PDFString.of(lang)); } catch {}
  fs.writeFileSync(pdfFile, await doc.save());
  return { pages: doc.getPageCount() };
}

async function pageCount(pdfFile) {
  const { PDFDocument } = require('pdf-lib');
  return (await PDFDocument.load(fs.readFileSync(pdfFile), { updateMetadata: false })).getPageCount();
}

module.exports = { htmlToPdf, extractPages, extractOutline, rasterize, setMetadata, pageCount };
