// כלי פיתוח: בונה ספר דמה ארוך ומפיק PDF + תמונות לבדיקה
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { Project } = require('../../src/core/project');
const build = require('../../src/core/build');
const pdf = require('../../src/core/pdf');
app.on('window-all-closed', () => {});
const W = 'הלכתי בבוקר אל הים והגלים נשפכו על החול בשקט ובאיטיות כאילו ידעו משהו שאיני יודע. אמא אמרה לי תמיד שהזמן הוא נהר אבל אני חושב שהוא יותר דומה לסלע שעליו אנחנו יושבים ומחכים לרוח. הוא עמד שם ליד החלון והביט החוצה אל הרחוב הריק שבו עברו רק עלים יבשים וחתולים נדירים. "מה אתה עושה כאן?" שאלה. הוא לא ענה, כי אין תשובה לשאלה כזאת אחרי כל כך הרבה שנים של שתיקה. בערב התכנסו כולם סביב השולחן הארוך והדליקו נרות ושרו שירים ישנים שאיש לא זכר את מילותיהם עד הסוף.'.split(' ');
function para(n, r) { let s = []; for (let i = 0; i < n; i++) s.push(W[(i * 7 + r * 13) % W.length]); return s.join(' ') + '.'; }
app.whenReady().then(async () => {
  try {
    const dir = process.argv.find((a) => a.startsWith('/')) ; 
    const out = process.argv[process.argv.length - 1];
    fs.rmSync(out, { recursive: true, force: true });
    const p = Project.create(out, { title: 'מסע אל החוף הרחוק', author: 'דנה כהן' });
    p.data.subtitle = 'רומן'; p.data.publisher = 'הוצאת דוגמה'; p.data.isbn = '978-965-00-0000-0'; p.save();
    p.addChapter({ title: 'לזכר אבא', kind: 'dedication', text: 'לזכרו של אבא,\nשלימד אותי לחכות לרוח' });
    p.addChapter({ title: 'הקדמה', kind: 'foreword', text: [1,2,3].map((i) => para(70, i)).join('\n\n') });
    for (let c = 1; c <= 6; c++) {
      let t = [];
      for (let k = 0; k < 9 + c * 2; k++) { t.push(para(60 + (k * 11) % 50, c * 10 + k)); if (k === 4) t.push('## כותרת משנה ' + c); if (k === 7) t.push('* * *'); if (k === 3) t.push('– ' + para(9, k) + '\n– ' + para(7, k + 1)); }
      p.addChapter({ title: 'שער ' + (['ראשון','שני','שלישי','רביעי','חמישי','שישי'][c-1]) + ' אל הים', text: t.join('\n\n') });
    }
    p.addChapter({ title: 'תודות', kind: 'acknowledgments', text: para(60, 3) });
    const r = await build.buildInterior(p, { onProgress: (x) => console.log(x.msg) });
    console.log(JSON.stringify({ pages: r.pages, front: r.frontCount, starts: r.starts, toc: r.toc, warnings: r.warnings, blanks: r.blanks }));
    await pdf.rasterize(r.file, { scale: 0.45, pages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], outDir: out + '/png' });
  } catch (e) { console.error('ERR', e.stack); }
  app.quit();
});
