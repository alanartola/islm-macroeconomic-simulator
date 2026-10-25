import { compareAdvanced, type AdvComparison, type AdvParamKey, type AdvSolved } from '../engine/advanced';
import { dirKey, emptyLevels, nonZero, type LeveledReport, type LevelItem, causeParam } from './levels';

const ORDER: AdvParamKey[] = ['G', 'T0', 't', 'TR', 'C0', 'c', 'I0', 'b', 'M', 'P', 'k', 'h', 'L0', 'a', 'iMin', 'iFloor'];
const DEMAND: AdvParamKey[] = ['G', 'T0', 'TR', 'C0', 'I0', 'c', 't'];
const MONEY: AdvParamKey[] = ['M', 'P', 'k', 'h', 'L0', 'a', 'iMin', 'iFloor'];

/** Translation key of a Module B parameter name (shared names come from Module A). */
export function advParamName(k: AdvParamKey): string {
  return ['C0', 'c', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'].includes(k) ? `param.${k}.name` : `adv.param.${k}.name`;
}

/**
 * Builds the five-level explanation for Module B exclusively from the solved
 * equilibria and their comparison. Zone-specific statements (trap, classical,
 * binding floor, pegged rate) are triggered by the computed LM region.
 */
export function buildAdvancedInsights(s0: AdvSolved, s1: AdvSolved, cmp: AdvComparison = compareAdvanced(s0, s1)): LeveledReport {
  const L = emptyLevels();
  const head: LevelItem[] = [];
  const p0 = s0.spec.params;
  const p1 = s1.spec.params;
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const m1 = s1.multipliers;
  const m0 = s0.multipliers;
  const dY = q1.Y - q0.Y;
  const di = q1.i - q0.i;
  const changed = (k: AdvParamKey) => cmp.paramChanges[k] !== undefined;
  const pegged = s1.spec.regime === 'rate';
  const noShock = Object.keys(cmp.paramChanges).length === 0 && cmp.targetRateChange === null && s0.spec.lm === s1.spec.lm;

  if (noShock) {
    return {
      noShock: true,
      headline: [{ key: 'lvl.noShock' }],
      levels: { ...L, 3: [{ key: 'adv.l3.static', vars: { Y: q0.Y, i: q0.i, zone: { key: `adv.zone.${s0.zone}` } } }] },
    };
  }

  // ── Level 1: what changed ──────────────────────────────────────────────
  for (const k of ORDER) {
    const c = cmp.paramChanges[k];
    if (c) L[1].push(causeParam(advParamName(k), c));
  }
  if (cmp.targetRateChange) L[1].push({ key: 'ins.cause.target', vars: { from: cmp.targetRateChange.from, to: cmp.targetRateChange.to, delta: cmp.targetRateChange.abs } });
  const demandShock = DEMAND.some(changed);
  const moneyShock = MONEY.some(changed);
  L[1].push({ key: demandShock && moneyShock ? 'adv.l1.both' : demandShock ? 'adv.l1.demand' : moneyShock ? 'adv.l1.money' : 'adv.l1.rate' });

  // ── Level 2: transmission ──────────────────────────────────────────────
  if (nonZero(cmp.isShiftAtInitialRate)) {
    L[2].push({ key: 'adv.l2.isShift', vars: { dir: dirKey(cmp.isShiftAtInitialRate, 'w.right', 'w.left'), amount: Math.abs(cmp.isShiftAtInitialRate), i0: q0.i, alpha: m1.alpha } });
  }
  if (changed('t')) {
    L[2].push({ key: 'adv.l2.taxRate', vars: { t0: p0.t, t1: p1.t, a0: m0.alpha, a1: m1.alpha } });
  } else if (p1.t > 0 && demandShock) {
    L[2].push({ key: 'adv.l2.stabiliser', vars: { t: p1.t, alpha: m1.alpha, alphaNoTax: 1 / (1 - p1.c), dT: q1.T - q0.T } });
  }
  if (changed('TR')) L[2].push({ key: 'adv.l2.transfers', vars: { dTR: p1.TR - p0.TR, c: p1.c, dAut: p1.c * (p1.TR - p0.TR) } });
  if (changed('T0')) L[2].push({ key: 'adv.l2.lumpTax', vars: { dT0: p1.T0 - p0.T0, c: p1.c, dAut: -p1.c * (p1.T0 - p0.T0) } });
  if (changed('c')) L[2].push({ key: 'adv.l2.mpc', vars: { c0: p0.c, c1: p1.c, a0: m0.alpha, a1: m1.alpha } });
  if (pegged) {
    L[2].push({ key: 'adv.l2.pegged', vars: { target: s1.spec.targetRate, dM: q1.M - q0.M } });
  } else if (s1.floorBinding) {
    L[2].push({ key: 'adv.l2.floor', vars: { floor: p1.iFloor, idle0: q0.idleBalances, idle1: q1.idleBalances } });
  } else {
    if (changed('M') || changed('P')) L[2].push({ key: 'adv.l2.money', vars: { dm: q1.realMoney - q0.realMoney, rateDir: dirKey(di, 'w.rises', 'w.falls'), di: Math.abs(di) } });
    if (changed('a')) L[2].push({ key: 'adv.l2.liquidityPref', vars: { a0: p0.a, a1: p1.a, dir: dirKey(p1.a - p0.a, 'w.raises', 'w.lowers') } });
    if (nonZero(cmp.isShiftAtInitialRate) && nonZero(di)) {
      L[2].push({
        key: cmp.isShiftAtInitialRate > 0 && di > 0 ? 'adv.l2.crowdingOut' : cmp.isShiftAtInitialRate < 0 && di < 0 ? 'adv.l2.crowdingIn' : 'adv.l2.rateEffect',
        vars: { di: Math.abs(di), dIrate: -p1.b * di, rateEffect: cmp.interestRateEffect, isEffect: cmp.isShiftAtInitialRate, share: Math.abs(cmp.interestRateEffect / cmp.isShiftAtInitialRate) * 100 },
      });
    }
  }
  L[2].push({ key: `adv.l2.zone.${s1.zone}`, vars: { share: m1.crowdingOutShare * 100, slope: m1.lmSlope } });

  // ── Level 3: equilibrium ───────────────────────────────────────────────
  const ch = cmp.changes;
  L[3].push({ key: 'adv.l3.output', vars: { Y0: q0.Y, Y1: q1.Y, dY, pY: ch.Y.pct ?? 0, i0: q0.i, i1: q1.i, di } });
  L[3].push({ key: 'adv.l3.demand', vars: { dC: ch.C.abs, dI: ch.I.abs, dG: ch.G.abs, dY } });
  L[3].push({ key: 'adv.l3.fiscal', vars: { T0: q0.T, T1: q1.T, dT: ch.T.abs, TR1: q1.TR, Sg0: q0.Sg, Sg1: q1.Sg } });
  L[3].push({ key: 'adv.l3.saving', vars: { dSp: ch.Sp.abs, dSg: ch.Sg.abs, dS: ch.S.abs } });
  L[3].push({ key: 'adv.l3.money', vars: { m1: q1.realMoney, Lt0: q0.transactionDemand, Lt1: q1.transactionDemand, Ls0: q0.speculativeDemand, Ls1: q1.speculativeDemand, idle1: q1.idleBalances } });
  if (s0.zone !== s1.zone) L[3].push({ key: 'adv.l3.zoneChange', vars: { z0: { key: `adv.zone.${s0.zone}` }, z1: { key: `adv.zone.${s1.zone}` } } });

  // ── Level 4: mathematics ───────────────────────────────────────────────
  L[4].push({ key: 'adv.l4.alpha', math: true, vars: { c: p1.c, t: p1.t, alpha: m1.alpha } });
  L[4].push({ key: 'adv.l4.autonomous', math: true, vars: { C0: p1.C0, c: p1.c, T0: p1.T0, TR: p1.TR, I0: p1.I0, G: p1.G, A: q1.A } });
  L[4].push({ key: 'adv.l4.is', math: true, vars: { alpha: m1.alpha, A: q1.A, b: p1.b, i: q1.i, Y: q1.Y } });
  if (pegged) L[4].push({ key: 'adv.l4.lmPegged', math: true, vars: { target: s1.spec.targetRate, M: q1.M, k: p1.k, Y: q1.Y } });
  else if (s1.spec.lm === 'nonlinear') L[4].push({ key: 'adv.l4.lmNonlinear', math: true, vars: { iMin: p1.iMin, a: p1.a, m: q1.realMoney, k: p1.k, Y: q1.Y, i: q1.i } });
  else if (s1.floorBinding) L[4].push({ key: 'adv.l4.lmFloor', math: true, vars: { floor: p1.iFloor, idle: q1.idleBalances } });
  else L[4].push({ key: 'adv.l4.lmLinear', math: true, vars: { k: p1.k, Y: q1.Y, L0: p1.L0, m: q1.realMoney, h: p1.h, i: q1.i } });
  L[4].push(
    s1.diagnostics.method === 'brent'
      ? { key: 'adv.l4.solverBrent', math: true, vars: { it: s1.diagnostics.iterations, res: s1.diagnostics.residual } }
      : { key: 'adv.l4.solverClosed', math: true },
  );
  if (Number.isFinite(m1.lmSlope) && !pegged) {
    L[4].push({ key: 'adv.l4.multiplier', math: true, vars: { alpha: m1.alpha, b: p1.b, s: m1.lmSlope, m: m1.dY_dG, share: m1.crowdingOutShare * 100 } });
  }
  if (cmp.effectiveFiscalMultiplier !== null) {
    L[4].push({ key: 'adv.l4.discreteFiscal', math: true, vars: { eff: cmp.effectiveFiscalMultiplier, d0: m0.dY_dG, d1: m1.dY_dG } });
  }
  if (cmp.effectiveMonetaryMultiplier !== null) {
    L[4].push({ key: 'adv.l4.discreteMonetary', math: true, vars: { eff: cmp.effectiveMonetaryMultiplier, d0: m0.dY_dRealMoney, d1: m1.dY_dRealMoney } });
  }
  L[4].push({ key: 'adv.l4.decomposition', math: true, vars: { isEffect: cmp.isShiftAtInitialRate, rateEffect: cmp.interestRateEffect, dY } });

  // ── Level 5: interpretation (result / theory / implication / caveat) ───
  if (cmp.effectiveFiscalMultiplier !== null) {
    L[5].push({ key: 'adv.l5.fiscalResult', nature: 'result', vars: { eff: cmp.effectiveFiscalMultiplier, alpha: m1.alpha, share: (1 - cmp.effectiveFiscalMultiplier / m1.alpha) * 100 } });
  }
  if (cmp.effectiveMonetaryMultiplier !== null) {
    L[5].push({ key: 'adv.l5.monetaryResult', nature: 'result', vars: { eff: cmp.effectiveMonetaryMultiplier } });
  }
  L[5].push({ key: `adv.l5.theory.${s1.zone}`, nature: 'theory' });
  if (s1.zone === 'trap' && s1.spec.lm === 'nonlinear') L[5].push({ key: 'adv.l5.asymptoticTrap', nature: 'caveat', vars: { dm: m1.dY_dRealMoney } });
  if (p1.t > 0) L[5].push({ key: 'adv.l5.stabilisers', nature: 'theory', vars: { t: p1.t } });
  L[5].push({ key: 'adv.l5.implication', nature: 'implication' });
  L[5].push({ key: 'adv.l5.caveat', nature: 'caveat' });

  // ── Headline ───────────────────────────────────────────────────────────
  head.push({
    key: 'adv.head',
    vars: {
      yDir: { key: dY > 1e-7 ? 'w.higherOutput' : dY < -1e-7 ? 'w.lowerOutput' : 'w.sameOutput' },
      iDir: { key: di > 1e-9 ? 'w.higherRate' : di < -1e-9 ? 'w.lowerRate' : 'w.sameRate' },
      dY,
      di,
      zone: { key: `adv.zone.${s1.zone}` },
    },
  });
  return { noShock: false, headline: head, levels: L };
}
