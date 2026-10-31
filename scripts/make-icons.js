const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, transparent: true, frame: false, width: 1024, height: 1024, useContentSize: true, webPreferences: { offscreen: false } });
  const css = fs.readFileSync(path.join(__dirname, '..', 'fonts', 'fonts.css'), 'utf8').replace(/url\('([^']+)'\)/g, (_, f) => `url('file://${path.join(__dirname, '..', 'fonts', f)}')`);
  await w.loadURL('data:text/html;charset=utf8,' + encodeURIComponent(`<style>${css}html,body{margin:0;width:1024px;height:1024px;background:transparent}
.i{width:1024px;height:1024px;border-radius:230px;background:linear-gradient(145deg,#d1603a,#7c2d17);display:grid;place-items:center;position:relative;overflow:hidden}
.i:before{content:'';position:absolute;inset:44px;border-radius:190px;border:6px solid rgba(255,235,210,.35)}
.i b{font-family:'Frank Ruhl Libre';font-weight:900;font-size:760px;color:#fff1de;line-height:1;margin-top:-30px;text-shadow:0 14px 40px rgba(0,0,0,.35)}
.i s{position:absolute;bottom:130px;width:300px;height:14px;background:#f1c27a;border-radius:8px}</style><div class="i"><b>ס</b><s></s></div>`));
  await w.webContents.executeJavaScript('document.fonts.ready.then(()=>1)');
  await new Promise((r) => setTimeout(r, 400));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img.toPNG());
  app.exit(0);
});
