import {
  DEFAULT_PARAMS,
  autonomousSpending,
  computeMultipliers,
  determinant,
  isOutputAt,
  isRateAt,
  lmOutputAt,
  lmRateAt,
  maxResidual,
  solve,
} from './index';
import type { EconomySpec, ModelParams, SolvedEconomy } from './types';

const TOL = 1e-9;

function spec(params: Partial<ModelParams> = {}, extra: Partial<EconomySpec> = {}): EconomySpec {
  return { params: { ...DEFAULT_PARAMS, ...params }, regime: 'money-supply', targetRate: 5, ...extra };
}

function solved(s: EconomySpec): SolvedEconomy {
  const r = solve(s);
  if (!r.ok) throw new Error(`Unexpected solve failure: ${JSON.stringify(r.issues)}`);
  return r.value;
}

describe('equilibrium resolution — analytical regression cases', () => {
  it('reproduces the hand-computed default equilibrium (Y* = 1900, i* = 5)', () => {
    const e = solved(spec()).equilibrium;
    expect(e.A).toBeCloseTo(600, 12);
    expect(e.Y).toBeCloseTo(1900, 9);
    expect(e.i).toBeCloseTo(5, 12);
    expect(e.C).toBeCloseTo(1475, 9);
    expect(e.I).toBeCloseTo(175, 9);
    expect(e.Yd).toBeCloseTo(1700, 9);
    expect(e.Sp).toBeCloseTo(225, 9);
    expect(e.Sg).toBeCloseTo(-50, 9);
    expect(e.S).toBeCloseTo(175, 9);
    expect(e.realMoney).toBeCloseTo(700, 12);
  });

  it('solves a case with P ≠ 1 and non-integer solution (exact fractions)', () => {
    // A = 100 − 0.8·100 + 200 + 200 = 420; m = 600/1.5 = 400; D = 40·0.2 + 20·0.25 = 13
    const p = { C0: 100, c: 0.8, T: 100, I0: 200, b: 20, G: 200, M: 600, P: 1.5, k: 0.25, h: 40 };
    const e = solved(spec(p)).equilibrium;
    expect(e.Y).toBeCloseTo(24800 / 13, 9);
    expect(e.i).toBeCloseTo(25 / 13, 12);
    expect(e.realMoney).toBeCloseTo(400, 12);
  });

  it('solves the classical case h = 0 (vertical LM): Y = m/k', () => {
    const e = solved(spec({ h: 0 })).equilibrium;
    expect(e.Y).toBeCloseTo(1400, 9);
    expect(e.i).toBeCloseTo(10, 12);
  });

  it('solves the case b = 0 (vertical IS): Y = αA, rate set by LM', () => {
    const e = solved(spec({ b: 0 })).equilibrium;
    expect(e.Y).toBeCloseTo(2400, 9);
    expect(e.i).toBeCloseTo((0.5 * 2400 - 700) / 50, 12);
    expect(e.I).toBeCloseTo(300, 12);
  });

  it('the solution lies simultaneously on the IS and the LM curve', () => {
    const s = spec({ G: 310, M: 820, c: 0.6, b: 12, h: 80 });
    const e = solved(s).equilibrium;
    expect(isOutputAt(s.params, e.i)).toBeCloseTo(e.Y, 9);
    expect(lmOutputAt(s.params, e.i)).toBeCloseTo(e.Y, 9);
    expect(isRateAt(s.params, e.Y)).toBeCloseTo(e.i, 9);
    expect(lmRateAt(s.params, e.Y)).toBeCloseTo(e.i, 9);
  });

  it('matches the closed-form expressions Y* = (hA + bm)/D and i* = (kA − (1−c)m)/D', () => {
    const p: ModelParams = { C0: 150, c: 0.7, T: 180, I0: 260, b: 18, G: 300, M: 950, P: 1.2, k: 0.4, h: 65 };
    const A = autonomousSpending(p);
    const D = determinant(p);
    const m = p.M / p.P;
    const e = solved(spec(p)).equilibrium;
    expect(e.Y).toBeCloseTo((p.h * A + p.b * m) / D, 9);
    expect(e.i).toBeCloseTo((p.k * A - (1 - p.c) * m) / D, 12);
  });
});

describe('accounting identities', () => {
  const cases: Partial<ModelParams>[] = [
    {},
    { G: 400, T: 100 },
    { c: 0.9, b: 5, h: 300 },
    { M: 1200, P: 1.4, k: 0.3 },
    { h: 0 },
    { b: 0 },
  ];
  it.each(cases)('Y = C + I + G, M/P = L(Y,i), S = I hold for %o', (p) => {
    const r = solved(spec(p));
    expect(maxResidual(r.residuals)).toBeLessThan(1e-8);
  });

  it('national saving equals investment and decomposes into private and public saving', () => {
    const e = solved(spec({ G: 320, T: 260 })).equilibrium;
    expect(e.S).toBeCloseTo(e.Sp + e.Sg, 12);
    expect(e.S).toBeCloseTo(e.I, 9);
    expect(e.Sg).toBeCloseTo(e.T - e.G, 12);
  });

  it('holds the identities under the interest-target regime as well', () => {
    const r = solved(spec({ G: 300 }, { regime: 'interest-target', targetRate: 3.5 }));
    expect(maxResidual(r.residuals)).toBeLessThan(1e-8);
  });
});

describe('multipliers', () => {
  it('match the closed-form values at the default calibration', () => {
    const m = computeMultipliers(spec());
    expect(m.keynesian).toBeCloseTo(4, 12);
    expect(m.dY_dG).toBeCloseTo(2, 12);
    expect(m.dY_dT).toBeCloseTo(-1.5, 12);
    expect(m.dY_dRealMoney).toBeCloseTo(1, 12);
    expect(m.di_dG).toBeCloseTo(0.02, 12);
    expect(m.di_dRealMoney).toBeCloseTo(-0.01, 12);
    expect(m.dY_dBalancedBudget).toBeCloseTo(0.5, 12);
    expect(m.crowdingOutShare).toBeCloseTo(0.5, 12);
  });

  it('agree with finite differences of the solved model', () => {
    const base = spec({ c: 0.68, b: 14, h: 72, k: 0.35 });
    const m = computeMultipliers(base);
    const e0 = solved(base).equilibrium;
    const d = 1; // the model is linear, so finite differences are exact up to rounding
    const shock = (p: Partial<ModelParams>) => solved(spec({ ...base.params, ...p })).equilibrium;

    expect(shock({ G: base.params.G + d }).Y - e0.Y).toBeCloseTo(m.dY_dG * d, 8);
    expect(shock({ T: base.params.T + d }).Y - e0.Y).toBeCloseTo(m.dY_dT * d, 8);
    expect(shock({ I0: base.params.I0 + d }).Y - e0.Y).toBeCloseTo(m.dY_dI0 * d, 8);
    expect(shock({ M: base.params.M + d * base.params.P }).Y - e0.Y).toBeCloseTo(m.dY_dRealMoney * d, 8);
    expect(shock({ G: base.params.G + d }).i - e0.i).toBeCloseTo(m.di_dG * d, 10);
    expect(shock({ M: base.params.M + d * base.params.P }).i - e0.i).toBeCloseTo(m.di_dRealMoney * d, 10);
    expect(shock({ G: base.params.G + d, T: base.params.T + d }).Y - e0.Y).toBeCloseTo(m.dY_dBalancedBudget * d, 8);
  });

  it('the IS-LM fiscal multiplier never exceeds the Keynesian multiplier', () => {
    for (const h of [0, 1, 10, 50, 500, 5000]) {
      for (const b of [0, 1, 25, 200]) {
        if (b === 0 && h === 0) continue;
        const m = computeMultipliers(spec({ b, h }));
        expect(m.dY_dG).toBeLessThanOrEqual(m.keynesian + TOL);
        expect(m.dY_dG).toBeGreaterThanOrEqual(0);
        expect(m.crowdingOutShare).toBeGreaterThanOrEqual(0);
        expect(m.crowdingOutShare).toBeLessThanOrEqual(1 + TOL);
      }
    }
  });
});

describe('expected direction of policy', () => {
  it('monetary expansion lowers i, raises investment and output, leaves G and T unchanged', () => {
    const e0 = solved(spec()).equilibrium;
    const e1 = solved(spec({ M: 800 })).equilibrium;
    expect(e1.i).toBeLessThan(e0.i);
    expect(e1.I).toBeGreaterThan(e0.I);
    expect(e1.Y).toBeGreaterThan(e0.Y);
    expect(e1.C).toBeGreaterThan(e0.C);
    expect(e1.G).toBe(e0.G);
    expect(e1.Y - e0.Y).toBeCloseTo(100, 9);
    expect(e1.i - e0.i).toBeCloseTo(-1, 12);
  });

  it('monetary contraction raises i and lowers investment and output', () => {
    const e0 = solved(spec()).equilibrium;
    const e1 = solved(spec({ M: 600 })).equilibrium;
    expect(e1.i).toBeGreaterThan(e0.i);
    expect(e1.I).toBeLessThan(e0.I);
    expect(e1.Y).toBeLessThan(e0.Y);
  });

  it('fiscal expansion raises Y and i and crowds out investment', () => {
    const e0 = solved(spec()).equilibrium;
    const e1 = solved(spec({ G: 300 })).equilibrium;
    expect(e1.Y - e0.Y).toBeCloseTo(100, 9); // vs 200 under a fixed rate
    expect(e1.i - e0.i).toBeCloseTo(1, 12);
    expect(e1.I - e0.I).toBeCloseTo(-25, 9);
  });

  it('a tax cut raises output by less than an equal increase in G', () => {
    const e0 = solved(spec()).equilibrium;
    const eG = solved(spec({ G: 300 })).equilibrium;
    const eT = solved(spec({ T: 150 })).equilibrium;
    expect(eT.Y).toBeGreaterThan(e0.Y);
    expect(eT.Y - e0.Y).toBeLessThan(eG.Y - e0.Y);
    expect(eT.Y - e0.Y).toBeCloseTo(75, 9);
  });

  it('fiscal contraction lowers Y and i and crowds investment in', () => {
    const e0 = solved(spec()).equilibrium;
    const e1 = solved(spec({ G: 200 })).equilibrium;
    expect(e1.Y).toBeLessThan(e0.Y);
    expect(e1.i).toBeLessThan(e0.i);
    expect(e1.I).toBeGreaterThan(e0.I);
  });

  it('a negative autonomous investment shock lowers Y and i', () => {
    const e0 = solved(spec()).equilibrium;
    const e1 = solved(spec({ I0: 250 })).equilibrium;
    expect(e1.Y).toBeLessThan(e0.Y);
    expect(e1.i).toBeLessThan(e0.i);
    // Investment falls by less than the autonomous shock because the rate falls.
    expect(e1.I - e0.I).toBeGreaterThan(-50);
    expect(e1.I - e0.I).toBeLessThan(0);
  });
});

describe('interest sensitivity of investment (b) and money demand (h)', () => {
  it('higher b makes monetary policy more powerful and fiscal policy weaker', () => {
    const lo = computeMultipliers(spec({ b: 5 }));
    const hi = computeMultipliers(spec({ b: 100 }));
    expect(hi.dY_dRealMoney).toBeGreaterThan(lo.dY_dRealMoney);
    expect(hi.dY_dG).toBeLessThan(lo.dY_dG);
    expect(hi.crowdingOutShare).toBeGreaterThan(lo.crowdingOutShare);
  });

  it('higher h makes fiscal policy more powerful and monetary policy weaker', () => {
    const lo = computeMultipliers(spec({ h: 5 }));
    const hi = computeMultipliers(spec({ h: 500 }));
    expect(hi.dY_dG).toBeGreaterThan(lo.dY_dG);
    expect(hi.dY_dRealMoney).toBeLessThan(lo.dY_dRealMoney);
  });

  it('b determines the IS slope −(1−c)/b and h the LM slope k/h', () => {
    const r = solved(spec({ b: 40, h: 20 }));
    expect(r.slopes.is).toBeCloseTo(-0.25 / 40, 12);
    expect(r.slopes.lm).toBeCloseTo(0.5 / 20, 12);
  });

  it('limiting cases: h = 0 ⇒ full crowding out; b = 0 ⇒ monetary policy ineffective', () => {
    const classical = computeMultipliers(spec({ h: 0 }));
    expect(classical.dY_dG).toBe(0);
    expect(classical.crowdingOutShare).toBeCloseTo(1, 12);
    const vertIS = computeMultipliers(spec({ b: 0 }));
    expect(vertIS.dY_dRealMoney).toBe(0);
    expect(vertIS.dY_dG).toBeCloseTo(vertIS.keynesian, 12);
  });

  it('as h → ∞ the fiscal multiplier converges to the Keynesian multiplier', () => {
    const m = computeMultipliers(spec({ h: 1e9 }));
    expect(m.dY_dG).toBeCloseTo(m.keynesian, 5);
    expect(m.dY_dRealMoney).toBeCloseTo(0, 5);
  });
});

describe('interest-target regime', () => {
  const target = (t: number, p: Partial<ModelParams> = {}) =>
    solved(spec(p, { regime: 'interest-target', targetRate: t }));

  it('keeps the rate exactly at the target and accommodates M', () => {
    const r = target(5);
    expect(r.equilibrium.i).toBe(5);
    // At ī equal to the money-supply equilibrium rate, both regimes coincide.
    expect(r.equilibrium.Y).toBeCloseTo(1900, 9);
    expect(r.equilibrium.M).toBeCloseTo(700, 9);
    expect(r.slopes.lm).toBe(0);
  });

  it('fiscal expansion has the full Keynesian effect and requires more money', () => {
    const e0 = target(5).equilibrium;
    const e1 = target(5, { G: 300 }).equilibrium;
    expect(e1.i).toBe(5);
    expect(e1.Y - e0.Y).toBeCloseTo(200, 9);
    expect(e1.I).toBeCloseTo(e0.I, 12); // no crowding out
    expect(e1.M - e0.M).toBeCloseTo(DEFAULT_PARAMS.P * DEFAULT_PARAMS.k * 200, 9);
  });

  it('raising the target lowers investment and output: dY/dī = −αb', () => {
    const e0 = target(5).equilibrium;
    const e1 = target(6).equilibrium;
    const m = computeMultipliers(spec({}, { regime: 'interest-target', targetRate: 5 }));
    expect(e1.Y - e0.Y).toBeCloseTo(m.dY_dTargetRate, 9);
    expect(m.dY_dTargetRate).toBeCloseTo(-100, 12);
    expect(e1.I - e0.I).toBeCloseTo(-25, 9);
    expect(e1.M).toBeLessThan(e0.M);
  });

  it('ignores the exogenous M parameter (it is endogenous)', () => {
    const a = target(4, { M: 1 }).equilibrium;
    const b = target(4, { M: 99999 }).equilibrium;
    expect(a.Y).toBe(b.Y);
    expect(a.M).toBe(b.M);
  });

  it('rejects a target at which the required money stock would be non-positive', () => {
    // Y = 4·(600 − 25·12.5) = 1150 > 0, but M = P·(0.5·1150 − 50·12.5) = −50 < 0.
    const r = solve(spec({}, { regime: 'interest-target', targetRate: 12.5 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('INFEASIBLE_TARGET');
  });

  it('is consistent with the money-supply regime: pegging at i* reproduces E*', () => {
    const base = spec({ G: 280, M: 760, c: 0.7 });
    const e = solved(base).equilibrium;
    const t = solved({ ...base, regime: 'interest-target', targetRate: e.i }).equilibrium;
    expect(t.Y).toBeCloseTo(e.Y, 9);
    expect(t.M).toBeCloseTo(e.M, 9);
  });
});

describe('dimensional coherence', () => {
  it('is homogeneous of degree 1 in all bn-denominated quantities (Y scales, i does not)', () => {
    const lambda = 3.7;
    const p = DEFAULT_PARAMS;
    const scaled: ModelParams = {
      ...p,
      C0: p.C0 * lambda, T: p.T * lambda, I0: p.I0 * lambda, G: p.G * lambda, M: p.M * lambda,
      b: p.b * lambda, h: p.h * lambda,
    };
    const e = solved(spec()).equilibrium;
    const s = solved(spec(scaled)).equilibrium;
    expect(s.Y).toBeCloseTo(e.Y * lambda, 8);
    expect(s.i).toBeCloseTo(e.i, 12);
  });

  it('changing the interest-rate unit (pp → decimal) with b, h rescaled gives the same real allocation', () => {
    const p = DEFAULT_PARAMS;
    const e = solved(spec()).equilibrium;
    // If i is measured as a decimal (0.05), b and h must be expressed per unit, i.e. ×100.
    const d = solved(spec({ b: p.b * 100, h: p.h * 100 })).equilibrium;
    expect(d.Y).toBeCloseTo(e.Y, 8);
    expect(d.i * 100).toBeCloseTo(e.i, 10);
  });

  it('doubling M and P together leaves the real equilibrium unchanged', () => {
    const e = solved(spec()).equilibrium;
    const d = solved(spec({ M: DEFAULT_PARAMS.M * 2, P: DEFAULT_PARAMS.P * 2 })).equilibrium;
    expect(d.Y).toBeCloseTo(e.Y, 9);
    expect(d.i).toBeCloseTo(e.i, 12);
  });
});
