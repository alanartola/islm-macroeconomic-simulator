/**
 * Robust scalar root finding used by the non-linear models.
 *
 * All solvers work on a bracket [a, b] with f(a)·f(b) < 0 and never return a
 * value unless the convergence criteria were met. Failures are reported with an
 * explicit reason so the UI can show them instead of a misleading number.
 */

export type RootFailure = 'NO_BRACKET' | 'NOT_FINITE' | 'MAX_ITERATIONS';

export interface RootSuccess {
  ok: true;
  root: number;
  /** |f(root)| at the returned point. */
  residual: number;
  iterations: number;
  method: 'brent' | 'bisection';
  /** Final bracket width. */
  width: number;
}

export interface RootError {
  ok: false;
  reason: RootFailure;
  iterations: number;
}

export type RootResult = RootSuccess | RootError;

export interface RootOptions {
  /** Absolute tolerance on x (default 1e-10). */
  xtol?: number;
  /** Absolute tolerance on f (default 1e-9). */
  ftol?: number;
  maxIter?: number;
}

const DEFAULTS = { xtol: 1e-10, ftol: 1e-9, maxIter: 200 };

/** Plain bisection: slow but unconditionally convergent on a valid bracket. */
export function bisection(f: (x: number) => number, a: number, b: number, opts: RootOptions = {}): RootResult {
  const { xtol, ftol, maxIter } = { ...DEFAULTS, ...opts };
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return { ok: false, reason: 'NOT_FINITE', iterations: 0 };
  if (fa === 0) return { ok: true, root: a, residual: 0, iterations: 0, method: 'bisection', width: 0 };
  if (fb === 0) return { ok: true, root: b, residual: 0, iterations: 0, method: 'bisection', width: 0 };
  if (fa * fb > 0) return { ok: false, reason: 'NO_BRACKET', iterations: 0 };
  let lo = a;
  let hi = b;
  for (let k = 1; k <= maxIter; k += 1) {
    const mid = lo + (hi - lo) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return { ok: false, reason: 'NOT_FINITE', iterations: k };
    if (Math.abs(fm) <= ftol || (hi - lo) / 2 <= xtol) {
      return { ok: true, root: mid, residual: Math.abs(fm), iterations: k, method: 'bisection', width: hi - lo };
    }
    if (fa * fm < 0) hi = mid;
    else {
      lo = mid;
      fa = fm;
    }
  }
  return { ok: false, reason: 'MAX_ITERATIONS', iterations: maxIter };
}

/**
 * Brent's method (inverse quadratic interpolation / secant / bisection), as in
 * Brent (1973), "Algorithms for Minimization without Derivatives", ch. 4.
 * Converges superlinearly for smooth f and never leaves the bracket.
 */
export function brent(f: (x: number) => number, a0: number, b0: number, opts: RootOptions = {}): RootResult {
  const { xtol, ftol, maxIter } = { ...DEFAULTS, ...opts };
  let a = a0;
  let b = b0;
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return { ok: false, reason: 'NOT_FINITE', iterations: 0 };
  if (fa === 0) return { ok: true, root: a, residual: 0, iterations: 0, method: 'brent', width: 0 };
  if (fb === 0) return { ok: true, root: b, residual: 0, iterations: 0, method: 'brent', width: 0 };
  if (fa * fb > 0) return { ok: false, reason: 'NO_BRACKET', iterations: 0 };

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let k = 1; k <= maxIter; k += 1) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol = 2 * Number.EPSILON * Math.abs(b) + xtol / 2;
    const m = (c - b) / 2;
    if (Math.abs(m) <= tol || Math.abs(fb) <= ftol) {
      return { ok: true, root: b, residual: Math.abs(fb), iterations: k, method: 'brent', width: Math.abs(c - b) };
    }
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      // Attempt interpolation.
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      else p = -p;
      if (2 * p < Math.min(3 * m * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = d;
      }
    } else {
      d = m;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol ? d : m > 0 ? tol : -tol;
    fb = f(b);
    if (!Number.isFinite(fb)) return { ok: false, reason: 'NOT_FINITE', iterations: k };
  }
  return { ok: false, reason: 'MAX_ITERATIONS', iterations: maxIter };
}

/**
 * Expands a bracket outwards from [lo, hi] (towards −∞ for the lower end only,
 * the upper end is a fixed domain limit) until f changes sign.
 * Returns null when no sign change is found within `maxSteps` doublings.
 */
export function expandLower(
  f: (x: number) => number,
  lo: number,
  hi: number,
  maxSteps = 80,
): [number, number] | null {
  const fhi = f(hi);
  if (!Number.isFinite(fhi)) return null;
  let step = Math.max(1, Math.abs(hi - lo));
  let x = lo;
  for (let k = 0; k < maxSteps; k += 1) {
    const fx = f(x);
    if (Number.isFinite(fx) && fx * fhi <= 0) return [x, hi];
    x -= step;
    step *= 2;
  }
  return null;
}
