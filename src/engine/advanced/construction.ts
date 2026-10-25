import { alphaOf, autonomousOf, isOutput, lmRate, realMoneyOf, speculativeDemandOf } from './model';
import type { AdvParams, AdvSpec } from './types';

/*
 * Building blocks for the graphical derivation of IS and LM (Module C).
 * Every chart is drawn from these functions, which are defined directly from
 * the structural equations of Module B, so all panels share the same model.
 */

/** Disposable income Y − T₀ − tY + TR. */
export function disposableIncome(p: AdvParams, Y: number): number {
  return Y - p.T0 - p.t * Y + p.TR;
}

/** Consumption C(Y) = C₀ + c(Y − T₀ − tY + TR). */
export function consumptionAt(p: AdvParams, Y: number): number {
  return p.C0 + p.c * disposableIncome(p, Y);
}

/** Investment I(i) = I₀ − b i. */
export function investmentAt(p: AdvParams, i: number): number {
  return p.I0 - p.b * i;
}

/** Planned aggregate expenditure AE(Y; i) = C(Y) + I(i) + G. */
export function plannedExpenditure(p: AdvParams, Y: number, i: number): number {
  return consumptionAt(p, Y) + investmentAt(p, i) + p.G;
}

/** Injections J(i) = I(i) + G (IS four-quadrant diagram). */
export function injections(p: AdvParams, i: number): number {
  return investmentAt(p, i) + p.G;
}

/** Leakages W(Y) = Y − C(Y) = private saving + net taxes (T − TR). */
export function leakages(p: AdvParams, Y: number): number {
  return Y - consumptionAt(p, Y);
}

/** Output that equates leakages and injections: W(Y) = J ⇔ Y = α(J + C₀ − cT₀ + c·TR). */
export function outputForInjections(p: AdvParams, J: number): number {
  return alphaOf(p) * (J + p.C0 - p.c * p.T0 + p.c * p.TR);
}

/** Goods-market equilibrium of the Keynesian cross at rate i (a point on the IS). */
export function crossEquilibrium(p: AdvParams, i: number): number {
  return isOutput(p, i);
}

/** Transactions demand kY. */
export function transactionDemand(p: AdvParams, Y: number): number {
  return p.k * Y;
}

/**
 * Rate that clears the money market at output Y (a point on the LM), using the
 * speculative demand: L_s(i) = M/P − kY. Null outside the LM domain.
 */
export function lmPointForOutput(spec: AdvSpec, Y: number): number | null {
  return lmRate({ ...spec, regime: 'money' }, Y);
}

/** Speculative demand at rate i (null where undefined). */
export function speculativeAt(spec: AdvSpec, i: number): number | null {
  return speculativeDemandOf(spec, i);
}

/** Real balances available for speculative purposes at output Y: M/P − kY. */
export function speculativeBalances(p: AdvParams, Y: number): number {
  return realMoneyOf(p) - p.k * Y;
}

/**
 * Successive rounds of the multiplier process after a change ΔA in autonomous
 * spending at a constant rate: round j adds ΔA·[c(1 − t)]^j. Cumulative sums
 * converge to α·ΔA. This is the logical decomposition of the multiplier, not a
 * time path of the model.
 */
export function multiplierRounds(p: AdvParams, dA: number, n: number): number[] {
  const q = p.c * (1 - p.t);
  const out: number[] = [];
  let sum = 0;
  for (let j = 0; j < n; j += 1) {
    sum += dA * q ** j;
    out.push(sum);
  }
  return out;
}

/** Autonomous spending at rate i, A − b·i (the intercept of the AE line). */
export function aeIntercept(p: AdvParams, i: number): number {
  return autonomousOf(p) - p.b * i;
}
