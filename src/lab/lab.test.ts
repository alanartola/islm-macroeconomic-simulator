import { DEFAULT_PARAMS, solve } from '../engine';
import { ADV_DEFAULTS } from '../engine/advanced';
import { OPEN_DEFAULTS } from '../engine/open/mundellFleming';
import { ADAS_DEFAULTS } from '../engine/adas/adas';
import { ISMP_DEFAULTS } from '../engine/ismp/ismp';
import { toCSV } from './exporters';
import { buildComparison, comparisonCsvRows } from './compare';
import {
  decodeConfigHash,
  encodeConfigHash,
  exportScenarios,
  importScenarios,
  loadLab,
  storeLab,
  summarize,
  validateConfig,
  type LabConfig,
  type LabScenario,
} from './scenario';

const basic: LabConfig = { model: 'basic', baseline: { ...DEFAULT_PARAMS }, shocked: { ...DEFAULT_PARAMS, G: 300 }, regime: 'money-supply', target0: 5, target1: 5 };
const adv: LabConfig = { model: 'advanced', baseline: { ...ADV_DEFAULTS }, shocked: { ...ADV_DEFAULTS, M: 1200 }, lm: 'nonlinear', regime: 'money', target0: 5, target1: 5 };
const open: LabConfig = { model: 'open', baseline: { ...OPEN_DEFAULTS }, shocked: { ...OPEN_DEFAULTS, G: 350 }, regime: 'fixed' };
const adas: LabConfig = { model: 'adas', baseline: { ...ADAS_DEFAULTS }, shocked: { ...ADAS_DEFAULTS, s: 0.05 } };
const ismp: LabConfig = { model: 'ismp', baseline: { ...ISMP_DEFAULTS }, shocked: { ...ISMP_DEFAULTS, d: 2 }, regime: 'rule' };
const scen = (config: LabConfig, name: string = config.model): LabScenario => ({ id: name, name, createdAt: '2026-10-25T12:00:00.000Z', config });

describe('scenario summaries are recomputed by the engines', () => {
  it('basic: matches a direct Module A solve', () => {
    const s = summarize(basic);
    const r = solve({ params: basic.shocked, regime: 'money-supply', targetRate: 5 });
    expect(s.ok && r.ok).toBe(true);
    if (s.ok && r.ok) {
      expect(s.indicators.find((x) => x.family === 'Y')!.v1).toBeCloseTo(r.value.equilibrium.Y, 12);
      expect(s.indicators.find((x) => x.family === 'Y')!.v1 - s.indicators.find((x) => x.family === 'Y')!.v0).toBeCloseTo(100, 9);
      expect(s.report.levels[1].length).toBeGreaterThan(0);
    }
  });

  it.each([basic, adv, open, adas, ismp])('every model produces a summary with a five-level report (%#)', (cfg) => {
    const s = summarize(cfg);
    expect(s.ok).toBe(true);
    if (s.ok) {
      expect(s.indicators.length).toBeGreaterThan(0);
      for (const k of [1, 2, 3, 4, 5] as const) expect(Array.isArray(s.report.levels[k])).toBe(true);
    }
  });

  it('an unsolvable configuration is reported, never given fake numbers', () => {
    const bad: LabConfig = { ...basic, shocked: { ...DEFAULT_PARAMS, c: 1 } };
    expect(summarize(bad).ok).toBe(false);
  });
});

describe('comparability', () => {
  it('IS-MP indicators are not mixed with IS-LM output or interest rates', () => {
    const cmp = buildComparison([scen(basic), scen(ismp)]);
    const y = cmp.rows.find((r) => r.family === 'Y')!;
    expect(y.cells[1]).toBeNull();
    expect(y.comparable).toBe(false);
    expect(cmp.rows.find((r) => r.family === 'i')!.cells[1]).toBeNull();
    expect(cmp.rows.find((r) => r.family === 'ipol')!.cells[0]).toBeNull();
  });

  it('the output gap is comparable between AD-AS and IS-MP (same definition: % of potential)', () => {
    const row = buildComparison([scen(adas), scen(ismp)]).rows.find((r) => r.family === 'gap')!;
    expect(row.comparable).toBe(true);
    expect(row.cells.every((c) => c !== null)).toBe(true);
  });

  it('output is comparable across the four IS-LM-type models', () => {
    const row = buildComparison([scen(basic), scen(adv), scen(open), scen(adas)]).rows.find((r) => r.family === 'Y')!;
    expect(row.cells.every((c) => c !== null)).toBe(true);
  });

  it('CSV export contains one line per variable and statistic, empty cells where undefined', () => {
    const cmp = buildComparison([scen(basic, 'A'), scen(ismp, 'G')]);
    const csv = toCSV(comparisonCsvRows(cmp, (f) => f, (m) => m));
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('variable,estadistico,A [basic],G [ismp]');
    const yDelta = lines.find((l) => l.startsWith('Y,delta,'))!.split(',');
    expect(Number(yDelta[2])).toBeCloseTo(100, 9);
    expect(yDelta[3]).toBe(''); // output is not defined in IS-MP
    // No floating-point noise in the exported values.
    for (const line of lines.slice(1)) for (const cell of line.split(',').slice(2)) expect(cell).not.toMatch(/\d{13,}/);
  });
});

describe('links, storage and import/export', () => {
  it('config hash round trip', () => {
    for (const cfg of [basic, adv, open, adas, ismp]) expect(decodeConfigHash(encodeConfigHash(cfg))).toEqual(cfg);
  });

  it.each(['', '#x=', '#x=%%%', '#x=e30', '#s=abc'])('rejects malformed hash %j', (h) => {
    expect(decodeConfigHash(h)).toBeNull();
  });

  it('validateConfig rejects unknown models, regimes and non-numeric parameters', () => {
    expect(validateConfig({ ...basic, model: 'other' })).toBeNull();
    expect(validateConfig({ ...open, regime: 'crawling' })).toBeNull();
    expect(validateConfig({ ...adas, shocked: { ...ADAS_DEFAULTS, M: 'x' } })).toBeNull();
    expect(validateConfig({ ...adv, lm: 'quadratic' })).toBeNull();
  });

  it('export → import round trip keeps inputs and recomputes results (stored results are ignored)', () => {
    const json = exportScenarios([scen(basic, 'Fiscal'), scen(open, 'MF')], new Date('2026-10-25T12:00:00Z'));
    const parsed = JSON.parse(json);
    expect(parsed.format).toBe('islm-lab');
    expect(parsed.scenarios[0].results.indicators.length).toBeGreaterThan(0);
    parsed.scenarios[0].results.indicators[0].v1 = 999999; // tampered results must not matter
    const rep = importScenarios(JSON.stringify(parsed));
    expect(rep.error).toBeNull();
    expect(rep.imported).toHaveLength(2);
    expect(rep.imported[0]!.config).toEqual(basic);
    const s = summarize(rep.imported[0]!.config);
    expect(s.ok && s.indicators.find((x) => x.family === 'Y')!.v1).not.toBe(999999);
  });

  it('import reports invalid JSON, wrong format and rejected entries', () => {
    expect(importScenarios('{nope').error).toBe('INVALID_JSON');
    expect(importScenarios('{"format":"other"}').error).toBe('WRONG_FORMAT');
    const rep = importScenarios(JSON.stringify({ format: 'islm-lab', version: 1, scenarios: [{ name: 'ok', config: basic }, { name: 'bad', config: { model: 'basic' } }] }));
    expect(rep.imported).toHaveLength(1);
    expect(rep.rejected).toBe(1);
  });

  it('local storage round trip discards corrupted entries', () => {
    localStorage.clear();
    storeLab([scen(basic), scen(ismp)]);
    expect(loadLab()).toHaveLength(2);
    localStorage.setItem('islm.lab.v1', JSON.stringify([{ id: 'x', name: 'y', createdAt: 'z', config: { model: 'basic' } }]));
    expect(loadLab()).toHaveLength(0);
    localStorage.setItem('islm.lab.v1', '{broken');
    expect(loadLab()).toEqual([]);
  });
});
