// כלי פיתוח: electron scripts/dev/raster.js file.pdf outDir scale p1,p2,...
const { app } = require('electron');
const pdf = require('../../src/core/pdf');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const a = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const [file, out, scale, pages] = a.slice(-4);
  try { await pdf.rasterize(file, { scale: Number(scale), pages: pages === 'all' ? null : pages.split(',').map(Number), outDir: out }); } catch (e) { console.error(e); }
  app.quit();
});
