import { readPref, writePref } from '../state/persistence';
import type { ExLevel, Exercise } from './bank';

/** Local progress of one exercise: attempts, errors and whether it was solved. */
export interface ExProgress {
  attempts: number;
  errors: number;
  solved: boolean;
  /** Solution revealed before solving it. */
  revealed: boolean;
}

export const PROGRESS_KEY = 'islm.exercises.v1';

export function loadProgress(): Record<string, ExProgress> {
  try {
    const raw = readPref(PROGRESS_KEY);
    const o = raw ? (JSON.parse(raw) as unknown) : null;
    if (!o || typeof o !== 'object') return {};
    const out: Record<string, ExProgress> = {};
    for (const [k, v] of Object.entries(o as Record<string, Partial<ExProgress>>)) {
      if (!v || typeof v !== 'object') continue;
      out[k] = { attempts: Number(v.attempts) || 0, errors: Number(v.errors) || 0, solved: v.solved === true, revealed: v.revealed === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function storeProgress(p: Record<string, ExProgress>): void {
  writePref(PROGRESS_KEY, JSON.stringify(p));
}

/** Records one verification: correct answers and wrong answers given in that attempt. */
export function recordAttempt(p: Record<string, ExProgress>, id: string, wrong: number, allCorrect: boolean): Record<string, ExProgress> {
  const prev = p[id] ?? { attempts: 0, errors: 0, solved: false, revealed: false };
  return { ...p, [id]: { ...prev, attempts: prev.attempts + 1, errors: prev.errors + wrong, solved: prev.solved || allCorrect } };
}

export interface LevelSummary {
  level: ExLevel;
  total: number;
  attempted: number;
  solved: number;
}

export function summarizeProgress(list: Exercise[], p: Record<string, ExProgress>) {
  const levels: ExLevel[] = ['inicial', 'intermedio', 'avanzado'];
  const byLevel: LevelSummary[] = levels.map((level) => {
    const xs = list.filter((e) => e.level === level);
    return { level, total: xs.length, attempted: xs.filter((e) => (p[e.id]?.attempts ?? 0) > 0).length, solved: xs.filter((e) => p[e.id]?.solved).length };
  });
  const ids = new Set(list.map((e) => e.id));
  const rows = Object.entries(p).filter(([k]) => ids.has(k));
  return {
    byLevel,
    attempted: rows.filter(([, v]) => v.attempts > 0).length,
    solved: rows.filter(([, v]) => v.solved).length,
    errors: rows.reduce((a, [, v]) => a + v.errors, 0),
    total: list.length,
  };
}
