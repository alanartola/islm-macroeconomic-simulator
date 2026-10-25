import { DEFAULT_PARAMS, DEFAULT_TARGET_RATE, solve, type ModelParams, type ParamKey, type PolicyRegime } from '../engine';
import { presetById, type PresetId } from './scenarios';

export type EditingSide = 'shocked' | 'baseline';

export interface SavedScenario {
  id: string;
  name: string;
  baseline: ModelParams;
  shocked: ModelParams;
  regime: PolicyRegime;
  target0: number;
  target1: number;
}

export interface ViewOptions {
  showInitial: boolean;
  showShifted: boolean;
  showGuides: boolean;
  hiddenSaved: string[];
}

export interface SimState {
  /** Exogenous inputs of the initial equilibrium E₀. */
  baseline: ModelParams;
  /** Exogenous inputs of the shocked equilibrium E₁. */
  shocked: ModelParams;
  regime: PolicyRegime;
  /** Policy-rate targets (pp) for E₀ and E₁ under the interest-target regime. */
  target0: number;
  target1: number;
  editing: EditingSide;
  activePreset: PresetId | null;
  saved: SavedScenario[];
  view: ViewOptions;
}

export type Action =
  | { type: 'setParam'; key: ParamKey; value: number }
  | { type: 'setTarget'; value: number }
  | { type: 'setEditing'; side: EditingSide }
  | { type: 'setRegime'; regime: PolicyRegime }
  | { type: 'applyPreset'; id: PresetId }
  | { type: 'resetShock' }
  | { type: 'adoptShock' }
  | { type: 'resetAll' }
  | { type: 'saveScenario'; name: string; id?: string }
  | { type: 'deleteScenario'; id: string }
  | { type: 'loadScenario'; id: string }
  | { type: 'toggleSaved'; id: string }
  | { type: 'toggleView'; key: Exclude<keyof ViewOptions, 'hiddenSaved'> }
  | { type: 'hydrate'; state: Partial<SimState> };

export const MAX_SAVED = 6;

export function initialState(): SimState {
  return {
    baseline: { ...DEFAULT_PARAMS },
    shocked: { ...DEFAULT_PARAMS },
    regime: 'money-supply',
    target0: DEFAULT_TARGET_RATE,
    target1: DEFAULT_TARGET_RATE,
    editing: 'shocked',
    activePreset: null,
    saved: [],
    view: { showInitial: true, showShifted: true, showGuides: true, hiddenSaved: [] },
  };
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Endogenous rate of the baseline under the money-supply regime (used when switching regimes). */
function baselineRate(p: ModelParams): number | null {
  const r = solve({ params: p, regime: 'money-supply', targetRate: 0 });
  return r.ok ? r.value.equilibrium.i : null;
}

/** Endogenous money stock of an economy under interest targeting. */
function requiredMoney(p: ModelParams, target: number): number | null {
  const r = solve({ params: p, regime: 'interest-target', targetRate: target });
  return r.ok ? r.value.equilibrium.M : null;
}

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `s${Date.now().toString(36)}${idCounter}`;
}

export function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'setParam': {
      const { key, value } = action;
      if (state.editing === 'shocked') {
        return { ...state, shocked: { ...state.shocked, [key]: value }, activePreset: null };
      }
      // Editing E₀: parameters that were not shocked (E₁ value equal to E₀) follow the baseline,
      // so recalibrating E₀ never introduces an unintended shock.
      const linked = state.shocked[key] === state.baseline[key];
      return {
        ...state,
        baseline: { ...state.baseline, [key]: value },
        shocked: linked ? { ...state.shocked, [key]: value } : state.shocked,
      };
    }
    case 'setTarget': {
      if (state.editing === 'shocked') return { ...state, target1: action.value, activePreset: null };
      const linked = state.target1 === state.target0;
      return { ...state, target0: action.value, target1: linked ? action.value : state.target1 };
    }
    case 'setEditing':
      return { ...state, editing: action.side };
    case 'setRegime': {
      if (action.regime === state.regime) return state;
      if (action.regime === 'interest-target') {
        // The central bank pegs the rate at the current initial equilibrium rate,
        // so E₀ is unchanged by the regime switch itself.
        const i0 = baselineRate(state.baseline);
        const t = i0 === null ? state.target0 : round(i0);
        return { ...state, regime: action.regime, target0: t, target1: t, shocked: { ...state.shocked, M: state.baseline.M }, activePreset: null };
      }
      // Back to money-supply targeting: freeze M at the stock the peg required at E₀.
      const M0 = requiredMoney(state.baseline, state.target0);
      const M = M0 !== null && M0 > 0 ? round(M0) : state.baseline.M;
      return {
        ...state,
        regime: action.regime,
        baseline: { ...state.baseline, M },
        shocked: { ...state.shocked, M },
        activePreset: null,
      };
    }
    case 'applyPreset': {
      const preset = presetById(action.id);
      let next: SimState = state;
      if (preset.regime && preset.regime !== state.regime) next = reducer(state, { type: 'setRegime', regime: preset.regime });
      const shocked = preset.apply(next.baseline);
      const target1 = preset.targetDelta !== undefined ? round(next.target0 + preset.targetDelta) : next.target0;
      return { ...next, shocked, target1, editing: 'shocked', activePreset: action.id };
    }
    case 'resetShock':
      return { ...state, shocked: { ...state.baseline }, target1: state.target0, activePreset: null };
    case 'adoptShock':
      return { ...state, baseline: { ...state.shocked }, target0: state.target1, activePreset: null };
    case 'resetAll':
      return { ...initialState(), saved: state.saved, view: state.view };
    case 'saveScenario': {
      const entry: SavedScenario = {
        id: action.id ?? newId(),
        name: action.name.trim() || `E₁ #${state.saved.length + 1}`,
        baseline: { ...state.baseline },
        shocked: { ...state.shocked },
        regime: state.regime,
        target0: state.target0,
        target1: state.target1,
      };
      const saved = [...state.saved, entry].slice(-MAX_SAVED);
      return { ...state, saved };
    }
    case 'deleteScenario':
      return {
        ...state,
        saved: state.saved.filter((s) => s.id !== action.id),
        view: { ...state.view, hiddenSaved: state.view.hiddenSaved.filter((x) => x !== action.id) },
      };
    case 'loadScenario': {
      const s = state.saved.find((x) => x.id === action.id);
      if (!s) return state;
      return {
        ...state,
        baseline: { ...s.baseline },
        shocked: { ...s.shocked },
        regime: s.regime,
        target0: s.target0,
        target1: s.target1,
        activePreset: null,
      };
    }
    case 'toggleSaved': {
      const hidden = state.view.hiddenSaved.includes(action.id)
        ? state.view.hiddenSaved.filter((x) => x !== action.id)
        : [...state.view.hiddenSaved, action.id];
      return { ...state, view: { ...state.view, hiddenSaved: hidden } };
    }
    case 'toggleView':
      return { ...state, view: { ...state.view, [action.key]: !state.view[action.key] } };
    case 'hydrate':
      return { ...state, ...action.state };
    default:
      return state;
  }
}
