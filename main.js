// תהליך ראשי של Electron: חלון האפליקציה, IPC, ומצב --job (רינדור נסתר עבור ה-CLI)
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.on('window-all-closed', () => { if (JOB_MODE) return; if (process.platform !== 'darwin') app.quit(); });

const JOB_IDX = process.argv.indexOf('--job');
const JOB_MODE = JOB_IDX !== -1;

if (process.argv.includes('--setup')) {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  app.whenReady().then(() => { try { require('./src/core/install').setup({ log: (x) => console.log(x) }); } catch (e) { console.error(e.message); } app.exit(0); });
} else if (JOB_MODE) {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  const jobFile = process.argv[JOB_IDX + 1];
  app.whenReady().then(async () => {
    const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    let res;
    try {
      const { runJob } = require('./src/core/jobs');
      const result = await runJob(job, (p) => { if (p && p.msg) process.stdout.write('@@progress ' + p.msg + '\n'); });
      res = { result };
    } catch (e) { res = { error: e.message }; }
    fs.writeFileSync(job.result, JSON.stringify(res));
    app.exit(0);
  });
} else {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) app.quit();
  require('./src/gui-main')({ app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme });
}
