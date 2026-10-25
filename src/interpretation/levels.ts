import type { TemplateVar } from '../i18n/format';

/**
 * Five-level economic explanation shared by every module:
 *   1 What changed            (exogenous variables / policies)
 *   2 Transmission mechanism  (how each market is affected)
 *   3 Equilibrium             (changes of endogenous variables)
 *   4 Mathematical explanation(equations and the numbers behind the result)
 *   5 Macroeconomic interpretation
 *
 * Level-5 items carry a `nature` tag so the UI can distinguish strictly
 * mathematical results of the model, theoretical interpretations and possible
 * economic implications (which the model cannot prove).
 */
export type Level = 1 | 2 | 3 | 4 | 5;
export type Nature = 'result' | 'theory' | 'implication' | 'caveat';

export interface LevelItem {
  key: string;
  vars?: Record<string, TemplateVar>;
  /** Level 4 items are rendered as equations (monospace). */
  math?: boolean;
  nature?: Nature;
}

export interface LeveledReport {
  noShock: boolean;
  headline: LevelItem[];
  levels: Record<Level, LevelItem[]>;
}

export function emptyLevels(): Record<Level, LevelItem[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] };
}

export const dirKey = (x: number, pos: string, neg: string) => ({ key: x >= 0 ? pos : neg });
export const nonZero = (x: number, tol = 1e-7) => Math.abs(x) > tol;

/**
 * Level-1 item for a parameter change. The percentage change is omitted when
 * the initial value is zero (it is undefined, never reported as 0 %).
 */
export function causeParam(nameKey: string, c: { from: number; to: number; abs: number; pct: number | null }): LevelItem {
  const vars = { param: { key: nameKey }, from: c.from, to: c.to, delta: c.abs };
  return c.pct === null ? { key: 'lvl.cause.paramAbs', vars } : { key: 'lvl.cause.param', vars: { ...vars, pct: c.pct } };
}
