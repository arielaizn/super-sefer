---
name: sefer-layout
description: עימוד גרפי של הספר: בחירת גודל, שוליים, גופנים, טיפוגרפיה עברית, בניית PDF פנים. השתמש כשמבקשים עימוד/גודל ספר/PDF של הפנים.
---

# שלב 5 — עימוד
1. `sofer-sefer layout sizes` ו-`sofer-sefer layout recommend --trim a5 --pages 220` — בחרו גודל לפי ז'אנר (פרוזה 14×21/A5; עיון רויאל; ילדים ריבוע; כיס).
2. `sofer-sefer layout set trim=a5 fontBody="Frank Ruhl Libre" fontSize=11.5 chapterStart=recto folio=center …`; גופנים: `sofer-sefer layout fonts`.
3. `sofer-sefer layout build` — מפיק PDF (עמודים ריקים לפתיחת פרקים בעמוד שמאלי, תוכן עניינים אוטומטי, מספור, כותרות ריצה, ריפוד ל-4).
4. בדקו תוצאה בעין (המירו עמודים לתמונה אם אפשר) והתאימו.
ידע טיפוגרפי: `knowledge/05-typography-layout.md` — בעברית אין נטייה; יישור דו־צדדי מצריך שורה ≥45 תווים.
## עבודה עם הפרויקט
- הפרויקט הוא תיקייה עם `ספר.json` ופרקים ב-`chapters/`. הריצו את הפקודות מתוך התיקייה, או הוסיפו `--project <תיקייה>`.
- אם הפקודה `sofer-sefer` לא נמצאה: `sofer-sefer setup` (או פתחו את אפליקציית סופר-ספר פעם אחת).
- כל כתיבה לפרק שומרת גרסה קודמת ב-`.history/`. לעולם אל תערכו קבצי `chapters/*.md` ישירות — השתמשו ב-`sofer-sefer apply`.
- שמרו על קולו של המחבר/ת. התערבות מינימלית. אל תמציאו עובדות.
- ענו למשתמש בעברית.
