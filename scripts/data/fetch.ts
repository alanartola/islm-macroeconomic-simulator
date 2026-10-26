/**
 * Downloads, validates and stores the official series of the observatory.
 *
 *   node scripts/data/fetch.ts [--out public/data] [--fallback-url URL] [--only id,id] [--no-news]
 *
 * Flow for every series: query the source → parse → validate dates, units and
 * bounds → drop duplicates/missing values (counted) → count revisions against
 * the previous validated version → write JSON with metadata and status.
 * If a source fails or its payload does not validate, the previous validated
 * version is kept (from --out or, failing that, from --fallback-url, normally
 * the published site) and marked as "fallback" with the error. Observations
 * are never invented. Runs on Node ≥ 22.18 (TypeScript type stripping).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CATALOG, DERIVED, NEWS_QUERIES, type CatalogEntry } from './catalog.ts';
import { assembleSeries, parseBcra, parseDatos, parseFredCsv, parseTreasuryCsv, parseWorldBank } from '../../src/data/parsers.ts';
import {
  tradeRows,
  isStale,
  type Obs,
  type SeriesFile,
  type SeriesMeta,
} from '../../src/data/core.ts';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const k = args.indexOf(name);
  return k >= 0 ? args[k + 1] : undefined;
};
const OUT = opt('--out') ?? 'public/data';
const FALLBACK_URL = opt('--fallback-url');
const ONLY = opt('--only')?.split(',');
const NEWS = !args.includes('--no-news');
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'islm-macroeconomic-simulator data refresh (+https://github.com/alanartola/islm-macroeconomic-simulator)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, kind: 'json' | 'text', attempts = 3): Promise<unknown> {
  let last: unknown;
  for (let k = 1; k <= attempts; k += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: kind === 'json' ? 'application/json' : 'text/csv,text/plain,*/*' }, signal: AbortSignal.timeout(90_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return kind === 'json' ? await res.json() : await res.text();
    } catch (e) {
      last = e;
      if (k < attempts) await sleep(2000 * k);
    }
  }
  throw new Error(`${(last as Error)?.message ?? last} (${url.split('?')[0]})`);
}

// ── Adapters: download and hand the payload to the pure parsers ─────────────

async function fromBcra(e: CatalogEntry): Promise<unknown[]> {
  const out: unknown[] = [];
  const limit = 3000;
  for (let offset = 0; ; offset += limit) {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${e.source.seriesId}?desde=${e.start}&hasta=${TODAY}&limit=${limit}&offset=${offset}`;
    const { rows, count } = parseBcra(await get(url, 'json'), e.frequency);
    out.push(...rows);
    if (rows.length === 0 || offset + limit >= count) break;
  }
  return out;
}

async function fromDatos(e: CatalogEntry): Promise<unknown[]> {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${e.source.seriesId}&start_date=${e.start}&limit=5000&format=json`;
  return parseDatos(await get(url, 'json'));
}

/** One download per year shared by every maturity (the CSV holds the whole curve). */
const treasuryYears = new Map<number, Promise<string>>();

async function fromTreasury(e: CatalogEntry): Promise<unknown[]> {
  const out: unknown[] = [];
  const first = Number(e.start.slice(0, 4));
  const last = Number(TODAY.slice(0, 4));
  for (let y = first; y <= last; y += 1) {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
    if (!treasuryYears.has(y)) treasuryYears.set(y, get(url, 'text') as Promise<string>);
    out.push(...parseTreasuryCsv(await treasuryYears.get(y)!, e.field ?? ''));
  }
  return out;
}

async function fromFred(e: CatalogEntry): Promise<unknown[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${e.source.seriesId}&cosd=${e.start}`;
  return parseFredCsv((await get(url, 'text')) as string, e.source.seriesId);
}

async function fromWorldBank(e: CatalogEntry): Promise<unknown[]> {
  const url = `https://api.worldbank.org/v2/country/${e.field}/indicator/${e.source.seriesId}?format=json&per_page=200&date=${e.start.slice(0, 4)}:${TODAY.slice(0, 4)}`;
  return parseWorldBank(await get(url, 'json'));
}

const ADAPTERS = { bcra: fromBcra, datos: fromDatos, treasury: fromTreasury, fred: fromFred, worldbank: fromWorldBank };

// ── Previous validated versions ─────────────────────────────────────────────

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** The published version (latest validated) when --fallback-url is given, otherwise the local copy. */
async function previousOf<T>(rel: string): Promise<T | null> {
  if (FALLBACK_URL) {
    try {
      return (await get(`${FALLBACK_URL.replace(/\/$/, '')}/${rel}`, 'json', 2)) as T;
    } catch {
      /* not published yet: use the local copy */
    }
  }
  return readJson<T>(join(OUT, rel));
}

function metaOf(e: CatalogEntry): SeriesMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { adapter, field, ...meta } = e;
  return meta;
}

async function refreshSeries(e: CatalogEntry): Promise<SeriesFile | null> {
  const previous = await previousOf<SeriesFile>(`series/${e.id}.json`);
  const raw = await ADAPTERS[e.adapter](e).catch((err: Error) => err);
  const { file, error } = assembleSeries({ meta: metaOf(e), raw, previous, today: TODAY, now: new Date().toISOString() });
  if (error && file) console.warn(`! ${e.id}: ${error} — keeping the previous validated version`);
  else if (error) console.error(`✗ ${e.id}: ${error} (no previous version)`);
  return file;
}

// ── News (GDELT) ────────────────────────────────────────────────────────────

export interface NewsItem {
  title: string;
  url: string;
  domain: string;
  date: string;
  topic: string;
  country: string;
  language: string;
  source: 'GDELT';
}

/** GDELT is best-effort: on HTTP 429 or an empty throttled answer, wait longer and retry once. */
async function getNews(url: string): Promise<unknown> {
  for (let k = 0; k < 3; k += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60_000) });
      const text = await res.text();
      if (res.status === 429 || text.startsWith('Please limit')) throw new Error('RATE_LIMITED');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return text.trim() === '' ? {} : JSON.parse(text);
    } catch (e) {
      if (k === 2) throw e;
      await sleep(30_000 * (k + 1));
    }
  }
  return {};
}

async function refreshNews(): Promise<{ fetchedAt: string; items: NewsItem[]; errors: string[] }> {
  const previous = (await previousOf<{ items: NewsItem[] }>('news-auto.json'))?.items ?? [];
  const items = new Map<string, NewsItem>(previous.map((n) => [n.url, n]));
  const seenTitles = new Set(previous.map((n) => `${n.domain}|${n.title.toLowerCase()}`));
  const errors: string[] = [];
  for (const q of NEWS_QUERIES) {
    try {
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q.query)}&mode=artlist&maxrecords=40&format=json&timespan=1month&sort=datedesc`;
      const j = (await getNews(url)) as { articles?: { url: string; title: string; seendate: string; domain: string; language: string; sourcecountry: string }[] };
      for (const a of j.articles ?? []) {
        const m = /^(\d{4})(\d{2})(\d{2})T/.exec(a.seendate ?? '');
        const key = `${a.domain}|${(a.title ?? '').toLowerCase()}`;
        if (!m || !a.url?.startsWith('https://') || !a.title?.trim() || seenTitles.has(key) || items.has(a.url)) continue;
        seenTitles.add(key);
        items.set(a.url, { title: a.title.trim(), url: a.url, domain: a.domain, date: `${m[1]}-${m[2]}-${m[3]}`, topic: q.topic, country: a.sourcecountry === 'Argentina' ? 'AR' : 'INT', language: a.language, source: 'GDELT' });
      }
    } catch (err) {
      errors.push(`${q.topic}: ${(err as Error).message}`);
    }
    await sleep(15_000); // GDELT asks for at most one request every five seconds; leave a wide margin
  }
  const oneYearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const kept = [...items.values()].filter((n) => n.date >= oneYearAgo).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 600);
  return { fetchedAt: new Date().toISOString(), items: kept, errors };
}

// ── Main ────────────────────────────────────────────────────────────────────

const entries = CATALOG.filter((e) => !ONLY || ONLY.includes(e.id));
await mkdir(join(OUT, 'series'), { recursive: true });
const manifest: { generatedAt: string; series: Record<string, unknown>[]; checks: string[] } = { generatedAt: new Date().toISOString(), series: [], checks: [] };
const files = new Map<string, SeriesFile>();
for (const e of entries) {
  const file = await refreshSeries(e);
  if (file) {
    files.set(e.id, file);
    await writeFile(join(OUT, 'series', `${e.id}.json`), JSON.stringify(file));
    console.log(`${file.status.state === 'fallback' ? '!' : '✓'} ${e.id}: ${file.status.count} obs, ${file.status.firstObservation} → ${file.status.lastObservation} [${file.status.state}]`);
  }
  manifest.series.push({ id: e.id, topic: e.topic, country: e.country, name: e.name, frequency: e.frequency, ...(file?.status ?? { state: 'missing', count: 0 }) });
}

// Derived series: computed month by month only where every input exists.
if (!ONLY) {
  for (const d of DERIVED) {
    const inputs = d.inputs.map((id) => files.get(id));
    if (inputs.some((f) => !f)) {
      manifest.series.push({ id: d.id, topic: d.meta.topic, country: 'AR', name: d.meta.name, frequency: 'M', state: 'missing', count: 0 });
      continue;
    }
    const maps = inputs.map((f) => new Map(f!.data));
    const data: Obs[] = [];
    for (const [date] of inputs[0]!.data) {
      const vals = maps.map((m) => m.get(date));
      if (vals.every((v) => v !== undefined)) data.push([date, d.formula(vals as number[])]);
    }
    const last = data[data.length - 1]?.[0] ?? null;
    const file: SeriesFile = {
      meta: d.meta,
      status: {
        fetchedAt: new Date().toISOString(),
        firstObservation: data[0]?.[0] ?? null,
        lastObservation: last,
        count: data.length,
        state: inputs.some((f) => f!.status.state === 'fallback') ? 'fallback' : isStale(last, 'M', TODAY) ? 'stale' : 'fresh',
      },
      data,
    };
    files.set(d.id, file);
    await writeFile(join(OUT, 'series', `${d.id}.json`), JSON.stringify(file));
    manifest.series.push({ id: d.id, topic: d.meta.topic, country: 'AR', name: d.meta.name, frequency: 'M', derived: true, ...file.status });
    console.log(`✓ ${d.id} (derived): ${data.length} obs`);
  }
}

// Identity check of the official trade tables (rounding differences are expected and reported).
const x = files.get('ar_x')?.data;
const m = files.get('ar_m')?.data;
if (x && m) {
  const rows = tradeRows(x as Obs[], m as Obs[], (files.get('ar_saldo')?.data ?? []) as Obs[]);
  const worst = rows.reduce((a, r) => Math.max(a, Math.abs(r.gap ?? 0)), 0);
  manifest.checks.push(`trade: ${rows.length} months; max |published balance − (X − M)| = ${worst.toFixed(3)} US$ millions`);
}

if (NEWS && !ONLY) {
  const news = await refreshNews();
  await writeFile(join(OUT, 'news-auto.json'), JSON.stringify(news));
  console.log(`✓ news: ${news.items.length} items${news.errors.length ? ` (errors: ${news.errors.join('; ')})` : ''}`);
}
if (!ONLY) await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
const failed = manifest.series.filter((s) => s.state === 'missing').length;
console.log(`done: ${entries.length} series, ${failed} missing`);
if (failed === entries.length) process.exit(1);
