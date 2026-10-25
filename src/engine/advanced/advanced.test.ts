import { DEFAULT_PARAMS, solve } from '../index';
import {
  ADV_DEFAULTS,
  ADV_PRESETS,
  advSpec,
  alphaOf,
  compareAdvanced,
  lmOutput,
  lmRate,
  maxAdvResidual,
  solveAdvanced,
  tangentLinearSpec,
  type AdvParams,
  type AdvSolved,
  type AdvSpec,
  type LMSpec,
} from './index';

function ok(spec: AdvSpec): AdvSolved {
  const r = solveAdvanced(spec);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}
const Y = (spec: AdvSpec) => ok(spec).equilibrium.Y;

describe('Module B — reduction to Module A', () => {
  it('with t = 0, TR = 0, T₀ = T and L₀ = 0 the linear model reproduces Module A exactly', () => {
    const p = DEFAULT_PARAMS;
    const a = ok(advSpec({ C0: p.C0, c: p.c, T0: p.T, t: 0, TR: 0, I0: p.I0, b: p.b, G: p.G, M: p.M, P: p.P, k: p.k, h: p.h, L0: 0 }, 'linear'));
    const r = solve({ params: p, regime: 'money-supply', targetRate: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(a.equilibrium.Y).toBeCloseTo(r.value.equilibrium.Y, 9);
      expect(a.equilibrium.i).toBeCloseTo(r.value.equilibrium.i, 12);
      expect(a.multipliers.dY_dG).toBeCloseTo(r.value.multipliers.dY_dG, 12);
      expect(a.multipliers.dY_dRealMoney).toBeCloseTo(r.value.multipliers.dY_dRealMoney, 12);
    }
  });
});

describe('Module B — hand-checked default equilibrium', () => {
  it.each(['nonlinear', 'linear', 'floor'] as LMSpec[])('%s LM: Y* = 2000, i* = 5', (lm) => {
    const s = ok(advSpec({}, lm));
    expect(s.equilibrium.Y).toBeCloseTo(2000, 7);
    expect(s.equilibrium.i).toBeCloseTo(5, 9);
    expect(s.equilibrium.alpha).toBeCloseTo(2.5, 12);
    expect(s.equilibrium.A).toBeCloseTo(925, 12);
    expect(s.equilibrium.T).toBeCloseTo(500, 7);
    expect(s.equilibrium.Sg).toBeCloseTo(50, 7);
    expect(s.floorBinding).toBe(false);
  });

  it('the non-linear equilibrium is computed with Brent and reported residuals are tiny', () => {
    const s = ok(advSpec());
    expect(s.diagnostics.method).toBe('brent');
    expect(s.diagnostics.iterations).toBeGreaterThan(0);
    expect(s.diagnostics.residual).toBeLessThan(1e-8);
    expect(maxAdvResidual(s.residuals)).toBeLessThan(1e-8);
  });

  it('decomposes money demand into transactional (kY) and speculative (a/(i − i_min)) parts', () => {
    const e = ok(advSpec()).equilibrium;
    expect(e.transactionDemand).toBeCloseTo(1000, 7);
    expect(e.speculativeDemand).toBeCloseTo(100, 6);
    expect(e.moneyDemand).toBeCloseTo(e.realMoney, 8);
  });

  it('is in the intermediate zone with crowding-out share 1.25/2.25', () => {
    const s = ok(advSpec());
    expect(s.zone).toBe('intermediate');
    expect(s.multipliers.lmSlope).toBeCloseTo(0.02, 12);
    expect(s.multipliers.crowdingOutShare).toBeCloseTo(1.25 / 2.25, 9);
    expect(s.multipliers.dY_dG).toBeCloseTo(2.5 / 2.25, 9);
  });
});

describe('Module B — accounting identities with taxes and transfers', () => {
  const cases: [Partial<AdvParams>, LMSpec][] = [
    [{}, 'nonlinear'],
    [{ t: 0.4, TR: 300, T0: 50 }, 'nonlinear'],
    [{ M: 1600 }, 'nonlinear'],
    [{ M: 780 }, 'nonlinear'],
    [{}, 'linear'],
    [{ M: 1500 }, 'floor'],
  ];
  it.each(cases)('Y = C + I + G, S = I, M/P = L (+ idle balances) for %o (%s)', (p, lm) => {
    const s = ok(advSpec(p, lm));
    expect(maxAdvResidual(s.residuals)).toBeLessThan(1e-7);
    const e = s.equilibrium;
    expect(e.Sg).toBeCloseTo(e.T - e.G - e.TR, 9);
    expect(e.Yd).toBeCloseTo(e.Y - e.T + e.TR, 9);
  });
});

describe('Module B — multipliers', () => {
  it('α = 1/[1 − c(1 − t)] and higher t lowers every fiscal multiplier (automatic stabiliser)', () => {
    expect(alphaOf({ ...ADV_DEFAULTS, t: 0.25 })).toBeCloseTo(2.5, 12);
    // Linear LM (constant slope) isolates the stabiliser from changes of LM region.
    const lo = ok(advSpec({ t: 0 }, 'linear')).multipliers;
    const hi = ok(advSpec({ t: 0.4 }, 'linear')).multipliers;
    expect(hi.alpha).toBeLessThan(lo.alpha);
    expect(hi.dY_dG).toBeLessThan(lo.dY_dG);
  });

  it('a negative investment shock moves output by less when taxes are proportional', () => {
    const drop = (t: number) => Y(advSpec({ t, I0: 250 }, 'linear')) - Y(advSpec({ t }, 'linear'));
    expect(Math.abs(drop(0.3))).toBeLessThan(Math.abs(drop(0)));
  });

  it('under the non-linear LM a lower t can raise output so much that the economy enters the classical region', () => {
    // Not a bug: the larger multiplier pushes Y towards the LM asymptote m/k,
    // where crowding out is almost complete. Stabiliser comparisons must hold the LM region fixed.
    expect(ok(advSpec({ t: 0 })).zone).toBe('classical');
    expect(ok(advSpec({ t: 0.25 })).zone).toBe('intermediate');
  });

  it.each(['nonlinear', 'linear'] as LMSpec[])('local derivatives match central finite differences (%s)', (lm) => {
    const base = advSpec({}, lm);
    const m = ok(base).multipliers;
    const eps = 1e-3;
    const fd = (patch: (p: AdvParams, s: number) => Partial<AdvParams>, out: 'Y' | 'i' = 'Y') => {
      const up = ok(advSpec(patch(base.params, eps), lm)).equilibrium[out];
      const dn = ok(advSpec(patch(base.params, -eps), lm)).equilibrium[out];
      return (up - dn) / (2 * eps);
    };
    expect(fd((p, s) => ({ G: p.G + s }))).toBeCloseTo(m.dY_dG, 5);
    expect(fd((p, s) => ({ TR: p.TR + s }))).toBeCloseTo(m.dY_dTR, 5);
    expect(fd((p, s) => ({ T0: p.T0 + s }))).toBeCloseTo(m.dY_dT0, 5);
    expect(fd((p, s) => ({ t: p.t + s * 1e-3 })) / 1e-3).toBeCloseTo(m.dY_dt, 0);
    expect(fd((p, s) => ({ M: p.M + s }))).toBeCloseTo(m.dY_dRealMoney, 5);
    expect(fd((p, s) => ({ G: p.G + s }), 'i')).toBeCloseTo(m.di_dG, 7);
    expect(fd((p, s) => ({ M: p.M + s }), 'i')).toBeCloseTo(m.di_dRealMoney, 7);
  });

  it('the IS-LM fiscal multiplier is bounded by the simple multiplier', () => {
    for (const M of [700, 900, 1100, 1400, 2000]) {
      const m = ok(advSpec({ M })).multipliers;
      expect(m.dY_dG).toBeGreaterThan(0);
      expect(m.dY_dG).toBeLessThanOrEqual(m.alpha + 1e-12);
    }
  });
});

describe('Module B — LM regions (non-linear money demand)', () => {
  it('the LM slope rises monotonically with Y and approaches i_min as m − kY grows', () => {
    const spec = advSpec();
    const rates = [0, 500, 1000, 1500, 2000, 2150].map((y) => lmRate(spec, y)!);
    for (let j = 1; j < rates.length; j += 1) expect(rates[j]!).toBeGreaterThan(rates[j - 1]!);
    expect(lmRate(spec, -1e7)!).toBeCloseTo(ADV_DEFAULTS.iMin, 3);
    expect(lmRate(spec, 2200)).toBeNull(); // outside the domain m − kY > 0
    expect(lmOutput(spec, 0.5)).toBeNull(); // i ≤ i_min
  });

  it('trap region (M = 1600): crowding-out share < 10 %, monetary expansion weak, fiscal strong', () => {
    const s = ok(advSpec({ M: 1600 }));
    expect(s.zone).toBe('trap');
    expect(s.equilibrium.i).toBeCloseTo(1.8, 8);
    const dYm = Y(advSpec({ M: 1800 })) - s.equilibrium.Y;
    const dYg = Y(advSpec({ M: 1600, G: 425 })) - s.equilibrium.Y;
    expect(dYm).toBeGreaterThan(0);
    expect(dYm).toBeLessThan(0.1 * 200 * (1 / ADV_DEFAULTS.k)); // far below the classical Δm/k
    expect(dYg).toBeGreaterThan(0.9 * 2.5 * 100);
  });

  it('classical region (M = 780): crowding-out share > 90 %, fiscal weak, monetary strong', () => {
    const s = ok(advSpec({ M: 780 }));
    expect(s.zone).toBe('classical');
    const dYg = Y(advSpec({ M: 780, G: 425 })) - s.equilibrium.Y;
    const dYm = Y(advSpec({ M: 980 })) - s.equilibrium.Y;
    expect(dYg).toBeLessThan(0.1 * 2.5 * 100);
    expect(dYm).toBeGreaterThan(0.75 * 200 / ADV_DEFAULTS.k);
  });

  it('the equilibrium is unique: IS − LM is strictly decreasing in i', () => {
    const p = ADV_DEFAULTS;
    const g = (i: number) => alphaOf(p) * (925 - p.b * i) - (p.M - p.a / (i - p.iMin)) / p.k;
    let prev = g(1.0001);
    for (let i = 1.01; i < 40; i += 0.37) {
      const v = g(i);
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });
});

describe('Module B — formal lower bound (floor specification)', () => {
  it('binds with ample money: i = i_floor, idle balances absorb the excess, monetary policy has no effect', () => {
    const s0 = ok(advSpec({ M: 1500 }, 'floor'));
    const s1 = ok(advSpec({ M: 1700 }, 'floor'));
    expect(s0.floorBinding).toBe(true);
    expect(s0.zone).toBe('floor');
    expect(s0.equilibrium.i).toBe(ADV_DEFAULTS.iFloor);
    expect(s1.equilibrium.Y).toBeCloseTo(s0.equilibrium.Y, 12);
    expect(s1.equilibrium.idleBalances - s0.equilibrium.idleBalances).toBeCloseTo(200, 9);
    expect(s0.multipliers.dY_dRealMoney).toBe(0);
    expect(s0.issues.map((x) => x.code)).toContain('FLOOR_BINDING');
  });

  it('fiscal policy at a binding floor has the full constant-rate multiplier α', () => {
    const d = Y(advSpec({ M: 1500, G: 425 }, 'floor')) - Y(advSpec({ M: 1500 }, 'floor'));
    expect(d).toBeCloseTo(2.5 * 100, 9);
  });

  it('when it does not bind, the floor model equals the linear model', () => {
    const a = ok(advSpec({}, 'floor')).equilibrium;
    const b = ok(advSpec({}, 'linear')).equilibrium;
    expect(a.Y).toBeCloseTo(b.Y, 12);
    expect(a.i).toBeCloseTo(b.i, 12);
  });

  it('distinguishes the asymptotic (non-linear) trap from the binding floor', () => {
    const trap = ok(advSpec({ M: 1600 }));
    expect(trap.zone).toBe('trap');
    expect(trap.multipliers.dY_dRealMoney).toBeGreaterThan(0); // weak but not zero
  });
});

describe('Module B — interest-rate target (monetary accommodation)', () => {
  it('keeps i at ī, supplies M endogenously and yields the constant-rate multiplier', () => {
    const s0 = ok(advSpec({}, 'nonlinear', 'rate', 5));
    const s1 = ok(advSpec({ G: 375 }, 'nonlinear', 'rate', 5));
    expect(s0.equilibrium.M).toBeCloseTo(1100, 7);
    expect(s1.equilibrium.i).toBe(5);
    expect(s1.equilibrium.Y - s0.equilibrium.Y).toBeCloseTo(125, 9);
    expect(s1.equilibrium.M - s0.equilibrium.M).toBeCloseTo(0.5 * 125, 9);
    expect(s0.zone).toBe('pegged');
  });

  it('rejects a target at or below i_min (non-linear) or below the floor', () => {
    const r = solveAdvanced(advSpec({}, 'nonlinear', 'rate', 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('TARGET_BELOW_MINIMUM');
    expect(solveAdvanced(advSpec({}, 'floor', 'rate', 0.1)).ok).toBe(false);
  });
});

describe('Module B — robustness', () => {
  it.each([
    [{ c: 1 }, 'MPC_OUT_OF_RANGE'],
    [{ t: 1 }, 'TAX_RATE_OUT_OF_RANGE'],
    [{ t: -0.1 }, 'TAX_RATE_OUT_OF_RANGE'],
    [{ a: 0 }, 'NON_POSITIVE_A'],
    [{ k: 0 }, 'NON_POSITIVE_K'],
    [{ TR: -1 }, 'NEGATIVE_TRANSFERS'],
    [{ G: Number.NaN }, 'NON_FINITE'],
  ] as [Partial<AdvParams>, string][])('rejects %o with %s', (p, code) => {
    const r = solveAdvanced(advSpec(p));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain(code);
  });

  it('reports NO_EQUILIBRIUM when the vertical IS lies beyond the LM asymptote Y = m/k', () => {
    const r = solveAdvanced(advSpec({ b: 0, M: 500 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('NO_EQUILIBRIUM');
  });

  it('rejects the degenerate linear system b = h = 0', () => {
    expect(solveAdvanced(advSpec({ b: 0, h: 0 }, 'linear')).ok).toBe(false);
  });

  it('extreme valid inputs never produce non-finite results', () => {
    for (const p of [{ a: 1e-6 }, { a: 1e6 }, { M: 1e6 }, { M: 5 }, { b: 1e4 }, { t: 0.99 }, { c: 0.999 }, { k: 1e-4 }] as Partial<AdvParams>[]) {
      const r = solveAdvanced(advSpec(p));
      if (r.ok) {
        for (const v of Object.values(r.value.equilibrium)) expect(Number.isFinite(v)).toBe(true);
        expect(maxAdvResidual(r.value.residuals)).toBeLessThan(1e-5 * Math.max(1, r.value.equilibrium.Y));
      } else {
        expect(r.issues.some((x) => x.severity === 'error')).toBe(true);
      }
    }
  });
});

describe('Module B — comparative statics and presets', () => {
  it('exact output decomposition for a fiscal expansion under the non-linear LM', () => {
    const c = compareAdvanced(ok(advSpec()), ok(advSpec({ G: 375 })));
    expect(c.isShiftAtInitialRate).toBeCloseTo(125, 9);
    expect(c.isShiftAtInitialRate + c.interestRateEffect).toBeCloseTo(c.changes.Y.abs, 8);
    expect(c.effectiveFiscalMultiplier).toBeGreaterThan(0);
    // Discrete multiplier lies between the local derivatives at E₀ and E₁ (concave response).
    expect(c.effectiveFiscalMultiplier!).toBeLessThan(ok(advSpec()).multipliers.dY_dG);
  });

  it('every preset produces solvable E₀ and E₁', () => {
    for (const pr of ADV_PRESETS) {
      const base = advSpec(pr.base, pr.lm, pr.regime, pr.targetRate ?? 5);
      const shocked = { ...base, params: { ...base.params, ...pr.shock } };
      expect(solveAdvanced(base).ok, pr.id).toBe(true);
      expect(solveAdvanced(shocked).ok, pr.id).toBe(true);
    }
  });

  it('the tangent linear LM passes through E₀ with the same slope, and differs for large shocks', () => {
    const s = ok(advSpec());
    const lin = tangentLinearSpec(s.spec, s.equilibrium.Y, s.equilibrium.i);
    const sl = ok(lin);
    expect(sl.equilibrium.Y).toBeCloseTo(2000, 7);
    expect(sl.equilibrium.i).toBeCloseTo(5, 9);
    expect(sl.multipliers.lmSlope).toBeCloseTo(s.multipliers.lmSlope, 12);
    const big = 500;
    const dNon = Y({ ...s.spec, params: { ...s.spec.params, M: s.spec.params.M + big } }) - 2000;
    const dLin = Y({ ...lin, params: { ...lin.params, M: lin.params.M + big } }) - 2000;
    expect(Math.abs(dNon - dLin)).toBeGreaterThan(10);
  });
});
