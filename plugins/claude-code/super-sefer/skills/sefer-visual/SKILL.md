---
name: sefer-visual
description: יצירת שפה גרפית אחידה (Style Bible) ואיורי פרקים באמצעות Codex ומודל התמונות. השתמש כשמבקשים איורים/סגנון חזותי.
---

# שלב 8 — שפה גרפית ואיורים
1. `sofer-sefer visual bible --brief "…"` (או `sofer-sefer prompt visual` ו-`sofer-sefer apply visual --file bible.json`).
2. איור לפרק: `sofer-sefer illustrate <פרק>` — מתכנן סצנה, מצרף stylePrefix מילה־במילה ותמונת ייחוס, ומפעיל Codex (`image_gen`) דרך מנוי המשתמש.
3. התמונה הראשונה הופכת לעוגן סגנון; שמרו עקביות.
יצירה ישירה: `sofer-sefer image --prompt "…" --out file.png`. אם משתמשים ב-codex-plugin-cc מתוך Claude Code, אפשר גם `/codex:rescue` עם פרומפט תמונה — אך העדיפו את ה-CLI שמצרף ייחוס וסגנון.
## עבודה עם הפרויקט
- הפרויקט הוא תיקייה עם `ספר.json` ופרקים ב-`chapters/`. הריצו את הפקודות מתוך התיקייה, או הוסיפו `--project <תיקייה>`.
- אם הפקודה `sofer-sefer` לא נמצאה: `sofer-sefer setup` (או פתחו את אפליקציית סופר-ספר פעם אחת).
- כל כתיבה לפרק שומרת גרסה קודמת ב-`.history/`. לעולם אל תערכו קבצי `chapters/*.md` ישירות — השתמשו ב-`sofer-sefer apply`.
- שמרו על קולו של המחבר/ת. התערבות מינימלית. אל תמציאו עובדות.
- ענו למשתמש בעברית.
