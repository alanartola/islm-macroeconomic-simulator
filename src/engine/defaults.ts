import type { ModelParams } from './types';

/**
 * HYPOTHETICAL baseline calibration chosen for pedagogical clarity: it yields
 * round numbers (Y* = 1900 bn, i* = 5%) and textbook-sized multipliers.
 * It is NOT an estimate of any real economy.
 *
 *   A  = 200 − 0.75·200 + 300 + 250 = 600
 *   D  = 50·0.25 + 25·0.5 = 25
 *   Y* = (50·600 + 25·700)/25 = 1900
 *   i* = (0.5·600 − 0.25·700)/25 = 5
 */
export const DEFAULT_PARAMS: Readonly<ModelParams> = Object.freeze({
  C0: 200,
  c: 0.75,
  T: 200,
  I0: 300,
  b: 25,
  G: 250,
  M: 700,
  P: 1,
  k: 0.5,
  h: 50,
});

/** Default policy-rate target (pp): equal to the default endogenous rate. */
export const DEFAULT_TARGET_RATE = 5;
