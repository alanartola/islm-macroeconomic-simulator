import { compareADAS, type ADASComparison, type ADASParamKey, type ADASSolved } from '../engine/adas/adas';
import { emptyLevels, nonZero, type LeveledReport, causeParam } from './levels';

const ORDER: ADASParamKey[] = ['M', 'G', 'T0', 't', 'TR', 'C0', 'c', 'I0', 'b', 'k', 'h', 'L0', 's', 'Yn', 'Pe', 'theta'];
const DEMAND: ADASParamKey[] = ['M', 'G', 'T0', 't', 'TR', 'C0', 'c', 'I0', 'b', 'k', 'h', 'L0'];
const SUPPLY: ADASParamKey[] = ['s', 'Yn', 'Pe', 'theta'];

/** Translation key of an AD-AS parameter name (reuses Module A/B names). */
export function adasParamName(k: ADASParamKey): string {
  if (['C0', 'c', 'I0', 'b', 'G', 'M', 'k', 'h'].includes(k)) return `param.${k}.name`;
  if (['T0', 't', 'TR', 'L0'].includes(k)) return `adv.param.${k}.name`;
  return `adas.param.${k}.name`;
}

export function buildADASInsights(s0: ADASSolved, s1: ADASSolved, cmp: ADASComparison = compareADAS(s0, s1)): LeveledReport {
  const L = emptyLevels();
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const p1 = s1.params;
  const ch = cmp.changes;
  const changed = (k: ADASParamKey) => cmp.paramChanges[k] !== undefined;
  if (Object.keys(cmp.paramChanges).length === 0) {
    return { noShock: true, headline: [{ key: 'lvl.noShock' }], levels: { ...L, 3: [{ key: 'adas.l3.static', vars: { P: q0.P, Y: q0.Y, gap: q0.gap } }] } };
  }
  for (const k of ORDER) {
    const c = cmp.paramChanges[k];
    if (c) L[1].push(causeParam(adasParamName(k), c));
  }
  const demand = DEMAND.some(changed);
  const supply = SUPPLY.some(changed);
  L[1].push({ key: demand && supply ? 'adas.l1.both' : demand ? 'adas.l1.demand' : 'adas.l1.supply' });

  // Level 2
  if (nonZero(cmp.adShift)) L[2].push({ key: 'adas.l2.adShift', vars: { dir: { key: cmp.adShift > 0 ? 'w.right' : 'w.left' }, amount: Math.abs(cmp.adShift), P0: q0.P } });
  if (changed('M')) L[2].push({ key: 'adas.l2.money' });
  if (nonZero(cmp.srasShift, 1e-12)) L[2].push({ key: 'adas.l2.srasShift', vars: { dir: { key: cmp.srasShift > 0 ? 'w.up' : 'w.down' }, amount: Math.abs(cmp.srasShift) } });
  if (changed('Yn')) L[2].push({ key: 'adas.l2.potential', vars: { Yn0: s0.params.Yn, Yn1: p1.Yn } });
  if (nonZero(ch.P.abs, 1e-12)) L[2].push({ key: 'adas.l2.realBalance', vars: { dP: ch.P.abs, dm: ch.realMoney.abs, priceEffect: cmp.priceEffect, di: ch.i.abs } });

  // Level 3
  L[3].push({ key: 'adas.l3.result', vars: { P0: q0.P, P1: q1.P, pP: ch.P.pct ?? 0, Y0: q0.Y, Y1: q1.Y, dY: ch.Y.abs, gap0: q0.gap, gap1: q1.gap } });
  L[3].push({ key: 'adas.l3.components', vars: { i0: q0.i, i1: q1.i, dC: ch.C.abs, dI: ch.I.abs, m0: q0.realMoney, m1: q1.realMoney } });
  const mr = s1.mediumRun;
  if (mr) L[3].push({ key: 'adas.l3.mediumRun', vars: { Y: mr.Y, P: mr.P, i: mr.i } });
  else L[3].push({ key: 'adas.l3.noMediumRun' });

  // Level 4
  const c1 = s1.coefficients;
  L[4].push({ key: 'adas.l4.ad', math: true, vars: { a1: c1.a1, a2: c1.a2, D: c1.D } });
  L[4].push({ key: 'adas.l4.as', math: true, vars: { Pe: p1.Pe, theta: p1.theta, Yn: p1.Yn, s: p1.s } });
  L[4].push({ key: 'adas.l4.solve', math: true, vars: { B: c1.B, theta: p1.theta, a2: c1.a2, P: q1.P, Y: q1.Y } });
  L[4].push({ key: 'adas.l4.decomp', math: true, vars: { ad: cmp.adShift, pe: cmp.priceEffect, dY: ch.Y.abs } });
  if (mr) L[4].push({ key: 'adas.l4.mr', math: true, vars: { Yn: p1.Yn, s: p1.s, theta: p1.theta, Y: mr.Y, a2: c1.a2, a1: c1.a1, P: mr.P } });

  // Level 5
  const sameDirection = Math.sign(ch.P.abs) === Math.sign(ch.Y.abs) && nonZero(ch.Y.abs) && nonZero(ch.P.abs, 1e-12);
  L[5].push({ key: sameDirection ? 'adas.l5.demandResult' : nonZero(ch.P.abs, 1e-12) ? 'adas.l5.supplyResult' : 'adas.l5.noPriceResult', nature: 'result', vars: { dY: ch.Y.abs, dP: ch.P.abs } });
  if (changed('M') && mr) L[5].push({ key: 'adas.l5.neutrality', nature: 'theory' });
  if ((changed('G') || changed('T0') || changed('TR')) && mr) L[5].push({ key: 'adas.l5.fiscalMR', nature: 'theory', vars: { i: mr.i } });
  if (changed('s')) L[5].push({ key: 'adas.l5.stagflation', nature: 'theory' });
  L[5].push({ key: 'adas.l5.adjustment', nature: 'caveat' });
  L[5].push({ key: 'adas.l5.caveat', nature: 'caveat' });

  return {
    noShock: false,
    headline: [{ key: 'adas.head', vars: { dP: ch.P.pct ?? 0, dY: ch.Y.abs, gap: q1.gap } }],
    levels: L,
  };
}
