import {
  EPS,
  compare,
  keynesianMultiplier,
  solve,
  type Comparison,
  type ParamKey,
  type SolvedEconomy,
} from '../engine';
import type { TemplateVar } from '../i18n/format';

/**
 * Automatic economic interpretation.
 *
 * Every statement is derived from the computed comparison between E₀ and E₁;
 * nothing is hard-coded per scenario. The output is language-independent:
 * each insight is a translation key plus numeric variables, rendered by the UI.
 *
 * Categories deliberately separate:
 *   cause        — which exogenous variables changed (the shock)
 *   shift        — displacements / rotations of the IS and LM curves
 *   movement     — movements ALONG curves (endogenous adjustment)
 *   transmission — the economic mechanism linking cause to effect
 *   effect       — resulting changes of endogenous variables
 *   regime       — monetary-regime specific remarks and counterfactuals
 *   conclusion   — technical summary (multipliers, effectiveness)
 */
export type InsightKind = 'cause' | 'shift' | 'movement' | 'transmission' | 'effect' | 'regime' | 'conclusion';

export interface Insight {
  kind: InsightKind;
  key: string;
  vars?: Record<string, TemplateVar>;
}

export interface InsightReport {
  /** True when E₁ is identical to E₀ (no shock applied). */
  noShock: boolean;
  /** One-paragraph headline summary. */
  headline: Insight[];
  items: Insight[];
}

const DEMAND_PARAMS: readonly ParamKey[] = ['G', 'T', 'C0', 'I0'];
const ORDERED_PARAMS: readonly ParamKey[] = ['G', 'T', 'C0', 'I0', 'c', 'b', 'M', 'P', 'k', 'h'];

const dir = (x: number, pos: string, neg: string) => ({ key: x >= 0 ? pos : neg });
const nonZero = (x: number, tol = 1e-7) => Math.abs(x) > tol;

/** Counterfactual used under interest targeting: same shock, M frozen at its E₀ level. */
export function moneySupplyCounterfactual(e0: SolvedEconomy, e1: SolvedEconomy): SolvedEconomy | null {
  if (e1.spec.regime !== 'interest-target') return null;
  // E₀ under the peg is reproduced exactly by the money-supply regime with M = M₀,
  // so the counterfactual is the shocked economy solved with M frozen at M₀.
  const r1 = solve({ ...e1.spec, regime: 'money-supply', params: { ...e1.spec.params, M: e0.equilibrium.M } });
  return r1.ok ? r1.value : null;
}

export function buildInsights(e0: SolvedEconomy, e1: SolvedEconomy, cmp: Comparison = compare(e0, e1)): InsightReport {
  const items: Insight[] = [];
  const headline: Insight[] = [];
  const p1 = e1.spec.params;
  const q0 = e0.equilibrium;
  const q1 = e1.equilibrium;
  const targeting = e1.spec.regime === 'interest-target';
  const dY = cmp.changes.Y.abs;
  const di = cmp.changes.i.abs;
  const dA = cmp.changes.A.abs;
  const alpha1 = keynesianMultiplier(p1);

  const changed = (k: ParamKey) => cmp.paramChanges[k] !== undefined;
  const demandShock = DEMAND_PARAMS.some(changed) || changed('c');
  const realMoneyShock = !targeting && (changed('M') || changed('P'));
  const targetShock = targeting && cmp.targetRateChange !== null;
  const structural = (['b', 'h', 'k', 'c'] as ParamKey[]).filter(changed);

  const isMoved = nonZero(cmp.isShift.horizontal) || cmp.isShift.rotated;
  const lmMoved = targeting ? targetShock : nonZero(cmp.lmShift.horizontal) || cmp.lmShift.rotated;

  const noShock = Object.keys(cmp.paramChanges).length === 0 && !targetShock;
  if (noShock) {
    return {
      noShock: true,
      headline: [{ kind: 'effect', key: 'ins.noShock' }],
      items: [{ kind: 'effect', key: 'ins.noShock.detail', vars: { Y: q0.Y, i: q0.i } }],
    };
  }

  // ── Causes ──────────────────────────────────────────────────────────────
  for (const k of ORDERED_PARAMS) {
    const c = cmp.paramChanges[k];
    if (!c) continue;
    items.push({
      kind: 'cause',
      key: 'ins.cause.param',
      vars: { param: { key: `param.${k}.name` }, sym: { key: `param.${k}.sym` }, from: c.from, to: c.to, delta: c.abs, pct: c.pct ?? 0 },
    });
  }
  if (cmp.targetRateChange) {
    items.push({ kind: 'cause', key: 'ins.cause.target', vars: { from: cmp.targetRateChange.from, to: cmp.targetRateChange.to, delta: cmp.targetRateChange.abs } });
  }
  if (demandShock && nonZero(dA)) {
    items.push({ kind: 'cause', key: 'ins.cause.autonomous', vars: { A0: q0.A, A1: q1.A, dA } });
  }
  if (realMoneyShock) {
    items.push({ kind: 'cause', key: 'ins.cause.realMoney', vars: { m0: q0.realMoney, m1: q1.realMoney, dm: q1.realMoney - q0.realMoney } });
    if (changed('P')) items.push({ kind: 'cause', key: 'ins.cause.priceLevel' });
  }

  // ── Curve shifts and rotations ──────────────────────────────────────────
  if (nonZero(cmp.isShift.horizontal)) {
    const pureLevel = !changed('b') && !changed('c');
    items.push({
      kind: 'shift',
      key: pureLevel ? 'ins.shift.is.multiplier' : 'ins.shift.is',
      vars: { dir: dir(cmp.isShift.horizontal, 'w.right', 'w.left'), amount: Math.abs(cmp.isShift.horizontal), i0: q0.i, alpha: alpha1, dA },
    });
  }
  if (cmp.isShift.rotated) {
    const steeper = Math.abs(cmp.isShift.slopeTo) > Math.abs(cmp.isShift.slopeFrom);
    items.push({ kind: 'shift', key: 'ins.shift.isRotation', vars: { how: { key: steeper ? 'w.steeper' : 'w.flatter' }, from: cmp.isShift.slopeFrom, to: cmp.isShift.slopeTo } });
  }
  if (!targeting) {
    if (nonZero(cmp.lmShift.horizontal)) {
      const pureLevel = !changed('k') && !changed('h');
      items.push({
        kind: 'shift',
        key: pureLevel ? 'ins.shift.lm.money' : 'ins.shift.lm',
        vars: { dir: dir(cmp.lmShift.horizontal, 'w.right', 'w.left'), amount: Math.abs(cmp.lmShift.horizontal), i0: q0.i, k: p1.k, dm: q1.realMoney - q0.realMoney },
      });
    }
    if (cmp.lmShift.rotated) {
      const steeper = Math.abs(cmp.lmShift.slopeTo) > Math.abs(cmp.lmShift.slopeFrom);
      items.push({ kind: 'shift', key: 'ins.shift.lmRotation', vars: { how: { key: steeper ? 'w.steeper' : 'w.flatter' }, from: cmp.lmShift.slopeFrom, to: cmp.lmShift.slopeTo } });
    }
  } else if (cmp.targetRateChange) {
    items.push({ kind: 'shift', key: 'ins.shift.lmTarget', vars: { dir: dir(cmp.targetRateChange.abs, 'w.up', 'w.down'), from: cmp.targetRateChange.from, to: cmp.targetRateChange.to } });
  }
  if (!isMoved && !lmMoved) items.push({ kind: 'shift', key: 'ins.shift.none' });

  // ── Movements along curves ──────────────────────────────────────────────
  if (isMoved && !lmMoved) {
    items.push({ kind: 'movement', key: targeting ? 'ins.move.alongFlatLM' : 'ins.move.alongLM', vars: { dir: dir(dY, 'w.up', 'w.down') } });
  } else if (!isMoved && lmMoved) {
    items.push({ kind: 'movement', key: 'ins.move.alongIS', vars: { dir: dir(-di, 'w.down', 'w.up') } });
  } else if (isMoved && lmMoved) {
    items.push({ kind: 'movement', key: 'ins.move.both' });
  }

  // ── Transmission mechanisms ─────────────────────────────────────────────
  const rateEffect = cmp.output.interestRateEffect;
  const isEffect = cmp.output.isShiftAtInitialRate;

  if (!targeting) {
    if (realMoneyShock && !isMoved) {
      const dm = q1.realMoney - q0.realMoney;
      items.push({
        kind: 'transmission',
        key: 'ins.tr.monetary',
        vars: {
          excess: { key: dm > 0 ? 'w.excessSupply' : 'w.excessDemand' },
          rateDir: dir(di, 'w.rises', 'w.falls'),
          di: Math.abs(di),
          dIrate: cmp.investment.interestRate,
          b: p1.b,
          dY,
          incomeDir: dir(dY, 'w.rise', 'w.fall'),
          kdY: Math.abs(p1.k * dY),
          mdDir: dir(dY, 'w.raises', 'w.lowers'),
        },
      });
    }
    if (isMoved && nonZero(isEffect) && !lmMoved) {
      items.push({
        kind: 'transmission',
        key: 'ins.tr.demand',
        vars: {
          isEffect,
          alpha: alpha1,
          mdDir: dir(isEffect, 'w.raises', 'w.lowers'),
          rateDir: dir(di, 'w.toRise', 'w.toFall'),
          di: Math.abs(di),
          dIrate: cmp.investment.interestRate,
          offset: Math.abs(rateEffect),
          share: nonZero(isEffect) ? (Math.abs(rateEffect) / Math.abs(isEffect)) * 100 : 0,
          dY,
        },
      });
      if (isEffect > 0 && di > EPS) {
        items.push({ kind: 'transmission', key: 'ins.tr.crowdingOut', vars: { crowd: Math.abs(rateEffect), share: (Math.abs(rateEffect) / isEffect) * 100, dIrate: cmp.investment.interestRate } });
      } else if (isEffect < 0 && di < -EPS) {
        items.push({ kind: 'transmission', key: 'ins.tr.crowdingIn', vars: { crowd: Math.abs(rateEffect), share: (Math.abs(rateEffect) / Math.abs(isEffect)) * 100 } });
      }
    }
    if (isMoved && lmMoved) {
      items.push({ kind: 'transmission', key: 'ins.tr.combined', vars: { isEffect, di, rateEffect, dY } });
    }
  } else {
    if (isMoved && !targetShock) {
      items.push({ kind: 'transmission', key: 'ins.tr.targetDemand', vars: { target: e1.spec.targetRate, dM: cmp.changes.M.abs, dY, alpha: alpha1 } });
    }
    if (targetShock && cmp.targetRateChange) {
      const dT = cmp.targetRateChange.abs;
      items.push({
        kind: 'transmission',
        key: 'ins.tr.targetRate',
        vars: {
          rateDir: dir(dT, 'w.raises', 'w.lowers'),
          dTarget: Math.abs(dT),
          dIrate: cmp.investment.interestRate,
          dY,
          mult: e1.multipliers.dY_dTargetRate,
          moneyDir: { key: cmp.changes.M.abs >= 0 ? 'w.injects' : 'w.drains' },
          dM: cmp.changes.M.abs,
        },
      });
      if (isMoved && nonZero(isEffect)) {
        items.push({ kind: 'transmission', key: 'ins.tr.combined', vars: { isEffect, di, rateEffect, dY } });
      }
    }
  }
  if (changed('T')) {
    const dT = cmp.paramChanges.T!.abs;
    items.push({ kind: 'transmission', key: 'ins.tr.tax', vars: { dT, c: p1.c, dCaut: -p1.c * dT, leak: (1 - p1.c) * Math.abs(dT) } });
  }
  if (changed('I0')) {
    items.push({ kind: 'transmission', key: 'ins.tr.investmentShock', vars: { dI0: cmp.paramChanges.I0!.abs, dI: cmp.investment.total, dIrate: cmp.investment.interestRate } });
  }
  if (structural.length > 0) {
    items.push({ kind: 'transmission', key: 'ins.tr.structural', vars: { list: structural.map((s) => s).join(', ') } });
  }

  // ── Effects on endogenous variables ─────────────────────────────────────
  const ch = cmp.changes;
  items.push({ kind: 'effect', key: 'ins.eff.output', vars: { Y0: q0.Y, Y1: q1.Y, dY, pY: ch.Y.pct ?? 0, i0: q0.i, i1: q1.i, di } });
  items.push({ kind: 'effect', key: 'ins.eff.demand', vars: { dC: ch.C.abs, dI: ch.I.abs, dG: ch.G.abs, dY } });
  items.push({ kind: 'effect', key: 'ins.eff.saving', vars: { dSp: ch.Sp.abs, dSg: ch.Sg.abs, dS: ch.S.abs, Sg1: q1.Sg } });
  items.push({
    kind: 'effect',
    key: targeting ? 'ins.eff.moneyTarget' : 'ins.eff.money',
    vars: { m0: q0.realMoney, m1: q1.realMoney, inc: cmp.moneyDemand.incomeEffect, int: cmp.moneyDemand.interestEffect, par: cmp.moneyDemand.parameterEffect, M0: q0.M, M1: q1.M },
  });

  // ── Regime remarks ──────────────────────────────────────────────────────
  if (targeting) {
    items.push({ kind: 'regime', key: 'ins.reg.target', vars: { target: e1.spec.targetRate, M1: q1.M } });
    const cf = moneySupplyCounterfactual(e0, e1);
    if (cf && (isMoved || targetShock)) {
      items.push({
        kind: 'regime',
        key: 'ins.reg.counterfactual',
        vars: { M0: q0.M, dYcf: cf.equilibrium.Y - q0.Y, dicf: cf.equilibrium.i - q0.i, dY },
      });
    }
  } else {
    items.push({ kind: 'regime', key: 'ins.reg.moneySupply', vars: { M: p1.M, P: p1.P } });
  }

  // ── Technical conclusions ───────────────────────────────────────────────
  const m = e1.multipliers;
  if (!targeting) {
    items.push({ kind: 'conclusion', key: 'ins.con.multipliers', vars: { alpha: m.keynesian, fG: m.dY_dG, fT: m.dY_dT, fBB: m.dY_dBalancedBudget, fM: m.dY_dRealMoney, iG: m.di_dG, iM: m.di_dRealMoney } });
    items.push({ kind: 'conclusion', key: 'ins.con.effectiveness', vars: { share: m.crowdingOutShare * 100, b: p1.b, h: p1.h, k: p1.k, c: p1.c } });
  } else {
    items.push({ kind: 'conclusion', key: 'ins.con.multipliersTarget', vars: { alpha: m.keynesian, fG: m.dY_dG, fT: m.dY_dT, fR: m.dY_dTargetRate } });
  }
  items.push({ kind: 'conclusion', key: 'ins.con.caveat' });

  // ── Headline ────────────────────────────────────────────────────────────
  const curveParts: Insight[] = [];
  if (nonZero(cmp.isShift.horizontal)) curveParts.push({ kind: 'shift', key: 'ins.head.is', vars: { dir: dir(cmp.isShift.horizontal, 'w.right', 'w.left') } });
  if (!targeting && nonZero(cmp.lmShift.horizontal)) curveParts.push({ kind: 'shift', key: 'ins.head.lm', vars: { dir: dir(cmp.lmShift.horizontal, 'w.right', 'w.left') } });
  if (targeting && cmp.targetRateChange) curveParts.push({ kind: 'shift', key: 'ins.head.lmTarget', vars: { dir: dir(cmp.targetRateChange.abs, 'w.up', 'w.down') } });
  headline.push(...curveParts);
  headline.push({
    kind: 'effect',
    key: 'ins.head.result',
    vars: {
      yDir: { key: sign3(dY, 'w.higherOutput', 'w.lowerOutput', 'w.sameOutput') },
      iDir: { key: sign3(di, 'w.higherRate', 'w.lowerRate', 'w.sameRate') },
      dY,
      di,
    },
  });
  if (nonZero(ch.I.abs)) {
    headline.push({ kind: 'effect', key: ch.I.abs > 0 ? 'ins.head.invUp' : 'ins.head.invDown', vars: { dI: ch.I.abs } });
  }

  return { noShock: false, headline, items };
}

function sign3(x: number, pos: string, neg: string, zero: string): string {
  if (x > 1e-7) return pos;
  if (x < -1e-7) return neg;
  return zero;
}
