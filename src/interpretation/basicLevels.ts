import { autonomousSpending, determinant, keynesianMultiplier, realMoney, type Comparison, type SolvedEconomy } from '../engine';
import type { InsightReport } from './insights';
import { emptyLevels, type LeveledReport, type LevelItem, type Nature } from './levels';

const NATURE: Record<string, Nature> = {
  'ins.reg.target': 'theory',
  'ins.reg.moneySupply': 'theory',
  'ins.reg.counterfactual': 'result',
  'ins.con.multipliers': 'result',
  'ins.con.multipliersTarget': 'result',
  'ins.con.effectiveness': 'theory',
  'ins.con.caveat': 'caveat',
};

/**
 * Re-organises the Module A insights into the five-level structure and adds
 * the mathematical level (equations evaluated at E₁). The original insight
 * texts are unchanged.
 */
export function toLeveled(report: InsightReport, e1: SolvedEconomy, cmp: Comparison): LeveledReport {
  const L = emptyLevels();
  for (const it of report.items) {
    const item: LevelItem = { key: it.key, vars: it.vars };
    if (it.kind === 'cause') L[1].push(item);
    else if (it.kind === 'shift' || it.kind === 'movement' || it.kind === 'transmission') L[2].push(item);
    else if (it.kind === 'effect') L[3].push(item);
    else L[5].push({ ...item, nature: NATURE[it.key] ?? 'theory' });
  }
  {
    const p = e1.spec.params;
    const q = e1.equilibrium;
    L[4].push({ key: 'lvlA.math.A', math: true, vars: { C0: p.C0, c: p.c, T: p.T, I0: p.I0, G: p.G, A: autonomousSpending(p) } });
    L[4].push({ key: 'lvlA.math.alpha', math: true, vars: { c: p.c, alpha: keynesianMultiplier(p) } });
    if (e1.spec.regime === 'interest-target') {
      L[4].push({ key: 'lvlA.math.target', math: true, vars: { alpha: keynesianMultiplier(p), A: autonomousSpending(p), b: p.b, it: e1.spec.targetRate, Y: q.Y, P: p.P, k: p.k, h: p.h, M: q.M } });
    } else {
      L[4].push({ key: 'lvlA.math.D', math: true, vars: { h: p.h, c: p.c, b: p.b, k: p.k, D: determinant(p) } });
      L[4].push({ key: 'lvlA.math.Y', math: true, vars: { h: p.h, A: autonomousSpending(p), b: p.b, m: realMoney(p), D: determinant(p), Y: q.Y } });
      L[4].push({ key: 'lvlA.math.i', math: true, vars: { k: p.k, A: autonomousSpending(p), c: p.c, m: realMoney(p), D: determinant(p), i: q.i } });
    }
    if (!report.noShock) {
      L[4].push({ key: 'adv.l4.decomposition', math: true, vars: { isEffect: cmp.output.isShiftAtInitialRate, rateEffect: cmp.output.interestRateEffect, dY: cmp.output.total } });
    }
  }
  return { noShock: report.noShock, headline: report.headline.map((h) => ({ key: h.key, vars: h.vars })), levels: L };
}
