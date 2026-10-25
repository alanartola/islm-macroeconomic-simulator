import { useI18n } from '../i18n';
import type { SimulationOk } from '../state/simulation';
import { DeltaBars, GroupedBars } from './charts/BarCharts';
import { PanelChart, type PanelLine, type PanelPoint } from './charts/PanelChart';
import { LegendLine } from './charts/common';
import { paddedExtent } from './charts/utils';

/** E₀ (dashed) and E₁ (solid) versions of a schedule, or a single solid line when they coincide. */
function pair(l0: PanelLine, l1: PanelLine, sameLabel: string): PanelLine[] {
  const same = [l0.x0 - l1.x0, l0.y0 - l1.y0, l0.x1 - l1.x1, l0.y1 - l1.y1].every((d) => Math.abs(d) < 1e-9);
  if (same) return [{ ...l1, label: sameLabel || undefined }];
  return [{ ...l0, label: l0.label || undefined, dashed: true, opacity: 0.85 }, { ...l1, label: l1.label || undefined }];
}

export function TransmissionView({ sim }: { sim: SimulationOk }) {
  const { t, f } = useI18n();
  const { e0, e1, comparison: cmp } = sim;
  const p0 = e0.spec.params;
  const p1 = e1.spec.params;
  const q0 = e0.equilibrium;
  const q1 = e1.equilibrium;
  const targeting = e1.spec.regime === 'interest-target';
  const [iLo, iHi] = paddedExtent([q0.i, q1.i], 3, 0.4);

  // ── Money market: L(Y, i) = kY − h·i, supply M/P ──────────────────────────
  const L = (p: typeof p0, Y: number, i: number) => p.k * Y - p.h * i;
  const moneyLines: PanelLine[] = [
    ...pair(
      { id: 'L0', x0: L(p0, q0.Y, iLo), y0: iLo, x1: L(p0, q0.Y, iHi), y1: iHi, color: 'var(--series-lm)', label: 'L₀' },
      { id: 'L1', x0: L(p1, q1.Y, iLo), y0: iLo, x1: L(p1, q1.Y, iHi), y1: iHi, color: 'var(--series-lm)', label: 'L₁' },
      'L',
    ),
    ...pair(
      { id: 'm0', x0: q0.realMoney, y0: iLo, x1: q0.realMoney, y1: iHi, color: 'var(--text-secondary)', label: '' },
      { id: 'm1', x0: q1.realMoney, y0: iLo, x1: q1.realMoney, y1: iHi, color: 'var(--text-primary)', label: '' },
      '',
    ),
  ];
  if (targeting) {
    moneyLines.push(
      ...pair(
        { id: 'peg0', x0: -1e6, y0: e0.spec.targetRate, x1: 1e6, y1: e0.spec.targetRate, color: 'var(--series-ref)', label: '' },
        { id: 'peg1', x0: -1e6, y0: e1.spec.targetRate, x1: 1e6, y1: e1.spec.targetRate, color: 'var(--series-ref)', label: 'ī' },
        'ī',
      ),
    );
  }
  const [mLo, mHi] = paddedExtent([q0.realMoney, q1.realMoney], Math.max(50, q0.realMoney * 0.35), 0.4);
  const mDomain: [number, number] = [Math.max(0, mLo), mHi];

  const eqPoints = (x0: number, x1: number, extra: (q: typeof q0) => [string, string][]): PanelPoint[] => {
    const pts: PanelPoint[] = [{ id: 'E0', x: x0, y: q0.i, label: 'E₀', filled: false, rows: [['i', f(q0.i, 'rate')], ...extra(q0)] }];
    if (Math.abs(x1 - x0) > 1e-9 || Math.abs(q1.i - q0.i) > 1e-9) {
      pts.push({ id: 'E1', x: x1, y: q1.i, label: 'E₁', filled: true, rows: [['i', f(q1.i, 'rate')], ...extra(q1)] });
    }
    return pts;
  };

  // ── Investment schedule I = I₀ − b·i ──────────────────────────────────────
  const Ifn = (p: typeof p0, i: number) => p.I0 - p.b * i;
  const invLines: PanelLine[] = pair(
    { id: 'I0', x0: Ifn(p0, iLo), y0: iLo, x1: Ifn(p0, iHi), y1: iHi, color: 'var(--series-is)', label: '' },
    { id: 'I1', x0: Ifn(p1, iLo), y0: iLo, x1: Ifn(p1, iHi), y1: iHi, color: 'var(--series-is)', label: '' },
    '',
  );
  const [invLo, invHi] = paddedExtent([q0.I, q1.I, Ifn(p0, iLo), Ifn(p1, iLo), Ifn(p0, iHi), Ifn(p1, iHi)], 20, 0.05);

  // ── Keynesian cross AE = A − b·i + c·Y ────────────────────────────────────
  // A tight window around E₀/E₁ keeps the AE schedules (slope c) visually distinct from the 45° line.
  const [yLo, yHi] = paddedExtent([q0.Y, q1.Y], Math.max(80, q0.Y * 0.08), 0.8);
  const ae = (p: typeof p0, A: number, i: number, Y: number) => A - p.b * i + p.c * Y;
  const crossLines: PanelLine[] = [
    { id: '45', x0: yLo, y0: yLo, x1: yHi, y1: yHi, color: 'var(--text-muted)', label: '45°' },
    ...pair(
      { id: 'ae0', x0: yLo, y0: ae(p0, q0.A, q0.i, yLo), x1: yHi, y1: ae(p0, q0.A, q0.i, yHi), color: 'var(--series-is)' },
      { id: 'ae1', x0: yLo, y0: ae(p1, q1.A, q1.i, yLo), x1: yHi, y1: ae(p1, q1.A, q1.i, yHi), color: 'var(--series-is)' },
      '',
    ),
  ];
  const showAeAtI0 = Math.abs(q1.i - q0.i) > 1e-9 && Math.abs(cmp.isShift.horizontal) > 1e-9;
  if (showAeAtI0) {
    crossLines.push({ id: 'ae1i0', x0: yLo, y0: ae(p1, q1.A, q0.i, yLo), x1: yHi, y1: ae(p1, q1.A, q0.i, yHi), color: 'var(--series-is)', dotted: true, opacity: 0.85 });
  }
  const crossPts: PanelPoint[] = [{ id: 'E0', x: q0.Y, y: q0.Y, label: 'E₀', filled: false, rows: [[t('tr.cross.eq'), f(q0.Y, 'bn')]] }];
  if (Math.abs(q1.Y - q0.Y) > 1e-9) crossPts.push({ id: 'E1', x: q1.Y, y: q1.Y, label: 'E₁', filled: true, rows: [[t('tr.cross.eq'), f(q1.Y, 'bn')]] });

  const ch = cmp.changes;

  return (
    <>
      <div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 16 }}>{t('tr.title')}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{t('tr.subtitle')}</p>
      </div>
      <div className="grid-3">
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.money.title')}</h3><p>{t('tr.money.desc')}</p></div></div>
          <div className="card-body">
            <PanelChart
              xDomain={mDomain}
              yDomain={[iLo, iHi]}
              xLabel={t('tr.money.x')}
              yLabel={t('chart.y')}
              lines={moneyLines}
              points={eqPoints(q0.realMoney, q1.realMoney, (q) => [['M/P', f(q.realMoney, 'bn')], ['L', f(q.moneyDemand, 'bn')], ['Y', f(q.Y, 'bn')]])}
              ariaLabel={t('tr.money.title')}
            />
            <div className="chart-legend">
              <LegendLine color="var(--series-lm)" label={t('tr.money.demand')} />
              <LegendLine color="var(--text-primary)" label={t('tr.money.supply')} />
              {targeting && <LegendLine color="var(--series-ref)" label="ī" />}
              <span className="legend-item">{t('tr.legend')}</span>
            </div>
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.inv.title')}</h3><p>{t('tr.inv.desc')}</p></div></div>
          <div className="card-body">
            <PanelChart
              xDomain={[Math.min(0, invLo), invHi]}
              yDomain={[iLo, iHi]}
              xLabel={t('tr.inv.x')}
              yLabel={t('chart.y')}
              lines={invLines}
              points={eqPoints(q0.I, q1.I, (q) => [['I', f(q.I, 'bn')]])}
              ariaLabel={t('tr.inv.title')}
            />
            <div className="chart-legend">
              <LegendLine color="var(--series-is)" label="I(i)" />
              <span className="legend-item">{t('tr.legend')}</span>
            </div>
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.cross.title')}</h3><p>{t('tr.cross.desc')}</p></div></div>
          <div className="card-body">
            <PanelChart
              xDomain={[yLo, yHi]}
              yDomain={[yLo, yHi]}
              xLabel={t('tr.cross.x')}
              yLabel={t('tr.cross.y')}
              lines={crossLines}
              points={crossPts}
              ariaLabel={t('tr.cross.title')}
            />
            <div className="chart-legend">
              <LegendLine color="var(--series-is)" dashed label={t('tr.cross.ae0')} />
              <LegendLine color="var(--series-is)" label={t('tr.cross.ae1')} />
              {showAeAtI0 && <LegendLine color="var(--series-is)" dashed label={`${t('tr.cross.ae1i0')} (···)`} />}
              <LegendLine color="var(--text-muted)" label={t('tr.cross.45')} />
            </div>
          </div>
        </div>
      </div>
      <div className="grid-3">
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.comp.title')}</h3><p>{t('tr.comp.desc')}</p></div></div>
          <div className="card-body">
            <GroupedBars
              aLabel="E₀"
              bLabel="E₁"
              ariaLabel={t('tr.comp.title')}
              data={[
                { label: 'C', a: q0.C, b: q1.C },
                { label: 'I', a: q0.I, b: q1.I },
                { label: 'G', a: q0.G, b: q1.G },
              ]}
            />
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.delta.title')}</h3><p>{t('tr.delta.desc')}</p></div></div>
          <div className="card-body">
            <DeltaBars
              ariaLabel={t('tr.delta.title')}
              data={[
                { label: 'ΔY', value: ch.Y.abs, emphasis: true },
                { label: 'ΔC', value: ch.C.abs },
                { label: 'ΔI', value: ch.I.abs },
                { label: 'ΔG', value: ch.G.abs },
                { label: 'ΔSp', value: ch.Sp.abs },
                { label: 'ΔSg', value: ch.Sg.abs },
                { label: 'ΔS', value: ch.S.abs, emphasis: true },
              ]}
            />
          </div>
        </div>
        <div className="card chart-card">
          <div className="card-head"><div><h3>{t('tr.decomp.title')}</h3><p>{t('tr.decomp.desc')}</p></div></div>
          <div className="card-body">
            <DeltaBars
              ariaLabel={t('tr.decomp.title')}
              data={[
                { label: t('tr.decomp.is'), value: cmp.output.isShiftAtInitialRate },
                { label: t('tr.decomp.rate'), value: cmp.output.interestRateEffect },
                { label: t('tr.decomp.total'), value: cmp.output.total, emphasis: true },
              ]}
            />
          </div>
        </div>
      </div>
    </>
  );
}
