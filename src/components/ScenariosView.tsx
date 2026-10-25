import { useState, type Dispatch } from 'react';
import type { ParamKey } from '../engine';
import { useI18n } from '../i18n';
import type { Simulation } from '../state/simulation';
import { MAX_SAVED, type Action, type SimState } from '../state/store';


interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
  current: Simulation;
  savedSims: { id: string; name: string; sim: Simulation; color: string }[];
}

const KEYS: ParamKey[] = ['G', 'T', 'C0', 'c', 'I0', 'b', 'M', 'P', 'k', 'h'];

export function ScenariosView({ state, dispatch, current, savedSims }: Props) {
  const { t, f } = useI18n();
  const [name, setName] = useState('');

  const shockText = (sim: Simulation) => {
    if (!sim.ok) return t('sc.invalid');
    const parts = KEYS.filter((k) => sim.comparison.paramChanges[k]).map((k) => `${t(`param.${k}.sym`)} ${f(sim.comparison.paramChanges[k]!.abs, 'sn2')}`);
    if (sim.comparison.targetRateChange) parts.push(`ī ${f(sim.comparison.targetRateChange.abs, 'spp')}`);
    return parts.length ? parts.join(', ') : '—';
  };

  const rows = [
    { id: '__current', name: t('sc.current'), sim: current, color: 'var(--eq1)', regime: state.regime, saved: false },
    ...savedSims.map((s) => ({ ...s, regime: state.saved.find((x) => x.id === s.id)?.regime ?? state.regime, saved: true })),
  ];

  return (
    <>
      <div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 16 }}>{t('sc.title')}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{t('sc.subtitle')}</p>
      </div>
      <div className="card">
        <div className="card-body" style={{ paddingTop: 16 }}>
          <form
            className="scenario-form"
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: 'saveScenario', name: name || `${t('nav.scenarios')} ${state.saved.length + 1}` });
              setName('');
            }}
          >
            <label className="sr-only" htmlFor="sc-name">{t('sc.name')}</label>
            <input id="sc-name" value={name} maxLength={60} placeholder={t('sc.placeholder')} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary" type="submit" disabled={!current.ok}>{t('sc.save')}</button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
            {t('sc.limit', { n: String(MAX_SAVED) })} {t('sc.session')}
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-body table-wrap" style={{ paddingTop: 12 }}>
          {state.saved.length === 0 && <p className="note">{t('sc.empty')}</p>}
          <table className="data" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th scope="col">{t('sc.name')}</th>
                <th scope="col">{t('sc.regime')}</th>
                <th scope="col" style={{ textAlign: 'left' }}>{t('sc.shock')}</th>
                <th scope="col">Y₁</th>
                <th scope="col">ΔY</th>
                <th scope="col">i₁ (%)</th>
                <th scope="col">Δi (pp)</th>
                <th scope="col">ΔC</th>
                <th scope="col">ΔI</th>
                <th scope="col">ΔS</th>
                <th scope="col">dY/dG</th>
                <th scope="col">{t('mult.crowdingOutShare')}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = r.sim;
                const hidden = state.view.hiddenSaved.includes(r.id);
                return (
                  <tr key={r.id} className={r.saved ? undefined : 'emph'}>
                    <th scope="row">
                      <span className="swatch-dot" style={{ background: r.color }} />
                      {r.name}
                    </th>
                    <td>{r.regime === 'money-supply' ? t('regime.ms') : t('regime.it')}</td>
                    <td style={{ textAlign: 'left', whiteSpace: 'normal', minWidth: 120 }} className="mono">{shockText(s)}</td>
                    {s.ok ? (
                      <>
                        <td className="num">{f(s.e1.equilibrium.Y, 'n1')}</td>
                        <td className="num">{f(s.comparison.changes.Y.abs, 'sn2')}</td>
                        <td className="num">{f(s.e1.equilibrium.i, 'n2')}</td>
                        <td className="num">{f(s.comparison.changes.i.abs, 'sn2')}</td>
                        <td className="num">{f(s.comparison.changes.C.abs, 'sn2')}</td>
                        <td className="num">{f(s.comparison.changes.I.abs, 'sn2')}</td>
                        <td className="num">{f(s.comparison.changes.S.abs, 'sn2')}</td>
                        <td className="num">{f(s.e1.multipliers.dY_dG, 'n3')}</td>
                        <td className="num">{f(s.e1.multipliers.crowdingOutShare * 100, 'pct')}</td>
                      </>
                    ) : (
                      <td colSpan={9}>{t('sc.invalid')}</td>
                    )}
                    <td>
                      {r.saved && (
                        <span style={{ display: 'inline-flex', gap: 4 }}>
                          <button className="toggle-chip" aria-pressed={!hidden} onClick={() => dispatch({ type: 'toggleSaved', id: r.id })}>
                            {t('sc.show')}
                          </button>
                          <button className="btn small" onClick={() => dispatch({ type: 'loadScenario', id: r.id })}>{t('sc.load')}</button>
                          <button className="btn small ghost" onClick={() => dispatch({ type: 'deleteScenario', id: r.id })}>{t('sc.delete')}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
