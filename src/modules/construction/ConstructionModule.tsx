import { useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { issueGroups, type AdvAction, type AdvSim, type AdvSimOk, type AdvState } from '../../state/advancedState';
import { ChartCard } from '../../components/ui/ChartCard';
import { IssueList } from '../../components/ui/Explanation';
import { ModuleLayout } from '../../components/ui/ModuleLayout';
import { LegendLine } from '../../components/charts/common';
import { AdvSidebar } from '../advanced/AdvSidebar';
import { IS, LM } from '../advanced/useAdvChart';
import {
  FullISLMChart,
  ISFormationChart,
  ISFourQuadrants,
  KeynesianCrossChart,
  KeynesianCrossLegend,
  LMFormationChart,
  LMFourQuadrants,
  MoneyMarketChart,
} from './charts';
import { defaultSelection, isSteps, lmSteps, type Selection } from './selection';

interface Props {
  state: AdvState;
  dispatch: Dispatch<AdvAction>;
  sim: AdvSim;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
}

function StepControl({ step, max, onChange }: { step: number; max: number; onChange: (s: number) => void }) {
  const { t } = useI18n();
  return (
    <div className="step-control" role="group" aria-label={t('con.steps')}>
      <button className="btn small" disabled={step <= 1} onClick={() => onChange(step - 1)} aria-label={t('con.prev')}>
        ◀
      </button>
      <span className="num">{t('con.stepOf', { k: String(step), n: String(max) })}</span>
      <button className="btn small" disabled={step >= max} onClick={() => onChange(step + 1)} aria-label={t('con.next')}>
        ▶
      </button>
      <button className="btn small ghost" onClick={() => onChange(max)}>
        {t('con.showAll')}
      </button>
    </div>
  );
}

function NumberField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="inline-field">
      <span>{label}</span>
      <input type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && onChange(e.target.valueAsNumber)} />
    </label>
  );
}

function Steps({ items, upTo }: { items: string[]; upTo: number }) {
  return (
    <ol className="steps">
      {items.map((s, k) => (
        <li key={k} className={k < upTo ? 'done' : 'todo'}>
          {s}
        </li>
      ))}
    </ol>
  );
}

function ConstructionCharts({ sim }: { sim: AdvSimOk }) {
  const { t, f } = useI18n();
  const defaults = defaultSelection(sim);
  const [sel, setSel] = useState<Selection>({ ...defaults, stepIS: 5, stepLM: 5, rounds: true });
  const [present, setPresent] = useState<number | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const patch = (p: Partial<Selection>) => setSel((s) => ({ ...s, ...p }));
  const s1 = sim.s1;
  const p = s1.spec.params;
  const isN = isSteps(sim, sel);
  const lmN = lmSteps(sim, sel);
  const pegged = s1.spec.regime === 'rate';

  const cards: { id: string; title: string; subtitle: string; node: ReactNode; legend?: ReactNode; formula: string; foot?: ReactNode }[] = [
    {
      id: 'c1',
      title: t('con.c1.title'),
      subtitle: t('con.c1.sub', { cq: p.c * (1 - p.t), alpha: isN.alpha }),
      node: <KeynesianCrossChart sim={sim} sel={sel} />,
      legend: <KeynesianCrossLegend />,
      formula: t('con.c1.formula'),
      foot: (
        <label className="check" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={sel.rounds} onChange={(e) => patch({ rounds: e.target.checked })} />
          {t('con.c1.rounds')}
        </label>
      ),
    },
    {
      id: 'c2',
      title: t('con.c2.title'),
      subtitle: t('con.c2.sub'),
      node: <ISFormationChart sim={sim} sel={sel} />,
      formula: t('con.c2.formula'),
      foot: (
        <>
          <div className="inline-fields">
            <NumberField label="i_a (%)" value={sel.ia} step={0.25} onChange={(v) => patch({ ia: v })} />
            <NumberField label="i_b (%)" value={sel.ib} step={0.25} onChange={(v) => patch({ ib: v })} />
            <StepControl step={sel.stepIS} max={5} onChange={(s) => patch({ stepIS: s })} />
          </div>
          <Steps
            upTo={sel.stepIS}
            items={[
              t('con.is.s1', { ia: sel.ia, ib: sel.ib, Ia: isN.Ia, Ib: isN.Ib, b: p.b }),
              t('con.is.s2'),
              t('con.is.s3', { Ya: isN.Ya, Yb: isN.Yb }),
              t('con.is.s4'),
              t('con.is.s5', { slope: isN.slope }),
            ]}
          />
        </>
      ),
    },
    {
      id: 'c3',
      title: t('con.c3.title'),
      subtitle: t('con.c3.sub'),
      node: <ISFourQuadrants sim={sim} sel={sel} />,
      formula: t('con.c3.formula'),
    },
    {
      id: 'c4',
      title: t('con.c4.title'),
      subtitle: t('con.c4.sub'),
      node: <MoneyMarketChart sim={sim} />,
      legend: (
        <>
          <LegendLine color={LM} label={t('con.mm.total')} />
          <LegendLine color="var(--series-3)" label={t('con.mm.spec')} />
          <LegendLine color="var(--series-4)" dashed label={t('con.mm.trans')} />
          <LegendLine color="var(--text-primary)" label="M/P" />
        </>
      ),
      formula: t(`con.c4.formula.${s1.spec.lm}`),
    },
    {
      id: 'c5',
      title: t('con.c5.title'),
      subtitle: t('con.c5.sub'),
      node: pegged ? <p className="note">{t('con.peggedNote')}</p> : <LMFormationChart sim={sim} sel={sel} />,
      formula: t('con.c5.formula'),
      foot: pegged ? undefined : (
        <>
          <div className="inline-fields">
            <NumberField label="Y_a" value={sel.Ya} step={25} onChange={(v) => patch({ Ya: v })} />
            <NumberField label="Y_b" value={sel.Yb} step={25} onChange={(v) => patch({ Yb: v })} />
            <StepControl step={sel.stepLM} max={5} onChange={(s) => patch({ stepLM: s })} />
          </div>
          <Steps
            upTo={sel.stepLM}
            items={[
              t('con.lm.s1', { m: lmN.m }),
              t('con.lm.s2', { Ya: sel.Ya, Yb: sel.Yb, Lta: lmN.Lta, Ltb: lmN.Ltb }),
              lmN.ia === null || lmN.ib === null ? t('con.lm.outside') : t('con.lm.s3', { ia: lmN.ia, ib: lmN.ib }),
              t('con.lm.s4'),
              t('con.lm.s5'),
            ]}
          />
        </>
      ),
    },
    {
      id: 'c6',
      title: t('con.c6.title'),
      subtitle: t('con.c6.sub'),
      node: pegged ? <p className="note">{t('con.peggedNote')}</p> : <LMFourQuadrants sim={sim} sel={sel} />,
      formula: t('con.c6.formula'),
    },
    {
      id: 'c7',
      title: t('con.c7.title'),
      subtitle: t('con.c7.sub'),
      node: <FullISLMChart sim={sim} />,
      legend: (
        <>
          <LegendLine color={IS} label="IS₁" />
          <LegendLine color={IS} dashed label="IS₀" />
          <LegendLine color={LM} label="LM₁" />
          <LegendLine color={LM} dashed label="LM₀" />
        </>
      ),
      formula: t(`adv.formula.${s1.spec.regime === 'rate' ? 'rate' : s1.spec.lm}`),
      foot: <p className="chart-note">{t('con.c7.note', { Y0: f(sim.s0.equilibrium.Y, 'bn'), Y1: f(s1.equilibrium.Y, 'bn') })}</p>,
    },
  ];

  // Presentation mode: one chart at a time, ← → to navigate, Esc to exit.
  useEffect(() => {
    if (present === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPresent((k) => (k === null ? k : Math.min(cards.length - 1, k + 1)));
      else if (e.key === 'ArrowLeft') setPresent((k) => (k === null ? k : Math.max(0, k - 1)));
      else if (e.key === 'Escape') setPresent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present, cards.length]);

  const enterPresentation = () => {
    setPresent(0);
    window.setTimeout(() => {
      overlay.current?.requestFullscreen?.().catch(() => undefined);
      overlay.current?.focus();
    }, 0);
  };
  const exitPresentation = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    setPresent(null);
  };
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement && present !== null) setPresent(null);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [present]);

  const card = (c: (typeof cards)[number], k: number) => (
    <ChartCard key={c.id} title={`${k + 1} · ${c.title}`} subtitle={c.subtitle} legend={c.legend} formula={<pre className="formula">{c.formula}</pre>} footer={c.foot}>
      {c.node}
    </ChartCard>
  );

  return (
    <>
      <div className="toolbar-row">
        <p className="note" style={{ margin: 0, flex: 1 }}>{t('con.intro')}</p>
        <button className="btn primary" onClick={enterPresentation}>
          {t('ui.present')}
        </button>
      </div>
      <div className="construction-grid">{cards.map(card)}</div>
      {present !== null && (
        <div className="presentation" ref={overlay} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t('ui.present')}>
          <div className="presentation-bar">
            <button className="btn small" disabled={present === 0} onClick={() => setPresent(present - 1)}>
              ◀ {t('con.prev')}
            </button>
            <span className="num">
              {present + 1} / {cards.length}
            </span>
            <button className="btn small" disabled={present === cards.length - 1} onClick={() => setPresent(present + 1)}>
              {t('con.next')} ▶
            </button>
            <span className="spacer" />
            <span className="hint">{t('con.presentHint')}</span>
            <button className="btn small" onClick={exitPresentation}>
              {t('ui.exitPresent')}
            </button>
          </div>
          <div className="presentation-body">{card(cards[present]!, present)}</div>
        </div>
      )}
    </>
  );
}

/** Module C — graphical construction of IS and LM (shares Module B's parameters). */
export function ConstructionModule({ state, dispatch, sim, sidebarOpen, onCloseSidebar }: Props) {
  const { t } = useI18n();
  return (
    <ModuleLayout open={sidebarOpen} onClose={onCloseSidebar} sidebar={<AdvSidebar state={state} dispatch={dispatch} sim={sim} onPick={onCloseSidebar} />}>
      <div className="module-intro">
        <h2>{t('mod.construction')}</h2>
        <p>{t('mod.construction.desc')}</p>
      </div>
      <IssueList groups={issueGroups(sim)} prefix="adv.issue." />
      {sim.ok && <ConstructionCharts key={`${sim.s1.spec.lm}-${sim.s1.spec.regime}`} sim={sim} />}
    </ModuleLayout>
  );
}
