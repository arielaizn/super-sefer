// מייצר את תוסף Claude Code ואת כישורי Codex מתוך הגדרה אחת
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'plugins');
fs.rmSync(root, { recursive: true, force: true });
const W = (f, c) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };
const CLI = 'sofer-sefer';
const common = `## עבודה עם הפרויקט
- הפרויקט הוא תיקייה עם \`ספר.json\` ופרקים ב-\`chapters/\`. הריצו את הפקודות מתוך התיקייה, או הוסיפו \`--project <תיקייה>\`.
- אם הפקודה \`${CLI}\` לא נמצאה: \`${CLI} setup\` (או פתחו את אפליקציית סופר-ספר פעם אחת).
- כל כתיבה לפרק שומרת גרסה קודמת ב-\`.history/\`. לעולם אל תערכו קבצי \`chapters/*.md\` ישירות — השתמשו ב-\`${CLI} apply\`.
- שמרו על קולו של המחבר/ת. התערבות מינימלית. אל תמציאו עובדות.
- ענו למשתמש בעברית.
`;
const skills = [
  ['sefer-overview', 'סקירת תהליך יצירת הספר של סופר-ספר ובחירת השלב הבא. השתמש כשמבקשים ליצור/להמשיך ספר, "סופר-ספר", או לא ברור באיזה שלב נמצאים.',
`# סופר-ספר — מבט על
תהליך מקצה לקצה: 1 כתיבה בקול המשתמש · 2 עריכה ספרותית · 3 עריכה לשונית · 4 הגהה · 5 עימוד · 6 הגהה אחרי עימוד · 7 כריכה · 8 שפה גרפית ואיורים · 9 ייצוא PDF.

התחילו תמיד ב: \`${CLI} status\` ו-\`${CLI} chapters\`. לפי המצב הציעו את השלב הבא וקראו לכישור המתאים:
sefer-write · sefer-lit-edit · sefer-ling-edit · sefer-proof · sefer-layout · sefer-postproof · sefer-cover · sefer-visual · sefer-export.

פרויקט חדש: \`${CLI} new <תיקייה> --title "…" --author "…"\`. ייבוא כתב־יד: \`${CLI} import file.md --split\`.
האפליקציה הגרפית: \`${CLI} gui\`.
${common}`],
  ['sefer-write', 'כתיבת פרק בקול ובסגנון של המחבר/ת, או המשך כתיבה, על בסיס פרופיל סגנון שנלמד מהטקסט שהוקלד. השתמש כשמבקשים לכתוב/להמשיך פרק בספר.',
`# שלב 1 — כתיבה בקול המשתמש
1. \`${CLI} style analyze\` ואז \`${CLI} style show\` — הפרופיל הסגנוני (עדכנו אחרי כל פרק חדש שהמשתמש הקליד).
2. \`${CLI} prompt write <פרק> --brief "…" --words 1200\` — מדפיס את הפרומפט המלא (מחקר כתיבה + הקשר + פרופיל + סוף הפרק הקודם). **בצעו אותו בעצמכם**: כתבו את הפרק לפי ההוראות והפורמט שבו.
3. שמרו: \`${CLI} apply write <פרק> --file draft.md\` (או stdin).
4. הציגו למשתמש וקבלו אישור לפני שממשיכים. אפשר גם הרצה אוטומטית: \`${CLI} write <פרק> --brief … --apply\`.
אל תנחשו קול כשאין מספיק טקסט — בקשו מהמשתמש לכתוב פרק/שניים. תוכן שנוצר ע"י AI לא נחשב קול המשתמש.
${common}`],
  ['sefer-lit-edit', 'עריכה ספרותית (line edit) של פרק: קצב, בהירות, דיאלוג, דימויים, בלי לשנות קול. השתמש כשמבקשים לערוך/לשפר פרק.',
`# שלב 2 — עריכה ספרותית
1. \`${CLI} prompt lit <פרק>\` — קראו והפעילו את ההוראות על הפרק (הפרומפט כולל את הטקסט והפרופיל).
2. הפיקו \`<summary>\`, \`<findings>\` (JSON) ו-\`<revised>\`; הציגו למשתמש את הממצאים העיקריים ושינויים מוצעים.
3. לאחר אישור: \`${CLI} apply lit <פרק> --file revised.md\`.
התערבות מינימלית; אל תשכתבו משפט שעובד.
${common}`],
  ['sefer-ling-edit', 'עריכה לשונית בעברית לפי כללי האקדמיה: כתיב, פיסוק, התאמה, תחביר, עקביות. השתמש כשמבקשים עריכה לשונית/הגהת לשון.',
`# שלב 3 — עריכה לשונית
1. \`${CLI} prompt ling <פרק>\`; בצעו; הציגו תיקונים לפי קטגוריה ושאלות למחבר/ת.
2. לאחר אישור: \`${CLI} apply ling <פרק> --file revised.md\`.
שמרו דיבוריות מכוונת ושמות/סלנג של דמויות.
${common}`],
  ['sefer-proof', 'הגהה אות אחר אות: בדיקה דטרמיניסטית של אותיות סופיות, גרשיים, מירכאות, מקפים, רווחים, ואחריה מעבר מודל מילה־מילה. השתמש כשמבקשים הגהה.',
`# שלב 4 — הגהה
1. \`${CLI} proof lint all\` — דוח תו־תו. \`${CLI} proof lint all --fix\` — תיקון בטוח אוטומטי (בטוח: רווחים, מירכאות/גרשיים, מקפים, שלוש נקודות, אותיות סופיות).
2. מעבר מודל: \`${CLI} proof ai <פרק>\` (אוטומטי), או ידנית: \`${CLI} prompt proof <פרק> --window N\` לכל חלון, והחילו תיקוני find→replace ייחודיים בלבד.
3. חזרו על lint עד שהוא נקי (למעט info).
אין שינויי סגנון בהגהה. ספק → שאלה למחבר/ת.
${common}`],
  ['sefer-layout', 'עימוד גרפי של הספר: בחירת גודל, שוליים, גופנים, טיפוגרפיה עברית, בניית PDF פנים. השתמש כשמבקשים עימוד/גודל ספר/PDF של הפנים.',
`# שלב 5 — עימוד
1. \`${CLI} layout sizes\` ו-\`${CLI} layout recommend --trim a5 --pages 220\` — בחרו גודל לפי ז'אנר (פרוזה 14×21/A5; עיון רויאל; ילדים ריבוע; כיס).
2. \`${CLI} layout set trim=a5 fontBody="Frank Ruhl Libre" fontSize=11.5 chapterStart=recto folio=center …\`; גופנים: \`${CLI} layout fonts\`.
3. \`${CLI} layout build\` — מפיק PDF (עמודים ריקים לפתיחת פרקים בעמוד שמאלי, תוכן עניינים אוטומטי, מספור, כותרות ריצה, ריפוד ל-4).
4. בדקו תוצאה בעין (המירו עמודים לתמונה אם אפשר) והתאימו.
ידע טיפוגרפי: \`knowledge/05-typography-layout.md\` — בעברית אין נטייה; יישור דו־צדדי מצריך שורה ≥45 תווים.
${common}`],
  ['sefer-postproof', 'הגהה אחרי עימוד: נאמנות טקסט מול ה-PDF, עמודים ריקים, כותרות בתחתית עמוד, תוכן עניינים ומספור. השתמש לפני ייצוא סופי.',
`# שלב 6 — הגהה אחרי עימוד
\`${CLI} postproof\` (או \`--ai\` לקריאת עמודי החזית). כל חסם → תקנו במקור/בהגדרות, בנו מחדש (\`layout build\`) והריצו שוב. סיום רק כשאין חסמים.
${common}`],
  ['sefer-cover', 'עיצוב כריכה לספר: קונספטים, פריסה, שדרה לפי מספר עמודים, ייצור PDF כריכה (חזית וגב). השתמש כשמבקשים כריכה.',
`# שלב 7 — כריכה
1. \`${CLI} prompt cover\` — הפיקו 3 קונספטים (JSON) ושמרו: \`${CLI} apply cover --file concepts.json\`; בחירה: \`${CLI} cover use 1\`.
2. התאמות: \`${CLI} cover set layout=fullbleed palette.bg=#16222e title="…" tagline="…" blurb="…" isbn=978…\`.
3. תמונה: \`${CLI} illustrate cover --prompt "…"\` (Codex, מודל gpt-image) — קחו בחשבון אזהרת DPI.
4. \`${CLI} cover build\` (פריסה: גב·שדרה·חזית; \`--mode pages\` לשני עמודים) ו-\`${CLI} cover geometry\`.
הכריכה נבנית אחרי נעילת מספר העמודים. ידע: \`knowledge/07-cover-design.md\`.
${common}`],
  ['sefer-visual', 'יצירת שפה גרפית אחידה (Style Bible) ואיורי פרקים באמצעות Codex ומודל התמונות. השתמש כשמבקשים איורים/סגנון חזותי.',
`# שלב 8 — שפה גרפית ואיורים
1. \`${CLI} visual bible --brief "…"\` (או \`${CLI} prompt visual\` ו-\`${CLI} apply visual --file bible.json\`).
2. איור לפרק: \`${CLI} illustrate <פרק>\` — מתכנן סצנה, מצרף stylePrefix מילה־במילה ותמונת ייחוס, ומפעיל Codex (\`image_gen\`) דרך מנוי המשתמש.
3. התמונה הראשונה הופכת לעוגן סגנון; שמרו עקביות.
יצירה ישירה: \`${CLI} image --prompt "…" --out file.png\`. אם משתמשים ב-codex-plugin-cc מתוך Claude Code, אפשר גם \`/codex:rescue\` עם פרומפט תמונה — אך העדיפו את ה-CLI שמצרף ייחוס וסגנון.
${common}`],
  ['sefer-export', 'ייצוא הספר: PDF אחד של פנים הספר ו-PDF של הכריכה (חזית וגב), מוכנים להדפסה, לתיקיית ההורדות. השתמש כשמבקשים לייצא/לסיים את הספר.',
`# שלב 9 — ייצוא
וודאו: \`${CLI} proof lint all\` נקי, \`${CLI} postproof\` עבר. אז \`${CLI} export\` (ברירת מחדל ~/Downloads/<שם הספר>/; \`--out\` לשינוי, \`--both\` לכריכה גם כשני עמודים).
דווחו למשתמש: נתיבי הקבצים, מספר עמודים, עובי שדרה, DPI של תמונת הכריכה, והמלצה על הדפסת ניסיון.
${common}`],
];

// ---- Claude Code ----
const mk = path.join(root, 'claude-code');
W(path.join(mk, '.claude-plugin', 'marketplace.json'), JSON.stringify({ name: 'super-sefer', owner: { name: 'סופר-ספר' }, metadata: { description: 'יצירת ספרים מקצה לקצה', version: '1.0.0' }, plugins: [{ name: 'super-sefer', description: 'כתיבה בקול שלך, עריכה, הגהה, עימוד, כריכה, איורים וייצוא PDF — עם CLI sofer-sefer', version: '1.0.0', source: './super-sefer' }] }, null, 2));
const pl = path.join(mk, 'super-sefer');
W(path.join(pl, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'super-sefer', version: '1.0.0', description: 'סופר-ספר: מערכת ליצירת ספרים מקצה לקצה (כתיבה, עריכה, הגהה, עימוד, כריכה, איורים, PDF)', author: { name: 'סופר-ספר' }, keywords: ['books', 'hebrew', 'publishing'] }, null, 2));
for (const [n, d, body] of skills) W(path.join(pl, 'skills', n, 'SKILL.md'), `---\nname: ${n}\ndescription: ${d}\n---\n\n${body}`);
const cmdDefs = { 'sefer': ['מצב הספר והשלב הבא', 'הפעילו את כישור sefer-overview: הריצו status ו-chapters והציעו את השלב הבא.'], 'sefer-write': ['כתיבת פרק בקולי', 'הפעילו את כישור sefer-write עבור: $ARGUMENTS'], 'sefer-edit': ['עריכה ספרותית ולשונית', 'הפעילו sefer-lit-edit ואז sefer-ling-edit עבור: $ARGUMENTS'], 'sefer-proof': ['הגהה', 'הפעילו sefer-proof עבור: $ARGUMENTS'], 'sefer-layout': ['עימוד', 'הפעילו sefer-layout. $ARGUMENTS'], 'sefer-cover': ['כריכה', 'הפעילו sefer-cover. $ARGUMENTS'], 'sefer-illustrate': ['איורים', 'הפעילו sefer-visual עבור: $ARGUMENTS'], 'sefer-export': ['ייצוא PDF', 'הפעילו sefer-postproof ואז sefer-export. $ARGUMENTS'] };
for (const [n, [d, b]] of Object.entries(cmdDefs)) W(path.join(pl, 'commands', n + '.md'), `---\ndescription: ${d}\nargument-hint: [פרק / הערות]\n---\n\n${b}\n`);
W(path.join(pl, 'agents', 'sefer-editor.md'), `---\nname: sefer-editor\ndescription: עורך/ת ומגיה/ה ספרים בעברית. מופעל לעריכה ספרותית/לשונית והגהה של פרק, ומחזיר ממצאים ונוסח מתוקן.\n---\n\nאתה עורך ומגיה ספרים ישראלי מקצועי. עבוד לפי הפרומפט ש-\`sofer-sefer prompt <lit|ling|proof> <פרק>\` מדפיס, בהתערבות מינימלית ובשמירה על קול המחבר/ת. החזר בדיוק בפורמט המבוקש בפרומפט.\n`);
W(path.join(pl, 'README.md'), '# סופר-ספר — תוסף Claude Code\nכישורים: ' + skills.map((s) => s[0]).join(', ') + '\nפקודות: /sefer, /sefer-write, /sefer-edit, /sefer-proof, /sefer-layout, /sefer-cover, /sefer-illustrate, /sefer-export\nדורש את ה-CLI `sofer-sefer` (מותקן עם האפליקציה). איורים: codex-plugin-cc (openai/codex-plugin-cc) + Codex CLI.\n');

// ---- Codex ----
const cx = path.join(root, 'codex');
W(path.join(cx, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'super-sefer', version: '1.0.0', description: 'סופר-ספר — יצירת ספרים מקצה לקצה', skills: './skills/' }, null, 2));
const all = skills.map(([n, d, b]) => b.replace(/^# /, '## ')).join('\n\n---\n\n');
W(path.join(cx, 'skills', 'super-sefer', 'SKILL.md'), `---\nname: super-sefer\ndescription: יצירת ספרים בעברית מקצה לקצה עם ה-CLI sofer-sefer — כתיבה בקול המשתמש, עריכה ספרותית ולשונית, הגהה, עימוד, הגהה אחרי עימוד, כריכה, שפה גרפית ואיורים, וייצוא PDF. השתמש כשמבקשים לכתוב/לערוך/להגיה/לעמד/לייצא ספר.\n---\n\n# סופר-ספר ל-Codex\n\n${all}\n\n## יצירת תמונות\nב-Codex אפשר ליצור תמונה ישירות בכלי \`image_gen\`; להעדפה — \`${CLI} illustrate\` שמצרף Style Bible וייחוס.\n`);
console.log('plugins generated:', skills.length, 'skills');
