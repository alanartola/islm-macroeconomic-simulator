import { advSpec, alphaOf, multiplierGrid, policyMatrix, runPolicy, sensitivityCurve, ADV_DEFAULTS, type PolicyKind, type PolicyResult } from './index';

function ok(o: ReturnType<typeof runPolicy>): PolicyResult {
  if (!o.ok) throw new Error(JSON.stringify(o.issues));
  return o;
}

describe('Module D — fiscal policy experiments', () => {
  it('G expansion: crowding out = constant-rate ΔY − actual ΔY, positive and below α·ΔG', () => {
    const r = ok(runPolicy(advSpec(), { kind: 'G', size: 50 }));
    expect(r.constantRateDY).toBeCloseTo(alphaOf(ADV_DEFAULTS) * 50, 9);
    expect(r.crowding).toBeGreaterThan(0);
    expect(r.crowding).toBeCloseTo(r.constantRateDY - r.cmp.changes.Y.abs, 12);
    expect(r.cmp.changes.I.abs).toBeLessThan(0);
    expect(r.effectiveMultiplier!).toBeLessThan(alphaOf(ADV_DEFAULTS));
  });

  it('with monetary accommodation there is no crowding out and ΔY = α·ΔG', () => {
    const r = ok(runPolicy(advSpec(), { kind: 'Gacc', size: 50 }));
    expect(r.cmp.changes.i.abs).toBeCloseTo(0, 9);
    expect(r.cmp.changes.Y.abs).toBeCloseTo(2.5 * 50, 8);
    expect(r.crowding).toBeCloseTo(0, 8);
    expect(r.cmp.changes.M.abs).toBeGreaterThan(0);
  });

  it('tax-financed G (ΔT₀ = ΔG) has a smaller effect than debt-financed G', () => {
    const debt = ok(runPolicy(advSpec({}, 'linear'), { kind: 'G', size: 50 }));
    const tax = ok(runPolicy(advSpec({}, 'linear'), { kind: 'GT0', size: 50 }));
    expect(tax.cmp.changes.Y.abs).toBeGreaterThan(0);
    expect(tax.cmp.changes.Y.abs).toBeLessThan(debt.cmp.changes.Y.abs);
  });

  it('balanced-budget multiplier equals (1 − c)·h/D in the linear model without proportional taxes', () => {
    const spec = advSpec({ t: 0, TR: 0, T0: 200, L0: 0, h: 50 }, 'linear');
    const r = ok(runPolicy(spec, { kind: 'GT0', size: 10 }));
    const p = spec.params;
    const D = p.h * (1 - p.c) + p.b * p.k;
    expect(r.cmp.changes.Y.abs / 10).toBeCloseTo(((1 - p.c) * p.h) / D, 9);
  });

  it('transfers raise output by c times the effect of an equal increase in G (linear, local)', () => {
    const g = ok(runPolicy(advSpec({}, 'linear'), { kind: 'G', size: 10 }));
    const tr = ok(runPolicy(advSpec({}, 'linear'), { kind: 'TR', size: 10 }));
    expect(tr.cmp.changes.Y.abs).toBeCloseTo(ADV_DEFAULTS.c * g.cmp.changes.Y.abs, 9);
  });

  it('the budget balance responds to higher G by less than ΔG because revenue rises with Y', () => {
    const r = ok(runPolicy(advSpec(), { kind: 'G', size: 50 }));
    expect(r.dBudget).toBeLessThan(0);
    expect(r.dBudget).toBeGreaterThan(-50);
  });
});

describe('Module D — monetary policy experiments', () => {
  it('a rate cut under the peg raises output by α·b·|Δī| and requires more money', () => {
    const r = ok(runPolicy(advSpec(), { kind: 'rate', size: -1 }));
    expect(r.cmp.changes.Y.abs).toBeCloseTo(2.5 * 25, 9);
    expect(r.cmp.changes.M.abs).toBeGreaterThan(0);
  });

  it('a liquidity-preference increase raises the rate and lowers output', () => {
    for (const lm of ['nonlinear', 'linear'] as const) {
      const r = ok(runPolicy(advSpec({}, lm), { kind: 'liq', size: 100 }));
      expect(r.cmp.changes.i.abs).toBeGreaterThan(0);
      expect(r.cmp.changes.Y.abs).toBeLessThan(0);
    }
  });

  it('money expansion at a binding floor has no output effect', () => {
    const r = ok(runPolicy(advSpec({ M: 1500 }), { kind: 'floorM', size: 200 }));
    expect(r.s0.floorBinding).toBe(true);
    expect(r.cmp.changes.Y.abs).toBe(0);
  });

  it.each(['G', 'T0', 't', 'TR', 'GT0', 'Gacc', 'M', 'rate', 'liq', 'sens', 'floorM'] as PolicyKind[])('%s solves from the default economy', (kind) => {
    const size = kind === 't' ? 0.02 : kind === 'rate' ? 0.5 : 20;
    expect(runPolicy(advSpec(), { kind, size }).ok).toBe(true);
  });
});

describe('Module D — policy mix', () => {
  it('in the linear model joint effects equal the sum of isolated effects', () => {
    for (const cell of policyMatrix(advSpec({}, 'linear'), 50, 100)) {
      expect(cell.joint!.cmp.changes.Y.abs).toBeCloseTo(cell.additiveDY!, 8);
    }
  });

  it('with the non-linear LM the joint equilibrium differs from the additive sum', () => {
    const cells = policyMatrix(advSpec(), 100, 300);
    const gaps = cells.map((c) => Math.abs(c.joint!.cmp.changes.Y.abs - c.additiveDY!));
    expect(Math.max(...gaps)).toBeGreaterThan(1);
  });

  it('expansionary fiscal + monetary raises Y; fiscal expansion + monetary contraction raises i most', () => {
    const cells = policyMatrix(advSpec(), 50, 100);
    const get = (f: 1 | -1, m: 1 | -1) => cells.find((c) => c.fiscal === f && c.monetary === m)!.joint!;
    expect(get(1, 1).cmp.changes.Y.abs).toBeGreaterThan(get(1, -1).cmp.changes.Y.abs);
    expect(get(1, -1).cmp.changes.i.abs).toBeGreaterThan(get(1, 1).cmp.changes.i.abs);
    expect(get(-1, -1).cmp.changes.Y.abs).toBeLessThan(0);
  });
});

describe('Module D — sensitivity', () => {
  it('in the linear model the fiscal multiplier falls with b and rises with h', () => {
    const spec = advSpec({}, 'linear');
    const byB = sensitivityCurve(spec, 'b', 5, 80, 15);
    for (let j = 1; j < byB.length; j += 1) expect(byB[j]!.fiscal).toBeLessThan(byB[j - 1]!.fiscal);
    const byH = sensitivityCurve(spec, 'h', 5, 200, 15);
    for (let j = 1; j < byH.length; j += 1) expect(byH[j]!.fiscal).toBeGreaterThan(byH[j - 1]!.fiscal);
  });

  it('a higher tax rate lowers the simple multiplier', () => {
    const pts = sensitivityCurve(advSpec({}, 'linear'), 't', 0, 0.5, 10);
    for (let j = 1; j < pts.length; j += 1) expect(pts[j]!.alpha).toBeLessThan(pts[j - 1]!.alpha);
  });

  it('heat-map cells are full solves and consistent with point evaluations', () => {
    const g = multiplierGrid(advSpec({}, 'linear'), 'b', 'h', [10, 50], [10, 100], 5, 'fiscal');
    expect(g.z).toHaveLength(5);
    const p = { ...ADV_DEFAULTS, b: g.xs[2]!, h: g.ys[3]! };
    const alpha = alphaOf(p);
    expect(g.z[3]![2]!).toBeCloseTo(p.h / (p.h / alpha + p.b * p.k), 9);
  });
});
