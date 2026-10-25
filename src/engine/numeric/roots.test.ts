import { bisection, brent, expandLower } from './roots';

describe('root finders', () => {
  const cubic = (x: number) => x * x * x - 2 * x - 5; // classic test, root ≈ 2.0945514815423265

  it.each([brent, bisection])('%o finds a known root to tolerance', (solver) => {
    const r = solver(cubic, 2, 3);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.root).toBeCloseTo(2.0945514815423265, 8);
      expect(r.residual).toBeLessThan(1e-8);
    }
  });

  it('Brent converges in far fewer iterations than bisection', () => {
    const a = brent(cubic, 2, 3);
    const b = bisection(cubic, 2, 3);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.iterations).toBeLessThan(b.iterations);
  });

  it('handles steep, highly non-linear functions near an asymptote', () => {
    const f = (x: number) => 1 / (3 - x) - 10; // root 2.9, pole at 3
    const r = brent(f, 0, 3 - 1e-12);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.root).toBeCloseTo(2.9, 9);
  });

  it('reports the absence of a bracket instead of returning a value', () => {
    expect(brent((x) => x * x + 1, -1, 1)).toEqual({ ok: false, reason: 'NO_BRACKET', iterations: 0 });
    expect(bisection((x) => x * x + 1, -1, 1).ok).toBe(false);
  });

  it('reports non-finite evaluations', () => {
    expect(brent(() => Number.NaN, 0, 1)).toMatchObject({ ok: false, reason: 'NOT_FINITE' });
  });

  it('reports non-convergence when the iteration budget is exhausted', () => {
    expect(bisection(cubic, 2, 3, { maxIter: 3, xtol: 1e-15, ftol: 1e-15 })).toMatchObject({ ok: false, reason: 'MAX_ITERATIONS' });
  });

  it('returns exact roots at the bracket ends', () => {
    expect(brent((x) => x - 1, 1, 2)).toMatchObject({ ok: true, root: 1, residual: 0 });
  });

  it('expandLower finds a sign change by doubling the step', () => {
    const br = expandLower((x) => x + 1000, 0, 1);
    expect(br).not.toBeNull();
    if (br) expect(br[0]).toBeLessThanOrEqual(-1000);
    expect(expandLower((x) => x * x + 1, 0, 1, 10)).toBeNull();
  });
});
