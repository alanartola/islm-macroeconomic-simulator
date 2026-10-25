import { DEFAULT_PARAMS, solve, validateSpec } from './index';
import type { EconomySpec, IssueCode, ModelParams } from './types';

function spec(params: Partial<ModelParams> = {}, extra: Partial<EconomySpec> = {}): EconomySpec {
  return { params: { ...DEFAULT_PARAMS, ...params }, regime: 'money-supply', targetRate: 5, ...extra };
}

function codes(s: EconomySpec): IssueCode[] {
  return validateSpec(s).map((x) => x.code);
}

function failsWith(s: EconomySpec, code: IssueCode) {
  const r = solve(s);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.issues.map((x) => x.code)).toContain(code);
}

describe('invalid inputs are rejected, never silently solved', () => {
  it.each([NaN, Infinity, -Infinity])('rejects non-finite parameter values (%s)', (v) => {
    failsWith(spec({ G: v }), 'NON_FINITE');
    failsWith(spec({ c: v }), 'NON_FINITE');
  });

  it('rejects a non-finite target rate under interest targeting', () => {
    failsWith(spec({}, { regime: 'interest-target', targetRate: NaN }), 'NON_FINITE');
  });

  it.each([1, 1.2, -0.1])('rejects an MPC outside [0, 1): c = %s', (c) => {
    failsWith(spec({ c }), 'MPC_OUT_OF_RANGE');
  });

  it('accepts c = 0 (multiplier 1)', () => {
    expect(solve(spec({ c: 0 })).ok).toBe(true);
  });

  it('rejects negative interest sensitivities', () => {
    failsWith(spec({ b: -1 }), 'NEGATIVE_SENSITIVITY');
    failsWith(spec({ h: -1 }), 'NEGATIVE_SENSITIVITY');
  });

  it('rejects k ≤ 0, P ≤ 0 and M ≤ 0', () => {
    failsWith(spec({ k: 0 }), 'NON_POSITIVE_K');
    failsWith(spec({ P: 0 }), 'NON_POSITIVE_PRICE');
    failsWith(spec({ P: -1 }), 'NON_POSITIVE_PRICE');
    failsWith(spec({ M: 0 }), 'NON_POSITIVE_MONEY');
  });

  it('does not require M > 0 under interest targeting (M is endogenous)', () => {
    expect(codes(spec({ M: 0 }, { regime: 'interest-target', targetRate: 5 }))).not.toContain('NON_POSITIVE_MONEY');
  });

  it('rejects negative autonomous components and government purchases', () => {
    failsWith(spec({ C0: -1 }), 'NEGATIVE_AUTONOMOUS');
    failsWith(spec({ I0: -1 }), 'NEGATIVE_AUTONOMOUS');
    failsWith(spec({ G: -1 }), 'NEGATIVE_GOVERNMENT');
  });

  it('rejects the degenerate system b = h = 0 (division by zero in D)', () => {
    failsWith(spec({ b: 0, h: 0 }), 'DEGENERATE_SYSTEM');
  });

  it('allows b = h = 0 under interest targeting (no determinant involved)', () => {
    expect(solve(spec({ b: 0, h: 0 }, { regime: 'interest-target', targetRate: 5 })).ok).toBe(true);
  });

  it('rejects equilibria with non-positive output', () => {
    failsWith(spec({ M: 1, G: 0, I0: 0, C0: 0, T: 400 }), 'NON_POSITIVE_OUTPUT');
  });
});

describe('admissible but implausible parametrisations are flagged', () => {
  it('flags negative net taxes as a warning but still solves', () => {
    const r = solve(spec({ T: -50 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.issues.map((x) => x.code)).toContain('NEGATIVE_TAXES');
  });

  it('flags a negative equilibrium interest rate (zero lower bound not modelled)', () => {
    const r = solve(spec({ M: 1500 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.equilibrium.i).toBeLessThan(0);
      expect(r.value.issues.map((x) => x.code)).toContain('NEGATIVE_RATE');
    }
  });

  it('flags negative investment', () => {
    const r = solve(spec({ I0: 20, b: 40, G: 500 }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.equilibrium.I).toBeLessThan(0);
      expect(r.value.issues.map((x) => x.code)).toContain('NEGATIVE_INVESTMENT');
    }
  });

  it('flags a very high MPC, vertical curves and the near-liquidity-trap region', () => {
    expect(codes(spec({ c: 0.97 }))).toContain('HIGH_MPC');
    expect(codes(spec({ b: 0 }))).toContain('VERTICAL_IS');
    expect(codes(spec({ h: 0 }))).toContain('VERTICAL_LM');
    expect(codes(spec({ h: 5000 }))).toContain('NEAR_LIQUIDITY_TRAP');
  });

  it('the default calibration is clean (no warnings)', () => {
    const r = solve(spec());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.issues).toEqual([]);
  });
});

describe('extreme but valid parameters never produce non-finite results', () => {
  const extremes: Partial<ModelParams>[] = [
    { c: 0.999 },
    { h: 1e9 },
    { b: 1e9 },
    { k: 1e-9 },
    { k: 1e6, M: 1e12 },
    { P: 1e-6 },
    { P: 1e6, M: 1e9 },
    { b: 0 },
    { h: 0 },
    { G: 1e12 },
  ];
  it.each(extremes)('%o', (p) => {
    const r = solve(spec(p));
    if (r.ok) {
      for (const v of Object.values(r.value.equilibrium)) expect(Number.isFinite(v)).toBe(true);
      for (const v of Object.values(r.value.multipliers)) expect(Number.isFinite(v)).toBe(true);
    } else {
      expect(r.issues.length).toBeGreaterThan(0);
      expect(r.issues.some((x) => x.severity === 'error')).toBe(true);
    }
  });
});
