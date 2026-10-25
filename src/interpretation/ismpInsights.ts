import { compareISMP, delta, type ISMPComparison, type ISMPParamKey, type ISMPSolved } from '../engine/ismp/ismp';
import { emptyLevels, nonZero, type LeveledReport } from './levels';

const ORDER: ISMPParamKey[] = ['d', 'u', 'piE', 'piStar', 'rn', 'rStar', 'v', 'phiPi', 'phiY', 'sigma', 'kappa', 'iLB', 'iPeg'];

export function buildISMPInsights(s0: ISMPSolved, s1: ISMPSolved, cmp: ISMPComparison = compareISMP(s0, s1)): LeveledReport {
  const L = emptyLevels();
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const p = s1.spec.params;
  const ch = cmp.changes;
  const changed = (k: ISMPParamKey) => cmp.paramChanges[k] !== undefined;
  const peg = s1.spec.regime === 'peg';
  if (Object.keys(cmp.paramChanges).length === 0) {
    return { noShock: true, headline: [{ key: 'lvl.noShock' }], levels: { ...L, 3: [{ key: 'ismp.l3.static', vars: { x: q0.x, pi: q0.pi, i: q0.i } }] } };
  }
  for (const k of ORDER) {
    const c = cmp.paramChanges[k];
    if (c) L[1].push({ key: 'lvl.cause.param', vars: { param: { key: `ismp.param.${k}.name` }, from: c.from, to: c.to, delta: c.abs, pct: c.pct ?? 0 } });
  }
  L[1].push({ key: peg ? 'ismp.l1.peg' : s1.elbBinding ? 'ismp.l1.elb' : 'ismp.l1.rule' });

  // Level 2
  if (changed('d')) L[2].push({ key: 'ismp.l2.demand', vars: { dd: p.d - s0.spec.params.d } });
  if (changed('u')) L[2].push({ key: 'ismp.l2.supply', vars: { du: p.u - s0.spec.params.u } });
  if (changed('piStar')) L[2].push({ key: 'ismp.l2.target', vars: { e: p.piE - p.piStar } });
  if (changed('piE')) L[2].push({ key: 'ismp.l2.expectations' });
  if (changed('rn') || changed('rStar')) L[2].push({ key: 'ismp.l2.neutral', vars: { gap: p.rStar - p.rn } });
  if (changed('v')) L[2].push({ key: 'ismp.l2.policyShock', vars: { v: p.v } });
  if (!peg && !s1.elbBinding) L[2].push({ key: 'ismp.l2.rule', vars: { di: ch.i.abs, dr: ch.r.abs, dpi: ch.pi.abs, dx: ch.x.abs, phiPi: p.phiPi, phiY: p.phiY } });
  if (s1.elbBinding) L[2].push({ key: 'ismp.l2.elb', vars: { lb: p.iLB, rule: q1.iRule } });
  if (peg) L[2].push({ key: 'ismp.l2.peg', vars: { peg: p.iPeg } });

  // Level 3
  L[3].push({ key: 'ismp.l3.result', vars: { x0: q0.x, x1: q1.x, pi0: q0.pi, pi1: q1.pi, i0: q0.i, i1: q1.i, r1: q1.r } });

  // Level 4
  L[4].push({ key: 'ismp.l4.equations', math: true });
  if (!peg && !s1.elbBinding) {
    L[4].push({ key: 'ismp.l4.delta', math: true, vars: { sigma: p.sigma, kappa: p.kappa, phiPi: p.phiPi, phiY: p.phiY, D: delta(p) } });
    L[4].push({ key: 'ismp.l4.x', math: true, vars: { d: p.d, sigma: p.sigma, gapR: p.rStar - p.rn + p.v, phiPi: p.phiPi, u: p.u, e: p.piE - p.piStar, D: delta(p), x: q1.x } });
  } else {
    L[4].push({ key: 'ismp.l4.xFixed', math: true, vars: { d: p.d, sigma: p.sigma, i: q1.i, piE: p.piE, rn: p.rn, x: q1.x } });
  }
  L[4].push({ key: 'ismp.l4.pi', math: true, vars: { piE: p.piE, kappa: p.kappa, x: q1.x, u: p.u, pi: q1.pi } });
  L[4].push({ key: 'ismp.l4.i', math: true, vars: { rStar: p.rStar, pi: q1.pi, phiPi: p.phiPi, piStar: p.piStar, phiY: p.phiY, x: q1.x, v: p.v, iRule: q1.iRule, i: q1.i } });

  // Level 5
  L[5].push({ key: 'ismp.l5.result', nature: 'result', vars: { dx: ch.x.abs, dpi: ch.pi.abs, di: ch.i.abs } });
  if (changed('u') && !peg) L[5].push({ key: 'ismp.l5.tradeoff', nature: 'theory' });
  if (changed('d') && !peg && !s1.elbBinding) L[5].push({ key: 'ismp.l5.stabilise', nature: 'theory', vars: { share: (1 - s1.derivatives.dx_dd) * 100 } });
  if (s1.elbBinding) L[5].push({ key: 'ismp.l5.elbTheory', nature: 'theory' });
  if (!peg && p.phiPi <= 0) L[5].push({ key: 'ismp.l5.taylorPrinciple', nature: 'caveat' });
  L[5].push({ key: 'ismp.l5.phillips', nature: 'caveat' });
  L[5].push({ key: 'ismp.l5.caveat', nature: 'caveat' });

  const headKey = nonZero(ch.x.abs, 1e-9) || nonZero(ch.pi.abs, 1e-9) ? 'ismp.head' : 'ismp.headNoReal';
  return { noShock: false, headline: [{ key: headKey, vars: { dx: ch.x.abs, dpi: ch.pi.abs, di: ch.i.abs } }], levels: L };
}
