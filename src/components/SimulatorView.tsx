import { useState, type Dispatch } from 'react';
import { useI18n } from '../i18n';
import type { Action, SimState } from '../state/store';
import type { SimulationOk } from '../state/simulation';
import { ISLMChart, type SavedOverlay } from './charts/ISLMChart';
import { LegendLine } from './charts/common';
import { ChangesTable, Kpis, MultipliersTable } from './Results';
import { Explanation } from './ui/Explanation';
import { toLeveled } from '../interpretation/basicLevels';

interface Props {
  sim: SimulationOk;
  state: SimState;
  dispatch: Dispatch<Action>;
  overlays: SavedOverlay[];
}

export function SimulatorView({ sim, state, dispatch, overlays }: Props) {
  const { t, f } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const { e0, e1, comparison: cmp } = sim;
  const v = state.view;
  const visibleOverlays = overlays.filter((o) => !v.hiddenSaved.includes(o.id));

  const chip = (key: 'showInitial' | 'showShifted' | 'showGuides', label: string) => (
    <button className="toggle-chip" aria-pressed={v[key]} onClick={() => dispatch({ type: 'toggleView', key })}>
      {label}
    </button>
  );

  return (
    <>
      <Kpis e0={e0} e1={e1} cmp={cmp} />
      <div className="sim-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div className="card">
            <div className="card-head">
              <div>
                <h2>{t('chart.title')}</h2>
                <p>{t('chart.subtitle')}</p>
              </div>
              <div className="chart-legend">
                {chip('showInitial', t('chart.toggle.initial'))}
                {chip('showShifted', t('chart.toggle.shifted'))}
                {chip('showGuides', t('chart.toggle.guides'))}
              </div>
            </div>
            <div className="card-body">
              <div className="chart-legend" style={{ marginBottom: 6 }}>
                <LegendLine color="var(--series-is)" label="IS₁" />
                <LegendLine color="var(--series-is)" dashed label="IS₀" />
                <LegendLine color="var(--series-lm)" label="LM₁" />
                <LegendLine color="var(--series-lm)" dashed label="LM₀" />
                <span className="legend-item"><span className="legend-dot" style={{ color: 'var(--eq1)' }} />E₁</span>
                <span className="legend-item">
                  <span className="legend-dot" style={{ color: 'var(--surface-1)', boxShadow: '0 0 0 2px var(--eq0) inset' }} />E₀
                </span>
                {visibleOverlays.map((o) => (
                  <span className="legend-item" key={o.id}>
                    <span className="legend-swatch" style={{ color: o.color }} />
                    {o.name}
                  </span>
                ))}
              </div>
              <ISLMChart
                e0={e0}
                e1={e1}
                showInitial={v.showInitial}
                showShifted={v.showShifted}
                showGuides={v.showGuides}
                saved={visibleOverlays}
              />
              <button className="btn small ghost" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
                {showTable ? t('chart.hideTable') : t('chart.table')}
              </button>
              {showTable && (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th scope="col"></th>
                        <th scope="col">Y</th>
                        <th scope="col">i (%)</th>
                        <th scope="col">IS: di/dY</th>
                        <th scope="col">LM: di/dY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'e0', name: 'E₀', e: e0 },
                        { id: 'e1', name: 'E₁', e: e1 },
                        ...visibleOverlays.map((o) => ({ id: o.id, name: o.name, e: o.e1 })),
                      ].map(({ id, name, e }) => (
                        <tr key={id}>
                          <th scope="row">{name}</th>
                          <td className="num">{f(e.equilibrium.Y, 'n1')}</td>
                          <td className="num">{f(e.equilibrium.i, 'n2')}</td>
                          <td className="num">{Number.isFinite(e.slopes.is) ? f(e.slopes.is, 'n4') : '−∞'}</td>
                          <td className="num">{Number.isFinite(e.slopes.lm) ? f(e.slopes.lm, 'n4') : '+∞'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <ChangesTable e0={e0} e1={e1} cmp={cmp} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Explanation report={toLeveled(sim.insights, e1, cmp)} />
          <MultipliersTable e0={e0} e1={e1} />
        </div>
      </div>
    </>
  );
}
