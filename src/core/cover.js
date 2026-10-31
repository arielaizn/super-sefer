// בניית כריכה: פריסה מלאה (גב | שדרה | חזית) או שני עמודים. שישה פריסות ו-EAN-13 וקטורי
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const F = require('./formats');
const { fontCss, esc } = require('./layout');

const LAYOUTS = [
  { id: 'classic', label: 'קלאסי — כותרת מרכזית ותמונה ממוסגרת' },
  { id: 'fullbleed', label: 'תמונה מלאה — כותרת על גבי תמונה' },
  { id: 'typographic', label: 'טיפוגרפי — כותרת ענקית על צבע' },
  { id: 'band', label: 'פס תחתון — תמונה למעלה וכיתוב בפס' },
  { id: 'frame', label: 'מסגרת — מינימליסטי ורגוע' },
  { id: 'arch', label: 'קשת — תמונה בחלון קשתי' },
];

const PALETTES = [
  { id: 'ink', label: 'דיו וקרם', bg: '#16222e', fg: '#f4ead8', accent: '#d9a441', muted: '#9fb0bd' },
  { id: 'paper', label: 'נייר ואדום', bg: '#f3ead9', fg: '#1d1a17', accent: '#b3382c', muted: '#7b6f5f' },
  { id: 'sea', label: 'ים וחול', bg: '#0f3b4a', fg: '#f6efe0', accent: '#e8b86a', muted: '#8fb7c0' },
  { id: 'forest', label: 'יער', bg: '#1f3a2e', fg: '#f1ebd9', accent: '#c9a557', muted: '#8fae9a' },
  { id: 'noir', label: 'נואר', bg: '#0d0d0f', fg: '#f2f2f0', accent: '#e63b2e', muted: '#8a8a8e' },
  { id: 'rose', label: 'ורדרד', bg: '#f6e4df', fg: '#3a1f24', accent: '#c4566b', muted: '#8d6a70' },
];

// ---- EAN-13 ----
const L_ = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G_ = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R_ = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
function isbn13(s) {
  const d = String(s || '').replace(/[^0-9Xx]/g, '');
  if (d.length !== 13) return null;
  const sum = [...d].slice(0, 12).reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(d[12]) ? d : null;
}
function eanSvg(d, h = 22) {
  let bits = '101';
  const p = PAR[Number(d[0])];
  for (let i = 1; i <= 6; i++) bits += (p[i - 1] === 'L' ? L_ : G_)[Number(d[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R_[Number(d[i])];
  bits += '101';
  const m = 9, W = 95 + m * 2;
  let rects = '';
  [...bits].forEach((b, i) => { if (b === '1') rects += `<rect x="${i + m}" y="0" width="1" height="${(i < 3 || (i > 44 && i < 50) || i > 91) ? 78 : 72}"/>`; });
  const txt = (s, x) => `<text x="${x}" y="88" font-size="10" font-family="'Heebo',sans-serif" text-anchor="middle" letter-spacing="2.2">${s}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 92" style="height:${h}mm;width:auto;display:block;background:#fff"><rect width="${W}" height="92" fill="#fff"/><g fill="#000">${rects}</g>${txt(d[0], 4)}${txt(d.slice(1, 7), m + 27)}${txt(d.slice(7), m + 73)}</svg>`;
}

function imgUrl(project, f) { return f ? pathToFileURL(path.isAbsolute(f) ? f : project.p(f)).href : ''; }

// ברירת מחדל לעיצוב כריכה מנתוני הספר
function defaultDesign(project) {
  const d = project.data;
  const pal = PALETTES[0];
  return {
    layout: 'classic', palette: { bg: pal.bg, fg: pal.fg, accent: pal.accent, muted: pal.muted },
    fonts: { title: 'Frank Ruhl Libre', body: 'Heebo' },
    title: d.title, subtitle: d.subtitle || '', author: d.author, tagline: '', blurb: d.premise || '', bio: '', publisher: d.publisher || '', isbn: d.isbn || '', price: '',
    image: null, imageMode: 'inset', imagePos: '50% 50%', scrim: 0.6, titleSize: 1, spine: true, spineDir: d.cover.spineDir || 'ttb', barcode: true, backImageMode: 'blur',
  };
}

function geoFor(project, pages) {
  const L = project.data.layout;
  const g = F.coverGeometry({ trimId: L.trim, customW: L.customW, customH: L.customH, pages, paperId: L.paper, bindingId: L.binding });
  if (project.data.cover.bleed) g.bleed = project.data.cover.bleed;
  return g;
}

function frontPanel(project, d, g, outerSide) {
  const img = d.image ? imgUrl(project, d.image) : '';
  const t = esc(d.title), sub = d.subtitle ? esc(d.subtitle) : '', au = esc(d.author), tag = d.tagline ? esc(d.tagline) : '';
  const ts = d.titleSize || 1;
  const len = d.title.length;
  const baseTitle = (len <= 10 ? 15 : len <= 18 ? 12.5 : len <= 28 ? 10 : 8) * ts; // mm
  const W = g.panelW;
  const common = `font-family:'${d.fonts.title}',serif;`;
  const imageEl = (style) => (img ? `<div class="img" style="background-image:url('${img}');background-position:${d.imagePos};${style}"></div>` : '');
  switch (d.layout) {
    case 'fullbleed':
      return `<div class="fb">${img ? `<div class="img full" style="background-image:url('${img}');background-position:${d.imagePos}"></div>` : ''}<div class="scrim" style="background:linear-gradient(180deg, rgba(0,0,0,${d.scrim}) 0%, rgba(0,0,0,${d.scrim * 0.2}) 38%, rgba(0,0,0,${d.scrim * 0.2}) 62%, rgba(0,0,0,${d.scrim + 0.2}) 100%)"></div>
<div class="safe col" style="justify-content:space-between;color:#fff">
 <div style="text-align:center;${common}"><div class="t" style="font-size:${baseTitle}mm;line-height:1.05;font-weight:700;text-shadow:0 0.5mm 4mm rgba(0,0,0,.45)">${t}</div>${sub ? `<div style="font-family:'${d.fonts.body}';font-size:4.2mm;margin-top:4mm;opacity:.92">${sub}</div>` : ''}</div>
 <div style="text-align:center;font-family:'${d.fonts.body}';"><div style="font-size:6mm;letter-spacing:.14em;font-weight:500">${au}</div></div></div></div>`;
    case 'typographic': {
      const words = d.title.split(/\s+/);
      return `<div class="typo"><div class="safe col" style="justify-content:space-between;">
 <div style="font-family:'${d.fonts.body}';font-size:3.6mm;letter-spacing:.3em;color:${d.palette.accent};font-weight:700">${d.subtitle ? sub : ''}</div>
 <div style="${common}text-align:right;line-height:.95;font-weight:900">${words.map((w, i) => `<div style="font-size:${Math.min(W * 0.34, baseTitle * 1.9 * (i === 0 ? 1.05 : 1))}mm;color:${i % 2 ? d.palette.accent : d.palette.fg}">${esc(w)}</div>`).join('')}</div>
 <div><div style="width:18mm;height:1.6mm;background:${d.palette.accent};margin-bottom:4mm"></div><div style="font-family:'${d.fonts.body}';font-size:6.2mm;letter-spacing:.1em;font-weight:500">${au}</div></div></div></div>`;
    }
    case 'band':
      return `<div class="band"><div class="top" style="height:62%">${imageEl('position:absolute;inset:0;')}</div>
 <div class="bottom" style="position:absolute;left:0;right:0;bottom:0;height:38%;background:${d.palette.bg};"><div class="safe col" style="justify-content:center;text-align:right;padding-top:5mm;padding-bottom:7mm">
 <div style="${common}font-size:${baseTitle * 0.85}mm;line-height:1.05;font-weight:700;color:${d.palette.fg}">${t}</div>${sub ? `<div style="font-family:'${d.fonts.body}';font-size:3.8mm;color:${d.palette.muted};margin-top:2.5mm">${sub}</div>` : ''}
 <div style="font-family:'${d.fonts.body}';font-size:5.4mm;color:${d.palette.accent};letter-spacing:.12em;margin-top:5mm;font-weight:600">${au}</div></div></div></div>`;
    case 'frame':
      return `<div class="frame"><div style="position:absolute;inset:9mm;border:0.55mm solid ${d.palette.accent};"></div><div style="position:absolute;inset:11.5mm;border:0.2mm solid ${d.palette.accent};opacity:.6"></div>
 <div class="safe col" style="justify-content:center;align-items:center;text-align:center;padding:18mm 20mm">
 ${img ? `<div style="width:${W * 0.42}mm;height:${W * 0.42}mm;border-radius:50%;background-image:url('${img}');background-size:cover;background-position:${d.imagePos};margin-bottom:9mm"></div>` : `<div style="font-size:9mm;color:${d.palette.accent};margin-bottom:8mm">❦</div>`}
 <div style="${common}font-size:${baseTitle * 0.78}mm;line-height:1.12;font-weight:700">${t}</div>${sub ? `<div style="font-family:'${d.fonts.body}';font-size:3.9mm;margin-top:4mm;color:${d.palette.muted}">${sub}</div>` : ''}
 <div style="width:14mm;height:.4mm;background:${d.palette.accent};margin:8mm 0 6mm"></div><div style="font-family:'${d.fonts.body}';font-size:5mm;letter-spacing:.2em;font-weight:500">${au}</div></div></div>`;
    case 'arch':
      return `<div class="arch"><div class="safe col" style="align-items:center;text-align:center;padding-top:14mm;padding-bottom:14mm;justify-content:space-between">
 <div style="width:${W * 0.62}mm;height:${W * 0.78}mm;border-radius:${W * 0.31}mm ${W * 0.31}mm 1.5mm 1.5mm;overflow:hidden;background:${d.palette.accent}22;position:relative;border:0.5mm solid ${d.palette.accent}">${imageEl('position:absolute;inset:0;')}</div>
 <div><div style="${common}font-size:${baseTitle * 0.82}mm;line-height:1.08;font-weight:700">${t}</div>${sub ? `<div style="font-family:'${d.fonts.body}';font-size:3.8mm;margin-top:3mm;color:${d.palette.muted}">${sub}</div>` : ''}</div>
 <div style="font-family:'${d.fonts.body}';font-size:5.2mm;letter-spacing:.18em;color:${d.palette.accent};font-weight:600">${au}</div></div></div>`;
    default: // classic
      return `<div class="classic"><div class="safe col" style="align-items:center;text-align:center;justify-content:space-between;padding-top:16mm;padding-bottom:13mm">
 <div style="font-family:'${d.fonts.body}';font-size:4.6mm;letter-spacing:.3em;color:${d.palette.accent};font-weight:600">${au}</div>
 <div style="${common}"><div style="font-size:${baseTitle}mm;line-height:1.02;font-weight:700">${t}</div>${sub ? `<div style="font-family:'${d.fonts.body}';font-size:4.2mm;margin-top:4mm;color:${d.palette.muted}">${sub}</div>` : ''}</div>
 ${img ? `<div style="width:${W * 0.7}mm;height:${W * 0.7}mm;position:relative;border:.4mm solid ${d.palette.accent};padding:1.6mm"><div style="position:absolute;inset:1.6mm;background-image:url('${img}');background-size:cover;background-position:${d.imagePos}"></div></div>` : `<div style="font-size:12mm;color:${d.palette.accent}">❦</div>`}
 <div style="font-family:'${d.fonts.body}';font-size:3.6mm;color:${d.palette.muted}">${tag}</div></div></div>`;
  }
}

function backPanel(project, d, g) {
  const img = d.image && d.layout === 'fullbleed' ? imgUrl(project, d.image) : '';
  const bc = isbn13(d.isbn);
  const barcode = d.barcode ? (bc ? `<div class="bc">${eanSvg(bc, 24)}</div>` : `<div class="bc ph"><span>מקום לברקוד / ISBN</span></div>`) : '';
  const dark = d.layout === 'fullbleed' || d.layout === 'noir';
  const fg = d.layout === 'fullbleed' ? '#fff' : d.palette.fg;
  const blurb = (d.blurb || '').split(/\n+/).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join('');
  return `<div class="backp" style="color:${fg}">${img ? `<div class="img full" style="background-image:url('${img}');filter:blur(16px) brightness(.42) saturate(1.1);transform:scale(1.15)"></div>` : ''}
<div class="safe col" style="justify-content:space-between;padding-top:15mm;padding-bottom:12mm">
 <div>${d.tagline ? `<div style="font-family:'${d.fonts.title}',serif;font-size:6.2mm;line-height:1.25;font-weight:700;color:${d.palette.accent};margin-bottom:6mm">${esc(d.tagline)}</div>` : ''}
 <div class="blurb" style="font-family:'${d.fonts.body}',sans-serif;font-size:3.5mm;line-height:1.62;text-align:right">${blurb}</div>
 ${d.bio ? `<div style="margin-top:6mm;padding-top:4mm;border-top:.25mm solid ${d.palette.accent}88;font-family:'${d.fonts.body}';font-size:3mm;line-height:1.55;opacity:.9">${esc(d.bio)}</div>` : ''}</div>
 <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:6mm"><div style="font-family:'${d.fonts.body}';font-size:3mm;opacity:.85;line-height:1.5">${d.publisher ? esc(d.publisher) + '<br>' : ''}${d.price ? esc(d.price) : ''}</div>${barcode}</div></div></div>`;
}

function spinePanel(d, g) {
  if (!d.spine || g.spine < 6) return '';
  const rot = d.spineDir === 'btt' ? 'transform:rotate(180deg);' : '';
  const fs1 = Math.min(g.spine * 0.5, 7);
  return `<div class="spinep" style="color:${d.layout === 'fullbleed' ? '#fff' : d.palette.fg}"><div class="sp" style="writing-mode:vertical-rl;${rot}height:${g.trimH - 24}mm;"><span style="font-family:'${d.fonts.title}',serif;font-size:${fs1}mm;font-weight:700">${esc(d.title)}</span><span style="font-family:'${d.fonts.body}';font-size:${fs1 * 0.62}mm;letter-spacing:.14em;color:${d.palette.accent};font-weight:600">${esc(d.author)}</span></div></div>`;
}

function css(d, g) {
  const bg = d.palette.bg;
  return `${fontCss()}
@page { size: ${g.pageW}mm ${g.pageH}mm; margin: 0; }
*{box-sizing:border-box} html,body{margin:0;padding:0} html{direction:rtl;-webkit-print-color-adjust:exact;font-family:'${d.fonts.body}',sans-serif;color:${d.palette.fg}}
.sheet{position:relative;width:${g.pageW}mm;height:${g.pageH}mm;overflow:hidden;background:${bg};break-after:page}
.sheet:last-child{break-after:auto}
.panel{position:absolute;overflow:hidden;background:${bg}} .panel > div{position:absolute;inset:0}
.img{background-size:cover;background-repeat:no-repeat} .img.full{position:absolute;inset:0}
.safe{position:absolute;display:flex;flex-direction:column}
.col{}
.blurb p{margin:0 0 3mm;text-indent:0}
.bc{background:#fff;padding:2mm 2.5mm;} .bc.ph{width:40mm;height:25mm;display:flex;align-items:center;justify-content:center;color:#444;font-size:2.6mm;border:.2mm dashed #aaa}
.spinep{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.sp{display:flex;align-items:center;justify-content:space-between;gap:6mm;white-space:nowrap}
.guides .g{position:absolute;pointer-events:none;border:0 dashed #f0f}
`;
}

/**
 * buildCoverHtml(project, design, {pages, mode:'spread'|'pages', guides})
 */
function buildCoverHtml(project, design, { pages = 200, mode = 'spread', guides = false } = {}) {
  const d = { ...defaultDesign(project), ...(design || {}) };
  d.palette = { ...defaultDesign(project).palette, ...(design && design.palette) };
  d.fonts = { ...defaultDesign(project).fonts, ...(design && design.fonts) };
  const g = geoFor(project, pages);
  const m = 8; // שולי ביטחון בתוך החיתוך
  const bleed = g.bleed;
  const H = g.trimH;
  let html = '';
  const safeCss = (outerLeft) => ''; // placeholder for clarity
  const wrapSafe = (inner, w, bleedL, bleedR) => inner.replace(/class="safe([^"]*)"/g, (mm, rest) => `class="safe${rest}"`).replace(/<div class="safe/g, `<div class="safe`);
  const css0 = css(d, { ...g, pageW: mode === 'spread' ? g.totalW : g.trimW + bleed * 2, pageH: mode === 'spread' ? g.totalH : H + bleed * 2 });
  // מיקום תוכן בטוח: top/bottom/sides יחסית לפאנל (כולל בליד)
  const place = (inner, bleedOuter, bleedInner, w) => {
    // פאנל = [bleedOuter | w (חיתוך) | bleedInner]; "safe" מתחיל 8מ״מ בתוך החיתוך
    const left = (bleedOuter) + m, top = bleed + m;
    return inner.replace(/<div class="safe col"( style="[^"]*")?>/g, (mm, st) => `<div class="safe col" style="${(st || '').slice(8, -1)}${st ? ';' : ''}left:${left}mm;right:${bleedInner + m}mm;top:${top}mm;bottom:${bleed + m}mm;">`)
      .replace(/<div class="safe col" style="([^"]*)">/g, (mm, st) => mm);
  };
  if (mode === 'spread') {
    const hinge = g.hinge || 0;
    const backX = 0, backW = bleed + g.panelW;
    const spineX = backW, spineW = g.spine + hinge * 2;
    const frontX = spineX + spineW, frontW = g.panelW + bleed;
    // RTL: חזית בימין ← ב-CSS physical: שמאל=גב, אמצע=שדרה, ימין=חזית
    const front = frontPanel(project, d, g);
    const back = backPanel(project, d, g);
    html = `<div class="sheet ${guides ? 'guides' : ''}">
 <div class="panel back" style="left:${backX}mm;top:0;width:${backW}mm;height:${g.totalH}mm">${fixSafe(back, { l: bleed + m, r: m, t: bleed + m, b: bleed + m })}</div>
 <div class="panel spine" style="left:${spineX}mm;top:0;width:${spineW}mm;height:${g.totalH}mm"><div>${spinePanel(d, g)}</div></div>
 <div class="panel front" style="left:${frontX}mm;top:0;width:${frontW}mm;height:${g.totalH}mm">${fixSafe(front, { l: m, r: bleed + m, t: bleed + m, b: bleed + m })}</div>
 ${guides ? guideLines(g) : ''}</div>`;
  } else {
    const W = g.trimW + bleed * 2, Hh = H + bleed * 2;
    html = `<div class="sheet"><div class="panel" style="left:0;top:0;width:${W}mm;height:${Hh}mm">${fixSafe(frontPanel(project, d, g), { l: bleed + m, r: bleed + m, t: bleed + m, b: bleed + m })}</div></div>
<div class="sheet"><div class="panel" style="left:0;top:0;width:${W}mm;height:${Hh}mm">${fixSafe(backPanel(project, d, g), { l: bleed + m, r: bleed + m, t: bleed + m, b: bleed + m })}</div></div>`;
  }
  const doc = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>כריכה — ${esc(d.title)}</title><style>${css0}</style></head><body>${html}</body></html>`;
  return { html: doc, geometry: g, design: d };
}

// מוסיף מיקום מוחלט לאלמנטי safe + מתאים את הרקע לפאנל
function fixSafe(inner, o) {
  return inner.replace(/<div class="safe col"( style="([^"]*)")?>/g, (m, _a, st) => `<div class="safe col" style="${st ? st + ';' : ''}left:${o.l}mm;right:${o.r}mm;top:${o.t}mm;bottom:${o.b}mm">`)
    .replace(/<div class="(classic|fb|typo|band|frame|arch|backp)"([^>]*)>/, (m, c, rest) => `<div class="${c}"${rest} style="position:absolute;inset:0;">`.replace('" style="position', '" style="position'));
}

function guideLines(g) {
  const b = g.bleed, h = g.hinge || 0;
  const line = (x, y, w, hh, col, dash = '1px dashed') => `<div class="g" style="left:${x}mm;top:${y}mm;width:${w}mm;height:${hh}mm;border:${dash} ${col}"></div>`;
  return [
    line(b, b, g.totalW - b * 2, g.trimH, '#e0f', '0.3mm dashed'),
    line(b + g.panelW, 0, g.spine + h * 2, g.totalH, '#09f', '0.3mm dashed'),
  ].join('');
}

// ממדי תמונה (PNG/JPEG) לבדיקת DPI
function imageSize(file) {
  try {
    const b = fs.readFileSync(file);
    if (b.slice(1, 4).toString() === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xFF && b[1] === 0xD8) {
      let i = 2;
      while (i < b.length) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1]; if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + b.readUInt16BE(i + 2); }
    }
  } catch {}
  return null;
}

function dpiReport(project, design, pages) {
  const d = { ...defaultDesign(project), ...(design || {}) };
  if (!d.image) return null;
  const f = path.isAbsolute(d.image) ? d.image : project.p(d.image);
  const sz = imageSize(f);
  if (!sz) return null;
  const g = geoFor(project, pages);
  const W = g.panelW + g.bleed, H = g.trimH + g.bleed * 2;
  let mmW, mmH;
  if (d.layout === 'fullbleed') { mmW = W; mmH = H; } else if (d.layout === 'band') { mmW = W; mmH = H * 0.62; } else if (d.layout === 'frame') { mmW = mmH = g.panelW * 0.42; } else if (d.layout === 'arch') { mmW = g.panelW * 0.62; mmH = g.panelW * 0.78; } else { mmW = mmH = g.panelW * 0.7; }
  // cover: התמונה נחתכת ליחס; DPI אפקטיבי לפי הצד הדוחק יותר
  const scale = Math.max(mmW / sz.w, mmH / sz.h);
  const dpi = Math.round(25.4 / scale);
  return { px: sz, placedMm: [Math.round(mmW), Math.round(mmH)], dpi, level: dpi >= 300 ? 'מצוין' : dpi >= 200 ? 'טוב' : dpi >= 150 ? 'גבולי — מתאים להדפסה דיגיטלית רגילה' : 'נמוך — מומלץ לשדרג את התמונה או לבחור פריסה עם תמונה קטנה יותר' };
}

module.exports = { LAYOUTS, PALETTES, buildCoverHtml, defaultDesign, geoFor, isbn13, eanSvg, imageSize, dpiReport };
