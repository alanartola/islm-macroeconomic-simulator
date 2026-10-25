import type { EconomySpec, ParamKey, ValidationIssue } from './types';

/** h above this value (bn per pp) makes the LM curve almost flat. */
export const LIQUIDITY_TRAP_H_THRESHOLD = 2000;
/** c above this value implies a Keynesian multiplier larger than 20. */
export const HIGH_MPC_THRESHOLD = 0.95;

const PARAM_KEYS: readonly ParamKey[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];

/**
 * Validates the exogenous inputs BEFORE solving.
 *
 * Errors make the system unsolvable or economically meaningless and must block
 * the computation. Warnings/info describe admissible but special or implausible
 * parametrisations; they are reported, never silently corrected.
 */
export function validateSpec(spec: EconomySpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const p = spec.params;

  for (const key of PARAM_KEYS) {
    if (!Number.isFinite(p[key])) {
      issues.push({ code: 'NON_FINITE', severity: 'error', field: key });
    }
  }
  if (spec.regime === 'interest-target' && !Number.isFinite(spec.targetRate)) {
    issues.push({ code: 'NON_FINITE', severity: 'error', field: 'targetRate' });
  }
  // Without finite inputs no further check is meaningful.
  if (issues.length > 0) return issues;

  if (p.c < 0 || p.c >= 1) {
    issues.push({ code: 'MPC_OUT_OF_RANGE', severity: 'error', field: 'c', values: { c: p.c } });
  }
  if (p.b < 0) issues.push({ code: 'NEGATIVE_SENSITIVITY', severity: 'error', field: 'b', values: { value: p.b } });
  if (p.h < 0) issues.push({ code: 'NEGATIVE_SENSITIVITY', severity: 'error', field: 'h', values: { value: p.h } });
  if (p.k <= 0) issues.push({ code: 'NON_POSITIVE_K', severity: 'error', field: 'k', values: { k: p.k } });
  if (p.P <= 0) issues.push({ code: 'NON_POSITIVE_PRICE', severity: 'error', field: 'P', values: { P: p.P } });
  if (spec.regime === 'money-supply' && p.M <= 0) {
    issues.push({ code: 'NON_POSITIVE_MONEY', severity: 'error', field: 'M', values: { M: p.M } });
  }
  if (p.C0 < 0) issues.push({ code: 'NEGATIVE_AUTONOMOUS', severity: 'error', field: 'C0', values: { value: p.C0 } });
  if (p.I0 < 0) issues.push({ code: 'NEGATIVE_AUTONOMOUS', severity: 'error', field: 'I0', values: { value: p.I0 } });
  if (p.G < 0) issues.push({ code: 'NEGATIVE_GOVERNMENT', severity: 'error', field: 'G', values: { G: p.G } });

  // Net taxes may be negative (net transfers); admissible but unusual.
  if (p.T < 0) issues.push({ code: 'NEGATIVE_TAXES', severity: 'warning', field: 'T', values: { T: p.T } });

  // Determinant of the two-equation system under the money-supply regime:
  // D = h(1−c) + b·k. D = 0 iff b = 0 and h = 0 (both curves vertical).
  if (spec.regime === 'money-supply' && p.b === 0 && p.h === 0) {
    issues.push({ code: 'DEGENERATE_SYSTEM', severity: 'error' });
  }

  if (issues.some((x) => x.severity === 'error')) return issues;

  if (p.c > HIGH_MPC_THRESHOLD) {
    issues.push({ code: 'HIGH_MPC', severity: 'warning', field: 'c', values: { c: p.c, multiplier: 1 / (1 - p.c) } });
  }
  if (p.b === 0) issues.push({ code: 'VERTICAL_IS', severity: 'info', field: 'b' });
  if (spec.regime === 'money-supply') {
    if (p.h === 0) issues.push({ code: 'VERTICAL_LM', severity: 'info', field: 'h' });
    if (p.h >= LIQUIDITY_TRAP_H_THRESHOLD) {
      issues.push({ code: 'NEAR_LIQUIDITY_TRAP', severity: 'info', field: 'h', values: { h: p.h } });
    }
  }
  return issues;
}
