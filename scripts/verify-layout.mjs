#!/usr/bin/env node
/**
 * Visual layout check in a real (headless) Chromium at exact viewport sizes.
 * For every case it reports page overflow, whether each chart and each
 * equilibrium marker lies inside the viewport and inside its plot area, and
 * saves a screenshot.
 *
 *   npm run dev -- --port 5173 --strictPort     # in another terminal
 *   node scripts/verify-layout.mjs [baseUrl] [--out dir]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const OUT = resolve(outAt >= 0 ? args.splice(outAt, 2)[1] : 'docs/screenshots/ajuste');
const BASE = args[0] ?? 'http://localhost:5173/';
const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p));
if (!BROWSER) throw new Error('No Chromium-based browser found.');
mkdirSync(OUT, { recursive: true });

const HELPERS = `
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__set = async (el, value) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await window.__wait(250);
  };
  window.__pick = (label, value) => window.__set(document.querySelector('select[aria-label="' + label + '"]'), value);
  window.__range = (value) => window.__set(document.querySelector('input[type=range]'), String(value));
  window.__param = (label, value) => window.__set(document.querySelector('input[aria-label="' + label + '"]'), String(value));
  window.__tab = async (name) => { [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent.trim() === name).click(); await window.__wait(300); };
  window.__click = async (text, scope = document.querySelector('main')) => { [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === text).click(); await window.__wait(350); };
`;

/** Measures page overflow and, for every SVG chart, its box and its markers against the plot. */
const MEASURE = `
  const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement;
  const charts = [...document.querySelectorAll('main svg[role=img]')].filter((s) => s.getBoundingClientRect().width > 120);
  const out = { vw, vh, pageOverflowY: de.scrollHeight - vh, pageOverflowX: de.scrollWidth - de.clientWidth, charts: [] };
  for (const svg of charts) {
    const r = svg.getBoundingClientRect();
    const plotClip = svg.querySelector('rect.plot-area');
    const pr = plotClip ? plotClip.getBoundingClientRect() : null;
    const pts = [...svg.querySelectorAll('circle')].filter((c) => !c.closest('defs'));
    const outside = pr ? pts.filter((c) => { const b = c.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2; return cx < pr.left - 1 || cx > pr.right + 1 || cy < pr.top - 1 || cy > pr.bottom + 1; }).length : null;
    out.charts.push({ name: svg.getAttribute('aria-label')?.slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), inViewport: r.top >= 0 && r.bottom <= vh + 1 && r.left >= 0 && r.right <= vw + 1, markers: pts.length, markersOutsidePlot: outside });
  }
  return out;
`;

const T = '?m=transmission';
const CASES = [
  { name: 'transmision-1920x1080', w: 1920, h: 1080, query: T },
  { name: 'transmision-1366x768', w: 1366, h: 768, query: T },
  { name: 'transmision-1440x900', w: 1440, h: 900, query: T },
  { name: 'transmision-2560x1440', w: 2560, h: 1440, query: T },
  // A maximised browser window at 1366 × 768 leaves about 650 px for the page.
  { name: 'transmision-1366x650-ventana', w: 1366, h: 650, query: T },
  { name: 'transmision-monetaria-max-1366x768', w: 1366, h: 768, query: T, actions: ['await __range(350);'] },
  { name: 'transmision-monetaria-slider', w: 1366, h: 768, query: T, actions: ['for (const v of [30, 120, 250, 350, 80]) { await __range(v); }'] },
  { name: 'transmision-fiscal-1366x768', w: 1366, h: 768, query: T, actions: ["await __pick('Seleccionar política o perturbación', 'fiscalExpansion');", 'await __range(200);'] },
  { name: 'transmision-fiscal-pasos-1366x768', w: 1366, h: 768, query: T, actions: ["await __pick('Seleccionar política o perturbación', 'fiscalExpansion');", "await __click('Explicar transmisión económica');", "await __click('Siguiente'); await __click('Siguiente');"] },
  { name: 'transmision-extremos-1366x768', w: 1366, h: 768, query: T, actions: ["await __tab('Parámetros');", "await __param('h Final', 400);", "await __param('c Final', 0.9);", "await __param('M Final', 2000);", "await __tab('Simulación');"] },
  { name: 'transmision-tasa-1366x768', w: 1366, h: 768, query: T, actions: ["await __pick('Seleccionar política o perturbación', 'rateCut');", 'await __range(-4);'] },
  { name: 'avanzado-1366x768', w: 1366, h: 768, query: '?m=advanced' },
  { name: 'politicas-1366x768', w: 1366, h: 768, query: '?m=policy' },
  { name: 'politicas-1920x1080', w: 1920, h: 1080, query: '?m=policy' },
  { name: 'islm-tradicional-1366x768', w: 1366, h: 768, query: '?m=basic' },
  { name: 'construccion-1366x768', w: 1366, h: 768, query: '?m=construction' },
  { name: 'mundell-fleming-1366x768', w: 1366, h: 768, query: '?m=open' },
  { name: 'oa-da-1366x768', w: 1366, h: 768, query: '?m=adas' },
  { name: 'is-mp-1366x768', w: 1366, h: 768, query: '?m=ismp' },
  { name: 'avanzado-trampa-1366x768', w: 1366, h: 768, query: '?m=advanced', actions: ["[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Trampa de liquidez: política fiscal')).click(); await __wait(500);"] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), 'islm-verify-'));
const browser = spawn(BROWSER, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

async function cdpPage() {
  for (let k = 0; k < 50; k += 1) {
    try {
      await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      break;
    } catch {
      await sleep(200);
    }
  }
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) =>
    new Promise((ok, ko) => {
      id += 1;
      pending.set(id, (m) => (m.error ? ko(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}

async function evaluate(page, js) {
  const r = await page.send('Runtime.evaluate', { expression: `(async () => { ${HELPERS} ${js} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

const report = [];
try {
  const page = await cdpPage();
  await page.send('Page.enable');
  for (const c of CASES) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: c.w, height: c.h, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: BASE });
    await sleep(700);
    await evaluate(page, "localStorage.clear(); localStorage.setItem('islm.guide.seen', '1');");
    await page.send('Page.navigate', { url: `${BASE}${c.query}` });
    await sleep(1800);
    if (c.actions) await evaluate(page, c.actions.join('\n'));
    await sleep(700);
    const m = await evaluate(page, MEASURE);
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, `${c.name}.png`), Buffer.from(data, 'base64'));
    report.push({ case: c.name, ...m });
    // Transmission must show every chart on one screen; elsewhere the first chart must fit and no marker may leave its plot.
    // Layout rule: Transmisión shows every chart; IS-LM avanzado and Políticas their main chart; the other modules are checked for framing only.
    const must = c.query.includes('transmission') ? m.charts : /advanced|policy/.test(c.query) ? m.charts.slice(0, 1) : [];
    const bad = [...must.filter((x) => !x.inViewport), ...m.charts.filter((x) => x.markersOutsidePlot)];
    console.log(`${bad.length || m.pageOverflowX > 0 ? '✗' : '✓'} ${c.name}: page overflow y=${m.pageOverflowY} x=${m.pageOverflowX}; charts ${m.charts.map((x) => `[${x.top}–${x.bottom}${x.inViewport ? '' : ' OUT'}${x.markersOutsidePlot ? ` markers-out:${x.markersOutsidePlot}` : ''}]`).join(' ')}`);
  }
  page.close();
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  browser.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* left in the OS temp directory */
  }
}
