import type { Dispatch } from 'react';
import { ADV_PRESETS, type AdvParamKey, type LMSpec } from '../../engine/advanced';
import { useI18n } from '../../i18n';
import { EditToggle, ParamPanel } from '../../components/ui/ParamPanel';
import { ParamControl } from '../../components/ParamControl';
import type { AdvAction, AdvSim, AdvState } from '../../state/advancedState';
import { advFields } from './fields';

interface Props {
  state: AdvState;
  dispatch: Dispatch<AdvAction>;
  sim: AdvSim;
  /** Presets are hidden in the construction module, which only needs the parameters. */
  showPresets?: boolean;
  onPick?: () => void;
}

export function AdvSidebar({ state, dispatch, sim, showPresets = true, onPick }: Props) {
  const { t, f } = useI18n();
  const shock = state.editing === 'shocked';
  const values = shock ? state.shocked : state.baseline;
  const endogM = shock ? sim.s1?.equilibrium.M : sim.s0?.equilibrium.M;
  const specs: LMSpec[] = ['linear', 'nonlinear', 'floor'];
  return (
    <>
      <section>
        <h2 className="section-title">{t('adv.lm.label')}</h2>
        <div className="segmented three" role="group" aria-label={t('adv.lm.label')}>
          {specs.map((s) => (
            <button key={s} aria-pressed={state.lm === s} onClick={() => dispatch({ type: 'lm', lm: s })}>
              {t(`adv.lm.${s}`)}
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{t(`adv.lm.${state.lm}.note`)}</p>
        {state.lm === 'nonlinear' && state.regime === 'money' && (
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={state.compareTangent} onChange={(e) => dispatch({ type: 'compare', on: e.target.checked })} />
            {t('adv.compare.toggle')}
          </label>
        )}
      </section>

      <section>
        <h2 className="section-title">{t('regime.label')}</h2>
        <div className="segmented" role="group" aria-label={t('regime.label')}>
          <button aria-pressed={state.regime === 'money'} onClick={() => dispatch({ type: 'regime', regime: 'money' })}>
            {t('regime.ms')}
            <span className="sub">{t('regime.ms.short')}</span>
          </button>
          <button aria-pressed={state.regime === 'rate'} onClick={() => dispatch({ type: 'regime', regime: 'rate' })}>
            {t('adv.regime.rate')}
            <span className="sub">{t('regime.it.short')}</span>
          </button>
        </div>
      </section>

      {showPresets && (
        <section>
          <h2 className="section-title">{t('presets.title')}</h2>
          <div className="presets">
            {ADV_PRESETS.map((p) => (
              <button
                key={p.id}
                className="preset"
                aria-pressed={state.preset === p.id}
                onClick={() => {
                  dispatch({ type: 'preset', id: p.id });
                  onPick?.();
                }}
              >
                <span className="p-title">{t(`adv.preset.${p.id}.title`)}</span>
                <span className="p-desc">{t(`adv.preset.${p.id}.desc`)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t('panel.params')}</h2>
        <EditToggle editing={state.editing} onChange={(side) => dispatch({ type: 'editing', side })} />
        {state.regime === 'rate' && (
          <div style={{ marginTop: 12 }}>
            <h3 className="section-title">{t('group.policy')}</h3>
            <ParamControl
              sym="ī"
              name={t('target.label')}
              description={t('regime.it.note')}
              unit="%"
              value={shock ? state.target1 : state.target0}
              reference={shock ? state.target0 : null}
              min={-1}
              max={15}
              step={0.05}
              digits={2}
              tag={t('tag.monetary')}
              onChange={(v) => dispatch({ type: 'target', value: v })}
            />
            <div className="param">
              <span className="param-label">
                <span className="sym">M</span>
                <span className="name">{t('target.endogM')}</span>
              </span>
              <span className="num" style={{ fontSize: 12.5 }}>{endogM === undefined ? '—' : f(endogM, 'bn')}</span>
            </div>
          </div>
        )}
        <ParamPanel<AdvParamKey>
          fields={advFields(state.lm, state.regime)}
          values={values}
          reference={shock ? state.baseline : null}
          onChange={(key, value) => dispatch({ type: 'set', key, value })}
        />
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <button className="btn small" onClick={() => dispatch({ type: 'reset' })}>{t('btn.resetShock')}</button>
        <button className="btn small" onClick={() => dispatch({ type: 'adopt' })}>{t('btn.adopt')}</button>
        <button className="btn small ghost" onClick={() => dispatch({ type: 'restore' })}>{t('btn.resetAll')}</button>
      </section>
    </>
  );
}
