import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useSeries } from '../data/client';
import { addDays, beforeAfter, type SeriesFile } from '../data/core';
import { TimeChart, type TimePanel } from '../components/charts/TimeChart';
import { EPISODES, TRADE_EVENTS, type Episode } from './episodes';
import { EVIDENCE_DAYS, FMT, SourceList, colorOf } from './shared';

type EvWin = keyof typeof EVIDENCE_DAYS;

/**
 * One episode in four parts: context, decision or shock, evidence (computed
 * from official series, descriptive) and interpretation (with hypotheses
 * labelled as such). The evidence window can be 1, 3, 6 or 12 months or custom.
 */
export function EpisodeDetail({ episode, files: given }: { episode: Episode; files?: Record<string, SeriesFile> }) {
  const { t, f, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const loaded = useSeries(given ? [] : episode.evidence);
  const files = given ?? loaded.files;
  const [win, setWin] = useState<EvWin>('3m');
  const [customDays, setCustomDays] = useState<number | null>(null);
  const days = customDays ?? EVIDENCE_DAYS[win];
  const rows = episode.evidence
    .map((id) => files[id])
    .filter((s): s is SeriesFile => !!s)
    .map((s) => ({ s, ba: beforeAfter(s.data, episode.date, days) }));
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fd = (d: string) => df.format(new Date(`${d}T00:00:00Z`));
  const panels: TimePanel[] = rows.slice(0, 4).map(({ s }) => ({ id: s.meta.id, title: L(s.meta.name), unit: L(s.meta.unit), lines: [{ id: s.meta.id, label: L(s.meta.name), color: colorOf(s.meta.id), data: s.data }], fmt: FMT[s.meta.unitKind] }));
  const from = addDays(episode.date, -Math.max(days, 60));
  const to = addDays(episode.date, Math.max(days, 60));

  return (
    <article className="card episode" aria-labelledby={`ep-${episode.id}`}>
      <div className="card-head">
        <div>
          <span className="kicker">
            {fd(episode.date)} · {t(`obs.kind.${episode.kind}`)}
          </span>
          <h3 id={`ep-${episode.id}`}>{L(episode.title)}</h3>
        </div>
      </div>
      <div className="episode-grid">
        <section>
          <h4>
            <span className="step">1</span> {t('obs.ep.context')}
          </h4>
          <p>{L(episode.context)}</p>
          <h4>
            <span className="step">2</span> {t('obs.ep.decision')}
          </h4>
          <p>{L(episode.decision)}</p>
          <p className="claim claim-fact">{t('obs.ep.factsNote')}</p>
        </section>
        <section>
          <h4>
            <span className="step">3</span> {t('obs.ep.evidence')}
          </h4>
          <div className="segmented compact" role="group" aria-label={t('obs.window')}>
            {(Object.keys(EVIDENCE_DAYS) as EvWin[]).map((k) => (
              <button
                key={k}
                aria-pressed={customDays === null && win === k}
                onClick={() => {
                  setCustomDays(null);
                  setWin(k);
                }}
              >
                {t(`obs.win.${k}`)}
              </button>
            ))}
            <label className="inline-field">
              {t('obs.ep.days')}
              <input type="number" min={1} max={730} value={days} onChange={(e) => setCustomDays(Math.max(1, Math.min(730, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>{t('obs.meta.series')}</th>
                  <th>{t('obs.ep.before')}</th>
                  <th>{t('obs.ep.after', { n: days })}</th>
                  <th>{t('obs.ep.change')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, ba }) => {
                  const fmt = FMT[s.meta.unitKind];
                  const rate = s.meta.unitKind.startsWith('rate') || s.meta.unitKind === 'pct' || s.meta.unitKind === 'pct_labour';
                  return (
                    <tr key={s.meta.id}>
                      <td>{L(s.meta.name)}</td>
                      <td className="num">{ba.before ? `${f(ba.before[1], fmt)} (${fd(ba.before[0])})` : '—'}</td>
                      <td className="num">
                        {ba.after ? `${f(ba.after[1], fmt)} (${fd(ba.after[0])})` : t('obs.ep.noData')}
                        {ba.after && !ba.complete && <span className="muted small"> · {t('obs.ep.incomplete')}</span>}
                      </td>
                      <td className="num">
                        {ba.abs === null ? '—' : rate ? `${f(ba.abs, 'sn2')} ${t('obs.unit.pp')}` : ba.pct === null ? f(ba.abs, 'sn1') : `${f(ba.pct, 'sn1')}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="claim claim-obs">{t('obs.ep.evidenceNote')}</p>
        </section>
      </div>
      {panels.length > 0 && <TimeChart from={from} to={to} panels={panels} markers={[{ id: episode.id, date: episode.date, label: L(episode.title), active: true }]} band={{ from: episode.date, to: addDays(episode.date, days) }} ariaLabel={L(episode.title)} panelHeight={90} />}
      <section>
        <h4>
          <span className="step">4</span> {t('obs.ep.interpretation')}
        </h4>
        <p>{L(episode.interpretation)}</p>
        <ul className="hypotheses">
          {episode.hypotheses.map((h, k) => (
            <li key={k} className="claim claim-hyp">
              <span className="claim-tag">{t('obs.ep.hypothesis')}</span> {L(h)}
            </li>
          ))}
        </ul>
        <p className="note">{t('obs.ep.causality')}</p>
      </section>
      <section>
        <h4>{t('obs.ep.sources')}</h4>
        <SourceList sources={episode.sources} />
      </section>
    </article>
  );
}

export function HistoryView({ onOpenChart }: { onOpenChart: (date: string, id: string) => void }) {
  const { t, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const all = useMemo(() => [...EPISODES, ...TRADE_EVENTS].sort((a, b) => (a.date < b.date ? -1 : 1)), []);
  const years = [...new Set(all.map((e) => e.date.slice(0, 4)))];
  const [year, setYear] = useState<string>('all');
  const [sel, setSel] = useState<string>(EPISODES[EPISODES.length - 1]!.id);
  const list = all.filter((e) => year === 'all' || e.date.startsWith(year));
  const episode = all.find((e) => e.id === sel) ?? list[0];

  return (
    <div className="history">
      <aside className="card history-list" aria-label={t('obs.tab.history')}>
        <div className="card-head">
          <div>
            <h3>{t('obs.hist.title')}</h3>
            <p>{t('obs.hist.sub')}</p>
          </div>
        </div>
        <label className="inline-field">
          {t('obs.hist.year')}
          <select className="select" value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">{t('obs.hist.allYears')}</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <ol className="episode-list">
          {list.map((e) => (
            <li key={e.id}>
              <button className="preset" aria-pressed={episode?.id === e.id} onClick={() => setSel(e.id)}>
                <span className="p-title">{L(e.title)}</span>
                <span className="p-desc">
                  {e.date} · {t(`obs.kind.${e.kind}`)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
      <div className="history-detail">
        {episode && (
          <>
            <EpisodeDetail key={episode.id} episode={episode} />
            {episode.kind !== 'trade' && (
              <button className="btn" onClick={() => onOpenChart(episode.date, episode.id)}>
                {t('obs.hist.openChart')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
