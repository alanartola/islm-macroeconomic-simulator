import type { AdvParams, AdvRegime, AdvSpec, LMSpec } from './types';

/**
 * HYPOTHETICAL calibration of Module B, chosen so that every specification has
 * a hand-checkable initial equilibrium Y* = 2000, i* = 5:
 *
 *   α = 1/[1 − 0.8(1 − 0.25)] = 2.5
 *   A = 200 − 0.8·0 + 0.8·125 + 300 + 325 = 925
 *   IS at i = 5: Y = 2.5 (925 − 25·5) = 2000
 *   non-linear LM: m − kY = 1100 − 1000 = 100 = a/(i − i_min) = 400/4  ⇒ i = 5
 *   linear LM (tangent at E₀): h = k/s = 0.5/0.02 = 25, L₀ = m − kY + h i = 225
 *
 * Crowding-out share at E₀: αbs/(1 + αbs) with s = k(i − i_min)²/a = 0.02 →
 * 1.25/2.25 ≈ 55.6 % (intermediate zone). Not an estimate of any economy.
 */
export const ADV_DEFAULTS: Readonly<AdvParams> = Object.freeze({
  C0: 200,
  c: 0.8,
  T0: 0,
  t: 0.25,
  TR: 125,
  I0: 300,
  b: 25,
  G: 325,
  M: 1100,
  P: 1,
  k: 0.5,
  h: 25,
  L0: 225,
  a: 400,
  iMin: 1,
  iFloor: 0.5,
});

export function advSpec(params: Partial<AdvParams> = {}, lm: LMSpec = 'nonlinear', regime: AdvRegime = 'money', targetRate = 5): AdvSpec {
  return { params: { ...ADV_DEFAULTS, ...params }, lm, regime, targetRate };
}

export type AdvPresetId =
  | 'B1' // fiscal expansion with proportional taxes
  | 'B2' // higher transfers
  | 'B3' // lower marginal propensity to consume
  | 'B4' // negative investment shock
  | 'B5' // liquidity-trap region: monetary expansion
  | 'B6' // liquidity-trap region: fiscal expansion
  | 'B7' // classical region: monetary expansion
  | 'B8' // classical region: fiscal expansion
  | 'B9' // simultaneous M and G expansion
  | 'B10' // higher speculative demand (liquidity preference)
  | 'B11' // binding lower bound: monetary expansion
  | 'B12' // higher marginal tax rate
  | 'B13'; // fiscal expansion with monetary accommodation (rate held constant)

export interface AdvPreset {
  id: AdvPresetId;
  lm: LMSpec;
  regime: AdvRegime;
  /** Overrides applied to the defaults to build the initial economy E₀. */
  base: Partial<AdvParams>;
  /** Changes applied to E₀ to obtain E₁. */
  shock: Partial<AdvParams>;
  targetRate?: number;
}

/**
 * Starting points for the zones (non-linear LM, other parameters at defaults):
 *   M = 1600 ⇒ i ≈ 1.8, crowding-out share ≈ 5 %  (trap region)
 *   M = 780  ⇒ i ≈ 13, crowding-out share ≈ 91 % (classical region)
 */
export const ADV_PRESETS: readonly AdvPreset[] = [
  { id: 'B1', lm: 'nonlinear', regime: 'money', base: {}, shock: { G: 375 } },
  { id: 'B2', lm: 'nonlinear', regime: 'money', base: {}, shock: { TR: 175 } },
  { id: 'B3', lm: 'nonlinear', regime: 'money', base: {}, shock: { c: 0.75 } },
  { id: 'B4', lm: 'nonlinear', regime: 'money', base: {}, shock: { I0: 250 } },
  { id: 'B5', lm: 'nonlinear', regime: 'money', base: { M: 1600 }, shock: { M: 1800 } },
  { id: 'B6', lm: 'nonlinear', regime: 'money', base: { M: 1600 }, shock: { G: 425 } },
  { id: 'B7', lm: 'nonlinear', regime: 'money', base: { M: 780 }, shock: { M: 980 } },
  { id: 'B8', lm: 'nonlinear', regime: 'money', base: { M: 780 }, shock: { G: 425 } },
  { id: 'B9', lm: 'nonlinear', regime: 'money', base: {}, shock: { M: 1200, G: 375 } },
  { id: 'B10', lm: 'nonlinear', regime: 'money', base: {}, shock: { a: 600 } },
  { id: 'B11', lm: 'floor', regime: 'money', base: { M: 1500 }, shock: { M: 1700 } },
  { id: 'B12', lm: 'nonlinear', regime: 'money', base: {}, shock: { t: 0.3 } },
  { id: 'B13', lm: 'nonlinear', regime: 'rate', base: {}, shock: { G: 375 }, targetRate: 5 },
];
