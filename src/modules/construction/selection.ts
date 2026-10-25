import { alphaOf, crossEquilibrium, investmentAt, lmPointForOutput, realMoneyOf } from '../../engine/advanced';
import type { AdvSimOk } from '../../state/advancedState';

/** User selections of the construction charts (rates for IS, incomes for LM, steps). */
export interface Selection {
  ia: number;
  ib: number;
  Ya: number;
  Yb: number;
  stepIS: number;
  stepLM: number;
  rounds: boolean;
}

const r = (x: number, step: number) => Math.round(x / step) * step;

/** Defaults around the current equilibrium E₁, kept inside the LM domain. */
export function defaultSelection(sim: AdvSimOk): Omit<Selection, 'stepIS' | 'stepLM' | 'rounds'> {
  const q = sim.s1.equilibrium;
  const p = sim.s1.spec.params;
  let ia = r(q.i - 2, 0.5);
  if (sim.s1.spec.lm === 'nonlinear') ia = Math.max(ia, r(p.iMin + 0.5, 0.5));
  const ib = r(q.i + 2, 0.5);
  const Ya = r(q.Y - 300, 50);
  let Yb = r(q.Y + 100, 50);
  if (sim.s1.spec.lm === 'nonlinear') Yb = Math.min(Yb, r((realMoneyOf(p) / p.k) * 0.985, 10));
  return { ia, ib, Ya, Yb };
}

/** Numbers shown in the step-by-step IS construction. */
export function isSteps(sim: AdvSimOk, sel: Selection) {
  const p = sim.s1.spec.params;
  return {
    Ia: investmentAt(p, sel.ia),
    Ib: investmentAt(p, sel.ib),
    Ya: crossEquilibrium(p, sel.ia),
    Yb: crossEquilibrium(p, sel.ib),
    alpha: alphaOf(p),
    slope: -(1 - p.c * (1 - p.t)) / p.b,
  };
}


/** Numbers shown in the step-by-step LM construction. */
export function lmSteps(sim: AdvSimOk, sel: Selection) {
  const spec = { ...sim.s1.spec, regime: 'money' as const };
  const p = spec.params;
  return {
    m: realMoneyOf(p),
    Lta: p.k * sel.Ya,
    Ltb: p.k * sel.Yb,
    ia: lmPointForOutput(spec, sel.Ya),
    ib: lmPointForOutput(spec, sel.Yb),
  };
}

