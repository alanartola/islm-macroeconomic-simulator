#!/usr/bin/env node
/**
 * Captures the README screenshots from a running local server with a locally
 * installed Chromium-based browser, driven through the Chrome DevTools
 * Protocol (Node ≥ 22 ships a WebSocket client, so no extra dependencies).
 * Every capture starts from a clean localStorage, so the defaults (Spanish,
 * dark theme) are the ones a first-time visitor sees; interactions use the
 * real interface (preset buttons, "Guardar experimento", tabs).
 *
 *   npm run dev -- --port 5173 --strictPort     # in another terminal
 *   node scripts/screenshots.mjs [baseUrl] [browserPath] [--out dir] [--pdf file.pdf]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const pdfAt = args.indexOf('--pdf');
const PDF = pdfAt >= 0 ? args.splice(pdfAt, 2)[1] : null;
const outAt = args.indexOf('--out');
const OUT_DIR = outAt >= 0 ? args.splice(outAt, 2)[1] : 'docs/screenshots';
const BASE = args[0] ?? 'http://localhost:5173/islm-macroeconomic-simulator/';
const CANDIDATES = [
  args[1],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) throw new Error('No Chromium-based browser found; pass its path as the second argument.');

const OUT = resolve(OUT_DIR);
mkdirSync(OUT, { recursive: true });

const DEFAULT = { C0: 200, c: 0.75, T: 200, I0: 300, b: 25, G: 250, M: 700, P: 1, k: 0.5, h: 50 };
const share = (shocked, regime = 'money-supply', t0 = 5, t1 = 5) =>
  '#s=' + Buffer.from(JSON.stringify({ b: DEFAULT, s: { ...DEFAULT, ...shocked }, r: regime, t0, t1 })).toString('base64url');

/** Browser-side helpers injected before the actions of each capture. */
const HELPERS = `
  window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__click = async (text, scope = document) => {
    const b = [...scope.querySelectorAll('button, [role=tab]')].find((x) => x.textContent.trim().startsWith(text) || x.textContent.includes(text));
    if (!b) throw new Error('button not found: ' + text);
    b.click();
    await window.__wait(350);
  };
  window.__nav = (text) => window.__click(text, document.querySelector('.module-nav'));
  /** Sets a React-controlled field through the native setter so that onChange fires. */
  window.__set = async (el, value) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    await window.__wait(250);
  };
  window.__fill = (label, value) => window.__set(document.querySelector('input[aria-label="' + label + '"]'), value);
`;
const click = (text) => `await __click(${JSON.stringify(text)});`;
const nav = (text) => `await __nav(${JSON.stringify(text)});`;
const scrollTo = (selector) => `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'start' }); window.scrollBy(0, -112); await __wait(300);`;
const SAVE = click('Guardar experimento');
const fill = (label, value) => `await __fill(${JSON.stringify(label)}, ${JSON.stringify(value)});`;
const pick = (label, value) => `await __set(document.querySelector('select[aria-label="${label}"]'), ${JSON.stringify(value)}); await __wait(500);`;
const episode = (id) => `${pick('Acontecimientos económicos', 'one')} ${pick('Acontecimiento', id)} await __wait(600);`;
const openDetails = (selector) => `document.querySelector(${JSON.stringify(selector)}).open = true; document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('toggle')); await __wait(400);`;
const SOLVE_FISCAL = [
  click('Nuevo equilibrio tras una expansión fiscal'),
  fill('Producto de equilibrio Y₁', '1980'),
  fill('Variación del producto ΔY', '80'),
  fill('Variación de la tasa Δi', '0,8'),
  fill('Multiplicador fiscal dY/dG', '2'),
  fill('Variación de la inversión privada ΔI', '-25'),
  click('Verificar'),
  scrollTo('.ex-detail'),
];

/** Saves four experiments from different modules and opens the lab (all through the interface). */
const FILL_LAB = [
  click('C · Expansión fiscal: G↑'),
  SAVE,
  nav('B IS-LM avanzado'),
  click('Expansión fiscal con t > 0'),
  SAVE,
  nav('F OA-DA'),
  click('Expansión fiscal'),
  SAVE,
  nav('E Mundell-Fleming'),
  click('Expansión fiscal (fijo)'),
  SAVE,
  nav('H Escenarios'),
];

// Spanish and dark mode are the defaults, so the main captures carry neither ?lang nor ?theme.
const SHOTS = [
  { file: 'inicio-oscuro.png', query: '', w: 1440, h: 1000 },
  { file: 'inicio-claro.png', query: '?theme=light', w: 1440, h: 1000 },
  { file: 'simulador-fiscal-oscuro.png', query: '?m=basic', hash: share({ G: 300 }), w: 1440, h: 1180 },
  { file: 'simulador-monetaria-claro.png', query: '?m=basic&theme=light', hash: share({ M: 800 }), w: 1440, h: 1180 },
  { file: 'transmision-oscuro.png', query: '?m=basic&tab=transmission', hash: share({ G: 300 }), w: 1440, h: 1000 },
  { file: 'sensibilidad-claro.png', query: '?m=basic&theme=light&tab=sensitivity', hash: share({}), w: 1440, h: 1000 },
  { file: 'objetivo-tasa-oscuro.png', query: '?m=basic', hash: share({ G: 300 }, 'interest-target'), w: 1440, h: 1180 },
  { file: 'modelo-claro.png', query: '?m=basic&theme=light&tab=model', hash: share({}), w: 1440, h: 1000 },
  { file: 'avanzado-trampa-oscuro.png', query: '?m=advanced', actions: [click('Trampa de liquidez: política monetaria')], w: 1440, h: 1180 },
  { file: 'construccion-oscuro.png', query: '?m=construction', actions: [click('Expansión fiscal con t > 0')], w: 1440, h: 1400 },
  { file: 'politicas-oscuro.png', query: '?m=policy', w: 1440, h: 1180 },
  { file: 'mundell-fleming-oscuro.png', query: '?m=open', actions: [click('Expansión fiscal (fijo)')], w: 1440, h: 1180 },
  { file: 'oa-da-oscuro.png', query: '?m=adas', actions: [click('Shock negativo de oferta')], w: 1440, h: 1180 },
  { file: 'is-mp-oscuro.png', query: '?m=ismp', actions: [click('Shock inflacionario de oferta')], w: 1440, h: 1180 },
  { file: 'laboratorio-oscuro.png', query: '?m=basic', actions: [...FILL_LAB, scrollTo('.lab-toolbar')], w: 1440, h: 1180 },
  { file: 'laboratorio-informe-claro.png', query: '?m=basic&theme=light', actions: [...FILL_LAB, click('Informe'), scrollTo('.lab-report')], w: 1440, h: 1180 },
  { file: 'escenarios-claro.png', query: '?m=basic&theme=light&tab=scenarios', hash: share({ G: 300 }), w: 1440, h: 760 },
  { file: 'movil-oscuro.png', query: '?m=basic', hash: share({ M: 800 }), w: 390, h: 1100, mobile: true, scale: 2 },
  { file: 'inicio-movil-oscuro.png', query: '', w: 390, h: 1500, mobile: true, scale: 2 },
  { file: 'notebook-1024-oscuro.png', query: '?m=advanced', actions: [click('Expansión fiscal con t > 0')], w: 1024, h: 900 },
  { file: 'tablet-768-oscuro.png', query: '?m=adas', actions: [click('Shock negativo de oferta')], w: 768, h: 1024 },
  // Usage guide, exercises and observatory (official data)
  { file: 'guia-oscuro.png', query: '', guide: true, actions: [click('Siguiente')], w: 1440, h: 900 },
  { file: 'ejercicios-oscuro.png', query: '?m=exercises', actions: SOLVE_FISCAL, w: 1440, h: 1250 },
  { file: 'ejercicio-datos-oscuro.png', query: '?m=exercises', actions: [click('Argentina, agosto de 2018'), click('Ver solución'), scrollTo('.ex-detail')], w: 1440, h: 1400 },
  { file: 'observatorio-oscuro.png', query: '?m=observatory', w: 1440, h: 1500 },
  { file: 'observatorio-episodio-oscuro.png', query: '?m=observatory', actions: [episode('2018-08-tasa-60'), scrollTo('.obs-controls')], w: 1440, h: 1500 },
  { file: 'observatorio-comparacion-claro.png', query: '?m=observatory&theme=light', actions: [openDetails('.us-compare'), scrollTo('.us-compare')], w: 1440, h: 1200 },
  { file: 'observatorio-comparar-oscuro.png', query: '?m=observatory', actions: [pick('Indicador', 'market'), openDetails('.compare-panel'), pick('Segunda variable', 't10y'), scrollTo('.obs-controls')], w: 1440, h: 1150 },
  { file: 'transmision-macro-oscuro.png', query: '?m=transmission', actions: [scrollTo('.tq-grid')], w: 1440, h: 1180 },
  { file: 'transmision-fiscal-paso-oscuro.png', query: '?m=transmission', actions: [pick('Seleccionar política o perturbación', 'fiscalExpansion'), click('Explicar transmisión económica'), ...Array(4).fill("await __click('Siguiente', document.querySelector('.tq-steps'));"), 'await __wait(1200);', scrollTo('.tq-grid')], w: 1440, h: 1180 },
  { file: 'transmision-tasa-claro.png', query: '?m=transmission&theme=light', actions: [pick('Seleccionar política o perturbación', 'rateCut'), scrollTo('.tq-grid')], w: 1440, h: 1180 },
  { file: 'transmision-movil-oscuro.png', query: '?m=transmission', actions: ["await __click('IS-LM', document.querySelector('.tq-tabs'));", scrollTo('.tq-tabs')], w: 390, h: 1100, mobile: true, scale: 2 },
  { file: 'historia-oscuro.png', query: '?m=observatory', actions: [click('Historia económica')], w: 1440, h: 1400 },
  { file: 'balanza-comercial-oscuro.png', query: '?m=observatory', actions: [click('Balanza comercial')], w: 1440, h: 1500 },
  { file: 'noticias-oscuro.png', query: '?m=observatory', actions: [click('Noticias y acontecimientos')], w: 1440, h: 1100 },
  { file: 'fuentes-claro.png', query: '?m=observatory&theme=light', actions: [click('Fuentes y metodología')], w: 1440, h: 1300 },
  { file: 'observatorio-movil-oscuro.png', query: '?m=observatory', w: 390, h: 1500, mobile: true, scale: 2 },
  // Secondary (English) documentation
  { file: 'en-simulator-fiscal-dark.png', query: '?m=basic&lang=en', hash: share({ G: 300 }), w: 1440, h: 1180 },
  { file: 'en-transmission-light.png', query: '?m=basic&lang=en&theme=light&tab=transmission', hash: share({ M: 800 }), w: 1440, h: 1000 },
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

async function run(page, js) {
  const r = await page.send('Runtime.evaluate', { expression: `(async () => { ${HELPERS} ${js} })()`, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
}

async function load(page, s) {
  await page.send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.scale ?? 1, mobile: Boolean(s.mobile) });
  // Clean state for every capture: no stored language, theme, module or scenarios.
  await page.send('Page.navigate', { url: BASE });
  await sleep(800);
  // The usage guide opens on a first visit; only its own capture shows it.
  await run(page, s.guide ? 'localStorage.clear();' : "localStorage.clear(); localStorage.setItem('islm.guide.seen', '1');");
  await page.send('Page.navigate', { url: 'about:blank' });
  await page.send('Page.navigate', { url: `${BASE}${s.query}${s.hash ?? ''}` });
  await sleep(2200);
  if (s.actions?.length) {
    await run(page, s.actions.join('\n'));
    await sleep(900);
  }
}

try {
  await waitForBrowser();
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
  const page = cdp(target.webSocketDebuggerUrl);
  await page.ready;
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  if (PDF) {
    // Printable lab report, exactly as the browser's "Imprimir / PDF" produces it.
    await load(page, { query: '?m=basic', actions: [...FILL_LAB, click('Informe')], w: 1280, h: 1000 });
    const { data } = await page.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
    writeFileSync(resolve(PDF), Buffer.from(data, 'base64'));
    console.log(`✓ ${PDF}`);
  } else {
    for (const s of SHOTS) {
      await load(page, s);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(resolve(OUT, s.file), Buffer.from(data, 'base64'));
      console.log(`✓ ${s.file}`);
    }
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
