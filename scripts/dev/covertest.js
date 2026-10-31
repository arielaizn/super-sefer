const { app } = require('electron');
const fs = require('fs'); const path = require('path');
const { Project } = require('../../src/core/project');
const build = require('../../src/core/build');
const pdf = require('../../src/core/pdf');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  try {
    const dir = process.argv[process.argv.length - 1];
    const p = Project.open(dir);
    const img = process.argv.find((a) => a.endsWith('.png') && !a.includes('/png/'));
    const layouts = ['classic', 'fullbleed', 'typographic', 'band', 'frame', 'arch'];
    for (const l of layouts) {
      const design = { layout: l, image: img || null, blurb: 'בבוקר אחד של סתיו יוצאת דנה אל החוף הרחוק, מחפשת תשובה לשאלה שליוותה אותה כל חייה.\nספר על געגוע, על ים, ועל הדרך חזרה הביתה.', tagline: 'ים אחד. אלף סודות.', bio: 'דנה כהן נולדה בחיפה. זהו ספרה הראשון.', isbn: '9789650000000', publisher: 'הוצאת דוגמה' };
      if (l === 'typographic') design.palette = { bg: '#f3ead9', fg: '#1d1a17', accent: '#b3382c', muted: '#7b6f5f' };
      const r = await build.buildCover(p, { outFile: path.join(dir, 'build', `cover-${l}.pdf`), design, pages: 220, guides: false });
      await pdf.rasterize(r.file, { scale: 0.9, outDir: path.join(dir, 'build', 'cv-' + l) });
    }
    console.log('ok');
  } catch (e) { console.error('ERR', e.stack); }
  app.quit();
});
