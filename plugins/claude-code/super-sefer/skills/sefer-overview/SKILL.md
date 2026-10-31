---
name: sefer-overview
description: סקירת תהליך יצירת הספר של סופר-ספר ובחירת השלב הבא. השתמש כשמבקשים ליצור/להמשיך ספר, "סופר-ספר", או לא ברור באיזה שלב נמצאים.
---

# סופר-ספר — מבט על
תהליך מקצה לקצה: 1 כתיבה בקול המשתמש · 2 עריכה ספרותית · 3 עריכה לשונית · 4 הגהה · 5 עימוד · 6 הגהה אחרי עימוד · 7 כריכה · 8 שפה גרפית ואיורים · 9 ייצוא PDF.

התחילו תמיד ב: `sofer-sefer status` ו-`sofer-sefer chapters`. לפי המצב הציעו את השלב הבא וקראו לכישור המתאים:
sefer-write · sefer-lit-edit · sefer-ling-edit · sefer-proof · sefer-layout · sefer-postproof · sefer-cover · sefer-visual · sefer-export.

פרויקט חדש: `sofer-sefer new <תיקייה> --title "…" --author "…"`. ייבוא כתב־יד: `sofer-sefer import file.md --split`.
האפליקציה הגרפית: `sofer-sefer gui`.
## עבודה עם הפרויקט
- הפרויקט הוא תיקייה עם `ספר.json` ופרקים ב-`chapters/`. הריצו את הפקודות מתוך התיקייה, או הוסיפו `--project <תיקייה>`.
- אם הפקודה `sofer-sefer` לא נמצאה: `sofer-sefer setup` (או פתחו את אפליקציית סופר-ספר פעם אחת).
- כל כתיבה לפרק שומרת גרסה קודמת ב-`.history/`. לעולם אל תערכו קבצי `chapters/*.md` ישירות — השתמשו ב-`sofer-sefer apply`.
- שמרו על קולו של המחבר/ת. התערבות מינימלית. אל תמציאו עובדות.
- ענו למשתמש בעברית.
