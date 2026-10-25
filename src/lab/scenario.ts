import { DEFAULT_PARAMS, compare, solve, type ModelParams, type PolicyRegime } from '../engine';
import { ADV_DEFAULTS, compareAdvanced, solveAdvanced, type AdvParams, type AdvRegime, type LMSpec } from '../engine/advanced';
import { OPEN_DEFAULTS, compareOpen, solveOpen, type FXRegime, type OpenParams } from '../engine/open/mundellFleming';
import { ADAS_DEFAULTS, compareADAS, solveADAS, type ADASParams } from '../engine/adas/adas';
import { ISMP_DEFAULTS, compareISMP, solveISMP, type ISMPParams, type MPRegime } from '../engine/ismp/ismp';
import { buildInsights } from '../interpretation/insights';
import { toLeveled } from '../interpretation/basicLevels';
import { buildAdvancedInsights } from '../interpretation/advancedInsights';
import { buildOpenInsights } from '../interpretation/openInsights';
import { buildADASInsights } from '../interpretation/adasInsights';
import { buildISMPInsights } from '../interpretation/ismpInsights';
import { emptyLevels, type LeveledReport } from '../interpretation/levels';

/**
 * Module H — scenario laboratory. A scenario stores ONLY its inputs; every
 * result shown, compared or exported is recomputed with the model engine.
 */
export type LabModel = 'basic' | 'advanced' | 'open' | 'adas' | 'ismp';

export type LabConfig =
  | { model: 'basic'; baseline: ModelParams; shocked: ModelParams; regime: PolicyRegime; target0: number; target1: number }
  | { model: 'advanced'; baseline: AdvParams; shocked: AdvParams; lm: LMSpec; regime: AdvRegime; target0: number; target1: number }
  | { model: 'open'; baseline: OpenParams; shocked: OpenParams; regime: FXRegime }
  | { model: 'adas'; baseline: ADASParams; shocked: ADASParams }
  | { model: 'ismp'; baseline: ISMPParams; shocked: ISMPParams; regime: MPRegime };

export interface LabScenario {
  id: string;
  name: string;
  createdAt: string;
  config: LabConfig;
}

const DEFAULTS: Record<LabModel, Record<string, number>> = {
  basic: DEFAULT_PARAMS as unknown as Record<string, number>,
  advanced: ADV_DEFAULTS as unknown as Record<string, number>,
  open: OPEN_DEFAULTS as unknown as Record<string, number>,
  adas: ADAS_DEFAULTS as unknown as Record<string, number>,
  ismp: ISMP_DEFAULTS as unknown as Record<string, number>,
};

const REGIMES: Partial<Record<LabModel, readonly string[]>> = {
  basic: ['money-supply', 'interest-target'],
  advanced: ['money', 'rate'],
  open: ['flexible', 'fixed'],
  ismp: ['rule', 'peg'],
};

function validParams(model: LabModel, x: unknown): x is Record<string, number> {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return Object.keys(DEFAULTS[model]).every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

/** Strict structural validation of a configuration coming from storage, a link or an imported file. */
export function validateConfig(x: unknown): LabConfig | null {
  if (typeof x !== 'object' || x === null) return null;
  const c = x as Record<string, unknown>;
  const model = c.model as LabModel;
  if (!(model in DEFAULTS)) return null;
  if (!validParams(model, c.baseline) || !validParams(model, c.shocked)) return null;
  const pick = (p: Record<string, number>) => Object.fromEntries(Object.keys(DEFAULTS[model]).map((k) => [k, p[k]]));
  const base = pick(c.baseline as Record<string, number>);
  const shock = pick(c.shocked as Record<string, number>);
  const regs = REGIMES[model];
  if (regs && !regs.includes(c.regime as string)) return null;
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  switch (model) {
    case 'basic':
      if (!num(c.target0) || !num(c.target1)) return null;
      return { model, baseline: base as unknown as ModelParams, shocked: shock as unknown as ModelParams, regime: c.regime as PolicyRegime, target0: c.target0 as number, target1: c.target1 as number };
    case 'advanced':
      if (!['linear', 'nonlinear', 'floor'].includes(c.lm as string) || !num(c.target0) || !num(c.target1)) return null;
      return { model, baseline: base as unknown as AdvParams, shocked: shock as unknown as AdvParams, lm: c.lm as LMSpec, regime: c.regime as AdvRegime, target0: c.target0 as number, target1: c.target1 as number };
    case 'open':
      return { model, baseline: base as unknown as OpenParams, shocked: shock as unknown as OpenParams, regime: c.regime as FXRegime };
    case 'adas':
      return { model, baseline: base as unknown as ADASParams, shocked: shock as unknown as ADASParams };
    case 'ismp':
      return { model, baseline: base as unknown as ISMPParams, shocked: shock as unknown as ISMPParams, regime: c.regime as MPRegime };
    default:
      return null;
  }
}

// ── Indicators and comparability ────────────────────────────────────────────

/**
 * An indicator family groups variables with the SAME definition and unit, so
 * they can be compared numerically across scenarios of different models.
 */
export type Family =
  | 'Y' // real output (bn)
  | 'i' // money-market interest rate in a fixed-price IS-LM-type model (%)
  | 'C'
  | 'I'
  | 'G'
  | 'T'
  | 'S'
  | 'Sg'
  | 'm' // real money supply M/P (bn)
  | 'multG' // local derivative dY/dG
  | 'P' // price level (index)
  | 'gap' // output gap (% of potential)
  | 'pi' // inflation (%)
  | 'ipol' // nominal policy rate in a model with inflation (%)
  | 'NX'
  | 'q'
  | 'R';

export const FAMILY_FORMAT: Record<Family, { fmt: string; dfmt: string }> = {
  Y: { fmt: 'n1', dfmt: 'sn2' },
  i: { fmt: 'n3', dfmt: 'sn3' },
  C: { fmt: 'n1', dfmt: 'sn2' },
  I: { fmt: 'n1', dfmt: 'sn2' },
  G: { fmt: 'n1', dfmt: 'sn2' },
  T: { fmt: 'n1', dfmt: 'sn2' },
  S: { fmt: 'n1', dfmt: 'sn2' },
  Sg: { fmt: 'n1', dfmt: 'sn2' },
  m: { fmt: 'n1', dfmt: 'sn2' },
  multG: { fmt: 'n3', dfmt: 'sn3' },
  P: { fmt: 'n4', dfmt: 'sn4' },
  gap: { fmt: 'n3', dfmt: 'sn3' },
  pi: { fmt: 'n3', dfmt: 'sn3' },
  ipol: { fmt: 'n3', dfmt: 'sn3' },
  NX: { fmt: 'n1', dfmt: 'sn2' },
  q: { fmt: 'n4', dfmt: 'sn4' },
  R: { fmt: 'n1', dfmt: 'sn2' },
};

export const FAMILY_ORDER: Family[] = ['Y', 'i', 'C', 'I', 'G', 'T', 'S', 'Sg', 'm', 'multG', 'P', 'gap', 'pi', 'ipol', 'NX', 'q', 'R'];

export interface Indicator {
  family: Family;
  v0: number;
  v1: number;
}

export interface ParamRow {
  key: string;
  v0: number;
  v1: number;
}

export interface ScenarioSummary {
  ok: true;
  model: LabModel;
  indicators: Indicator[];
  report: LeveledReport;
  params: ParamRow[];
  /** Equilibrium points in (Y, i) when the model has them (for the equilibrium-comparison chart). */
  yi: { Y0: number; i0: number; Y1: number; i1: number } | null;
}

export type SummaryResult = ScenarioSummary | { ok: false; model: LabModel; issues: { code: string; severity: string }[] };

const rows = (b: Record<string, number>, s: Record<string, number>): ParamRow[] => Object.keys(b).map((key) => ({ key, v0: b[key]!, v1: s[key]! }));
const ind = (family: Family, v0: number, v1: number): Indicator => ({ family, v0, v1 });

const NO_REPORT = (): LeveledReport => ({ noShock: false, headline: [], levels: emptyLevels() });

/**
 * Recomputes a scenario with its model engine and returns comparable indicators
 * and the explanation. `withReport = false` skips the explanation (used by the
 * sensitivity grids, which solve the model many times).
 */
export function summarize(cfg: LabConfig, withReport = true): SummaryResult {
  const report = (build: () => LeveledReport) => (withReport ? build() : NO_REPORT());
  switch (cfg.model) {
    case 'basic': {
      const r0 = solve({ params: cfg.baseline, regime: cfg.regime, targetRate: cfg.target0 });
      const r1 = solve({ params: cfg.shocked, regime: cfg.regime, targetRate: cfg.target1 });
      if (!r0.ok || !r1.ok) return { ok: false, model: cfg.model, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
      const a = r0.value.equilibrium;
      const b = r1.value.equilibrium;
      const cmp = compare(r0.value, r1.value);
      return {
        ok: true,
        model: cfg.model,
        indicators: [ind('Y', a.Y, b.Y), ind('i', a.i, b.i), ind('C', a.C, b.C), ind('I', a.I, b.I), ind('G', a.G, b.G), ind('T', a.T, b.T), ind('S', a.S, b.S), ind('Sg', a.Sg, b.Sg), ind('m', a.realMoney, b.realMoney), ind('multG', r0.value.multipliers.dY_dG, r1.value.multipliers.dY_dG)],
        report: report(() => toLeveled(buildInsights(r0.value, r1.value, cmp), r1.value, cmp)),
        params: rows(cfg.baseline as unknown as Record<string, number>, cfg.shocked as unknown as Record<string, number>),
        yi: { Y0: a.Y, i0: a.i, Y1: b.Y, i1: b.i },
      };
    }
    case 'advanced': {
      const r0 = solveAdvanced({ params: cfg.baseline, lm: cfg.lm, regime: cfg.regime, targetRate: cfg.target0 });
      const r1 = solveAdvanced({ params: cfg.shocked, lm: cfg.lm, regime: cfg.regime, targetRate: cfg.target1 });
      if (!r0.ok || !r1.ok) return { ok: false, model: cfg.model, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
      const a = r0.value.equilibrium;
      const b = r1.value.equilibrium;
      const cmp = compareAdvanced(r0.value, r1.value);
      return {
        ok: true,
        model: cfg.model,
        indicators: [ind('Y', a.Y, b.Y), ind('i', a.i, b.i), ind('C', a.C, b.C), ind('I', a.I, b.I), ind('G', a.G, b.G), ind('T', a.T, b.T), ind('S', a.S, b.S), ind('Sg', a.Sg, b.Sg), ind('m', a.realMoney, b.realMoney), ind('multG', r0.value.multipliers.dY_dG, r1.value.multipliers.dY_dG)],
        report: report(() => buildAdvancedInsights(r0.value, r1.value, cmp)),
        params: rows(cfg.baseline as unknown as Record<string, number>, cfg.shocked as unknown as Record<string, number>),
        yi: { Y0: a.Y, i0: a.i, Y1: b.Y, i1: b.i },
      };
    }
    case 'open': {
      const r0 = solveOpen({ params: cfg.baseline, regime: cfg.regime });
      const r1 = solveOpen({ params: cfg.shocked, regime: cfg.regime });
      if (!r0.ok || !r1.ok) return { ok: false, model: cfg.model, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
      const a = r0.value.equilibrium;
      const b = r1.value.equilibrium;
      return {
        ok: true,
        model: cfg.model,
        indicators: [ind('Y', a.Y, b.Y), ind('i', a.i, b.i), ind('C', a.C, b.C), ind('I', a.I, b.I), ind('G', a.G, b.G), ind('T', a.T, b.T), ind('S', a.S, b.S), ind('Sg', a.Sg, b.Sg), ind('m', a.realMoney, b.realMoney), ind('multG', r0.value.multipliers.dY_dG, r1.value.multipliers.dY_dG), ind('NX', a.NX, b.NX), ind('q', a.q, b.q), ind('R', a.R, b.R)],
        report: report(() => buildOpenInsights(r0.value, r1.value, compareOpen(r0.value, r1.value))),
        params: rows(cfg.baseline as unknown as Record<string, number>, cfg.shocked as unknown as Record<string, number>),
        yi: { Y0: a.Y, i0: a.i, Y1: b.Y, i1: b.i },
      };
    }
    case 'adas': {
      const r0 = solveADAS(cfg.baseline);
      const r1 = solveADAS(cfg.shocked);
      if (!r0.ok || !r1.ok) return { ok: false, model: cfg.model, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
      const a = r0.value.equilibrium;
      const b = r1.value.equilibrium;
      return {
        ok: true,
        model: cfg.model,
        indicators: [ind('Y', a.Y, b.Y), ind('i', a.i, b.i), ind('C', a.C, b.C), ind('I', a.I, b.I), ind('G', a.G, b.G), ind('T', a.T, b.T), ind('Sg', a.Sg, b.Sg), ind('m', a.realMoney, b.realMoney), ind('P', a.P, b.P), ind('gap', a.gap, b.gap)],
        report: report(() => buildADASInsights(r0.value, r1.value, compareADAS(r0.value, r1.value))),
        params: rows(cfg.baseline as unknown as Record<string, number>, cfg.shocked as unknown as Record<string, number>),
        yi: { Y0: a.Y, i0: a.i, Y1: b.Y, i1: b.i },
      };
    }
    case 'ismp': {
      const r0 = solveISMP({ params: cfg.baseline, regime: cfg.regime });
      const r1 = solveISMP({ params: cfg.shocked, regime: cfg.regime });
      if (!r0.ok || !r1.ok) return { ok: false, model: cfg.model, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
      const a = r0.value.equilibrium;
      const b = r1.value.equilibrium;
      return {
        ok: true,
        model: cfg.model,
        indicators: [ind('gap', a.x, b.x), ind('pi', a.pi, b.pi), ind('ipol', a.i, b.i)],
        report: report(() => buildISMPInsights(r0.value, r1.value, compareISMP(r0.value, r1.value))),
        params: rows(cfg.baseline as unknown as Record<string, number>, cfg.shocked as unknown as Record<string, number>),
        yi: null,
      };
    }
    default:
      return { ok: false, model: 'basic', issues: [] };
  }
}

// ── Serialisation: links, storage, import / export ─────────────────────────

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Module that opens a configuration. */
export const MODULE_OF: Record<LabModel, string> = { basic: 'basic', advanced: 'advanced', open: 'open', adas: 'adas', ismp: 'ismp' };

/** Hash fragment that reopens a configuration in its module (no personal data). */
export function encodeConfigHash(cfg: LabConfig): string {
  return `#x=${toBase64Url(JSON.stringify(cfg))}`;
}

export function decodeConfigHash(hash: string): LabConfig | null {
  const m = /^#x=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || !m[1]) return null;
  try {
    return validateConfig(JSON.parse(fromBase64Url(m[1])));
  } catch {
    return null;
  }
}

export const LAB_FORMAT = 'islm-lab';
export const LAB_VERSION = 1;
export const MAX_COMPARE = 4;
export const MAX_STORED = 40;

export interface LabFile {
  format: typeof LAB_FORMAT;
  version: number;
  exportedAt: string;
  scenarios: (LabScenario & { results?: { indicators: Indicator[] } })[];
}

export function exportScenarios(list: LabScenario[], now = new Date()): string {
  const file: LabFile = {
    format: LAB_FORMAT,
    version: LAB_VERSION,
    exportedAt: now.toISOString(),
    scenarios: list.map((s) => {
      const sum = summarize(s.config);
      return { ...s, results: sum.ok ? { indicators: sum.indicators } : undefined };
    }),
  };
  return JSON.stringify(file, null, 2);
}

export interface ImportReport {
  imported: LabScenario[];
  rejected: number;
  error: 'INVALID_JSON' | 'WRONG_FORMAT' | null;
}

let seq = 0;
export function newScenarioId(): string {
  seq += 1;
  return `lab-${Date.now().toString(36)}-${seq}`;
}

/** Validates an imported file; results inside the file are ignored and recomputed. */
export function importScenarios(text: string): ImportReport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { imported: [], rejected: 0, error: 'INVALID_JSON' };
  }
  const f = data as Partial<LabFile>;
  if (f?.format !== LAB_FORMAT || !Array.isArray(f.scenarios)) return { imported: [], rejected: 0, error: 'WRONG_FORMAT' };
  const imported: LabScenario[] = [];
  let rejected = 0;
  for (const raw of f.scenarios) {
    const cfg = validateConfig((raw as LabScenario)?.config);
    const name = typeof (raw as LabScenario)?.name === 'string' ? (raw as LabScenario).name.slice(0, 80) : '';
    const created = typeof (raw as LabScenario)?.createdAt === 'string' && !Number.isNaN(Date.parse((raw as LabScenario).createdAt)) ? (raw as LabScenario).createdAt : new Date().toISOString();
    if (!cfg) {
      rejected += 1;
      continue;
    }
    imported.push({ id: newScenarioId(), name: name || cfg.model, createdAt: created, config: cfg });
  }
  return { imported, rejected, error: null };
}

const STORE_KEY = 'islm.lab.v1';

export function loadLab(): LabScenario[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((x) => {
      const cfg = validateConfig((x as LabScenario)?.config);
      const s = x as LabScenario;
      return cfg && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.createdAt === 'string' ? [{ ...s, config: cfg }] : [];
    });
  } catch {
    return [];
  }
}

export function storeLab(list: LabScenario[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-MAX_STORED)));
  } catch {
    /* storage unavailable: kept in memory for this session */
  }
}

/** Same configuration with one parameter of E₁ replaced (sensitivity analysis). */
export function withShockedParam(cfg: LabConfig, key: string, value: number): LabConfig {
  return { ...cfg, shocked: { ...cfg.shocked, [key]: value } } as LabConfig;
}

/** Value of one indicator of E₁ (or its change E₁ − E₀) for a configuration; null when unsolvable or undefined. */
export function indicatorValue(cfg: LabConfig, family: Family, stat: 'E1' | 'delta'): number | null {
  const sum = summarize(cfg, false);
  if (!sum.ok) return null;
  const it = sum.indicators.find((x) => x.family === family);
  if (!it) return null;
  const v = stat === 'E1' ? it.v1 : it.v1 - it.v0;
  return Number.isFinite(v) ? v : null;
}
