// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  addMonths,
  annualSums,
  beforeAfter,
  countRevisions,
  diffFrom,
  index100,
  isIsoDate,
  isStale,
  pctChange,
  pctChangeAsOf,
  periodEnd,
  tnaToTea,
  toMonthly,
  tradeRows,
  transformSeries,
  validateObservations,
  validateSeriesFile,
  yearToDate,
  type Obs,
  type SeriesFile,
  type SeriesMeta,
} from '../../src/data/core.ts';
import { assembleSeries, parseBcra, parseDatos, parseFredCsv, parseTreasuryCsv, parseWorldBank } from '../../src/data/parsers.ts';

const META: SeriesMeta = {
  id: 'test_rate',
  country: 'AR',
  topic: 'monetary',
  name: { es: 'Tasa de prueba', en: 'Test rate' },
  definition: { es: 'd', en: 'd' },
  unit: { es: '% TNA', en: '% APR' },
  unitKind: 'rate_tna',
  frequency: 'D',
  source: { org: 'BCRA', channel: 'API', seriesId: '7', docUrl: 'https://www.bcra.gob.ar/' },
  start: '2024-01-01',
  methodology: { es: 'm', en: 'm' },
  original: true,
};

const days = (n: number, from = '2026-01-05', v = (k: number) => 30 + k): [string, number][] =>
  Array.from({ length: n }, (_, k) => [new Date(Date.parse(`${from}T00:00:00Z`) + k * 86_400_000).toISOString().slice(0, 10), v(k)]);

describe('source parsers', () => {
  it('BCRA v4.0: reads detalle and normalises monthly dates to the first day', () => {
    const payload = { metadata: { resultset: { count: 2 } }, results: [{ idVariable: 27, detalle: [{ fecha: '2026-08-31', valor: 2.1 }, { fecha: '2026-07-31', valor: 1.9 }] }] };
    expect(parseBcra(payload, 'M')).toEqual({ rows: [['2026-08-01', 2.1], ['2026-07-01', 1.9]], count: 2 });
    expect(parseBcra(payload, 'D').rows[0]).toEqual(['2026-08-31', 2.1]);
    expect(() => parseBcra({ status: 410 }, 'D')).toThrow('UNEXPECTED_PAYLOAD');
  });

  it('datos.gob.ar: requires a data array', () => {
    expect(parseDatos({ data: [['2026-01-01', 1], ['2026-02-01', null]] })).toEqual([['2026-01-01', 1], ['2026-02-01', null]]);
    expect(() => parseDatos({ errors: ['bad id'] })).toThrow('UNEXPECTED_PAYLOAD');
  });

  it('Treasury CSV: picks the maturity column, converts dates and marks N/A as missing', () => {
    const csv = 'Date,"1 Mo","3 Mo","2 Yr","10 Yr"\n10/23/2026,4.1,4.0,3.6,4.2\n10/22/2026,4.1,N/A,3.5,4.1\n';
    expect(parseTreasuryCsv(csv, '10 Yr')).toEqual([['2026-10-23', 4.2], ['2026-10-22', 4.1]]);
    expect(parseTreasuryCsv(csv, '3 Mo')[1]).toEqual(['2026-10-22', null]);
    expect(() => parseTreasuryCsv(csv, '30 Yr')).toThrow('COLUMN_NOT_FOUND');
  });

  it('FRED CSV: checks the header and treats "." as missing', () => {
    const csv = 'observation_date,DFEDTARU\n2026-10-01,4.25\n2026-10-02,.\n';
    expect(parseFredCsv(csv, 'DFEDTARU')).toEqual([['2026-10-01', 4.25], ['2026-10-02', null]]);
    expect(() => parseFredCsv('<html>error</html>', 'DFEDTARU')).toThrow('UNEXPECTED_HEADER');
  });

  it('World Bank: dates annual values on 1 January', () => {
    expect(parseWorldBank([{ page: 1 }, [{ date: '2024', value: -1.3 }, { date: '2025', value: null }]])).toEqual([['2024-01-01', -1.3], ['2025-01-01', null]]);
    expect(() => parseWorldBank([{ message: [{ id: '120' }] }])).toThrow('UNEXPECTED_PAYLOAD');
  });
});

describe('validation of observations', () => {
  it('sorts, removes duplicates and drops missing values, counting both', () => {
    const v = validateObservations([['2026-01-03', 2], ['2026-01-01', 1], ['2026-01-03', 3], ['2026-01-02', null]], 'rate_tna');
    expect(v).toEqual({ ok: true, data: [['2026-01-01', 1], ['2026-01-03', 3]], duplicatesRemoved: 1, missingDropped: 1 });
  });

  it('rejects malformed dates, non-numbers and values outside the unit bounds', () => {
    expect(validateObservations([['2026-02-30', 1]], 'rate_tna').ok).toBe(false);
    expect(validateObservations([['01/02/2026', 1]], 'rate_tna').ok).toBe(false);
    expect(validateObservations([['2026-01-01', 'abc']], 'rate_tna').ok).toBe(false);
    // A rate of 5,000% signals a unit error (basis points or a wrong column), not economics.
    expect(validateObservations([['2026-01-01', 5000]], 'rate_tna').ok).toBe(false);
    expect(validateObservations([['2026-01-01', 101]], 'pct_labour').ok).toBe(false);
    expect(validateObservations([['2026-01-01', -1]], 'ars_per_usd').ok).toBe(false);
    expect(validateObservations('<html>', 'rate_tna')).toEqual({ ok: false, errors: ['NOT_AN_ARRAY'] });
    expect(validateObservations([['2026-01-01', 1]], 'rate_tna', 6)).toEqual({ ok: false, errors: ['TOO_FEW_OBSERVATIONS:1'] });
  });

  it('counts revisions of previously published observations', () => {
    expect(countRevisions([['2026-01-01', 1], ['2026-02-01', 2]], [['2026-01-01', 1], ['2026-02-01', 2.5], ['2026-03-01', 3]])).toBe(1);
  });

  it('checks ISO dates strictly', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2025-2-1')).toBe(false);
  });
});

describe('assembly with fallback to the last validated version', () => {
  const now = '2026-10-25T12:00:00.000Z';
  const today = '2026-10-25';
  const good = days(20, '2026-10-05');

  it('stores a validated download with its status', () => {
    const { file, error } = assembleSeries({ meta: META, raw: good, previous: null, today, now });
    expect(error).toBeNull();
    expect(file!.status).toMatchObject({ state: 'fresh', count: 20, firstObservation: '2026-10-05', lastObservation: '2026-10-24', revisions: 0, fetchedAt: now });
    expect(validateSeriesFile(file)).toEqual([]);
  });

  it('keeps the previous version and marks it as fallback when the download fails', () => {
    const previous = assembleSeries({ meta: META, raw: good, previous: null, today, now: '2026-10-24T12:00:00.000Z' }).file!;
    const { file, error } = assembleSeries({ meta: META, raw: new Error('HTTP 503'), previous, today, now });
    expect(error).toBe('HTTP 503');
    expect(file!.data).toEqual(previous.data);
    expect(file!.status).toMatchObject({ state: 'fallback', error: 'HTTP 503', fetchedAt: '2026-10-24T12:00:00.000Z' });
    expect(validateSeriesFile(file)).toEqual([]);
  });

  it('keeps the previous version when the payload does not validate', () => {
    const previous = assembleSeries({ meta: META, raw: good, previous: null, today, now }).file!;
    const { file, error } = assembleSeries({ meta: META, raw: [['2026-10-24', 9999]], previous, today, now });
    expect(error).toMatch(/^VALIDATION: OUT_OF_BOUNDS/);
    expect(file!.status.state).toBe('fallback');
  });

  it('stores nothing (never invents data) without a previous version', () => {
    expect(assembleSeries({ meta: META, raw: new Error('timeout'), previous: null, today, now })).toEqual({ file: null, error: 'timeout' });
  });

  it('flags revisions and stale series', () => {
    const previous = assembleSeries({ meta: META, raw: good, previous: null, today, now }).file!;
    const revised = good.map(([d, v], k) => [d, k === 3 ? v + 1 : v]);
    expect(assembleSeries({ meta: META, raw: revised, previous, today, now }).file!.status.revisions).toBe(1);
    const old = days(20, '2026-08-01');
    expect(assembleSeries({ meta: META, raw: old, previous: null, today, now }).file!.status.state).toBe('stale');
  });

  it('detects inconsistent status in a stored file', () => {
    const file = assembleSeries({ meta: META, raw: good, previous: null, today, now }).file! as SeriesFile;
    expect(validateSeriesFile({ ...file, status: { ...file.status, count: 3 } })).toContain('STATUS_MISMATCH');
    expect(validateSeriesFile({ ...file, meta: { ...file.meta, source: { ...file.meta.source, docUrl: 'http://x' } } })).toContain('META_SOURCE');
    expect(validateSeriesFile({ ...file, meta: { ...file.meta, original: false } })).toContain('META_DERIVATION');
  });
});

describe('staleness by frequency', () => {
  it('measures the lag from the end of the reference period', () => {
    expect(periodEnd('2026-08-01', 'M')).toBe('2026-08-31');
    expect(periodEnd('2026-04-01', 'Q')).toBe('2026-06-30');
    expect(periodEnd('2025-01-01', 'A')).toBe('2025-12-31');
    // A monthly series for August published in late October is on time.
    expect(isStale('2026-08-01', 'M', '2026-10-25')).toBe(false);
    expect(isStale('2026-05-01', 'M', '2026-10-25')).toBe(true);
    expect(isStale('2026-10-22', 'D', '2026-10-25')).toBe(false);
    expect(isStale('2026-10-01', 'D', '2026-10-25')).toBe(true);
    expect(isStale(null, 'D', '2026-10-25')).toBe(true);
  });
});

describe('transformations', () => {
  const monthly: Obs[] = Array.from({ length: 25 }, (_, k) => [addMonths('2024-01-01', k), 100 * 1.02 ** k]);

  it('percentage change uses the exact earlier date', () => {
    const yoy = pctChange(monthly, 12);
    expect(yoy).toHaveLength(13);
    expect(yoy[0]![0]).toBe('2025-01-01');
    expect(yoy[0]![1]).toBeCloseTo((1.02 ** 12 - 1) * 100, 10);
    const gap = monthly.filter(([d]) => d !== '2024-03-01');
    expect(pctChange(gap, 12).some(([d]) => d === '2025-03-01')).toBe(false);
  });

  it('daily year-on-year change tolerates weekends but not long gaps', () => {
    const d: Obs[] = [['2025-10-24', 100], ['2026-10-26', 150]];
    // 2025-10-26 was a Sunday: the Friday value two days earlier is used.
    expect(pctChangeAsOf(d, 12)).toEqual([['2026-10-26', 50]]);
    expect(pctChangeAsOf([['2025-09-01', 100], ['2026-10-26', 150]], 12)).toEqual([]);
  });

  it('differences, base-100 index and monthly aggregation', () => {
    const rates: Obs[] = [['2026-01-01', 30], ['2026-02-01', 32.5], ['2026-03-01', 29]];
    expect(diffFrom(rates, '2026-01-15')).toEqual([['2026-01-01', 0], ['2026-02-01', 2.5], ['2026-03-01', -1]]);
    expect(index100([['2026-01-01', 50], ['2026-02-01', 75]], '2026-01-01')).toEqual([['2026-01-01', 100], ['2026-02-01', 150]]);
    expect(toMonthly([['2026-01-02', 10], ['2026-01-30', 20], ['2026-02-02', 30]], 'avg')).toEqual([['2026-01-01', 15], ['2026-02-01', 30]]);
    expect(toMonthly([['2026-01-02', 10], ['2026-01-30', 20]], 'last')).toEqual([['2026-01-01', 20]]);
  });

  it('converts a nominal annual rate to an effective annual rate', () => {
    // 36.5% APR capitalised every 30 days: (1 + 0.365·30/365)^(365/30) − 1.
    expect(tnaToTea(36.5)).toBeCloseTo(((1 + 0.03) ** (365 / 30) - 1) * 100, 10);
    expect(tnaToTea(0)).toBe(0);
    expect(tnaToTea(40)).toBeGreaterThan(40);
  });

  it('rates only admit levels and differences in percentage points', () => {
    const rates: Obs[] = [['2026-01-01', 30], ['2026-02-01', 32]];
    expect(transformSeries(rates, 'rate_tna', 'M', 'yoy', '2026-01-01').applied).toBe('level');
    expect(transformSeries(rates, 'rate_tna', 'M', 'index', '2026-01-01').applied).toBe('level');
    expect(transformSeries(rates, 'rate_tna', 'M', 'diff', '2026-01-01')).toEqual({ data: [['2026-01-01', 0], ['2026-02-01', 2]], applied: 'diff' });
    expect(transformSeries(monthly, 'index', 'M', 'yoy', '2024-01-01').applied).toBe('yoy');
  });

  it('balances that change sign are not turned into percentage changes', () => {
    const balance: Obs[] = [['2025-01-01', -100], ['2026-01-01', 200]];
    expect(transformSeries(balance, 'musd', 'M', 'yoy', '2025-01-01').applied).toBe('level');
    expect(transformSeries(balance, 'musd', 'M', 'index', '2025-01-01').applied).toBe('level');
  });

  it('before/after an event describes published values only', () => {
    const fx: Obs[] = [['2023-08-11', 287], ['2023-08-14', 350], ['2023-09-13', 350]];
    const ba = beforeAfter(fx, '2023-08-14', 30);
    expect(ba.before).toEqual(['2023-08-11', 287]);
    expect(ba.after).toEqual(['2023-09-13', 350]);
    expect(ba.pct).toBeCloseTo((350 / 287 - 1) * 100, 10);
    expect(beforeAfter(fx, '2023-09-20', 30).after).toBeNull();
    expect(ba.complete).toBe(true);
    // The window has not elapsed: the latest value is shown but flagged as incomplete.
    const partial = beforeAfter(fx, '2023-08-14', 60);
    expect(partial.after).toEqual(['2023-09-13', 350]);
    expect(partial.complete).toBe(false);
  });
});

describe('trade arithmetic', () => {
  const x: Obs[] = [['2025-11-01', 6000], ['2025-12-01', 6500], ['2026-01-01', 6200], ['2026-02-01', 5900]];
  const m: Obs[] = [['2025-11-01', 5000], ['2025-12-01', 5100], ['2026-01-01', 5600], ['2026-02-01', 6100]];

  it('balance, turnover and the gap with the published balance', () => {
    const rows = tradeRows(x, m, [['2026-01-01', 601]]);
    expect(rows[2]).toEqual({ date: '2026-01-01', x: 6200, m: 5600, balance: 600, turnover: 11800, published: 601, gap: 1 });
    expect(rows[3]!.balance).toBe(-200);
    expect(rows[3]!.published).toBeNull();
  });

  it('accumulates year to date and sums complete years only', () => {
    expect(yearToDate(x).map(([, v]) => v)).toEqual([6000, 12500, 6200, 12100]);
    expect(annualSums(x)).toEqual([]);
    expect(annualSums(x, true)).toEqual([{ year: 2025, value: 12500, months: 2 }, { year: 2026, value: 12100, months: 2 }]);
  });
});
