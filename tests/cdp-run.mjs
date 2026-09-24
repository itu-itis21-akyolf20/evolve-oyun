#!/usr/bin/env node
/* ============================================================
   tests/cdp-run.mjs — oyunu başsız Chrome'da açıp bir senaryo koşturur.

   Her çağrı kendi tarayıcısını, kendi portunda, kendi geçici profiliyle
   açar: birden fazla ajan/terminal PARALEL test koşturabilir.

   Kullanım:
     node tests/cdp-run.mjs --port 9301 --scenario tests/scenarios/smoke.js [--timeout 300]
     node tests/cdp-run.mjs --port 9302 --eval "return EV.Game.stageIndex"

   Senaryo dosyası bir async fonksiyon GÖVDESİDİR; `T` (tests/harness.js)
   ve `EV` erişilebilir, `return` edilen değer JSON olarak basılır.
   Çıktı: { ok, result, exceptions[], consoleErrors[], ms }
   ============================================================ */
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const port = Number(opt('port', 9300 + Math.floor(Math.random() * 600)));
const timeout = Number(opt('timeout', 300)) * 1000;
const scenarioPath = opt('scenario', null);
const inline = opt('eval', null);
const width = Number(opt('width', 1280)), height = Number(opt('height', 760));
const shot = opt('shot', null);   // senaryodan sonra ekran görüntüsü (png)

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const exe = BROWSERS.find((p) => existsSync(p));
if (!exe) { console.log(JSON.stringify({ ok: false, error: 'Chrome/Edge bulunamadı' })); process.exit(2); }

const body = scenarioPath ? readFileSync(resolve(scenarioPath), 'utf8') : (inline || 'return T.state();');
const harness = readFileSync(join(here, 'harness.js'), 'utf8');
const profile = mkdtempSync(join(tmpdir(), 'evo-cdp-'));
const url = opt('url', pathToFileURL(join(root, 'index.html')).href);   // --url http://127.0.0.1:8090/ ile sunucudan

const chrome = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio',
  '--allow-file-access-from-files', url,
], { stdio: 'ignore' });

const out = { ok: false, result: null, exceptions: [], consoleErrors: [], ms: 0 };
const t0 = Date.now();
let ws = null;
let finished = false;

function finish(code) {
  if (finished) return;
  finished = true;
  out.ms = Date.now() - t0;
  try { ws && ws.close(); } catch (e) { /* yok say */ }
  try { chrome.kill(); } catch (e) { /* yok say */ }
  setTimeout(() => {
    try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* kilitli olabilir */ }
    console.log(JSON.stringify(out, null, 2));
    process.exit(code);
  }, 400);
}

const killer = setTimeout(() => { out.error = 'zaman aşımı'; finish(3); }, timeout);

async function target() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools:'));
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* tarayıcı açılıyor */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('CDP hedefi bulunamadı');
}

let seq = 0;
const pending = new Map();
function send(method, params) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error((d.exception && d.exception.description) || d.text);
  }
  return r.result.value;
}

(async () => {
  try {
    ws = new WebSocket(await target());
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        out.exceptions.push(((d.exception && d.exception.description) || d.text || '').slice(0, 600));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        out.consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 600));
      }
    };
    await send('Runtime.enable', {});
    for (let i = 0; i < 100; i++) {
      if (await evaluate('!!(window.EV && EV.Game && EV.Game.renderer)')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await evaluate(harness);
    out.result = await evaluate('(async () => {\n' + body + '\n})()');
    if (shot) {
      await new Promise((r) => setTimeout(r, 600));   // en az bir kare çizilsin
      const img = await send('Page.captureScreenshot', { format: 'png' });
      const { writeFileSync } = await import('node:fs');
      writeFileSync(resolve(shot), Buffer.from(img.data, 'base64'));
      out.shot = resolve(shot);
    }
    out.ok = out.exceptions.length === 0;
    clearTimeout(killer);
    finish(0);
  } catch (e) {
    out.error = String(e && e.message || e);
    clearTimeout(killer);
    finish(1);
  }
})();
