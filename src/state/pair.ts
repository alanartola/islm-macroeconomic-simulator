import { useCallback, useReducer } from 'react';

/**
 * Generic state for an experiment with an initial economy E₀ and a perturbed
 * economy E₁ over the same parameter vector P (used by Modules B–G).
 * Editing E₀ carries the change to E₁ for every parameter that was not
 * perturbed (E₁ value equal to the old E₀ value), as in Module A.
 */
export interface PairState<P extends Record<string, number>> {
  baseline: P;
  shocked: P;
  editing: 'baseline' | 'shocked';
}

export type PairAction<P extends Record<string, number>> =
  | { type: 'set'; key: keyof P; value: number }
  | { type: 'editing'; side: 'baseline' | 'shocked' }
  | { type: 'reset' }
  | { type: 'adopt' }
  | { type: 'load'; baseline: P; shocked: P };

export function pairReducer<P extends Record<string, number>>(s: PairState<P>, a: PairAction<P>): PairState<P> {
  switch (a.type) {
    case 'set': {
      if (s.editing === 'shocked') return { ...s, shocked: { ...s.shocked, [a.key]: a.value } };
      const linked = s.shocked[a.key] === s.baseline[a.key];
      return {
        ...s,
        baseline: { ...s.baseline, [a.key]: a.value },
        shocked: linked ? { ...s.shocked, [a.key]: a.value } : s.shocked,
      };
    }
    case 'editing':
      return { ...s, editing: a.side };
    case 'reset':
      return { ...s, shocked: { ...s.baseline } };
    case 'adopt':
      return { ...s, baseline: { ...s.shocked } };
    case 'load':
      return { ...s, baseline: { ...a.baseline }, shocked: { ...a.shocked } };
    default:
      return s;
  }
}

export function usePair<P extends Record<string, number>>(defaults: P) {
  const [state, dispatch] = useReducer(pairReducer<P>, { baseline: { ...defaults }, shocked: { ...defaults }, editing: 'shocked' } as PairState<P>);
  const set = useCallback((key: keyof P, value: number) => dispatch({ type: 'set', key, value }), []);
  return { state, dispatch, set };
}
