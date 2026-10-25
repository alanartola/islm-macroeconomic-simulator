import { compareOpen, openAutonomous, type OpenComparison, type OpenParamKey, type OpenSolved } from '../engine/open/mundellFleming';
import { emptyLevels, nonZero, type LeveledReport } from './levels';

const ORDER: OpenParamKey[] = ['G', 'T0', 't', 'TR', 'C0', 'c', 'I0', 'b', 'X0', 'v', 'Yf', 'xq', 'IM0', 'm', 'mq', 'D', 'R', 'iStar', 'Ebar', 'P', 'Pf', 'k', 'h'];
const DEMAND: OpenParamKey[] = ['G', 'T0', 't', 'TR', 'C0', 'c', 'I0', 'b'];
const EXTERNAL: OpenParamKey[] = ['X0', 'v', 'Yf', 'xq', 'IM0', 'm', 'mq'];
const MONEY: OpenParamKey[] = ['D', 'R', 'k', 'h', 'P'];

export function buildOpenInsights(s0: OpenSolved, s1: OpenSolved, cmp: OpenComparison = compareOpen(s0, s1)): LeveledReport {
  const L = emptyLevels();
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const p1 = s1.spec.params;
  const fixed = s1.spec.regime === 'fixed';
  const changed = (k: OpenParamKey) => cmp.paramChanges[k] !== undefined;
  const ch = cmp.changes;
  if (Object.keys(cmp.paramChanges).length === 0) {
    return { noShock: true, headline: [{ key: 'lvl.noShock' }], levels: { ...L, 3: [{ key: 'open.l3.static', vars: { Y: q0.Y, q: q0.q, NX: q0.NX } }] } };
  }

  // Level 1
  for (const k of ORDER) {
    const c = cmp.paramChanges[k];
    if (c) L[1].push({ key: 'lvl.cause.param', vars: { param: { key: `open.param.${k}.name` }, from: c.from, to: c.to, delta: c.abs, pct: c.pct ?? 0 } });
  }
  const demand = DEMAND.some(changed);
  const external = EXTERNAL.some(changed);
  const money = MONEY.some(changed);
  L[1].push({ key: fixed ? 'open.l1.fixed' : 'open.l1.flexible' });

  // Level 2
  const reg = fixed ? 'fixed' : 'flex';
  if (demand) L[2].push({ key: `open.l2.${reg}.demand`, vars: { dq: ch.q.abs, dNX: ch.NX.abs, dY: ch.Y.abs, dR: ch.R.abs, dM: ch.M.abs, alpha: q1.alpha } });
  if (external) L[2].push({ key: `open.l2.${reg}.external`, vars: { dq: ch.q.abs, dNX: ch.NX.abs, dY: ch.Y.abs, dR: ch.R.abs } });
  if (money) L[2].push({ key: `open.l2.${reg}.money`, vars: { dD: p1.D - s0.spec.params.D, dq: ch.q.abs, dY: ch.Y.abs, dR: ch.R.abs, dNX: ch.NX.abs } });
  if (changed('iStar')) L[2].push({ key: `open.l2.${reg}.istar`, vars: { di: ch.i.abs, dY: ch.Y.abs, dq: ch.q.abs, dI: ch.I.abs } });
  if (changed('Ebar')) L[2].push({ key: 'open.l2.fixed.deval', vars: { dq: ch.q.abs, dNX: ch.NX.abs, dY: ch.Y.abs, n: q1.n } });
  if (nonZero(ch.q.abs, 1e-9)) {
    L[2].push({ key: ch.q.abs > 0 ? 'open.l2.depreciation' : 'open.l2.appreciation', vars: { q0: q0.q, q1: q1.q, pct: Math.abs(ch.q.pct ?? 0) } });
  } else {
    L[2].push({ key: fixed ? 'open.l2.pegHeld' : 'open.l2.qUnchanged', vars: { q: q1.q } });
  }

  // Level 3
  L[3].push({ key: 'open.l3.output', vars: { Y0: q0.Y, Y1: q1.Y, dY: ch.Y.abs, i: q1.i, q0: q0.q, q1: q1.q, E1: q1.E } });
  L[3].push({ key: 'open.l3.trade', vars: { dX: ch.X.abs, dIM: ch.IM.abs, NX0: q0.NX, NX1: q1.NX } });
  L[3].push({ key: 'open.l3.demand', vars: { dC: ch.C.abs, dI: ch.I.abs, dG: ch.G.abs, dNX: ch.NX.abs, dY: ch.Y.abs } });
  L[3].push({ key: 'open.l3.money', vars: { M0: q0.M, M1: q1.M, R0: q0.R, R1: q1.R } });
  L[3].push({ key: 'open.l3.saving', vars: { S: q1.S, I: q1.I, NX: q1.NX, inflow: q1.capitalInflow } });

  // Level 4
  L[4].push({ key: 'open.l4.alpha', math: true, vars: { c: p1.c, t: p1.t, m: p1.m, alpha: q1.alpha } });
  L[4].push({ key: 'open.l4.auto', math: true, vars: { A: openAutonomous(p1), n: q1.n, xq: p1.xq, mq: p1.mq } });
  if (fixed) {
    L[4].push({ key: 'open.l4.fixedY', math: true, vars: { alpha: q1.alpha, A: openAutonomous(p1), b: p1.b, is: p1.iStar, n: q1.n, q: q1.q, Y: q1.Y } });
    L[4].push({ key: 'open.l4.fixedM', math: true, vars: { P: p1.P, k: p1.k, Y: q1.Y, h: p1.h, is: p1.iStar, M: q1.M, D: p1.D, R: q1.R } });
  } else {
    L[4].push({ key: 'open.l4.flexY', math: true, vars: { D: p1.D, R: p1.R, P: p1.P, h: p1.h, is: p1.iStar, k: p1.k, Y: q1.Y } });
    L[4].push({ key: 'open.l4.flexQ', math: true, vars: { Y: q1.Y, alpha: q1.alpha, A: openAutonomous(p1), b: p1.b, is: p1.iStar, n: q1.n, q: q1.q } });
  }

  // Level 5
  const m1 = s1.multipliers;
  L[5].push({ key: fixed ? 'open.l5.resultFixed' : 'open.l5.resultFlex', nature: 'result', vars: { fG: m1.dY_dG, fD: m1.dY_dD } });
  L[5].push({ key: fixed ? 'open.l5.theoryFixed' : 'open.l5.theoryFlex', nature: 'theory' });
  if (q1.n < 0) L[5].push({ key: 'open.l5.marshallLerner', nature: 'caveat', vars: { n: q1.n } });
  L[5].push({ key: 'open.l5.implication', nature: 'implication' });
  L[5].push({ key: 'open.l5.caveat', nature: 'caveat' });

  const headKey = !nonZero(ch.q.abs, 1e-9) ? 'open.head.noQ' : ch.q.abs > 0 ? 'open.head.dep' : 'open.head.app';
  return {
    noShock: false,
    headline: [{ key: headKey, vars: { dY: ch.Y.abs, dNX: ch.NX.abs, pct: Math.abs(ch.q.pct ?? 0), regime: { key: fixed ? 'open.regime.fixed.short' : 'open.regime.flexible.short' } } }],
    levels: L,
  };
}
