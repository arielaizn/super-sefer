---
name: sefer-cover
description: עיצוב כריכה לספר: קונספטים, פריסה, שדרה לפי מספר עמודים, ייצור PDF כריכה (חזית וגב). השתמש כשמבקשים כריכה.
---

# שלב 7 — כריכה
1. `sofer-sefer prompt cover` — הפיקו 3 קונספטים (JSON) ושמרו: `sofer-sefer apply cover --file concepts.json`; בחירה: `sofer-sefer cover use 1`.
2. התאמות: `sofer-sefer cover set layout=fullbleed palette.bg=#16222e title="…" tagline="…" blurb="…" isbn=978…`.
3. תמונה: `sofer-sefer illustrate cover --prompt "…"` (Codex, מודל gpt-image) — קחו בחשבון אזהרת DPI.
4. `sofer-sefer cover build` (פריסה: גב·שדרה·חזית; `--mode pages` לשני עמודים) ו-`sofer-sefer cover geometry`.
הכריכה נבנית אחרי נעילת מספר העמודים. ידע: `knowledge/07-cover-design.md`.
## עבודה עם הפרויקט
- הפרויקט הוא תיקייה עם `ספר.json` ופרקים ב-`chapters/`. הריצו את הפקודות מתוך התיקייה, או הוסיפו `--project <תיקייה>`.
- אם הפקודה `sofer-sefer` לא נמצאה: `sofer-sefer setup` (או פתחו את אפליקציית סופר-ספר פעם אחת).
- כל כתיבה לפרק שומרת גרסה קודמת ב-`.history/`. לעולם אל תערכו קבצי `chapters/*.md` ישירות — השתמשו ב-`sofer-sefer apply`.
- שמרו על קולו של המחבר/ת. התערבות מינימלית. אל תמציאו עובדות.
- ענו למשתמש בעברית.
