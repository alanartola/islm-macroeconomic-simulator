import { change, type Change } from '../comparative';

/**
 * Module E — Mundell-Fleming model of a small open economy with perfect
 * capital mobility (see docs/modelos/mundell-fleming.md).
 *
 * Conventions:
 *   q = E·P^f/P is the real exchange rate; a RISE in q is a real DEPRECIATION.
 *   With P and P^f fixed, q and the nominal rate E move one-for-one.
 *   Perfect capital mobility, no risk premium, static exchange-rate
 *   expectations ⇒ i = i*.
 *
 *   X  = X₀ + v·Y* + x_q·q                    exports
 *   IM = IM₀ + m·Y − m_q·q                    imports (domestic-goods units;
 *                                             m_q is the volume response net of
 *                                             the valuation effect)
 *   NX = X − IM
 *   Y  = C + I + G + NX,   C = C₀ + c(Y − T₀ − tY + TR),   I = I₀ − b·i*
 *   IS*: Y = α_o (A_o − b·i* + n·q),   α_o = 1/[1 − c(1 − t) + m],  n = x_q + m_q
 *   LM*: M/P = kY − h·i*,  M = D + R  (domestic credit + reserves)
 *
 * Flexible rate: D and R exogenous ⇒ LM* fixes Y, IS* determines q.
 * Fixed rate:    q = q̄ exogenous ⇒ IS* fixes Y, LM* determines M, and
 *                reserves adjust: R = M − D (must remain ≥ 0).
 */
export type FXRegime = 'flexible' | 'fixed';

export interface OpenParams {
  C0: number;
  c: number;
  T0: number;
  t: number;
  TR: number;
  I0: number;
  b: number;
  G: number;
  X0: number;
  v: number;
  Yf: number;
  xq: number;
  IM0: number;
  m: number;
  mq: number;
  P: number;
  Pf: number;
  k: number;
  h: number;
  iStar: number;
  /** Domestic credit D (monetary instrument). */
  D: number;
  /** Initial reserves R (flexible regime: constant; fixed regime: endogenous). */
  R: number;
  /** Nominal exchange rate fixed by the central bank (fixed regime). */
  Ebar: number;
}

export type OpenParamKey = keyof OpenParams;

export interface OpenSpec {
  params: OpenParams;
  regime: FXRegime;
}

export type OpenIssueCode =
  | 'NON_FINITE'
  | 'MPC_OUT_OF_RANGE'
  | 'TAX_RATE_OUT_OF_RANGE'
  | 'IMPORT_PROPENSITY_OUT_OF_RANGE'
  | 'NEGATIVE_SENSITIVITY'
  | 'NON_POSITIVE_K'
  | 'NON_POSITIVE_PRICE'
  | 'NON_POSITIVE_RATE_PEG'
  | 'NO_TRADE_RESPONSE'
  | 'MARSHALL_LERNER_FAILS'
  | 'NON_POSITIVE_MONEY'
  | 'NON_POSITIVE_OUTPUT'
  | 'NON_POSITIVE_EXCHANGE_RATE'
  | 'RESERVES_EXHAUSTED'
  | 'NEGATIVE_INVESTMENT'
  | 'NEGATIVE_EXPORTS'
  | 'NEGATIVE_IMPORTS';

export interface OpenIssue {
  code: OpenIssueCode;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  values?: Record<string, number>;
}

export interface OpenEquilibrium {
  Y: number;
  i: number;
  q: number;
  E: number;
  C: number;
  I: number;
  G: number;
  T: number;
  TR: number;
  Yd: number;
  X: number;
  IM: number;
  NX: number;
  Sp: number;
  Sg: number;
  S: number;
  M: number;
  realMoney: number;
  D: number;
  R: number;
  /** Net capital inflow implied by the balance of payments (= −NX with BP = 0 in flows). */
  capitalInflow: number;
  alpha: number;
  n: number;
}

export interface OpenMultipliers {
  /** Open-economy simple multiplier α_o = 1/[1 − c(1 − t) + m]. */
  alpha: number;
  dY_dG: number;
  dq_dG: number;
  dNX_dG: number;
  dY_dD: number;
  dq_dD: number;
  dY_diStar: number;
  dq_diStar: number;
  dY_dYf: number;
  dq_dYf: number;
  /** Fixed regime: dY/dq̄ (devaluation); flexible: 0. */
  dY_dq: number;
  /** Fixed regime: dM/dG (endogenous money). */
  dM_dG: number;
}

export interface OpenSolved {
  spec: OpenSpec;
  equilibrium: OpenEquilibrium;
  multipliers: OpenMultipliers;
  residuals: { goods: number; money: number; saving: number; trade: number };
  issues: OpenIssue[];
}

export type OpenResult = { ok: true; value: OpenSolved } | { ok: false; issues: OpenIssue[] };

/**
 * HYPOTHETICAL calibration with hand-checkable equilibrium: Y = 2000,
 * q = E = 1, NX = 0, i = i* = 4, M = 800 (D = 600, R = 200).
 *   α_o = 1/(1 − 0.8·0.75 + 0.1) = 2
 *   A_o = 200 + 0.8·125 + 300 + 300 + 200 + 0.1·1000 − 300 = 900,  n = 200
 *   IS*: Y = 2(900 − 25·4 + 200·1) = 2000;  LM*: Y = (800 + 50·4)/0.5 = 2000
 */
export const OPEN_DEFAULTS: Readonly<OpenParams> = Object.freeze({
  C0: 200,
  c: 0.8,
  T0: 0,
  t: 0.25,
  TR: 125,
  I0: 300,
  b: 25,
  G: 300,
  X0: 200,
  v: 0.1,
  Yf: 1000,
  xq: 100,
  IM0: 300,
  m: 0.1,
  mq: 100,
  P: 1,
  Pf: 1,
  k: 0.5,
  h: 50,
  iStar: 4,
  D: 600,
  R: 200,
  Ebar: 1,
});

export function openSpec(p: Partial<OpenParams> = {}, regime: FXRegime = 'flexible'): OpenSpec {
  return { params: { ...OPEN_DEFAULTS, ...p }, regime };
}

export function openAlpha(p: OpenParams): number {
  return 1 / (1 - p.c * (1 - p.t) + p.m);
}

export function openAutonomous(p: OpenParams): number {
  return p.C0 - p.c * p.T0 + p.c * p.TR + p.I0 + p.G + p.X0 + p.v * p.Yf - p.IM0;
}

export function tradeResponse(p: OpenParams): number {
  return p.xq + p.mq;
}

/** IS* in (Y, q) space: Y = α_o (A_o − b i* + n q). */
export function isStarOutput(p: OpenParams, q: number): number {
  return openAlpha(p) * (openAutonomous(p) - p.b * p.iStar + tradeResponse(p) * q);
}

/** LM* output for a given money stock: Y = (M/P + h i*)/k. */
export function lmStarOutput(p: OpenParams, M: number): number {
  return (M / p.P + p.h * p.iStar) / p.k;
}

const KEYS: readonly OpenParamKey[] = ['C0', 'c', 'T0', 't', 'TR', 'I0', 'b', 'G', 'X0', 'v', 'Yf', 'xq', 'IM0', 'm', 'mq', 'P', 'Pf', 'k', 'h', 'iStar', 'D', 'R', 'Ebar'];

export function validateOpen(spec: OpenSpec): OpenIssue[] {
  const p = spec.params;
  const out: OpenIssue[] = [];
  for (const k of KEYS) if (!Number.isFinite(p[k])) out.push({ code: 'NON_FINITE', severity: 'error', field: k });
  if (out.length) return out;
  const err = (code: OpenIssueCode, field?: string, values?: Record<string, number>) => out.push({ code, severity: 'error', field, values });
  if (p.c < 0 || p.c >= 1) err('MPC_OUT_OF_RANGE', 'c', { c: p.c });
  if (p.t < 0 || p.t >= 1) err('TAX_RATE_OUT_OF_RANGE', 't', { t: p.t });
  if (p.m < 0 || p.m >= 1) err('IMPORT_PROPENSITY_OUT_OF_RANGE', 'm', { m: p.m });
  for (const k of ['b', 'h', 'v', 'xq'] as const) if (p[k] < 0) err('NEGATIVE_SENSITIVITY', k, { value: p[k] });
  if (p.k <= 0) err('NON_POSITIVE_K', 'k', { k: p.k });
  if (p.P <= 0) err('NON_POSITIVE_PRICE', 'P', { P: p.P });
  if (p.Pf <= 0) err('NON_POSITIVE_PRICE', 'Pf', { P: p.Pf });
  if (spec.regime === 'fixed' && p.Ebar <= 0) err('NON_POSITIVE_RATE_PEG', 'Ebar', { E: p.Ebar });
  if (spec.regime === 'flexible' && tradeResponse(p) === 0) err('NO_TRADE_RESPONSE', undefined, { n: tradeResponse(p) });
  if (out.length) return out;
  if (tradeResponse(p) < 0) out.push({ code: 'MARSHALL_LERNER_FAILS', severity: 'warning', values: { n: tradeResponse(p) } });
  return out;
}

export function solveOpen(spec: OpenSpec): OpenResult {
  const pre = validateOpen(spec);
  if (pre.some((x) => x.severity === 'error')) return { ok: false, issues: pre };
  const p = spec.params;
  const alpha = openAlpha(p);
  const n = tradeResponse(p);
  let Y: number;
  let q: number;
  let M: number;
  let R: number;
  if (spec.regime === 'flexible') {
    M = p.D + p.R;
    R = p.R;
    Y = lmStarOutput(p, M);
    q = (Y / alpha - openAutonomous(p) + p.b * p.iStar) / n;
  } else {
    q = (p.Ebar * p.Pf) / p.P;
    Y = isStarOutput(p, q);
    M = p.P * (p.k * Y - p.h * p.iStar);
    R = M - p.D;
  }
  const i = p.iStar;
  const T = p.T0 + p.t * Y;
  const Yd = Y - T + p.TR;
  const C = p.C0 + p.c * Yd;
  const I = p.I0 - p.b * i;
  const X = p.X0 + p.v * p.Yf + p.xq * q;
  const IM = p.IM0 + p.m * Y - p.mq * q;
  const NX = X - IM;
  const Sp = Yd - C;
  const Sg = T - p.G - p.TR;
  const e: OpenEquilibrium = {
    Y,
    i,
    q,
    E: (q * p.P) / p.Pf,
    C,
    I,
    G: p.G,
    T,
    TR: p.TR,
    Yd,
    X,
    IM,
    NX,
    Sp,
    Sg,
    S: Sp + Sg,
    M,
    realMoney: M / p.P,
    D: p.D,
    R,
    capitalInflow: -NX,
    alpha,
    n,
  };
  if (!Object.values(e).every(Number.isFinite)) return { ok: false, issues: [...pre, { code: 'NON_FINITE', severity: 'error' }] };
  const issues = [...pre];
  if (Y <= 0) issues.push({ code: 'NON_POSITIVE_OUTPUT', severity: 'error', values: { Y } });
  if (q <= 0) issues.push({ code: 'NON_POSITIVE_EXCHANGE_RATE', severity: 'error', values: { q } });
  if (M <= 0) issues.push({ code: 'NON_POSITIVE_MONEY', severity: 'error', values: { M } });
  if (spec.regime === 'fixed' && R < 0) issues.push({ code: 'RESERVES_EXHAUSTED', severity: 'error', values: { R, D: p.D, M } });
  if (issues.some((x) => x.severity === 'error')) return { ok: false, issues };
  if (I < 0) issues.push({ code: 'NEGATIVE_INVESTMENT', severity: 'warning', values: { I } });
  if (X < 0) issues.push({ code: 'NEGATIVE_EXPORTS', severity: 'warning', values: { X } });
  if (IM < 0) issues.push({ code: 'NEGATIVE_IMPORTS', severity: 'warning', values: { IM } });

  const flex = spec.regime === 'flexible';
  const multipliers: OpenMultipliers = flex
    ? {
        alpha,
        dY_dG: 0,
        dq_dG: -1 / n,
        dNX_dG: -1,
        dY_dD: 1 / (p.k * p.P),
        dq_dD: 1 / (p.k * p.P * alpha * n),
        dY_diStar: p.h / p.k,
        dq_diStar: (p.h / (p.k * alpha) + p.b) / n,
        dY_dYf: 0,
        dq_dYf: -p.v / n,
        dY_dq: 0,
        dM_dG: 0,
      }
    : {
        alpha,
        dY_dG: alpha,
        dq_dG: 0,
        dNX_dG: -p.m * alpha,
        dY_dD: 0,
        dq_dD: 0,
        dY_diStar: -alpha * p.b,
        dq_diStar: 0,
        dY_dYf: alpha * p.v,
        dq_dYf: 0,
        dY_dq: alpha * n,
        dM_dG: p.P * p.k * alpha,
      };
  return {
    ok: true,
    value: {
      spec,
      equilibrium: e,
      multipliers,
      residuals: {
        goods: Y - (C + I + p.G + NX),
        money: M / p.P - (p.k * Y - p.h * i),
        saving: e.S - I - NX,
        trade: NX - (X - IM),
      },
      issues,
    },
  };
}

export type OpenEqKey = keyof OpenEquilibrium;

export interface OpenComparison {
  changes: Record<OpenEqKey, Change>;
  paramChanges: Partial<Record<OpenParamKey, Change>>;
}

export function compareOpen(s0: OpenSolved, s1: OpenSolved): OpenComparison {
  const changes = Object.fromEntries(
    (Object.keys(s0.equilibrium) as OpenEqKey[]).map((k) => [k, change(s0.equilibrium[k], s1.equilibrium[k])]),
  ) as Record<OpenEqKey, Change>;
  const paramChanges: Partial<Record<OpenParamKey, Change>> = {};
  for (const k of KEYS) {
    if (k === 'Ebar' && s1.spec.regime === 'flexible') continue;
    if (Math.abs(s1.spec.params[k] - s0.spec.params[k]) > 1e-12) paramChanges[k] = change(s0.spec.params[k], s1.spec.params[k]);
  }
  return { changes, paramChanges };
}

export function maxOpenResidual(r: OpenSolved['residuals']): number {
  return Math.max(...Object.values(r).map(Math.abs));
}

export type OpenPresetId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9';

export interface OpenPreset {
  id: OpenPresetId;
  regime: FXRegime;
  shock: Partial<OpenParams>;
}

/** Required scenarios (hypothetical shocks from the default calibration). */
export const OPEN_PRESETS: readonly OpenPreset[] = [
  { id: 'E1', regime: 'flexible', shock: { D: 700 } }, // monetary expansion, flexible
  { id: 'E2', regime: 'fixed', shock: { D: 700 } }, // monetary expansion, fixed
  { id: 'E3', regime: 'flexible', shock: { G: 350 } }, // fiscal expansion, flexible
  { id: 'E4', regime: 'fixed', shock: { G: 350 } }, // fiscal expansion, fixed
  { id: 'E5', regime: 'flexible', shock: { Yf: 1200 } }, // foreign demand shock
  { id: 'E6', regime: 'flexible', shock: { iStar: 5 } }, // higher world interest rate
  { id: 'E7', regime: 'flexible', shock: { X0: 150 } }, // trade shock (export loss)
  { id: 'E8', regime: 'fixed', shock: { m: 0.15 } }, // higher propensity to import
  { id: 'E9', regime: 'fixed', shock: { Ebar: 1.1 } }, // devaluation under a peg
];
