// פרופיל סגנון כתיבה של המשתמש — נבנה מהטקסט שהוקלד, פרק אחר פרק (מדדים דטרמיניסטיים + דוגמאות מייצגות)
const { wordCount } = require('./hebrew');

const STOP = new Set(('של על אל את עם הוא היא הם הן אני אתה את אנחנו אתם גם לא כי אם אבל או מה זה זו זאת אלה היה היתה היו יש אין כל כך עוד רק כמו אשר ש־ שלא לי לו לה להם לנו לך בו בה בהם בי בך מן מי כאן שם אז כבר הרבה מאוד אחד אחת פעם עד אחרי לפני ואז וגם ולא והוא והיא ואני מהם ממנו ממנה עליו עליה עליהם אותו אותה אותם אותי אותך').split(/\s+/));
const COLLOQ = ['פשוט', 'ממש', 'נו', 'יאללה', 'אחי', 'וואלה', 'בקיצור', 'סבבה', 'חבל"ה', 'די', 'מגניב', 'חחח', 'אוקיי', 'אוקי', 'כאילו', 'בעצם', 'תכלס', 'לגמרי', 'מטורף', 'טיפה'];
const FORMAL = ['אשר', 'הואיל', 'לפיכך', 'עם זאת', 'כאמור', 'ברם', 'אולם', 'לפיכך', 'משום כך', 'מכאן', 'דהיינו', 'אפוא', 'הלא', 'בהיותו', 'כלומר', 'לאמור', 'מאחר ש'];
const FIRST = ['אני', 'שלי', 'אותי', 'לי', 'אנחנו', 'שלנו'];

function sentences(text) {
  return text.replace(/[#>*_`]/g, '').split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => wordCount(s) >= 1);
}
function paragraphs(text) { return text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean); }
function words(text) { return (text.toLowerCase().match(/[\p{L}־']+/gu) || []); }
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function ngrams(ws, n, min = 3) {
  const m = new Map();
  for (let i = 0; i + n <= ws.length; i++) {
    const g = ws.slice(i, i + n);
    if (g.every((w) => STOP.has(w) || w.length < 2)) continue;
    const k = g.join(' '); m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => ({ phrase: k, count: c }));
}

function analyze(texts, telemetry = {}) {
  const text = texts.join('\n\n');
  const ws = words(text);
  const total = ws.length;
  if (total < 30) return { ready: false, totalWords: total, note: 'נדרשות לפחות ~30 מילים כדי לבנות פרופיל; מומלץ 1,500+ לדיוק גבוה.' };
  const sents = sentences(text);
  const sl = sents.map(wordCount);
  const paras = paragraphs(text);
  const pl = paras.map(wordCount);
  const freq = new Map();
  for (const w of ws) if (!STOP.has(w) && w.length > 2) freq.set(w, (freq.get(w) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([w, c]) => ({ word: w, count: c }));
  const per1k = (re) => Math.round(((text.match(re) || []).length / total) * 1000 * 10) / 10;
  const count = (list) => list.reduce((a, w) => a + (text.match(new RegExp('(?<![\\u05D0-\\u05EA])' + w + '(?![\\u05D0-\\u05EA])', 'g')) || []).length, 0);
  const dialogueLines = text.split('\n').filter((l) => /^\s*([–—-]|["“])/.test(l)).length;
  const lines = text.split('\n').filter((l) => l.trim()).length;
  const openers = new Map();
  for (const s of sents) { const w = words(s)[0]; if (w) openers.set(w, (openers.get(w) || 0) + 1); }
  const topOpeners = [...openers.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w, c]) => ({ word: w, share: Math.round((c / sents.length) * 100) }));
  const uniq = new Set(ws.slice(0, 2000)).size / Math.min(ws.length, 2000);

  // דוגמאות מייצגות — פסקאות קרובות לחציון באורך ועם מגוון פיסוק
  const med = pct(pl, 0.5);
  const exemplars = paras.filter((p) => wordCount(p) >= 18).map((p) => ({ p, d: Math.abs(wordCount(p) - med) - (new Set(p.match(/[,.;:!?…–—"“()]/g) || []).size) * 2 }))
    .sort((a, b) => a.d - b.d).slice(0, 5).map((x) => x.p.length > 700 ? x.p.slice(0, 700) + '…' : x.p);

  const m = {
    ready: true, totalWords: total, sentences: sents.length,
    avgSentenceWords: Math.round(mean(sl) * 10) / 10, sentenceSd: Math.round(sd(sl) * 10) / 10, sentenceP10: pct(sl, 0.1), sentenceP90: pct(sl, 0.9),
    shortSentenceShare: Math.round((sl.filter((x) => x <= 5).length / sl.length) * 100),
    longSentenceShare: Math.round((sl.filter((x) => x >= 25).length / sl.length) * 100),
    avgParagraphWords: Math.round(mean(pl)), paragraphP90: pct(pl, 0.9),
    avgWordLength: Math.round(mean(ws.map((w) => w.length)) * 100) / 100,
    lexicalVariety: Math.round(uniq * 100),
    punct: { comma: per1k(/,/g), period: per1k(/\./g), question: per1k(/\?/g), exclaim: per1k(/!/g), ellipsis: per1k(/…|\.\.\./g), dash: per1k(/[–—]/g), colon: per1k(/:/g), semicolon: per1k(/;/g), parens: per1k(/\(/g), quotes: per1k(/[“"]/g) },
    dialogueShare: Math.round((dialogueLines / Math.max(1, lines)) * 100),
    firstPersonPer1k: Math.round((count(FIRST) / total) * 1000),
    colloquialPer1k: Math.round((count(COLLOQ) / total) * 1000 * 10) / 10,
    formalPer1k: Math.round((count(FORMAL) / total) * 1000 * 10) / 10,
    topWords: top, favoritePhrases: [...ngrams(ws, 3, 3), ...ngrams(ws, 2, 5)].slice(0, 12), topOpeners, exemplars,
    revision: telemetry.typed ? { typed: telemetry.typed, deleted: telemetry.deleted, deleteRatio: Math.round((telemetry.deleted / Math.max(1, telemetry.typed)) * 100) } : null,
    at: new Date().toISOString(),
  };
  m.register = m.formalPer1k > m.colloquialPer1k * 1.5 ? 'גבוה/ספרותי' : m.colloquialPer1k > 4 ? 'דיבורי/שיחתי' : 'ניטרלי-תקני';
  m.rhythm = m.avgSentenceWords < 9 ? 'קצבי וקצר' : m.avgSentenceWords < 15 ? 'בינוני, מאוזן' : m.avgSentenceWords < 22 ? 'זורם וארוך' : 'מתפתל, משפטים ארוכים מאוד';
  return m;
}

// תיאור קריא למודל — "מדריך הקול" של המחבר/ת
function toPromptBlock(m, extra = {}) {
  if (!m || !m.ready) return 'פרופיל הסגנון עדיין לא נבנה (אין מספיק טקסט מהמחבר/ת). שמרו על ניטרליות, ועל טבעיות; אל תמציאו קול.';
  const p = m.punct;
  const L = [
    `# טביעת האצבע הסגנונית של המחבר/ת (נבנתה מ־${m.totalWords} מילים)`,
    `- קצב: ${m.rhythm}. משפט ממוצע ${m.avgSentenceWords} מילים (סטיית תקן ${m.sentenceSd}; 10%–90%: ${m.sentenceP10}–${m.sentenceP90}). משפטים קצרים (≤5 מילים): ${m.shortSentenceShare}%, ארוכים (≥25): ${m.longSentenceShare}%.`,
    `- פסקאות: ממוצע ${m.avgParagraphWords} מילים (90%: עד ${m.paragraphP90}).`,
    `- רמת לשון: ${m.register} (ביטויים דיבוריים ל־1000 מילים: ${m.colloquialPer1k}; ביטויים גבוהים: ${m.formalPer1k}). מגוון לקסיקלי: ${m.lexicalVariety}%. אורך מילה ממוצע: ${m.avgWordLength}.`,
    `- פיסוק ל־1000 מילים: פסיקים ${p.comma}, נקודות ${p.period}, שאלה ${p.question}, קריאה ${p.exclaim}, שלוש־נקודות ${p.ellipsis}, קו מפריד ${p.dash}, נקודתיים ${p.colon}, נקודה־פסיק ${p.semicolon}, סוגריים ${p.parens}.`,
    `- דיאלוג: ${m.dialogueShare}% מהשורות. גוף ראשון: ${m.firstPersonPer1k} הטיות ל־1000 מילים.`,
  ];
  if (m.topWords.length) L.push(`- מילות מפתח חוזרות: ${m.topWords.slice(0, 15).map((w) => w.word).join(', ')}.`);
  if (m.favoritePhrases.length) L.push(`- צירופים חוזרים (חתימה אישית — לשמר): ${m.favoritePhrases.map((p) => '“' + p.phrase + '”').join(', ')}.`);
  if (m.topOpeners.length) L.push(`- פתיחות משפט נפוצות: ${m.topOpeners.map((o) => o.word + ' (' + o.share + '%)').join(', ')}.`);
  if (m.revision) L.push(`- הרגלי הקלדה: ${m.revision.deleteRatio}% מהתווים נמחקו תוך כדי כתיבה (${m.revision.deleteRatio > 25 ? 'מלטש/ת תוך כדי' : 'כותב/ת בזרימה'}).`);
  if (extra.guide) L.push('', '## מדריך קול (ניתוח איכותני)', extra.guide);
  if (m.exemplars.length) { L.push('', '## קטעים מייצגים מכתיבת המחבר/ת (לחקות את הקול, לא את התוכן):'); m.exemplars.forEach((e, i) => L.push(`--- דוגמה ${i + 1} ---`, e)); }
  return L.join('\n');
}

module.exports = { analyze, toPromptBlock, sentences, paragraphs };
