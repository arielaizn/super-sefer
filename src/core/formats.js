// גדלי ספר, סוגי נייר, חישובי שדרה ושוליים — מבוסס על תקני הדפסה נפוצים (KDP / בתי דפוס בישראל)
const TRIMS = [
  { id: 'il-trade', label: 'סטנדרט ישראלי 14×21', w: 140, h: 210, use: 'פרוזה, עיון קליל, ספרי קריאה — הגודל הנפוץ בישראל' },
  { id: 'a5', label: 'A5 — 14.8×21', w: 148, h: 210, use: 'פרוזה, עיון, ספרי לימוד קטנים; זמין בכל דפוס' },
  { id: 'royal', label: 'רויאל 15.6×23.4', w: 156, h: 234, use: 'עיון, ביוגרפיות, ספרים עבים — שורות נוחות ושוליים נדיבים' },
  { id: 'us-trade', label: '6×9 אינץ׳ (15.2×22.9)', w: 152.4, h: 228.6, use: 'סטנדרט הדפסה לפי דרישה (KDP/IngramSpark) — עיון ופרוזה' },
  { id: 'us-digest', label: '5.5×8.5 אינץ׳ (14×21.6)', w: 139.7, h: 215.9, use: 'פרוזה וספרי עיון קצרים' },
  { id: 'us-small', label: '5×8 אינץ׳ (12.7×20.3)', w: 127, h: 203.2, use: 'נובלות, שירה, ספרים קצרים וקלי משקל' },
  { id: 'pocket', label: 'כיס 11.5×18', w: 115, h: 180, use: 'ספרי כיס, הוצאות מחודשות; שורות קצרות — עדיף גופן קטן יחסית' },
  { id: 'b5', label: 'B5 — 17.6×25', w: 176, h: 250, use: 'ספרי לימוד, מדריכים, ספרי בישול, חוברות עבודה' },
  { id: 'a4', label: 'A4 — 21×29.7', w: 210, h: 297, use: 'אלבומים, חוברות, ספרי עבודה; מומלץ שתי עמודות בטקסט רציף' },
  { id: 'square-20', label: 'ריבוע 20×20', w: 200, h: 200, use: 'ספרי ילדים מאוירים, ספרי צילום קטנים' },
  { id: 'square-21', label: 'ריבוע 21×21', w: 210, h: 210, use: 'ספרי ילדים מאוירים, אלבומי מתנה' },
  { id: 'a6', label: 'A6 — 10.5×14.8', w: 105, h: 148, use: 'ספרונים, שירה קצרה, מתנות' },
  { id: 'custom', label: 'מותאם אישית', w: 150, h: 220, use: 'כל מידה (בדקו מול הדפוס)' },
];

// עובי עמוד (צד עמוד, לא גיליון) במ״מ — נתוני KDP ודפוסי אופסט טיפוסיים
const PAPERS = [
  { id: 'offset-80', label: 'אופסט לבן 80 גרם', mm: 0.050 },
  { id: 'offset-70-cream', label: 'אופסט שמנת 70 גרם (בולק)', mm: 0.0525 },
  { id: 'offset-90', label: 'אופסט לבן 90 גרם', mm: 0.056 },
  { id: 'kdp-white', label: 'KDP לבן (שחור-לבן)', mm: 0.0572 },
  { id: 'kdp-cream', label: 'KDP שמנת (שחור-לבן)', mm: 0.0635 },
  { id: 'kdp-color', label: 'KDP צבע פרימיום', mm: 0.0596 },
  { id: 'coated-115', label: 'כרומו מט 115 גרם', mm: 0.045 },
];

const BINDINGS = [
  { id: 'soft', label: 'כריכה רכה (דבק)', bleed: 3, hinge: 0, board: 0, wrap: 0 },
  { id: 'hard', label: 'כריכה קשה (עטיפת בד/נייר)', bleed: 3, hinge: 8, board: 2.5, wrap: 15 },
];

const trim = (id) => TRIMS.find((t) => t.id === id) || TRIMS[1];
const paper = (id) => PAPERS.find((p) => p.id === id) || PAPERS[0];
const binding = (id) => BINDINGS.find((b) => b.id === id) || BINDINGS[0];

// שוליית שדרה (gutter) מינימלית לפי מספר עמודים (KDP)
function gutterMin(pages) {
  if (pages <= 150) return 9.5;
  if (pages <= 300) return 12.7;
  if (pages <= 500) return 15.9;
  if (pages <= 700) return 19.1;
  return 22.2;
}

// המלצת עימוד לפי גודל ומספר עמודים משוער
function recommend(trimId, pages = 200, genre = 'prose') {
  const t = trim(trimId);
  const w = t.w, h = t.h;
  const outer = Math.round(Math.max(14, w * 0.105) * 10) / 10;
  const top = Math.round(Math.max(16, h * 0.085) * 10) / 10;
  const bottom = Math.round(top * 1.25 * 10) / 10;
  const inner = Math.round((gutterMin(pages) + Math.max(6, outer * 0.55)) * 10) / 10;
  let fontSize = w < 125 ? 10.5 : w < 150 ? 11 : w < 175 ? 11.5 : 12;
  if (t.id === 'a4') fontSize = 11;
  if (genre === 'kids') fontSize += 2.5;
  const lineHeight = genre === 'poetry' ? 1.6 : 1.5;
  const textW = w - outer - inner;
  // ~ 0.5em ממוצע לתו בעברית
  const charsPerLine = Math.round(textW / (fontSize * 0.3528 * 0.5));
  return { margins: { top, bottom, inner, outer }, fontSize, lineHeight, charsPerLine, textWidthMm: Math.round(textW * 10) / 10,
    notes: [
      charsPerLine > 72 ? 'שורה ארוכה מדי (מעל ~70 תווים) — שקלו גופן גדול יותר, שתי עמודות או שוליים רחבים' : charsPerLine < 38 ? 'שורה קצרה מאוד (מתחת ל~40 תווים) — צפויים רווחים רחבים בשורות מיושרות; שקלו גופן קטן יותר' : 'אורך שורה נוח לקריאה (45–70 תווים)',
      `שולי שדרה מינימליים ל-${pages} עמודים: ${gutterMin(pages)} מ״מ`,
    ] };
}

// מידות כריכה (פריסה מלאה: גב | שדרה | חזית) כולל בלידים
function coverGeometry({ trimId, customW, customH, pages, paperId, bindingId }) {
  const t = trim(trimId);
  const w = trimId === 'custom' && customW ? customW : t.w;
  const h = trimId === 'custom' && customH ? customH : t.h;
  const b = binding(bindingId);
  const p = paper(paperId);
  const spine = Math.round(pages * p.mm * 100) / 100 + (b.id === 'hard' ? 0 : 0);
  const board = b.board;
  const hinge = b.hinge;
  const wrap = b.wrap;
  const panelW = w + (b.id === 'hard' ? 3 : 0); // לוח כריכה קשה גדול במעט מגוף הספר
  const spineW = spine + (b.id === 'hard' ? board * 2 : 0);
  const bleed = b.id === 'hard' ? wrap : b.bleed;
  const totalW = bleed + panelW + (hinge ? hinge : 0) + spineW + (hinge ? hinge : 0) + panelW + bleed;
  const totalH = h + (b.id === 'hard' ? 6 : 0) + bleed * 2;
  return { trimW: w, trimH: h, spine: spineW, bleed, hinge, panelW, totalW: Math.round(totalW * 100) / 100, totalH: Math.round(totalH * 100) / 100, binding: b.id };
}

// מספר העמודים צריך להיות כפולה של 4 (דפוס אופסט) — מחזיר כמה עמודים ריקים להוסיף
function padToSignature(pages, mult = 4) {
  return (mult - (pages % mult)) % mult;
}

module.exports = { TRIMS, PAPERS, BINDINGS, trim, paper, binding, recommend, coverGeometry, gutterMin, padToSignature };
