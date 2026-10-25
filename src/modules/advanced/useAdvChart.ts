import { isOutput, type AdvSolved } from '../../engine/advanced';
import { useI18n } from '../../i18n';
import type { AdvSimOk } from '../../state/advancedState';
import type { XYMarker, XYSegment, XYSeries } from '../../components/charts/XYChart';
import { advWindow, isPoints, lmPoints, zoneBands } from './curves';

export const IS = 'var(--series-is)';
export const LM = 'var(--series-lm)';
export const LIN = 'var(--series-7)';

/** IS-LM chart model (curves, equilibria, guides, zones) for Modules B, C and D. */
export function useAdvChart(sim: AdvSimOk, opts: { showTangent?: boolean } = {}) {
  const { t, f } = useI18n();
  const { s0, s1 } = sim;
  const win = advWindow(s0, s1);
  const [iLo, iHi] = win.i;
  const [yLo, yHi] = win.y;
  const same = (a: AdvSolved, b: AdvSolved, which: 'is' | 'lm') =>
    which === 'is'
      ? JSON.stringify(isPoints(a.spec, iLo, iHi)) === JSON.stringify(isPoints(b.spec, iLo, iHi))
      : JSON.stringify(lmPoints(a.spec, iLo, iHi, yLo, yHi)) === JSON.stringify(lmPoints(b.spec, iLo, iHi, yLo, yHi));
  const isMoved = !same(s0, s1, 'is');
  const lmMoved = !same(s0, s1, 'lm');
  const series: XYSeries[] = [];
  if (isMoved) series.push({ id: 'is0', points: isPoints(s0.spec, iLo, iHi), color: IS, dash: 'dash', label: 'IS₀', opacity: 0.85 });
  series.push({ id: 'is1', points: isPoints(s1.spec, iLo, iHi), color: IS, label: isMoved ? 'IS₁' : 'IS' });
  if (lmMoved) series.push({ id: 'lm0', points: lmPoints(s0.spec, iLo, iHi, yLo, yHi), color: LM, dash: 'dash', label: 'LM₀', opacity: 0.85 });
  series.push({ id: 'lm1', points: lmPoints(s1.spec, iLo, iHi, yLo, yHi), color: LM, label: lmMoved ? 'LM₁' : 'LM' });
  if (opts.showTangent && sim.tangent) {
    series.push({ id: 'lin0', points: lmPoints(sim.tangent.s0.spec, iLo, iHi, yLo, yHi), color: LIN, dash: 'dot', label: t('adv.compare.linShort0') });
    series.push({ id: 'lin1', points: lmPoints(sim.tangent.s1.spec, iLo, iHi, yLo, yHi), color: LIN, label: t('adv.compare.linShort1') });
  }
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const rows = (q: typeof q0): [string, string][] => [
    ['Y', f(q.Y, 'bn')],
    ['i', f(q.i, 'rate')],
    ['C', f(q.C, 'bn')],
    ['I', f(q.I, 'bn')],
    ['T', f(q.T, 'bn')],
    ['M/P', f(q.realMoney, 'bn')],
  ];
  const markers: XYMarker[] = [{ id: 'e0', x: q0.Y, y: q0.i, label: 'E₀', kind: 'e0', rows: rows(q0) }];
  const moved = Math.abs(q1.Y - q0.Y) > 1e-9 || Math.abs(q1.i - q0.i) > 1e-9;
  if (moved) markers.push({ id: 'e1', x: q1.Y, y: q1.i, label: 'E₁', kind: 'e1', rows: rows(q1) });
  if (opts.showTangent && sim.tangent) {
    const tq = sim.tangent.s1.equilibrium;
    markers.push({ id: 'lin', x: tq.Y, y: tq.i, label: t('adv.compare.linPoint'), kind: 'point', color: LIN, rows: [['Y', f(tq.Y, 'bn')], ['i', f(tq.i, 'rate')]] });
  }
  const keyn = isOutput(s1.spec.params, q0.i);
  if (isMoved && Math.abs(q1.i - q0.i) > 1e-6) markers.push({ id: 'k', x: keyn, y: q0.i, kind: 'ghost', color: IS });
  const segments: XYSegment[] = [
    { id: 'g0x', x0: q0.Y, y0: iLo - 100, x1: q0.Y, y1: q0.i, color: 'var(--text-muted)', dash: 'dot' },
    { id: 'g0y', x0: yLo - 1e5, y0: q0.i, x1: q0.Y, y1: q0.i, color: 'var(--text-muted)', dash: 'dot' },
  ];
  if (moved) {
    segments.push({ id: 'g1x', x0: q1.Y, y0: iLo - 100, x1: q1.Y, y1: q1.i, color: 'var(--text-muted)', dash: 'dot' });
    segments.push({ id: 'g1y', x0: yLo - 1e5, y0: q1.i, x1: q1.Y, y1: q1.i, color: 'var(--text-muted)', dash: 'dot' });
    segments.push({ id: 'path', x0: q0.Y, y0: q0.i, x1: q1.Y, y1: q1.i, color: 'var(--text-primary)', arrow: true, width: 1.4 });
  }
  if (s1.spec.lm === 'nonlinear' && s1.spec.regime === 'money') {
    segments.push({ id: 'imin', x0: yLo - 1e5, y0: s1.spec.params.iMin, x1: yHi + 1e5, y1: s1.spec.params.iMin, color: LM, dash: 'dot', width: 1 });
  }
  const bands = zoneBands(s1, { trap: t('adv.zoneShort.trap'), intermediate: t('adv.zoneShort.intermediate'), classical: t('adv.zoneShort.classical'), floor: t('adv.zoneShort.floor') });
  return { series, markers, segments, bands, xDomain: win.y, yDomain: win.i };
}

