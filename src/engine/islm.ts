import type {
  CurveSlopes,
  EconomySpec,
  Equilibrium,
  IdentityResiduals,
  ModelParams,
  Multipliers,
  SolveResult,
  ValidationIssue,
} from './types';
import { validateSpec } from './validation';

/*
 * Structural model (closed economy, fixed P, short run):
 *
 *   Goods market   Y = C + I + G
 *   Consumption    C = C₀ + c(Y − T)
 *   Investment     I = I₀ − b·i
 *   Money market   M/P = kY − h·i
 *
 * IS curve (goods-market equilibrium), with A ≡ C₀ − cT + I₀ + G:
 *   Y = [A − b·i] / (1 − c)          ⇔   i = [A − (1 − c)Y] / b      (b > 0)
 *
 * LM curve (money-market equilibrium), with m ≡ M/P:
 *   Y = [m + h·i] / k                ⇔   i = [kY − m] / h            (h > 0)
 *
 * Simultaneous solution (money-supply regime), with D ≡ h(1 − c) + b·k > 0:
 *   Y* = [h·A + b·m] / D
 *   i* = [k·A − (1 − c)·m] / D
 *
 * Interest-target regime (i = ī, M endogenous, LM horizontal):
 *   Y* = [A − b·ī] / (1 − c)
 *   M* = P·(kY* − h·ī)
 */

/** Autonomous spending A = C₀ − cT + I₀ + G (bn). */
export function autonomousSpending(p: ModelParams): number {
  return p.C0 - p.c * p.T + p.I0 + p.G;
}

/** Keynesian multiplier α = 1/(1 − c). */
export function keynesianMultiplier(p: ModelParams): number {
  return 1 / (1 - p.c);
}

/** System determinant D = h(1 − c) + b·k of the money-supply regime. */
export function determinant(p: ModelParams): number {
  return p.h * (1 - p.c) + p.b * p.k;
}

/** Real money supply m = M/P (bn, real). */
export function realMoney(p: ModelParams): number {
  return p.M / p.P;
}

/** Output on the IS curve at interest rate i: Y = α(A − b·i). Defined for every i. */
export function isOutputAt(p: ModelParams, i: number): number {
  return keynesianMultiplier(p) * (autonomousSpending(p) - p.b * i);
}

/** Output on the LM curve at interest rate i: Y = (m + h·i)/k. Defined for every i (k > 0). */
export function lmOutputAt(p: ModelParams, i: number): number {
  return (realMoney(p) + p.h * i) / p.k;
}

/** Interest rate on the IS curve at output Y; null if the IS is vertical (b = 0). */
export function isRateAt(p: ModelParams, Y: number): number | null {
  if (p.b === 0) return null;
  return (autonomousSpending(p) - (1 - p.c) * Y) / p.b;
}

/** Interest rate on the LM curve at output Y; null if the LM is vertical (h = 0). */
export function lmRateAt(p: ModelParams, Y: number): number | null {
  if (p.h === 0) return null;
  return (p.k * Y - realMoney(p)) / p.h;
}

/** Real money demand L(Y, i) = kY − h·i. */
export function moneyDemand(p: ModelParams, Y: number, i: number): number {
  return p.k * Y - p.h * i;
}

/** Builds all endogenous aggregates from (Y, i) and the parameters. */
export function buildEquilibrium(p: ModelParams, Y: number, i: number, M: number): Equilibrium {
  const Yd = Y - p.T;
  const C = p.C0 + p.c * Yd;
  const I = p.I0 - p.b * i;
  const Sp = Yd - C;
  const Sg = p.T - p.G;
  return {
    Y,
    i,
    C,
    I,
    G: p.G,
    T: p.T,
    Yd,
    Sp,
    Sg,
    S: Sp + Sg,
    realMoney: M / p.P,
    moneyDemand: moneyDemand(p, Y, i),
    M,
    A: autonomousSpending(p),
  };
}

export function identityResiduals(e: Equilibrium): IdentityResiduals {
  return {
    goodsMarket: e.Y - (e.C + e.I + e.G),
    moneyMarket: e.realMoney - e.moneyDemand,
    savingInvestment: e.S - e.I,
    disposableIncome: e.Yd - (e.C + e.Sp),
  };
}

/** Analytical comparative-statics multipliers for the given regime. */
export function computeMultipliers(spec: EconomySpec): Multipliers {
  const p = spec.params;
  const alpha = keynesianMultiplier(p);

  if (spec.regime === 'interest-target') {
    // With i pegged, the LM curve is horizontal and there is no crowding out:
    // fiscal and autonomous-spending shocks have the full Keynesian effect.
    return {
      keynesian: alpha,
      dY_dG: alpha,
      dY_dT: -p.c * alpha,
      dY_dBalancedBudget: alpha * (1 - p.c),
      dY_dI0: alpha,
      dY_dRealMoney: 0,
      di_dG: 0,
      di_dT: 0,
      di_dRealMoney: 0,
      dY_dTargetRate: -alpha * p.b,
      crowdingOutShare: 0,
    };
  }

  const D = determinant(p);
  const dY_dG = p.h / D;
  return {
    keynesian: alpha,
    dY_dG,
    dY_dT: (-p.c * p.h) / D,
    dY_dBalancedBudget: ((1 - p.c) * p.h) / D,
    dY_dI0: dY_dG,
    dY_dRealMoney: p.b / D,
    di_dG: p.k / D,
    di_dT: (-p.c * p.k) / D,
    di_dRealMoney: -(1 - p.c) / D,
    dY_dTargetRate: 0,
    // 1 − (h/D)/α = b·k / D after simplification.
    crowdingOutShare: (p.b * p.k) / D,
  };
}

export function curveSlopes(spec: EconomySpec): CurveSlopes {
  const p = spec.params;
  const is = p.b === 0 ? Number.NEGATIVE_INFINITY : -(1 - p.c) / p.b;
  if (spec.regime === 'interest-target') return { is, lm: 0 };
  const lm = p.h === 0 ? Number.POSITIVE_INFINITY : p.k / p.h;
  return { is, lm };
}

/** Checks on the solved equilibrium (plausibility of endogenous variables). */
function equilibriumIssues(spec: EconomySpec, e: Equilibrium): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (e.Y <= 0) {
    issues.push({ code: 'NON_POSITIVE_OUTPUT', severity: 'error', field: 'Y', values: { Y: e.Y } });
  }
  if (spec.regime === 'interest-target' && e.M <= 0) {
    issues.push({ code: 'INFEASIBLE_TARGET', severity: 'error', field: 'M', values: { M: e.M, target: spec.targetRate } });
  }
  if (e.i < 0) issues.push({ code: 'NEGATIVE_RATE', severity: 'warning', field: 'i', values: { i: e.i } });
  if (e.I < 0) issues.push({ code: 'NEGATIVE_INVESTMENT', severity: 'warning', field: 'I', values: { I: e.I } });
  if (e.C < 0) issues.push({ code: 'NEGATIVE_CONSUMPTION', severity: 'warning', field: 'C', values: { C: e.C } });
  if (e.Yd < 0) issues.push({ code: 'NEGATIVE_DISPOSABLE_INCOME', severity: 'warning', field: 'Yd', values: { Yd: e.Yd } });
  return issues;
}

/**
 * Solves the IS-LM equilibrium analytically.
 *
 * Never returns non-finite numbers: invalid or degenerate inputs yield
 * `{ ok: false, issues }` with machine-readable error codes.
 */
export function solve(spec: EconomySpec): SolveResult {
  const inputIssues = validateSpec(spec);
  if (inputIssues.some((x) => x.severity === 'error')) return { ok: false, issues: inputIssues };

  const p = spec.params;
  const A = autonomousSpending(p);
  let Y: number;
  let i: number;
  let M: number;

  if (spec.regime === 'interest-target') {
    i = spec.targetRate;
    Y = keynesianMultiplier(p) * (A - p.b * i);
    // The central bank supplies the nominal money that clears the money market at ī.
    M = p.P * moneyDemand(p, Y, i);
  } else {
    const m = realMoney(p);
    const D = determinant(p);
    Y = (p.h * A + p.b * m) / D;
    i = (p.k * A - (1 - p.c) * m) / D;
    M = p.M;
  }

  const equilibrium = buildEquilibrium(p, Y, i, M);
  const values = Object.values(equilibrium);
  if (!values.every(Number.isFinite)) {
    // Defensive: validation should make this unreachable.
    return { ok: false, issues: [...inputIssues, { code: 'NON_FINITE', severity: 'error' }] };
  }

  const issues = [...inputIssues, ...equilibriumIssues(spec, equilibrium)];
  if (issues.some((x) => x.severity === 'error')) return { ok: false, issues };

  return {
    ok: true,
    value: {
      spec,
      equilibrium,
      residuals: identityResiduals(equilibrium),
      multipliers: computeMultipliers(spec),
      slopes: curveSlopes(spec),
      issues,
    },
  };
}

/** Largest absolute identity residual, used by tests and the UI consistency badge. */
export function maxResidual(r: IdentityResiduals): number {
  return Math.max(...Object.values(r).map(Math.abs));
}
