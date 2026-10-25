import { brent } from '../numeric/roots';
import type {
  AdvElasticities,
  AdvEquilibrium,
  AdvIssue,
  AdvMultipliers,
  AdvParamKey,
  AdvParams,
  AdvResult,
  AdvSolved,
  AdvSpec,
  LMZone,
  SolverDiagnostics,
} from './types';

/** Crowding-out shares delimiting the pedagogical LM zones. */
export const ZONE_TRAP_MAX = 0.1;
export const ZONE_CLASSICAL_MIN = 0.9;
const HIGH_MULTIPLIER = 20;

// ── Building blocks ─────────────────────────────────────────────────────────

/** Simple multiplier α = 1/[1 − c(1 − t)]. */
export function alphaOf(p: AdvParams): number {
  return 1 / (1 - p.c * (1 - p.t));
}

/** Autonomous spending A = C₀ − cT₀ + c·TR + I₀ + G (bn). */
export function autonomousOf(p: AdvParams): number {
  return p.C0 - p.c * p.T0 + p.c * p.TR + p.I0 + p.G;
}

export function realMoneyOf(p: AdvParams): number {
  return p.M / p.P;
}

/** IS curve: Y = α (A − b i). Defined for every i. */
export function isOutput(p: AdvParams, i: number): number {
  return alphaOf(p) * (autonomousOf(p) - p.b * i);
}

/** Real money demand L(Y, i) for the linear and non-linear specifications (null outside the domain). */
export function moneyDemandOf(spec: AdvSpec, Y: number, i: number): number | null {
  const p = spec.params;
  if (spec.lm === 'nonlinear') {
    if (!(i > p.iMin)) return null;
    return p.k * Y + p.a / (i - p.iMin);
  }
  return p.k * Y + p.L0 - p.h * i;
}

/** Speculative (interest-dependent) component of money demand. */
export function speculativeDemandOf(spec: AdvSpec, i: number): number | null {
  const p = spec.params;
  if (spec.lm === 'nonlinear') return i > p.iMin ? p.a / (i - p.iMin) : null;
  return p.L0 - p.h * i;
}

/**
 * LM curve as output for a given rate (money-supply regime).
 *   linear/floor: Y = (m − L₀ + h i)/k      (floor: only for i ≥ i_floor)
 *   nonlinear:    Y = (m − a/(i − i_min))/k  (i > i_min)
 */
export function lmOutput(spec: AdvSpec, i: number): number | null {
  const p = spec.params;
  const m = realMoneyOf(p);
  if (spec.lm === 'nonlinear') return i > p.iMin ? (m - p.a / (i - p.iMin)) / p.k : null;
  if (spec.lm === 'floor' && i < p.iFloor) return null;
  return (m - p.L0 + p.h * i) / p.k;
}

/**
 * LM curve as interest rate for a given output (money-supply regime).
 *   linear:    i = (kY + L₀ − m)/h
 *   nonlinear: i = i_min + a/(m − kY), domain m − kY > 0
 *   floor:     i = max(i_floor, linear rate)
 * Returns null when undefined (vertical LM or outside the domain).
 */
export function lmRate(spec: AdvSpec, Y: number): number | null {
  const p = spec.params;
  const m = realMoneyOf(p);
  if (spec.lm === 'nonlinear') {
    const gap = m - p.k * Y;
    return gap > 0 ? p.iMin + p.a / gap : null;
  }
  if (p.h === 0) return null;
  const lin = (p.k * Y + p.L0 - m) / p.h;
  return spec.lm === 'floor' ? Math.max(p.iFloor, lin) : lin;
}

/** LM slope di/dY at (Y, i) in the money-supply regime. */
export function lmSlopeAt(spec: AdvSpec, Y: number, floorBinding: boolean): number {
  const p = spec.params;
  if (spec.regime === 'rate' || floorBinding) return 0;
  if (spec.lm === 'nonlinear') {
    const gap = realMoneyOf(p) - p.k * Y;
    return (p.a * p.k) / (gap * gap);
  }
  return p.h === 0 ? Number.POSITIVE_INFINITY : p.k / p.h;
}

/** ∂i/∂m along the LM holding Y fixed. */
function lmRateMoneyDerivative(spec: AdvSpec, Y: number, floorBinding: boolean): number {
  const p = spec.params;
  if (spec.regime === 'rate' || floorBinding) return 0;
  if (spec.lm === 'nonlinear') {
    const gap = realMoneyOf(p) - p.k * Y;
    return -p.a / (gap * gap);
  }
  return p.h === 0 ? Number.NEGATIVE_INFINITY : -1 / p.h;
}

// ── Validation ──────────────────────────────────────────────────────────────

const KEYS: readonly AdvParamKey[] = ['C0', 'c', 'T0', 't', 'TR', 'I0', 'b', 'G', 'M', 'P', 'k', 'h', 'L0', 'a', 'iMin', 'iFloor'];

export function validateAdvanced(spec: AdvSpec): AdvIssue[] {
  const p = spec.params;
  const issues: AdvIssue[] = [];
  for (const key of KEYS) if (!Number.isFinite(p[key])) issues.push({ code: 'NON_FINITE', severity: 'error', field: key });
  if (spec.regime === 'rate' && !Number.isFinite(spec.targetRate)) issues.push({ code: 'NON_FINITE', severity: 'error', field: 'targetRate' });
  if (issues.length) return issues;

  const err = (code: AdvIssue['code'], field?: string, values?: Record<string, number>) =>
    issues.push({ code, severity: 'error', field, values });
  if (p.c < 0 || p.c >= 1) err('MPC_OUT_OF_RANGE', 'c', { c: p.c });
  if (p.t < 0 || p.t >= 1) err('TAX_RATE_OUT_OF_RANGE', 't', { t: p.t });
  if (p.b < 0) err('NEGATIVE_SENSITIVITY', 'b', { value: p.b });
  if (spec.lm !== 'nonlinear' && p.h < 0) err('NEGATIVE_SENSITIVITY', 'h', { value: p.h });
  if (p.k <= 0) err('NON_POSITIVE_K', 'k', { k: p.k });
  if (p.P <= 0) err('NON_POSITIVE_PRICE', 'P', { P: p.P });
  if (spec.regime === 'money' && p.M <= 0) err('NON_POSITIVE_MONEY', 'M', { M: p.M });
  if (p.C0 < 0) err('NEGATIVE_AUTONOMOUS', 'C0', { value: p.C0 });
  if (p.I0 < 0) err('NEGATIVE_AUTONOMOUS', 'I0', { value: p.I0 });
  if (spec.lm !== 'nonlinear' && p.L0 < 0) err('NEGATIVE_AUTONOMOUS', 'L0', { value: p.L0 });
  if (p.G < 0) err('NEGATIVE_GOVERNMENT', 'G', { G: p.G });
  if (p.TR < 0) err('NEGATIVE_TRANSFERS', 'TR', { TR: p.TR });
  if (spec.lm === 'nonlinear' && p.a <= 0) err('NON_POSITIVE_A', 'a', { a: p.a });
  if (spec.regime === 'money' && spec.lm !== 'nonlinear' && p.b === 0 && p.h === 0) err('DEGENERATE_SYSTEM');
  if (spec.regime === 'rate') {
    if (spec.lm === 'nonlinear' && !(spec.targetRate > p.iMin)) err('TARGET_BELOW_MINIMUM', 'targetRate', { target: spec.targetRate, min: p.iMin });
    if (spec.lm === 'floor' && spec.targetRate < p.iFloor) err('TARGET_BELOW_MINIMUM', 'targetRate', { target: spec.targetRate, min: p.iFloor });
  }
  if (issues.length) return issues;
  if (p.T0 < 0) issues.push({ code: 'NEGATIVE_AUTONOMOUS_TAX', severity: 'warning', field: 'T0', values: { T0: p.T0 } });
  if (alphaOf(p) > HIGH_MULTIPLIER) issues.push({ code: 'HIGH_MULTIPLIER', severity: 'warning', values: { alpha: alphaOf(p) } });
  return issues;
}

// ── Solution ────────────────────────────────────────────────────────────────

interface Core {
  Y: number;
  i: number;
  M: number;
  floorBinding: boolean;
  idle: number;
  diagnostics: SolverDiagnostics;
}

type CoreResult = { ok: true; core: Core } | { ok: false; issue: AdvIssue };

/** Expands the upper end of an interest-rate bracket until g changes sign. */
function expandUpper(g: (i: number) => number, lo: number, start: number): [number, number] | null {
  const glo = g(lo);
  let hi = start;
  let step = Math.max(1, start - lo);
  for (let k = 0; k < 80; k += 1) {
    const ghi = g(hi);
    if (Number.isFinite(ghi) && ghi * glo <= 0) return [lo, hi];
    hi += step;
    step *= 2;
  }
  return null;
}

function solveCore(spec: AdvSpec): CoreResult {
  const p = spec.params;
  const alpha = alphaOf(p);
  const A = autonomousOf(p);
  const m = realMoneyOf(p);

  // Regime 'rate': the central bank fixes i and supplies the money demanded.
  if (spec.regime === 'rate') {
    const i = spec.targetRate;
    const Y = alpha * (A - p.b * i);
    const L = moneyDemandOf(spec, Y, i);
    if (L === null) return { ok: false, issue: { code: 'TARGET_BELOW_MINIMUM', severity: 'error', values: { target: i, min: p.iMin } } };
    return { ok: true, core: { Y, i, M: p.P * L, floorBinding: false, idle: 0, diagnostics: { method: 'closed-form', iterations: 0, residual: 0 } } };
  }

  if (spec.lm === 'linear' || spec.lm === 'floor') {
    // Closed form (Cramer): Y = (hA + b(m − L₀))/D,  i = (kA − (m − L₀)/α)/D,  D = h/α + bk.
    const D = p.h / alpha + p.b * p.k;
    let Y = (p.h * A + p.b * (m - p.L0)) / D;
    let i = (p.k * A - (m - p.L0) / alpha) / D;
    let floorBinding = false;
    let idle = 0;
    if (spec.lm === 'floor') {
      // At the floor, money demand is perfectly elastic: the bound binds when the money
      // supply exceeds the demand at the floor rate and the output implied by the IS.
      const Yf = alpha * (A - p.b * p.iFloor);
      const demandAtFloor = p.k * Yf + p.L0 - p.h * p.iFloor;
      if (m > demandAtFloor + 1e-12) {
        Y = Yf;
        i = p.iFloor;
        floorBinding = true;
        idle = m - demandAtFloor;
      }
    }
    return { ok: true, core: { Y, i, M: p.M, floorBinding, idle, diagnostics: { method: 'closed-form', iterations: 0, residual: 0 } } };
  }

  // Non-linear LM: solve g(i) = Y_IS(i) − Y_LM(i) = 0 on (i_min, ∞).
  // Y_IS is non-increasing and Y_LM strictly increasing in i, so g is strictly
  // decreasing and the equilibrium, if it exists, is unique.
  const g = (i: number) => alpha * (A - p.b * i) - (m - p.a / (i - p.iMin)) / p.k;
  if (p.b === 0) {
    // Vertical IS: Y = αA; the LM determines i if αA lies inside its domain (Y < m/k).
    const Y = alpha * A;
    const gap = m - p.k * Y;
    if (!(gap > 0)) return { ok: false, issue: { code: 'NO_EQUILIBRIUM', severity: 'error', values: { Y, Ymax: m / p.k } } };
    return { ok: true, core: { Y, i: p.iMin + p.a / gap, M: p.M, floorBinding: false, idle: 0, diagnostics: { method: 'closed-form', iterations: 0, residual: 0 } } };
  }
  const lo = p.iMin + Math.max(1e-9, 1e-9 * Math.abs(p.iMin));
  const bracket = expandUpper(g, lo, p.iMin + 1);
  if (!bracket) return { ok: false, issue: { code: 'NO_EQUILIBRIUM', severity: 'error', values: {} } };
  const r = brent(g, bracket[0], bracket[1], { xtol: 1e-12, ftol: 1e-9, maxIter: 300 });
  if (!r.ok) return { ok: false, issue: { code: 'SOLVER_FAILED', severity: 'error', values: { iterations: r.iterations } } };
  const i = r.root;
  const Y = alpha * (A - p.b * i);
  return {
    ok: true,
    core: { Y, i, M: p.M, floorBinding: false, idle: 0, diagnostics: { method: 'brent', iterations: r.iterations, residual: Math.abs(g(i)), bracket } },
  };
}

export function buildAdvEquilibrium(spec: AdvSpec, core: Core): AdvEquilibrium {
  const p = spec.params;
  const { Y, i } = core;
  const T = p.T0 + p.t * Y;
  const Yd = Y - T + p.TR;
  const C = p.C0 + p.c * Yd;
  const I = p.I0 - p.b * i;
  const Sp = Yd - C;
  const Sg = T - p.G - p.TR;
  const L = moneyDemandOf(spec, Y, i) ?? Number.NaN;
  return {
    Y,
    i,
    C,
    I,
    G: p.G,
    T,
    TR: p.TR,
    Yd,
    Sp,
    Sg,
    S: Sp + Sg,
    realMoney: core.M / p.P,
    M: core.M,
    moneyDemand: L,
    transactionDemand: p.k * Y,
    speculativeDemand: L - p.k * Y,
    idleBalances: core.idle,
    A: autonomousOf(p),
    alpha: alphaOf(p),
  };
}

export function advMultipliers(spec: AdvSpec, e: Pick<AdvEquilibrium, 'Y'>, floorBinding: boolean): AdvMultipliers {
  const p = spec.params;
  const alpha = alphaOf(p);
  const s = lmSlopeAt(spec, e.Y, floorBinding);
  const isSlope = p.b === 0 ? Number.NEGATIVE_INFINITY : -1 / (alpha * p.b);
  // dY/dG = α/(1 + α b s); with a vertical LM (s = ∞) the fiscal multiplier is 0.
  const dY_dG = Number.isFinite(s) ? alpha / (1 + alpha * p.b * s) : 0;
  const di_dm = lmRateMoneyDerivative(spec, e.Y, floorBinding);
  let dY_dm: number;
  if (spec.regime === 'rate' || floorBinding) dY_dm = 0;
  else if (!Number.isFinite(s)) dY_dm = 1 / p.k; // h = 0: Y = (m − L₀)/k
  else dY_dm = (-alpha * p.b * di_dm) / (1 + alpha * p.b * s);
  const di_dG = Number.isFinite(s) ? s * dY_dG : 1 / p.b; // vertical LM: Y fixed, so α(ΔG − bΔi) = 0
  const di_dmTotal = !Number.isFinite(s) ? (p.b === 0 ? 0 : -1 / (p.k * alpha * p.b)) : di_dm + s * dY_dm;
  return {
    alpha,
    lmSlope: s,
    isSlope,
    dY_dG,
    dY_dTR: p.c * dY_dG,
    dY_dT0: -p.c * dY_dG,
    dY_dt: -p.c * e.Y * dY_dG,
    dY_dRealMoney: dY_dm,
    di_dG,
    di_dRealMoney: spec.regime === 'rate' || floorBinding ? 0 : di_dmTotal,
    dY_dTargetRate: spec.regime === 'rate' ? -alpha * p.b : 0,
    crowdingOutShare: 1 - dY_dG / alpha,
  };
}

function ratio(num: number, den: number): number | null {
  return Math.abs(den) < 1e-12 || !Number.isFinite(num / den) ? null : num / den;
}

export function advElasticities(spec: AdvSpec, e: AdvEquilibrium, m: AdvMultipliers, floorBinding: boolean): AdvElasticities {
  const p = spec.params;
  let dLdi: number | null;
  if (floorBinding) dLdi = null; // perfectly elastic at the floor: elasticity undefined (−∞)
  else if (spec.lm === 'nonlinear') dLdi = -p.a / ((e.i - p.iMin) * (e.i - p.iMin));
  else dLdi = -p.h;
  return {
    moneyInterest: dLdi === null ? null : ratio(dLdi * e.i, e.moneyDemand),
    moneyIncome: ratio(p.k * e.Y, e.moneyDemand),
    investmentInterest: ratio(-p.b * e.i, e.I),
    outputGov: ratio(m.dY_dG * e.G, e.Y),
    outputMoney: spec.regime === 'rate' ? null : ratio(m.dY_dRealMoney * e.realMoney, e.Y),
  };
}

export function zoneOf(spec: AdvSpec, m: AdvMultipliers, floorBinding: boolean): LMZone {
  if (spec.regime === 'rate') return 'pegged';
  if (floorBinding) return 'floor';
  if (m.crowdingOutShare < ZONE_TRAP_MAX) return 'trap';
  if (m.crowdingOutShare > ZONE_CLASSICAL_MIN) return 'classical';
  return 'intermediate';
}

/**
 * Solves the advanced IS-LM model. Closed form for the linear, floor and
 * rate-target cases; Brent's method for the non-linear LM. Never returns a
 * non-converged or non-finite solution.
 */
export function solveAdvanced(spec: AdvSpec): AdvResult {
  const pre = validateAdvanced(spec);
  if (pre.some((x) => x.severity === 'error')) return { ok: false, issues: pre };
  const r = solveCore(spec);
  if (!r.ok) return { ok: false, issues: [...pre, r.issue] };
  const core = r.core;
  const e = buildAdvEquilibrium(spec, core);
  if (!Object.values(e).every(Number.isFinite)) return { ok: false, issues: [...pre, { code: 'SOLVER_FAILED', severity: 'error' }] };

  const issues = [...pre];
  if (e.Y <= 0) issues.push({ code: 'NON_POSITIVE_OUTPUT', severity: 'error', values: { Y: e.Y } });
  if (spec.regime === 'rate' && e.M <= 0) issues.push({ code: 'INFEASIBLE_TARGET', severity: 'error', values: { M: e.M, target: spec.targetRate } });
  if (issues.some((x) => x.severity === 'error')) return { ok: false, issues };
  if (e.i < 0) issues.push({ code: 'NEGATIVE_RATE', severity: 'warning', values: { i: e.i } });
  if (e.I < 0) issues.push({ code: 'NEGATIVE_INVESTMENT', severity: 'warning', values: { I: e.I } });
  if (e.C < 0) issues.push({ code: 'NEGATIVE_CONSUMPTION', severity: 'warning', values: { C: e.C } });
  if (e.Yd < 0) issues.push({ code: 'NEGATIVE_DISPOSABLE_INCOME', severity: 'warning', values: { Yd: e.Yd } });
  if (core.floorBinding) issues.push({ code: 'FLOOR_BINDING', severity: 'info', values: { floor: spec.params.iFloor, idle: core.idle } });

  const multipliers = advMultipliers(spec, e, core.floorBinding);
  const residuals = {
    goods: e.Y - (e.C + e.I + e.G),
    money: e.realMoney - (e.moneyDemand + e.idleBalances),
    saving: e.S - e.I,
    budget: e.Yd - (e.Y - e.T + e.TR),
  };
  return {
    ok: true,
    value: {
      spec,
      equilibrium: e,
      multipliers,
      elasticities: advElasticities(spec, e, multipliers, core.floorBinding),
      zone: zoneOf(spec, multipliers, core.floorBinding),
      floorBinding: core.floorBinding,
      residuals,
      diagnostics: core.diagnostics,
      issues,
    },
  };
}

export function maxAdvResidual(r: AdvSolved['residuals']): number {
  return Math.max(...Object.values(r).map(Math.abs));
}


/**
 * Linear LM tangent to a non-linear LM at a given equilibrium (local
 * linearisation): same slope k/h and same point (Y₀, i₀). Used to compare how a
 * linear approximation would predict the effect of a shock.
 */
export function tangentLinearSpec(spec: AdvSpec, Y0: number, i0: number): AdvSpec {
  const p = spec.params;
  const s = lmSlopeAt({ ...spec, regime: 'money' }, Y0, false);
  const h = p.k / s;
  const m = realMoneyOf(p);
  const L0 = m - p.k * Y0 + h * i0;
  return { ...spec, lm: 'linear', params: { ...p, h, L0 } };
}
