import { FAMILY_ORDER, summarize, type Family, type LabScenario, type SummaryResult } from './scenario';

export interface ComparisonCell {
  v0: number;
  v1: number;
  delta: number;
}

export interface ComparisonRow {
  family: Family;
  /** One entry per selected scenario; null when the variable is not defined in that model. */
  cells: (ComparisonCell | null)[];
  /** True when at least two scenarios define the variable (numerical comparison is meaningful). */
  comparable: boolean;
}

export interface Comparison {
  scenarios: LabScenario[];
  summaries: SummaryResult[];
  rows: ComparisonRow[];
}

/** Builds the comparison table: only variables with identical definitions share a row. */
export function buildComparison(selected: LabScenario[]): Comparison {
  const summaries = selected.map((s) => summarize(s.config));
  const rows: ComparisonRow[] = [];
  for (const family of FAMILY_ORDER) {
    const cells = summaries.map((sum) => {
      if (!sum.ok) return null;
      const it = sum.indicators.find((x) => x.family === family);
      return it ? { v0: it.v0, v1: it.v1, delta: it.v1 - it.v0 } : null;
    });
    const defined = cells.filter((c) => c !== null).length;
    if (defined > 0) rows.push({ family, cells, comparable: defined >= 2 });
  }
  return { scenarios: selected, summaries, rows };
}

/** CSV rows (header + one row per variable and statistic) for the comparison. */
export function comparisonCsvRows(cmp: Comparison, label: (f: Family) => string, modelName: (m: string) => string): (string | number | null)[][] {
  const header: (string | number | null)[] = ['variable', 'estadistico'];
  cmp.scenarios.forEach((s, k) => header.push(`${s.name} [${modelName(cmp.summaries[k]!.model)}]`));
  const out: (string | number | null)[][] = [header];
  for (const r of cmp.rows) {
    for (const stat of ['E0', 'E1', 'delta'] as const) {
      const line: (string | number | null)[] = [label(r.family), stat];
      for (const c of r.cells) line.push(c === null ? null : stat === 'E0' ? c.v0 : stat === 'E1' ? c.v1 : c.delta);
      out.push(line);
    }
  }
  return out;
}
