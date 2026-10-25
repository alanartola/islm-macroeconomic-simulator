import { change, type Change } from '../comparative';
import { ADV_DEFAULTS, alphaOf, autonomousOf, type AdvParams } from '../advanced';

/**
 * Module F — Aggregate demand and aggregate supply (see docs/modelos/oa-da.md).
 *
 * Aggregate demand is DERIVED from the Module B IS-LM with a linear LM by
 * letting real balances depend on the price level:
 *   IS: Y = α(A − b·i),  α = 1/[1 − c(1 − t)],  A = C₀ − cT₀ + c·TR + I₀ + G
 *   LM: M/P = kY + L₀ − h·i
 *   ⇒ Y_AD(P) = a₁ + a₂/P,  a₁ = (hA − bL₀)/D,  a₂ = bM/D,  D = h/α + bk
 *
 * Short-run aggregate supply (explicit, linear in output):
 *   P = Pᵉ + θ·(Y − Yₙ) + s        θ ≥ 0 (index points per bn), s supply shock
 *
 * Short-run equilibrium: P = Pᵉ + s + θ(a₁ + a₂/P − Yₙ). Multiplying by P > 0:
 *   P² − B·P − θa₂ = 0,  B = Pᵉ + s + θ(a₁ − Yₙ)
 *   ⇒ P* = [B + √(B² + 4θa₂)]/2  (the unique positive root when θa₂ > 0).
 *
 * Medium run (expectations fulfilled, Pᵉ = P): θ(Y − Yₙ) + s = 0 ⇒
 *   Y_MR = Yₙ − s/θ   and   P_MR solves Y_AD(P) = Y_MR ⇒ P_MR = a₂/(Y_MR − a₁).
 * A persistent s is treated as a change of the price-setting margin, so it
 * lowers the medium-run (natural) output level.
 *
 * Adjustment path (only with an explicit rule): adaptive expectations
 *   Pᵉ_{t+1} = P_t, each period solved as a short-run equilibrium.
 */
export interface ADASParams extends AdvParams {
  /** Potential (natural) output Yₙ (bn). */
  Yn: number;
  /** Expected price level Pᵉ (index). */
  Pe: number;
  /** Slope of the SRAS θ (index points per bn of output gap). */
  theta: number;
  /** Supply shock s (index points; > 0 raises prices at every Y). */
  s: number;
}

export type ADASParamKey = keyof ADASParams;

/**
 * HYPOTHETICAL calibration: the Module B economy (linear LM) at P = Pᵉ = 1
 * produces Y = Yₙ = 2000 and i = 5, so E₀ is also a medium-run equilibrium.
 *   D = 25/2.5 + 25·0.5 = 22.5;  a₁ = (25·925 − 25·225)/22.5 = 777.7̄;  a₂ = 25·1100/22.5 = 1222.2̄
 */
export const ADAS_DEFAULTS: Readonly<ADASParams> = Object.freeze({ ...ADV_DEFAULTS, Yn: 2000, Pe: 1, theta: 0.0005, s: 0 });

export function adCoefficients(p: ADASParams): { a1: number; a2: number; D: number } {
  const alpha = alphaOf(p);
  const D = p.h / alpha + p.b * p.k;
  return { a1: (p.h * autonomousOf(p) - p.b * p.L0) / D, a2: (p.b * p.M) / D, D };
}

/** Aggregate demand: output consistent with goods- and money-market equilibrium at price level P. */
export function adOutput(p: ADASParams, P: number): number {
  const { a1, a2 } = adCoefficients(p);
  return a1 + a2 / P;
}

/** Inverse aggregate demand P(Y) (null where undefined: b = 0 or Y ≤ a₁). */
export function adPrice(p: ADASParams, Y: number): number | null {
  const { a1, a2 } = adCoefficients(p);
  if (a2 <= 0 || Y <= a1) return null;
  return a2 / (Y - a1);
}

/** Short-run aggregate supply P = Pᵉ + θ(Y − Yₙ) + s. */
export function srasPrice(p: ADASParams, Y: number): number {
  return p.Pe + p.theta * (Y - p.Yn) + p.s;
}

/** Interest rate implied by the LM at (Y, P). */
export function lmRateAt(p: ADASParams, Y: number, P: number): number {
  if (p.h > 0) return (p.k * Y + p.L0 - p.M / P) / p.h;
  return (autonomousOf(p) - Y / alphaOf(p)) / p.b;
}

export type ADASIssueCode =
  | 'NON_FINITE'
  | 'MPC_OUT_OF_RANGE'
  | 'TAX_RATE_OUT_OF_RANGE'
  | 'NEGATIVE_SENSITIVITY'
  | 'NON_POSITIVE_K'
  | 'NON_POSITIVE_MONEY'
  | 'NON_POSITIVE_POTENTIAL'
  | 'NON_POSITIVE_EXPECTED_PRICE'
  | 'DEGENERATE_SYSTEM'
  | 'NO_POSITIVE_PRICE'
  | 'NON_POSITIVE_OUTPUT'
  | 'VERTICAL_AD'
  | 'FLAT_SRAS'
  | 'NO_MEDIUM_RUN'
  | 'NEGATIVE_RATE'
  | 'NEGATIVE_INVESTMENT';

export interface ADASIssue {
  code: ADASIssueCode;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  values?: Record<string, number>;
}

export interface ADASEquilibrium {
  P: number;
  Y: number;
  /** Output gap (Y − Yₙ)/Yₙ in percent. */
  gap: number;
  i: number;
  realMoney: number;
  C: number;
  I: number;
  G: number;
  T: number;
  Sg: number;
  Yn: number;
  Pe: number;
}

export interface MediumRun {
  Y: number;
  P: number;
  i: number;
  realMoney: number;
}

export interface ADASSolved {
  params: ADASParams;
  equilibrium: ADASEquilibrium;
  /** Medium-run equilibrium (null when it does not exist: θ = 0 or vertical AD). */
  mediumRun: MediumRun | null;
  coefficients: { a1: number; a2: number; D: number; B: number };
  residuals: { ad: number; sras: number; goods: number; money: number };
  issues: ADASIssue[];
}

export type ADASResult = { ok: true; value: ADASSolved } | { ok: false; issues: ADASIssue[] };

const KEYS: readonly ADASParamKey[] = ['C0', 'c', 'T0', 't', 'TR', 'I0', 'b', 'G', 'M', 'k', 'h', 'L0', 'Yn', 'Pe', 'theta', 's'];

export function validateADAS(p: ADASParams): ADASIssue[] {
  const out: ADASIssue[] = [];
  for (const k of KEYS) if (!Number.isFinite(p[k])) out.push({ code: 'NON_FINITE', severity: 'error', field: k });
  if (out.length) return out;
  const err = (code: ADASIssueCode, field?: string, values?: Record<string, number>) => out.push({ code, severity: 'error', field, values });
  if (p.c < 0 || p.c >= 1) err('MPC_OUT_OF_RANGE', 'c', { c: p.c });
  if (p.t < 0 || p.t >= 1) err('TAX_RATE_OUT_OF_RANGE', 't', { t: p.t });
  for (const k of ['b', 'h', 'theta', 'L0'] as const) if (p[k] < 0) err('NEGATIVE_SENSITIVITY', k, { value: p[k] });
  if (p.k <= 0) err('NON_POSITIVE_K', 'k', { k: p.k });
  if (p.M <= 0) err('NON_POSITIVE_MONEY', 'M', { M: p.M });
  if (p.Yn <= 0) err('NON_POSITIVE_POTENTIAL', 'Yn', { Yn: p.Yn });
  if (p.Pe <= 0) err('NON_POSITIVE_EXPECTED_PRICE', 'Pe', { Pe: p.Pe });
  if (p.b === 0 && p.h === 0) err('DEGENERATE_SYSTEM');
  return out;
}

/** Short-run equilibrium price level (closed form). Null when no positive root exists. */
export function shortRunPrice(p: ADASParams): number | null {
  const { a1, a2 } = adCoefficients(p);
  const B = p.Pe + p.s + p.theta * (a1 - p.Yn);
  const disc = B * B + 4 * p.theta * a2;
  const P = (B + Math.sqrt(disc)) / 2;
  if (!(P > 0) || !Number.isFinite(P)) return null;
  return P;
}

export function mediumRunOf(p: ADASParams): MediumRun | null {
  const { a1, a2 } = adCoefficients(p);
  if (p.theta <= 0 || a2 <= 0) return null;
  const Y = p.Yn - p.s / p.theta;
  if (!(Y > a1) || Y <= 0) return null;
  const P = a2 / (Y - a1);
  return { Y, P, i: lmRateAt(p, Y, P), realMoney: p.M / P };
}

export function solveADAS(p: ADASParams): ADASResult {
  const pre = validateADAS(p);
  if (pre.some((x) => x.severity === 'error')) return { ok: false, issues: pre };
  const { a1, a2, D } = adCoefficients(p);
  const B = p.Pe + p.s + p.theta * (a1 - p.Yn);
  const P = shortRunPrice(p);
  if (P === null) return { ok: false, issues: [...pre, { code: 'NO_POSITIVE_PRICE', severity: 'error', values: { B } }] };
  const Y = adOutput(p, P);
  const issues = [...pre];
  if (!(Y > 0)) issues.push({ code: 'NON_POSITIVE_OUTPUT', severity: 'error', values: { Y } });
  if (issues.some((x) => x.severity === 'error')) return { ok: false, issues };
  const i = lmRateAt(p, Y, P);
  const T = p.T0 + p.t * Y;
  const C = p.C0 + p.c * (Y - T + p.TR);
  const I = p.I0 - p.b * i;
  const e: ADASEquilibrium = {
    P,
    Y,
    gap: ((Y - p.Yn) / p.Yn) * 100,
    i,
    realMoney: p.M / P,
    C,
    I,
    G: p.G,
    T,
    Sg: T - p.G - p.TR,
    Yn: p.Yn,
    Pe: p.Pe,
  };
  if (!Object.values(e).every(Number.isFinite)) return { ok: false, issues: [...issues, { code: 'NON_FINITE', severity: 'error' }] };
  if (a2 === 0) issues.push({ code: 'VERTICAL_AD', severity: 'info' });
  if (p.theta === 0) issues.push({ code: 'FLAT_SRAS', severity: 'info' });
  const mr = mediumRunOf(p);
  if (!mr) issues.push({ code: 'NO_MEDIUM_RUN', severity: 'warning' });
  if (i < 0) issues.push({ code: 'NEGATIVE_RATE', severity: 'warning', values: { i } });
  if (I < 0) issues.push({ code: 'NEGATIVE_INVESTMENT', severity: 'warning', values: { I } });
  return {
    ok: true,
    value: {
      params: p,
      equilibrium: e,
      mediumRun: mr,
      coefficients: { a1, a2, D, B },
      residuals: {
        ad: Y - adOutput(p, P),
        sras: P - srasPrice(p, Y),
        goods: Y - (C + I + p.G),
        money: p.M / P - (p.k * Y + p.L0 - p.h * i),
      },
      issues,
    },
  };
}

export interface PathPoint {
  t: number;
  Pe: number;
  P: number;
  Y: number;
  gap: number;
}

/**
 * Explicit adjustment rule: adaptive expectations Pᵉ_{t+1} = P_t.
 * Period 0 is the short-run equilibrium with the given Pᵉ.
 */
export function adjustmentPath(p: ADASParams, periods = 16): PathPoint[] {
  const out: PathPoint[] = [];
  let Pe = p.Pe;
  for (let t = 0; t <= periods; t += 1) {
    const P = shortRunPrice({ ...p, Pe });
    if (P === null) break;
    const Y = adOutput(p, P);
    out.push({ t, Pe, P, Y, gap: ((Y - p.Yn) / p.Yn) * 100 });
    Pe = P;
  }
  return out;
}

export type ADASEqKey = keyof ADASEquilibrium;

export interface ADASComparison {
  changes: Record<ADASEqKey, Change>;
  paramChanges: Partial<Record<ADASParamKey, Change>>;
  /** Horizontal AD shift at the initial price level: Y_AD,1(P₀) − Y₀. */
  adShift: number;
  /** Vertical SRAS shift at the initial output: P_SRAS,1(Y₀) − P₀. */
  srasShift: number;
  /** Movement along the new AD caused by ΔP (real-balance effect): Y_AD,1(P₁) − Y_AD,1(P₀). */
  priceEffect: number;
}

export function compareADAS(s0: ADASSolved, s1: ADASSolved): ADASComparison {
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const changes = Object.fromEntries((Object.keys(q0) as ADASEqKey[]).map((k) => [k, change(q0[k], q1[k])])) as Record<ADASEqKey, Change>;
  const paramChanges: Partial<Record<ADASParamKey, Change>> = {};
  for (const k of KEYS) if (Math.abs(s1.params[k] - s0.params[k]) > 1e-12) paramChanges[k] = change(s0.params[k], s1.params[k]);
  const adShift = adOutput(s1.params, q0.P) - q0.Y;
  return {
    changes,
    paramChanges,
    adShift,
    srasShift: srasPrice(s1.params, q0.Y) - q0.P,
    priceEffect: adOutput(s1.params, q1.P) - adOutput(s1.params, q0.P),
  };
}

export type ADASPresetId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';

/** Hypothetical scenarios from the default (medium-run) equilibrium. */
export const ADAS_PRESETS: readonly { id: ADASPresetId; shock: Partial<ADASParams> }[] = [
  { id: 'F1', shock: { M: 1200 } }, // monetary expansion
  { id: 'F2', shock: { M: 1000 } }, // monetary contraction
  { id: 'F3', shock: { G: 375 } }, // fiscal expansion
  { id: 'F4', shock: { G: 275 } }, // fiscal contraction
  { id: 'F5', shock: { s: 0.05 } }, // negative (inflationary) supply shock
  { id: 'F6', shock: { s: -0.05 } }, // positive supply shock
  { id: 'F7', shock: { Yn: 2100 } }, // higher potential output
  { id: 'F8', shock: { Pe: 1.05 } }, // higher expected price level
];
