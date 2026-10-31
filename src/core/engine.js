// הרצת מודלי שפה דרך המנויים של המשתמש: Claude Code CLI או Codex CLI (ללא מפתחות API)
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const IS_WIN = process.platform === 'win32';
const HOME = os.homedir();

function candidates(name) {
  const exe = IS_WIN ? '.cmd' : '';
  const list = [
    path.join(HOME, '.local', 'bin', name + (IS_WIN ? '.exe' : '')),
    path.join(HOME, '.claude', 'local', name),
    '/opt/homebrew/bin/' + name, '/usr/local/bin/' + name, '/usr/bin/' + name,
    path.join(HOME, '.npm-global', 'bin', name), path.join(HOME, '.bun', 'bin', name),
    path.join(HOME, '.volta', 'bin', name), path.join(HOME, 'AppData', 'Roaming', 'npm', name + exe),
    path.join(HOME, 'AppData', 'Local', 'Programs', name, name + '.exe'),
  ];
  if (name === 'codex') list.push(path.join(HOME, '.codex', 'packages', 'standalone', 'current', 'bin', 'codex'));
  return list;
}

const cache = {};
function findBin(name) {
  if (cache[name] !== undefined) return cache[name];
  let found = candidates(name).find((p) => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } }) || null;
  if (!found) {
    try {
      if (IS_WIN) found = execFileSync('where', [name], { encoding: 'utf8', timeout: 5000 }).split(/\r?\n/)[0].trim() || null;
      else found = execFileSync(process.env.SHELL || '/bin/zsh', ['-lc', `command -v ${name}`], { encoding: 'utf8', timeout: 8000 }).trim().split('\n').pop() || null;
      if (found && !fs.existsSync(found)) found = null;
    } catch { found = null; }
  }
  return (cache[name] = found);
}

function env() {
  // אפליקציית GUI לא יורשת PATH מלא; מוסיפים תיקיות נפוצות כדי ש-node/codex יימצאו
  const extra = [path.join(HOME, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  const sep = IS_WIN ? ';' : ':';
  const e = { ...process.env, PATH: [...extra, process.env.PATH || ''].join(sep) };
  delete e.ELECTRON_RUN_AS_NODE; delete e.CLAUDECODE; delete e.CLAUDE_CODE_ENTRYPOINT;
  return e;
}

function detect() {
  return { claude: findBin('claude'), codex: findBin('codex') };
}

function run(cmd, args, { input, cwd, timeout = 900000, onData, signal } = {}) {
  return new Promise((resolve, reject) => {
    const ch = spawn(cmd, args, { cwd: cwd || os.tmpdir(), env: env(), stdio: ['pipe', 'pipe', 'pipe'], shell: IS_WIN && /\.cmd$/i.test(cmd) });
    let out = '', err = '';
    const to = setTimeout(() => { ch.kill('SIGKILL'); reject(new Error('תם הזמן שהוקצב להרצה')); }, timeout);
    if (signal) signal.addEventListener('abort', () => { ch.kill('SIGKILL'); reject(new Error('בוטל')); });
    ch.stdout.on('data', (d) => { out += d; onData && onData(String(d)); });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('error', (e) => { clearTimeout(to); reject(e); });
    ch.on('close', (code) => { clearTimeout(to); resolve({ code, out, err }); });
    if (input != null) ch.stdin.end(input); else ch.stdin.end();
  });
}

/**
 * ask({engine:'claude'|'codex', system, prompt, model, onData}) -> טקסט התשובה
 */
async function ask({ engine = 'claude', system = '', prompt, model = '', effort = '', cwd, onData, timeout, signal } = {}) {
  if (engine === 'codex') return askCodex({ system, prompt, model, effort, cwd, timeout, signal });
  const bin = findBin('claude');
  if (!bin) throw new Error('Claude Code לא נמצא במחשב. התקינו אותו (claude.ai/code) והתחברו, או עברו למנוע Codex בהגדרות.');
  const args = ['-p', '--output-format', 'json', '--tools', '', '--no-session-persistence', '--disable-slash-commands'];
  if (system) args.push('--append-system-prompt', system);
  if (model) args.push('--model', model);
  if (effort) args.push('--effort', effort);
  const { code, out, err } = await run(bin, args, { input: prompt, cwd, timeout, signal });
  let j;
  try { j = JSON.parse(out); } catch { if (code !== 0) throw new Error('Claude נכשל: ' + (err || out).slice(0, 400)); return out.trim(); }
  if (j.is_error) throw new Error('Claude: ' + (j.result || err || 'שגיאה'));
  return String(j.result || '').trim();
}

async function askCodex({ system, prompt, model, effort, cwd, timeout, signal }) {
  const bin = findBin('codex');
  if (!bin) throw new Error('Codex CLI לא נמצא במחשב. התקינו אותו (npm i -g @openai/codex) והתחברו.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-codex-'));
  const outFile = path.join(tmp, 'last.txt');
  const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '-o', outFile];
  if (model) args.push('-m', model);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  args.push('-');
  const full = (system ? system + '\n\n' : '') + prompt;
  const { code, err } = await run(bin, args, { input: full, cwd: tmp, timeout, signal });
  const res = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').trim() : '';
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!res) throw new Error('Codex לא החזיר תשובה' + (code ? ` (קוד ${code})` : '') + ': ' + err.slice(-300));
  return res;
}

// ---- פענוח פלטים מובנים ----
function tag(text, name) {
  const m = text.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}
function parseJSONLoose(s) {
  if (s == null) return null;
  s = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(s); } catch {}
  const a = s.indexOf('{'), b = s.lastIndexOf('}'), c = s.indexOf('['), d = s.lastIndexOf(']');
  for (const [i, j] of (c !== -1 && (a === -1 || c < a) ? [[c, d], [a, b]] : [[a, b], [c, d]])) {
    if (i !== -1 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch {} }
  }
  return null;
}

module.exports = { ask, detect, findBin, run, tag, parseJSONLoose, env };
