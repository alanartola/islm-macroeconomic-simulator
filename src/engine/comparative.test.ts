import { DEFAULT_PARAMS, change, compare, sensitivityProfile, solve } from './index';
import type { EconomySpec, ModelParams, SolvedEconomy } from './types';

function spec(params: Partial<ModelParams> = {}, extra: Partial<EconomySpec> = {}): EconomySpec {
  return { params: { ...DEFAULT_PARAMS, ...params }, regime: 'money-supply', targetRate: 5, ...extra };
}
function solved(s: EconomySpec): SolvedEconomy {
  const r = solve(s);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}

describe('change()', () => {
  it('computes absolute and percentage variations exactly', () => {
    expect(change(1900, 2000)).toEqual({ from: 1900, to: 2000, abs: 100, pct: (100 / 1900) * 100 });
    expect(change(5, 4).pct).toBeCloseTo(-20, 12);
    expect(change(-50, -25).pct).toBeCloseTo(50, 12); // relative to |base|
  });
  it('returns pct = null when the base is zero instead of ±Infinity/NaN', () => {
    expect(change(0, 10).pct).toBeNull();
    expect(change(0, 0)).toEqual({ from: 0, to: 0, abs: 0, pct: null });
  });
});

describe('compare() — shifts and decompositions', () => {
  it('monetary expansion: LM shifts right by Δm/k, IS does not move', () => {
    const c = compare(solved(spec()), solved(spec({ M: 800 })));
    expect(c.lmShift.horizontal).toBeCloseTo(100 / 0.5, 9);
    expect(c.isShift.horizontal).toBeCloseTo(0, 12);
    expect(c.changes.Y.abs).toBeCloseTo(100, 9);
    expect(c.changes.i.abs).toBeCloseTo(-1, 12);
    expect(c.changes.Y.pct).toBeCloseTo((100 / 1900) * 100, 9);
    expect(c.paramChanges.M?.abs).toBe(100);
    // Pure movement along the IS: all of ΔY is the interest-rate channel.
    expect(c.output.isShiftAtInitialRate).toBeCloseTo(0, 9);
    expect(c.output.interestRateEffect).toBeCloseTo(100, 9);
    expect(c.investment.interestRate).toBeCloseTo(25, 9);
  });

  it('fiscal expansion: IS shifts right by αΔG; crowding out = αΔG − ΔY', () => {
    const c = compare(solved(spec()), solved(spec({ G: 300 })));
    expect(c.isShift.horizontal).toBeCloseTo(200, 9);
    expect(c.lmShift.horizontal).toBeCloseTo(0, 12);
    expect(c.output.isShiftAtInitialRate).toBeCloseTo(200, 9);
    expect(c.output.interestRateEffect).toBeCloseTo(-100, 9);
    expect(c.output.isShiftAtInitialRate + c.output.interestRateEffect).toBeCloseTo(c.output.total, 9);
    expect(c.investment.total).toBeCloseTo(-25, 9);
    expect(c.investment.interestRate).toBeCloseTo(-25, 9);
    expect(c.changes.Sg.abs).toBeCloseTo(-50, 12);
  });

  it('money-demand change decomposes into income, interest and parameter effects', () => {
    const c = compare(solved(spec()), solved(spec({ G: 300, k: 0.6 })));
    const total = c.moneyDemand.incomeEffect + c.moneyDemand.interestEffect + c.moneyDemand.parameterEffect;
    // In equilibrium L = M/P, and M/P is unchanged, so ΔL must be zero.
    expect(total).toBeCloseTo(c.realMoneyChange.abs, 9);
    expect(total).toBeCloseTo(0, 9);
  });

  it('the decompositions are exact for arbitrary simultaneous changes', () => {
    const e0 = solved(spec());
    const e1 = solved(spec({ G: 330, T: 240, M: 760, b: 31, h: 44, c: 0.71, I0: 280, k: 0.47 }));
    const c = compare(e0, e1);
    expect(c.output.isShiftAtInitialRate + c.output.interestRateEffect).toBeCloseTo(c.changes.Y.abs, 9);
    expect(c.investment.autonomous + c.investment.sensitivityChange + c.investment.interestRate)
      .toBeCloseTo(c.investment.total, 9);
    expect(c.isShift.rotated).toBe(true);
    expect(c.lmShift.rotated).toBe(true);
  });

  it('detects an IS rotation (and no LM change) when only b changes', () => {
    const c = compare(solved(spec()), solved(spec({ b: 50 })));
    expect(c.isShift.rotated).toBe(true);
    expect(c.lmShift.rotated).toBe(false);
    // The IS pivots around its i = 0 intercept (Y = αA), so at i₀ = 5 it moves left.
    expect(c.isShift.horizontal).toBeCloseTo(-4 * 25 * 5, 9);
  });

  it('records target-rate changes under interest targeting and the endogenous money response', () => {
    const e0 = solved(spec({}, { regime: 'interest-target', targetRate: 5 }));
    const e1 = solved(spec({}, { regime: 'interest-target', targetRate: 4 }));
    const c = compare(e0, e1);
    expect(c.targetRateChange?.abs).toBe(-1);
    expect(c.paramChanges.M).toBeUndefined();
    expect(c.changes.Y.abs).toBeCloseTo(100, 9);
    // Δm = kΔY − hΔi = 0.5·100 + 50·1
    expect(c.realMoneyChange.abs).toBeCloseTo(100, 9);
  });
});

describe('sensitivityProfile()', () => {
  it('fiscal multiplier decreases and monetary multiplier increases with b', () => {
    const pts = sensitivityProfile(spec(), 'b', 0, 100, 20);
    expect(pts).toHaveLength(21);
    for (let j = 1; j < pts.length; j += 1) {
      expect(pts[j]!.fiscal).toBeLessThan(pts[j - 1]!.fiscal);
      expect(pts[j]!.monetary).toBeGreaterThan(pts[j - 1]!.monetary);
    }
  });

  it('skips the degenerate point b = h = 0', () => {
    const pts = sensitivityProfile(spec({ h: 0 }), 'b', 0, 10, 10);
    expect(pts[0]!.x).toBeGreaterThan(0);
    expect(pts.every((p) => Number.isFinite(p.fiscal) && Number.isFinite(p.monetary))).toBe(true);
  });
});
