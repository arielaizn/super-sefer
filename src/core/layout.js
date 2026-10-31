// בניית ה-HTML של פנים הספר (CSS מודפס): חזית, תוכן עניינים, פרקים, איורים
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { marked } = require('marked');
const F = require('./formats');
const heb = require('./hebrew');
const { KINDS, NO_TOC } = require('./project');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fontsDir() {
  const d = path.join(__dirname, '..', '..', 'fonts');
  const un = d.replace('app.asar', 'app.asar.unpacked');
  return fs.existsSync(un) ? un : d;
}
function fontCss() {
  const dir = fontsDir();
  return fs.readFileSync(path.join(dir, 'fonts.css'), 'utf8').replace(/url\('([^']+)'\)/g, (_, f) => `url('${pathToFileURL(path.join(dir, f)).href}')`);
}
function fontList() { return JSON.parse(fs.readFileSync(path.join(fontsDir(), 'fonts.json'), 'utf8')); }

// ---- גיאומטריה והגדרות אפקטיביות ----
function geometry(project) {
  const L = project.data.layout;
  const t = F.trim(L.trim);
  const w = L.trim === 'custom' ? L.customW : t.w, h = L.trim === 'custom' ? L.customH : t.h;
  const est = Math.max(60, Math.round(project.totalWords() / (230 * (w * h) / (140 * 210))) + 12);
  const rec = F.recommend(L.trim === 'custom' ? 'a5' : L.trim, est, project.data.genre);
  if (L.trim === 'custom') { const o = Math.max(14, w * 0.105); rec.margins = { top: Math.max(16, h * 0.085), bottom: Math.max(16, h * 0.085) * 1.25, outer: o, inner: o + 10 }; }
  const m = { ...rec.margins, ...(L.margins || {}) };
  return { w, h, margins: m, fontSize: L.fontSize || rec.fontSize, lineHeight: L.lineHeight || rec.lineHeight, est };
}

function chapterNumbers(project) {
  let n = 0; const map = {};
  for (const c of project.chapters()) if (c.kind === 'chapter') map[c.id] = ++n;
  return map;
}

// ---- Markdown -> HTML ----
function mdToHtml(md, { project, chapterDir = '..' } = {}) {
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => `<h${Math.min(4, Math.max(2, depth + (depth === 1 ? 1 : 0)))}>${marked.Parser.parseInline(tokens)}</h${Math.min(4, Math.max(2, depth + (depth === 1 ? 1 : 0)))}>`;
  renderer.hr = () => `<div class="sb"><span>${esc(project.data.layout.sceneBreak || '❦')}</span></div>`;
  renderer.image = ({ href, title, text }) => {
    const src = /^(https?:|file:|data:|\/)/.test(href) ? href : path.posix.join(chapterDir, href);
    return `<figure><img src="${esc(src)}" alt="${esc(text)}">${title || text ? `<figcaption>${esc(title || text)}</figcaption>` : ''}</figure>`;
  };
  renderer.em = ({ tokens }) => `<em>${marked.Parser.parseInline(tokens)}</em>`;
  renderer.html = ({ text }) => esc(text);
  return marked.parse(md, { gfm: true, breaks: false, renderer });
}

function smart(text, on) {
  if (!on) return text;
  const issues = heb.lintText(text);
  return heb.applyFixes(text, issues, ['straight-quote', 'gershayim', 'geresh', 'hyphen-dash', 'dialogue-dash', 'ellipsis', 'double-space', 'space-before-punct', 'trailing-space', 'invisible']).text;
}

// ---- CSS ----
function css(project, g) {
  const L = project.data.layout;
  const { margins: m } = g;
  const body = L.fontBody, head = L.fontHead, sans = L.fontSans;
  const pt = g.fontSize;
  return `
${fontCss()}
@page { size: ${g.w}mm ${g.h}mm; margin: ${m.top}mm ${m.outer}mm ${m.bottom}mm ${m.inner}mm; }
@page :left  { margin-right: ${m.inner}mm; margin-left: ${m.outer}mm; }
@page :right { margin-left: ${m.inner}mm; margin-right: ${m.outer}mm; }
:root { --body: '${body}', 'Noto Serif Hebrew', serif; --head: '${head}', serif; --sans: '${sans}', sans-serif; --fs: ${pt}pt; --lh: ${g.lineHeight}; --ind: ${L.indent}em; }
* { box-sizing: border-box; }
html { direction: rtl; font-family: var(--body); font-size: var(--fs); line-height: var(--lh); font-weight: ${L.weightBody || 400}; color: #1b1a17; -webkit-print-color-adjust: exact; text-rendering: optimizeLegibility; font-kerning: normal; font-variant-numeric: lining-nums; }
body { margin: 0; }
p { margin: 0; text-align: ${L.justify ? 'justify' : 'right'}; text-justify: inter-word; hyphens: none; orphans: ${L.orphans}; widows: ${L.widows}; text-indent: var(--ind); overflow-wrap: break-word; }
.opener + p, h2 + p, h3 + p, h4 + p, .sb + p, blockquote + p, figure + p, .epi + p, .first p:first-child { text-indent: 0; }
${L.dropCap ? `.opener + p::first-letter, .first::first-letter { float: right; font-family: var(--head); font-size: 3.1em; line-height: 0.82; padding-left: 0.08em; font-weight: 700; }` : ''}
em { font-style: normal; font-weight: 700; }
strong { font-weight: 900; }
h1, h2, h3, h4 { font-family: var(--head); line-height: 1.25; break-after: avoid; page-break-after: avoid; margin: 0; }
h2 { font-size: 1.28em; font-weight: 700; margin: 1.6em 0 0.7em; text-align: right; break-inside: avoid; }
h3 { font-size: 1.1em; font-weight: 700; margin: 1.3em 0 0.5em; }
h4 { font-size: 1em; font-weight: 700; margin: 1em 0 0.4em; }
blockquote { margin: 0.9em 1.6em; font-size: 0.94em; break-inside: avoid; }
blockquote p { text-indent: 0; }
ul, ol { margin: 0.6em 0; padding-inline-start: 1.6em; } li { margin: 0.15em 0; text-align: right; }
.sb { text-align: center; margin: 1.1em 0; letter-spacing: 0.4em; color: #55504a; break-inside: avoid; }
figure { margin: 1.1em 0; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: ${g.h - m.top - m.bottom - 24}mm; object-fit: contain; }
figcaption { font-size: 0.78em; margin-top: 0.4em; color: #55504a; font-family: var(--sans); }
section { break-before: page; }
.blank { break-before: page; height: 1px; }
.fm-page { break-before: page; position: relative; min-height: ${g.h - m.top - m.bottom - 2}mm; }
.half { display: flex; align-items: center; justify-content: center; text-align: center; min-height: ${g.h - m.top - m.bottom - 2}mm; }
.half h1 { font-size: 1.9em; font-weight: 700; }
.titlep { text-align: center; padding-top: ${Math.round(g.h * 0.16)}mm; }
.titlep h1 { font-size: 2.6em; line-height: 1.12; font-weight: 700; margin-bottom: 0.25em; }
.titlep .sub { font-size: 1.15em; margin: 0.6em 0 0; color: #3a362f; }
.titlep .orn { margin: 1.6em 0; letter-spacing: .6em; color: #6a6358; }
.titlep .author { font-family: var(--head); font-size: 1.35em; letter-spacing: 0.04em; }
.titlep .pub { position: absolute; bottom: 4mm; left: 0; right: 0; font-size: 0.9em; font-family: var(--sans); letter-spacing: .06em; color: #4a463f; }
.copyp { position: absolute; bottom: 4mm; right: 0; left: 0; font-size: 0.78em; line-height: 1.6; font-family: var(--sans); color: #36322c; text-align: right; }
.copyp p { text-indent: 0; text-align: right; margin: 0 0 0.5em; }
.dedic { display: flex; align-items: center; justify-content: center; min-height: ${g.h - m.top - m.bottom - 2}mm; text-align: center; padding: 0 ${Math.round(g.w * 0.12)}mm; }
.dedic div { font-size: 1.08em; line-height: 1.7; } .dedic p { text-indent: 0; text-align: center; }
.epi { text-align: center; padding-top: ${Math.round(g.h * 0.2)}mm; font-size: 0.98em; } .epi p { text-indent: 0; text-align: center; }
.toc h1 { font-size: 1.7em; text-align: center; margin: ${Math.round(g.h * 0.035)}mm 0 ${Math.round(g.h * 0.045)}mm; font-weight: 700; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; gap: 0.4em; margin: 0.55em 0; text-align: right; break-inside: avoid; }
.toc li .t { flex: 0 1 auto; max-width: 82%; } .toc li .n { font-family: var(--sans); font-size: 0.78em; color: #55504a; margin-inline-end: .35em; font-variant-numeric: tabular-nums; }
.toc li .fill { flex: 1 1 auto; border-bottom: 0.7pt dotted #8c857a; transform: translateY(-0.28em); min-width: 1em; }
.toc li .pgn { flex: 0 0 auto; font-variant-numeric: tabular-nums; }
.toc li.part { margin-top: 1.1em; font-weight: 700; font-family: var(--head); }
.ch { break-before: page; }
.opener { padding-top: ${L.chapterTopSpace}mm; margin-bottom: 2.2em; text-align: ${L.headerStyle === 'center' ? 'center' : 'right'}; break-after: avoid; }
.opener .kick { font-family: var(--sans); font-size: 0.72em; letter-spacing: 0.32em; text-transform: uppercase; color: #6a6358; margin-bottom: 0.9em; }
.opener h1 { font-size: 2.1em; font-weight: 700; line-height: 1.15; }
.opener .orn { margin-top: 0.9em; letter-spacing: .4em; color: #8c857a; }
.opener figure { margin: 1.4em 0 0; }
.ill-full { break-before: page; display:flex; align-items:center; justify-content:center; height: ${g.h - m.top - m.bottom - 2}mm; }
.ill-full img { max-width: 100%; max-height: 100%; }
.colophon { text-align: center; font-size: 0.82em; padding-top: ${Math.round(g.h * 0.25)}mm; font-family: var(--sans); color: #4a463f; } .colophon p { text-indent: 0; text-align: center; }
`;
}

// ---- בניית מסמך ----
// plan: { blankBefore:Set<chapterId>, toc:{chapterId:number}, frontBlanks }
function buildHtml(project, plan = {}, opts = {}) {
  const d = project.data, L = d.layout;
  const g = geometry(project);
  const nums = chapterNumbers(project);
  const blanks = plan.blankBefore || new Set();
  const toc = plan.toc || {};
  const out = [];
  const label = (c) => c.kind === 'chapter' ? `${L.chapterLabel || 'פרק'} ${nums[c.id]}` : (KINDS[c.kind] || '');
  const chapters = project.chapters();
  const frontKinds = new Set(['dedication', 'epigraph']);
  const front = chapters.filter((c) => frontKinds.has(c.kind));
  const bodyC = chapters.filter((c) => !frontKinds.has(c.kind));

  let fm = 0; // ספירת עמודי חזית משוערת לצורך שמירה על צד (recto/verso) — עמודים בודדים
  const fmPage = (cls, html, side = 'any') => {
    if (side === 'recto' && fm % 2 === 1) { out.push('<div class="blank"></div>'); fm++; }
    if (side === 'verso' && fm % 2 === 0) { out.push('<div class="blank"></div>'); fm++; }
    out.push(`<section class="fm-page ${cls}" data-fm="${cls}">${html}</section>`); fm++;
  };
  if (L.halfTitle) fmPage('half', `<h1>${esc(d.title)}</h1>`, 'recto');
  if (L.titlePage) fmPage('titlep', `<h1>${esc(d.title)}</h1>${d.subtitle ? `<div class="sub">${esc(d.subtitle)}</div>` : ''}<div class="orn">${esc(L.sceneBreak || '❦')}</div><div class="author">${esc(d.author)}</div>${d.publisher ? `<div class="pub">${esc(d.publisher)}</div>` : ''}`, 'recto');
  if (L.copyrightPage) {
    const lines = [`© ${esc(d.year)} ${esc(d.author)}. כל הזכויות שמורות.`, d.publisher ? esc(d.publisher) : '', d.isbn ? `ISBN ${esc(d.isbn)}` : '', L.copyrightText ? esc(L.copyrightText).replace(/\n/g, '<br>') : 'אין להעתיק, לשכפל, לצלם, להקליט או לשדר קטע כלשהו מספר זה בכל דרך או אמצעי ללא אישור בכתב מבעל הזכויות.', 'עימוד: סופר-ספר'].filter(Boolean);
    fmPage('copyrt', `<div class="copyp">${lines.map((l) => `<p>${l}</p>`).join('')}</div>`, 'verso');
  }
  for (const c of front.filter((c) => c.kind === 'dedication')) fmPage('dedic', `<div>${mdToHtml(smart(project.readChapter(c), opts.smart !== false), { project })}</div>`, 'recto');
  for (const c of front.filter((c) => c.kind === 'epigraph')) fmPage('epi', mdToHtml(smart(project.readChapter(c), opts.smart !== false), { project }), 'recto');

  if (L.toc) {
    const items = bodyC.filter((c) => !NO_TOC.has(c.kind)).map((c) => {
      const n = c.kind === 'chapter' ? `<span class="n">${nums[c.id]}</span>` : '';
      return `<li class="${c.kind === 'part' ? 'part' : ''}">${n}<span class="t">${esc(c.title)}</span><span class="fill"></span><span class="pgn">${toc[c.id] ?? '000'}</span></li>`;
    });
    if (fm % 2 === 1 || true) { if (fm % 2 === 0) { /* recto */ } else { out.push('<div class="blank"></div>'); fm++; } }
    out.push(`<section class="fm-page toc" data-fm="toc"><h1>תוכן העניינים</h1><ol>${items.join('')}</ol></section>`);
  }

  // גוף
  bodyC.forEach((c, i) => {
    if (blanks.has(c.id)) out.push('<div class="blank" data-pad="1"></div>');
    const md = smart(project.readChapter(c), opts.smart !== false);
    const hasTitle = c.kind !== 'part';
    const ill = c.illustration && c.illustration.file ? c.illustration : null;
    const illHtml = ill && ill.placement !== 'full' ? `<figure><img src="${esc(path.posix.join('..', ill.file))}" alt="${esc(ill.alt || '')}">${ill.caption ? `<figcaption>${esc(ill.caption)}</figcaption>` : ''}</figure>` : '';
    out.push(`<section class="ch kind-${c.kind}" data-ch="${c.id}"><header class="opener"><div class="kick">${esc(label(c))}</div><h1>${esc(c.title)}</h1><div class="orn">${esc(L.sceneBreak || '❦')}</div>${illHtml}</header><div class="chbody">${mdToHtml(md, { project })}</div></section>`);
    if (ill && ill.placement === 'full') out.push(`<div class="ill-full" data-ill="${c.id}"><img src="${esc(path.posix.join('..', ill.file))}" alt="${esc(ill.alt || '')}"></div>`);
  });

  if (L.colophon) out.push(`<section class="fm-page colophon" data-end="1">${L.colophon.split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}</section>`);

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>${css(project, g)}</style></head><body>${out.join('\n')}</body></html>`;
}

module.exports = { buildHtml, geometry, chapterNumbers, mdToHtml, fontList, fontsDir, fontCss, esc };
