import { change, type Change } from '../comparative';

/**
 * Module G — IS-MP with a Phillips curve and a Taylor-type rule
 * (static three-equation model; see docs/modelos/is-mp-taylor.md).
 *
 * UNITS: every variable is in percentage points (pp): the output gap x is in
 * percent of potential output, inflation π and all rates are in percent per
 * year. σ is pp of output gap per pp of real rate; κ is pp of inflation per pp
 * of gap; φπ and φy are pp of policy rate per pp. No decimals are mixed in.
 *
 *   IS:     x = d − σ·(i − πᵉ − rₙ)               (ex-ante real rate r = i − πᵉ)
 *   PC:     π = πᵉ + κ·x + u                       (expectations πᵉ exogenous)
 *   Rule:   i = r̂* + π + φπ·(π − π*) + φy·x + v   (Taylor 1993 form)
 *   ELB:    i ≥ i_lb
 *
 * rₙ is the true neutral real rate (in the IS); r̂* is the neutral rate used by
 * the central bank in its rule; v is a discretionary policy shock.
 *
 * Unconstrained solution (Δ = 1 + σκ(1 + φπ) + σφy > 0):
 *   x* = [d − σ((r̂* − rₙ + v) + (1 + φπ)·u + φπ·(πᵉ − π*))] / Δ
 * then π from the PC and i from the rule. If the rule prescribes i < i_lb the
 * bound binds: i = i_lb, x = d − σ(i_lb − πᵉ − rₙ), π from the PC.
 * Optional regime 'peg': the central bank fixes i = ī instead of following the rule.
 */
export type MPRegime = 'rule' | 'peg';

export interface ISMPParams {
  /** Demand shock d (pp of output gap at the neutral real rate). */
  d: number;
  /** Interest sensitivity of the output gap σ. */
  sigma: number;
  /** True neutral real rate rₙ (pp). */
  rn: number;
  /** Slope of the Phillips curve κ. */
  kappa: number;
  /** Expected inflation πᵉ (pp). */
  piE: number;
  /** Cost-push / supply shock u (pp). */
  u: number;
  /** Neutral real rate used in the rule r̂* (pp). */
  rStar: number;
  /** Inflation target π* (pp). */
  piStar: number;
  /** Response to the inflation gap φπ. */
  phiPi: number;
  /** Response to the output gap φy. */
  phiY: number;
  /** Discretionary policy shock v (pp; > 0 contractionary). */
  v: number;
  /** Effective lower bound on the nominal policy rate (pp). */
  iLB: number;
  /** Pegged nominal rate ī (pp; regime 'peg'). */
  iPeg: number;
}

export type ISMPParamKey = keyof ISMPParams;

/** HYPOTHETICAL calibration with Taylor's (1993) coefficients: x = 0, π = π* = 2, i = 4. */
export const ISMP_DEFAULTS: Readonly<ISMPParams> = Object.freeze({
  d: 0,
  sigma: 1,
  rn: 2,
  kappa: 0.3,
  piE: 2,
  u: 0,
  rStar: 2,
  piStar: 2,
  phiPi: 0.5,
  phiY: 0.5,
  v: 0,
  iLB: 0,
  iPeg: 4,
});

export interface ISMPSpec {
  params: ISMPParams;
  regime: MPRegime;
}

export type ISMPIssueCode = 'NON_FINITE' | 'NEGATIVE_SENSITIVITY' | 'TAYLOR_PRINCIPLE' | 'ELB_BINDING' | 'PEG_BELOW_LB' | 'DEFLATION';

export interface ISMPIssue {
  code: ISMPIssueCode;
  severity: 'error' | 'warning' | 'info';
  field?: string;
  values?: Record<string, number>;
}

export interface ISMPEquilibrium {
  x: number;
  pi: number;
  i: number;
  /** Ex-ante real rate i − πᵉ. */
  r: number;
  /** Rate the rule would prescribe without the bound. */
  iRule: number;
}

export interface ISMPSolved {
  spec: ISMPSpec;
  equilibrium: ISMPEquilibrium;
  elbBinding: boolean;
  /** Local derivatives of the unconstrained solution. */
  derivatives: { dx_dd: number; dpi_dd: number; dx_du: number; dpi_du: number; di_dd: number };
  residuals: { is: number; pc: number; rule: number };
  issues: ISMPIssue[];
}

export type ISMPResult = { ok: true; value: ISMPSolved } | { ok: false; issues: ISMPIssue[] };

const KEYS: readonly ISMPParamKey[] = ['d', 'sigma', 'rn', 'kappa', 'piE', 'u', 'rStar', 'piStar', 'phiPi', 'phiY', 'v', 'iLB', 'iPeg'];

export function delta(p: ISMPParams): number {
  return 1 + p.sigma * p.kappa * (1 + p.phiPi) + p.sigma * p.phiY;
}

/** Rate prescribed by the rule at (π, x). */
export function ruleRate(p: ISMPParams, pi: number, x: number): number {
  return p.rStar + pi + p.phiPi * (pi - p.piStar) + p.phiY * x + p.v;
}

/** Phillips curve. */
export function phillips(p: ISMPParams, x: number): number {
  return p.piE + p.kappa * x + p.u;
}

/** IS curve as real rate for a given gap: r = rₙ + (d − x)/σ. */
export function isRealRate(p: ISMPParams, x: number): number | null {
  return p.sigma > 0 ? p.rn + (p.d - x) / p.sigma : null;
}

/** MP curve: real rate implied by the rule (after substituting the PC), floored at the bound. */
export function mpRealRate(p: ISMPParams, x: number, regime: MPRegime): number {
  if (regime === 'peg') return p.iPeg - p.piE;
  const i = ruleRate(p, phillips(p, x), x);
  return Math.max(i, p.iLB) - p.piE;
}

export function validateISMP(spec: ISMPSpec): ISMPIssue[] {
  const p = spec.params;
  const out: ISMPIssue[] = [];
  for (const k of KEYS) if (!Number.isFinite(p[k])) out.push({ code: 'NON_FINITE', severity: 'error', field: k });
  if (out.length) return out;
  for (const k of ['sigma', 'kappa', 'phiPi', 'phiY'] as const) if (p[k] < 0) out.push({ code: 'NEGATIVE_SENSITIVITY', severity: 'error', field: k, values: { value: p[k] } });
  if (out.length) return out;
  if (spec.regime === 'rule' && p.phiPi <= 0) out.push({ code: 'TAYLOR_PRINCIPLE', severity: 'warning', values: { phi: p.phiPi } });
  if (spec.regime === 'peg' && p.iPeg < p.iLB) out.push({ code: 'PEG_BELOW_LB', severity: 'error', values: { peg: p.iPeg, lb: p.iLB } });
  return out;
}

export function solveISMP(spec: ISMPSpec): ISMPResult {
  const pre = validateISMP(spec);
  if (pre.some((x) => x.severity === 'error')) return { ok: false, issues: pre };
  const p = spec.params;
  const D = delta(p);
  let x: number;
  let pi: number;
  let i: number;
  let iRule: number;
  let binding = false;
  if (spec.regime === 'peg') {
    i = p.iPeg;
    x = p.d - p.sigma * (i - p.piE - p.rn);
    pi = phillips(p, x);
    iRule = ruleRate(p, pi, x);
  } else {
    x = (p.d - p.sigma * (p.rStar - p.rn + p.v + (1 + p.phiPi) * p.u + p.phiPi * (p.piE - p.piStar))) / D;
    pi = phillips(p, x);
    iRule = ruleRate(p, pi, x);
    i = iRule;
    if (iRule < p.iLB) {
      binding = true;
      i = p.iLB;
      x = p.d - p.sigma * (i - p.piE - p.rn);
      pi = phillips(p, x);
      iRule = ruleRate(p, pi, x);
    }
  }
  const e: ISMPEquilibrium = { x, pi, i, r: i - p.piE, iRule };
  if (!Object.values(e).every(Number.isFinite)) return { ok: false, issues: [...pre, { code: 'NON_FINITE', severity: 'error' }] };
  const issues = [...pre];
  if (binding) issues.push({ code: 'ELB_BINDING', severity: 'info', values: { lb: p.iLB, rule: iRule } });
  if (pi < 0) issues.push({ code: 'DEFLATION', severity: 'warning', values: { pi } });
  const free = spec.regime === 'rule' && !binding;
  const dx_dd = free ? 1 / D : 1;
  const dx_du = free ? (-p.sigma * (1 + p.phiPi)) / D : 0;
  return {
    ok: true,
    value: {
      spec,
      equilibrium: e,
      elbBinding: binding,
      derivatives: {
        dx_dd,
        dpi_dd: p.kappa * dx_dd,
        dx_du,
        dpi_du: p.kappa * dx_du + 1,
        di_dd: free ? (p.kappa * (1 + p.phiPi) + p.phiY) / D : 0,
      },
      residuals: {
        is: x - (p.d - p.sigma * (i - p.piE - p.rn)),
        pc: pi - phillips(p, x),
        rule: spec.regime === 'rule' ? i - Math.max(ruleRate(p, pi, x), p.iLB) : i - p.iPeg,
      },
      issues,
    },
  };
}

export type ISMPEqKey = keyof ISMPEquilibrium;

export function compareISMP(s0: ISMPSolved, s1: ISMPSolved) {
  const changes = Object.fromEntries((Object.keys(s0.equilibrium) as ISMPEqKey[]).map((k) => [k, change(s0.equilibrium[k], s1.equilibrium[k])])) as Record<ISMPEqKey, Change>;
  const paramChanges: Partial<Record<ISMPParamKey, Change>> = {};
  for (const k of KEYS) if (Math.abs(s1.spec.params[k] - s0.spec.params[k]) > 1e-12) paramChanges[k] = change(s0.spec.params[k], s1.spec.params[k]);
  return { changes, paramChanges };
}
export type ISMPComparison = ReturnType<typeof compareISMP>;

/** Equilibrium gap and inflation as a policy coefficient varies, for the given shocks. */
export function policySensitivity(spec: ISMPSpec, param: 'phiPi' | 'phiY', from: number, to: number, n = 40) {
  const out: { x: number; gap: number; pi: number; i: number }[] = [];
  for (let j = 0; j <= n; j += 1) {
    const v = from + ((to - from) * j) / n;
    const r = solveISMP({ ...spec, params: { ...spec.params, [param]: v } });
    if (r.ok) out.push({ x: v, gap: r.value.equilibrium.x, pi: r.value.equilibrium.pi, i: r.value.equilibrium.i });
  }
  return out;
}

export type ISMPPresetId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8' | 'G9';

export const ISMP_PRESETS: readonly { id: ISMPPresetId; regime: MPRegime; shock: Partial<ISMPParams> }[] = [
  { id: 'G1', regime: 'rule', shock: { piStar: 3 } }, // higher inflation target (expectations unchanged)
  { id: 'G2', regime: 'rule', shock: { piStar: 1 } }, // lower inflation target
  { id: 'G3', regime: 'rule', shock: { d: 2 } }, // positive demand shock
  { id: 'G4', regime: 'rule', shock: { d: -2 } }, // negative demand shock
  { id: 'G5', regime: 'rule', shock: { u: 1 } }, // inflationary supply shock
  { id: 'G6', regime: 'rule', shock: { rn: 3, rStar: 3 } }, // higher neutral rate (recognised by the CB)
  { id: 'G7', regime: 'rule', shock: { v: 1 } }, // contractionary policy shock
  { id: 'G8', regime: 'rule', shock: { v: -1 } }, // expansionary policy shock
  { id: 'G9', regime: 'rule', shock: { d: -10 } }, // large negative demand shock: the rule would need i < 0 (binds for d < −8.2)
];
