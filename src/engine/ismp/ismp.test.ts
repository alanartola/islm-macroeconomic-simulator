import { ISMP_DEFAULTS, ISMP_PRESETS, compareISMP, delta, isRealRate, mpRealRate, policySensitivity, solveISMP, type ISMPParams, type ISMPSolved, type MPRegime } from './ismp';

const D = ISMP_DEFAULTS;
function ok(p: Partial<ISMPParams> = {}, regime: MPRegime = 'rule'): ISMPSolved {
  const r = solveISMP({ params: { ...D, ...p }, regime });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}

describe('IS-MP-PC: hand-checked equilibrium', () => {
  it('default (Taylor 1993 coefficients): x = 0, π = π* = 2, i = r* + π = 4', () => {
    const e = ok().equilibrium;
    expect(e.x).toBeCloseTo(0, 12);
    expect(e.pi).toBeCloseTo(2, 12);
    expect(e.i).toBeCloseTo(4, 12);
    expect(e.r).toBeCloseTo(2, 12);
  });

  it('Δ = 1 + σκ(1 + φπ) + σφy = 1.95 with the defaults', () => {
    expect(delta(D)).toBeCloseTo(1 + 0.3 * 1.5 + 0.5, 12);
  });

  it('demand shock d = 2: x = 2/1.95, π = 2 + 0.3x, i from the rule (exact)', () => {
    const e = ok({ d: 2 }).equilibrium;
    const x = 2 / 1.95;
    expect(e.x).toBeCloseTo(x, 12);
    expect(e.pi).toBeCloseTo(2 + 0.3 * x, 12);
    expect(e.i).toBeCloseTo(2 + e.pi + 0.5 * (e.pi - 2) + 0.5 * x, 12);
  });

  it('all three equations hold at the solution (residuals ≈ 0) in every case', () => {
    for (const [p, reg] of [[{}, 'rule'], [{ d: 2, u: 1 }, 'rule'], [{ d: -10 }, 'rule'], [{ d: 1 }, 'peg'], [{ piE: 3, v: 0.5 }, 'rule']] as [Partial<ISMPParams>, MPRegime][]) {
      const s = ok(p, reg);
      for (const v of Object.values(s.residuals)) expect(Math.abs(v)).toBeLessThan(1e-12);
    }
  });

  it('the equilibrium lies at the intersection of the IS and MP curves in (x, r) space', () => {
    const s = ok({ d: 1.5, u: 0.4 });
    expect(isRealRate(s.spec.params, s.equilibrium.x)!).toBeCloseTo(s.equilibrium.r, 12);
    expect(mpRealRate(s.spec.params, s.equilibrium.x, 'rule')).toBeCloseTo(s.equilibrium.r, 12);
  });
});

describe('IS-MP-PC: economic behaviour', () => {
  it('a positive demand shock raises x, π and i; the rule offsets part of it (x < d)', () => {
    const e = ok({ d: 2 }).equilibrium;
    expect(e.x).toBeGreaterThan(0);
    expect(e.x).toBeLessThan(2);
    expect(e.pi).toBeGreaterThan(2);
    expect(e.i).toBeGreaterThan(4);
  });

  it('an inflationary supply shock raises inflation and lowers the gap (policy trade-off)', () => {
    const e = ok({ u: 1 }).equilibrium;
    expect(e.pi).toBeGreaterThan(2);
    expect(e.x).toBeLessThan(0);
  });

  it('higher φπ stabilises inflation more after a supply shock at the cost of a larger negative gap', () => {
    const lo = ok({ u: 1, phiPi: 0.2 }).equilibrium;
    const hi = ok({ u: 1, phiPi: 2 }).equilibrium;
    expect(hi.pi).toBeLessThan(lo.pi);
    expect(hi.x).toBeLessThan(lo.x);
  });

  it('a higher inflation target with unchanged expectations is expansionary; credible (πᵉ = π*) it leaves x unchanged', () => {
    expect(ok({ piStar: 3 }).equilibrium.x).toBeGreaterThan(0);
    const cred = ok({ piStar: 3, piE: 3 }).equilibrium;
    expect(cred.x).toBeCloseTo(0, 12);
    expect(cred.pi).toBeCloseTo(3, 12);
  });

  it('a higher neutral rate recognised in the rule leaves x and π unchanged and raises i one-for-one', () => {
    const e = ok({ rn: 3, rStar: 3 }).equilibrium;
    expect(e.x).toBeCloseTo(0, 12);
    expect(e.i).toBeCloseTo(5, 12);
  });

  it('a neutral rate the central bank fails to recognise is expansionary (rule too loose)', () => {
    expect(ok({ rn: 3 }).equilibrium.x).toBeGreaterThan(0);
  });

  it('a contractionary policy shock v > 0 lowers x and π and raises i', () => {
    const e = ok({ v: 1 }).equilibrium;
    expect(e.x).toBeLessThan(0);
    expect(e.pi).toBeLessThan(2);
    expect(e.i).toBeGreaterThan(4);
  });

  it('local derivatives match finite differences', () => {
    const s = ok({ d: 0.5 });
    const h = 1e-6;
    expect((ok({ d: 0.5 + h }).equilibrium.x - s.equilibrium.x) / h).toBeCloseTo(s.derivatives.dx_dd, 5);
    expect((ok({ d: 0.5, u: h }).equilibrium.x - s.equilibrium.x) / h).toBeCloseTo(s.derivatives.dx_du, 5);
    expect((ok({ d: 0.5 + h }).equilibrium.i - s.equilibrium.i) / h).toBeCloseTo(s.derivatives.di_dd, 5);
  });
});

describe('effective lower bound', () => {
  it('a large negative demand shock makes the bound bind: i = i_lb and the gap is larger than with an unconstrained rule', () => {
    const s = ok({ d: -10 });
    expect(s.elbBinding).toBe(true);
    expect(s.equilibrium.i).toBe(0);
    expect(s.equilibrium.iRule).toBeLessThan(0);
    const unconstrained = ok({ d: -10, iLB: -100 }).equilibrium;
    expect(s.equilibrium.x).toBeLessThan(unconstrained.x);
    expect(s.issues.map((x) => x.code)).toContain('ELB_BINDING');
  });

  it('at the bound the policy rule stops responding: dx/dd = 1 (full pass-through of demand shocks)', () => {
    expect(ok({ d: -10 }).derivatives.dx_dd).toBe(1);
  });

  it('the bound is an instrument constraint: a policy shock v has no effect while it binds', () => {
    expect(ok({ d: -10, v: -1 }).equilibrium.x).toBeCloseTo(ok({ d: -10 }).equilibrium.x, 12);
  });
});

describe('peg regime and robustness', () => {
  it('under a peg demand shocks pass through fully (dx/dd = 1) and the rule is not applied', () => {
    const a = ok({}, 'peg').equilibrium;
    const b = ok({ d: 1 }, 'peg').equilibrium;
    expect(b.x - a.x).toBeCloseTo(1, 12);
    expect(b.i).toBe(D.iPeg);
  });

  it('warns when the Taylor principle fails (φπ ≤ 0)', () => {
    expect(ok({ phiPi: 0 }).issues.map((x) => x.code)).toContain('TAYLOR_PRINCIPLE');
  });

  it.each([{ sigma: -1 }, { kappa: -0.1 }, { phiY: -1 }, { d: Number.NaN }])('rejects %o', (p) => {
    expect(solveISMP({ params: { ...D, ...(p as Partial<ISMPParams>) }, regime: 'rule' }).ok).toBe(false);
  });

  it('rejects a peg below the lower bound', () => {
    expect(solveISMP({ params: { ...D, iPeg: -1 }, regime: 'peg' }).ok).toBe(false);
  });

  it('every preset is solvable and compareISMP reports changes', () => {
    for (const pr of ISMP_PRESETS) {
      const s0 = ok({}, pr.regime);
      const s1 = ok(pr.shock, pr.regime);
      expect(Object.keys(compareISMP(s0, s1).paramChanges).length).toBeGreaterThan(0);
    }
  });

  it('policy sensitivity curves are computed from full solutions', () => {
    const pts = policySensitivity({ params: { ...D, u: 1 }, regime: 'rule' }, 'phiPi', 0, 3, 10);
    expect(pts).toHaveLength(11);
    for (let j = 1; j < pts.length; j += 1) expect(pts[j]!.pi).toBeLessThan(pts[j - 1]!.pi);
  });

  it('units: shifting every rate and inflation variable by the same pp leaves the gap unchanged', () => {
    const k = 1.5;
    const a = ok({ d: 1, u: 0.5 }).equilibrium;
    const b = ok({ d: 1, u: 0.5, rn: D.rn + k, rStar: D.rStar + k, iLB: D.iLB + k }).equilibrium;
    expect(b.x).toBeCloseTo(a.x, 12);
    expect(b.i - a.i).toBeCloseTo(k, 12);
  });
});
