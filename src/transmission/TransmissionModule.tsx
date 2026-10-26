import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import type { ModelParams } from '../engine';
import { runSimulation, type SimulationOk } from '../state/simulation';
import { IssuesPanel } from '../components/Results';
import { useWidth } from '../components/charts/utils';
import type { LabConfig } from '../lab/scenario';
import { SCENARIOS, geometry, scenarioInput, stepsOf, visibleAt, type Element, type Market, type Step, type TransmissionGeometry, type TransmissionInput } from './model';
import { QuadrantChart, domainsOf, scalesOf } from './QuadrantCharts';

const PARAMS: (keyof ModelParams)[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];
const STEP_PARAM: Record<keyof ModelParams, number> = { C0: 10, c: 0.01, T: 10, I0: 10, b: 1, G: 10, M: 10, P: 0.05, k: 0.05, h: 1 };
type Tab = 'summary' | 'goods' | 'islm' | 'money' | 'all';
const DESKTOP = 860;
/** Fixed placement: summary | goods (DA–Y) on top, money (i–M/P) | IS-LM (i–Y) below. */
const QUADRANTS = '"summary goods" "money islm"';

/**
 * Three coordinated markets of the traditional IS-LM (Module A engine):
 * goods market (DA–Y) top right, IS-LM (i–Y) bottom right, money market
 * (i–M/P) bottom left, and a summary in the top-left quadrant. The three
 * charts share the parameters, the two equilibria and the scales of the
 * variables they have in common.
 */
export function TransmissionModule({ onOpenConfig }: { onOpenConfig: (cfg: LabConfig) => void }) {
  const { t } = useI18n();
  const [scenarioId, setScenarioId] = useState('monetaryExpansion');
  const [input, setInput] = useState<TransmissionInput>(() => scenarioInput(SCENARIOS.find((s) => s.id === 'monetaryExpansion')!));
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [ref, width] = useWidth<HTMLDivElement>(1100);

  const sim = useMemo(() => runSimulation(input), [input]);
  const g = sim.ok ? geometry(input, sim.e0, sim.e1) : null;
  const steps = useMemo(() => (g ? stepsOf(g.family) : []), [g?.family]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStep((k) => {
        const next = (k ?? -1) + 1;
        if (next >= steps.length - 1) setPlaying(false);
        return Math.min(next, steps.length - 1);
      });
    }, 2400);
    return () => window.clearInterval(id);
  }, [playing, steps.length]);

  const choose = (id: string) => {
    setScenarioId(id);
    setStep(null);
    setPlaying(false);
    const sc = SCENARIOS.find((s) => s.id === id);
    if (sc) setInput(scenarioInput(sc));
  };
  const edit = (next: TransmissionInput) => {
    setScenarioId('custom');
    setStep(null);
    setPlaying(false);
    setInput(next);
  };

  const desktop = width >= DESKTOP;
  const cellW = desktop ? Math.floor(width / 2) : width;
  const cellH = Math.round(Math.max(300, Math.min(desktop ? 500 : 400, cellW * (desktop ? 0.8 : 0.86))));
  const scales = g ? scalesOf(domainsOf(g), cellW, cellH) : null;
  const current: Step | null = step === null ? null : steps[step] ?? null;
  const visible = visibleAt(steps, step === null ? null : step);
  const fresh = new Set<Element>(current?.show ?? []);
  const chart = (kind: 'goods' | 'islm' | 'money') =>
    g && scales ? (
      <QuadrantChart standalone={!desktop} kind={kind} g={g} s={scales} visible={visible} fresh={fresh} dim={!!current && current.market !== 'all' && current.market !== kind} focus={!!current && (current.market === kind || current.market === 'all')} />
    ) : null;

  const summary = (
    <SummaryPanel
      scenarioId={scenarioId}
      onScenario={choose}
      input={input}
      onInput={edit}
      sim={sim.ok ? sim : null}
      g={g}
      steps={steps}
      step={step}
      onStep={(k) => {
        setPlaying(false);
        setStep(k);
      }}
      playing={playing}
      onPlay={() => {
        if (step === null || step >= steps.length - 1) setStep(0);
        setPlaying((p) => !p);
      }}
    />
  );

  return (
    <main className="main tq-main">
      <div className="module-intro">
        <div>
          <span className="kicker">{t('tq.kicker')}</span>
          <h2>{t('tq.title')}</h2>
          <p>{t('tq.desc')}</p>
        </div>
      </div>

      <section className="tq-wrap" ref={ref} aria-label={t('tq.title')}>
        {!desktop && (
          <nav className="tabs tq-tabs" role="tablist" aria-label={t('tq.tabs')}>
            {(['summary', 'goods', 'islm', 'money', 'all'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {t(`tq.tab.${k}`)}
              </button>
            ))}
          </nav>
        )}
        {desktop || tab === 'all' ? (
          <div className={`tq-grid${desktop ? '' : ' tq-grid-scroll'}`} style={{ gridTemplateAreas: QUADRANTS, gridTemplateColumns: `${desktop ? cellW : 340}px ${desktop ? cellW : 340}px` }}>
            <div className="tq-cell tq-summary" style={{ gridArea: 'summary', height: desktop ? cellH : undefined }} data-quadrant="summary">
              {desktop ? summary : <p className="note">{t('tq.mobile.summaryHint')}</p>}
            </div>
            <div className="tq-cell" style={{ gridArea: 'goods' }}>
              {desktop ? chart('goods') : g && <QuadrantChart kind="goods" g={g} s={scalesOf(domainsOf(g), 340, 300)} visible={visible} fresh={fresh} />}
            </div>
            <div className="tq-cell" style={{ gridArea: 'money' }}>
              {desktop ? chart('money') : g && <QuadrantChart kind="money" g={g} s={scalesOf(domainsOf(g), 340, 300)} visible={visible} fresh={fresh} />}
            </div>
            <div className="tq-cell" style={{ gridArea: 'islm' }}>
              {desktop ? chart('islm') : g && <QuadrantChart kind="islm" g={g} s={scalesOf(domainsOf(g), 340, 300)} visible={visible} fresh={fresh} />}
            </div>
          </div>
        ) : tab === 'summary' ? (
          <div className="tq-cell tq-summary">{summary}</div>
        ) : (
          <div className="tq-single">{chart(tab)}</div>
        )}
        {!desktop && tab !== 'summary' && current && <StepText g={g} step={current} index={step ?? 0} total={steps.length} />}
        {!sim.ok && <IssuesPanel sim={sim} />}
      </section>

      <ParamsPanel input={input} onInput={edit} />

      <details className="card tq-details">
        <summary>{t('tq.mechanism.title')}</summary>
        {g && steps.length > 0 ? (
          <ol className="steps-list">
            {steps.map((s, k) => (
              <li key={s.id}>
                <StepSentence g={g} step={s} index={k} />
              </li>
            ))}
          </ol>
        ) : (
          <p>{t('tq.mechanism.none')}</p>
        )}
      </details>
      <details className="card tq-details">
        <summary>{t('tq.assumptions.title')}</summary>
        <ul>
          {['1', '2', '3', '4', '5'].map((k) => (
            <li key={k}>{t(`tq.assumptions.${k}`)}</li>
          ))}
        </ul>
      </details>
      <div className="tq-actions">
        <button className="btn" onClick={() => onOpenConfig({ model: 'basic', ...input })}>
          {t('tq.openA')}
        </button>
      </div>
    </main>
  );
}

function SummaryPanel(props: {
  scenarioId: string;
  onScenario: (id: string) => void;
  input: TransmissionInput;
  onInput: (x: TransmissionInput) => void;
  sim: SimulationOk | null;
  g: TransmissionGeometry | null;
  steps: Step[];
  step: number | null;
  onStep: (k: number | null) => void;
  playing: boolean;
  onPlay: () => void;
}) {
  const { t, f } = useI18n();
  const { g, steps, step, input } = props;
  const rows: { key: string; v0: number; v1: number; fmt: string; dfmt: string }[] = g
    ? [
        { key: 'Y', v0: g.e0.Y, v1: g.e1.Y, fmt: 'n1', dfmt: 'sn1' },
        { key: 'i', v0: g.e0.i, v1: g.e1.i, fmt: 'rate', dfmt: 'spp' },
        { key: 'I', v0: g.e0.I, v1: g.e1.I, fmt: 'n1', dfmt: 'sn1' },
        { key: 'DA', v0: g.e0.DA, v1: g.e1.DA, fmt: 'n1', dfmt: 'sn1' },
        { key: 'm', v0: g.e0.m, v1: g.e1.m, fmt: 'n1', dfmt: 'sn1' },
      ]
    : [];
  return (
    <div className="tq-summary-inner">
      <label className="field">
        <span className="kicker">{t('tq.pick')}</span>
        <select className="select" value={props.scenarioId} onChange={(e) => props.onScenario(e.target.value)} aria-label={t('tq.pick')}>
          {props.scenarioId === 'custom' && <option value="custom">{t('tq.sc.custom')}</option>}
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {t(`tq.sc.${s.id}`)}
            </option>
          ))}
        </select>
      </label>
      <div className="segmented compact" role="group" aria-label={t('tq.regime')}>
        {(['money-supply', 'interest-target'] as const).map((r) => (
          <button key={r} aria-pressed={input.regime === r} onClick={() => props.onInput({ ...input, regime: r })}>
            {t(`tq.regime.${r}`)}
          </button>
        ))}
      </div>
      {step === null && <p className="muted small">{t(`tq.regime.${input.regime}.d`)}</p>}
      {g && (
        <table className="data compact tq-values">
          <thead>
            <tr>
              <th />
              <th>E₀</th>
              <th>E₁</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td title={t(`tq.var.${r.key}.d`)}>{t(`tq.var.${r.key}`)}</td>
                <td className="num">{f(r.v0, r.fmt)}</td>
                <td className="num">{f(r.v1, r.fmt)}</td>
                <td className="num">{f(r.v1 - r.v0, r.dfmt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {g && step === null && <p className="tq-oneline">{t(`tq.summary.${g.family}`)}</p>}
      {steps.length > 0 && (
        <div className="tq-steps">
          {step === null ? (
            <button className="btn primary" onClick={() => props.onStep(0)}>
              {t('tq.explain')}
            </button>
          ) : (
            <>
              {g && <StepText g={g} step={steps[step]!} index={step} total={steps.length} />}
              <div className="tq-step-actions">
                <button className="btn small" disabled={step <= 0} onClick={() => props.onStep(step - 1)}>
                  {t('guide.prev')}
                </button>
                <button className="btn small" disabled={step >= steps.length - 1} onClick={() => props.onStep(step + 1)}>
                  {t('guide.next')}
                </button>
                <button className="btn small" onClick={props.onPlay}>
                  {props.playing ? t('tq.pause') : t('tq.play')}
                </button>
                <button className="btn link small" onClick={() => props.onStep(null)}>
                  {t('tq.exit')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepText({ g, step, index, total }: { g: TransmissionGeometry | null; step: Step; index: number; total: number }) {
  const { t } = useI18n();
  if (!g) return null;
  return (
    <div className="tq-step" role="status" aria-live="polite">
      <span className="kicker">
        {t('tq.stepOf', { n: index + 1, total })} · {t(`tq.market.${step.market as Market}`)}
      </span>
      <p>
        <StepSentence g={g} step={step} index={index} />
      </p>
    </div>
  );
}

/** Sentence of one step, filled with values of the two solved equilibria. */
function StepSentence({ g, step }: { g: TransmissionGeometry; step: Step; index: number }) {
  const { t, f } = useI18n();
  const dY = g.e1.Y - g.e0.Y;
  const di = g.e1.i - g.e0.i;
  const dm = g.e1.m - g.e0.m;
  const dYK = g.keynes ? g.keynes.Y - g.e0.Y : 0;
  const w = (x: number) => t(Math.abs(x) < 1e-9 ? 'tq.w.same' : x > 0 ? 'tq.w.up' : 'tq.w.down');
  const side = (x: number) => t(x > 0 ? 'tq.w.right' : 'tq.w.left');
  const vert = (x: number) => t(x > 0 ? 'tq.w.upward' : 'tq.w.downward');
  const curves = (['da', 'is', 'lm', 'ld', 'ms'] as const).filter((k) => g.moved[k]).map((k) => t(`tq.curve.${k}`));
  const vars = {
    m0: f(g.e0.m, 'bn'),
    m1: f(g.e1.m, 'bn'),
    i0: f(g.e0.i, 'rate'),
    i1: f(g.e1.i, 'rate'),
    iL: g.liquidity ? f(g.liquidity.i, 'rate') : '—',
    Y0: f(g.e0.Y, 'bn'),
    Y1: f(g.e1.Y, 'bn'),
    YK: g.keynes ? f(g.keynes.Y, 'bn') : '—',
    I0: f(g.e0.I, 'bn'),
    I1: f(g.e1.I, 'bn'),
    dI: f(g.e1.I - g.e0.I, 'sbn'),
    dY: f(dY, 'sbn'),
    di: f(di, 'spp'),
    dA: f(g.dA, 'sbn'),
    dYK: f(dYK, 'sbn'),
    dLm: f(g.p1.h > 0 ? -dm / g.p1.h : 0, 'spp'),
    crowd: f(g.crowdingOut, 'sbn'),
    share: Math.abs(dYK) > 1e-9 ? f((1 - dY / dYK) * 100, 'pct') : '—',
    wm: w(dm),
    wi: w(di),
    wI: w(g.e1.I - g.e0.I),
    wY: w(dY),
    sm: side(dm),
    sA: side(g.dA),
    sY: side(dY),
    vA: vert(g.dA),
    vI: vert(g.e1.I - g.e0.I),
    vi: vert(di),
    list: curves.join(', ') || t('tq.curve.none'),
  };
  return <>{t(`tq.step.${step.key}`, vars)}</>;
}

function ParamsPanel({ input, onInput }: { input: TransmissionInput; onInput: (x: TransmissionInput) => void }) {
  const { t } = useI18n();
  const target = input.regime === 'interest-target';
  const set = (side: 'baseline' | 'shocked', k: keyof ModelParams, v: number) => {
    if (!Number.isFinite(v)) return;
    onInput({ ...input, [side]: { ...input[side], [k]: v } });
  };
  return (
    <details className="card tq-details tq-params">
      <summary>{t('tq.params')}</summary>
      <p className="muted small">{t('tq.params.note')}</p>
      <div className="table-wrap">
        <table className="data compact">
          <thead>
            <tr>
              <th>{t('tq.params.param')}</th>
              <th>{t('tq.params.initial')}</th>
              <th>{t('tq.params.final')}</th>
            </tr>
          </thead>
          <tbody>
            {PARAMS.map((k) => (
              <tr key={k}>
                <td>
                  <b>{t(`param.${k}.sym`)}</b> <span className="muted small">{t(`param.${k}.name`)}</span>
                </td>
                {(['baseline', 'shocked'] as const).map((side) => (
                  <td key={side}>
                    {k === 'M' && target ? (
                      <span className="muted small">{t('tq.params.endogenous')}</span>
                    ) : (
                      <input
                        className="text-input num tq-input"
                        type="number"
                        step={STEP_PARAM[k]}
                        value={input[side][k]}
                        onChange={(e) => set(side, k, Number(e.target.value))}
                        aria-label={`${t(`param.${k}.sym`)} ${t(side === 'baseline' ? 'tq.params.initial' : 'tq.params.final')}`}
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {target && (
              <tr>
                <td>
                  <b>ī</b> <span className="muted small">{t('tq.params.target')}</span>
                </td>
                {(['target0', 'target1'] as const).map((k) => (
                  <td key={k}>
                    <input
                      className="text-input num tq-input"
                      type="number"
                      step={0.25}
                      value={input[k]}
                      onChange={(e) => Number.isFinite(Number(e.target.value)) && onInput({ ...input, [k]: Number(e.target.value) })}
                      aria-label={`ī ${t(k === 'target0' ? 'tq.params.initial' : 'tq.params.final')}`}
                    />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </details>
  );
}
