// הדבקת מספרי עמוד וכותרות ריצה ב-PDF (pdf-lib), יצירת סימניות ועמודי ריפוד
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, PDFName, PDFString, PDFNumber, PDFHexString } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { fontsDir } = require('./layout');

const MM = 72 / 25.4;
const isHebCh = (c) => /[֐-׿]/.test(c);
const clean = (s) => s.replace(/[֑-ׇ]/g, '');

function fontFile(family, subset, weight = 400) {
  const meta = require('./layout').fontList().find((f) => f.name === family) || { weights: [400] };
  const w = meta.weights.includes(weight) ? weight : meta.weights.reduce((a, b) => (Math.abs(b - weight) < Math.abs(a - weight) ? b : a));
  const id = family.toLowerCase().replace(/ /g, '-');
  let f = path.join(fontsDir(), `${id}-${subset}-${w}-normal.woff`);
  if (!fs.existsSync(f)) f = path.join(fontsDir(), `${id}-${subset}-400-normal.woff`);
  return fs.existsSync(f) ? f : null;
}

// מצייר מחרוזת RTL (עברית עם אנגלית/ספרות) מרוכזת סביב cx או מיושרת
async function makeDrawer(doc, family, weight) {
  doc.registerFontkit(fontkit);
  const heb = await doc.embedFont(fs.readFileSync(fontFile(family, 'hebrew', weight)), { subset: true });
  const latF = fontFile(family, 'latin', weight);
  const lat = latF ? await doc.embedFont(fs.readFileSync(latF), { subset: true }) : heb;
  const runs = (text) => {
    const out = []; let cur = null;
    for (const ch of clean(text)) {
      const h = isHebCh(ch) || ('״׳־'.includes(ch));
      const neutral = /[\s.,:;!?()\-–—"“”'’…]/.test(ch);
      const kind = neutral && cur ? cur.kind : h ? 'h' : 'l';
      if (!cur || cur.kind !== kind) { cur = { kind, s: '' }; out.push(cur); }
      cur.s += ch;
    }
    return out;
  };
  const measure = (text, size, spacing = 0) => runs(text).reduce((a, r) => a + (r.kind === 'h' ? heb : lat).widthOfTextAtSize(r.kind === 'h' ? [...r.s].reverse().join('') : r.s, size) + spacing * r.s.length, 0);
  const draw = (page, text, { x, y, size, align = 'center', color = rgb(0.3, 0.28, 0.25), spacing = 0 }) => {
    const rs = runs(text);
    const total = measure(text, size, spacing);
    let startX = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    // RTL: הריצות מסודרות מימין לשמאל לפי הסדר הלוגי
    let cx = startX + total;
    for (const r of rs) {
      const f = r.kind === 'h' ? heb : lat;
      const s = r.kind === 'h' ? [...r.s].reverse().join('') : r.s;
      const w = f.widthOfTextAtSize(s, size) + spacing * r.s.length;
      cx -= w;
      try { page.drawText(s, { x: cx, y, size, font: f, color, characterSpacing: spacing }); } catch (e) { if (!makeDrawer.warned) { makeDrawer.warned = 1; console.error("stamp:", e.message); } }
    }
  };
  return { draw, measure };
}

/**
 * stampBook(pdfPath, {w,h,margins, frontCount, openers:Set<pageIdx0>, chapterByPage: (idx)=>title, bookTitle, folio, header, ...})
 * עמוד 1 ב-PDF הוא recto (שמאלי). עמודים אי־זוגיים = recto.
 */
async function stampBook(pdfPath, o) {
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });
  const pages = doc.getPages();
  const { margins: m } = o;
  const fam = o.fontHead || 'Frank Ruhl Libre';
  const d = await makeDrawer(doc, o.fontSans || fam, 400);
  const color = rgb(0.32, 0.3, 0.27);
  const nfront = o.frontCount;
  pages.forEach((pg, i) => {
    if (i < nfront || o.blankPages.has(i)) return;
    const recto = (i + 1) % 2 === 1;
    const left = recto ? m.outer : m.inner;
    const right = recto ? m.inner : m.outer;
    const cx = ((left + (o.w - right)) / 2) * MM;
    const folio = i - nfront + 1;
    const isOpener = o.openers.has(i);
    const size = 8.5;
    if (o.header !== 'none' && !isOpener) {
      const text = recto ? o.chapterByPage(i) : (o.header === 'author' ? o.author : o.bookTitle);
      if (text) d.draw(pg, text, { x: cx, y: (o.h - m.top * 0.5) * MM - 3, size, color, spacing: 0.4 });
    }
    if (o.folio !== 'none') {
      const y = m.bottom * 0.45 * MM - 3;
      if (o.folio === 'outer') {
        const x = recto ? (o.w - right + 0) * MM : left * MM; // קצה הטקסט החיצוני
        d.draw(pg, String(folio), { x: recto ? left * MM : (o.w - right) * MM, y, size: 9.5, color, align: recto ? 'left' : 'right' });
      } else d.draw(pg, String(folio), { x: cx, y, size: 9.5, color });
    }
  });
  // סימניות
  if (o.bookmarks && o.bookmarks.length) addOutline(doc, o.bookmarks);
  const bytes = await doc.save();
  fs.writeFileSync(pdfPath, bytes);
}

function addOutline(doc, items) {
  const ctx = doc.context;
  const pages = doc.getPages();
  const root = ctx.obj({ Type: 'Outlines' });
  const rootRef = ctx.register(root);
  const refs = items.map((it) => ctx.register(ctx.obj({ Title: PDFHexString.fromText(it.title), Parent: rootRef, Dest: [pages[Math.min(it.page, pages.length - 1)].ref, PDFName.of('Fit')] })));
  refs.forEach((r, i) => { const dct = ctx.lookup(r); if (i > 0) dct.set(PDFName.of('Prev'), refs[i - 1]); if (i < refs.length - 1) dct.set(PDFName.of('Next'), refs[i + 1]); });
  root.set(PDFName.of('First'), refs[0]); root.set(PDFName.of('Last'), refs[refs.length - 1]); root.set(PDFName.of('Count'), PDFNumber.of(refs.length));
  doc.catalog.set(PDFName.of('Outlines'), rootRef);
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

async function padPages(pdfPath, n) {
  if (!n) return;
  const doc = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });
  const { width, height } = doc.getPage(0).getSize();
  for (let i = 0; i < n; i++) doc.addPage([width, height]);
  fs.writeFileSync(pdfPath, await doc.save());
}

module.exports = { stampBook, padPages, makeDrawer, MM };
