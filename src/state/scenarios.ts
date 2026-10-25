import type { ModelParams, PolicyRegime } from '../engine';

export type PresetId =
  | 'A' // expansionary monetary
  | 'B' // contractionary monetary
  | 'C1' // expansionary fiscal: G↑
  | 'C2' // expansionary fiscal: T↓
  | 'D1' // contractionary fiscal: G↓
  | 'D2' // contractionary fiscal: T↑
  | 'E1' // negative autonomous-investment shock
  | 'E2' // positive autonomous-investment shock
  | 'F1' // investment more interest-sensitive (b↑)
  | 'F2' // money demand more interest-sensitive (h↑)
  | 'R1' // interest-target regime: policy-rate cut
  | 'R2'; // interest-target regime: policy-rate hike

export interface PresetDefinition {
  id: PresetId;
  group: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'R';
  /** Regime the preset requires; undefined keeps the current regime. */
  regime?: PolicyRegime;
  /** Transforms the baseline into the shocked parameters. */
  apply: (base: ModelParams) => ModelParams;
  /** Change of the policy-rate target (pp), only for interest-target presets. */
  targetDelta?: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Hypothetical policy experiments. Shocks are proportional to the baseline so
 * they stay meaningful if the user recalibrates E₀; with the default
 * calibration they produce round numbers (ΔM = ±100, ΔG = ±50, ΔT = ∓50,
 * ΔI₀ = ∓50).
 */
export const PRESETS: readonly PresetDefinition[] = [
  { id: 'A', group: 'A', regime: 'money-supply', apply: (p) => ({ ...p, M: r2(p.M * (8 / 7)) }) },
  { id: 'B', group: 'B', regime: 'money-supply', apply: (p) => ({ ...p, M: r2(p.M * (6 / 7)) }) },
  { id: 'C1', group: 'C', apply: (p) => ({ ...p, G: r2(p.G * 1.2) }) },
  { id: 'C2', group: 'C', apply: (p) => ({ ...p, T: r2(p.T * 0.75) }) },
  { id: 'D1', group: 'D', apply: (p) => ({ ...p, G: r2(p.G * 0.8) }) },
  { id: 'D2', group: 'D', apply: (p) => ({ ...p, T: r2(p.T * 1.25) }) },
  { id: 'E1', group: 'E', apply: (p) => ({ ...p, I0: r2(p.I0 * (5 / 6)) }) },
  { id: 'E2', group: 'E', apply: (p) => ({ ...p, I0: r2(p.I0 * (7 / 6)) }) },
  { id: 'F1', group: 'F', apply: (p) => ({ ...p, b: r2(p.b * 2) }) },
  { id: 'F2', group: 'F', apply: (p) => ({ ...p, h: r2(p.h * 3) }) },
  { id: 'R1', group: 'R', regime: 'interest-target', apply: (p) => ({ ...p }), targetDelta: -1 },
  { id: 'R2', group: 'R', regime: 'interest-target', apply: (p) => ({ ...p }), targetDelta: 1 },
];

export function presetById(id: PresetId): PresetDefinition {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown preset ${id}`);
  return p;
}
