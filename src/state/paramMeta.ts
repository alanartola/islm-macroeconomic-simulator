import type { ParamKey } from '../engine';

export type ParamGroup = 'goods' | 'money';

export interface ParamMeta {
  key: ParamKey;
  group: ParamGroup;
  min: number;
  max: number;
  step: number;
  /** Decimals shown in the numeric input. */
  digits: number;
  /** Unit translation key. */
  unit: 'unit.bn' | 'unit.bnPerPp' | 'unit.ratio' | 'unit.index';
  /** Policy instruments are highlighted in the UI. */
  instrument?: 'fiscal' | 'monetary';
}

/**
 * Slider ranges. They are UI conveniences, not model restrictions: the numeric
 * inputs accept any value and the engine validates it (see engine/validation.ts).
 */
export const PARAM_META: readonly ParamMeta[] = [
  { key: 'G', group: 'goods', min: 0, max: 800, step: 5, digits: 0, unit: 'unit.bn', instrument: 'fiscal' },
  { key: 'T', group: 'goods', min: 0, max: 800, step: 5, digits: 0, unit: 'unit.bn', instrument: 'fiscal' },
  { key: 'C0', group: 'goods', min: 0, max: 800, step: 5, digits: 0, unit: 'unit.bn' },
  { key: 'c', group: 'goods', min: 0, max: 0.98, step: 0.01, digits: 2, unit: 'unit.ratio' },
  { key: 'I0', group: 'goods', min: 0, max: 900, step: 5, digits: 0, unit: 'unit.bn' },
  { key: 'b', group: 'goods', min: 0, max: 150, step: 0.5, digits: 1, unit: 'unit.bnPerPp' },
  { key: 'M', group: 'money', min: 50, max: 2500, step: 5, digits: 0, unit: 'unit.bn', instrument: 'monetary' },
  { key: 'P', group: 'money', min: 0.2, max: 3, step: 0.01, digits: 2, unit: 'unit.index' },
  { key: 'k', group: 'money', min: 0.05, max: 2, step: 0.01, digits: 2, unit: 'unit.ratio' },
  { key: 'h', group: 'money', min: 0, max: 500, step: 1, digits: 0, unit: 'unit.bnPerPp' },
];

export const TARGET_RATE_META = { min: -2, max: 15, step: 0.05, digits: 2 } as const;

export function metaOf(key: ParamKey): ParamMeta {
  const m = PARAM_META.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown parameter ${key}`);
  return m;
}
