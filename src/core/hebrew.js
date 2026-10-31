// כלי לשון וטיפוגרפיה עברית: בדיקות הגהה דטרמיניסטיות ותיקונים בטוחים
// כללי הסימון לפי האקדמיה ללשון העברית ומקובלות טיפוגרפיית הספר העברי.
const HEB = 'א-ת';
const NIQ = '֑-ׇ';
const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const TO_FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };
const GERESH = '׳', GERSHAYIM = '״', MAQAF = '־';

const isHeb = (c) => !!c && c >= 'א' && c <= 'ת';
const isMark = (c) => !!c && c >= '֑' && c <= 'ׇ' && c !== MAQAF;

function lineCol(text, idx) {
  let line = 1, last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < idx; i = text.indexOf('\n', i + 1)) { line++; last = i; }
  return { line, col: idx - last };
}

function stripCode(text) {
  // מסתיר קוד/קישורי תמונה כדי שלא ייבדקו (שומר אורכים)
  return text.replace(/```[\s\S]*?```|`[^`\n]*`|!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|https?:\/\/\S+/g, (m) => ' '.repeat(m.length));
}

const RULES = {
  'double-space': { sev: 'warn', msg: 'רווח כפול' },
  'space-before-punct': { sev: 'error', msg: 'רווח לפני סימן פיסוק' },
  'no-space-after-punct': { sev: 'warn', msg: 'חסר רווח אחרי סימן פיסוק' },
  'straight-quote': { sev: 'warn', msg: 'מירכאות ישרות — יש להחליף במירכאות טיפוגרפיות' },
  'gershayim': { sev: 'warn', msg: 'מירכאות כפולות בתוך מילה (ראשי תיבות) — יש להשתמש בגרשיים ״' },
  'geresh': { sev: 'warn', msg: 'גרש ישר — יש להשתמש בגרש ׳' },
  'hyphen-dash': { sev: 'warn', msg: 'מקף מפריד (קו) בין רווחים — יש להשתמש בקו מפריד ארוך –' },
  'dialogue-dash': { sev: 'info', msg: 'מקף בתחילת שורת דיבור — אחידות: קו מפריד –' },
  'ellipsis': { sev: 'warn', msg: 'שלוש נקודות — יש להשתמש בתו שלוש־נקודות …' },
  'maqaf': { sev: 'info', msg: 'מקף עברי: מומלץ להשתמש במקף העברי ־ (U+05BE) בין מילים עבריות' },
  'final-letter-missing': { sev: 'error', msg: 'אות לא סופית בסוף מילה' },
  'final-letter-mid': { sev: 'error', msg: 'אות סופית באמצע מילה' },
  'repeated-word': { sev: 'info', msg: 'מילה כפולה ברצף' },
  'unbalanced': { sev: 'error', msg: 'סימן פתיחה/סגירה לא מאוזן בפסקה' },
  'mixed-script': { sev: 'warn', msg: 'אותיות עבריות ולטיניות צמודות' },
  'multi-punct': { sev: 'warn', msg: 'סימני פיסוק חוזרים' },
  'paren-space': { sev: 'warn', msg: 'רווח מיותר בתוך סוגריים' },
  'invisible': { sev: 'info', msg: 'תו בלתי נראה / בקרת כיוון תקלות' },
  'trailing-space': { sev: 'info', msg: 'רווחים בסוף שורה' },
  'period-no-space': { sev: 'warn', msg: 'נקודה בלי רווח אחריה' },
  'digit-mix': { sev: 'info', msg: 'ספרות הודיות/ערביות בתוך טקסט עברי' },
};

function lintText(raw, opts = {}) {
  const text = stripCode(raw);
  const issues = [];
  const add = (rule, index, length, fix, extra = {}) => {
    const r = RULES[rule];
    const { line, col } = lineCol(raw, index);
    issues.push({ rule, severity: r.sev, message: r.msg, index, length, line, col, match: raw.substr(index, length), fix: fix === undefined ? null : fix, ...extra });
  };
  let m;

  // רווחים
  const reDouble = / {2,}(?=\S)/g; // לא בתחילת שורה (הזחה)
  while ((m = reDouble.exec(text))) { if (m.index === 0 || text[m.index - 1] === '\n') continue; add('double-space', m.index, m[0].length, ' '); }
  const reTrail = /[ \t]+$/gm;
  while ((m = reTrail.exec(text))) add('trailing-space', m.index, m[0].length, '');

  // רווח לפני פיסוק
  const reSpP = new RegExp(`([${HEB}${NIQ}\\w"”’׳״\\)])[ \\t]+([,.;:!?])(?=[\\s"”’\\)]|$)`, 'g');
  while ((m = reSpP.exec(text))) add('space-before-punct', m.index + m[1].length, m[0].length - m[1].length, m[2]);

  // רווח אחרי פיסוק (פסיק, נקודה-פסיק, נקודתיים, סימני קריאה/שאלה) בין אותיות
  const reNoSp = new RegExp(`([${HEB}${NIQ}])([,;:!?])([${HEB}A-Za-z])`, 'g');
  while ((m = reNoSp.exec(text))) add('no-space-after-punct', m.index + 1, 1, m[2] + ' ');
  const rePeriod = new RegExp(`([${HEB}${NIQ}]{2,})\\.([${HEB}])`, 'g');
  while ((m = rePeriod.exec(text))) add('period-no-space', m.index + m[1].length, 1, '. ');

  // מירכאות וגרש
  const reGershayim = new RegExp(`([${HEB}])"([${HEB}])`, 'g');
  while ((m = reGershayim.exec(text))) add('gershayim', m.index + 1, 1, GERSHAYIM);
  const reGeresh = new RegExp(`([${HEB}${NIQ}])'(?![${HEB}])|(^|[\\s(])'(?=[${HEB}])`, 'gm');
  // גרש אחרי אות (ג'ינס, ת') — לא ציטוט בודד
  const reGeresh2 = new RegExp(`([${HEB}])'`, 'g');
  while ((m = reGeresh2.exec(text))) add('geresh', m.index + 1, 1, GERESH);

  // מירכאות ישרות לציטוט: מזווגים בתוך הפסקה
  const paras = [];
  const rePara = /[^\n]+/g;
  while ((m = rePara.exec(text))) paras.push({ s: m.index, t: m[0] });
  for (const p of paras) {
    const qs = [];
    const re = /"/g; let q;
    while ((q = re.exec(p.t))) {
      const prev = p.t[q.index - 1], next = p.t[q.index + 1];
      if (isHeb(prev) && isHeb(next)) continue; // גרשיים — טופל
      qs.push(q.index);
    }
    qs.forEach((qi, i) => add('straight-quote', p.s + qi, 1, i % 2 === 0 ? '“' : '”'));
    if (qs.length % 2 === 1) add('unbalanced', p.s + qs[qs.length - 1], 1, null, { message: 'מירכאות ישרות לא מזווגות בפסקה' });
    // איזון
    const bal = (open, close, name) => {
      const o = (p.t.match(new RegExp(`\\${open}`, 'g')) || []).length, c = (p.t.match(new RegExp(`\\${close}`, 'g')) || []).length;
      if (o !== c) add('unbalanced', p.s, Math.min(p.t.length, 40), null, { message: `${name} לא מאוזנים בפסקה (${o} פותחים, ${c} סוגרים)` });
    };
    bal('(', ')', 'סוגריים'); bal('[', ']', 'סוגריים מרובעים'); bal('“', '”', 'מירכאות “ ”');
    bal('«', '»', 'מירכאות « »');
  }

  // מקפים
  const reDash = / [-‐‑] /g;
  while ((m = reDash.exec(text))) {
    const ls = text.lastIndexOf('\n', m.index) + 1;
    if (/^\s*[-–—]\s/.test(text.slice(ls, m.index + 2)) && ls === m.index - (text.slice(ls, m.index).length)) {
      /* תחילת שורה — נטפל בנפרד */
    }
    add('hyphen-dash', m.index + 1, 1, '–');
  }
  const reDD = / -- |--/g;
  while ((m = reDD.exec(text))) add('hyphen-dash', m.index, m[0].length, m[0].startsWith(' ') ? ' – ' : '–');
  const reDlg = /^([ \t]*)-(?= )/gm;
  while ((m = reDlg.exec(text))) add('dialogue-dash', m.index + m[1].length, 1, '–');
  const reMaqaf = new RegExp(`([${HEB}${NIQ}])-(?=[${HEB}])`, 'g');
  while ((m = reMaqaf.exec(text))) add('maqaf', m.index + m[1].length, 1, MAQAF);

  // שלוש נקודות
  const reEll = /(?<!\.)\.{3}(?!\.)|\. \. \./g;
  while ((m = reEll.exec(text))) add('ellipsis', m.index, m[0].length, '…');

  // פיסוק חוזר
  const reMulti = /([,;:])\1+|(?<!\.)\.\.(?!\.)|!{3,}|\?{3,}/g;
  while ((m = reMulti.exec(text))) add('multi-punct', m.index, m[0].length, m[0][0] === '!' ? '!' : m[0][0] === '?' ? '?' : m[0][0]);

  // סוגריים
  const reParen = /\([ \t]+\S|\S[ \t]+\)/g;
  while ((m = reParen.exec(text))) {
    const s = m[0];
    add('paren-space', m.index, s.length, s.replace(/\([ \t]+/, '(').replace(/[ \t]+\)/, ')'));
  }

  // תווים בלתי נראים
  const reInv = /[​‎‏‪-‮⁦-⁩﻿ ]/g;
  while ((m = reInv.exec(text))) {
    if (m[0] === ' ') add('invisible', m.index, 1, ' ', { message: 'רווח קשיח (NBSP) — ודאו שהוא מכוון' });
    else add('invisible', m.index, 1, '');
  }

  // ספרות ערביות
  const reDig = /[٠-٩۰-۹]/g;
  while ((m = reDig.exec(text))) add('digit-mix', m.index, 1, String.fromCharCode(48 + (m[0].charCodeAt(0) & 0xF) % 10));

  // אותיות סופיות ומילים
  const reWord = new RegExp(`[${HEB}${NIQ}]+`, 'g');
  while ((m = reWord.exec(text))) {
    const w = m[0];
    const letters = [...w].filter((c) => isHeb(c));
    if (letters.length < 2) continue;
    // אות סופית באמצע
    for (let i = 0; i < w.length; i++) {
      const c = w[i];
      if (FINAL[c]) {
        let j = i + 1; while (j < w.length && isMark(w[j])) j++;
        if (j < w.length) add('final-letter-mid', m.index + i, 1, FINAL[c], { word: w, message: `אות סופית באמצע מילה: “${w}”` });
      }
    }
    // אות רגילה בסוף
    let e = w.length - 1; while (e > 0 && isMark(w[e])) e--;
    const last = w[e];
    if (TO_FINAL[last]) {
      const after = text[m.index + w.length];
      const before = text[m.index - 1];
      // מותר: לפני מקף/גרש (כ־10, ג׳), ולפני מקף עברי; שמות לועזיים אינם מסומנים
      if (after === '-' || after === MAQAF || after === "'" || after === GERESH || after === '"' || after === GERSHAYIM) continue;
      if (before === "'" || before === GERESH) continue;
      add('final-letter-missing', m.index + e, 1, TO_FINAL[last], { word: w, message: `אות לא סופית בסוף מילה: “${w}” — אולי “${w.slice(0, e)}${TO_FINAL[last]}${w.slice(e + 1)}”` });
    }
  }

  // עברית ולטינית צמודות
  const reMix = new RegExp(`[${HEB}][A-Za-z]|[A-Za-z][${HEB}]`, 'g');
  while ((m = reMix.exec(text))) add('mixed-script', m.index, 2, null);

  // מילה כפולה
  const reRep = new RegExp(`(?<![${HEB}])([${HEB}${NIQ}]{2,})[ \\t]+\\1(?![${HEB}])`, 'g');
  while ((m = reRep.exec(text))) add('repeated-word', m.index, m[0].length, null, { message: `מילה כפולה: “${m[1]}”` });

  issues.sort((a, b) => a.index - b.index || a.length - b.length);
  return dedupe(issues);
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((i) => { const k = `${i.rule}:${i.index}:${i.length}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// החלת תיקונים בטוחים (לא חופפים). rules — אילו כללים לתקן
function applyFixes(text, issues, rules) {
  const todo = issues.filter((i) => i.fix !== null && (!rules || rules.includes(i.rule))).sort((a, b) => a.index - b.index);
  let out = '', pos = 0, n = 0;
  for (const i of todo) {
    if (i.index < pos) continue;
    out += text.slice(pos, i.index) + i.fix;
    pos = i.index + i.length;
    n++;
  }
  out += text.slice(pos);
  return { text: out, fixed: n };
}

const SAFE_FIX_RULES = ['double-space', 'space-before-punct', 'no-space-after-punct', 'gershayim', 'geresh', 'hyphen-dash', 'dialogue-dash', 'ellipsis', 'multi-punct', 'paren-space', 'trailing-space', 'final-letter-missing', 'final-letter-mid', 'period-no-space', 'straight-quote', 'invisible', 'digit-mix'];

function summarize(issues) {
  const by = {};
  for (const i of issues) by[i.rule] = (by[i.rule] || 0) + 1;
  return { total: issues.length, errors: issues.filter((i) => i.severity === 'error').length, warns: issues.filter((i) => i.severity === 'warn').length, infos: issues.filter((i) => i.severity === 'info').length, byRule: by };
}

// נרמול להשוואה בין מקור ל-PDF (להסרת הבדלי רווח/ניקוד/פיסוק טיפוגרפי)
function normalizeForCompare(s) {
  return s
    .replace(/[֑-ׇ]/g, '')
    .replace(/[‐-―־-]/g, '-')
    .replace(/[“”„״"]/g, '"')
    .replace(/[‘’׳']/g, "'")
    .replace(/…/g, '...')
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[*_#>`~|\\]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function wordCount(s) { return (s.match(/[\p{L}\p{N}]+/gu) || []).length; }

module.exports = { lintText, applyFixes, summarize, SAFE_FIX_RULES, RULES, normalizeForCompare, wordCount, lineCol, GERESH, GERSHAYIM, MAQAF };
