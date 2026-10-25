import { isOutputAt, keynesianMultiplier, lmOutputAt } from './islm';
import type { EndogenousKey, Equilibrium, ModelParams, ParamKey, SolvedEconomy } from './types';

/** Absolute and percentage change of one variable between E₀ and E₁. */
export interface Change {
  from: number;
  to: number;
  abs: number;
  /** Percentage change; null when the base value is (numerically) zero. */
  pct: number | null;
}

/** Tolerance below which a number is treated as zero in comparisons (bn or pp). */
export const EPS = 1e-9;

export function change(from: number, to: number): Change {
  const abs = to - from;
  const pct = Math.abs(from) < EPS ? null : (abs / Math.abs(from)) * 100;
  return { from, to, abs: Math.abs(abs) < EPS ? 0 : abs, pct: pct !== null && Math.abs(pct) < EPS ? 0 : pct };
}

export const REPORTED_VARIABLES: readonly EndogenousKey[] = [
  'Y', 'i', 'C', 'I', 'G', 'T', 'Yd', 'Sp', 'Sg', 'S', 'realMoney', 'M', 'A',
];

export type DirectionSign = -1 | 0 | 1;

export function sign(x: number, eps = 1e-7): DirectionSign {
  if (x > eps) return 1;
  if (x < -eps) return -1;
  return 0;
}

/** Description of how each curve moved between E₀ and E₁. */
export interface CurveShift {
  /**
   * Horizontal displacement of the curve measured at the initial interest
   * rate i₀ (bn): Y_curve,1(i₀) − Y_curve,0(i₀). Positive = shift to the right.
   */
  horizontal: number;
  /** Whether the slope changed (rotation) because of b, c, h or k changes. */
  rotated: boolean;
  /** Initial and final slope di/dY. */
  slopeFrom: number;
  slopeTo: number;
}

/**
 * Exact decomposition of the change in output:
 *   ΔY = [Y_IS,1(i₀) − Y₀]           (IS shift at the initial rate)
 *      + [Y_IS,1(i₁) − Y_IS,1(i₀)]   (movement along the new IS due to Δi)
 * The second term equals −α₁·b₁·Δi. When Δi > 0 after a demand expansion it is
 * the crowding-out effect; after a monetary expansion it is the rate channel.
 */
export interface OutputDecomposition {
  isShiftAtInitialRate: number;
  interestRateEffect: number;
  total: number;
}

/** Exact decomposition of ΔI = ΔI₀ − Δb·i₀ − b₁·Δi. */
export interface InvestmentDecomposition {
  autonomous: number;
  sensitivityChange: number;
  interestRate: number;
  total: number;
}

export interface Comparison {
  changes: Record<EndogenousKey, Change>;
  paramChanges: Partial<Record<ParamKey, Change>>;
  targetRateChange: Change | null;
  isShift: CurveShift;
  lmShift: CurveShift;
  output: OutputDecomposition;
  investment: InvestmentDecomposition;
  /** Δ(M/P) supplied by the central bank (endogenous under interest targeting). */
  realMoneyChange: Change;
  /** Change in money demand split into income and interest components: kΔY-type terms. */
  moneyDemand: { incomeEffect: number; interestEffect: number; parameterEffect: number };
}

const PARAM_KEYS: readonly ParamKey[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];

/** Slope comparison that is safe for ±Infinity (vertical curves). */
function slopeChanged(a: number, b: number): boolean {
  if (a === b) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) > EPS;
}

function lmHorizontalAt(e: SolvedEconomy, i: number): number {
  // Under interest targeting the LM is horizontal at ī: its "horizontal shift"
  // is not defined by a function Y(i); we report 0 and track ī changes separately.
  return e.spec.regime === 'interest-target' ? 0 : lmOutputAt(e.spec.params, i);
}

export function compare(e0: SolvedEconomy, e1: SolvedEconomy): Comparison {
  const q0: Equilibrium = e0.equilibrium;
  const q1: Equilibrium = e1.equilibrium;
  const p0: ModelParams = e0.spec.params;
  const p1: ModelParams = e1.spec.params;

  const changes = Object.fromEntries(
    (Object.keys(q0) as EndogenousKey[]).map((k) => [k, change(q0[k], q1[k])]),
  ) as Record<EndogenousKey, Change>;

  const paramChanges: Partial<Record<ParamKey, Change>> = {};
  for (const key of PARAM_KEYS) {
    if (key === 'M' && e1.spec.regime === 'interest-target') continue; // M is endogenous
    if (Math.abs(p1[key] - p0[key]) > EPS) paramChanges[key] = change(p0[key], p1[key]);
  }

  const targetRateChange =
    e0.spec.regime === 'interest-target' && e1.spec.regime === 'interest-target' &&
    Math.abs(e1.spec.targetRate - e0.spec.targetRate) > EPS
      ? change(e0.spec.targetRate, e1.spec.targetRate)
      : null;

  const i0 = q0.i;
  const i1 = q1.i;

  const isShift: CurveShift = {
    horizontal: isOutputAt(p1, i0) - isOutputAt(p0, i0),
    rotated: slopeChanged(e0.slopes.is, e1.slopes.is),
    slopeFrom: e0.slopes.is,
    slopeTo: e1.slopes.is,
  };
  const lmShift: CurveShift = {
    horizontal: lmHorizontalAt(e1, i0) - lmHorizontalAt(e0, i0),
    rotated: slopeChanged(e0.slopes.lm, e1.slopes.lm),
    slopeFrom: e0.slopes.lm,
    slopeTo: e1.slopes.lm,
  };

  const isShiftAtInitialRate = isOutputAt(p1, i0) - q0.Y;
  const interestRateEffect = -keynesianMultiplier(p1) * p1.b * (i1 - i0);

  const investment: InvestmentDecomposition = {
    autonomous: p1.I0 - p0.I0,
    sensitivityChange: -(p1.b - p0.b) * i0,
    interestRate: -p1.b * (i1 - i0),
    total: q1.I - q0.I,
  };

  // ΔL = k₁Y₁ − h₁i₁ − (k₀Y₀ − h₀i₀) = k₁ΔY − h₁Δi + (Δk·Y₀ − Δh·i₀)
  const moneyDemand = {
    incomeEffect: p1.k * (q1.Y - q0.Y),
    interestEffect: -p1.h * (i1 - i0),
    parameterEffect: (p1.k - p0.k) * q0.Y - (p1.h - p0.h) * i0,
  };

  return {
    changes,
    paramChanges,
    targetRateChange,
    isShift,
    lmShift,
    output: { isShiftAtInitialRate, interestRateEffect, total: q1.Y - q0.Y },
    investment,
    realMoneyChange: change(q0.realMoney, q1.realMoney),
    moneyDemand,
  };
}
