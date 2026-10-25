#!/usr/bin/env node
/**
 * Captures the README screenshots from a running local server with a locally
 * installed Chromium-based browser, driven through the Chrome DevTools
 * Protocol (Node ≥ 22 ships a WebSocket client, so no extra dependencies).
 *
 *   npm run dev -- --port 5173 --strictPort     # in another terminal
 *   node scripts/screenshots.mjs [baseUrl] [browserPath]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:5173/';
const CANDIDATES = [
  process.argv[3],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) throw new Error('No Chromium-based browser found; pass its path as the second argument.');

const OUT = resolve('docs/screenshots');
mkdirSync(OUT, { recursive: true });

const DEFAULT = { C0: 200, c: 0.75, T: 200, I0: 300, b: 25, G: 250, M: 700, P: 1, k: 0.5, h: 50 };
const share = (shocked, regime = 'money-supply', t0 = 5, t1 = 5) =>
  '#s=' + Buffer.from(JSON.stringify({ b: DEFAULT, s: { ...DEFAULT, ...shocked }, r: regime, t0, t1 })).toString('base64url');

// Spanish is the default interface language, so the main captures carry no ?lang.
const SHOTS = [
  { file: 'simulador-fiscal-oscuro.png', query: '?theme=dark', hash: share({ G: 300 }), w: 1440, h: 1180 },
  { file: 'simulador-monetaria-claro.png', query: '?theme=light', hash: share({ M: 800 }), w: 1440, h: 1180 },
  { file: 'transmision-oscuro.png', query: '?theme=dark&tab=transmission', hash: share({ G: 300 }), w: 1440, h: 1000 },
  { file: 'sensibilidad-claro.png', query: '?theme=light&tab=sensitivity', hash: share({}), w: 1440, h: 1000 },
  { file: 'objetivo-tasa-oscuro.png', query: '?theme=dark', hash: share({ G: 300 }, 'interest-target'), w: 1440, h: 1180 },
  { file: 'modelo-claro.png', query: '?theme=light&tab=model', hash: share({}), w: 1440, h: 1000 },
  { file: 'escenarios-claro.png', query: '?theme=light&tab=scenarios', hash: share({ G: 300 }), w: 1440, h: 760 },
  { file: 'movil-oscuro.png', query: '?theme=dark', hash: share({ M: 800 }), w: 390, h: 1100, mobile: true, scale: 2 },
  // Secondary (English) documentation
  { file: 'en-simulator-fiscal-dark.png', query: '?lang=en&theme=dark', hash: share({ G: 300 }), w: 1440, h: 1180 },
  { file: 'en-transmission-light.png', query: '?lang=en&theme=light&tab=transmission', hash: share({ M: 800 }), w: 1440, h: 1000 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9333;
const profile = mkdtempSync(join(tmpdir(), 'islm-shots-'));
const browser = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

async function waitForBrowser() {
  for (let k = 0; k < 50; k += 1) {
    try {
      return await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Browser did not start');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const ready = new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) =>
    new Promise((resolveMsg, reject) => {
      id += 1;
      pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolveMsg(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

try {
  await waitForBrowser();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const page = cdp(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable');
  for (const s of SHOTS) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.scale ?? 1, mobile: Boolean(s.mobile) });
    await page.send('Page.navigate', { url: 'about:blank' });
    await page.send('Page.navigate', { url: `${BASE}${s.query}${s.hash}` });
    await sleep(2500);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(resolve(OUT, s.file), Buffer.from(data, 'base64'));
    console.log(`✓ ${s.file}`);
  }
  page.close();
} finally {
  browser.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* profile still locked; left in the OS temp directory */
  }
}
