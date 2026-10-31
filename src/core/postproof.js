// הגהה אחרי עימוד — בדיקות דטרמיניסטיות על ה-PDF שהופק: נאמנות טקסט, עמודים, תוכן עניינים, מספור
const pdf = require('./pdf');
const heb = require('./hebrew');
const F = require('./formats');
const { MM } = require('./stamp');
const { NO_TOC } = require('./project');

const norm = (s) => heb.normalizeForCompare(s).replace(/[^\p{L}\p{N}]/gu, '');
const words = (s) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const stripMd = (t) => t.replace(/^#{1,6}\s*/gm, '').replace(/^>\s?/gm, '').replace(/^\s*[-*]\s+/gm, '').replace(/^\s*\d+\.\s+/gm, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\*\s\*\s\*/g, '').replace(/[*_`]/g, '');

async function run(project, pdfFile, { starts, frontCount, geometry } = {}) {
  const pages = await pdf.extractPages(pdfFile);
  const g = geometry;
  const L = project.data.layout;
  const issues = { blockers: [], warnings: [], notes: [] };
  const add = (lvl, page, msg, fix) => issues[lvl].push({ page, issue: msg, fix: fix || '' });
  const topY = g ? g.margins.top * MM - 4 : 40, botY = g ? (g.h - g.margins.bottom) * MM + 4 : 800;

  // 1) נאמנות טקסט — גוף הספר בלבד (מתחילת הפרק הראשון)
  const bodyPages = pages.slice(frontCount || 0);
  const bodyLines = [];
  bodyPages.forEach((p) => p.lines.forEach((l) => { if (l.y > topY && l.y < botY) bodyLines.push(l.text); }));
  const pdfText = norm(bodyLines.join(' '));
  const pdfWords = new Map(); words(bodyLines.join(' ')).forEach((w) => pdfWords.set(w, (pdfWords.get(w) || 0) + 1));
  let paras = 0, missing = 0, reordered = 0;
  for (const c of project.chapters()) {
    if (c.kind === 'dedication' || c.kind === 'epigraph') continue;
    const src = stripMd(project.readChapter(c));
    const ps = src.split(/\n{2,}/).map((s) => s.trim()).filter((s) => s.length >= 12);
    for (const p of ps) {
      paras++;
      const n = norm(p);
      if (pdfText.includes(n)) continue;
      const ws = words(p); if (!ws.length) continue;
      const found = ws.filter((w) => pdfWords.get(w) > 0).length / ws.length;
      if (found >= 0.97) { reordered++; continue; }
      missing++;
      add('blockers', null, `פסקה מהפרק “${c.title}” לא נמצאה במלואה ב-PDF: “${p.slice(0, 60)}…” (${Math.round(found * 100)}% מהמילים נמצאו)`, 'בדקו חיתוך/גלישה/גופן ללא תו');
    }
  }
  const fidelity = { paragraphs: paras, matched: paras - missing - reordered, reorderedBidi: reordered, missing };

  // 2) עמודים
  const starts0 = new Set(Object.values(starts || {}).map((n) => n - 1));
  pages.forEach((p, i) => {
    const n = i + 1;
    const body = p.lines.filter((l) => l.y > topY && l.y < botY);
    if (i >= (frontCount || 0)) {
      if (!body.length && !p.lines.length) {
        const nextOpener = starts0.has(i + 1);
        if (!nextOpener && i < pages.length - 1 && !(L.padSignature && i >= pages.length - 3)) add('warnings', n, 'עמוד ריק באמצע הגוף', 'אם לא מכוון — הסירו עמוד/הפרדה');
      } else if (body.length && body.length < 3 && !starts0.has(i) && i < pages.length - 1 && !starts0.has(i + 1)) {
        add('warnings', n, `עמוד כמעט ריק (${body.length} שורות)`, 'שקלו עריכה קלה או התאמת ריווח');
      }
      if (body.length > 2 && !starts0.has(i)) {
        const first = body[0];
        if (words(first.text).length <= 2 && first.text.length < 14 && !/^\d+$/.test(first.text)) add('warnings', n, `שורה ראשונה קצרה בראש עמוד (“${first.text}”) — סוף פסקה מיותם`, 'התאמת ריווח/עריכת שורה');
        const last = body[body.length - 1];
        const subs = project.chapters().flatMap((c) => (project.readChapter(c).match(/^#{2,4}\s+(.+)$/gm) || []).map((s) => norm(s.replace(/^#+\s+/, ''))));
        if (subs.includes(norm(last.text))) add('blockers', n, `כותרת משנה בתחתית עמוד: “${last.text}”`, 'הוסיפו הפרדה/keep-with-next');
      }
    }
    if (g && p.w && Math.abs(p.w - g.w * MM) > 2) add('blockers', n, 'גודל עמוד שונה מהמצופה');
  });

  // 3) מספור עמודים (כפי שהודבק)
  let prev = 0, badNum = 0;
  for (let i = frontCount || 0; i < pages.length; i++) {
    const foot = pages[i].lines.filter((l) => l.y >= botY - 2).map((l) => l.text).join(' ').match(/\b\d{1,4}\b/);
    if (!foot) continue;
    const num = Number(foot[0]);
    const exp = i - (frontCount || 0) + 1;
    if (num !== exp) { badNum++; if (badNum < 4) add('blockers', i + 1, `מספר עמוד מודפס ${num} במקום ${exp}`); }
    prev = num;
  }

  // 4) תוכן עניינים
  const tocPage = pages.findIndex((p) => /תוכן העניינים/.test(p.text.slice(0, 60)));
  if (tocPage >= 0 && starts) {
    const tocText = pages.slice(tocPage, (frontCount || tocPage + 1)).map((p) => p.lines.map((l) => l.text)).flat();
    for (const c of project.chapters()) {
      if (NO_TOC.has(c.kind) || !starts[c.id]) continue;
      const line = tocText.find((t) => norm(t).includes(norm(c.title)));
      const exp = starts[c.id] - (frontCount || 0);
      if (!line) { add('blockers', tocPage + 1, `הפרק “${c.title}” חסר בתוכן העניינים`); continue; }
      const nums = line.match(/\d+/g) || [];
      if (!nums.length || Number(nums[nums.length - 1]) !== exp && Number(nums[0]) !== exp) add('blockers', tocPage + 1, `בתוכן העניינים “${c.title}” מצביע על עמוד שגוי (צפוי ${exp}; שורה: ${line})`);
    }
  } else if (L.toc) add('warnings', null, 'לא אותר עמוד תוכן עניינים');

  // 5) כללי
  if (pages.length % 4) add('warnings', null, `מספר העמודים (${pages.length}) אינו כפולה של 4 — הדפוס יידרש להוסיף עמודים`);
  if (pages.length < 24) add('notes', null, 'פחות מ־24 עמודים — חלק ממדפיסי הדפוס לפי דרישה לא יקבלו; ללא שדרה עם טקסט מתחת ל־79 עמודים');
  add('notes', null, `סה״כ ${pages.length} עמודים (${frontCount} עמודי חזית); עובי שדרה משוער: ${F.coverGeometry({ trimId: L.trim, customW: L.customW, customH: L.customH, pages: pages.length, paperId: L.paper, bindingId: L.binding }).spine} מ״מ`);

  const frontText = pages.slice(0, (frontCount || 0)).map((p) => `--- עמוד ${p.n} ---\n${p.text}`).join('\n');
  return { passed: issues.blockers.length === 0, ...issues, fidelity, pages: pages.length, frontText, summary: { blockers: issues.blockers.length, warnings: issues.warnings.length, fidelity } };
}

module.exports = { run };
