import { useMemo, useState } from 'react';
import {
  ISMP_DEFAULTS,
  ISMP_PRESETS,
  compareISMP,
  isRealRate,
  mpRealRate,
  phillips,
  policySensitivity,
  ruleRate,
  solveISMP,
  type ISMPParamKey,
  type ISMPParams,
  type ISMPPresetId,
  type ISMPSolved,
  type MPRegime,
} from '../../engine/ismp/ismp';
import { useI18n } from '../../i18n';
import { buildISMPInsights } from '../../interpretation/ismpInsights';
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

type P = ISMPParams & Record<string, number>;
type F = FieldMeta<ISMPParamKey>;
const fld = (key: ISMPParamKey, sym: string, group: string, min: number, max: number, step: number, digits: number, unit: string, level: 'edu' | 'adv', tag?: string): F => ({
  key, sym, name: `ismp.param.${key}.name`, desc: `ismp.param.${key}.desc`, unit, group, min, max, step, digits, level, tag,
});

function fields(regime: MPRegime): F[] {
  const out: F[] = [
    fld('d', 'd', 'ismp.group.is', -12, 12, 0.25, 2, 'unit.pp', 'edu'),
    fld('sigma', 'σ', 'ismp.group.is', 0, 3, 0.05, 2, 'ismp.unit.ppPerPp', 'adv'),
    fld('rn', 'rₙ', 'ismp.group.is', -2, 6, 0.25, 2, 'unit.pp', 'edu'),
    fld('kappa', 'κ', 'ismp.group.pc', 0, 1.5, 0.05, 2, 'ismp.unit.ppPerPp', 'adv'),
    fld('piE', 'πᵉ', 'ismp.group.pc', -2, 10, 0.25, 2, 'unit.pp', 'edu'),
    fld('u', 'u', 'ismp.group.pc', -4, 6, 0.25, 2, 'unit.pp', 'edu'),
  ];
  if (regime === 'rule') {
    out.push(
      fld('rStar', 'r̂*', 'ismp.group.rule', -2, 6, 0.25, 2, 'unit.pp', 'edu', 'tag.monetary'),
      fld('piStar', 'π*', 'ismp.group.rule', 0, 8, 0.25, 2, 'unit.pp', 'edu', 'tag.monetary'),
      fld('phiPi', 'φπ', 'ismp.group.rule', 0, 3, 0.05, 2, 'ismp.unit.ppPerPp', 'edu', 'tag.monetary'),
      fld('phiY', 'φy', 'ismp.group.rule', 0, 3, 0.05, 2, 'ismp.unit.ppPerPp', 'edu', 'tag.monetary'),
      fld('v', 'v', 'ismp.group.rule', -4, 4, 0.25, 2, 'unit.pp', 'adv', 'tag.monetary'),
    );
  } else {
    out.push(fld('iPeg', 'ī', 'ismp.group.rule', -1, 12, 0.25, 2, 'unit.pp', 'edu', 'tag.monetary'));
  }
  out.push(fld('iLB', 'i_lb', 'ismp.group.rule', -2, 2, 0.25, 2, 'unit.pp', 'edu'));
  return out;
}

const ISC = 'var(--series-is)';
const MPC = 'var(--series-lm)';
const PCC = 'var(--series-supply)';
const RC = 'var(--series-lm)';

function ISMPCharts({ s0, s1 }: { s0: ISMPSolved; s1: ISMPSolved }) {
  const { t, f } = useI18n();
  const p0 = s0.spec.params;
  const p1 = s1.spec.params;
  const reg = s1.spec.regime;
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const xs = [q0.x, q1.x];
  const xLo = Math.min(...xs, -2) - 3;
  const xHi = Math.max(...xs, 2) + 3;
  const grid = (fn: (x: number) => number | null, n = 120): Pt[] =>
    Array.from({ length: n + 1 }, (_, j) => {
      const x = xLo + ((xHi - xLo) * j) / n;
      return [x, fn(x)] as [number, number | null];
    }).filter((pt): pt is Pt => pt[1] !== null);
  // (x, r) panel
  const isS = (p: ISMPParams) => grid((x) => isRealRate(p, x));
  const mpS = (p: ISMPParams) => grid((x) => mpRealRate(p, x, reg));
  const rLo = Math.min(q0.r, q1.r) - 4;
  const rHi = Math.max(q0.r, q1.r) + 4;
  const same = (a: Pt[], b: Pt[]) => JSON.stringify(a) === JSON.stringify(b);
  const xr: XYSeries[] = [];
  if (!same(isS(p0), isS(p1))) xr.push({ id: 'is0', points: isS(p0), color: ISC, dash: 'dash', label: 'IS₀' });
  xr.push({ id: 'is1', points: isS(p1), color: ISC, label: 'IS' + (same(isS(p0), isS(p1)) ? '' : '₁') });
  if (!same(mpS(p0), mpS(p1))) xr.push({ id: 'mp0', points: mpS(p0), color: MPC, dash: 'dash', label: 'MP₀' });
  xr.push({ id: 'mp1', points: mpS(p1), color: MPC, label: 'MP' + (same(mpS(p0), mpS(p1)) ? '' : '₁') });
  const mk = (q: typeof q0, id: 'e0' | 'e1', y: number): XYMarker => ({ id, x: q.x, y, label: id === 'e0' ? 'E₀' : 'E₁', kind: id, rows: [['x', f(q.x, 'spp')], ['π', f(q.pi, 'rate')], ['i', f(q.i, 'rate')], ['r', f(q.r, 'rate')]] });
  const moved = Math.abs(q0.x - q1.x) > 1e-9 || Math.abs(q0.pi - q1.pi) > 1e-9 || Math.abs(q0.i - q1.i) > 1e-9;
  const m1 = [mk(q0, 'e0', q0.r), ...(moved ? [mk(q1, 'e1', q1.r)] : [])];
  // (x, π) Phillips
  const pc = (p: ISMPParams) => grid((x) => phillips(p, x), 2);
  const pis = [q0.pi, q1.pi, p1.piStar];
  const pc1: XYSeries[] = [];
  if (!same(pc(p0), pc(p1))) pc1.push({ id: 'pc0', points: pc(p0), color: PCC, dash: 'dash', label: 'CP₀' });
  pc1.push({ id: 'pc1', points: pc(p1), color: PCC, label: same(pc(p0), pc(p1)) ? 'CP' : 'CP₁' });
  pc1.push({ id: 'tgt', points: [[xLo - 50, p1.piStar], [xHi + 50, p1.piStar]], color: 'var(--text-muted)', dash: 'dot', label: 'π*', hover: false });
  const m2 = [mk(q0, 'e0', q0.pi), ...(moved ? [mk(q1, 'e1', q1.pi)] : [])];
  // (π, i) Taylor rule at x₁
  const piLo = Math.min(...pis) - 3;
  const piHi = Math.max(...pis) + 3;
  const ruleLine: Pt[] = [piLo, piHi].map((pi) => [pi, ruleRate(p1, pi, q1.x)] as Pt);
  const tr: XYSeries[] = [
    { id: 'rule', points: ruleLine, color: RC, label: t('ismp.chart.rule') },
    { id: 'fisher', points: [piLo, piHi].map((pi) => [pi, p1.rStar + pi] as Pt), color: 'var(--text-muted)', dash: 'dot', label: 'r̂* + π' },
    { id: 'lb', points: [[piLo - 50, p1.iLB], [piHi + 50, p1.iLB]], color: 'var(--series-ref)', dash: 'dash', label: t('ismp.chart.lb'), hover: false },
  ];
  if (reg === 'peg') tr.push({ id: 'peg', points: [[piLo - 50, p1.iPeg], [piHi + 50, p1.iPeg]], color: MPC, label: 'ī', hover: false });
  const is_ = [q0.i, q1.i, ...ruleLine.map((x) => x[1]), p1.iLB];
  const m3: XYMarker[] = [{ id: 'e0', x: q0.pi, y: q0.i, label: 'E₀', kind: 'e0' }, ...(moved ? [{ id: 'e1', x: q1.pi, y: q1.i, label: 'E₁', kind: 'e1' as const }] : [])];
  return (
    <>
      <ChartCard
        title={t('ismp.chart.ismp')}
        subtitle={t(reg === 'peg' ? 'ismp.chart.ismp.peg' : 'ismp.chart.ismp.sub')}
        legend={<><LegendLine color={ISC} label="IS" /><LegendLine color={MPC} label="MP" /><span className="legend-item">{t('tr.legend')}</span></>}
        formula={<pre className="formula">{t('ismp.formula')}</pre>}
      >
        <XYChart xDomain={[xLo, xHi]} yDomain={[rLo, rHi]} xLabel={t('ismp.axis.x')} yLabel={t('ismp.axis.r')} series={xr} markers={m1} ariaLabel={t('ismp.chart.ismp')} valueFormat={(v) => f(v, 'n2')} yFormat={(v) => f(v, 'n1')} xFormat={(v) => f(v, 'n1')} />
      </ChartCard>
      <div className="grid-2">
        <ChartCard title={t('ismp.chart.pc')} subtitle={t('ismp.chart.pc.sub')}>
          <XYChart xDomain={[xLo, xHi]} yDomain={[Math.min(...pis) - 3, Math.max(...pis) + 3]} xLabel={t('ismp.axis.x')} yLabel={t('ismp.axis.pi')} series={pc1} markers={m2} ariaLabel={t('ismp.chart.pc')} aspect={0.8} yFormat={(v) => f(v, 'n1')} xFormat={(v) => f(v, 'n1')} />
        </ChartCard>
        <ChartCard title={t('ismp.chart.taylor')} subtitle={t('ismp.chart.taylor.sub', { x: q1.x })}>
          <XYChart xDomain={[piLo, piHi]} yDomain={[Math.min(...is_) - 1, Math.max(...is_) + 1]} xLabel={t('ismp.axis.pi')} yLabel={t('ismp.axis.i')} series={tr} markers={m3} ariaLabel={t('ismp.chart.taylor')} aspect={0.8} yFormat={(v) => f(v, 'n1')} xFormat={(v) => f(v, 'n1')} />
        </ChartCard>
      </div>
    </>
  );
}

function SensitivityCharts({ s1 }: { s1: ISMPSolved }) {
  const { t, f } = useI18n();
  if (s1.spec.regime !== 'rule') return null;
  const make = (param: 'phiPi' | 'phiY') => {
    const pts = policySensitivity(s1.spec, param, 0, 3, 60);
    const series: XYSeries[] = [
      { id: 'gap', points: pts.map((p) => [p.x, p.gap] as Pt), color: ISC, label: t('ismp.var.x') },
      { id: 'pi', points: pts.map((p) => [p.x, p.pi] as Pt), color: PCC, label: t('ismp.var.pi') },
    ];
    const ys = pts.flatMap((p) => [p.gap, p.pi]);
    return (
      <XYChart
        xDomain={[0, 3]}
        yDomain={[Math.min(...ys, 0) - 0.5, Math.max(...ys, 0) + 0.5]}
        xLabel={t(`ismp.param.${param}.name`)}
        yLabel={t('ismp.axis.pp')}
        series={series}
        segments={[{ id: 'cur', x0: s1.spec.params[param], y0: -1e3, x1: s1.spec.params[param], y1: 1e3, color: 'var(--text-primary)', dash: 'dot' }]}
        ariaLabel={t(`ismp.param.${param}.name`)}
        aspect={0.75}
        valueFormat={(v) => f(v, 'n3')}
        yFormat={(v) => f(v, 'n1')}
        xFormat={(v) => f(v, 'n1')}
      />
    );
  };
  return (
    <ChartCard title={t('ismp.sens.title')} subtitle={t('ismp.sens.sub')} legend={<><LegendLine color={ISC} label={t('ismp.var.x')} /><LegendLine color={PCC} label={t('ismp.var.pi')} /></>}>
      <div className="side-by-side">
        {make('phiPi')}
        {make('phiY')}
      </div>
    </ChartCard>
  );
}

/** Module G — IS-MP, Phillips curve and Taylor rule. */
export function ISMPModule({ sidebarOpen, onCloseSidebar, initial }: { sidebarOpen: boolean; onCloseSidebar: () => void; initial?: Extract<LabConfig, { model: 'ismp' }> }) {
  const { t, f } = useI18n();
  const { state, dispatch, set } = usePair<P>(ISMP_DEFAULTS as P, initial as { baseline: P; shocked: P } | undefined);
  const [regime, setRegime] = useState<MPRegime>(initial?.regime ?? 'rule');
  const [preset, setPreset] = useState<ISMPPresetId | null>(null);
  const r0 = useMemo(() => solveISMP({ params: state.baseline, regime }), [state.baseline, regime]);
  const r1 = useMemo(() => solveISMP({ params: state.shocked, regime }), [state.shocked, regime]);
  const shock = state.editing === 'shocked';
  const sidebar = (
    <>
      <SidePanel title={t('ismp.regime.label')}>
        <div className="segmented" role="group" aria-label={t('ismp.regime.label')}>
          {(['rule', 'peg'] as MPRegime[]).map((rg) => (
            <button key={rg} aria-pressed={regime === rg} onClick={() => { setRegime(rg); setPreset(null); }}>
              {t(`ismp.regime.${rg}`)}
              <span className="sub">{t(`ismp.regime.${rg}.sub`)}</span>
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{t('ismp.assumptions')}</p>
      </SidePanel>
      <SidePanel title={t('presets.title')} defaultOpen={false}>
        <div className="presets">
          {ISMP_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={preset === p.id}
              onClick={() => {
                setRegime(p.regime);
                dispatch({ type: 'load', baseline: { ...ISMP_DEFAULTS } as P, shocked: { ...ISMP_DEFAULTS, ...p.shock } as P });
                dispatch({ type: 'editing', side: 'shocked' });
                setPreset(p.id);
                onCloseSidebar();
              }}
            >
              <span className="p-title">{t(`ismp.preset.${p.id}.title`)}</span>
              <span className="p-desc">{t(`ismp.preset.${p.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </SidePanel>
      <SidePanel title={t('panel.params')}>
        <EditToggle editing={state.editing} onChange={(side) => dispatch({ type: 'editing', side })} />
        <ParamPanel<ISMPParamKey> fields={fields(regime)} values={shock ? state.shocked : state.baseline} reference={shock ? state.baseline : null} onChange={(k, v) => { set(k, v); setPreset(null); }} />
      </SidePanel>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" onClick={() => dispatch({ type: 'reset' })}>{t('btn.resetShock')}</button>
        <button className="btn small" onClick={() => dispatch({ type: 'adopt' })}>{t('btn.adopt')}</button>
        <button className="btn small ghost" onClick={() => { dispatch({ type: 'load', baseline: { ...ISMP_DEFAULTS } as P, shocked: { ...ISMP_DEFAULTS } as P }); setPreset(null); }}>{t('btn.resetAll')}</button>
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
    const cmp = compareISMP(s0, s1);
    const q0 = s0.equilibrium;
    const q1 = s1.equilibrium;
    const kpi = (label: string, a: number, b: number, fmt: string) => <Kpi label={label} value={f(b, fmt)} sub={`E₀ ${f(a, fmt)}`} delta={f(b - a, 'spp')} deltaClass={deltaCls(b - a)} />;
    const rows: Row[] = [
      { id: 'x', label: `${t('ismp.var.x')} (pp)`, v0: q0.x, v1: q1.x, fmt: 'n3', emph: true },
      { id: 'pi', label: `${t('ismp.var.pi')} (%)`, v0: q0.pi, v1: q1.pi, fmt: 'n3', emph: true },
      { id: 'i', label: `${t('ismp.var.i')} (%)`, v0: q0.i, v1: q1.i, fmt: 'n3' },
      { id: 'r', label: `${t('ismp.var.r')} (%)`, v0: q0.r, v1: q1.r, fmt: 'n3' },
      { id: 'iRule', label: `${t('ismp.var.iRule')} (%)`, v0: q0.iRule, v1: q1.iRule, fmt: 'n3' },
    ];
    body = (
      <>
        <div className="kpis">
          {kpi(t('ismp.var.x'), q0.x, q1.x, 'spp')}
          {kpi(t('ismp.var.pi'), q0.pi, q1.pi, 'rate')}
          {kpi(t('ismp.var.i'), q0.i, q1.i, 'rate')}
          {kpi(t('ismp.var.r'), q0.r, q1.r, 'rate')}
          <Kpi label={t('ismp.kpi.elb')} value={s1.elbBinding ? t('ismp.kpi.binding') : t('ismp.kpi.free')} sub={`i_lb = ${f(s1.spec.params.iLB, 'rate')}`} />
          <Kpi label={t('ismp.kpi.dxdd')} value={f(s1.derivatives.dx_dd, 'n3')} sub={t('ismp.kpi.dxddSub')} />
        </div>
        <div className="sim-grid">
          <div className="col">
            <ISMPCharts s0={s0} s1={s1} />
            <SensitivityCharts s1={s1} />
          </div>
          <div className="col">
            <Explanation report={buildISMPInsights(s0, s1, cmp)} />
            <ChartCard title={t('ismp.cmp.title')} subtitle={t('ismp.cmp.sub')}>
              <DeltaBars
                format="spp"
                ariaLabel={t('ismp.cmp.title')}
                data={[
                  { label: t('ismp.var.x'), value: cmp.changes.x.abs },
                  { label: t('ismp.var.pi'), value: cmp.changes.pi.abs },
                  { label: t('ismp.var.i'), value: cmp.changes.i.abs, emphasis: true },
                  { label: t('ismp.var.r'), value: cmp.changes.r.abs },
                ]}
              />
            </ChartCard>
            <CompareTable title={t('table.title')} rows={rows} />
            <div className="card">
              <div className="card-head"><div><h2>{t('ismp.regimes.title')}</h2></div></div>
              <div className="card-body"><p className="note">{t('ismp.regimes.text')}</p></div>
            </div>
          </div>
        </div>
      </>
    );
  }
  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={sidebar}>
      <ModuleHeader id="ismp">
        <SaveToLab config={r0.ok && r1.ok ? { model: 'ismp', baseline: state.baseline, shocked: state.shocked, regime } : null} defaultName={t('mod.ismp')} />
      </ModuleHeader>
      <IssueList groups={groups} prefix="ismp.issue." />
      {body}
    </ModuleLayout>
  );
}
