// כלי פיתוח: electron scripts/dev/pagedtest.js <file.html> <outPrefix>
const { app } = require('electron');
const pdf = require('../../src/core/pdf');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => { try {
  const f = process.argv.find((a) => a.endsWith('.html'));
  const o = process.argv[process.argv.indexOf(f) + 1];
  await pdf.htmlToPdf(f, { outFile: o + '.pdf' });
  const pages = await pdf.extractPages(o + '.pdf');
  console.log(pages.map((p) => p.n + ': ' + p.lines.map((l) => l.text).join(' | ')).join('\n'));
  await pdf.rasterize(o + '.pdf', { scale: 0.5, outDir: o + '_png' });
  } catch (e) { console.error('ERR', e.stack); } app.quit();
});
