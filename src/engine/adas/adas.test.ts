import { brent } from '../numeric/roots';
import { advSpec, solveAdvanced } from '../advanced';
import {
  ADAS_DEFAULTS,
  ADAS_PRESETS,
  adCoefficients,
  adOutput,
  adPrice,
  adjustmentPath,
  compareADAS,
  mediumRunOf,
  solveADAS,
  srasPrice,
  type ADASParams,
  type ADASSolved,
} from './adas';

const D = ADAS_DEFAULTS;
function ok(p: Partial<ADASParams> = {}): ADASSolved {
  const r = solveADAS({ ...D, ...p });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}

describe('AD derivation from IS-LM', () => {
  it('Y_AD(P) coincides with the full Module B IS-LM solution at every price level', () => {
    for (const P of [0.6, 0.9, 1, 1.25, 2]) {
      const r = solveAdvanced(advSpec({ ...D, P }, 'linear'));
      expect(r.ok).toBe(true);
      if (r.ok) expect(adOutput(D, P)).toBeCloseTo(r.value.equilibrium.Y, 8);
    }
  });

  it('hand-checked coefficients: a₁ = 777.7̄, a₂ = 1222.2̄, D = 22.5', () => {
    const c = adCoefficients(D);
    expect(c.D).toBeCloseTo(22.5, 12);
    expect(c.a1).toBeCloseTo(17500 / 22.5, 9);
    expect(c.a2).toBeCloseTo(27500 / 22.5, 9);
  });

  it('AD slopes downward (real-balance effect) and P(Y) inverts it', () => {
    expect(adOutput(D, 1.1)).toBeLessThan(adOutput(D, 1));
    expect(adPrice(D, adOutput(D, 1.3))!).toBeCloseTo(1.3, 10);
    expect(adPrice({ ...D, b: 0 }, 2000)).toBeNull();
  });
});

describe('short-run equilibrium', () => {
  it('default: P = Pᵉ = 1, Y = Yₙ = 2000, i = 5, zero gap', () => {
    const e = ok().equilibrium;
    expect(e.P).toBeCloseTo(1, 12);
    expect(e.Y).toBeCloseTo(2000, 8);
    expect(e.i).toBeCloseTo(5, 9);
    expect(e.gap).toBeCloseTo(0, 9);
  });

  it('closed-form root equals the numerical root of AD − SRAS (Brent) for many cases', () => {
    for (const p of [{}, { M: 1300 }, { G: 400 }, { s: 0.08 }, { theta: 0.002, Yn: 1900 }, { Pe: 1.3, M: 900 }] as Partial<ADASParams>[]) {
      const q = { ...D, ...p };
      const s = ok(p);
      const r = brent((P) => P - srasPrice(q, adOutput(q, P)), 1e-6, 50);
      expect(r.ok).toBe(true);
      if (r.ok) expect(s.equilibrium.P).toBeCloseTo(r.root, 9);
    }
  });

  it('identities and both curves hold at the solution', () => {
    for (const p of [{}, { M: 1300 }, { G: 420, t: 0.3 }, { s: -0.04 }] as Partial<ADASParams>[]) {
      const s = ok(p);
      for (const v of Object.values(s.residuals)) expect(Math.abs(v)).toBeLessThan(1e-8);
    }
  });

  it('demand shocks move P and Y in the same direction; supply shocks in opposite directions', () => {
    const base = ok().equilibrium;
    const dem = ok({ G: 375 }).equilibrium;
    const sup = ok({ s: 0.05 }).equilibrium;
    expect(dem.Y - base.Y).toBeGreaterThan(0);
    expect(dem.P - base.P).toBeGreaterThan(0);
    expect(sup.P - base.P).toBeGreaterThan(0);
    expect(sup.Y - base.Y).toBeLessThan(0); // stagflation
  });

  it('a steeper SRAS (larger θ) turns more of a demand shock into prices and less into output', () => {
    const flat = ok({ theta: 0.0001, M: 1200 }).equilibrium;
    const steep = ok({ theta: 0.005, M: 1200 }).equilibrium;
    expect(steep.P).toBeGreaterThan(flat.P);
    expect(steep.Y).toBeLessThan(flat.Y);
  });

  it('limit θ = 0: horizontal SRAS, P = Pᵉ + s and output fully demand-determined (IS-LM)', () => {
    const s = ok({ theta: 0, M: 1200 });
    expect(s.equilibrium.P).toBeCloseTo(1, 12);
    expect(s.equilibrium.Y).toBeCloseTo(adOutput(D, 1) + (25 * 100) / 22.5, 8);
    expect(s.mediumRun).toBeNull();
  });

  it('known example: monetary expansion M 1100 → 1200 gives P ≈ 1.0338 and Y ≈ 2067.5', () => {
    const e = ok({ M: 1200 }).equilibrium;
    const a2 = (25 * 1200) / 22.5;
    const B = 1 + 0.0005 * (17500 / 22.5 - 2000);
    expect(e.P).toBeCloseTo((B + Math.sqrt(B * B + 4 * 0.0005 * a2)) / 2, 12);
    expect(e.P).toBeCloseTo(1.03378, 4);
    expect(e.Y).toBeCloseTo(2067.5, 0);
  });
});

describe('medium run and adjustment', () => {
  it('money is neutral in the medium run: Y = Yₙ, i unchanged, P proportional to M', () => {
    const mr0 = mediumRunOf(D)!;
    const mr1 = mediumRunOf({ ...D, M: 1200 })!;
    expect(mr1.Y).toBeCloseTo(2000, 9);
    expect(mr1.P / mr0.P).toBeCloseTo(1200 / 1100, 12);
    expect(mr1.i).toBeCloseTo(mr0.i, 9);
    expect(mr1.realMoney).toBeCloseTo(mr0.realMoney, 9);
  });

  it('fiscal expansion: medium-run output returns to Yₙ with a higher rate (full crowding out)', () => {
    const mr = mediumRunOf({ ...D, G: 375 })!;
    expect(mr.Y).toBeCloseTo(2000, 9);
    expect(mr.i).toBeGreaterThan(5);
  });

  it('a persistent supply shock lowers medium-run output by s/θ', () => {
    expect(mediumRunOf({ ...D, s: 0.05 })!.Y).toBeCloseTo(2000 - 0.05 / 0.0005, 9);
  });

  it('higher potential output lowers the medium-run price level', () => {
    expect(mediumRunOf({ ...D, Yn: 2100 })!.P).toBeLessThan(mediumRunOf(D)!.P);
  });

  it('the adaptive-expectations path converges monotonically to the medium-run equilibrium', () => {
    const p = { ...D, M: 1200 };
    const path = adjustmentPath(p, 60);
    const mr = mediumRunOf(p)!;
    expect(path[0]!.P).toBeCloseTo(ok({ M: 1200 }).equilibrium.P, 12);
    for (let k = 1; k < path.length; k += 1) expect(path[k]!.P).toBeGreaterThanOrEqual(path[k - 1]!.P - 1e-12);
    expect(path.at(-1)!.P).toBeCloseTo(mr.P, 4);
    expect(path.at(-1)!.Y).toBeCloseTo(mr.Y, 1);
  });

  it('no medium run with a vertical AD (b = 0): prices cannot restore demand', () => {
    const r = solveADAS({ ...D, b: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.mediumRun).toBeNull();
      expect(r.value.issues.map((x) => x.code)).toEqual(expect.arrayContaining(['VERTICAL_AD', 'NO_MEDIUM_RUN']));
    }
  });
});

describe('comparison, presets and robustness', () => {
  it('exact decomposition ΔY = AD shift at P₀ + price (real-balance) effect', () => {
    const c = compareADAS(ok(), ok({ G: 375 }));
    expect(c.adShift + c.priceEffect).toBeCloseTo(c.changes.Y.abs, 8);
    expect(c.priceEffect).toBeLessThan(0);
    expect(c.srasShift).toBeCloseTo(0, 12);
  });

  it('a supply shock shifts SRAS vertically by s and leaves AD in place', () => {
    const c = compareADAS(ok(), ok({ s: 0.05 }));
    expect(c.srasShift).toBeCloseTo(0.05, 12);
    expect(c.adShift).toBeCloseTo(0, 9);
  });

  it('every preset is solvable', () => {
    for (const pr of ADAS_PRESETS) expect(solveADAS({ ...D, ...pr.shock }).ok, pr.id).toBe(true);
  });

  it.each([{ c: 1 }, { k: 0 }, { M: 0 }, { Yn: 0 }, { Pe: 0 }, { theta: -1 }, { b: 0, h: 0 }, { G: Number.NaN }])('rejects %o', (p) => {
    expect(solveADAS({ ...D, ...(p as Partial<ADASParams>) }).ok).toBe(false);
  });

  it('dimensional check: scaling all bn quantities (and b, h, Yn) by λ and θ by 1/λ leaves P and i unchanged', () => {
    const lam = 3;
    const sc: ADASParams = { ...D, C0: D.C0 * lam, T0: D.T0 * lam, TR: D.TR * lam, I0: D.I0 * lam, G: D.G * lam, M: D.M * lam, L0: D.L0 * lam, b: D.b * lam, h: D.h * lam, Yn: D.Yn * lam, theta: D.theta / lam };
    const a = ok({ M: 1250 }).equilibrium;
    const b = ok({ ...sc, M: 1250 * lam }).equilibrium;
    expect(b.P).toBeCloseTo(a.P, 10);
    expect(b.i).toBeCloseTo(a.i, 8);
    expect(b.Y).toBeCloseTo(a.Y * lam, 6);
  });
});
