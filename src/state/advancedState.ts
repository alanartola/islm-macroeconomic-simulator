import {
  ADV_DEFAULTS,
  ADV_PRESETS,
  compareAdvanced,
  solveAdvanced,
  tangentLinearSpec,
  type AdvComparison,
  type AdvIssue,
  type AdvParams,
  type AdvPresetId,
  type AdvRegime,
  type AdvSolved,
  type AdvSpec,
  type LMSpec,
} from '../engine/advanced';
import { buildAdvancedInsights } from '../interpretation/advancedInsights';
import type { LeveledReport } from '../interpretation/levels';
import { pairReducer, type PairAction, type PairState } from './pair';

/** Shared state of Modules B (advanced IS-LM), C (curve construction) and D (policy lab). */
export interface AdvState extends PairState<AdvParams & Record<string, number>> {
  lm: LMSpec;
  regime: AdvRegime;
  target0: number;
  target1: number;
  /** Overlay the linear LM tangent to the non-linear LM at E₀. */
  compareTangent: boolean;
  preset: AdvPresetId | null;
}

export type AdvAction =
  | PairAction<AdvParams & Record<string, number>>
  | { type: 'lm'; lm: LMSpec }
  | { type: 'regime'; regime: AdvRegime }
  | { type: 'target'; value: number }
  | { type: 'compare'; on: boolean }
  | { type: 'preset'; id: AdvPresetId }
  | { type: 'restore' }
  /** Load a complete saved configuration (scenario lab / shared link). */
  | { type: 'hydrate'; baseline: AdvParams; shocked: AdvParams; lm: LMSpec; regime: AdvRegime; target0: number; target1: number }
  /** Edit E₀ directly (used by the policy lab), carrying unperturbed values to E₁. */
  | { type: 'setBase'; key: keyof AdvParams; value: number };

export function initialAdvState(): AdvState {
  return {
    baseline: { ...ADV_DEFAULTS },
    shocked: { ...ADV_DEFAULTS },
    editing: 'shocked',
    lm: 'nonlinear',
    regime: 'money',
    target0: 5,
    target1: 5,
    compareTangent: false,
    preset: null,
  };
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function advReducer(s: AdvState, a: AdvAction): AdvState {
  switch (a.type) {
    case 'hydrate':
      return {
        ...s,
        baseline: { ...a.baseline },
        shocked: { ...a.shocked },
        lm: a.lm,
        regime: a.regime,
        target0: a.target0,
        target1: a.target1,
        compareTangent: false,
        preset: null,
      };
    case 'lm':
      return { ...s, lm: a.lm, preset: null, compareTangent: a.lm === 'nonlinear' ? s.compareTangent : false };
    case 'regime': {
      if (a.regime === s.regime) return s;
      if (a.regime === 'rate') {
        // Peg the rate at the current initial equilibrium so E₀ is unchanged by the switch.
        const r = solveAdvanced(specOf(s, 'baseline'));
        const i0 = r.ok ? round(r.value.equilibrium.i, 4) : s.target0;
        return { ...s, regime: 'rate', target0: i0, target1: i0, shocked: { ...s.shocked, M: s.baseline.M }, preset: null };
      }
      // Back to money targeting: freeze M at the stock the peg required at E₀.
      const r = solveAdvanced(specOf(s, 'baseline'));
      const M = r.ok ? round(r.value.equilibrium.M, 4) : s.baseline.M;
      return { ...s, regime: 'money', baseline: { ...s.baseline, M }, shocked: { ...s.shocked, M }, preset: null };
    }
    case 'target':
      if (s.editing === 'shocked') return { ...s, target1: a.value, preset: null };
      return { ...s, target0: a.value, target1: s.target1 === s.target0 ? a.value : s.target1 };
    case 'compare':
      return { ...s, compareTangent: a.on };
    case 'preset': {
      const pr = ADV_PRESETS.find((x) => x.id === a.id);
      if (!pr) return s;
      const baseline = { ...ADV_DEFAULTS, ...pr.base };
      return {
        ...s,
        lm: pr.lm,
        regime: pr.regime,
        target0: pr.targetRate ?? s.target0,
        target1: pr.targetRate ?? s.target0,
        baseline,
        shocked: { ...baseline, ...pr.shock },
        editing: 'shocked',
        preset: pr.id,
        compareTangent: pr.lm === 'nonlinear' ? s.compareTangent : false,
      };
    }
    case 'restore':
      return { ...initialAdvState() };
    case 'setBase': {
      const linked = s.shocked[a.key] === s.baseline[a.key];
      return {
        ...s,
        baseline: { ...s.baseline, [a.key]: a.value },
        shocked: linked ? { ...s.shocked, [a.key]: a.value } : s.shocked,
        preset: null,
      };
    }
    case 'reset':
      return { ...pairReducer(s, a), target1: s.target0, preset: null } as AdvState;
    case 'adopt':
      return { ...pairReducer(s, a), target0: s.target1, preset: null } as AdvState;
    default:
      return { ...(pairReducer(s, a) as AdvState), preset: a.type === 'set' ? null : s.preset };
  }
}

export function specOf(s: Pick<AdvState, 'baseline' | 'shocked' | 'lm' | 'regime' | 'target0' | 'target1'>, side: 'baseline' | 'shocked'): AdvSpec {
  return { params: side === 'baseline' ? s.baseline : s.shocked, lm: s.lm, regime: s.regime, targetRate: side === 'baseline' ? s.target0 : s.target1 };
}

export interface AdvSimOk {
  ok: true;
  s0: AdvSolved;
  s1: AdvSolved;
  cmp: AdvComparison;
  report: LeveledReport;
  /** Same experiment with the linear LM tangent at E₀ (when requested and meaningful). */
  tangent: { s0: AdvSolved; s1: AdvSolved; cmp: AdvComparison } | null;
}
export interface AdvSimError {
  ok: false;
  failures: { side: 'baseline' | 'shocked'; issues: AdvIssue[] }[];
  s0: AdvSolved | null;
  s1: AdvSolved | null;
}
export type AdvSim = AdvSimOk | AdvSimError;

export function runAdvanced(s: AdvState): AdvSim {
  const r0 = solveAdvanced(specOf(s, 'baseline'));
  const r1 = solveAdvanced(specOf(s, 'shocked'));
  if (!r0.ok || !r1.ok) {
    const failures: AdvSimError['failures'] = [];
    if (!r0.ok) failures.push({ side: 'baseline', issues: r0.issues });
    if (!r1.ok) failures.push({ side: 'shocked', issues: r1.issues });
    return { ok: false, failures, s0: r0.ok ? r0.value : null, s1: r1.ok ? r1.value : null };
  }
  const cmp = compareAdvanced(r0.value, r1.value);
  let tangent: AdvSimOk['tangent'] = null;
  if (s.compareTangent && s.lm === 'nonlinear' && s.regime === 'money') {
    const lin0 = tangentLinearSpec(r0.value.spec, r0.value.equilibrium.Y, r0.value.equilibrium.i);
    // E₁ keeps the tangent coefficients (h, L₀) and applies the same exogenous changes.
    const lin1: AdvSpec = { ...lin0, params: { ...s.shocked, h: lin0.params.h, L0: lin0.params.L0 } };
    const t0 = solveAdvanced(lin0);
    const t1 = solveAdvanced(lin1);
    if (t0.ok && t1.ok) tangent = { s0: t0.value, s1: t1.value, cmp: compareAdvanced(t0.value, t1.value) };
  }
  return { ok: true, s0: r0.value, s1: r1.value, cmp, report: buildAdvancedInsights(r0.value, r1.value, cmp), tangent };
}

/** Validation messages of both equilibria, grouped for display. */
export function issueGroups(sim: AdvSim) {
  if (sim.ok) {
    return [
      { side: 'baseline' as const, issues: sim.s0.issues },
      { side: 'shocked' as const, issues: sim.s1.issues },
    ];
  }
  return sim.failures;
}

