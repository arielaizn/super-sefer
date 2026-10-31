// יצירת תמונות דרך Codex (כלי image_gen המובנה, במסגרת מנוי ChatGPT/Codex של המשתמש)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { findBin, env } = require('./engine');
const { imageSize } = require('./cover');

const codexHome = () => process.env.CODEX_HOME || path.join(os.homedir(), '.codex');

function newestImage(dir, since) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs })).filter((x) => x.t >= since - 2000).sort((a, b) => b.t - a.t);
  return files[0] ? path.join(dir, files[0].f) : null;
}

/**
 * generateImage({ prompt, out, refs, model, size, onLog, signal, timeout })
 * out — נתיב מלא לשמירה (PNG).
 */
async function generateImage({ prompt, out, refs = [], model = 'gpt-image-2.5', aspect = 'square', onLog, signal, timeout = 600000 }) {
  const bin = findBin('codex');
  if (!bin) throw new Error('Codex CLI לא נמצא. התקינו (npm i -g @openai/codex) והתחברו עם חשבון ChatGPT, כדי לייצר איורים.');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-img-'));
  const started = Date.now();
  const aspectTxt = { square: 'square 1:1', portrait: 'portrait 2:3 (tall)', landscape: 'landscape 3:2 (wide)', cover: 'portrait 2:3 (tall book cover proportions)' }[aspect] || aspect;
  const lines = [
    `Use the built-in image generation tool (image_gen), with the image model "${model}" (use the best/latest OpenAI image model available to this account if that exact name cannot be selected), to generate exactly ONE image. Do not use any other tool or write any files.`,
    refs.length ? 'The attached image(s) are style/identity references: match their style, palette, line quality and rendering exactly while depicting the new scene.' : '',
    `Aspect ratio: ${aspectTxt}.`,
    'IMAGE PROMPT:', prompt,
    'When finished, reply with the single word DONE.',
  ].filter(Boolean).join('\n');
  const args = ['exec', '--skip-git-repo-check', '--json', '-s', 'workspace-write', '--ephemeral'];
  for (const r of refs) args.push('-i', r);
  args.push('-');
  const thread = await new Promise((resolve, reject) => {
    const ch = spawn(bin, args, { cwd: work, env: env(), stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '', tid = null, err = '';
    const to = setTimeout(() => { ch.kill('SIGKILL'); reject(new Error('יצירת התמונה ארכה יותר מדי')); }, timeout);
    if (signal) signal.addEventListener('abort', () => { ch.kill('SIGKILL'); reject(new Error('בוטל')); });
    ch.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        try { const j = JSON.parse(line); if (j.type === 'thread.started') tid = j.thread_id; if (onLog && j.item && j.item.text) onLog(j.item.text); } catch {}
      }
    });
    ch.stderr.on('data', (d) => { err += d; });
    ch.on('error', (e) => { clearTimeout(to); reject(e); });
    ch.on('close', (code) => { clearTimeout(to); resolve({ tid, code, err }); });
    ch.stdin.end(lines);
  });
  fs.rmSync(work, { recursive: true, force: true });
  let found = null;
  if (thread.tid) found = newestImage(path.join(codexHome(), 'generated_images', thread.tid), started);
  if (!found) { // גיבוי: התמונה החדשה ביותר בכל התיקייה
    const root = path.join(codexHome(), 'generated_images');
    if (fs.existsSync(root)) for (const d of fs.readdirSync(root)) { const f = newestImage(path.join(root, d), started); if (f && (!found || fs.statSync(f).mtimeMs > fs.statSync(found).mtimeMs)) found = f; }
  }
  if (!found) throw new Error('Codex לא יצר תמונה' + (thread.err ? ': ' + thread.err.slice(-300) : '') + ' — ודאו שהחשבון מחובר ושכלי יצירת התמונות פעיל.');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(found, out);
  return { file: out, size: imageSize(out), source: found };
}

module.exports = { generateImage };
