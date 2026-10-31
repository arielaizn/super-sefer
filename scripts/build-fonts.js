// מעתיק את גופני העברית/לטינית מ-@fontsource לתיקיית fonts ובונה fonts.css + fonts.json
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const FONTS = [
  { id: 'frank-ruhl-libre', name: 'Frank Ruhl Libre', label: 'פרנק ריהל', kind: 'serif', w: [300, 400, 500, 700, 900] },
  { id: 'david-libre', name: 'David Libre', label: 'דוד', kind: 'serif', w: [400, 500, 700] },
  { id: 'noto-serif-hebrew', name: 'Noto Serif Hebrew', label: 'נוטו סריף', kind: 'serif', w: [300, 400, 500, 700, 900] },
  { id: 'miriam-libre', name: 'Miriam Libre', label: 'מרים', kind: 'serif', w: [400, 700] },
  { id: 'bellefair', name: 'Bellefair', label: 'בלפייר', kind: 'display', w: [400] },
  { id: 'heebo', name: 'Heebo', label: 'היבו', kind: 'sans', w: [300, 400, 500, 700, 900] },
  { id: 'assistant', name: 'Assistant', label: 'אסיסטנט', kind: 'sans', w: [300, 400, 600, 800] },
  { id: 'rubik', name: 'Rubik', label: 'רוביק', kind: 'sans', w: [300, 400, 500, 700, 900] },
  { id: 'noto-sans-hebrew', name: 'Noto Sans Hebrew', label: 'נוטו סאנס', kind: 'sans', w: [300, 400, 700] },
  { id: 'alef', name: 'Alef', label: 'אלף', kind: 'sans', w: [400, 700] },
  { id: 'varela-round', name: 'Varela Round', label: 'ורלה', kind: 'sans', w: [400] },
  { id: 'secular-one', name: 'Secular One', label: 'חילוני', kind: 'display', w: [400] },
  { id: 'suez-one', name: 'Suez One', label: 'סואץ', kind: 'display', w: [400] },
  { id: 'amatic-sc', name: 'Amatic SC', label: 'אמטיק', kind: 'display', w: [400, 700] },
];
const out = path.join(root, 'fonts');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let css = '';
const meta = [];
const R = { hebrew: 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F', latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' };
for (const f of FONTS) {
  const dir = path.join(root, 'node_modules/@fontsource', f.id, 'files');
  for (const w of f.w) for (const sub of ['hebrew', 'latin']) {
    const file = `${f.id}-${sub}-${w}-normal.woff2`;
    if (!fs.existsSync(path.join(dir, file))) continue;
    fs.copyFileSync(path.join(dir, file), path.join(out, file));
    const w1 = file.replace('.woff2', '.woff');
    if (fs.existsSync(path.join(dir, w1))) fs.copyFileSync(path.join(dir, w1), path.join(out, w1)); // לשימוש בהטבעת כותרות ב-PDF (pdf-lib/fontkit)
    css += `@font-face{font-family:'${f.name}';font-style:normal;font-weight:${w};font-display:block;src:url('${file}') format('woff2');unicode-range:${R[sub]};}\n`;
  }
  meta.push({ name: f.name, label: f.label, kind: f.kind, weights: f.w });
}
fs.writeFileSync(path.join(out, 'fonts.css'), css);
fs.writeFileSync(path.join(out, 'fonts.json'), JSON.stringify(meta, null, 1));
console.log('fonts:', meta.length, 'size MB', (fs.readdirSync(out).reduce((a, f) => a + fs.statSync(path.join(out, f)).size, 0) / 1e6).toFixed(1));
