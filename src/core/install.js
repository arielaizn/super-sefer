// התקנת סביבת העבודה: פקודת CLI במסלול (PATH), תוסף Claude Code, כישורי Codex, ותוסף codex-plugin-cc ליצירת איורים
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const engine = require('./engine');

const IS_WIN = process.platform === 'win32';
const HOME = os.homedir();
const DATA = path.join(HOME, '.super-sefer');

function resourcesRoot() {
  // בפיתוח: תיקיית הפרויקט; בהתקנה: Resources
  const dev = path.join(__dirname, '..', '..');
  const res = process.resourcesPath ? path.join(process.resourcesPath) : null;
  if (res && fs.existsSync(path.join(res, 'plugins'))) return res;
  return dev;
}

function cliTarget() {
  // הקובץ שמריץ את ה-CLI (JS) ואת הבינארי של Electron/Node
  const js = path.join(__dirname, '..', '..', 'cli', 'index.js');
  return { exe: process.execPath, js };
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

function installCli(log = () => {}) {
  const { exe, js } = cliTarget();
  fs.mkdirSync(DATA, { recursive: true });
  const res = [];
  if (IS_WIN) {
    const dir = path.join(DATA, 'bin');
    fs.mkdirSync(dir, { recursive: true });
    const cmd = `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${exe}" "${js}" %*\r\n`;
    for (const n of ['sofer-sefer', 'sofer']) fs.writeFileSync(path.join(dir, n + '.cmd'), cmd);
    // הוספה ל-PATH של המשתמש
    try {
      const cur = execFileSync('powershell', ['-NoProfile', '-Command', "[Environment]::GetEnvironmentVariable('Path','User')"], { encoding: 'utf8' }).trim();
      if (!cur.split(';').includes(dir)) execFileSync('powershell', ['-NoProfile', '-Command', `[Environment]::SetEnvironmentVariable('Path', '${(cur ? cur + ';' : '') + dir}', 'User')`]);
      res.push({ ok: true, where: dir, note: 'נוסף ל-PATH (פתחו מחדש את הטרמינל)' });
    } catch (e) { res.push({ ok: false, where: dir, note: 'לא הצלחתי לעדכן PATH: ' + e.message }); }
  } else {
    const script = `#!/bin/sh\n# סופר-ספר CLI — נוצר אוטומטית\nELECTRON_RUN_AS_NODE=1 exec "${exe}" "${js}" "$@"\n`;
    const dirs = [path.join(HOME, '.local', 'bin'), '/usr/local/bin'];
    for (const dir of dirs) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        for (const n of ['sofer-sefer', 'sofer']) { const f = path.join(dir, n); fs.writeFileSync(f, script, { mode: 0o755 }); fs.chmodSync(f, 0o755); }
        res.push({ ok: true, where: dir });
      } catch (e) { res.push({ ok: false, where: dir, note: e.code === 'EACCES' ? 'אין הרשאה' : e.message }); }
    }
    // PATH ב-zsh/bash אם חסר ~/.local/bin
    const rc = [path.join(HOME, '.zprofile'), path.join(HOME, '.bash_profile')];
    for (const f of rc) {
      try {
        const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        if (!/\.local\/bin/.test(cur) && f.endsWith('.zprofile')) fs.appendFileSync(f, '\n# סופר-ספר\nexport PATH="$HOME/.local/bin:$PATH"\n');
      } catch {}
    }
  }
  log('CLI: ' + JSON.stringify(res));
  return res;
}

function pluginSrc(name) { return path.join(resourcesRoot(), 'plugins', name); }

// תוסף Claude Code: מרקטפלייס מקומי + התקנה דרך claude plugin
function installClaudePlugin(log = () => {}) {
  const out = { ok: false, steps: [] };
  const mk = path.join(DATA, 'claude-marketplace');
  fs.rmSync(mk, { recursive: true, force: true });
  copyDir(pluginSrc('claude-code'), mk);
  // ה-CLI שהתוסף מפעיל: נתיב מוחלט לפקודה
  out.steps.push('הועתק מרקטפלייס אל ' + mk);
  const claude = engine.findBin('claude');
  if (!claude) { out.note = 'Claude Code לא נמצא — התוסף הועתק ל-' + mk + '. אחרי התקנת Claude Code הריצו: sofer-sefer setup'; return out; }
  const run = (args) => { const r = spawnSync(claude, args, { encoding: 'utf8', env: engine.env(), timeout: 120000 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
  let r = run(['plugin', 'marketplace', 'add', mk]);
  out.steps.push(`marketplace add: ${r.code}`);
  if (r.code !== 0 && /already/i.test(r.out)) { r = run(['plugin', 'marketplace', 'update', 'super-sefer']); out.steps.push(`marketplace update: ${r.code}`); }
  r = run(['plugin', 'install', 'super-sefer@super-sefer']);
  out.steps.push(`install: ${r.code} ${r.out.trim().split('\n').pop()}`);
  if (r.code !== 0 && /already/i.test(r.out)) r.code = 0;
  out.ok = r.code === 0;
  if (!out.ok) out.note = r.out.slice(-300);
  log('Claude plugin: ' + JSON.stringify(out));
  return out;
}

// codex-plugin-cc — המשמש ליצירת איורים דרך Codex מתוך Claude Code
function installCodexPluginCC(log = () => {}) {
  const claude = engine.findBin('claude');
  if (!claude) return { ok: false, note: 'Claude Code לא נמצא' };
  const run = (args) => { const r = spawnSync(claude, args, { encoding: 'utf8', env: engine.env(), timeout: 180000 }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
  const list = run(['plugin', 'list']).out;
  if (/codex@openai-codex/.test(list)) return { ok: true, note: 'כבר מותקן' };
  let r = run(['plugin', 'marketplace', 'add', 'openai/codex-plugin-cc']);
  r = run(['plugin', 'install', 'codex@openai-codex']);
  const ok = r.code === 0 || /already/i.test(r.out);
  log('codex-plugin-cc: ' + r.out.trim().split('\n').pop());
  return { ok, note: ok ? 'הותקן' : r.out.slice(-300) };
}

// Codex: כישורים (skills) ב-~/.codex/skills ו-AGENTS.md
function installCodexSkills(log = () => {}) {
  const src = pluginSrc('codex');
  const skills = path.join(src, 'skills');
  const dstRoot = path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'skills');
  const done = [];
  if (fs.existsSync(skills)) for (const n of fs.readdirSync(skills)) {
    const d = path.join(dstRoot, n);
    fs.rmSync(d, { recursive: true, force: true });
    copyDir(path.join(skills, n), d); done.push(n);
  }
  // תוסף Codex (מניפסט) לשימוש עתידי ב-codex plugin
  const plug = path.join(DATA, 'codex-plugin');
  fs.rmSync(plug, { recursive: true, force: true });
  copyDir(src, plug);
  log('Codex skills: ' + done.join(', '));
  return { ok: true, skills: done, dir: dstRoot, plugin: plug };
}

function setup({ log = () => {}, cli = true, claude = true, codex = true, ccplugin = true } = {}) {
  const r = {};
  try { if (cli) r.cli = installCli(log); } catch (e) { r.cli = { ok: false, note: e.message }; }
  try { if (claude) r.claude = installClaudePlugin(log); } catch (e) { r.claude = { ok: false, note: e.message }; }
  try { if (codex) r.codex = installCodexSkills(log); } catch (e) { r.codex = { ok: false, note: e.message }; }
  try { if (ccplugin) r.codexPluginCC = installCodexPluginCC(log); } catch (e) { r.codexPluginCC = { ok: false, note: e.message }; }
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(path.join(DATA, 'setup.json'), JSON.stringify({ at: new Date().toISOString(), version: require('../../package.json').version, result: r }, null, 1));
  return r;
}

function doctor() {
  const d = engine.detect();
  const sofer = (() => { try { return execFileSync(IS_WIN ? 'where' : 'which', ['sofer-sefer'], { encoding: 'utf8', env: engine.env() }).trim().split('\n')[0]; } catch { return null; } })();
  const claudeList = d.claude ? (spawnSync(d.claude, ['plugin', 'list'], { encoding: 'utf8', env: engine.env(), timeout: 30000 }).stdout || '') : '';
  return {
    claudeCode: d.claude || 'לא נמצא', codex: d.codex || 'לא נמצא', cliOnPath: sofer || 'לא במסלול',
    claudePlugin: /super-sefer/.test(claudeList) ? 'מותקן' : 'לא מותקן', codexPluginCC: /codex@openai-codex/.test(claudeList) ? 'מותקן' : 'לא מותקן',
    codexSkills: fs.existsSync(path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'skills', 'super-sefer')) ? 'מותקן' : 'לא מותקן',
    platform: process.platform + '/' + process.arch, node: process.versions.node, electron: process.versions.electron || null,
  };
}

module.exports = { setup, doctor, installCli, installClaudePlugin, installCodexSkills, installCodexPluginCC, DATA };
