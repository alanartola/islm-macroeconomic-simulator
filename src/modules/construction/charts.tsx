import {
  consumptionAt,
  crossEquilibrium,
  injections,
  investmentAt,
  isOutput,
  leakages,
  lmPointForOutput,
  moneyDemandOf,
  plannedExpenditure,
  realMoneyOf,
  speculativeAt,
  type AdvSpec,
} from '../../engine/advanced';
import { useI18n } from '../../i18n';
import { XYChart, type Pt, type XYMarker, type XYSegment, type XYSeries } from '../../components/charts/XYChart';
import { FourQuadrantChart, type QConnector, type QSeries } from '../../components/charts/FourQuadrantChart';
import { LegendLine } from '../../components/charts/common';
import type { AdvSimOk } from '../../state/advancedState';
import { advWindow, isPoints, lmPoints } from '../advanced/curves';
import { IS, LM, useAdvChart } from '../advanced/useAdvChart';
import type { Selection } from './selection';

const C_COL = 'var(--series-3)';
const CI_COL = 'var(--series-4)';
const A_COL = 'var(--series-7)';
const B_COL = 'var(--series-5)';
const GRID = 'var(--text-muted)';


const line2 = (f: (x: number) => number, x0: number, x1: number, n = 2): Pt[] =>
  Array.from({ length: n }, (_, j) => {
    const x = x0 + ((x1 - x0) * j) / (n - 1);
    return [x, f(x)] as Pt;
  });

/** Output window for the Keynesian-cross style charts. */
function crossWindow(sim: AdvSimOk, extra: number[] = []): [number, number] {
  const ys = [sim.s0.equilibrium.Y, sim.s1.equilibrium.Y, ...extra];
  const lo = Math.max(0, Math.min(...ys) - 0.35 * sim.s0.equilibrium.Y);
  return [lo, Math.max(...ys) + 0.25 * sim.s0.equilibrium.Y];
}

// ── Chart 1: Keynesian cross ────────────────────────────────────────────────
export function KeynesianCrossChart({ sim, sel }: { sim: AdvSimOk; sel: Selection }) {
  const { t, f } = useI18n();
  const p0 = sim.s0.spec.params;
  const p1 = sim.s1.spec.params;
  const q0 = sim.s0.equilibrium;
  const q1 = sim.s1.equilibrium;
  const keyn = isOutput(p1, q0.i);
  const [lo, hi] = crossWindow(sim, [keyn]);
  const series: XYSeries[] = [
    { id: '45', points: [[lo, lo], [hi, hi]], color: GRID, label: '45°', hover: false },
    { id: 'c', points: line2((Y) => consumptionAt(p1, Y), lo, hi), color: C_COL, label: 'C', width: 1.6 },
    { id: 'ci', points: line2((Y) => consumptionAt(p1, Y) + investmentAt(p1, q1.i), lo, hi), color: CI_COL, label: 'C + I', width: 1.6 },
    { id: 'ae0', points: line2((Y) => plannedExpenditure(p0, Y, q0.i), lo, hi), color: IS, dash: 'dash', label: t('con.ae0') },
    { id: 'ae1', points: line2((Y) => plannedExpenditure(p1, Y, q1.i), lo, hi), color: IS, label: t('con.ae1') },
  ];
  const segs: XYSegment[] = [];
  const moved = Math.abs(keyn - q0.Y) > 1e-6;
  if (sel.rounds && moved) {
    series.push({ id: 'aek', points: line2((Y) => plannedExpenditure(p1, Y, q0.i), lo, hi), color: IS, dash: 'dot', label: t('con.aeK') });
    // Multiplier staircase at the constant rate i₀: vertical to AE, horizontal to the 45° line.
    let Y = q0.Y;
    for (let j = 0; j < 10; j += 1) {
      const ae = plannedExpenditure(p1, Y, q0.i);
      segs.push({ id: `v${j}`, x0: Y, y0: Y, x1: Y, y1: ae, color: 'var(--series-8)', width: 1.4 });
      segs.push({ id: `h${j}`, x0: Y, y0: ae, x1: ae, y1: ae, color: 'var(--series-8)', width: 1.4 });
      Y = ae;
    }
  }
  const markers: XYMarker[] = [
    { id: 'e0', x: q0.Y, y: q0.Y, label: 'E₀', kind: 'e0', rows: [['Y = GA', f(q0.Y, 'bn')], ['i', f(q0.i, 'rate')]] },
    { id: 'e1', x: q1.Y, y: q1.Y, label: 'E₁', kind: 'e1', rows: [['Y = GA', f(q1.Y, 'bn')], ['i', f(q1.i, 'rate')]] },
  ];
  if (sel.rounds && moved) markers.push({ id: 'k', x: keyn, y: keyn, label: t('con.keynPoint'), kind: 'ghost', color: IS });
  return (
    <XYChart
      xDomain={[lo, hi]}
      yDomain={[lo, hi]}
      xLabel={t('con.x.Y')}
      yLabel={t('con.y.AE')}
      series={series}
      markers={markers}
      segments={segs}
      ariaLabel={t('con.c1.title')}
      aspect={0.75}
      valueFormat={(v) => f(v, 'n1')}
    />
  );
}

export function KeynesianCrossLegend() {
  const { t } = useI18n();
  return (
    <>
      <LegendLine color={C_COL} label="C(Y)" />
      <LegendLine color={CI_COL} label="C + I" />
      <LegendLine color={IS} label={t('con.ae1')} />
      <LegendLine color={IS} dashed label={t('con.ae0')} />
      <LegendLine color={GRID} label="45°" />
    </>
  );
}

// ── Chart 2: formation of the IS ───────────────────────────────────────────
export function ISFormationChart({ sim, sel }: { sim: AdvSimOk; sel: Selection }) {
  const { t, f } = useI18n();
  const p = sim.s1.spec.params;
  const Ya = crossEquilibrium(p, sel.ia);
  const Yb = crossEquilibrium(p, sel.ib);
  const [lo, hi] = crossWindow(sim, [Ya, Yb]);
  const st = sel.stepIS;
  const top: XYSeries[] = [{ id: '45', points: [[lo, lo], [hi, hi]], color: GRID, label: '45°', hover: false }];
  if (st >= 2) {
    top.push({ id: 'aea', points: line2((Y) => plannedExpenditure(p, Y, sel.ia), lo, hi), color: A_COL, label: `GA(i = ${f(sel.ia, 'n1')})` });
    top.push({ id: 'aeb', points: line2((Y) => plannedExpenditure(p, Y, sel.ib), lo, hi), color: B_COL, label: `GA(i = ${f(sel.ib, 'n1')})` });
  }
  const topMarkers: XYMarker[] =
    st >= 3
      ? [
          { id: 'a', x: Ya, y: Ya, label: 'a', kind: 'point', color: A_COL, rows: [['i', f(sel.ia, 'rate')], ['Y', f(Ya, 'bn')]] },
          { id: 'b', x: Yb, y: Yb, label: 'b', kind: 'point', color: B_COL, rows: [['i', f(sel.ib, 'rate')], ['Y', f(Yb, 'bn')]] },
        ]
      : [];
  const win = advWindow(sim.s0, sim.s1);
  const iLo = Math.min(win.i[0], sel.ia, sel.ib) - 0.5;
  const iHi = Math.max(win.i[1], sel.ia, sel.ib) + 0.5;
  const bottom: XYSeries[] = st >= 5 ? [{ id: 'is', points: isPoints(sim.s1.spec, iLo, iHi), color: IS, label: 'IS' }] : [];
  const botMarkers: XYMarker[] =
    st >= 4
      ? [
          { id: 'A', x: Ya, y: sel.ia, label: `a (${f(Ya, 'n0')}; ${f(sel.ia, 'n1')})`, kind: 'point', color: A_COL, rows: [['Y', f(Ya, 'bn')], ['i', f(sel.ia, 'rate')]] },
          { id: 'B', x: Yb, y: sel.ib, label: `b (${f(Yb, 'n0')}; ${f(sel.ib, 'n1')})`, kind: 'point', color: B_COL, rows: [['Y', f(Yb, 'bn')], ['i', f(sel.ib, 'rate')]] },
        ]
      : [];
  const segTop: XYSegment[] = st >= 3 ? [
    { id: 'va', x0: Ya, y0: lo - 1e5, x1: Ya, y1: Ya, color: A_COL, dash: 'dot' },
    { id: 'vb', x0: Yb, y0: lo - 1e5, x1: Yb, y1: Yb, color: B_COL, dash: 'dot' },
  ] : [];
  const segBot: XYSegment[] = st >= 4 ? [
    { id: 'va', x0: Ya, y0: iHi + 100, x1: Ya, y1: sel.ia, color: A_COL, dash: 'dot' },
    { id: 'vb', x0: Yb, y0: iHi + 100, x1: Yb, y1: sel.ib, color: B_COL, dash: 'dot' },
  ] : [];
  return (
    <div className="stack">
      <XYChart xDomain={[lo, hi]} yDomain={[lo, hi]} xLabel={t('con.x.Y')} yLabel={t('con.y.AE')} series={top} markers={topMarkers} segments={segTop} ariaLabel={t('con.c2.top')} aspect={0.5} minHeight={220} nice={false} valueFormat={(v) => f(v, 'n1')} />
      <XYChart xDomain={[lo, hi]} yDomain={[iLo, iHi]} xLabel={t('con.x.Y')} yLabel={t('chart.y')} series={bottom} markers={botMarkers} segments={segBot} ariaLabel={t('con.c2.bottom')} aspect={0.45} minHeight={220} nice={false} />
    </div>
  );
}

// ── Chart 3: IS in four quadrants ──────────────────────────────────────────
export function ISFourQuadrants({ sim, sel }: { sim: AdvSimOk; sel: Selection }) {
  const { t, f } = useI18n();
  const p = sim.s1.spec.params;
  const q1 = sim.s1.equilibrium;
  const win = advWindow(sim.s0, sim.s1);
  const iLo = Math.max(win.i[0], Math.min(sel.ia, sel.ib, q1.i) - 2);
  const iHi = Math.max(sel.ia, sel.ib, q1.i) + 2;
  const rates = [sel.ia, sel.ib, q1.i];
  const Js = rates.map((i) => injections(p, i));
  const Ys = rates.map((i) => isOutput(p, i));
  const yLo = Math.max(0, Math.min(...Ys) - 0.25 * q1.Y);
  const yHi = Math.max(...Ys) + 0.15 * q1.Y;
  const side = Math.max(...Js, injections(p, iLo), leakages(p, yHi)) * 1.1;
  const series: QSeries[] = [
    { id: 'inj', quadrant: 2, points: line2((i) => injections(p, i), iLo, iHi).map(([i, J]) => [J, i] as Pt), color: CI_COL },
    { id: '45', quadrant: 3, points: [[0, 0], [side, side]], color: GRID },
    { id: 'w', quadrant: 4, points: line2((Y) => leakages(p, Y), yLo, yHi), color: C_COL, label: 'W(Y)' },
    { id: 'is', quadrant: 1, points: isPoints(sim.s1.spec, iLo, iHi), color: IS, label: 'IS' },
  ];
  const cols = [A_COL, B_COL, 'var(--eq1)'];
  const names = ['a', 'b', 'E₁'];
  const connectors: QConnector[] = rates.map((i, k) => ({
    id: names[k]!,
    left: Js[k]!,
    down: Js[k]!,
    right: Ys[k]!,
    up: i,
    color: cols[k]!,
    label: names[k],
    rows: [['i', f(i, 'rate')], ['J = I + G', f(Js[k]!, 'bn')], ['W = J', f(Js[k]!, 'bn')], ['Y', f(Ys[k]!, 'bn')]],
  }));
  return (
    <FourQuadrantChart
      right={[yLo, yHi]}
      up={[iLo, iHi]}
      side={side}
      labels={{ right: t('con.x.Y'), up: 'i (%)', left: t('con.q.J'), down: t('con.q.W') }}
      quadrantTitles={[t('con.q1.is'), t('con.q2.is'), t('con.q3.is'), t('con.q4.is')]}
      series={series}
      connectors={connectors}
      ariaLabel={t('con.c3.title')}
    />
  );
}

// ── Chart 4: money market ─────────────────────────────────────────────────
function demandCurve(spec: AdvSpec, Y: number, iLo: number, iHi: number, mMax: number): Pt[] {
  const pts: Pt[] = [];
  const n = 160;
  const p = spec.params;
  const start = spec.lm === 'nonlinear' ? p.iMin : spec.lm === 'floor' ? p.iFloor : iLo;
  for (let j = 0; j <= n; j += 1) {
    const i = spec.lm === 'nonlinear' ? p.iMin + (iHi - p.iMin) * ((j + 1) / (n + 1)) ** 2.5 : start + ((iHi - start) * j) / n;
    const L = moneyDemandOf(spec, Y, i);
    if (L !== null && L <= mMax * 3) pts.push([L, i]);
  }
  if (spec.lm === 'floor' && pts.length) {
    // Perfectly elastic demand at the floor: horizontal segment to the right.
    pts.unshift([mMax * 3, p.iFloor]);
  }
  return pts.sort((a, b) => a[1] - b[1]);
}

export function MoneyMarketChart({ sim }: { sim: AdvSimOk }) {
  const { t, f } = useI18n();
  const s0 = sim.s0;
  const s1 = sim.s1;
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const win = advWindow(s0, s1);
  const iLo = win.i[0];
  const iHi = win.i[1];
  const mMax = Math.max(q0.realMoney, q1.realMoney) * 1.35;
  const spec1 = { ...s1.spec, regime: 'money' as const };
  const spec0 = { ...s0.spec, regime: 'money' as const };
  const series: XYSeries[] = [];
  const specLs = (spec: AdvSpec) =>
    demandCurve(spec, 0, iLo, iHi, mMax).filter((p) => p[0] >= 0);
  series.push({ id: 'ls', points: specLs(spec1), color: C_COL, label: t('con.mm.spec'), width: 1.5 });
  series.push({ id: 'lt', points: [[q1.transactionDemand, iLo - 50], [q1.transactionDemand, iHi + 50]], color: CI_COL, dash: 'dot', label: 'kY₁', hover: false });
  if (Math.abs(q0.Y - q1.Y) > 1e-9 || s0.spec.lm !== s1.spec.lm) series.push({ id: 'l0', points: demandCurve(spec0, q0.Y, iLo, iHi, mMax), color: LM, dash: 'dash', label: 'L(Y₀, i)' });
  series.push({ id: 'l1', points: demandCurve(spec1, q1.Y, iLo, iHi, mMax), color: LM, label: 'L(Y₁, i)' });
  if (s1.spec.regime === 'rate') {
    series.push({ id: 'peg', points: [[0, s1.spec.targetRate], [mMax, s1.spec.targetRate]], color: 'var(--series-3)', label: 'ī', hover: false });
  } else {
    if (Math.abs(q0.realMoney - q1.realMoney) > 1e-9) series.push({ id: 'm0', points: [[q0.realMoney, iLo - 50], [q0.realMoney, iHi + 50]], color: 'var(--text-secondary)', dash: 'dash', label: '(M/P)₀', hover: false });
    series.push({ id: 'm1', points: [[q1.realMoney, iLo - 50], [q1.realMoney, iHi + 50]], color: 'var(--text-primary)', label: '(M/P)₁', hover: false });
  }
  const markers: XYMarker[] = [
    { id: 'e0', x: q0.realMoney, y: q0.i, label: 'E₀', kind: 'e0', rows: [['L', f(q0.moneyDemand, 'bn')], ['kY', f(q0.transactionDemand, 'bn')], [t('con.mm.spec'), f(q0.speculativeDemand, 'bn')], ['i', f(q0.i, 'rate')]] },
    { id: 'e1', x: q1.realMoney, y: q1.i, label: 'E₁', kind: 'e1', rows: [['L', f(q1.moneyDemand, 'bn')], ['kY', f(q1.transactionDemand, 'bn')], [t('con.mm.spec'), f(q1.speculativeDemand, 'bn')], ['i', f(q1.i, 'rate')]] },
  ];
  return (
    <XYChart
      xDomain={[0, mMax]}
      yDomain={[iLo, iHi]}
      xLabel={t('tr.money.x')}
      yLabel={t('chart.y')}
      series={series}
      markers={markers}
      ariaLabel={t('con.c4.title')}
      aspect={0.7}
    />
  );
}

// ── Chart 5: formation of the LM ───────────────────────────────────────────
export function LMFormationChart({ sim, sel }: { sim: AdvSimOk; sel: Selection }) {
  const { t, f } = useI18n();
  const spec = { ...sim.s1.spec, regime: 'money' as const };
  const m = realMoneyOf(spec.params);
  const ia = lmPointForOutput(spec, sel.Ya);
  const ib = lmPointForOutput(spec, sel.Yb);
  const win = advWindow(sim.s0, sim.s1);
  const iLo = win.i[0];
  const iHi = Math.max(win.i[1], ia ?? 0, ib ?? 0) + 0.5;
  const mMax = m * 1.4;
  const st = sel.stepLM;
  const left: XYSeries[] = [{ id: 'm', points: [[m, iLo - 50], [m, iHi + 50]], color: 'var(--text-primary)', label: 'M/P', hover: false }];
  if (st >= 2) {
    left.push({ id: 'la', points: demandCurve(spec, sel.Ya, iLo, iHi, mMax), color: A_COL, label: `L(Y = ${f(sel.Ya, 'n0')})` });
    left.push({ id: 'lb', points: demandCurve(spec, sel.Yb, iLo, iHi, mMax), color: B_COL, label: `L(Y = ${f(sel.Yb, 'n0')})` });
  }
  const lMarkers: XYMarker[] = [];
  const rMarkers: XYMarker[] = [];
  const segL: XYSegment[] = [];
  const segR: XYSegment[] = [];
  const add = (Y: number, i: number | null, id: string, col: string) => {
    if (i === null) return;
    if (st >= 3) {
      lMarkers.push({ id, x: m, y: i, label: id, kind: 'point', color: col, rows: [['Y', f(Y, 'bn')], ['i', f(i, 'rate')]] });
      segL.push({ id: `h${id}`, x0: m, y0: i, x1: mMax * 5, y1: i, color: col, dash: 'dot' });
    }
    if (st >= 4) {
      rMarkers.push({ id: id.toUpperCase(), x: Y, y: i, label: `${id} (${f(Y, 'n0')}; ${f(i, 'n2')})`, kind: 'point', color: col, rows: [['Y', f(Y, 'bn')], ['i', f(i, 'rate')]] });
      segR.push({ id: `h${id}`, x0: -1e5, y0: i, x1: Y, y1: i, color: col, dash: 'dot' });
    }
  };
  add(sel.Ya, ia, 'a', A_COL);
  add(sel.Yb, ib, 'b', B_COL);
  const [yLo, yHi] = crossWindow(sim, [sel.Ya, sel.Yb]);
  const right: XYSeries[] = st >= 5 ? [{ id: 'lm', points: lmPoints(spec, iLo, iHi, yLo, yHi), color: LM, label: 'LM' }] : [];
  return (
    <div className="side-by-side">
      <XYChart xDomain={[0, mMax]} yDomain={[iLo, iHi]} xLabel={t('tr.money.x')} yLabel={t('chart.y')} series={left} markers={lMarkers} segments={segL} ariaLabel={t('con.c5.left')} aspect={0.95} minHeight={260} nice={false} />
      <XYChart xDomain={[yLo, yHi]} yDomain={[iLo, iHi]} xLabel={t('con.x.Y')} yLabel={t('chart.y')} series={right} markers={rMarkers} segments={segR} ariaLabel={t('con.c5.right')} aspect={0.95} minHeight={260} nice={false} />
    </div>
  );
}

// ── Chart 6: LM in four quadrants ──────────────────────────────────────────
export function LMFourQuadrants({ sim, sel }: { sim: AdvSimOk; sel: Selection }) {
  const { t, f } = useI18n();
  const spec = { ...sim.s1.spec, regime: 'money' as const };
  const p = spec.params;
  const m = realMoneyOf(p);
  const q1 = sim.s1.equilibrium;
  const Ys = [sel.Ya, sel.Yb, q1.Y];
  const rates = Ys.map((Y) => lmPointForOutput(spec, Y));
  const finite = rates.filter((x): x is number => x !== null);
  const win = advWindow(sim.s0, sim.s1);
  const iLo = win.i[0];
  const iHi = Math.max(...finite, q1.i) + 1.5;
  const yLo = Math.max(0, Math.min(...Ys) - 0.25 * q1.Y);
  const yHi = Math.min(Math.max(...Ys) + 0.15 * q1.Y, spec.lm === 'nonlinear' ? (m / p.k) * 1.02 : Infinity);
  const side = m * 1.08;
  const lsPts: Pt[] = demandCurve(spec, 0, iLo, iHi, m).filter(([L]) => L >= 0 && L <= side);
  const series: QSeries[] = [
    { id: 'ls', quadrant: 2, points: lsPts, color: C_COL },
    { id: 'budget', quadrant: 3, points: [[0, m], [m, 0]], color: GRID },
    { id: 'lt', quadrant: 4, points: line2((Y) => p.k * Y, yLo, yHi), color: CI_COL, label: 'L_t = kY' },
    { id: 'lm', quadrant: 1, points: lmPoints(spec, iLo, iHi, yLo, yHi), color: LM, label: 'LM' },
  ];
  const cols = [A_COL, B_COL, 'var(--eq1)'];
  const names = ['a', 'b', 'E₁'];
  const connectors: QConnector[] = [];
  Ys.forEach((Y, k) => {
    const i = rates[k];
    if (i === null || i === undefined) return;
    const Lt = p.k * Y;
    const Ls = speculativeAt(spec, i) ?? m - Lt;
    connectors.push({
      id: names[k]!,
      left: Ls,
      down: Lt,
      right: Y,
      up: i,
      color: cols[k]!,
      label: names[k],
      rows: [['Y', f(Y, 'bn')], ['L_t = kY', f(Lt, 'bn')], ['L_s = M/P − kY', f(Ls, 'bn')], ['i', f(i, 'rate')]],
    });
  });
  return (
    <FourQuadrantChart
      right={[yLo, yHi]}
      up={[iLo, iHi]}
      side={side}
      labels={{ right: t('con.x.Y'), up: 'i (%)', left: t('con.q.Ls'), down: t('con.q.Lt') }}
      quadrantTitles={[t('con.q1.lm'), t('con.q2.lm'), t('con.q3.lm'), t('con.q4.lm')]}
      series={series}
      connectors={connectors}
      ariaLabel={t('con.c6.title')}
    />
  );
}

// ── Chart 7: full IS-LM equilibrium ────────────────────────────────────────
export function FullISLMChart({ sim }: { sim: AdvSimOk }) {
  const { t, f } = useI18n();
  const ch = useAdvChart(sim);
  const q0 = sim.s0.equilibrium;
  const q1 = sim.s1.equilibrium;
  return (
    <XYChart
      xDomain={ch.xDomain}
      yDomain={ch.yDomain}
      xLabel={t('chart.x')}
      yLabel={t('chart.y')}
      series={ch.series}
      markers={ch.markers}
      segments={ch.segments}
      bands={ch.bands}
      ariaLabel={t('chart.aria', { Y0: f(q0.Y, 'bn'), i0: f(q0.i, 'rate'), Y1: f(q1.Y, 'bn'), i1: f(q1.i, 'rate') })}
    />
  );
}

