import {
  compare,
  solve,
  type Comparison,
  type EconomySpec,
  type SolveResult,
  type SolvedEconomy,
  type ValidationIssue,
} from '../engine';
import { buildInsights, moneySupplyCounterfactual, type InsightReport } from '../interpretation/insights';
import type { SavedScenario, SimState } from './store';

export interface SimulationOk {
  ok: true;
  e0: SolvedEconomy;
  e1: SolvedEconomy;
  comparison: Comparison;
  insights: InsightReport;
  /** Same shock with M frozen at M₀ (only under interest targeting). */
  counterfactual: SolvedEconomy | null;
}

export interface SimulationError {
  ok: false;
  /** Which equilibrium failed, with its issues. */
  failures: { side: 'baseline' | 'shocked'; issues: ValidationIssue[] }[];
  /** Whichever equilibria could still be solved (for partial display). */
  e0: SolvedEconomy | null;
  e1: SolvedEconomy | null;
}

export type Simulation = SimulationOk | SimulationError;

export function specsOf(s: Pick<SimState, 'baseline' | 'shocked' | 'regime' | 'target0' | 'target1'>): [EconomySpec, EconomySpec] {
  return [
    { params: s.baseline, regime: s.regime, targetRate: s.target0 },
    { params: s.shocked, regime: s.regime, targetRate: s.target1 },
  ];
}

export function runSimulation(s: Pick<SimState, 'baseline' | 'shocked' | 'regime' | 'target0' | 'target1'>): Simulation {
  const [spec0, spec1] = specsOf(s);
  const r0: SolveResult = solve(spec0);
  const r1: SolveResult = solve(spec1);
  if (!r0.ok || !r1.ok) {
    const failures: SimulationError['failures'] = [];
    if (!r0.ok) failures.push({ side: 'baseline', issues: r0.issues });
    if (!r1.ok) failures.push({ side: 'shocked', issues: r1.issues });
    return { ok: false, failures, e0: r0.ok ? r0.value : null, e1: r1.ok ? r1.value : null };
  }
  const comparison = compare(r0.value, r1.value);
  return {
    ok: true,
    e0: r0.value,
    e1: r1.value,
    comparison,
    insights: buildInsights(r0.value, r1.value, comparison),
    counterfactual: moneySupplyCounterfactual(r0.value, r1.value),
  };
}

export function simulateSaved(s: SavedScenario): Simulation {
  return runSimulation(s);
}
