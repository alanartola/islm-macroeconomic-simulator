/**
 * Core of the observatory data layer: types, validation and transformations
 * of official time series. This module has NO imports so it can be shared by
 * the web app (Vite), the data-fetching script (run directly by Node) and the
 * tests. Nothing here fabricates observations: every function either returns
 * values derived from published observations or reports that it cannot.
 */

export type Lang2 = { es: string; en: string };
export type Frequency = 'D' | 'M' | 'Q' | 'A';
export type Country = 'AR' | 'US';
/** One observation: ISO date (YYYY-MM-DD; monthly data use the first day of the month) and value. */
export type Obs = [string, number];

/** Physical meaning of the values; drives validation bounds and how transformations are labelled. */
export type UnitKind =
  | 'rate_tna' // nominal annual rate, percent
  | 'rate_pct' // a yield or rate already in percent per year
  | 'pct' // a percentage change or share
  | 'ars_per_usd'
  | 'index'
  | 'musd' // millions of US dollars
  | 'usd' // US dollars
  | 'mars' // millions of Argentine pesos
  | 'pct_labour'; // a labour-market ratio in percent

export type Topic = 'monetary' | 'fx' | 'prices' | 'activity' | 'external' | 'fiscal' | 'labour' | 'international';

export interface SeriesSource {
  /** Producing organisation (e.g. BCRA, INDEC, U.S. Treasury). */
  org: string;
  /** Publishing channel used to download it (may be a re-publisher such as FRED or datos.gob.ar). */
  channel: string;
  /** Identifier of the series in that channel. */
  seriesId: string;
  /** Human-readable documentation page. */
  docUrl: string;
}

export interface SeriesMeta {
  id: string;
  country: Country;
  topic: Topic;
  name: Lang2;
  definition: Lang2;
  unit: Lang2;
  unitKind: UnitKind;
  frequency: Frequency;
  source: SeriesSource;
  /** true = published value; false = derived here from published values (see derivation). */
  original: boolean;
  derivation?: Lang2;
  methodology: Lang2;
  /** First date requested from the source. */
  start: string;
}

export type SeriesState = 'fresh' | 'stale' | 'fallback';

export interface SeriesStatus {
  /** When the observations in this file were downloaded and validated (ISO timestamp). */
  fetchedAt: string;
  firstObservation: string | null;
  lastObservation: string | null;
  count: number;
  state: SeriesState;
  /** Download or validation error of the latest attempt (kept data are from fetchedAt). */
  error?: string;
  /** Observations whose value changed with respect to the previous validated version. */
  revisions?: number;
  duplicatesRemoved?: number;
  missingDropped?: number;
}

export interface SeriesFile {
  meta: SeriesMeta;
  status: SeriesStatus;
  data: Obs[];
}

// ── Dates ───────────────────────────────────────────────────────────────────

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = ISO.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  return new Date(toTime(date) + days * 86_400_000).toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toTime(b) - toTime(a)) / 86_400_000);
}

// ── Validation ──────────────────────────────────────────────────────────────

/** Plausible ranges by unit: values outside them indicate a parsing or unit error, not economics. */
export const BOUNDS: Record<UnitKind, [number, number]> = {
  rate_tna: [-5, 1000],
  rate_pct: [-5, 100],
  pct: [-100, 10_000],
  ars_per_usd: [0.1, 1_000_000],
  index: [0, 100_000_000],
  musd: [-1_000_000, 1_000_000],
  usd: [-1e13, 1e13],
  mars: [-1e13, 1e13],
  pct_labour: [0, 100],
};

export interface ValidationOk {
  ok: true;
  data: Obs[];
  duplicatesRemoved: number;
  missingDropped: number;
}
export interface ValidationError {
  ok: false;
  errors: string[];
}

/**
 * Validates raw observations: ISO dates, finite numbers within the bounds of
 * the unit, ascending order. Missing values (null) are dropped and counted;
 * duplicated dates keep the last value received and are counted.
 */
export function validateObservations(raw: unknown, kind: UnitKind, minCount = 1): ValidationOk | ValidationError {
  if (!Array.isArray(raw)) return { ok: false, errors: ['NOT_AN_ARRAY'] };
  const errors: string[] = [];
  const byDate = new Map<string, number>();
  let duplicates = 0;
  let missing = 0;
  const [lo, hi] = BOUNDS[kind];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) {
      errors.push('BAD_ROW');
      continue;
    }
    const [date, value] = row as [unknown, unknown];
    if (!isIsoDate(date)) {
      errors.push(`BAD_DATE:${String(date)}`);
      continue;
    }
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      missing += 1;
      continue;
    }
    const v = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(v)) {
      errors.push(`NOT_FINITE:${date}`);
      continue;
    }
    if (v < lo || v > hi) {
      errors.push(`OUT_OF_BOUNDS:${date}:${v}`);
      continue;
    }
    if (byDate.has(date)) duplicates += 1;
    byDate.set(date, v);
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
  const data = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) as Obs[];
  if (data.length < minCount) return { ok: false, errors: [`TOO_FEW_OBSERVATIONS:${data.length}`] };
  return { ok: true, data, duplicatesRemoved: duplicates, missingDropped: missing };
}

/** Number of dates present in both versions whose value changed (statistical revisions). */
export function countRevisions(previous: Obs[], next: Obs[], tolerance = 1e-9): number {
  const prev = new Map(previous);
  let n = 0;
  for (const [d, v] of next) {
    const p = prev.get(d);
    if (p !== undefined && Math.abs(p - v) > tolerance * Math.max(1, Math.abs(p))) n += 1;
  }
  return n;
}

/**
 * Maximum days between the END of the last reference period and today before
 * a series is flagged as out of date. They allow for the usual publication
 * lag (e.g. EMAE ≈ 55 days after the month, EPH ≈ 85 days after the quarter).
 */
export const STALE_AFTER_DAYS: Record<Frequency, number> = { D: 10, M: 95, Q: 200, A: 560 };

/** Last day of the reference period that an observation date stands for. */
export function periodEnd(date: string, frequency: Frequency): string {
  if (frequency === 'D') return date;
  const months = frequency === 'M' ? 1 : frequency === 'Q' ? 3 : 12;
  const start = frequency === 'A' ? `${date.slice(0, 4)}-01-01` : `${date.slice(0, 7)}-01`;
  return addDays(addMonths(start, months), -1);
}

export function isStale(lastObservation: string | null, frequency: Frequency, today: string): boolean {
  if (!lastObservation) return true;
  return daysBetween(periodEnd(lastObservation, frequency), today) > STALE_AFTER_DAYS[frequency];
}

/** Structural check of a complete series file (used by the tests and before publishing). */
export function validateSeriesFile(file: unknown): string[] {
  const errs: string[] = [];
  const f = file as Partial<SeriesFile>;
  if (!f || typeof f !== 'object') return ['NOT_AN_OBJECT'];
  const m = f.meta;
  if (!m || typeof m.id !== 'string') errs.push('META_ID');
  if (m && !['D', 'M', 'Q', 'A'].includes(m.frequency)) errs.push('META_FREQUENCY');
  if (m && !(m.unitKind in BOUNDS)) errs.push('META_UNIT');
  if (m && (!m.source?.org || !m.source?.docUrl?.startsWith('https://'))) errs.push('META_SOURCE');
  if (m && (!m.name?.es || !m.name?.en || !m.definition?.es || !m.unit?.es)) errs.push('META_TEXT');
  if (m && m.original === false && !m.derivation?.es) errs.push('META_DERIVATION');
  const s = f.status;
  if (!s || !['fresh', 'stale', 'fallback'].includes(s.state)) errs.push('STATUS_STATE');
  if (s && Number.isNaN(Date.parse(s.fetchedAt))) errs.push('STATUS_FETCHED_AT');
  if (m) {
    const v = validateObservations(f.data, m.unitKind);
    if (!v.ok) errs.push(...v.errors.map((e) => `DATA:${e}`));
    else {
      if (v.duplicatesRemoved > 0 || v.missingDropped > 0) errs.push('DATA_NOT_NORMALISED');
      const d = f.data as Obs[];
      if (s && d.length && (s.firstObservation !== d[0]![0] || s.lastObservation !== d[d.length - 1]![0] || s.count !== d.length)) errs.push('STATUS_MISMATCH');
    }
  }
  return errs;
}

// ── Transformations (all labelled as derived in the interface) ──────────────

/** Value at the date or, if missing, at the last observation before it (null if none). */
export function valueAtOrBefore(data: Obs[], date: string): Obs | null {
  let lo = 0;
  let hi = data.length - 1;
  let best: Obs | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const o = data[mid]!;
    if (o[0] <= date) {
      best = o;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return best;
}

export function windowOf(data: Obs[], from: string, to: string): Obs[] {
  return data.filter(([d]) => d >= from && d <= to);
}

/**
 * Percentage change against the observation k periods earlier in calendar
 * terms (months for M/Q series): only computed when that exact earlier date
 * exists, so gaps never produce spurious changes.
 */
export function pctChange(data: Obs[], months: number): Obs[] {
  const map = new Map(data);
  const out: Obs[] = [];
  for (const [d, v] of data) {
    const prev = map.get(addMonths(d, -months));
    if (prev !== undefined && prev !== 0) out.push([d, (v / prev - 1) * 100]);
  }
  return out;
}

/** Difference in the unit of the series (percentage points for rates) with respect to a base date. */
export function diffFrom(data: Obs[], baseDate: string): Obs[] {
  const base = valueAtOrBefore(data, baseDate) ?? data[0];
  if (!base) return [];
  return data.map(([d, v]) => [d, v - base[1]] as Obs);
}

/** Index with value 100 at the first observation on or after the base date. */
export function index100(data: Obs[], baseDate: string): Obs[] {
  const base = data.find(([d]) => d >= baseDate) ?? data[0];
  if (!base || base[1] === 0) return [];
  return data.map(([d, v]) => [d, (v / base[1]) * 100] as Obs);
}

/** Calendar-month aggregation of a daily series (average or end of month), dated on the first day. */
export function toMonthly(daily: Obs[], how: 'avg' | 'last'): Obs[] {
  const groups = new Map<string, number[]>();
  for (const [d, v] of daily) {
    const k = `${d.slice(0, 7)}-01`;
    const g = groups.get(k);
    if (g) g.push(v);
    else groups.set(k, [v]);
  }
  return [...groups.entries()].map(([k, vs]) => [k, how === 'avg' ? vs.reduce((a, b) => a + b, 0) / vs.length : vs[vs.length - 1]!] as Obs);
}

/** Effective annual rate (%) of a nominal annual rate (%) capitalised every `days` days. */
export function tnaToTea(tna: number, days = 30): number {
  return (Math.pow(1 + (tna / 100) * (days / 365), 365 / days) - 1) * 100;
}

export interface BeforeAfter {
  before: Obs | null;
  after: Obs | null;
  /** after − before, in the unit of the series. */
  abs: number | null;
  /** Percentage change (only meaningful for levels such as prices or reserves). */
  pct: number | null;
  /** false when the window has not elapsed yet: `after` is the latest published value, earlier than event + days. */
  complete: boolean;
}

/**
 * Observed values just before an event and `days` after it. This is a
 * description of what was published; it does not attribute the change to the event.
 */
export function beforeAfter(data: Obs[], eventDate: string, days: number): BeforeAfter {
  const before = valueAtOrBefore(data, addDays(eventDate, -1));
  const after = valueAtOrBefore(data, addDays(eventDate, days));
  const valid = before && after && after[0] > before[0];
  const abs = valid ? after![1] - before![1] : null;
  const pct = valid && before![1] !== 0 ? (after![1] / before![1] - 1) * 100 : null;
  const target = addDays(eventDate, days);
  const latest = data[data.length - 1];
  const complete = !!valid && !(latest && after![0] === latest[0] && latest[0] < target);
  return { before, after: valid ? after : null, abs, pct, complete };
}

// ── Trade identities ────────────────────────────────────────────────────────

export interface TradeRow {
  date: string;
  x: number;
  m: number;
  /** BC = X − M computed here. */
  balance: number;
  /** IC = X + M. */
  turnover: number;
  /** Published balance (INDEC), if available. */
  published: number | null;
  /** Published − computed: rounding differences of the official tables. */
  gap: number | null;
}

/** Joins exports, imports and the published balance month by month and checks BC = X − M. */
export function tradeRows(x: Obs[], m: Obs[], published: Obs[] = []): TradeRow[] {
  const mm = new Map(m);
  const pb = new Map(published);
  const out: TradeRow[] = [];
  for (const [d, xv] of x) {
    const mv = mm.get(d);
    if (mv === undefined) continue;
    const p = pb.get(d);
    const balance = xv - mv;
    out.push({ date: d, x: xv, m: mv, balance, turnover: xv + mv, published: p ?? null, gap: p === undefined ? null : p - balance });
  }
  return out;
}

/** Sum of a monthly series by calendar year (only complete years unless `partial`). */
export function annualSums(monthly: Obs[], partial = false): { year: number; value: number; months: number }[] {
  const by = new Map<number, { value: number; months: number }>();
  for (const [d, v] of monthly) {
    const y = Number(d.slice(0, 4));
    const g = by.get(y) ?? { value: 0, months: 0 };
    g.value += v;
    g.months += 1;
    by.set(y, g);
  }
  return [...by.entries()]
    .filter(([, g]) => partial || g.months === 12)
    .map(([year, g]) => ({ year, ...g }))
    .sort((a, b) => a.year - b.year);
}

/** Year-to-date accumulation of a monthly flow (resets every January). */
export function yearToDate(monthly: Obs[]): Obs[] {
  let year = '';
  let acc = 0;
  return monthly.map(([d, v]) => {
    if (d.slice(0, 4) !== year) {
      year = d.slice(0, 4);
      acc = 0;
    }
    acc += v;
    return [d, acc] as Obs;
  });
}

/**
 * Percentage change against the value `months` earlier for daily series:
 * uses the last observation on or before that date, only if it is at most
 * `toleranceDays` older (weekends and holidays), otherwise no value.
 */
export function pctChangeAsOf(data: Obs[], months: number, toleranceDays = 7): Obs[] {
  const out: Obs[] = [];
  for (const [d, v] of data) {
    const target = addMonths(d, -months);
    const prev = valueAtOrBefore(data, target);
    if (prev && daysBetween(prev[0], target) <= toleranceDays && prev[1] !== 0) out.push([d, (v / prev[1] - 1) * 100]);
  }
  return out;
}

/** Transformations offered by the observatory. */
export type Transform = 'level' | 'yoy' | 'index' | 'diff';

/**
 * Applies a transformation for display. Rates and percentages only admit
 * levels and differences in percentage points; year-on-year changes and
 * indices are reserved for positive levels (prices, exchange rates, stocks,
 * flows). Balances that can be negative are shown in levels or differences.
 */
export function transformSeries(data: Obs[], kind: UnitKind, frequency: Frequency, t: Transform, base: string): { data: Obs[]; applied: Transform } {
  const isRate = kind === 'rate_tna' || kind === 'rate_pct' || kind === 'pct' || kind === 'pct_labour';
  // Balances that change sign (trade or fiscal balance) have no meaningful percentage change or index.
  const signed = data.some(([, v]) => v <= 0);
  const noRatio = isRate || signed;
  if (t === 'level' || (noRatio && (t === 'yoy' || t === 'index'))) return { data, applied: 'level' };
  if (t === 'diff') return { data: diffFrom(data, base), applied: 'diff' };
  if (t === 'index') return { data: index100(data, base), applied: 'index' };
  // Year-on-year: 12 months earlier for every frequency (annual series are dated on 1 January).
  return { data: frequency === 'D' ? pctChangeAsOf(data, 12) : pctChange(data, 12), applied: 'yoy' };
}
