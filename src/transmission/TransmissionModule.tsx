import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { ModelParams } from '../engine';
import { runSimulation, type SimulationOk } from '../state/simulation';
import { IssuesPanel } from '../components/Results';
import type { LabConfig } from '../lab/scenario';
import { SCENARIOS, deltaOf, geometry, scenarioInput, stepsOf, visibleAt, type Element, type Market, type Scenario, type Step, type TransmissionGeometry, type TransmissionInput } from './model';
import { QuadrantChart, frameDomains, neededOf, scalesOf, type Domains } from './QuadrantCharts';

const PARAMS: (keyof ModelParams)[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];
const STEP_PARAM: Record<keyof ModelParams, number> = { C0: 10, c: 0.01, T: 10, I0: 10, b: 1, G: 10, M: 10, P: 0.05, k: 0.05, h: 1 };
type Tab = 'summary' | 'goods' | 'islm' | 'money' | 'all';
type Pane = 'sim' | 'params' | 'mechanism';
/** Below this width the four quadrants become tabs. */
const DESKTOP = 860;
/** Below this height the diagram cannot stay legible inside the viewport: the page scrolls instead (compact fallback). */
const MIN_GRID_H = 440;
/** Fixed placement: summary | goods (DA–Y) on top, money (i–M/P) | IS-LM (i–Y) below. */
const QUADRANTS = '"summary goods" "money islm"';
const ZOOMS = [0.5, 0.65, 0.8, 1];

/** Width of an element and the height left from its top to the bottom of the viewport, tracked on resize. */
function useFitHeight<T extends HTMLElement>(): [React.RefObject<T | null>, number | null, number] {
  const ref = useRef<T | null>(null);
  const [state, setState] = useState<{ h: number | null; w: number }>({ h: null, w: 1200 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const h = Math.floor(window.innerHeight - top - 12);
      setState((s) => (s.h === (h > 0 ? h : null) && s.w === Math.round(rect.width) ? s : { h: h > 0 ? h : null, w: Math.round(rect.width) }));
    };
    update();
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);
  return [ref, state.h, state.w];
}

/**
 * Three coordinated markets of the traditional IS-LM (Module A engine):
 * goods market (DA–Y) top right, IS-LM (i–Y) bottom right, money market
 * (i–M/P) bottom left, controls and results in the top-left quadrant. The
 * diagram is sized to the viewport so the three markets stay in view while
 * the perturbation changes.
 */
export function TransmissionModule({ onOpenConfig }: { onOpenConfig: (cfg: LabConfig) => void }) {
  const { t } = useI18n();
  const [scenarioId, setScenarioId] = useState('monetaryExpansion');
  const [input, setInput] = useState<TransmissionInput>(() => scenarioInput(SCENARIOS.find((s) => s.id === 'monetaryExpansion')!));
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [zoom, setZoom] = useState(1);
  const [stageRef, fitH, width] = useFitHeight<HTMLDivElement>();

  const sim = useMemo(() => runSimulation(input), [input]);
  const g = sim.ok ? geometry(input, sim.e0, sim.e1) : null;
  const steps = useMemo(() => (g ? stepsOf(g.family) : []), [g?.family]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? null;

  // Shared frames that only move when the equilibria approach an edge (no jumps while dragging).
  const frameRef = useRef<{ d: Domains; zoom: number } | null>(null);
  const domains = useMemo(() => {
    if (!g) return null;
    const prev = frameRef.current && frameRef.current.zoom === zoom ? frameRef.current.d : null;
    const d = frameDomains(neededOf(g), { Y0: g.e0.Y, m0: g.e0.m }, zoom, prev);
    frameRef.current = { d, zoom };
    return d;
  }, [g?.e0.Y, g?.e1.Y, g?.e0.i, g?.e1.i, g?.e0.m, g?.e1.m, g?.keynes?.Y, g?.liquidity?.i, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const reframe = () => {
    frameRef.current = null;
    setZoom(1);
  };
  const choose = (id: string, delta?: number) => {
    setScenarioId(id);
    setStep(null);
    setPlaying(false);
    const sc = SCENARIOS.find((s) => s.id === id);
    if (sc) setInput(scenarioInput(sc, delta));
    // A new scenario gets a fresh frame; moving the magnitude keeps the current one while it fits.
    if (delta === undefined) frameRef.current = null;
  };
  const edit = (next: TransmissionInput) => {
    setScenarioId('custom');
    setStep(null);
    setPlaying(false);
    setInput(next);
  };

  const desktop = width >= DESKTOP;
  // Desktop: the grid fills the space down to the bottom of the viewport (compact fallback below MIN_GRID_H).
  const gridH = desktop && fitH !== null ? Math.max(MIN_GRID_H, fitH) : null;
  const cellW = desktop ? Math.floor(width / 2) : width;
  const cellH = gridH !== null ? Math.floor(gridH / 2) : Math.round(Math.max(300, Math.min(420, cellW * 0.86)));
  const scales = g && domains ? scalesOf(domains, cellW, cellH, [g.e0.DA, g.e1.DA]) : null;
  const current: Step | null = step === null ? null : steps[step] ?? null;
  const visible = visibleAt(steps, step === null ? null : step);
  const fresh = new Set<Element>(current?.show ?? []);
  const chart = (kind: 'goods' | 'islm' | 'money', standalone: boolean) =>
    g && scales ? (
      <QuadrantChart
        standalone={standalone}
        kind={kind}
        g={g}
        s={scales}
        visible={visible}
        fresh={fresh}
        dim={!!current && current.market !== 'all' && current.market !== kind}
        focus={!!current && (current.market === kind || current.market === 'all')}
      />
    ) : null;

  const controls = (
    <ControlPanel
      scenario={scenario}
      scenarioId={scenarioId}
      onScenario={(id) => choose(id)}
      onDelta={(d) => scenario && choose(scenario.id, d)}
      onReset={() => {
        choose(scenario?.id ?? 'monetaryExpansion');
        reframe();
      }}
      input={input}
      onInput={edit}
      g={g}
      sim={sim.ok ? sim : null}
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
      onOpenA={() => onOpenConfig({ model: 'basic', ...input })}
    />
  );

  const zoomBar = (
    <div className="tq-zoom" role="group" aria-label={t('tq.zoom')}>
      <button className="btn small" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)] ?? z)} disabled={zoom === ZOOMS[0]} title={t('tq.zoom.in')} aria-label={t('tq.zoom.in')}>
        +
      </button>
      <button className="btn small" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)] ?? z)} disabled={zoom === 1} title={t('tq.zoom.out')} aria-label={t('tq.zoom.out')}>
        −
      </button>
      <button className="btn small" onClick={reframe} title={t('tq.zoom.fit.d')}>
        {t('tq.zoom.fit')}
      </button>
    </div>
  );

  return (
    <main className={`main tq-main${desktop && gridH !== null && gridH === fitH ? ' tq-fit' : ''}`}>
      <header className="tq-head">
        <div>
          <span className="kicker">{t('tq.kicker')}</span>
          <h2 title={t('tq.desc')}>{t('tq.title')}</h2>
        </div>
        {zoomBar}
      </header>

      {!desktop && (
        <nav className="tabs tq-tabs" role="tablist" aria-label={t('tq.tabs')}>
          {(['summary', 'goods', 'islm', 'money', 'all'] as Tab[]).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
              {t(`tq.tab.${k}`)}
            </button>
          ))}
        </nav>
      )}

      <div className="tq-stage" ref={stageRef}>
        {desktop ? (
          <div className="tq-grid" style={{ gridTemplateAreas: QUADRANTS, gridTemplateColumns: `${cellW}px ${cellW}px`, gridTemplateRows: `${cellH}px ${cellH}px` }}>
            <div className="tq-cell tq-summary" style={{ gridArea: 'summary' }} data-quadrant="summary">
              {controls}
            </div>
            <div className="tq-cell" style={{ gridArea: 'goods' }}>
              {chart('goods', false)}
            </div>
            <div className="tq-cell" style={{ gridArea: 'money' }}>
              {chart('money', false)}
            </div>
            <div className="tq-cell" style={{ gridArea: 'islm' }}>
              {chart('islm', false)}
            </div>
          </div>
        ) : tab === 'summary' ? (
          <div className="tq-cell tq-summary tq-summary-mobile">{controls}</div>
        ) : tab === 'all' ? (
          <div className="tq-grid tq-grid-scroll" style={{ gridTemplateAreas: QUADRANTS, gridTemplateColumns: '340px 340px', gridTemplateRows: '300px 300px' }}>
            <div className="tq-cell tq-summary" style={{ gridArea: 'summary' }} data-quadrant="summary">
              <p className="note">{t('tq.mobile.summaryHint')}</p>
            </div>
            {(['goods', 'money', 'islm'] as const).map((k) => (
              <div className="tq-cell" style={{ gridArea: k }} key={k}>
                {g && domains && <QuadrantChart kind={k} g={g} s={scalesOf(domains, 340, 300, [g.e0.DA, g.e1.DA])} visible={visible} fresh={fresh} />}
              </div>
            ))}
          </div>
        ) : (
          <div className="tq-single">{chart(tab, true)}</div>
        )}
        {!desktop && tab !== 'summary' && current && <StepText g={g} step={current} index={step ?? 0} total={steps.length} />}
        {!sim.ok && <IssuesPanel sim={sim} />}
      </div>
    </main>
  );
}

function ControlPanel(props: {
  scenario: Scenario | null;
  scenarioId: string;
  onScenario: (id: string) => void;
  onDelta: (d: number) => void;
  onReset: () => void;
  input: TransmissionInput;
  onInput: (x: TransmissionInput) => void;
  sim: SimulationOk | null;
  g: TransmissionGeometry | null;
  steps: Step[];
  step: number | null;
  onStep: (k: number | null) => void;
  playing: boolean;
  onPlay: () => void;
  onOpenA: () => void;
}) {
  const { t, f } = useI18n();
  const [pane, setPane] = useState<Pane>('sim');
  const { g, steps, step, input, scenario } = props;
  const knob = scenario?.knob ?? null;
  const delta = scenario ? deltaOf(scenario, input) : null;
  const knobFmt = (d: number) => (knob?.key === 'target' ? f(d, 'spp') : knob && (knob.key === 'b' || knob.key === 'h') ? f(d, 'sn0') : f(d, 'sbn'));
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
      <div className="tq-panes" role="tablist" aria-label={t('tq.panes')}>
        {(['sim', 'params', 'mechanism'] as Pane[]).map((k) => (
          <button key={k} role="tab" aria-selected={pane === k} onClick={() => setPane(k)}>
            {t(`tq.pane.${k}`)}
          </button>
        ))}
      </div>

      {pane === 'sim' && (
        <div className="tq-pane tq-scroll">
          <label className="field">
            <span className="sr-only">{t('tq.pick')}</span>
            <select className="select" title={t('tq.pick')} value={props.scenarioId} onChange={(e) => props.onScenario(e.target.value)} aria-label={t('tq.pick')}>
              {props.scenarioId === 'custom' && <option value="custom">{t('tq.sc.custom')}</option>}
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(`tq.sc.${s.id}`)}
                </option>
              ))}
            </select>
          </label>
          {knob && delta !== null && (
            <label className="tq-knob">
              <span className="tq-knob-label">
                {t('tq.magnitude')}{' '}
                <b className="num">
                  {knob.key === 'target' ? 'Δī' : `Δ${t(`param.${knob.key}.sym`)}`} = {knobFmt(delta)}
                </b>
              </span>
              <input type="range" min={knob.min} max={knob.max} step={knob.step} value={delta} onChange={(e) => props.onDelta(Number(e.target.value))} aria-label={t('tq.magnitude')} />
            </label>
          )}
          <div className="tq-regime">
            <div className="segmented compact" role="group" aria-label={t('tq.regime')}>
              {(['money-supply', 'interest-target'] as const).map((r) => (
                <button key={r} aria-pressed={input.regime === r} onClick={() => props.onInput({ ...input, regime: r })} title={t(`tq.regime.${r}.d`)}>
                  {t(`tq.regime.${r}`)}
                </button>
              ))}
            </div>
            <span className="tq-regime-actions">
              {steps.length > 0 && step === null && (
                <button className="btn primary small" onClick={() => props.onStep(0)}>
                  {t('tq.explain')}
                </button>
              )}
              <button className="btn link small" onClick={props.onReset} title={t('tq.reset.d')}>
                {t('tq.reset')}
              </button>
            </span>
          </div>
          {g && step === null && (
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
          {g && step !== null && (
            <p className="tq-mini muted small">
              Y {f(g.e0.Y, 'n1')} → {f(g.e1.Y, 'n1')} · i {f(g.e0.i, 'rate')} → {f(g.e1.i, 'rate')} · I {f(g.e0.I, 'n1')} → {f(g.e1.I, 'n1')}
            </p>
          )}
          {steps.length > 0 && step !== null && (
              <div className="tq-steps">
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
              </div>
            )}
        </div>
      )}

      {pane === 'params' && <ParamsTable input={input} onInput={props.onInput} />}

      {pane === 'mechanism' && (
        <div className="tq-pane tq-scroll">
          <p className="muted small">{g ? t(`tq.summary.${g.family}`) : ''}</p>
          {g && steps.length > 0 ? (
            <ol className="steps-list">
              {steps.map((s) => (
                <li key={s.id}>
                  <StepSentence g={g} step={s} />
                </li>
              ))}
            </ol>
          ) : (
            <p>{t('tq.mechanism.none')}</p>
          )}
          <h4>{t('tq.assumptions.title')}</h4>
          <ul className="tq-assumptions">
            {['1', '2', '3', '4', '5'].map((k) => (
              <li key={k}>{t(`tq.assumptions.${k}`)}</li>
            ))}
          </ul>
          <button className="btn small" onClick={props.onOpenA}>
            {t('tq.openA')}
          </button>
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
        <StepSentence g={g} step={step} />
      </p>
    </div>
  );
}

/** Sentence of one step, filled with values of the two solved equilibria. */
function StepSentence({ g, step }: { g: TransmissionGeometry; step: Step }) {
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

function ParamsTable({ input, onInput }: { input: TransmissionInput; onInput: (x: TransmissionInput) => void }) {
  const { t } = useI18n();
  const target = input.regime === 'interest-target';
  const set = (side: 'baseline' | 'shocked', k: keyof ModelParams, v: number) => {
    if (!Number.isFinite(v)) return;
    onInput({ ...input, [side]: { ...input[side], [k]: v } });
  };
  return (
    <div className="tq-pane tq-scroll tq-params">
      <p className="muted small">{t('tq.params.note')}</p>
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
              <td title={t(`param.${k}.name`)}>
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
  );
}
