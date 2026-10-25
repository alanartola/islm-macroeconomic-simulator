import { maxAdvResidual } from '../../engine/advanced';
import { useI18n } from '../../i18n';
import { useMode } from '../../state/mode';
import type { AdvSimOk } from '../../state/advancedState';
import { XYChart } from '../../components/charts/XYChart';
import { LegendLine } from '../../components/charts/common';
import { ChartCard } from '../../components/ui/ChartCard';
import { CompareTable, Explanation, type Row } from '../../components/ui/Explanation';
import { Kpi } from '../../components/ui/ModuleLayout';
import { deltaCls } from '../../components/ui/format';
import { IS, LIN, LM, useAdvChart } from './useAdvChart';


export function AdvancedView({ sim }: { sim: AdvSimOk }) {
  const { t, f } = useI18n();
  const { isAdvanced } = useMode();
  const { s0, s1, cmp } = sim;
  const q0 = s0.equilibrium;
  const q1 = s1.equilibrium;
  const chart = useAdvChart(sim, { showTangent: true });
  const m0 = s0.multipliers;
  const m1 = s1.multipliers;

  const kpi = (label: string, v1: number, v0: number, fmt: string, dfmt: string) => (
    <Kpi label={label} value={f(v1, fmt)} sub={`E₀ ${f(v0, fmt)}`} delta={f(v1 - v0, dfmt)} deltaClass={deltaCls(v1 - v0)} />
  );

  const rows: Row[] = [
    { id: 'Y', label: t('var.Y'), v0: q0.Y, v1: q1.Y, fmt: 'n1', emph: true },
    { id: 'i', label: `${t('var.i')} (%)`, v0: q0.i, v1: q1.i, fmt: 'n3', emph: true },
    { id: 'C', label: t('var.C'), v0: q0.C, v1: q1.C, fmt: 'n1' },
    { id: 'I', label: t('var.I'), v0: q0.I, v1: q1.I, fmt: 'n1' },
    { id: 'G', label: t('var.G'), v0: q0.G, v1: q1.G, fmt: 'n1' },
    { id: 'T', label: t('adv.var.T'), v0: q0.T, v1: q1.T, fmt: 'n1' },
    { id: 'TR', label: t('adv.var.TR'), v0: q0.TR, v1: q1.TR, fmt: 'n1' },
    { id: 'Sg', label: t('adv.var.Sg'), v0: q0.Sg, v1: q1.Sg, fmt: 'n1' },
    { id: 'Yd', label: t('var.Yd'), v0: q0.Yd, v1: q1.Yd, fmt: 'n1' },
    { id: 'Sp', label: t('var.Sp'), v0: q0.Sp, v1: q1.Sp, fmt: 'n1' },
    { id: 'S', label: t('var.S'), v0: q0.S, v1: q1.S, fmt: 'n1' },
    { id: 'm', label: t('var.realMoney'), v0: q0.realMoney, v1: q1.realMoney, fmt: 'n1' },
    { id: 'Lt', label: t('adv.var.Lt'), v0: q0.transactionDemand, v1: q1.transactionDemand, fmt: 'n1' },
    { id: 'Ls', label: t('adv.var.Ls'), v0: q0.speculativeDemand, v1: q1.speculativeDemand, fmt: 'n1' },
  ];
  if (s0.floorBinding || s1.floorBinding) rows.push({ id: 'idle', label: t('adv.var.idle'), v0: q0.idleBalances, v1: q1.idleBalances, fmt: 'n1' });

  const multRows: [string, number, number, string][] = [
    ['adv.mult.alpha', m0.alpha, m1.alpha, 'n3'],
    ['adv.mult.lmSlope', m0.lmSlope, m1.lmSlope, 'n4'],
    ['mult.dY_dG', m0.dY_dG, m1.dY_dG, 'n3'],
    ['adv.mult.dY_dTR', m0.dY_dTR, m1.dY_dTR, 'n3'],
    ['adv.mult.dY_dT0', m0.dY_dT0, m1.dY_dT0, 'n3'],
    ['adv.mult.dY_dt', m0.dY_dt, m1.dY_dt, 'n1'],
    ['mult.dY_dRealMoney', m0.dY_dRealMoney, m1.dY_dRealMoney, 'n3'],
    ['mult.di_dG', m0.di_dG, m1.di_dG, 'n4'],
    ['mult.crowdingOutShare', m0.crowdingOutShare * 100, m1.crowdingOutShare * 100, 'pct'],
  ];
  const el = (x: number | null) => (x === null ? '—' : f(x, 'n3'));
  const residual = Math.max(maxAdvResidual(s0.residuals), maxAdvResidual(s1.residuals));

  return (
    <>
      <div className="kpis">
        {kpi(t('var.Y'), q1.Y, q0.Y, 'bn', 'sbn')}
        {kpi(t('var.i'), q1.i, q0.i, 'rate', 'spp')}
        {kpi(t('var.C'), q1.C, q0.C, 'bn', 'sbn')}
        {kpi(t('var.I'), q1.I, q0.I, 'bn', 'sbn')}
        {kpi(t('adv.var.T'), q1.T, q0.T, 'bn', 'sbn')}
        {kpi(t('adv.var.Sg'), q1.Sg, q0.Sg, 'bn', 'sbn')}
        {kpi(t('var.realMoney'), q1.realMoney, q0.realMoney, 'bn', 'sbn')}
        <Kpi label={t('adv.kpi.zone')} value={t(`adv.zoneTitle.${s1.zone}`)} sub={`E₀: ${t(`adv.zoneTitle.${s0.zone}`)}`} />
      </div>
      <div className="sim-grid">
        <div className="col">
          <ChartCard
            title={t('adv.chart.title')}
            subtitle={t(`adv.chart.sub.${s1.spec.lm}`)}
            legend={
              <>
                <LegendLine color={IS} label="IS₁" />
                <LegendLine color={IS} dashed label="IS₀" />
                <LegendLine color={LM} label="LM₁" />
                <LegendLine color={LM} dashed label="LM₀" />
                {sim.tangent && <LegendLine color={LIN} label={t('adv.compare.legend')} />}
                {chart.bands.length > 0 && <span className="legend-item"><span className="legend-band" />{t('adv.chart.zonesLegend')}</span>}
              </>
            }
            formula={<pre className="formula">{t(`adv.formula.${s1.spec.regime === 'rate' ? 'rate' : s1.spec.lm}`)}</pre>}
          >
            <XYChart
              xDomain={chart.xDomain}
              yDomain={chart.yDomain}
              xLabel={t('chart.x')}
              yLabel={t('chart.y')}
              series={chart.series}
              markers={chart.markers}
              segments={chart.segments}
              bands={chart.bands}
              ariaLabel={t('chart.aria', { Y0: f(q0.Y, 'bn'), i0: f(q0.i, 'rate'), Y1: f(q1.Y, 'bn'), i1: f(q1.i, 'rate') })}
              valueFormat={(v) => f(v, 'n2')}
            />
            <p className="chart-note">{t('adv.chart.note')}</p>
          </ChartCard>
          {sim.tangent && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>{t('adv.compare.title')}</h2>
                  <p>{t('adv.compare.sub', { h: sim.tangent.s0.spec.params.h, L0: sim.tangent.s0.spec.params.L0 })}</p>
                </div>
              </div>
              <div className="card-body table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">{t('adv.compare.model')}</th>
                      <th scope="col">ΔY</th>
                      <th scope="col">Δi (pp)</th>
                      <th scope="col">ΔI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [t('adv.lm.nonlinear'), cmp],
                      [t('adv.compare.tangent'), sim.tangent.cmp],
                    ].map(([name, c]) => {
                      const cc = c as typeof cmp;
                      return (
                        <tr key={name as string}>
                          <th scope="row">{name as string}</th>
                          <td className="num">{f(cc.changes.Y.abs, 'sn2')}</td>
                          <td className="num">{f(cc.changes.i.abs, 'sn2')}</td>
                          <td className="num">{f(cc.changes.I.abs, 'sn2')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="note" style={{ marginTop: 8 }}>{t('adv.compare.reading')}</p>
              </div>
            </div>
          )}
          <CompareTable
            title={t('table.title')}
            subtitle={residual < 1e-6 ? t('adv.identity.ok', { r: residual.toExponential(1) }) : t('identity.fail', { r: residual.toExponential(2) })}
            rows={rows}
          />
        </div>
        <div className="col">
          <Explanation report={sim.report} />
          <div className="card">
            <div className="card-head">
              <div>
                <h2>{t('adv.mult.title')}</h2>
                <p>{t('adv.mult.sub')}</p>
              </div>
            </div>
            <div className="card-body table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">{t('mult.name')}</th>
                    <th scope="col">E₀</th>
                    <th scope="col">E₁</th>
                  </tr>
                </thead>
                <tbody>
                  {multRows.map(([k, a, b, fmt]) => (
                    <tr key={k}>
                      <th scope="row" style={{ fontWeight: 400 }}>{t(k)}</th>
                      <td className="num">{Number.isFinite(a) ? f(a, fmt) : '∞'}</td>
                      <td className="num">{Number.isFinite(b) ? f(b, fmt) : '∞'}</td>
                    </tr>
                  ))}
                  {cmp.effectiveFiscalMultiplier !== null && (
                    <tr className="emph">
                      <th scope="row">{t('adv.mult.effFiscal')}</th>
                      <td className="num" colSpan={2}>{f(cmp.effectiveFiscalMultiplier, 'n3')}</td>
                    </tr>
                  )}
                  {cmp.effectiveMonetaryMultiplier !== null && (
                    <tr className="emph">
                      <th scope="row">{t('adv.mult.effMonetary')}</th>
                      <td className="num" colSpan={2}>{f(cmp.effectiveMonetaryMultiplier, 'n3')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="note" style={{ marginTop: 8 }}>{t('adv.mult.distinction')}</p>
            </div>
          </div>
          {isAdvanced && (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>{t('adv.el.title')}</h2>
                  <p>{t('adv.el.sub')}</p>
                </div>
              </div>
              <div className="card-body table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th scope="col">{t('adv.el.name')}</th>
                      <th scope="col">E₀</th>
                      <th scope="col">E₁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['moneyInterest', 'moneyIncome', 'investmentInterest', 'outputGov', 'outputMoney'] as const).map((k) => (
                      <tr key={k}>
                        <th scope="row" style={{ fontWeight: 400 }}>{t(`adv.el.${k}`)}</th>
                        <td className="num">{el(s0.elasticities[k])}</td>
                        <td className="num">{el(s1.elasticities[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 className="section-title" style={{ marginTop: 14 }}>{t('adv.diag.title')}</h3>
                <table className="data">
                  <tbody>
                    {[s0, s1].map((s, k) => (
                      <tr key={k}>
                        <th scope="row">{k === 0 ? 'E₀' : 'E₁'}</th>
                        <td style={{ textAlign: 'left' }}>
                          {s.diagnostics.method === 'brent'
                            ? t('adv.diag.brent', { it: s.diagnostics.iterations, res: s.diagnostics.residual.toExponential(1) })
                            : t('adv.diag.closed')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
