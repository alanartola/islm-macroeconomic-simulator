import { computeMultipliers } from './islm';
import { validateSpec } from './validation';
import type { EconomySpec } from './types';

export type SensitivityParam = 'b' | 'h';

export interface SensitivityPoint {
  /** Value of the swept parameter (bn per pp). */
  x: number;
  /** dY/dG — fiscal multiplier. */
  fiscal: number;
  /** dY/d(M/P) — real-money multiplier. */
  monetary: number;
  /** Fraction of the Keynesian fiscal effect lost to higher interest rates. */
  crowdingOutShare: number;
  /** IS slope −(1−c)/b, or LM slope k/h (pp per bn); null when vertical. */
  slope: number | null;
}

/**
 * Sweeps b or h over [from, to] holding every other parameter constant and
 * returns the analytical multipliers at each point (money-supply regime).
 * Points that would make the system degenerate (b = h = 0) are skipped.
 */
export function sensitivityProfile(
  spec: EconomySpec,
  param: SensitivityParam,
  from: number,
  to: number,
  steps = 60,
): SensitivityPoint[] {
  const out: SensitivityPoint[] = [];
  const n = Math.max(2, Math.floor(steps));
  for (let j = 0; j <= n; j += 1) {
    const x = from + ((to - from) * j) / n;
    const s: EconomySpec = { ...spec, regime: 'money-supply', params: { ...spec.params, [param]: x } };
    if (validateSpec(s).some((issue) => issue.severity === 'error')) continue;
    const m = computeMultipliers(s);
    const p = s.params;
    const slope = param === 'b' ? (p.b === 0 ? null : -(1 - p.c) / p.b) : p.h === 0 ? null : p.k / p.h;
    out.push({ x, fiscal: m.dY_dG, monetary: m.dY_dRealMoney, crowdingOutShare: m.crowdingOutShare, slope });
  }
  return out;
}
