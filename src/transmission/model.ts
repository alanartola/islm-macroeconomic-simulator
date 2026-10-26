import {
  DEFAULT_PARAMS,
  autonomousSpending,
  isOutputAt,
  lmOutputAt,
  moneyDemand,
  realMoney,
  type ModelParams,
  type PolicyRegime,
  type SolvedEconomy,
} from '../engine';

/*
 * Geometry of the three-quadrant diagram, derived only from the Module A
 * engine (traditional IS-LM). Nothing here solves the model again: the two
 * equilibria come from `solve`; the curves are the model's own equations
 * evaluated at those equilibria.
 *
 *   Goods market  DA(Y; i) = C₀ + c(Y − T) + I₀ − b·i + G    (planned demand at a given rate)
 *   IS–LM         IS: Y = α(A − b·i);  LM: Y = (M/P + h·i)/k, or i = ī (rate target)
 *   Money market  L(i; Y) = kY − h·i  (real money demand at a given income), supply M/P
 *
 * Auxiliary points are comparative-statics decompositions, not a time path:
 *   - Keynesian point: output on the new IS at the initial rate, Y_K = α₁(A₁ − b₁·i₀).
 *   - Liquidity point: rate that clears the money market at the INITIAL income
 *     after a change in M/P, i_L = (k·Y₀ − M₁/P)/h.
 */

export interface TransmissionInput {
  baseline: ModelParams;
  shocked: ModelParams;
  regime: PolicyRegime;
  target0: number;
  target1: number;
}

export type Family = 'none' | 'money' | 'spending' | 'target' | 'accommodation' | 'generic';

/** Planned aggregate demand at output Y with the rate held at i (one point of a DA line). */
export function plannedDemand(p: ModelParams, Y: number, i: number): number {
  return p.C0 + p.c * (Y - p.T) + p.I0 - p.b * i + p.G;
}

/** Real money balances demanded at rate i and income Y (one point of a demand curve). */
export const demandAt = (p: ModelParams, Y: number, i: number) => moneyDemand(p, Y, i);

/** Rate at which real money demand equals m at income Y: i = (kY − m)/h (h > 0). */
export function rateClearing(p: ModelParams, Y: number, m: number): number | null {
  return p.h > 0 ? (p.k * Y - m) / p.h : null;
}

const KEYS: (keyof ModelParams)[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];
const changed = (a: ModelParams, b: ModelParams) => KEYS.filter((k) => Math.abs(a[k] - b[k]) > 1e-12);

/** Classifies the perturbation to choose the explanation; mixed shocks get the generic sequence. */
export function familyOf(x: TransmissionInput): Family {
  const keys = changed(x.baseline, x.shocked);
  const targetMoved = x.regime === 'interest-target' && Math.abs(x.target1 - x.target0) > 1e-12;
  const spending = keys.length > 0 && keys.every((k) => k === 'G' || k === 'T' || k === 'I0' || k === 'C0');
  if (x.regime === 'interest-target') {
    // Under a rate target M is endogenous: a change in M alone changes nothing.
    const effective = keys.filter((k) => k !== 'M');
    if (!effective.length && !targetMoved) return 'none';
    if (targetMoved && !effective.length) return 'target';
    if (!targetMoved && effective.every((k) => k === 'G' || k === 'T' || k === 'I0' || k === 'C0')) return 'accommodation';
    return 'generic';
  }
  if (!keys.length) return 'none';
  if (keys.every((k) => k === 'M')) return 'money';
  if (spending) return 'spending';
  return 'generic';
}

export interface Point {
  Y: number;
  i: number;
}

export interface TransmissionGeometry {
  family: Family;
  regime: PolicyRegime;
  p0: ModelParams;
  p1: ModelParams;
  e0: Point & { I: number; m: number; DA: number };
  e1: Point & { I: number; m: number; DA: number };
  /** Output on the new IS at the initial rate (spending shocks). */
  keynes: Point | null;
  /** Money-market clearing rate at the initial income after the change in M/P (money shocks). */
  liquidity: { m: number; i: number } | null;
  /** Change in autonomous spending ΔA = ΔC₀ − Δ(cT) + ΔI₀ + ΔG. */
  dA: number;
  /** Investment lost through the change in the rate: −b₁·(i₁ − i₀). */
  crowdingOut: number;
  /** Does each curve move between the two equilibria? */
  moved: { da: boolean; is: boolean; lm: boolean; ld: boolean; ms: boolean };
}

/** Everything the three charts draw, from the two solved equilibria of the engine. */
export function geometry(x: TransmissionInput, s0: SolvedEconomy, s1: SolvedEconomy): TransmissionGeometry {
  const p0 = s0.spec.params;
  const p1 = s1.spec.params;
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const family = familyOf(x);
  const keynes = family === 'spending' || family === 'generic' ? { Y: isOutputAt(p1, q0.i), i: q0.i } : null;
  let liquidity: TransmissionGeometry['liquidity'] = null;
  if (family === 'money' && p1.h > 0) liquidity = { m: realMoney(p1), i: (p1.k * q0.Y - realMoney(p1)) / p1.h };
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a));
  const isMoved = !near(isOutputAt(p0, 0), isOutputAt(p1, 0)) || !near(isOutputAt(p0, 10), isOutputAt(p1, 10));
  const lmMoved =
    x.regime === 'interest-target'
      ? !near(x.target0, x.target1)
      : !near(lmOutputAt(p0, 0), lmOutputAt(p1, 0)) || !near(lmOutputAt(p0, 10), lmOutputAt(p1, 10));
  return {
    family,
    regime: x.regime,
    p0,
    p1,
    e0: { Y: q0.Y, i: q0.i, I: q0.I, m: q0.realMoney, DA: plannedDemand(p0, q0.Y, q0.i) },
    e1: { Y: q1.Y, i: q1.i, I: q1.I, m: q1.realMoney, DA: plannedDemand(p1, q1.Y, q1.i) },
    keynes,
    liquidity,
    dA: autonomousSpending(p1) - autonomousSpending(p0),
    crowdingOut: -p1.b * (q1.i - q0.i),
    moved: {
      da: !near(plannedDemand(p0, 0, q0.i), plannedDemand(p1, 0, q1.i)) || !near(p0.c, p1.c),
      is: isMoved,
      lm: lmMoved,
      ld: !near(demandAt(p0, q0.Y, 0), demandAt(p1, q1.Y, 0)) || !near(p0.h, p1.h),
      ms: !near(q0.realMoney, q1.realMoney) || (x.regime === 'interest-target' && !near(x.target0, x.target1)),
    },
  };
}

// ── Step-by-step explanation ────────────────────────────────────────────────

/** Elements that a step reveals; later steps keep the earlier ones visible. */
export type Element = 'ms1' | 'lm1' | 'liq' | 'da1' | 'daPre' | 'is1' | 'keynes' | 'ld1' | 'e1Money' | 'e1IsLm' | 'e1Goods';
export type Market = 'money' | 'islm' | 'goods' | 'all';

export interface Step {
  id: string;
  market: Market;
  show: Element[];
  /** i18n key suffix: tr.step.<family>.<id> */
  key: string;
}

const ALL_FINAL: Element[] = ['ms1', 'lm1', 'da1', 'is1', 'ld1', 'e1Money', 'e1IsLm', 'e1Goods'];

/** Ordered stages of comparative statics, adapted to the shock and the monetary regime. */
export function stepsOf(family: Family): Step[] {
  const s = (id: string, market: Market, show: Element[]): Step => ({ id, market, show, key: `${family}.${id}` });
  switch (family) {
    case 'money':
      return [
        s('supply', 'money', ['ms1']),
        s('lm', 'islm', ['lm1']),
        s('rate', 'money', ['liq']),
        s('investment', 'goods', []),
        s('demand', 'goods', ['da1']),
        s('output', 'islm', ['e1IsLm', 'e1Goods']),
        s('joint', 'all', ['ld1', 'e1Money']),
      ];
    case 'spending':
      return [
        s('demand', 'goods', ['daPre']),
        s('is', 'islm', ['is1', 'keynes']),
        s('money', 'money', ['ld1', 'e1Money']),
        s('rate', 'islm', ['e1IsLm']),
        s('investment', 'goods', ['da1', 'e1Goods']),
        s('joint', 'all', []),
      ];
    case 'target':
      return [
        s('rate', 'money', ['ms1']),
        s('lm', 'islm', ['lm1']),
        s('investment', 'goods', []),
        s('demand', 'goods', ['da1', 'e1Goods']),
        s('output', 'islm', ['e1IsLm']),
        s('money', 'money', ['ld1', 'e1Money']),
      ];
    case 'accommodation':
      return [
        s('demand', 'goods', ['da1', 'e1Goods']),
        s('is', 'islm', ['is1', 'e1IsLm']),
        s('money', 'money', ['ld1', 'e1Money', 'ms1']),
        s('joint', 'all', ['lm1']),
      ];
    case 'generic':
      return [s('curves', 'all', ['is1', 'lm1', 'ld1', 'ms1', 'daPre']), s('rate', 'islm', ['e1IsLm', 'keynes']), s('money', 'money', ['e1Money']), s('goods', 'goods', ['da1', 'e1Goods'])];
    default:
      return [];
  }
}

/** Elements visible at step k (k < 0: initial equilibrium only; k ≥ number of steps or no step mode: final state). */
export function visibleAt(steps: Step[], k: number | null): Set<Element> {
  if (k === null) return new Set(ALL_FINAL);
  const out = new Set<Element>();
  for (let j = 0; j <= Math.min(k, steps.length - 1); j += 1) for (const e of steps[j]!.show) out.add(e);
  return out;
}

// ── Scenarios of the policy / shock menu ────────────────────────────────────

/** Size of the perturbation: a change Δ applied to one parameter (or to the target rate). */
export interface Knob {
  key: keyof ModelParams | 'target';
  /** Default Δ and the range offered by the magnitude slider. */
  delta: number;
  min: number;
  max: number;
  step: number;
}

export interface Scenario {
  id: string;
  regime: PolicyRegime;
  knob: Knob | null;
}

const k = (key: Knob['key'], delta: number, min: number, max: number, step: number): Knob => ({ key, delta, min, max, step });

export const SCENARIOS: Scenario[] = [
  { id: 'initial', regime: 'money-supply', knob: null },
  { id: 'monetaryExpansion', regime: 'money-supply', knob: k('M', 70, 10, 350, 10) },
  { id: 'monetaryContraction', regime: 'money-supply', knob: k('M', -70, -350, -10, 10) },
  { id: 'fiscalExpansion', regime: 'money-supply', knob: k('G', 50, 10, 250, 10) },
  { id: 'fiscalContraction', regime: 'money-supply', knob: k('G', -50, -200, -10, 10) },
  { id: 'taxIncrease', regime: 'money-supply', knob: k('T', 50, 10, 250, 10) },
  { id: 'taxCut', regime: 'money-supply', knob: k('T', -50, -200, -10, 10) },
  { id: 'investmentUp', regime: 'money-supply', knob: k('I0', 50, 10, 250, 10) },
  { id: 'investmentDown', regime: 'money-supply', knob: k('I0', -50, -150, -10, 10) },
  { id: 'investmentSensitivity', regime: 'money-supply', knob: k('b', 15, 5, 75, 5) },
  { id: 'moneyDemandSensitivity', regime: 'money-supply', knob: k('h', 30, 10, 200, 10) },
  { id: 'rateCut', regime: 'interest-target', knob: k('target', -1, -4.5, -0.25, 0.25) },
  { id: 'rateHike', regime: 'interest-target', knob: k('target', 1, 0.25, 5, 0.25) },
  { id: 'fiscalAccommodated', regime: 'interest-target', knob: k('G', 50, 10, 250, 10) },
];

/** Economy of a scenario with a perturbation of size Δ (default: the scenario's own). */
export function scenarioInput(sc: Scenario, delta?: number): TransmissionInput {
  const base = { ...DEFAULT_PARAMS };
  const shocked = { ...DEFAULT_PARAMS };
  let target1 = 5;
  if (sc.knob) {
    const d = delta ?? sc.knob.delta;
    if (sc.knob.key === 'target') target1 = 5 + d;
    else shocked[sc.knob.key] = base[sc.knob.key] + d;
  }
  return { baseline: base, shocked, regime: sc.regime, target0: 5, target1 };
}

/** Current Δ of a scenario's parameter in an economy (null when the scenario has no knob). */
export function deltaOf(sc: Scenario, x: TransmissionInput): number | null {
  if (!sc.knob) return null;
  return sc.knob.key === 'target' ? x.target1 - x.target0 : x.shocked[sc.knob.key] - x.baseline[sc.knob.key];
}
