// @vitest-environment node
/**
 * Checks the data actually published with the site (public/data): structure,
 * metadata, units, frequencies, identities and derived series. A refresh that
 * breaks any of these fails CI and is not deployed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isIsoDate, isStale, tradeRows, validateSeriesFile, type Obs, type SeriesFile } from '../../src/data/core.ts';
import { CATALOG, DERIVED } from './catalog.ts';
import { EPISODES, TRADE_EVENTS } from '../../src/observatory/episodes.ts';

const DIR = 'public/data';
const read = <T,>(rel: string): T => JSON.parse(readFileSync(join(DIR, rel), 'utf8')) as T;
const files = new Map<string, SeriesFile>(readdirSync(join(DIR, 'series')).map((f) => [f.replace(/\.json$/, ''), read<SeriesFile>(`series/${f}`)]));
const series = (id: string) => {
  const f = files.get(id);
  if (!f) throw new Error(`missing ${id}`);
  return f;
};
const at = (data: Obs[]) => new Map(data);
/** Daily series published for every calendar day (index and target range); the rest are business days. */
const CALENDAR_DAILY = new Set(['ar_itcrm', 'us_fed_upper', 'us_fed_lower']);

describe('published snapshot', () => {
  it('has one valid file for every catalogue entry and derived series, and nothing else', () => {
    const expected = [...CATALOG.map((e) => e.id), ...DERIVED.map((d) => d.id)].sort();
    expect(new Set(expected).size).toBe(expected.length);
    expect([...files.keys()].sort()).toEqual(expected);
    for (const [id, f] of files) expect(validateSeriesFile(f), id).toEqual([]);
  });

  it('metadata match the catalogue (source, unit, frequency, documentation)', () => {
    for (const e of CATALOG) {
      const m = series(e.id).meta;
      expect(m.source.seriesId, e.id).toBe(e.source.seriesId);
      expect(m.unitKind, e.id).toBe(e.unitKind);
      expect(m.frequency, e.id).toBe(e.frequency);
      expect(m.original, e.id).toBe(true);
      expect(m.source.docUrl, e.id).toMatch(/^https:\/\//);
      expect(m.methodology.es.length, e.id).toBeGreaterThan(10);
    }
    for (const d of DERIVED) expect(series(d.id).meta.original, d.id).toBe(false);
  });

  it('dates follow the declared frequency and are strictly increasing', () => {
    for (const [id, f] of files) {
      const dates = f.data.map(([d]) => d);
      for (let k = 1; k < dates.length; k += 1) expect(dates[k]! > dates[k - 1]!, `${id} ${dates[k]}`).toBe(true);
      expect(dates.every(isIsoDate), id).toBe(true);
      if (f.meta.frequency === 'M') expect(dates.every((d) => d.endsWith('-01')), id).toBe(true);
      if (f.meta.frequency === 'Q') expect(dates.every((d) => /-(01|04|07|10)-01$/.test(d)), id).toBe(true);
      if (f.meta.frequency === 'A') expect(dates.every((d) => d.endsWith('-01-01')), id).toBe(true);
      if (f.meta.frequency === 'D' && !CALENDAR_DAILY.has(id)) expect(dates.every((d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay())), `${id} weekend`).toBe(true);
    }
  });

  it('state is consistent with the staleness rule at download time', () => {
    for (const [id, f] of files) {
      if (f.status.state === 'fallback') {
        expect(f.status.error, id).toBeTruthy();
        continue;
      }
      expect(f.status.state, id).toBe(isStale(f.status.lastObservation, f.meta.frequency, f.status.fetchedAt.slice(0, 10)) ? 'stale' : 'fresh');
    }
  });

  it('manifest lists every series with the same status', () => {
    const manifest = read<{ generatedAt: string; series: { id: string; lastObservation: string; count: number; state: string }[]; checks: string[] }>('manifest.json');
    expect(Date.parse(manifest.generatedAt)).not.toBeNaN();
    expect(manifest.series.map((s) => s.id).sort()).toEqual([...files.keys()].sort());
    for (const s of manifest.series) {
      const f = series(s.id);
      expect(s.lastObservation, s.id).toBe(f.status.lastObservation);
      expect(s.count, s.id).toBe(f.status.count);
      expect(s.state, s.id).toBe(f.status.state);
    }
  });
});

describe('economic consistency of the official data', () => {
  it('trade identity: published balance = exports − imports (up to rounding)', () => {
    const rows = tradeRows(series('ar_x').data, series('ar_m').data, series('ar_saldo').data).filter((r) => r.gap !== null);
    expect(rows.length).toBeGreaterThan(100);
    for (const r of rows) expect(Math.abs(r.gap!), r.date).toBeLessThanOrEqual(1);
  });

  it('export groups and import uses add up to the totals', () => {
    const x = at(series('ar_x').data);
    const xs = ['ar_x_pp', 'ar_x_moa', 'ar_x_moi', 'ar_x_cye'].map((id) => at(series(id).data));
    for (const [d, v] of x) {
      const parts = xs.map((s) => s.get(d));
      if (parts.some((p) => p === undefined)) continue;
      expect(Math.abs(parts.reduce<number>((a, b) => a + (b ?? 0), 0) - v), d).toBeLessThanOrEqual(1);
    }
    const m = at(series('ar_m').data);
    const ms = ['ar_m_bk', 'ar_m_bi', 'ar_m_pya', 'ar_m_bc', 'ar_m_cyl', 'ar_m_vap', 'ar_m_resto'].map((id) => at(series(id).data));
    for (const [d, v] of m) {
      const parts = ms.map((s) => s.get(d));
      if (parts.some((p) => p === undefined)) continue;
      expect(Math.abs(parts.reduce<number>((a, b) => a + (b ?? 0), 0) - v), d).toBeLessThanOrEqual(1);
    }
  });

  it('derived series reproduce their published definition', () => {
    const g = (id: string) => at(series(id).data);
    const [x, pp, moa, moi, cye] = ['ar_x', 'ar_x_pp', 'ar_x_moa', 'ar_x_moi', 'ar_x_cye'].map(g) as Map<string, number>[];
    for (const [d, v] of cye!) expect(v, d).toBeCloseTo(x!.get(d)! - pp!.get(d)! - moa!.get(d)! - moi!.get(d)!, 6);
    const [bkpya, bk, pya] = ['ar_m_bk_pya', 'ar_m_bk', 'ar_m_pya'].map(g) as Map<string, number>[];
    for (const [d, v] of pya!) expect(v, d).toBeCloseTo(bkpya!.get(d)! - bk!.get(d)!, 6);
    const [xu, su, mu] = ['ar_x_eeuu', 'ar_saldo_eeuu', 'ar_m_eeuu'].map(g) as Map<string, number>[];
    for (const [d, v] of mu!) expect(v, d).toBeCloseTo(xu!.get(d)! - su!.get(d)!, 6);
  });

  it('partner and component flows never exceed the totals and are non-negative', () => {
    const x = at(series('ar_x').data);
    const m = at(series('ar_m').data);
    for (const id of ['ar_x_brasil', 'ar_x_china', 'ar_x_eeuu', 'ar_x_chile', 'ar_x_india', 'ar_x_pp', 'ar_x_moa', 'ar_x_moi']) {
      for (const [d, v] of series(id).data) {
        expect(v, `${id} ${d}`).toBeGreaterThanOrEqual(0);
        if (x.has(d)) expect(v, `${id} ${d}`).toBeLessThanOrEqual(x.get(d)! + 1);
      }
    }
    for (const id of ['ar_m_brasil', 'ar_m_eeuu', 'ar_m_india', 'ar_m_bk', 'ar_m_bi', 'ar_m_bc']) {
      for (const [d, v] of series(id).data) {
        expect(v, `${id} ${d}`).toBeGreaterThanOrEqual(-0.5);
        if (m.has(d)) expect(v, `${id} ${d}`).toBeLessThanOrEqual(m.get(d)! + 1);
      }
    }
  });

  it('exchange rate is quoted as pesos per dollar and rises over the sample', () => {
    const tc = series('ar_tc_mayorista');
    expect(tc.meta.unitKind).toBe('ars_per_usd');
    const first = tc.data[0]![1];
    const last = tc.data[tc.data.length - 1]![1];
    // ARS/USD: a larger number is a weaker peso. From ≈ 13 in 2016 to hundreds or more.
    expect(first).toBeGreaterThan(5);
    expect(first).toBeLessThan(20);
    expect(last).toBeGreaterThan(first * 10);
  });

  it('the Fed target range is ordered and 25 bp wide (since 2008)', () => {
    const lo = at(series('us_fed_lower').data);
    for (const [d, up] of series('us_fed_upper').data) {
      const l = lo.get(d);
      if (l === undefined) continue;
      expect(up - l, d).toBeCloseTo(0.25, 6);
    }
  });

  it('Treasury yields and Argentine rates are in percent, not basis points or fractions', () => {
    for (const id of ['us_t3m', 'us_t2y', 'us_t10y']) {
      for (const [d, v] of series(id).data) {
        expect(v, `${id} ${d}`).toBeGreaterThanOrEqual(-1);
        expect(v, `${id} ${d}`).toBeLessThan(10);
      }
    }
    const badlar = series('ar_badlar').data;
    expect(Math.max(...badlar.map(([, v]) => v))).toBeGreaterThan(20);
    expect(Math.max(...badlar.map(([, v]) => v))).toBeLessThan(200);
  });

  it('monthly inflation (BCRA) is consistent with the CPI index (INDEC)', () => {
    const ipc = series('ar_ipc').data;
    const infl = at(series('ar_inflacion_mensual').data);
    let compared = 0;
    for (let k = 1; k < ipc.length; k += 1) {
      const [d, v] = ipc[k]!;
      const published = infl.get(d);
      // Up to May 2017 the BCRA series follows the Greater Buenos Aires CPI (documented in its methodology).
      if (published === undefined || d < '2017-06-01') continue;
      // The published rate is rounded to one decimal.
      expect(Math.abs((v / ipc[k - 1]![1] - 1) * 100 - published), d).toBeLessThan(0.1);
      compared += 1;
    }
    expect(compared).toBeGreaterThan(50);
  });
});

describe('episodes and curated news', () => {
  const all = [...EPISODES, ...TRADE_EVENTS];

  it('every episode is dated, unique and documented with sources', () => {
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    for (const e of all) {
      expect(isIsoDate(e.date), e.id).toBe(true);
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const s of e.sources) {
        expect(s.url, e.id).toMatch(/^https:\/\//);
        expect(s.title.length, e.id).toBeGreaterThan(5);
        expect(s.publisher.length, e.id).toBeGreaterThan(1);
        if (s.date !== null) {
          expect(isIsoDate(s.date), `${e.id} ${s.url}`).toBe(true);
          // A source cannot predate the episode by more than a few weeks (context pieces aside).
          expect(s.date >= '2017-01-01', `${e.id} ${s.url}`).toBe(true);
        }
      }
      for (const k of ['context', 'decision', 'interpretation'] as const) expect(e[k].es.length, `${e.id} ${k}`).toBeGreaterThan(20);
      expect(e.hypotheses.length, e.id).toBeGreaterThan(0);
    }
  });

  it('episodes are in chronological order and none is in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (let k = 1; k < EPISODES.length; k += 1) expect(EPISODES[k]!.date >= EPISODES[k - 1]!.date).toBe(true);
    for (const e of all) expect(e.date <= today, e.id).toBe(true);
  });

  it('no source URL is repeated within an episode', () => {
    for (const e of all) expect(new Set(e.sources.map((s) => s.url)).size, e.id).toBe(e.sources.length);
  });

  it('the automatic news file is well formed (it may be empty if the feed was unavailable)', () => {
    const news = read<{ fetchedAt: string; items: { title: string; url: string; date: string; domain: string; topic: string; country: string }[]; errors: string[] }>('news-auto.json');
    expect(Date.parse(news.fetchedAt)).not.toBeNaN();
    expect(Array.isArray(news.errors)).toBe(true);
    expect(new Set(news.items.map((n) => n.url)).size).toBe(news.items.length);
    for (const n of news.items) {
      expect(n.url).toMatch(/^https?:\/\//);
      expect(isIsoDate(n.date)).toBe(true);
      expect(n.title.length).toBeGreaterThan(0);
      expect(n.domain.length).toBeGreaterThan(0);
    }
  });
});
