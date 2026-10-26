import { useMemo, useState, type Dispatch } from 'react';
import {
  liquidityParam,
  multiplierGrid,
  policyMatrix,
  runPolicy,
  sensitivityCurve,
  type AdvParamKey,
  type LMSpec,
  type PolicyKind,
  type PolicyResult,
  type SensParam,
} from '../../engine/advanced';
import { useI18n } from '../../i18n';
import { buildAdvancedInsights } from '../../interpretation/advancedInsights';
import { specOf, type AdvAction, type AdvSimOk, type AdvState } from '../../state/advancedState';
import { ChartCard } from '../../components/ui/ChartCard';
import { CompareTable, Explanation, IssueList, type Row } from '../../components/ui/Explanation';
import { Kpi, ModuleLayout } from '../../components/ui/ModuleLayout';
import { ParamPanel } from '../../components/ui/ParamPanel';
import { deltaCls } from '../../components/ui/format';
import { XYChart, type XYSeries } from '../../components/charts/XYChart';
import { HeatMap } from '../../components/charts/HeatMap';
import { LegendLine } from '../../components/charts/common';
import { advFields } from '../advanced/fields';
import { IS, LM, useAdvChart } from '../advanced/useAdvChart';
import { ModuleHeader } from '../../components/ui/ModuleHeader';
import { SidePanel } from '../../components/ui/SidePanel';

type Tab = 'fiscal' | 'monetary' | 'mix' | 'sensitivity';
const FISCAL: PolicyKind[] = ['G', 'T0', 't', 'TR', 'GT0', 'Gacc'];
const MONETARY: PolicyKind[] = ['M', 'rate', 'liq', 'sens', 'floorM'];
const DEFAULT_SIZE: Record<PolicyKind, number> = { G: 50, T0: -50, t: 0.05, TR: 50, GT0: 50, Gacc: 50, M: 100, rate: -1, liq: 100, sens: 25, floorM: 200 };

interface Props {
  state: AdvState;
  dispatch: Dispatch<AdvAction>;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

function PolicySidebar({ state, dispatch }: { state: AdvState; dispatch: Dispatch<AdvAction> }) {
  const { t } = useI18n();
  const specs: LMSpec[] = ['linear', 'nonlinear', 'floor'];
  return (
    <>
      <SidePanel title={t('adv.lm.label')}>
        <div className="segmented three" role="group" aria-label={t('adv.lm.label')}>
          {specs.map((s) => (
            <button key={s} aria-pressed={state.lm === s} onClick={() => dispatch({ type: 'lm', lm: s })}>
              {t(`adv.lm.${s}`)}
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{t('pol.baseNote')}</p>
      </SidePanel>
      <SidePanel title={t('pol.base')}>
        <ParamPanel<AdvParamKey> fields={advFields(state.lm, 'money')} values={state.baseline} reference={null} onChange={(key, value) => dispatch({ type: 'setBase', key, value })} />
      </SidePanel>
      <section>
        <button className="btn small ghost" onClick={() => dispatch({ type: 'restore' })}>{t('btn.resetAll')}</button>
      </section>
    </>
  );
}

function sizeMeta(kind: PolicyKind) {
  if (kind === 't') return { step: 0.01, min: -0.3, max: 0.3, unit: 'unit.ratio', digits: 2 };
  if (kind === 'rate') return { step: 0.25, min: -5, max: 5, unit: 'unit.pp', digits: 2 };
  return { step: 10, min: -500, max: 500, unit: 'unit.bn', digits: 0 };
}

function PolicyExperiment({ base, kinds }: { base: ReturnType<typeof specOf>; kinds: PolicyKind[] }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<PolicyKind>(kinds[0]!);
  const [sizes, setSizes] = useState<Record<PolicyKind, number>>(DEFAULT_SIZE);
  const size = sizes[kind];
  const meta = sizeMeta(kind);
  const res = useMemo(() => runPolicy(base, { kind, size }), [base, kind, size]);
  const liqKey = kind === 'liq' || kind === 'sens' ? liquidityParam(base, kind) : null;
  const controls = (
      <div className="card policy-controls">
        <div className="card-body" style={{ paddingTop: 14 }}>
          <div className="policy-chips" role="radiogroup" aria-label={t('pol.instrument')}>
            {kinds.map((k) => (
              <button key={k} role="radio" aria-checked={kind === k} className="chip-option" onClick={() => setKind(k)} title={t(`pol.k.${k}.desc`)}>
                {t(`pol.k.${k}`)}
              </button>
            ))}
          </div>
          <p className="muted small policy-desc">{t(`pol.k.${kind}.desc`)}</p>
          <div className="inline-fields">
            <label className="inline-field">
              <span>{t('pol.size')}</span>
              <input
                type="number"
                step={meta.step}
                value={size}
                onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setSizes((s) => ({ ...s, [kind]: e.target.valueAsNumber }))}
              />
              <span>{t(meta.unit)}</span>
            </label>
            <input
              type="range"
              aria-label={t('pol.size')}
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={size}
              onChange={(e) => setSizes((s) => ({ ...s, [kind]: Number(e.target.value) }))}
              style={{ flex: 1, minWidth: 160, accentColor: 'var(--accent)' }}
            />
            {liqKey && <span className="note" style={{ margin: 0 }}>{t('pol.liqParam', { p: liqKey })}</span>}
          </div>
        </div>
      </div>
  );

  return (
    <>
      {!res.ok ? (
        <>
          {controls}
          <IssueList groups={[{ side: 'shocked', issues: res.issues }]} prefix="adv.issue." />
        </>
      ) : (
        <PolicyResultView res={res} controls={controls} />
      )}
      {res.ok && <p className="chart-note">{t(res.s1.diagnostics.method === 'brent' ? 'pol.solvedBrent' : 'pol.solvedClosed', { it: String(res.s1.diagnostics.iterations) })}</p>}
    </>
  );
}

function PolicyResultView({ res, controls }: { res: PolicyResult; controls: React.ReactNode }) {
  const { t, f } = useI18n();
  const sim: AdvSimOk = useMemo(
    () => ({ ok: true, s0: res.s0, s1: res.s1, cmp: res.cmp, report: buildAdvancedInsights(res.s0, res.s1, res.cmp), tangent: null }),
    [res],
  );
  const chart = useAdvChart(sim);
  const ch = res.cmp.changes;
  const share = Math.abs(res.constantRateDY) > 1e-9 ? (res.crowding / res.constantRateDY) * 100 : null;
  const rows: Row[] = [
    { id: 'Y', label: t('var.Y'), v0: res.s0.equilibrium.Y, v1: res.s1.equilibrium.Y, fmt: 'n1', emph: true },
    { id: 'i', label: `${t('var.i')} (%)`, v0: res.s0.equilibrium.i, v1: res.s1.equilibrium.i, fmt: 'n3', emph: true },
    { id: 'C', label: t('var.C'), v0: res.s0.equilibrium.C, v1: res.s1.equilibrium.C, fmt: 'n1' },
    { id: 'I', label: t('var.I'), v0: res.s0.equilibrium.I, v1: res.s1.equilibrium.I, fmt: 'n1' },
    { id: 'G', label: t('var.G'), v0: res.s0.equilibrium.G, v1: res.s1.equilibrium.G, fmt: 'n1' },
    { id: 'T', label: t('adv.var.T'), v0: res.s0.equilibrium.T, v1: res.s1.equilibrium.T, fmt: 'n1' },
    { id: 'TR', label: t('adv.var.TR'), v0: res.s0.equilibrium.TR, v1: res.s1.equilibrium.TR, fmt: 'n1' },
    { id: 'Sg', label: t('adv.var.Sg'), v0: res.s0.equilibrium.Sg, v1: res.s1.equilibrium.Sg, fmt: 'n1' },
    { id: 'S', label: t('var.S'), v0: res.s0.equilibrium.S, v1: res.s1.equilibrium.S, fmt: 'n1' },
    { id: 'm', label: t('var.realMoney'), v0: res.s0.equilibrium.realMoney, v1: res.s1.equilibrium.realMoney, fmt: 'n1' },
  ];
  return (
    <>
      <div className="sim-grid">
        <div className="col">
          <ChartCard
            title={t('adv.chart.title')}
            subtitle={t('pol.chartSub')}
            legend={
              <>
                <LegendLine color={IS} label="IS₁" />
                <LegendLine color={IS} dashed label="IS₀" />
                <LegendLine color={LM} label="LM₁" />
                <LegendLine color={LM} dashed label="LM₀" />
              </>
            }
          >
            <XYChart xDomain={chart.xDomain} yDomain={chart.yDomain} xLabel={t('chart.x')} yLabel={t('chart.y')} series={chart.series} markers={chart.markers} segments={chart.segments} bands={chart.bands} ariaLabel={t('adv.chart.title')} />
          </ChartCard>
          <CompareTable title={t('table.title')} rows={rows} />
        </div>
        <div className="col col-side">
          {controls}
          <div className="kpis kpis-main">
            <Kpi label="ΔY" value={f(ch.Y.abs, 'sbn')} delta={ch.Y.pct === null ? undefined : f(ch.Y.pct, 'spct')} deltaClass={deltaCls(ch.Y.abs)} />
            <Kpi label="Δi" value={f(ch.i.abs, 'spp')} />
            <Kpi label={t('pol.kpi.eff')} value={res.effectiveMultiplier === null ? '—' : f(res.effectiveMultiplier, 'n3')} sub={t('pol.kpi.effSub')} />
            <Kpi label={t('pol.kpi.crowding')} value={f(res.crowding, 'sbn')} sub={share === null ? undefined : t('pol.kpi.crowdingSub', { share })} />
          </div>
          <details className="kpi-more">
            <summary>{t('kpi.more')}</summary>
            <div className="kpis">
              <Kpi label="ΔI" value={f(ch.I.abs, 'sbn')} />
              <Kpi label="ΔC" value={f(ch.C.abs, 'sbn')} />
              <Kpi label="ΔS" value={f(ch.S.abs, 'sbn')} />
              <Kpi label={t('pol.kpi.budget')} value={f(res.dBudget, 'sbn')} />
            </div>
          </details>
          <Explanation report={sim.report} />
        </div>
      </div>
    </>
  );
}

function PolicyMix({ base }: { base: ReturnType<typeof specOf> }) {
  const { t, f } = useI18n();
  const [dG, setDG] = useState(50);
  const [dM, setDM] = useState(100);
  const cells = useMemo(() => policyMatrix(base, dG, dM), [base, dG, dM]);
  const cell = (fs: 1 | -1, ms: 1 | -1) => cells.find((c) => c.fiscal === fs && c.monetary === ms)!;
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{t('pol.mix.title')}</h2>
          <p>{t('pol.mix.sub')}</p>
        </div>
      </div>
      <div className="card-body">
        <div className="inline-fields">
          <label className="inline-field">
            <span>|ΔG|</span>
            <input type="number" step={10} value={dG} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setDG(e.target.valueAsNumber)} />
          </label>
          <label className="inline-field">
            <span>|ΔM|</span>
            <input type="number" step={10} value={dM} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && setDM(e.target.valueAsNumber)} />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data matrix">
            <thead>
              <tr>
                <th scope="col"></th>
                <th scope="col">{t('pol.mix.mExp')} (+{f(dM, 'n0')})</th>
                <th scope="col">{t('pol.mix.mCon')} (−{f(dM, 'n0')})</th>
              </tr>
            </thead>
            <tbody>
              {([1, -1] as const).map((fs) => (
                <tr key={fs}>
                  <th scope="row">{fs === 1 ? t('pol.mix.fExp') : t('pol.mix.fCon')} ({fs === 1 ? '+' : '−'}{f(dG, 'n0')})</th>
                  {([1, -1] as const).map((ms) => {
                    const c = cell(fs, ms);
                    const j = c.joint;
                    return (
                      <td key={ms} className="matrix-cell">
                        {j ? (
                          <>
                            <div><strong>ΔY</strong> {f(j.cmp.changes.Y.abs, 'sbn')}</div>
                            <div><strong>Δi</strong> {f(j.cmp.changes.i.abs, 'spp')}</div>
                            <div><strong>ΔI</strong> {f(j.cmp.changes.I.abs, 'sbn')}</div>
                            <div className="muted">{t('pol.mix.additive', { sum: c.additiveDY ?? Number.NaN, gap: j.cmp.changes.Y.abs - (c.additiveDY ?? Number.NaN) })}</div>
                          </>
                        ) : (
                          t('sc.invalid')
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: 10 }}>{t(base.lm === 'linear' ? 'pol.mix.noteLinear' : 'pol.mix.noteNonlinear')}</p>
      </div>
    </div>
  );
}

const SENS_RANGE: Record<SensParam, [number, number]> = { c: [0.4, 0.92], b: [2, 100], h: [2, 200], a: [50, 1500], k: [0.15, 1.2], t: [0, 0.5] };

function PolicySensitivity({ base }: { base: ReturnType<typeof specOf> }) {
  const { t, f } = useI18n();
  const params: SensParam[] = base.lm === 'nonlinear' ? ['c', 'b', 'a', 'k', 't'] : ['c', 'b', 'h', 'k', 't'];
  const [param, setParam] = useState<SensParam>('b');
  const [which, setWhich] = useState<'fiscal' | 'monetary'>('fiscal');
  const pts = useMemo(() => sensitivityCurve(base, param, ...SENS_RANGE[param], 80), [base, param]);
  const py: SensParam = base.lm === 'nonlinear' ? 'a' : 'h';
  const grid = useMemo(() => multiplierGrid(base, 'b', py, SENS_RANGE.b, SENS_RANGE[py], 14, which), [base, py, which]);
  const series: XYSeries[] = [
    { id: 'f', points: pts.map((p) => [p.x, p.fiscal]), color: IS, label: t('sens.fiscal') },
    { id: 'm', points: pts.map((p) => [p.x, p.monetary]), color: LM, label: t('sens.monetary') },
    { id: 'a', points: pts.map((p) => [p.x, p.alpha]), color: 'var(--text-muted)', dash: 'dash', label: 'α' },
  ];
  const cur = base.params[param];
  const yMax = Math.max(1, ...pts.flatMap((p) => [p.fiscal, p.monetary, p.alpha]).filter(Number.isFinite));
  return (
    <div className="grid-2">
      <ChartCard
        title={t('pol.sens.curveTitle')}
        subtitle={t('pol.sens.curveSub')}
        legend={
          <>
            <LegendLine color={IS} label={t('sens.fiscal')} />
            <LegendLine color={LM} label={t('sens.monetary')} />
            <LegendLine color="var(--text-muted)" dashed label="α = 1/[1 − c(1 − t)]" />
          </>
        }
        footer={
          <div className="segmented" role="group" aria-label={t('pol.sens.param')} style={{ marginTop: 8 }}>
            {params.map((p) => (
              <button key={p} aria-pressed={param === p} onClick={() => setParam(p)}>
                {t(`pol.sp.${p}`)}
              </button>
            ))}
          </div>
        }
      >
        <XYChart
          xDomain={SENS_RANGE[param]}
          yDomain={[0, yMax * 1.08]}
          xLabel={t(`pol.sp.${param}`)}
          yLabel={t('sens.y')}
          series={series}
          segments={[{ id: 'cur', x0: cur, y0: -1e6, x1: cur, y1: 1e6, color: 'var(--text-primary)', dash: 'dot' }]}
          ariaLabel={t('pol.sens.curveTitle')}
          valueFormat={(v) => f(v, 'n3')}
        />
      </ChartCard>
      <ChartCard
        title={t('pol.sens.heatTitle', { y: t(`pol.sp.${py}`) })}
        subtitle={t('pol.sens.heatSub')}
        footer={
          <div className="segmented" role="group" aria-label={t('pol.sens.which')} style={{ marginTop: 8 }}>
            <button aria-pressed={which === 'fiscal'} onClick={() => setWhich('fiscal')}>{t('sens.fiscal')}</button>
            <button aria-pressed={which === 'monetary'} onClick={() => setWhich('monetary')}>{t('sens.monetary')}</button>
          </div>
        }
      >
        <HeatMap
          xs={grid.xs}
          ys={grid.ys}
          z={grid.z}
          xLabel={t('pol.sp.b')}
          yLabel={t(`pol.sp.${py}`)}
          valueLabel={which === 'fiscal' ? 'dY/dG' : 'dY/d(M/P)'}
          ariaLabel={t('pol.sens.heatTitle', { y: t(`pol.sp.${py}`) })}
          current={{ x: base.params.b, y: base.params[py] }}
        />
      </ChartCard>
    </div>
  );
}

/** Module D — economic-policy laboratory (built on the Module B engine). */
export function PolicyModule({ state, dispatch, sidebarOpen, onCloseSidebar }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('fiscal');
  const base = useMemo(() => ({ ...specOf(state, 'baseline'), regime: 'money' as const }), [state]);
  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={<PolicySidebar state={state} dispatch={dispatch} />}>
      <ModuleHeader id="policy" />
      <nav className="tabs" role="tablist">
        {(['fiscal', 'monetary', 'mix', 'sensitivity'] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`pol.tab.${k}`)}
          </button>
        ))}
      </nav>
      {tab === 'fiscal' && <PolicyExperiment key="f" base={base} kinds={FISCAL} />}
      {tab === 'monetary' && <PolicyExperiment key="m" base={base} kinds={MONETARY} />}
      {tab === 'mix' && <PolicyMix base={base} />}
      {tab === 'sensitivity' && <PolicySensitivity base={base} />}
    </ModuleLayout>
  );
}
