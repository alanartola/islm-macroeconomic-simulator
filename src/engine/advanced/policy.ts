import { compareAdvanced, type AdvComparison } from './comparative';
import { alphaOf, solveAdvanced } from './model';
import type { AdvIssue, AdvParamKey, AdvParams, AdvSolved, AdvSpec } from './types';

/**
 * Module D — policy experiments on the Module B model. Every experiment is
 * solved as a full equilibrium (never by adding isolated effects).
 */
export type PolicyKind =
  | 'G' // government purchases
  | 'T0' // autonomous tax
  | 't' // marginal tax rate
  | 'TR' // transfers
  | 'GT0' // purchases financed by an equal change in the autonomous tax (ex-ante balanced)
  | 'Gacc' // purchases with monetary accommodation (rate held at i₀, M endogenous)
  | 'M' // nominal money supply
  | 'rate' // policy-rate target (regime 'rate')
  | 'liq' // liquidity-preference shock (a in the non-linear LM, L₀ otherwise)
  | 'sens' // interest sensitivity of money demand (h; a in the non-linear LM)
  | 'floorM'; // money expansion under the lower-bound specification

export interface Policy {
  kind: PolicyKind;
  /** Size in the instrument's units (bn, pp for 'rate', ratio for 't'). */
  size: number;
}

export interface PolicyResult {
  ok: true;
  s0: AdvSolved;
  s1: AdvSolved;
  cmp: AdvComparison;
  /** Output change that would occur at the constant initial rate (IS shift at i₀). */
  constantRateDY: number;
  /** Crowding out (or crowding in) in bn: constant-rate ΔY − actual ΔY. */
  crowding: number;
  /** ΔY divided by the size of the instrument (bn per unit; null for t and rate where units differ). */
  effectiveMultiplier: number | null;
  /** Change of the budget balance T − G − TR. */
  dBudget: number;
}

export type PolicyOutcome = PolicyResult | { ok: false; issues: AdvIssue[] };

/** Parameter whose value the 'liq' and 'sens' policies change for a given LM specification. */
export function liquidityParam(spec: AdvSpec, kind: 'liq' | 'sens'): AdvParamKey {
  if (spec.lm === 'nonlinear') return 'a';
  return kind === 'liq' ? 'L0' : 'h';
}

/** Builds the initial and perturbed specifications of a policy experiment. */
export function policySpecs(base: AdvSpec, pol: Policy): [AdvSpec, AdvSpec] | null {
  const p = base.params;
  const s0: AdvSpec = { ...base };
  const with1 = (patch: Partial<AdvParams>, over: Partial<AdvSpec> = {}): AdvSpec => ({ ...base, ...over, params: { ...p, ...patch } });
  switch (pol.kind) {
    case 'G':
      return [s0, with1({ G: p.G + pol.size })];
    case 'T0':
      return [s0, with1({ T0: p.T0 + pol.size })];
    case 't':
      return [s0, with1({ t: p.t + pol.size })];
    case 'TR':
      return [s0, with1({ TR: p.TR + pol.size })];
    case 'GT0':
      return [s0, with1({ G: p.G + pol.size, T0: p.T0 + pol.size })];
    case 'Gacc': {
      // Accommodation: the central bank holds the initial equilibrium rate.
      const r0 = solveAdvanced({ ...base, regime: 'money' });
      if (!r0.ok) return null;
      const i0 = r0.value.equilibrium.i;
      return [{ ...base, regime: 'money' }, with1({ G: p.G + pol.size }, { regime: 'rate', targetRate: i0 })];
    }
    case 'M':
      return [{ ...base, regime: 'money' }, with1({ M: p.M + pol.size }, { regime: 'money' })];
    case 'rate': {
      const r0 = solveAdvanced({ ...base, regime: 'money' });
      if (!r0.ok) return null;
      const i0 = r0.value.equilibrium.i;
      return [{ ...base, regime: 'rate', targetRate: i0 }, { ...base, regime: 'rate', targetRate: i0 + pol.size }];
    }
    case 'liq':
    case 'sens': {
      const k = liquidityParam(base, pol.kind);
      return [{ ...base, regime: 'money' }, with1({ [k]: p[k] + pol.size } as Partial<AdvParams>, { regime: 'money' })];
    }
    case 'floorM':
      return [{ ...base, lm: 'floor', regime: 'money' }, { ...base, lm: 'floor', regime: 'money', params: { ...p, M: p.M + pol.size } }];
    default:
      return null;
  }
}

export function runPolicy(base: AdvSpec, pol: Policy): PolicyOutcome {
  const specs = policySpecs(base, pol);
  if (!specs) return { ok: false, issues: [{ code: 'NO_EQUILIBRIUM', severity: 'error' }] };
  const r0 = solveAdvanced(specs[0]);
  const r1 = solveAdvanced(specs[1]);
  if (!r0.ok || !r1.ok) return { ok: false, issues: [...(r0.ok ? [] : r0.issues), ...(r1.ok ? [] : r1.issues)] };
  const cmp = compareAdvanced(r0.value, r1.value);
  const dY = cmp.changes.Y.abs;
  const perUnit = pol.kind !== 't' && pol.kind !== 'rate' && Math.abs(pol.size) > 1e-12;
  return {
    ok: true,
    s0: r0.value,
    s1: r1.value,
    cmp,
    constantRateDY: cmp.isShiftAtInitialRate,
    crowding: cmp.isShiftAtInitialRate - dY,
    effectiveMultiplier: perUnit ? dY / pol.size : null,
    dBudget: cmp.changes.Sg.abs,
  };
}

export interface MatrixCell {
  fiscal: 1 | -1;
  monetary: 1 | -1;
  joint: PolicyResult | null;
  /** Sum of the isolated fiscal and monetary ΔY (to show that effects are not additive in general). */
  additiveDY: number | null;
}

/**
 * Policy-mix matrix: (±ΔG) × (±ΔM), each cell solved as one joint equilibrium.
 * In the linear model the joint ΔY equals the sum of isolated effects; with the
 * non-linear LM it generally does not.
 */
export function policyMatrix(base: AdvSpec, dG: number, dM: number): MatrixCell[] {
  const money = { ...base, regime: 'money' as const };
  const cells: MatrixCell[] = [];
  for (const fs of [1, -1] as const) {
    for (const ms of [1, -1] as const) {
      const r0 = solveAdvanced(money);
      const r1 = solveAdvanced({ ...money, params: { ...money.params, G: money.params.G + fs * dG, M: money.params.M + ms * dM } });
      const fOnly = runPolicy(money, { kind: 'G', size: fs * dG });
      const mOnly = runPolicy(money, { kind: 'M', size: ms * dM });
      let joint: PolicyResult | null = null;
      if (r0.ok && r1.ok) {
        const cmp = compareAdvanced(r0.value, r1.value);
        joint = {
          ok: true,
          s0: r0.value,
          s1: r1.value,
          cmp,
          constantRateDY: cmp.isShiftAtInitialRate,
          crowding: cmp.isShiftAtInitialRate - cmp.changes.Y.abs,
          effectiveMultiplier: null,
          dBudget: cmp.changes.Sg.abs,
        };
      }
      cells.push({
        fiscal: fs,
        monetary: ms,
        joint,
        additiveDY: fOnly.ok && mOnly.ok ? fOnly.cmp.changes.Y.abs + mOnly.cmp.changes.Y.abs : null,
      });
    }
  }
  return cells;
}

export type SensParam = 'c' | 'b' | 'h' | 'a' | 'k' | 't';

export interface SensPoint {
  x: number;
  fiscal: number;
  monetary: number;
  alpha: number;
  crowding: number;
}

/** Local multipliers along a parameter sweep, re-solving the full model at every point. */
export function sensitivityCurve(base: AdvSpec, param: SensParam, from: number, to: number, n = 60): SensPoint[] {
  const out: SensPoint[] = [];
  for (let j = 0; j <= n; j += 1) {
    const x = from + ((to - from) * j) / n;
    const r = solveAdvanced({ ...base, regime: 'money', params: { ...base.params, [param]: x } });
    if (!r.ok) continue;
    const m = r.value.multipliers;
    out.push({ x, fiscal: m.dY_dG, monetary: m.dY_dRealMoney, alpha: alphaOf(r.value.spec.params), crowding: m.crowdingOutShare });
  }
  return out;
}

export interface HeatGrid {
  xs: number[];
  ys: number[];
  /** z[row j (y)][col i (x)]; null where the model has no valid equilibrium. */
  z: (number | null)[][];
}

/** Grid of a local multiplier over two parameters (each cell is a full solve). */
export function multiplierGrid(
  base: AdvSpec,
  px: SensParam,
  py: SensParam,
  xr: [number, number],
  yr: [number, number],
  n: number,
  which: 'fiscal' | 'monetary',
): HeatGrid {
  const xs = Array.from({ length: n }, (_, k) => xr[0] + ((xr[1] - xr[0]) * k) / (n - 1));
  const ys = Array.from({ length: n }, (_, k) => yr[0] + ((yr[1] - yr[0]) * k) / (n - 1));
  const z = ys.map((y) =>
    xs.map((x) => {
      const r = solveAdvanced({ ...base, regime: 'money', params: { ...base.params, [px]: x, [py]: y } });
      if (!r.ok) return null;
      return which === 'fiscal' ? r.value.multipliers.dY_dG : r.value.multipliers.dY_dRealMoney;
    }),
  );
  return { xs, ys, z };
}
