// לוגיקת ה-GUI בתהליך הראשי: חלון, תפריט, IPC לכל שלבי העבודה
module.exports = function start({ app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme }) {
  const path = require('path');
  const fs = require('fs');
  const os = require('os');
  const { Project } = require('./core/project');
  const engine = require('./core/engine');
  const stages = require('./core/stages');
  const heb = require('./core/hebrew');
  const style = require('./core/style');
  const F = require('./core/formats');
  const layout = require('./core/layout');
  const cover = require('./core/cover');
  const { runJob } = require('./core/jobs');
  const install = require('./core/install');
  const { generateImage } = require('./core/images');

  let win = null;
  let project = null;
  const recentFile = path.join(app.getPath('userData'), 'recent.json');
  const getRecent = () => { try { return JSON.parse(fs.readFileSync(recentFile, 'utf8')).filter((d) => fs.existsSync(path.join(d, 'ספר.json'))); } catch { return []; } };
  const pushRecent = (d) => { const r = [d, ...getRecent().filter((x) => x !== d)].slice(0, 12); fs.writeFileSync(recentFile, JSON.stringify(r)); };

  function createWindow() {
    nativeTheme.themeSource = 'light';
    win = new BrowserWindow({ width: 1440, height: 920, minWidth: 1100, minHeight: 700, title: 'סופר-ספר', backgroundColor: '#f6f1e8', titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', trafficLightPosition: { x: 16, y: 18 },
      webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: false, webSecurity: false } });
    win.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
    win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
    win.on('closed', () => { win = null; });
  }

  const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
  const need = () => { if (!project) throw new Error('לא נפתח פרויקט'); return project; };
  const view = () => {
    const p = need();
    return { dir: p.dir, data: p.data, chapters: p.chapters().map((c) => ({ ...c })), totalWords: p.totalWords() };
  };
  const handle = (name, fn) => ipcMain.handle(name, async (e, ...a) => { try { return { ok: true, v: await fn(...a) }; } catch (err) { return { ok: false, error: err.message || String(err) }; } });

  // ---- פרויקטים ----
  handle('app:info', () => ({ version: app.getVersion(), recent: getRecent(), root: Project.defaultRoot(), engines: engine.detect(), fonts: layout.fontList(), trims: F.TRIMS, papers: F.PAPERS, bindings: F.BINDINGS, layouts: cover.LAYOUTS, palettes: cover.PALETTES, platform: process.platform, downloads: app.getPath('downloads') }));
  handle('project:create', ({ title, author, genre, dir }) => {
    const root = dir || Project.defaultRoot();
    fs.mkdirSync(root, { recursive: true });
    let d = path.join(root, title.replace(/[\\/:*?"<>|]/g, '').trim() || 'ספר חדש');
    for (let i = 2; fs.existsSync(d); i++) d = path.join(root, `${title} ${i}`);
    project = Project.create(d, { title, author, genre });
    pushRecent(d); return view();
  });
  handle('project:open', (dir) => { project = Project.open(dir); pushRecent(dir); return view(); });
  handle('project:pick', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'בחרו תיקיית פרויקט סופר-ספר' }); if (r.canceled) return null; project = Project.open(r.filePaths[0]); pushRecent(r.filePaths[0]); return view(); });
  handle('project:view', () => view());
  handle('project:close', () => { project = null; return true; });
  handle('project:update', (patch) => { const p = need(); for (const [k, v] of Object.entries(patch)) { if (v && typeof v === 'object' && !Array.isArray(v) && p.data[k] && typeof p.data[k] === 'object') p.data[k] = { ...p.data[k], ...v }; else p.data[k] = v; } p.save(); return view(); });
  handle('shell:reveal', (f) => { shell.showItemInFolder(f); return true; });
  handle('shell:open', (f) => shell.openPath(f));
  handle('shell:url', (u) => shell.openExternal(u));
  handle('dialog:pickFile', async (filters) => { const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters }); return r.canceled ? null : r.filePaths[0]; });
  handle('dialog:pickDir', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });

  // ---- פרקים ----
  handle('chapter:add', (o) => { const p = need(); const c = p.addChapter(o); return { c, view: view() }; });
  handle('chapter:read', (id) => { const p = need(); return p.readChapter(p.chapter(id)); });
  handle('chapter:write', ({ id, text, telemetry, autosave }) => {
    const p = need(); const c = p.chapter(id);
    p.writeChapter(c, text, { reason: autosave ? 'autosave' : 'edit', keepHistory: !autosave });
    if (telemetry) { const t = p.data.style.telemetry; t.typed += telemetry.typed || 0; t.deleted += telemetry.deleted || 0; p.save(); }
    return { words: c.words };
  });
  handle('chapter:update', ({ id, patch }) => { const p = need(); const c = p.chapter(id); Object.assign(c, patch); p.save(); return view(); });
  handle('chapter:remove', (id) => { need().removeChapter(id); return view(); });
  handle('chapter:move', ({ id, to }) => { need().moveChapter(id, to); return view(); });
  handle('chapter:history', (id) => need().history(id).map((h) => ({ name: h.name, path: h.path })));
  handle('chapter:restore', ({ id, file }) => { const p = need(); const c = p.chapter(id); p.writeChapter(c, fs.readFileSync(file, 'utf8'), { reason: 'restore' }); return fs.readFileSync(file, 'utf8'); });
  handle('chapter:import', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'טקסט / Markdown', extensions: ['md', 'txt', 'markdown'] }] });
    if (r.canceled) return null; const p = need(); const t = fs.readFileSync(r.filePaths[0], 'utf8');
    const parts = t.split(/^(?=#\s+)/m).filter((s) => s.trim());
    parts.forEach((s, i) => { const m = s.match(/^#\s+(.+)\n/); p.addChapter({ title: m ? m[1].trim() : path.basename(r.filePaths[0], path.extname(r.filePaths[0])) + (parts.length > 1 ? ' ' + (i + 1) : ''), text: m ? s.slice(m[0].length).trim() + '\n' : s }); });
    return view();
  });

  // ---- סגנון ----
  const textsForStyle = () => need().chapters().filter((c) => !['dedication', 'epigraph'].includes(c.kind)).map((c) => need().readChapter(c)).filter((t) => t.trim());
  handle('style:analyze', () => { const p = need(); const m = style.analyze(textsForStyle(), p.data.style.telemetry); p.data.style.profile = m; p.data.style.profileAt = new Date().toISOString(); p.save(); return m; });
  handle('style:guide', async () => { const p = need(); if (!p.data.style.profile) p.data.style.profile = style.analyze(textsForStyle(), p.data.style.telemetry); const g = await stages.runStyleGuide(p, {}); p.data.style.guide = g; p.save(); return g; });

  // ---- שלבי מודל ----
  let running = new Map();
  const abortable = (key) => { const ac = new AbortController(); running.set(key, ac); return ac; };
  handle('ai:cancel', (key) => { const a = running.get(key); if (a) a.abort(); return true; });
  handle('ai:write', async ({ id, brief, words, keep }) => { const p = need(); const c = p.chapter(id); const ac = abortable('write'); try { return await stages.runWrite(p, c, { brief, words, signal: ac.signal }); } finally { running.delete('write'); } });
  handle('ai:lit', async ({ id }) => { const p = need(); const ac = abortable('lit'); try { return await stages.runLit(p, p.chapter(id), { signal: ac.signal }); } finally { running.delete('lit'); } });
  handle('ai:ling', async ({ id }) => { const p = need(); const ac = abortable('ling'); try { return await stages.runLing(p, p.chapter(id), { signal: ac.signal }); } finally { running.delete('ling'); } });
  handle('ai:proof', async ({ id, ai }) => { const p = need(); const ac = abortable('proof'); try { return await stages.runProof(p, p.chapter(id), { ai, signal: ac.signal, onProgress: (x) => send('progress', { stage: 'proof', ...x }) }); } finally { running.delete('proof'); } });
  handle('ai:cover', async () => { const p = need(); const c = await stages.runCover(p, {}); p.data.cover.concepts = c; p.save(); return c; });
  handle('ai:visual', async ({ brief }) => { const p = need(); const b = await stages.runVisual(p, brief || '', {}); if (!b) throw new Error('לא התקבלה שפה גרפית תקינה — נסו שוב'); p.data.visual.bible = b; p.save(); return b; });
  handle('ai:illustrationPlan', async ({ id }) => stages.runIllustrationPlan(need(), need().chapter(id), {}));
  handle('stage:mark', ({ id, stage, val }) => { const p = need(); p.setStage(p.chapter(id), stage, val || {}); return view(); });

  // ---- הגהה דטרמיניסטית ----
  handle('lint:chapter', (id) => { const t = need().readChapter(need().chapter(id)); const issues = heb.lintText(t); return { issues, summary: heb.summarize(issues) }; });
  handle('lint:fix', ({ id, rules }) => { const p = need(); const c = p.chapter(id); const t = p.readChapter(c); const r = heb.applyFixes(t, heb.lintText(t), rules || heb.SAFE_FIX_RULES); if (r.fixed) p.writeChapter(c, r.text, { reason: 'proof-fix' }); p.setStage(c, 'proof', { lint: heb.summarize(heb.lintText(r.text)) }); return { fixed: r.fixed, text: r.text }; });
  handle('lint:all', () => { const p = need(); return p.chapters().map((c) => ({ id: c.id, title: c.title, summary: heb.summarize(heb.lintText(p.readChapter(c))) })); });

  // ---- עימוד / כריכה / ייצוא ----
  handle('layout:recommend', ({ trim, pages }) => F.recommend(trim, pages, need().data.genre));
  handle('layout:geometry', () => layout.geometry(need()));
  handle('layout:build', async () => runJob({ type: 'interior', dir: need().dir }, (x) => send('progress', { stage: 'layout', ...x })));
  handle('postproof:run', async () => runJob({ type: 'postproof', dir: need().dir }));
  handle('postproof:ai', async ({ report }) => { const p = need(); const { ask, tag, parseJSONLoose } = engine; const pr = stages.promptPostProof(p, report, report.frontText || ''); const o = await ask({ ...stages.llmOpts(p), ...pr }); return parseJSONLoose(tag(o, 'report')); });
  handle('pdf:read', (f) => fs.readFileSync(f).toString('base64'));
  handle('cover:html', async ({ design, pages, mode, guides }) => {
    const p = need(); const pc = pages || (p.data.stages.layout && p.data.stages.layout.pages) || 200;
    const r = cover.buildCoverHtml(p, design || p.data.cover.design || {}, { pages: pc, mode: mode || 'spread', guides });
    const f = p.p('build', 'cover-preview.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, r.html);
    return { file: f, geometry: r.geometry, dpi: cover.dpiReport(p, design || p.data.cover.design || {}, pc), pages: pc, design: r.design };
  });
  handle('cover:build', async ({ design, mode, guides }) => runJob({ type: 'cover', dir: need().dir, design, mode, guides }));
  handle('cover:save', ({ design }) => { const p = need(); p.data.cover.design = design; p.save(); return view(); });
  handle('export:run', async ({ out, both, coverMode }) => runJob({ type: 'export', dir: need().dir, out, both, coverMode }, (x) => send('progress', { stage: 'export', ...x })));

  // ---- תמונות ----
  handle('image:generate', async ({ prompt, kind, id, aspect, useRef }) => {
    const p = need();
    const rel = `assets/${kind === 'cover' ? 'cover' : kind === 'ill' ? 'ill-' + id : 'img'}-${Date.now()}.png`;
    const ref = useRef && p.data.visual.referenceImage ? [p.p(p.data.visual.referenceImage)] : [];
    const full = (p.data.visual.bible && p.data.visual.bible.stylePrefix && kind !== 'raw' && !prompt.includes(p.data.visual.bible.stylePrefix.slice(0, 30)) ? p.data.visual.bible.stylePrefix + ' ' : '') + prompt;
    const r = await generateImage({ prompt: full, out: p.p(rel), refs: ref, aspect: aspect || 'square', model: p.data.engine.imageModel || 'gpt-image-2.5', onLog: (t) => send('progress', { stage: 'image', msg: t.slice(0, 120) }) });
    if (!p.data.visual.referenceImage) { p.data.visual.referenceImage = rel; }
    p.data.visual.images.push({ file: rel, kind, id, prompt, at: new Date().toISOString() }); p.save();
    return { rel, abs: p.p(rel), size: r.size };
  });
  handle('image:use', ({ kind, id, rel, plan, placement }) => {
    const p = need();
    if (kind === 'cover') { p.data.cover.design = { ...(p.data.cover.design || cover.defaultDesign(p)), image: rel }; }
    else { const c = p.chapter(id); c.illustration = { file: rel, alt: plan?.alt || c.title, caption: plan?.caption || '', placement: placement || 'opener', prompt: plan?.prompt || '' }; }
    p.save(); return view();
  });
  handle('image:setRef', (rel) => { need().data.visual.referenceImage = rel; need().save(); return true; });

  // ---- הגדרות / התקנה ----
  handle('engine:set', (patch) => { const p = need(); p.data.engine = { ...p.data.engine, ...patch }; p.save(); return view(); });
  handle('setup:run', (opts) => install.setup({ ...opts, log: (m) => send('progress', { stage: 'setup', msg: m }) }));
  handle('setup:doctor', () => install.doctor());
  handle('files:readB64', (f) => fs.readFileSync(f).toString('base64'));

  // ---- תפריט ----
  function menu() {
    const t = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'קובץ', submenu: [
        { label: 'פרויקט חדש…', accelerator: 'CmdOrCtrl+N', click: () => send('menu', 'new') },
        { label: 'פתיחת פרויקט…', accelerator: 'CmdOrCtrl+O', click: () => send('menu', 'open') },
        { type: 'separator' }, { label: 'התקנת CLI ותוספים…', click: () => send('menu', 'setup') }, { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' } ] },
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(t));
  }

  app.whenReady().then(() => {
    menu(); createWindow();
    // התקנה אוטומטית בהרצה ראשונה (CLI + תוספים) ברקע
    const flag = path.join(install.DATA, 'setup.json');
    if (!fs.existsSync(flag) || (() => { try { return JSON.parse(fs.readFileSync(flag, 'utf8')).version !== app.getVersion(); } catch { return true; } })()) {
      setTimeout(() => { try { const r = install.setup({ log: () => {} }); send('progress', { stage: 'setup', msg: 'ההתקנה הראשונית הושלמה', done: true, result: r }); } catch (e) { send('progress', { stage: 'setup', msg: 'שגיאת התקנה: ' + e.message }); } }, 2500);
    }
    if (process.env.SS_SHOTS) {
      const dir = process.env.SS_SHOTS; fs.mkdirSync(dir, { recursive: true });
      if (process.env.SS_PROJECT) { try { project = Project.open(process.env.SS_PROJECT); } catch (e) { console.error(e); } }
      win.webContents.on('console-message', (_e, lvl, msg) => { if (lvl >= 2) console.log('[renderer]', msg); });
      win.webContents.once('did-finish-load', async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        await wait(2500);
        const list = (process.env.SS_STAGES || 'home,write,lit,ling,proof,layout,postproof,cover,visual,export').split(',');
        for (const st of list) {
          try { await win.webContents.executeJavaScript(st === 'home' ? "window.__home()" : `window.__go('${st}')`); } catch (e) { console.log('go err', e.message); }
          await wait(Number(process.env.SS_WAIT || 3500));
          const img = await win.webContents.capturePage();
          fs.writeFileSync(path.join(dir, st + '.png'), img.toPNG());
          if (process.env.SS_EVAL) console.log('EVAL', await win.webContents.executeJavaScript(process.env.SS_EVAL));
        }
        app.exit(0);
      });
    }
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
    const arg = process.argv.slice(app.isPackaged ? 1 : 2).find((a) => !a.startsWith('-') && fs.existsSync(path.join(a, 'ספר.json')));
    if (arg) { try { project = Project.open(path.resolve(arg)); pushRecent(path.resolve(arg)); } catch {} }
  });
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
};
