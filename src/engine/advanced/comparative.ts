import { change, type Change } from '../comparative';
import { alphaOf, isOutput } from './model';
import type { AdvEquilibrium, AdvParamKey, AdvSolved } from './types';

export type AdvEqKey = keyof AdvEquilibrium;

export interface AdvComparison {
  changes: Record<AdvEqKey, Change>;
  paramChanges: Partial<Record<AdvParamKey, Change>>;
  targetRateChange: Change | null;
  /** Horizontal IS displacement at the initial rate: Y_IS,1(i₀) − Y₀. */
  isShiftAtInitialRate: number;
  /** Movement along the new IS caused by Δi: −α₁ b₁ Δi (exact). */
  interestRateEffect: number;
  /** Discrete effective multiplier ΔY/ΔG (only when G is the sole exogenous change). */
  effectiveFiscalMultiplier: number | null;
  /** Discrete effective multiplier ΔY/Δ(M/P) (only when M is the sole exogenous change). */
  effectiveMonetaryMultiplier: number | null;
}

const KEYS: readonly AdvParamKey[] = ['C0', 'c', 'T0', 't', 'TR', 'I0', 'b', 'G', 'M', 'P', 'k', 'h', 'L0', 'a', 'iMin', 'iFloor'];

export function compareAdvanced(s0: AdvSolved, s1: AdvSolved): AdvComparison {
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const p0 = s0.spec.params;
  const p1 = s1.spec.params;
  const changes = Object.fromEntries((Object.keys(q0) as AdvEqKey[]).map((k) => [k, change(q0[k], q1[k])])) as Record<AdvEqKey, Change>;
  const paramChanges: Partial<Record<AdvParamKey, Change>> = {};
  for (const k of KEYS) {
    if (k === 'M' && s1.spec.regime === 'rate') continue;
    if (Math.abs(p1[k] - p0[k]) > 1e-12) paramChanges[k] = change(p0[k], p1[k]);
  }
  const targetRateChange =
    s0.spec.regime === 'rate' && s1.spec.regime === 'rate' && Math.abs(s1.spec.targetRate - s0.spec.targetRate) > 1e-12
      ? change(s0.spec.targetRate, s1.spec.targetRate)
      : null;
  const onlyChange = (k: AdvParamKey) => targetRateChange === null && Object.keys(paramChanges).length === 1 && paramChanges[k] !== undefined;
  const dY = q1.Y - q0.Y;
  const dG = p1.G - p0.G;
  const dm = s1.spec.regime === 'money' && s0.spec.regime === 'money' ? q1.realMoney - q0.realMoney : 0;
  return {
    changes,
    paramChanges,
    targetRateChange,
    isShiftAtInitialRate: isOutput(p1, q0.i) - q0.Y,
    interestRateEffect: -alphaOf(p1) * p1.b * (q1.i - q0.i),
    effectiveFiscalMultiplier: onlyChange('G') && Math.abs(dG) > 1e-12 ? dY / dG : null,
    effectiveMonetaryMultiplier: onlyChange('M') && Math.abs(dm) > 1e-12 ? dY / dm : null,
  };
}
