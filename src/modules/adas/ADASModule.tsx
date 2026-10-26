import { useMemo, useState } from 'react';
import {
  ADAS_DEFAULTS,
  ADAS_PRESETS,
  adOutput,
  adjustmentPath,
  compareADAS,
  lmRateAt,
  solveADAS,
  srasPrice,
  type ADASParamKey,
  type ADASParams,
  type ADASPresetId,
  type ADASSolved,
} from '../../engine/adas/adas';
import { alphaOf, autonomousOf } from '../../engine/advanced';
import { useI18n } from '../../i18n';
import { adasParamName, buildADASInsights } from '../../interpretation/adasInsights';
import { usePair } from '../../state/pair';
import { SaveToLab } from '../../components/ui/SaveToLab';
import type { LabConfig } from '../../lab/scenario';
import { ChartCard } from '../../components/ui/ChartCard';
import { CompareTable, Explanation, IssueList, type Row } from '../../components/ui/Explanation';
import { Kpi, ModuleLayout } from '../../components/ui/ModuleLayout';
import { EditToggle, ParamPanel, type FieldMeta } from '../../components/ui/ParamPanel';
import { deltaCls } from '../../components/ui/format';
import { XYChart, type Pt, type XYMarker, type XYSeries } from '../../components/charts/XYChart';
import { DeltaBars } from '../../components/charts/BarCharts';
import { LegendLine } from '../../components/charts/common';
import { ModuleHeader } from '../../components/ui/ModuleHeader';
import { SidePanel } from '../../components/ui/SidePanel';

type P = ADASParams & Record<string, number>;
type F = FieldMeta<ADASParamKey>;

const descKey = (k: ADASParamKey) => adasParamName(k).replace('.name', '.desc');
const fld = (key: ADASParamKey, sym: string, group: string, min: number, max: number, step: number, digits: number, unit: string, level: 'edu' | 'adv', tag?: string): F => ({
  key, sym, name: adasParamName(key), desc: descKey(key), unit, group, min, max, step, digits, level, tag,
});

const FIELDS: F[] = [
  fld('G', 'G', 'adas.group.demand', 0, 800, 5, 0, 'unit.bn', 'edu', 'tag.fiscal'),
  fld('T0', 'T₀', 'adas.group.demand', -200, 400, 5, 0, 'unit.bn', 'adv', 'tag.fiscal'),
  fld('t', 't', 'adas.group.demand', 0, 0.6, 0.01, 2, 'unit.ratio', 'adv', 'tag.fiscal'),
  fld('TR', 'TR', 'adas.group.demand', 0, 600, 5, 0, 'unit.bn', 'adv', 'tag.fiscal'),
  fld('C0', 'C₀', 'adas.group.demand', 0, 600, 5, 0, 'unit.bn', 'adv'),
  fld('c', 'c', 'adas.group.demand', 0, 0.95, 0.01, 2, 'unit.ratio', 'adv'),
  fld('I0', 'I₀', 'adas.group.demand', 0, 800, 5, 0, 'unit.bn', 'edu'),
  fld('b', 'b', 'adas.group.demand', 0, 100, 0.5, 1, 'unit.bnPerPp', 'adv'),
  fld('M', 'M', 'adas.group.money', 100, 3000, 10, 0, 'unit.bn', 'edu', 'tag.monetary'),
  fld('k', 'k', 'adas.group.money', 0.05, 2, 0.01, 2, 'unit.ratio', 'adv'),
  fld('h', 'h', 'adas.group.money', 0, 300, 1, 0, 'unit.bnPerPp', 'adv'),
  fld('L0', 'L₀', 'adas.group.money', 0, 1000, 5, 0, 'unit.bn', 'adv'),
  fld('Yn', 'Yₙ', 'adas.group.supply', 500, 4000, 10, 0, 'unit.bn', 'edu'),
  fld('Pe', 'Pᵉ', 'adas.group.supply', 0.2, 3, 0.01, 2, 'unit.index', 'edu'),
  fld('theta', 'θ', 'adas.group.supply', 0, 0.005, 0.0001, 4, 'adas.unit.theta', 'adv'),
  fld('s', 's', 'adas.group.supply', -0.3, 0.3, 0.01, 2, 'unit.index', 'edu'),
];

const AD = 'var(--series-is)';
const AS = 'var(--series-supply)';
const LR = 'var(--series-ref)';

function ADASChart({ s0, s1 }: { s0: ADASSolved; s1: ADASSolved }) {
  const { t, f } = useI18n();
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const mr = s1.mediumRun;
  const Ps = [q0.P, q1.P, ...(mr ? [mr.P] : [])];
  const Ys = [q0.Y, q1.Y, s1.params.Yn, ...(mr ? [mr.Y] : [])];
  const pLo = Math.max(0.05, Math.min(...Ps) * 0.8);
  const pHi = Math.max(...Ps) * 1.2;
  const yLo = Math.max(0, Math.min(...Ys) - 0.2 * q0.Y);
  const yHi = Math.max(...Ys) + 0.2 * q0.Y;
  const adCurve = (p: ADASParams): Pt[] => Array.from({ length: 80 }, (_, j) => {
    const P = pLo + ((pHi - pLo) * j) / 79;
    return [adOutput(p, P), P] as Pt;
  });
  const asLine = (p: ADASParams): Pt[] => [[yLo, srasPrice(p, yLo)], [yHi, srasPrice(p, yHi)]];
  const adMoved = Math.abs(adOutput(s0.params, q0.P) - adOutput(s1.params, q0.P)) > 1e-9;
  const asMoved = Math.abs(srasPrice(s0.params, q0.Y) - srasPrice(s1.params, q0.Y)) > 1e-12;
  const series: XYSeries[] = [];
  if (adMoved) series.push({ id: 'ad0', points: adCurve(s0.params), color: AD, dash: 'dash', label: 'DA₀' });
  series.push({ id: 'ad1', points: adCurve(s1.params), color: AD, label: adMoved ? 'DA₁' : 'DA' });
  if (asMoved) series.push({ id: 'as0', points: asLine(s0.params), color: AS, dash: 'dash', label: 'OAcp₀' });
  series.push({ id: 'as1', points: asLine(s1.params), color: AS, label: asMoved ? 'OAcp₁' : 'OAcp' });
  series.push({ id: 'lr', points: [[s1.params.Yn, pLo - 10], [s1.params.Yn, pHi + 10]], color: LR, label: t('adas.chart.lras'), hover: false });
  if (mr && Math.abs(mr.Y - s1.params.Yn) > 1e-6) series.push({ id: 'ymr', points: [[mr.Y, pLo - 10], [mr.Y, pHi + 10]], color: LR, dash: 'dot', label: t('adas.chart.ymr'), hover: false });
  const rows = (q: typeof q0): [string, string][] => [['P', f(q.P, 'n4')], ['Y', f(q.Y, 'bn')], [t('adas.var.gap'), f(q.gap, 'spct')], ['i', f(q.i, 'rate')]];
  const markers: XYMarker[] = [{ id: 'e0', x: q0.Y, y: q0.P, label: 'E₀', kind: 'e0', rows: rows(q0) }];
  if (Math.abs(q1.Y - q0.Y) > 1e-9 || Math.abs(q1.P - q0.P) > 1e-12) markers.push({ id: 'e1', x: q1.Y, y: q1.P, label: 'E₁', kind: 'e1', rows: rows(q1) });
  if (mr && (Math.abs(mr.Y - q1.Y) > 1e-6 || Math.abs(mr.P - q1.P) > 1e-9)) markers.push({ id: 'mr', x: mr.Y, y: mr.P, label: t('adas.chart.mrPoint'), kind: 'point', color: LR, rows: [['P', f(mr.P, 'n4')], ['Y', f(mr.Y, 'bn')], ['i', f(mr.i, 'rate')]] });
  return (
    <ChartCard
      title={t('adas.chart.title')}
      subtitle={t('adas.chart.sub')}
      legend={
        <>
          <LegendLine color={AD} label={t('adas.chart.ad')} />
          <LegendLine color={AS} label={t('adas.chart.sras')} />
          <LegendLine color={LR} label={t('adas.chart.lras')} />
          <span className="legend-item">{t('tr.legend')}</span>
        </>
      }
      formula={<pre className="formula">{t('adas.formula')}</pre>}
    >
      <XYChart
        xDomain={[yLo, yHi]}
        yDomain={[pLo, pHi]}
        xLabel={t('chart.x')}
        yLabel={t('adas.chart.pAxis')}
        series={series}
        markers={markers}
        segments={markers.length > 1 && markers[1]!.id === 'e1' ? [{ id: 'p', x0: q0.Y, y0: q0.P, x1: q1.Y, y1: q1.P, color: 'var(--text-primary)', arrow: true, width: 1.3 }] : []}
        ariaLabel={t('adas.chart.title')}
        yFormat={(v) => f(v, 'n2')}
        valueFormat={(v) => f(v, 'n4')}
      />
      <p className="chart-note">{t('adas.chart.note')}</p>
    </ChartCard>
  );
}

/** AD derived from IS-LM: LM curves at three price levels and the resulting AD points. */
function DerivationChart({ s1 }: { s1: ADASSolved }) {
  const { t, f } = useI18n();
  const p = s1.params;
  const q = s1.equilibrium;
  const levels = [q.P * 0.8, q.P, q.P * 1.25];
  const cols = ['var(--series-7)', 'var(--eq1)', 'var(--series-5)'];
  const pts = levels.map((P) => ({ P, Y: adOutput(p, P) }));
  const ys = pts.map((x) => x.Y);
  const yLo = Math.max(0, Math.min(...ys) - 0.15 * q.Y);
  const yHi = Math.max(...ys) + 0.15 * q.Y;
  const is = pts.map((x) => lmRateAt(p, x.Y, x.P));
  const iLo = Math.min(...is) - 3;
  const iHi = Math.max(...is) + 3;
  const alpha = alphaOf(p);
  const A = autonomousOf(p);
  const top: XYSeries[] = [{ id: 'is', points: [[alpha * (A - p.b * iLo), iLo], [alpha * (A - p.b * iHi), iHi]], color: AD, label: 'IS' }];
  levels.forEach((P, k) => {
    const lm: Pt[] = [iLo, iHi].map((i) => [(p.M / P - p.L0 + p.h * i) / p.k, i] as Pt);
    top.push({ id: `lm${k}`, points: lm, color: cols[k]!, label: `LM(P = ${f(P, 'n2')})`, dash: k === 1 ? undefined : 'dash' });
  });
  const topM: XYMarker[] = pts.map((x, k) => ({ id: `t${k}`, x: x.Y, y: lmRateAt(p, x.Y, x.P), kind: 'point', color: cols[k], label: String.fromCharCode(97 + k), rows: [['P', f(x.P, 'n3')], ['Y', f(x.Y, 'bn')], ['i', f(lmRateAt(p, x.Y, x.P), 'rate')]] }));
  const pLo = levels[0]! * 0.85;
  const pHi = levels[2]! * 1.1;
  const ad: Pt[] = Array.from({ length: 60 }, (_, j) => {
    const P = pLo + ((pHi - pLo) * j) / 59;
    return [adOutput(p, P), P] as Pt;
  });
  const botM: XYMarker[] = pts.map((x, k) => ({ id: `b${k}`, x: x.Y, y: x.P, kind: 'point', color: cols[k], label: String.fromCharCode(97 + k), rows: [['P', f(x.P, 'n3')], ['Y', f(x.Y, 'bn')]] }));
  return (
    <ChartCard title={t('adas.deriv.title')} subtitle={t('adas.deriv.sub')} formula={<pre className="formula">{t('adas.deriv.formula')}</pre>}>
      <div className="stack">
        <XYChart xDomain={[yLo, yHi]} yDomain={[iLo, iHi]} xLabel={t('chart.x')} yLabel={t('chart.y')} series={top} markers={topM} ariaLabel={t('adas.deriv.top')} aspect={0.45} minHeight={220} nice={false} />
        <XYChart xDomain={[yLo, yHi]} yDomain={[pLo, pHi]} xLabel={t('chart.x')} yLabel={t('adas.chart.pAxis')} series={[{ id: 'ad', points: ad, color: AD, label: 'DA' }]} markers={botM} ariaLabel={t('adas.deriv.bottom')} aspect={0.45} minHeight={220} nice={false} yFormat={(v) => f(v, 'n2')} />
      </div>
    </ChartCard>
  );
}

function PathCharts({ s1 }: { s1: ADASSolved }) {
  const { t, f } = useI18n();
  const path = adjustmentPath(s1.params, 20);
  if (!s1.mediumRun || path.length < 2) {
    return <p className="note">{t('adas.path.none')}</p>;
  }
  const P = path.map((x) => [x.t, x.P] as Pt);
  const gap = path.map((x) => [x.t, x.gap] as Pt);
  const pv = path.map((x) => x.P);
  const gv = path.map((x) => x.gap);
  return (
    <ChartCard title={t('adas.path.title')} subtitle={t('adas.path.sub')}>
      <div className="side-by-side">
        <XYChart
          xDomain={[0, 20]}
          yDomain={[Math.min(...pv, s1.mediumRun.P) * 0.98, Math.max(...pv, s1.mediumRun.P) * 1.02]}
          xLabel={t('adas.path.t')}
          yLabel={t('adas.chart.pAxis')}
          series={[
            { id: 'p', points: P, color: AS, label: 'Pₜ' },
            { id: 'pmr', points: [[0, s1.mediumRun.P], [20, s1.mediumRun.P]], color: LR, dash: 'dot', label: 'P_MP', hover: false },
          ]}
          ariaLabel={t('adas.path.title')}
          aspect={0.8}
          minHeight={220}
          yFormat={(v) => f(v, 'n3')}
          valueFormat={(v) => f(v, 'n4')}
          nice={false}
        />
        <XYChart
          xDomain={[0, 20]}
          yDomain={[Math.min(...gv, 0) - 0.5, Math.max(...gv, 0) + 0.5]}
          xLabel={t('adas.path.t')}
          yLabel={t('adas.var.gapAxis')}
          series={[{ id: 'g', points: gap, color: AD, label: t('adas.var.gap') }]}
          ariaLabel={t('adas.path.gapTitle')}
          aspect={0.8}
          minHeight={220}
          yFormat={(v) => f(v, 'n1')}
          valueFormat={(v) => f(v, 'n2')}
          nice={false}
        />
      </div>
      <p className="chart-note">{t('adas.path.note')}</p>
    </ChartCard>
  );
}

/** Module F — aggregate demand and aggregate supply. */
export function ADASModule({ sidebarOpen, onCloseSidebar, initial }: { sidebarOpen: boolean; onCloseSidebar: () => void; initial?: Extract<LabConfig, { model: 'adas' }> }) {
  const { t, f } = useI18n();
  const { state, dispatch, set } = usePair<P>(ADAS_DEFAULTS as P, initial as { baseline: P; shocked: P } | undefined);
  const [preset, setPreset] = useState<ADASPresetId | null>(null);
  const r0 = useMemo(() => solveADAS(state.baseline), [state.baseline]);
  const r1 = useMemo(() => solveADAS(state.shocked), [state.shocked]);
  const shock = state.editing === 'shocked';
  const sidebar = (
    <>
      <section>
        <p className="note">{t('adas.assumptions')}</p>
      </section>
      <SidePanel title={t('presets.title')} defaultOpen={false}>
        <div className="presets">
          {ADAS_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={preset === p.id}
              onClick={() => {
                dispatch({ type: 'load', baseline: { ...ADAS_DEFAULTS } as P, shocked: { ...ADAS_DEFAULTS, ...p.shock } as P });
                dispatch({ type: 'editing', side: 'shocked' });
                setPreset(p.id);
                onCloseSidebar();
              }}
            >
              <span className="p-title">{t(`adas.preset.${p.id}.title`)}</span>
              <span className="p-desc">{t(`adas.preset.${p.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </SidePanel>
      <SidePanel title={t('panel.params')}>
        <EditToggle editing={state.editing} onChange={(side) => dispatch({ type: 'editing', side })} />
        <ParamPanel<ADASParamKey> fields={FIELDS} values={shock ? state.shocked : state.baseline} reference={shock ? state.baseline : null} onChange={(k, v) => { set(k, v); setPreset(null); }} />
      </SidePanel>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" onClick={() => dispatch({ type: 'reset' })}>{t('btn.resetShock')}</button>
        <button className="btn small" onClick={() => dispatch({ type: 'adopt' })}>{t('btn.adopt')}</button>
        <button className="btn small ghost" onClick={() => { dispatch({ type: 'load', baseline: { ...ADAS_DEFAULTS } as P, shocked: { ...ADAS_DEFAULTS } as P }); setPreset(null); }}>{t('btn.resetAll')}</button>
      </section>
    </>
  );
  const groups = [
    { side: 'baseline' as const, issues: r0.ok ? r0.value.issues : r0.issues },
    { side: 'shocked' as const, issues: r1.ok ? r1.value.issues : r1.issues },
  ];
  let body: React.ReactNode = null;
  if (r0.ok && r1.ok) {
    const s0 = r0.value;
    const s1 = r1.value;
    const cmp = compareADAS(s0, s1);
    const q0 = s0.equilibrium;
    const q1 = s1.equilibrium;
    const kpi = (label: string, a: number, b: number, fmt: string, dfmt: string) => <Kpi label={label} value={f(b, fmt)} sub={`E₀ ${f(a, fmt)}`} delta={f(b - a, dfmt)} deltaClass={deltaCls(b - a)} />;
    const rows: Row[] = [
      { id: 'P', label: t('adas.var.P'), v0: q0.P, v1: q1.P, fmt: 'n4', emph: true },
      { id: 'Y', label: t('var.Y'), v0: q0.Y, v1: q1.Y, fmt: 'n1', emph: true },
      { id: 'gap', label: `${t('adas.var.gap')} (%)`, v0: q0.gap, v1: q1.gap, fmt: 'n3' },
      { id: 'Yn', label: t('adas.param.Yn.name'), v0: q0.Yn, v1: q1.Yn, fmt: 'n1' },
      { id: 'i', label: `${t('var.i')} (%)`, v0: q0.i, v1: q1.i, fmt: 'n3' },
      { id: 'm', label: t('var.realMoney'), v0: q0.realMoney, v1: q1.realMoney, fmt: 'n1' },
      { id: 'C', label: t('var.C'), v0: q0.C, v1: q1.C, fmt: 'n1' },
      { id: 'I', label: t('var.I'), v0: q0.I, v1: q1.I, fmt: 'n1' },
      { id: 'G', label: t('var.G'), v0: q0.G, v1: q1.G, fmt: 'n1' },
      { id: 'T', label: t('adv.var.T'), v0: q0.T, v1: q1.T, fmt: 'n1' },
      { id: 'Sg', label: t('adv.var.Sg'), v0: q0.Sg, v1: q1.Sg, fmt: 'n1' },
    ];
    const res = Math.max(...Object.values(s0.residuals).map(Math.abs), ...Object.values(s1.residuals).map(Math.abs));
    body = (
      <>
        <div className="kpis">
          {kpi(t('adas.var.P'), q0.P, q1.P, 'n4', 'sn4')}
          {kpi(t('var.Y'), q0.Y, q1.Y, 'bn', 'sbn')}
          {kpi(t('adas.var.gap'), q0.gap, q1.gap, 'spct', 'sn2')}
          {kpi(t('var.i'), q0.i, q1.i, 'rate', 'spp')}
          {kpi(t('var.realMoney'), q0.realMoney, q1.realMoney, 'bn', 'sbn')}
          {kpi(t('var.C'), q0.C, q1.C, 'bn', 'sbn')}
          {kpi(t('var.I'), q0.I, q1.I, 'bn', 'sbn')}
          <Kpi label={t('adas.kpi.mr')} value={s1.mediumRun ? `${f(s1.mediumRun.Y, 'n0')} · P ${f(s1.mediumRun.P, 'n3')}` : '—'} sub={t('adas.kpi.mrSub')} />
        </div>
        <div className="sim-grid">
          <div className="col">
            <ADASChart s0={s0} s1={s1} />
            <DerivationChart s1={s1} />
            <PathCharts s1={s1} />
          </div>
          <div className="col">
            <Explanation report={buildADASInsights(s0, s1, cmp)} />
            <ChartCard title={t('adas.decomp.title')} subtitle={t('adas.decomp.sub')}>
              <DeltaBars
                ariaLabel={t('adas.decomp.title')}
                data={[
                  { label: t('adas.decomp.ad'), value: cmp.adShift },
                  { label: t('adas.decomp.price'), value: cmp.priceEffect },
                  { label: 'ΔY', value: cmp.changes.Y.abs, emphasis: true },
                ]}
              />
            </ChartCard>
            <CompareTable title={t('table.title')} subtitle={t('adas.identity', { r: res.toExponential(1) })} rows={rows} />
          </div>
        </div>
      </>
    );
  }
  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={sidebar}>
      <ModuleHeader id="adas">
        <SaveToLab config={r0.ok && r1.ok ? { model: 'adas', baseline: state.baseline, shocked: state.shocked } : null} defaultName={t('mod.adas')} />
      </ModuleHeader>
      <IssueList groups={groups} prefix="adas.issue." />
      {body}
    </ModuleLayout>
  );
}
