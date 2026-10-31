# סופר-ספר

מערכת מלאה ליצירת ספרים בעברית מקצה לקצה: כתיבה בקול שלכם, עריכה ספרותית ולשונית, הגהה, עימוד, הגהה אחרי עימוד, כריכה, שפה גרפית ואיורים (דרך Codex), וייצוא PDF לפנים הספר ולכריכה.

כולל אפליקציית שולחן עבודה (Electron), CLI בשם `sofer-sefer`, תוסף ל-Claude Code וכישורים ל-Codex.

## הורדה
ראו [Releases](../../releases/latest): קובץ `.dmg` ל-Mac וקובץ `.exe` ל-Windows. הקבצים אינם חתומים (ב-Mac: פתיחה דרך System Settings → Privacy & Security; ב-Windows: SmartScreen → More info → Run anyway).

## דרישות
- Claude Code ו/או Codex CLI מחוברים עם המנוי שלכם (אין צורך במפתחות API).
- איורים: Codex CLI + [codex-plugin-cc](https://github.com/openai/codex-plugin-cc).

## פיתוח
```
npm install
node node_modules/electron/install.js
npm run fonts && node scripts/make-plugins.js
npx electron .
npx electron-builder --mac --universal   # DMG
npx electron-builder --win --x64         # EXE
```
CLI: `sofer-sefer help`.
