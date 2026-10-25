import type { Dispatch } from 'react';
import type { PolicyRegime } from '../engine';
import { useI18n } from '../i18n';
import { PARAM_META, TARGET_RATE_META, type ParamGroup } from '../state/paramMeta';
import { PRESETS } from '../state/scenarios';
import type { Action, SimState } from '../state/store';
import type { Simulation } from '../state/simulation';
import { ParamControl } from './ParamControl';

interface Props {
  state: SimState;
  dispatch: Dispatch<Action>;
  sim: Simulation;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ state, dispatch, sim, open, onClose }: Props) {
  const { t, f } = useI18n();
  const editingShock = state.editing === 'shocked';
  const params = editingShock ? state.shocked : state.baseline;
  const targeting = state.regime === 'interest-target';

  const group = (g: ParamGroup) =>
    PARAM_META.filter((m) => m.group === g && !(targeting && m.key === 'M')).map((m) => (
      <ParamControl
        key={m.key}
        sym={t(`param.${m.key}.sym`)}
        name={t(`param.${m.key}.name`)}
        description={t(`param.${m.key}.desc`)}
        unit={t(m.unit)}
        value={params[m.key]}
        reference={editingShock ? state.baseline[m.key] : null}
        min={m.min}
        max={m.max}
        step={m.step}
        digits={m.digits}
        tag={m.instrument ? (m.instrument === 'fiscal' ? 'fiscal' : 'monetary') : undefined}
        onChange={(v) => dispatch({ type: 'setParam', key: m.key, value: v })}
      />
    ));

  const endogM = editingShock ? sim.e1?.equilibrium.M : sim.e0?.equilibrium.M;

  const setRegime = (r: PolicyRegime) => dispatch({ type: 'setRegime', regime: r });

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label={t('panel.params')}>
      <div className="mobile-only" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{t('panel.params')}</strong>
        <button className="btn small" onClick={onClose}>{t('btn.close')}</button>
      </div>

      <section>
        <h2 className="section-title">{t('regime.label')}</h2>
        <div className="segmented" role="group" aria-label={t('regime.label')}>
          <button aria-pressed={state.regime === 'money-supply'} onClick={() => setRegime('money-supply')}>
            {t('regime.ms')}
            <span className="sub">{t('regime.ms.short')}</span>
          </button>
          <button aria-pressed={targeting} onClick={() => setRegime('interest-target')}>
            {t('regime.it')}
            <span className="sub">{t('regime.it.short')}</span>
          </button>
        </div>
        <p className="note" style={{ marginTop: 8 }}>{targeting ? t('regime.it.note') : t('regime.ms.note')}</p>
      </section>

      <section>
        <h2 className="section-title">{t('presets.title')}</h2>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="preset"
              aria-pressed={state.activePreset === p.id}
              onClick={() => {
                dispatch({ type: 'applyPreset', id: p.id });
                onClose();
              }}
            >
              <span className="p-title">{t(`preset.${p.id}.title`)}</span>
              <span className="p-desc">{t(`preset.${p.id}.desc`)}</span>
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{t('presets.hint')}</p>
      </section>

      <section>
        <h2 className="section-title">{t('panel.params')}</h2>
        <div className="segmented" role="group" aria-label={t('panel.params')}>
          <button aria-pressed={editingShock} onClick={() => dispatch({ type: 'setEditing', side: 'shocked' })}>
            {t('edit.shocked')}
          </button>
          <button aria-pressed={!editingShock} onClick={() => dispatch({ type: 'setEditing', side: 'baseline' })}>
            {t('edit.baseline')}
          </button>
        </div>
        <p className="note" style={{ marginTop: 8 }}>{editingShock ? t('edit.hint.shocked') : t('edit.hint.baseline')}</p>

        {targeting && (
          <div style={{ marginTop: 12 }}>
            <h3 className="section-title">{t('group.policy')}</h3>
            <ParamControl
              sym="ī"
              name={t('target.label')}
              description={t('regime.it.note')}
              unit="%"
              value={editingShock ? state.target1 : state.target0}
              reference={editingShock ? state.target0 : null}
              min={TARGET_RATE_META.min}
              max={TARGET_RATE_META.max}
              step={TARGET_RATE_META.step}
              digits={TARGET_RATE_META.digits}
              tag="monetary"
              onChange={(v) => dispatch({ type: 'setTarget', value: v })}
            />
            <div className="param" title={t('target.endogM.hint')}>
              <span className="param-label">
                <span className="sym">M</span>
                <span className="name">{t('target.endogM')}</span>
              </span>
              <span className="num" style={{ fontSize: 12.5 }}>{endogM === undefined ? '—' : f(endogM, 'bn')}</span>
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <h3 className="section-title">{t('group.goods')}</h3>
          {group('goods')}
        </div>
        <div style={{ marginTop: 12 }}>
          <h3 className="section-title">{t('group.money')}</h3>
          {group('money')}
        </div>
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" onClick={() => dispatch({ type: 'resetShock' })}>{t('btn.resetShock')}</button>
        <button className="btn small" onClick={() => dispatch({ type: 'adoptShock' })}>{t('btn.adopt')}</button>
        <button className="btn small ghost" onClick={() => dispatch({ type: 'resetAll' })}>{t('btn.resetAll')}</button>
      </section>
    </aside>
  );
}
