import { useMemo, useState } from 'react';
import {
  OPEN_DEFAULTS,
  OPEN_PRESETS,
  compareOpen,
  maxOpenResidual,
  openAlpha,
  openAutonomous,
  solveOpen,
  tradeResponse,
  type FXRegime,
  type OpenParamKey,
  type OpenParams,
  type OpenPresetId,
  type OpenSolved,
} from '../../engine/open/mundellFleming';
import { useI18n } from '../../i18n';
import { buildOpenInsights } from '../../interpretation/openInsights';
import { usePair } from '../../state/pair';
import { SaveToLab } from '../../components/ui/SaveToLab';
import type { LabConfig } from '../../lab/scenario';
import { ChartCard } from '../../components/ui/ChartCard';
import { CompareTable, Explanation, IssueList, type Row } from '../../components/ui/Explanation';
import { Kpi, ModuleLayout } from '../../components/ui/ModuleLayout';
import { EditToggle, ParamPanel, type FieldMeta } from '../../components/ui/ParamPanel';
import { deltaCls } from '../../components/ui/format';
import { XYChart, type XYMarker, type XYSegment, type XYSeries } from '../../components/charts/XYChart';
import { GroupedBars } from '../../components/charts/BarCharts';
import { LegendLine } from '../../components/charts/common';
import { ModuleHeader } from '../../components/ui/ModuleHeader';

type F = FieldMeta<OpenParamKey>;
const f_ = (key: OpenParamKey, sym: string, group: string, min: number, max: number, step: number, digits: number, unit: string, level: 'edu' | 'adv', tag?: string): F => ({
  key,
  sym,
  name: `open.param.${key}.name`,
  desc: `open.param.${key}.desc`,
  unit,
  group,
  min,
  max,
  step,
  digits,
  level,
  tag,
});

function openFields(regime: FXRegime): F[] {
  const g = 'open.group.goods';
  const x = 'open.group.external';
  const mny = 'open.group.money';
  const out: F[] = [
    f_('G', 'G', g, 0, 700, 5, 0, 'unit.bn', 'edu', 'tag.fiscal'),
    f_('T0', 'T₀', g, -200, 400, 5, 0, 'unit.bn', 'adv', 'tag.fiscal'),
    f_('t', 't', g, 0, 0.6, 0.01, 2, 'unit.ratio', 'adv', 'tag.fiscal'),
    f_('TR', 'TR', g, 0, 500, 5, 0, 'unit.bn', 'adv', 'tag.fiscal'),
    f_('C0', 'C₀', g, 0, 600, 5, 0, 'unit.bn', 'adv'),
    f_('c', 'c', g, 0, 0.95, 0.01, 2, 'unit.ratio', 'edu'),
    f_('I0', 'I₀', g, 0, 700, 5, 0, 'unit.bn', 'adv'),
    f_('b', 'b', g, 0, 100, 0.5, 1, 'unit.bnPerPp', 'adv'),
    f_('Yf', 'Y*', x, 0, 3000, 10, 0, 'unit.bn', 'edu'),
    f_('X0', 'X₀', x, 0, 600, 5, 0, 'unit.bn', 'edu'),
    f_('v', 'v', x, 0, 0.5, 0.01, 2, 'unit.ratio', 'adv'),
    f_('xq', 'x_q', x, 0, 400, 5, 0, 'open.unit.perQ', 'adv'),
    f_('IM0', 'IM₀', x, 0, 600, 5, 0, 'unit.bn', 'adv'),
    f_('m', 'm', x, 0, 0.5, 0.01, 2, 'unit.ratio', 'edu'),
    f_('mq', 'm_q', x, -200, 400, 5, 0, 'open.unit.perQ', 'adv'),
    f_('iStar', 'i*', mny, 0, 12, 0.25, 2, 'unit.pct', 'edu'),
    f_('D', 'D', mny, 0, 1500, 10, 0, 'unit.bn', 'edu', 'tag.monetary'),
  ];
  if (regime === 'flexible') out.push(f_('R', 'R', mny, 0, 800, 10, 0, 'unit.bn', 'adv'));
  if (regime === 'fixed') out.push(f_('Ebar', 'Ē', mny, 0.3, 3, 0.01, 2, 'unit.index', 'edu', 'tag.monetary'));
  out.push(f_('k', 'k', mny, 0.05, 2, 0.01, 2, 'unit.ratio', 'adv'), f_('h', 'h', mny, 0, 300, 1, 0, 'unit.bnPerPp', 'adv'), f_('P', 'P', mny, 0.2, 3, 0.01, 2, 'unit.index', 'adv'), f_('Pf', 'P*', mny, 0.2, 3, 0.01, 2, 'unit.index', 'adv'));
  return out;
}

const IS = 'var(--series-is)';
const LM = 'var(--series-lm)';
const BP = 'var(--series-ext)';

function OpenCharts({ s0, s1 }: { s0: OpenSolved; s1: OpenSolved }) {
  const { t, f } = useI18n();
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const p0 = s0.spec.params;
  const p1 = s1.spec.params;
  const fixed = s1.spec.regime === 'fixed';
  const ys = [q0.Y, q1.Y];
  const yLo = Math.max(0, Math.min(...ys) - 0.3 * q0.Y);
  const yHi = Math.max(...ys) + 0.3 * q0.Y;
  const qs = [q0.q, q1.q];
  const qLo = Math.max(0, Math.min(...qs) - 0.6);
  const qHi = Math.max(...qs) + 0.6;
  const isQ = (p: OpenParams, Y: number) => (Y / openAlpha(p) - openAutonomous(p) + p.b * p.iStar) / tradeResponse(p);
  const isStar = (p: OpenParams): [number, number][] => [
    [yLo, isQ(p, yLo)],
    [yHi, isQ(p, yHi)],
  ];
  const vert = (Y: number): [number, number][] => [
    [Y, qLo - 10],
    [Y, qHi + 10],
  ];
  const s1q: XYSeries[] = [];
  const isMoved = JSON.stringify(isStar(p0)) !== JSON.stringify(isStar(p1));
  if (isMoved) s1q.push({ id: 'is0', points: isStar(p0), color: IS, dash: 'dash', label: 'IS*₀' });
  s1q.push({ id: 'is1', points: isStar(p1), color: IS, label: isMoved ? 'IS*₁' : 'IS*' });
  if (Math.abs(q0.Y - q1.Y) > 1e-9) s1q.push({ id: 'lm0', points: vert(q0.Y), color: LM, dash: 'dash', label: 'LM*₀', hover: false });
  s1q.push({ id: 'lm1', points: vert(q1.Y), color: LM, label: Math.abs(q0.Y - q1.Y) > 1e-9 ? 'LM*₁' : 'LM*', hover: false });
  if (fixed) s1q.push({ id: 'peg', points: [[yLo - 1e4, q1.q], [yHi + 1e4, q1.q]], color: BP, dash: 'dot', label: t('open.chart.peg'), hover: false });
  const rows = (q: typeof q0): [string, string][] => [
    ['Y', f(q.Y, 'bn')],
    ['q', f(q.q, 'n3')],
    ['NX', f(q.NX, 'sbn')],
    ['M', f(q.M, 'bn')],
  ];
  const markers: XYMarker[] = [{ id: 'e0', x: q0.Y, y: q0.q, label: 'E₀', kind: 'e0', rows: rows(q0) }];
  if (Math.abs(q0.Y - q1.Y) > 1e-9 || Math.abs(q0.q - q1.q) > 1e-9) markers.push({ id: 'e1', x: q1.Y, y: q1.q, label: 'E₁', kind: 'e1', rows: rows(q1) });
  const path: XYSegment[] = markers.length > 1 ? [{ id: 'p', x0: q0.Y, y0: q0.q, x1: q1.Y, y1: q1.q, color: 'var(--text-primary)', arrow: true, width: 1.3 }] : [];

  // (Y, i) panel: IS at q₀/q₁, LM, BP (i = i*).
  const iStar = p1.iStar;
  const iLo = Math.max(-1, Math.min(p0.iStar, iStar) - 4);
  const iHi = Math.max(p0.iStar, iStar) + 4;
  const isI = (p: OpenParams, q: number): [number, number][] =>
    [iLo, iHi].map((i) => [openAlpha(p) * (openAutonomous(p) - p.b * i + tradeResponse(p) * q), i] as [number, number]);
  const lmI = (p: OpenParams, M: number): [number, number][] => [iLo, iHi].map((i) => [(M / p.P + p.h * i) / p.k, i] as [number, number]);
  const yi: XYSeries[] = [
    { id: 'is0', points: isI(p0, q0.q), color: IS, dash: 'dash', label: 'IS(q₀)' },
    { id: 'is1', points: isI(p1, q1.q), color: IS, label: 'IS(q₁)' },
    { id: 'lm0', points: lmI(p0, q0.M), color: LM, dash: 'dash', label: 'LM₀' },
    { id: 'lm1', points: lmI(p1, q1.M), color: LM, label: 'LM₁' },
    { id: 'bp', points: [[yLo - 1e4, iStar], [yHi + 1e4, iStar]], color: BP, label: 'BP: i = i*', hover: false },
  ];
  const mYi: XYMarker[] = [
    { id: 'e0', x: q0.Y, y: p0.iStar, label: 'E₀', kind: 'e0' },
    { id: 'e1', x: q1.Y, y: iStar, label: 'E₁', kind: 'e1' },
  ];
  return (
    <>
      <ChartCard
        title={t('open.chart.yq')}
        subtitle={t(fixed ? 'open.chart.yq.fixed' : 'open.chart.yq.flex')}
        legend={
          <>
            <LegendLine color={IS} label="IS*" />
            <LegendLine color={LM} label="LM*" />
            {fixed && <LegendLine color={BP} dashed label={t('open.chart.peg')} />}
          </>
        }
        formula={<pre className="formula">{t('open.formula')}</pre>}
      >
        <XYChart xDomain={[yLo, yHi]} yDomain={[qLo, qHi]} xLabel={t('chart.x')} yLabel={t('open.chart.qAxis')} series={s1q} markers={markers} segments={path} ariaLabel={t('open.chart.yq')} valueFormat={(v) => f(v, 'n3')} yFormat={(v) => f(v, 'n2')} />
        <p className="chart-note">{t('open.chart.convention')}</p>
      </ChartCard>
      <ChartCard title={t('open.chart.yi')} subtitle={t('open.chart.yi.sub')}>
        <XYChart xDomain={[yLo, yHi]} yDomain={[iLo, iHi]} xLabel={t('chart.x')} yLabel={t('chart.y')} series={yi} markers={mYi} ariaLabel={t('open.chart.yi')} />
      </ChartCard>
    </>
  );
}

function ImportSensitivity({ s1 }: { s1: OpenSolved }) {
  const { t, f } = useI18n();
  const pts: [number, number][] = [];
  for (let j = 0; j <= 50; j += 1) {
    const m = (0.4 * j) / 50;
    pts.push([m, openAlpha({ ...s1.spec.params, m })]);
  }
  return (
    <ChartCard title={t('open.sens.title')} subtitle={t('open.sens.sub')}>
      <XYChart
        xDomain={[0, 0.4]}
        yDomain={[0, Math.max(...pts.map((p) => p[1])) * 1.1]}
        xLabel={t('open.param.m.name')}
        yLabel={t('open.sens.y')}
        series={[{ id: 'a', points: pts, color: IS, label: 'α_o' }]}
        segments={[{ id: 'cur', x0: s1.spec.params.m, y0: -1e3, x1: s1.spec.params.m, y1: 1e3, color: 'var(--text-primary)', dash: 'dot' }]}
        ariaLabel={t('open.sens.title')}
        valueFormat={(v) => f(v, 'n3')}
        aspect={0.5}
      />
    </ChartCard>
  );
}

/** Module E — small open economy (Mundell-Fleming). */
export function OpenModule({ sidebarOpen, onCloseSidebar, initial }: { sidebarOpen: boolean; onCloseSidebar: () => void; initial?: Extract<LabConfig, { model: 'open' }> }) {
  const { t, f } = useI18n();
  const { state, dispatch, set } = usePair<OpenParams & Record<string, number>>(
    OPEN_DEFAULTS as OpenParams & Record<string, number>,
    initial as { baseline: OpenParams & Record<string, number>; shocked: OpenParams & Record<string, number> } | undefined,
  );
  const [regime, setRegime] = useState<FXRegime>(initial?.regime ?? 'flexible');
  const [preset, setPreset] = useState<OpenPresetId | null>(null);
  const r0 = useMemo(() => solveOpen({ params: state.baseline, regime }), [state.baseline, regime]);
  const r1 = useMemo(() => solveOpen({ params: state.shocked, regime }), [state.shocked, regime]);
  const shock = state.editing === 'shocked';

  const sidebar = (
    <>
      <section>
        <h2 className="section-title">{t('open.regime.label')}</h2>
        <div className="segmented" role="group" aria-label={t('open.regime.label')}>
          {(['flexible', 'fixed'] as FXRegime[]).map((rg) => (
            <button key={rg} aria-pressed={regime === rg} onClick={() => { setRegime(rg); setPreset(null); }}>
              {t(`open.regime.${rg}`)}
              <span className="sub">{t(`open.regime.${rg}.sub`)}</span>
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{t('open.assumptions')}</p>
      </section>
      <section>
        <h2 className="section-title">{t('presets.title')}</h2>
        <div className="presets">
          {OPEN_PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={preset === p.id}
              onClick={() => {
                setRegime(p.regime);
                dispatch({ type: 'load', baseline: { ...OPEN_DEFAULTS } as OpenParams & Record<string, number>, shocked: { ...OPEN_DEFAULTS, ...p.shock } as OpenParams & Record<string, number> });
                dispatch({ type: 'editing', side: 'shocked' });
                setPreset(p.id);
                onCloseSidebar();
              }}
            >
              <span className="p-title">{t(`open.preset.${p.id}.title`)}</span>
              <span className="p-desc">{t(`open.preset.${p.id}.desc`)}</span>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="section-title">{t('panel.params')}</h2>
        <EditToggle editing={state.editing} onChange={(side) => dispatch({ type: 'editing', side })} />
        <ParamPanel<OpenParamKey>
          fields={openFields(regime)}
          values={shock ? state.shocked : state.baseline}
          reference={shock ? state.baseline : null}
          onChange={(k, v) => {
            set(k, v);
            setPreset(null);
          }}
        />
      </section>
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" onClick={() => dispatch({ type: 'reset' })}>{t('btn.resetShock')}</button>
        <button className="btn small" onClick={() => dispatch({ type: 'adopt' })}>{t('btn.adopt')}</button>
        <button className="btn small ghost" onClick={() => { dispatch({ type: 'load', baseline: { ...OPEN_DEFAULTS } as OpenParams & Record<string, number>, shocked: { ...OPEN_DEFAULTS } as OpenParams & Record<string, number> }); setPreset(null); }}>
          {t('btn.resetAll')}
        </button>
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
    const cmp = compareOpen(s0, s1);
    const report = buildOpenInsights(s0, s1, cmp);
    const q0 = s0.equilibrium;
    const q1 = s1.equilibrium;
    const kpi = (label: string, a: number, b: number, fmt: string, dfmt: string) => <Kpi label={label} value={f(b, fmt)} sub={`E₀ ${f(a, fmt)}`} delta={f(b - a, dfmt)} deltaClass={deltaCls(b - a)} />;
    const rows: Row[] = [
      { id: 'Y', label: t('var.Y'), v0: q0.Y, v1: q1.Y, fmt: 'n1', emph: true },
      { id: 'q', label: t('open.var.q'), v0: q0.q, v1: q1.q, fmt: 'n4', emph: true },
      { id: 'E', label: t('open.var.E'), v0: q0.E, v1: q1.E, fmt: 'n4' },
      { id: 'i', label: `${t('var.i')} (%)`, v0: q0.i, v1: q1.i, fmt: 'n2' },
      { id: 'C', label: t('var.C'), v0: q0.C, v1: q1.C, fmt: 'n1' },
      { id: 'I', label: t('var.I'), v0: q0.I, v1: q1.I, fmt: 'n1' },
      { id: 'G', label: t('var.G'), v0: q0.G, v1: q1.G, fmt: 'n1' },
      { id: 'X', label: t('open.var.X'), v0: q0.X, v1: q1.X, fmt: 'n1' },
      { id: 'IM', label: t('open.var.IM'), v0: q0.IM, v1: q1.IM, fmt: 'n1' },
      { id: 'NX', label: t('open.var.NX'), v0: q0.NX, v1: q1.NX, fmt: 'n1', emph: true },
      { id: 'T', label: t('adv.var.T'), v0: q0.T, v1: q1.T, fmt: 'n1' },
      { id: 'Sg', label: t('adv.var.Sg'), v0: q0.Sg, v1: q1.Sg, fmt: 'n1' },
      { id: 'S', label: t('var.S'), v0: q0.S, v1: q1.S, fmt: 'n1' },
      { id: 'M', label: t('var.M'), v0: q0.M, v1: q1.M, fmt: 'n1' },
      { id: 'R', label: t('open.var.R'), v0: q0.R, v1: q1.R, fmt: 'n1' },
      { id: 'KA', label: t('open.var.inflow'), v0: q0.capitalInflow, v1: q1.capitalInflow, fmt: 'n1' },
    ];
    const res = Math.max(maxOpenResidual(s0.residuals), maxOpenResidual(s1.residuals));
    const m = s1.multipliers;
    const multRows: [string, number, string][] = [
      ['open.mult.alpha', m.alpha, 'n3'],
      ['mult.dY_dG', m.dY_dG, 'n3'],
      ['open.mult.dq_dG', m.dq_dG, 'n5'],
      ['open.mult.dNX_dG', m.dNX_dG, 'n3'],
      ['open.mult.dY_dD', m.dY_dD, 'n3'],
      ['open.mult.dY_diStar', m.dY_diStar, 'n2'],
      ['open.mult.dY_dYf', m.dY_dYf, 'n3'],
      ['open.mult.dY_dq', m.dY_dq, 'n2'],
    ];
    body = (
      <>
        <div className="kpis">
          {kpi(t('var.Y'), q0.Y, q1.Y, 'bn', 'sbn')}
          {kpi(t('open.var.q'), q0.q, q1.q, 'n3', 'sn3')}
          {kpi(t('open.var.NX'), q0.NX, q1.NX, 'sbn', 'sbn')}
          {kpi(t('var.C'), q0.C, q1.C, 'bn', 'sbn')}
          {kpi(t('var.I'), q0.I, q1.I, 'bn', 'sbn')}
          {kpi(t('var.M'), q0.M, q1.M, 'bn', 'sbn')}
          {kpi(t('open.var.R'), q0.R, q1.R, 'bn', 'sbn')}
          {kpi(t('adv.var.Sg'), q0.Sg, q1.Sg, 'sbn', 'sbn')}
        </div>
        <div className="sim-grid">
          <div className="col">
            <OpenCharts s0={s0} s1={s1} />
            <ChartCard title={t('open.trade.title')} subtitle={t('open.trade.sub')}>
              <GroupedBars
                aLabel="E₀"
                bLabel="E₁"
                ariaLabel={t('open.trade.title')}
                data={[
                  { label: 'X', a: q0.X, b: q1.X },
                  { label: 'IM', a: q0.IM, b: q1.IM },
                  { label: 'NX', a: q0.NX, b: q1.NX },
                ]}
              />
            </ChartCard>
            <CompareTable title={t('table.title')} subtitle={t('open.identity', { r: res.toExponential(1) })} rows={rows} />
          </div>
          <div className="col">
            <Explanation report={report} />
            <div className="card">
              <div className="card-head"><div><h2>{t('open.mult.title')}</h2><p>{t(regime === 'fixed' ? 'open.mult.subFixed' : 'open.mult.subFlex')}</p></div></div>
              <div className="card-body table-wrap">
                <table className="data">
                  <tbody>
                    {multRows.map(([k, v, fmt]) => (
                      <tr key={k}>
                        <th scope="row" style={{ fontWeight: 400 }}>{t(k)}</th>
                        <td className="num">{f(v, fmt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <ImportSensitivity s1={s1} />
          </div>
        </div>
      </>
    );
  }

  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={sidebar}>
      <ModuleHeader id="open">
        <SaveToLab config={r0.ok && r1.ok ? { model: 'open', baseline: state.baseline, shocked: state.shocked, regime } : null} defaultName={t('mod.open')} />
      </ModuleHeader>
      <IssueList groups={groups} prefix="open.issue." />
      {body}
    </ModuleLayout>
  );
}
