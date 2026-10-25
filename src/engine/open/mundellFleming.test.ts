import {
  OPEN_DEFAULTS,
  OPEN_PRESETS,
  compareOpen,
  maxOpenResidual,
  openAlpha,
  openSpec,
  solveOpen,
  type FXRegime,
  type OpenParams,
  type OpenSolved,
} from './mundellFleming';

function ok(p: Partial<OpenParams> = {}, regime: FXRegime = 'flexible'): OpenSolved {
  const r = solveOpen(openSpec(p, regime));
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}

describe('Mundell-Fleming — hand-checked equilibrium', () => {
  it.each(['flexible', 'fixed'] as FXRegime[])('%s: Y = 2000, q = E = 1, NX = 0, i = i* = 4, M = 800', (reg) => {
    const e = ok({}, reg).equilibrium;
    expect(e.Y).toBeCloseTo(2000, 9);
    expect(e.q).toBeCloseTo(1, 12);
    expect(e.E).toBeCloseTo(1, 12);
    expect(e.NX).toBeCloseTo(0, 9);
    expect(e.i).toBe(4);
    expect(e.M).toBeCloseTo(800, 9);
    expect(e.R).toBeCloseTo(200, 9);
    expect(e.alpha).toBeCloseTo(2, 12);
  });

  it.each([
    [{}, 'flexible'],
    [{ G: 400, t: 0.3 }, 'flexible'],
    [{ G: 400 }, 'fixed'],
    [{ Yf: 1500, m: 0.2 }, 'fixed'],
  ] as [Partial<OpenParams>, FXRegime][])('open-economy identities hold for %o (%s): Y = C + I + G + NX, S − I = NX, M/P = L', (p, reg) => {
    const s = ok(p, reg);
    expect(maxOpenResidual(s.residuals)).toBeLessThan(1e-8);
    expect(s.equilibrium.capitalInflow).toBeCloseTo(-s.equilibrium.NX, 12);
  });
});

describe('Mundell-Fleming — classic results under perfect capital mobility', () => {
  it('flexible: fiscal expansion leaves Y unchanged, appreciates the currency and crowds out NX one-for-one', () => {
    const c = compareOpen(ok(), ok({ G: 350 }));
    expect(c.changes.Y.abs).toBeCloseTo(0, 9);
    expect(c.changes.q.abs).toBeLessThan(0); // appreciation
    expect(c.changes.NX.abs).toBeCloseTo(-50, 9);
  });

  it('flexible: monetary expansion raises Y by ΔD/(kP) and depreciates the currency', () => {
    const c = compareOpen(ok(), ok({ D: 700 }));
    expect(c.changes.Y.abs).toBeCloseTo(100 / 0.5, 9);
    expect(c.changes.q.abs).toBeGreaterThan(0); // depreciation
    expect(c.changes.NX.abs).toBeGreaterThan(0);
  });

  it('fixed: fiscal expansion has the full open-economy multiplier and requires more money', () => {
    const c = compareOpen(ok({}, 'fixed'), ok({ G: 350 }, 'fixed'));
    expect(c.changes.Y.abs).toBeCloseTo(openAlpha(OPEN_DEFAULTS) * 50, 9);
    expect(c.changes.q.abs).toBe(0);
    expect(c.changes.M.abs).toBeCloseTo(0.5 * 100, 9);
    expect(c.changes.R.abs).toBeCloseTo(50, 9); // reserves accumulate
  });

  it('fixed: monetary expansion is offset by an equal loss of reserves (no effect on Y)', () => {
    const c = compareOpen(ok({}, 'fixed'), ok({ D: 700 }, 'fixed'));
    expect(c.changes.Y.abs).toBeCloseTo(0, 9);
    expect(c.changes.M.abs).toBeCloseTo(0, 9);
    expect(c.changes.R.abs).toBeCloseTo(-100, 9);
  });

  it('fixed: a monetary expansion larger than reserves is infeasible (the peg cannot be defended)', () => {
    const r = solveOpen(openSpec({ D: 850 }, 'fixed'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('RESERVES_EXHAUSTED');
  });

  it('flexible: a higher world rate raises Y (lower money demand) and depreciates the currency', () => {
    const c = compareOpen(ok(), ok({ iStar: 5 }));
    expect(c.changes.Y.abs).toBeCloseTo(50 / 0.5, 9);
    expect(c.changes.q.abs).toBeGreaterThan(0);
  });

  it('fixed: a higher world rate lowers investment and output by α·b·Δi*', () => {
    const c = compareOpen(ok({}, 'fixed'), ok({ iStar: 5 }, 'fixed'));
    expect(c.changes.Y.abs).toBeCloseTo(-2 * 25, 9);
  });

  it('foreign demand: no output effect with flexible rates (appreciation), α·v·ΔY* with fixed rates', () => {
    expect(compareOpen(ok(), ok({ Yf: 1200 })).changes.Y.abs).toBeCloseTo(0, 9);
    expect(compareOpen(ok({}, 'fixed'), ok({ Yf: 1200 }, 'fixed')).changes.Y.abs).toBeCloseTo(2 * 0.1 * 200, 9);
  });

  it('devaluation under a peg raises output by α·n·Δq̄ and improves NX (Marshall-Lerner holds)', () => {
    const c = compareOpen(ok({}, 'fixed'), ok({ Ebar: 1.1 }, 'fixed'));
    expect(c.changes.Y.abs).toBeCloseTo(2 * 200 * 0.1, 9);
    expect(c.changes.NX.abs).toBeGreaterThan(0);
  });

  it('a higher propensity to import lowers the open-economy multiplier', () => {
    expect(openAlpha({ ...OPEN_DEFAULTS, m: 0.2 })).toBeLessThan(openAlpha(OPEN_DEFAULTS));
    expect(ok({ m: 0.2, G: 350 }, 'fixed').equilibrium.Y - ok({ m: 0.2 }, 'fixed').equilibrium.Y).toBeLessThan(2 * 50);
  });

  it('local multipliers match finite differences', () => {
    for (const reg of ['flexible', 'fixed'] as FXRegime[]) {
      const m = ok({}, reg).multipliers;
      const d = 1e-3;
      const fd = (patch: Partial<OpenParams>, key: 'Y' | 'q') => (ok(patch, reg).equilibrium[key] - ok({}, reg).equilibrium[key]) / d;
      expect(fd({ G: OPEN_DEFAULTS.G + d }, 'Y')).toBeCloseTo(m.dY_dG, 5);
      expect(fd({ G: OPEN_DEFAULTS.G + d }, 'q')).toBeCloseTo(m.dq_dG, 5);
      expect(fd({ D: OPEN_DEFAULTS.D + d }, 'Y')).toBeCloseTo(m.dY_dD, 5);
      expect(fd({ iStar: OPEN_DEFAULTS.iStar + d }, 'Y')).toBeCloseTo(m.dY_diStar, 4);
    }
  });
});

describe('Mundell-Fleming — robustness and conventions', () => {
  it('rejects a flexible regime with no trade response to q (q undetermined)', () => {
    const r = solveOpen(openSpec({ xq: 0, mq: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('NO_TRADE_RESPONSE');
  });

  it('warns when the Marshall-Lerner-type condition fails (n < 0): depreciation would worsen NX', () => {
    const r = solveOpen(openSpec({ xq: 20, mq: -60, D: 300 }, 'fixed'));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.issues.map((x) => x.code)).toContain('MARSHALL_LERNER_FAILS');
  });

  it('rejects an equilibrium with a non-positive real exchange rate', () => {
    const r = solveOpen(openSpec({ G: 600 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((x) => x.code)).toContain('NON_POSITIVE_EXCHANGE_RATE');
  });

  it.each([{ m: 1 }, { c: 1 }, { k: 0 }, { P: 0 }, { b: -1 }])('rejects invalid parameter %o', (p) => {
    expect(solveOpen(openSpec(p as Partial<OpenParams>)).ok).toBe(false);
  });

  it('every preset is solvable', () => {
    for (const pr of OPEN_PRESETS) {
      expect(solveOpen(openSpec({}, pr.regime)).ok, pr.id).toBe(true);
      expect(solveOpen(openSpec(pr.shock, pr.regime)).ok, pr.id).toBe(true);
    }
  });
});
