import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { DEFAULT_PARAMS, solve } from '../engine';
import { ISLMChart } from '../components/charts/ISLMChart';
import { useSeries } from '../data/client';
import type { Lang2 } from '../data/core';
import type { LabConfig } from '../lab/scenario';
import { exercises, isCorrect, type ExLevel, type Exercise, type ExerciseContent, type Question } from './bank';
import { loadProgress, recordAttempt, storeProgress, summarizeProgress, type ExProgress } from './progress';

const LEVELS: ExLevel[] = ['inicial', 'intermedio', 'avanzado'];
type Answers = Record<string, unknown>;

interface Props {
  onOpenConfig: (cfg: LabConfig) => void;
  onOpenObservatory: (date: string, episode?: string) => void;
}

/**
 * Exercises and problems. Model exercises are graded against the engines'
 * results; real-data exercises against the published official series.
 */
export function ExercisesModule({ onOpenConfig, onOpenObservatory }: Props) {
  const { t } = useI18n();
  const list = useMemo(() => exercises(), []);
  const [level, setLevel] = useState<ExLevel | 'all'>('all');
  const [topic, setTopic] = useState<string>('all');
  const [progress, setProgress] = useState<Record<string, ExProgress>>(loadProgress);
  const [currentId, setCurrentId] = useState<string>(list[0]!.id);
  useEffect(() => storeProgress(progress), [progress]);

  const shown = list.filter((e) => (level === 'all' || e.level === level) && (topic === 'all' || e.topic === topic));
  const current = list.find((e) => e.id === currentId) ?? list[0]!;
  const sum = summarizeProgress(list, progress);

  return (
    <main className="main ex-main">
      <div className="module-intro">
        <div>
          <span className="kicker">{t('ex.kicker')}</span>
          <h2>{t('ex.title')}</h2>
          <p>{t('ex.desc')}</p>
        </div>
      </div>

      <section className="card ex-progress" aria-label={t('ex.progress')}>
        <div className="ex-progress-head">
          <h3>{t('ex.progress')}</h3>
          <dl className="ex-stats">
            <div>
              <dt>{t('ex.stat.attempted')}</dt>
              <dd>
                {sum.attempted}/{sum.total}
              </dd>
            </div>
            <div>
              <dt>{t('ex.stat.solved')}</dt>
              <dd>{sum.solved}</dd>
            </div>
            <div>
              <dt>{t('ex.stat.errors')}</dt>
              <dd>{sum.errors}</dd>
            </div>
          </dl>
          <button
            className="btn link small"
            onClick={() => {
              if (window.confirm(t('ex.reset.confirm'))) setProgress({});
            }}
          >
            {t('ex.reset')}
          </button>
        </div>
        <div className="ex-levels">
          {sum.byLevel.map((l) => (
            <div key={l.level} className="ex-level">
              <span>{t(`ex.level.${l.level}`)}</span>
              <span className="ex-bar" role="progressbar" aria-valuemin={0} aria-valuemax={l.total} aria-valuenow={l.solved} aria-label={t(`ex.level.${l.level}`)}>
                <span style={{ width: `${l.total ? (100 * l.solved) / l.total : 0}%` }} />
              </span>
              <span className="num">
                {l.solved}/{l.total}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="ex-layout">
        <aside className="ex-list-panel">
          <div className="segmented compact" role="group" aria-label={t('ex.filter.level')}>
            {(['all', ...LEVELS] as const).map((k) => (
              <button key={k} aria-pressed={level === k} onClick={() => setLevel(k)}>
                {k === 'all' ? t('ex.all') : t(`ex.level.${k}`)}
              </button>
            ))}
          </div>
          <label className="inline-field">
            {t('ex.filter.topic')}
            <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">{t('ex.all')}</option>
              {['closed', 'open', 'prices', 'data'].map((k) => (
                <option key={k} value={k}>
                  {t(`ex.topic.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <ol className="ex-list">
            {shown.map((e) => {
              const p = progress[e.id];
              const state = p?.solved ? 'solved' : p && p.attempts > 0 ? 'tried' : 'new';
              return (
                <li key={e.id}>
                  <button className="preset ex-item" aria-current={e.id === current.id ? 'true' : undefined} onClick={() => setCurrentId(e.id)}>
                    <span className="p-title">
                      <span className={`ex-dot ex-${state}`} aria-label={t(`ex.state.${state}`)} title={t(`ex.state.${state}`)} />
                      <LangText v={e.title} />
                    </span>
                    <span className="p-desc">
                      {t(`ex.level.${e.level}`)} · {e.types.map((k) => t(`ex.type.${k}`)).join(', ')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <ExerciseView
          key={current.id}
          ex={current}
          progress={progress[current.id]}
          onAttempt={(wrong, ok) => setProgress((p) => recordAttempt(p, current.id, wrong, ok))}
          onReveal={() => setProgress((p) => ({ ...p, [current.id]: { ...(p[current.id] ?? { attempts: 0, errors: 0, solved: false, revealed: false }), revealed: true } }))}
          onOpenConfig={onOpenConfig}
          onOpenObservatory={onOpenObservatory}
        />
      </div>
    </main>
  );
}

function LangText({ v }: { v: Lang2 }) {
  const { lang } = useI18n();
  return <>{v[lang === 'es' ? 'es' : 'en']}</>;
}

function ExerciseView({
  ex,
  progress,
  onAttempt,
  onReveal,
  onOpenConfig,
  onOpenObservatory,
}: {
  ex: Exercise;
  progress?: ExProgress;
  onAttempt: (wrong: number, ok: boolean) => void;
  onReveal: () => void;
} & Props) {
  const { t, lang } = useI18n();
  const L = (v: Lang2) => v[lang === 'es' ? 'es' : 'en'];
  const { files, loading, errors } = useSeries(ex.dataSeries ?? []);
  const content: ExerciseContent | null = ex.content ?? (ex.build && !loading ? ex.build(files) : null);
  const [answers, setAnswers] = useState<Answers>({});
  const [checked, setChecked] = useState(false);
  const [hints, setHints] = useState(0);
  const [solution, setSolution] = useState(false);
  const graph = useMemo(() => {
    if (!ex.graph || ex.config?.model !== 'basic') return null;
    const r0 = solve({ params: DEFAULT_PARAMS, regime: ex.config.regime, targetRate: ex.config.target0 });
    const r1 = solve({ params: ex.config.shocked, regime: ex.config.regime, targetRate: ex.config.target1 });
    return r0.ok && r1.ok ? { e0: r0.value, e1: r1.value } : null;
  }, [ex]);

  const results = content ? content.questions.map((q) => ({ q, ok: isCorrect(q, answers[q.id]) })) : [];
  const verify = () => {
    if (!content) return;
    const wrong = results.filter((r) => !r.ok).length;
    setChecked(true);
    onAttempt(wrong, wrong === 0);
  };
  const set = (id: string, v: unknown) => {
    setAnswers((a) => ({ ...a, [id]: v }));
    setChecked(false);
  };

  return (
    <article className="card ex-detail" aria-labelledby={`ex-${ex.id}`}>
      <header className="ex-head">
        <span className="kicker">
          {t(`ex.level.${ex.level}`)} · {t(`ex.topic.${ex.topic}`)}
          {progress?.solved ? ` · ${t('ex.state.solved')}` : ''}
        </span>
        <h3 id={`ex-${ex.id}`}>{L(ex.title)}</h3>
        <div className="ex-tags">
          {ex.types.map((k) => (
            <span key={k} className="tag">
              {t(`ex.type.${k}`)}
            </span>
          ))}
        </div>
      </header>

      <section className="ex-block">
        <h4>{t('ex.statement')}</h4>
        <p>{L(ex.statement)}</p>
      </section>
      {content && content.data.length > 0 && (
        <section className="ex-block">
          <h4>{t('ex.data')}</h4>
          <ul className="ex-data">
            {content.data.map((d, k) => (
              <li key={k}>{L(d)}</li>
            ))}
          </ul>
          {ex.dataSeries && <p className="note">{t('ex.data.official')}</p>}
        </section>
      )}
      <section className="ex-block">
        <h4>{t('ex.objective')}</h4>
        <p>{L(ex.objective)}</p>
      </section>

      {graph && (
        <figure className="ex-graph">
          <ISLMChart e0={graph.e0} e1={graph.e1} showInitial showShifted showGuides={false} saved={[]} />
          <figcaption className="note">{t('ex.graph.caption')}</figcaption>
        </figure>
      )}

      {ex.build && loading && <p className="muted">{t('obs.loading')}</p>}
      {ex.build && !loading && !content && (
        <div className="issue-box warning">
          <strong>{t('ex.data.missing')}</strong>
          {Object.keys(errors).join(', ')}
        </div>
      )}

      {content && (
        <form
          className="ex-answers"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <h4>{t('ex.answer')}</h4>
          {content.questions.map((q, k) => (
            <QuestionField key={q.id} n={k + 1} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} result={checked ? results[k]!.ok : null} reveal={solution} />
          ))}
          <div className="ex-actions">
            <button type="submit" className="btn primary">
              {t('ex.check')}
            </button>
            {hints < ex.hints.length && (
              <button type="button" className="btn" onClick={() => setHints((h) => h + 1)}>
                {t('ex.hint', { n: hints + 1, total: ex.hints.length })}
              </button>
            )}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSolution((s) => !s);
                if (!progress?.solved) onReveal();
              }}
            >
              {solution ? t('ex.solution.hide') : t('ex.solution.show')}
            </button>
            <button
              type="button"
              className="btn link"
              onClick={() => {
                setAnswers({});
                setChecked(false);
                setSolution(false);
              }}
            >
              {t('ex.clear')}
            </button>
          </div>
          {checked && (
            <p className={`ex-verdict ${results.every((r) => r.ok) ? 'ok' : 'bad'}`} role="status">
              {results.every((r) => r.ok) ? t('ex.verdict.ok') : t('ex.verdict.bad', { n: results.filter((r) => !r.ok).length, total: results.length })}
            </p>
          )}
        </form>
      )}

      {hints > 0 && (
        <section className="ex-block ex-hints">
          <h4>{t('ex.hints')}</h4>
          <ol>
            {ex.hints.slice(0, hints).map((h, k) => (
              <li key={k}>{L(h)}</li>
            ))}
          </ol>
        </section>
      )}

      {content && (solution || (checked && results.every((r) => r.ok))) && (
        <section className="ex-block ex-solution">
          <h4>{t('ex.steps')}</h4>
          <ol className="steps-list">
            {content.steps.map((s, k) => (
              <li key={k} className="formula-step">
                {L(s)}
              </li>
            ))}
          </ol>
          <h4>{t('ex.interpretation')}</h4>
          <p>{L(content.interpretation)}</p>
        </section>
      )}

      <footer className="ex-links">
        {ex.config && (
          <button className="btn" onClick={() => onOpenConfig(ex.config!)}>
            {t('ex.openSim')}
          </button>
        )}
        {ex.observatory && (
          <button className="btn" onClick={() => onOpenObservatory(ex.observatory!.date, ex.observatory!.episode)}>
            {t('ex.openObs')}
          </button>
        )}
        <span className="note">{ex.dataSeries ? t('ex.source.data') : t('ex.source.model')}</span>
      </footer>
    </article>
  );
}

function QuestionField({ n, q, value, onChange, result, reveal }: { n: number; q: Question; value: unknown; onChange: (v: unknown) => void; result: boolean | null; reveal: boolean }) {
  const { t, lang, f } = useI18n();
  const L = (v: Lang2) => v[lang === 'es' ? 'es' : 'en'];
  const mark = result === null ? null : result ? <span className="ex-mark ok">{t('ex.correct')}</span> : <span className="ex-mark bad">{t('ex.incorrect')}</span>;
  const name = `q-${q.id}`;
  if (q.kind === 'choice') {
    const right = q.options.find((o) => o.id === q.answer);
    return (
      <fieldset className={`ex-q ${result === null ? '' : result ? 'is-ok' : 'is-bad'}`}>
        <legend>
          <span className="num">{n}.</span> {L(q.prompt)} {mark}
        </legend>
        <div className="ex-options">
          {q.options.map((o) => (
            <label key={o.id} className="ex-option">
              <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} />
              <span>{L(o.label)}</span>
            </label>
          ))}
        </div>
        {reveal && value !== q.answer && right && <p className="ex-correct">{t('ex.correctIs', { v: L(right.label) })}</p>}
      </fieldset>
    );
  }
  if (q.kind === 'number') {
    return (
      <div className={`ex-q ${result === null ? '' : result ? 'is-ok' : 'is-bad'}`}>
        <label className="ex-num">
          <span>
            <span className="num">{n}.</span> {L(q.prompt)} {mark}
          </span>
          <span className="ex-num-input">
            <input className="text-input num" inputMode="decimal" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={L(q.prompt)} />
            <span className="unit">{L(q.unit)}</span>
          </span>
        </label>
        {reveal && result !== true && <p className="ex-correct">{t('ex.correctIs', { v: `${f(q.answer, 'n2')} ${L(q.unit)}`.trim() })}</p>}
        <p className="muted small">{t('ex.tolerance', { v: f(q.tolerance, 'n2') })}</p>
      </div>
    );
  }
  const a = (value ?? {}) as Record<string, string>;
  return (
    <fieldset className={`ex-q ${result === null ? '' : result ? 'is-ok' : 'is-bad'}`}>
      <legend>
        <span className="num">{n}.</span> {L(q.prompt)} {mark}
      </legend>
      <ul className="ex-classify">
        {q.statements.map((s) => (
          <li key={s.id}>
            <p>{L(s.text)}</p>
            <div className="segmented compact" role="group" aria-label={L(s.text)}>
              {(['obs', 'hyp', 'int'] as const).map((k) => (
                <button type="button" key={k} aria-pressed={a[s.id] === k} onClick={() => onChange({ ...a, [s.id]: k })}>
                  {t(`ex.class.${k}`)}
                </button>
              ))}
            </div>
            {reveal && a[s.id] !== s.answer && <p className="ex-correct">{t('ex.correctIs', { v: t(`ex.class.${s.answer}`) })}</p>}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
