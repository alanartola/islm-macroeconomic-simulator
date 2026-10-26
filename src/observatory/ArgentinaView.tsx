import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useSeries } from '../data/client';
import { addDays, beforeAfter, transformSeries, type Obs, type SeriesFile, type Topic, type Transform } from '../data/core';
import { TimeChart, type TimeLine, type TimePanel } from '../components/charts/TimeChart';
import { EPISODES, type Episode } from './episodes';
import { EVIDENCE_DAYS, FMT, SeriesMetaTable, SourceList, WINDOWS, colorOf, today, windowRange, type WindowKey } from './shared';
import { EpisodeDetail } from './HistoryView';

/**
 * One indicator at a time. Each option is a single variable (or two series
 * with exactly the same definition and unit, such as BADLAR and TAMAR).
 */
export interface VariableDef {
  id: string;
  group: 'rates' | 'fx' | 'prices' | 'external' | 'activity' | 'money' | 'us';
  series: string[];
  /** Episode topics considered relevant for this indicator. */
  topics: Topic[];
}

export const VARIABLES: VariableDef[] = [
  { id: 'policy', group: 'rates', series: ['ar_tasa_politica'], topics: ['monetary'] },
  { id: 'market', group: 'rates', series: ['ar_badlar', 'ar_tamar'], topics: ['monetary'] },
  { id: 'repo', group: 'rates', series: ['ar_pases_terceros'], topics: ['monetary'] },
  { id: 'fx', group: 'fx', series: ['ar_tc_mayorista'], topics: ['fx'] },
  { id: 'rer', group: 'fx', series: ['ar_itcrm'], topics: ['fx', 'external'] },
  { id: 'inflationY', group: 'prices', series: ['ar_inflacion_interanual', 'ar_inflacion_esperada'], topics: ['prices', 'fx', 'monetary'] },
  { id: 'inflationM', group: 'prices', series: ['ar_inflacion_mensual'], topics: ['prices', 'fx', 'monetary'] },
  { id: 'reserves', group: 'external', series: ['ar_reservas'], topics: ['fx', 'external', 'monetary'] },
  { id: 'activity', group: 'activity', series: ['ar_emae'], topics: ['activity', 'external', 'fiscal'] },
  { id: 'unemployment', group: 'activity', series: ['ar_desocupacion'], topics: ['activity'] },
  { id: 'fiscal', group: 'activity', series: ['ar_resultado_primario'], topics: ['fiscal'] },
  { id: 'base', group: 'money', series: ['ar_base_monetaria'], topics: ['monetary'] },
  { id: 'm2', group: 'money', series: ['ar_m2'], topics: ['monetary'] },
  { id: 't2y', group: 'us', series: ['us_t2y'], topics: ['international'] },
  { id: 't10y', group: 'us', series: ['us_t10y'], topics: ['international'] },
  { id: 'fed', group: 'us', series: ['us_fed_upper', 'us_fed_lower'], topics: ['international'] },
];
/** Indicators with a methodological note under the chart (definition, discontinuity, frequency). */
const WITH_NOTE = new Set(['policy', 'market', 'inflationY', 'inflationM', 'rer', 'fed', 'fiscal', 'unemployment', 'base', 'm2', 'reserves']);
const GROUP_ORDER: VariableDef['group'][] = ['rates', 'fx', 'prices', 'external', 'activity', 'money', 'us'];
export const DEFAULT_VARIABLE = 'fx';
const ALL_IDS = [...new Set(VARIABLES.flatMap((v) => v.series))];

type EventMode = 'none' | 'relevant' | 'one';
type EvWin = keyof typeof EVIDENCE_DAYS;

const isRateKind = (k: string) => k === 'rate_tna' || k === 'rate_pct' || k === 'pct' || k === 'pct_labour';
/** Two indicators share an axis only with the same kind of unit and the same published unit. */
export function sameUnit(a: SeriesFile, b: SeriesFile): boolean {
  return a.meta.unitKind === b.meta.unitKind && a.meta.unit.es === b.meta.unit.es;
}
export const relevantEpisodes = (v: VariableDef): Episode[] => EPISODES.filter((e) => e.topics.some((t) => v.topics.includes(t)));

export function ArgentinaView({ focusDate, focusEpisode, onFocus }: { focusDate: string | null; focusEpisode?: string | null; onFocus: (date: string | null, episode?: string | null) => void }) {
  const { t, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const { files, errors, loading } = useSeries(ALL_IDS);
  const [varId, setVarId] = useState(DEFAULT_VARIABLE);
  const [compareOn, setCompareOn] = useState(false);
  const [compareId, setCompareId] = useState('policy');
  const [transform, setTransform] = useState<Transform>('level');
  const [win, setWin] = useState<WindowKey>(focusDate ? '6m' : '5y');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const initialEpisode = focusEpisode && EPISODES.some((e) => e.id === focusEpisode) ? focusEpisode : null;
  const [mode, setMode] = useState<EventMode>(initialEpisode ? 'one' : 'relevant');
  const [episodeId, setEpisodeId] = useState<string | null>(initialEpisode);
  const [evWin, setEvWin] = useState<EvWin>('3m');

  const variable = VARIABLES.find((v) => v.id === varId) ?? VARIABLES[0]!;
  const other = compareOn ? VARIABLES.find((v) => v.id === compareId && v.id !== variable.id) ?? null : null;
  const mainFiles = variable.series.map((id) => files[id]).filter((s): s is SeriesFile => !!s);
  const otherFiles = other ? other.series.map((id) => files[id]).filter((s): s is SeriesFile => !!s) : [];
  const episode = mode === 'one' ? EPISODES.find((e) => e.id === episodeId) ?? null : null;

  // Coverage of the selected indicator: the period never extends beyond its data.
  const shown = [...mainFiles, ...otherFiles];
  const first = shown.reduce((a, s) => (s.status.firstObservation && s.status.firstObservation < a ? s.status.firstObservation : a), '9999-12-31');
  const last = shown.reduce((a, s) => (s.status.lastObservation && s.status.lastObservation > a ? s.status.lastObservation : a), '0000-01-01');
  const center = episode?.date ?? focusDate;
  const hasData = shown.length > 0 && first <= last;
  const range = hasData ? clampRange(custom ?? windowRange(win, last, first, center), first, last) : { from: '2016-01-01', to: today() };

  const axisOf = (v: VariableDef, s: SeriesFile, applied: Transform) => {
    const name = t(`obs.var.${v.id}.short`);
    if (applied === 'yoy') return t('obs.axis.yoy', { name });
    if (applied === 'index') return t('obs.axis.index', { name });
    if (applied === 'diff') return t('obs.axis.diff', { name, unit: isRateKind(s.meta.unitKind) ? t('obs.unit.pp') : t(`obs.var.${v.id}.unit`) });
    return `${name} (${t(`obs.var.${v.id}.unit`)})`;
  };

  const linesOf = (fs: SeriesFile[]): { lines: (TimeLine & { applied: Transform })[]; applied: Transform } => {
    const lines = fs.map((s, k) => {
      const tr = transformSeries(s.data, s.meta.unitKind, s.meta.frequency, transform, range.from);
      return { id: s.meta.id, label: L(s.meta.name), color: colorOf(s.meta.id, k), data: tr.data, dash: s.meta.id === 'ar_inflacion_esperada' || s.meta.id === 'us_fed_lower', applied: tr.applied };
    });
    return { lines, applied: lines[0]?.applied ?? 'level' };
  };

  const panels = useMemo<TimePanel[]>(() => {
    if (!mainFiles.length) return [];
    const main = linesOf(mainFiles);
    const fmt = main.applied === 'level' ? FMT[mainFiles[0]!.meta.unitKind] : 'n1';
    const out: TimePanel[] = [{ id: 'main', title: t(`obs.var.${variable.id}.name`), unit: '', yLabel: axisOf(variable, mainFiles[0]!, main.applied), lines: main.lines, fmt }];
    if (other && otherFiles.length) {
      const sec = linesOf(otherFiles);
      if (sameUnit(mainFiles[0]!, otherFiles[0]!) && sec.applied === main.applied) out[0]!.lines.push(...sec.lines.map((l) => ({ ...l, dash: true })));
      else out.push({ id: 'compare', title: t(`obs.var.${other.id}.name`), unit: '', yLabel: axisOf(other, otherFiles[0]!, sec.applied), lines: sec.lines, fmt: sec.applied === 'level' ? FMT[otherFiles[0]!.meta.unitKind] : 'n1' });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, varId, compareOn, compareId, transform, range.from, lang]);

  const relevant = relevantEpisodes(variable);
  const markers =
    mode === 'none'
      ? []
      : (mode === 'one' && episode ? [episode] : relevant).map((e) => ({ id: e.id, date: e.date, label: `${e.date} · ${L(e.title)}`, active: e.id === episode?.id }));
  const evidenceDays = EVIDENCE_DAYS[evWin];

  const selectEpisode = (id: string | null) => {
    setEpisodeId(id);
    setCustom(null);
    if (id) {
      setMode('one');
      if (win === 'all' || win === '5y') setWin('1y');
      onFocus(EPISODES.find((e) => e.id === id)!.date, id);
    } else onFocus(null, null);
  };

  const inWindow = mainFiles.map((s) => s.data.filter(([d]) => d >= range.from && d <= range.to).length);
  const twoPanels = panels.length > 1;

  return (
    <div className="obs-view">
      <div className="card obs-controls obs-controls-single">
        <div className="obs-control-grid">
          <label className="field">
            <span className="kicker">{t('obs.pick.variable')}</span>
            <select className="select" value={variable.id} onChange={(e) => setVarId(e.target.value)} aria-label={t('obs.pick.variable')}>
              {GROUP_ORDER.map((g) => (
                <optgroup key={g} label={t(`obs.vgroup.${g}`)}>
                  {VARIABLES.filter((v) => v.group === g).map((v) => (
                    <option key={v.id} value={v.id}>
                      {t(`obs.var.${v.id}.name`)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="kicker">{t('obs.view')}</span>
            <select className="select" value={transform} onChange={(e) => setTransform(e.target.value as Transform)} aria-label={t('obs.view')}>
              {(['level', 'yoy', 'index', 'diff'] as Transform[]).map((k) => (
                <option key={k} value={k}>
                  {t(`obs.transform.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="kicker">{t('obs.events')}</span>
            <select className="select" value={mode} onChange={(e) => (e.target.value === 'one' ? selectEpisode(episodeId ?? relevant[relevant.length - 1]?.id ?? EPISODES[0]!.id) : (setMode(e.target.value as EventMode), onFocus(null, null)))} aria-label={t('obs.events')}>
              <option value="none">{t('obs.events.none')}</option>
              <option value="relevant">{t('obs.events.relevant')}</option>
              <option value="one">{t('obs.events.one')}</option>
            </select>
          </label>
          {mode === 'one' && (
            <label className="field field-wide">
              <span className="kicker">{t('obs.episode')}</span>
              <select className="select" value={episodeId ?? ''} onChange={(e) => selectEpisode(e.target.value || null)} aria-label={t('obs.episode')}>
                {EPISODES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.date} · {L(e.title)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="obs-control-row">
          <span className="kicker">{t('obs.window')}</span>
          <div className="segmented compact" role="group" aria-label={t('obs.window')}>
            {WINDOWS.map((k) => (
              <button
                key={k}
                aria-pressed={!custom && win === k}
                onClick={() => {
                  setCustom(null);
                  setWin(k);
                }}
              >
                {t(`obs.win.${k}`)}
              </button>
            ))}
          </div>
          <label className="inline-field">
            {t('obs.from')}
            <input type="date" value={range.from} min={hasData ? first : undefined} max={range.to} onChange={(e) => e.target.value && setCustom({ from: e.target.value, to: range.to })} />
          </label>
          <label className="inline-field">
            {t('obs.to')}
            <input type="date" value={range.to} min={range.from} max={hasData ? last : undefined} onChange={(e) => e.target.value && setCustom({ from: range.from, to: e.target.value })} />
          </label>
        </div>
        <details className="compare-panel" open={compareOn} onToggle={(e) => setCompareOn((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>{t('obs.compare')}</summary>
          <div className="obs-control-row">
            <label className="field">
              <span className="kicker">{t('obs.compare.with')}</span>
              <select className="select" value={compareId} onChange={(e) => setCompareId(e.target.value)} aria-label={t('obs.compare.with')}>
                {VARIABLES.filter((v) => v.id !== variable.id).map((v) => (
                  <option key={v.id} value={v.id}>
                    {t(`obs.var.${v.id}.name`)}
                  </option>
                ))}
              </select>
            </label>
            <p className="note">{twoPanels ? t('obs.compare.panels') : t('obs.compare.same')}</p>
          </div>
        </details>
      </div>

      {loading && <p className="muted">{t('obs.loading')}</p>}
      {Object.keys(errors).length > 0 && (
        <div className="issue-box warning">
          <strong>{t('obs.missing')}</strong>
          {Object.keys(errors).join(', ')}
        </div>
      )}

      {panels.length > 0 && (
        <section className="card chart-card main-series" aria-labelledby="obs-main-title">
          <div className="card-head">
            <div>
              <h3 id="obs-main-title">
                {t(`obs.var.${variable.id}.name`)}
                {other && ` · ${t(`obs.var.${other.id}.name`)}`}
              </h3>
              <p>{t(`obs.var.${variable.id}.def`)}</p>
            </div>
          </div>
          <TimeChart
            from={range.from}
            to={range.to}
            panels={panels}
            markers={markers}
            markerLines="active"
            band={episode ? { from: episode.date, to: addDays(episode.date, evidenceDays) } : null}
            onMarker={(id) => selectEpisode(id)}
            ariaLabel={`${t(`obs.var.${variable.id}.name`)}: ${range.from} – ${range.to}`}
            panelHeight={twoPanels ? 200 : 330}
            hideTitles={!twoPanels}
          />
          <p className="muted small chart-foot">
            {mainFiles.map((s, k) => t('obs.count', { name: L(s.meta.name), n: inWindow[k] ?? 0, freq: t(`obs.freq.${s.meta.frequency}`).toLowerCase() })).join(' · ')}
            {' · '}
            {t('obs.source', { org: [...new Set(shown.map((s) => s.meta.source.org))].join(', ') })}
          </p>
          {WITH_NOTE.has(variable.id) && <p className="note">{t(`obs.var.${variable.id}.note`)}</p>}
          {transform !== 'level' && <p className="note">{t(`obs.transform.${transform}.hint`)}</p>}
          {mode === 'relevant' && markers.some((m) => m.date >= range.from && m.date <= range.to) && <p className="muted small">{t('obs.events.hint', { n: markers.filter((m) => m.date >= range.from && m.date <= range.to).length })}</p>}
        </section>
      )}

      {episode && mainFiles.length > 0 && (
        <EventFocus episode={episode} files={files} main={mainFiles} days={evidenceDays} evWin={evWin} onEvWin={setEvWin} />
      )}

      <details className="card meta-card">
        <summary>{t('obs.meta.title')}</summary>
        <SeriesMetaTable files={shown} today={today()} />
      </details>

      <UsComparison files={files} range={range} />
    </div>
  );
}

function clampRange(r: { from: string; to: string }, first: string, last: string) {
  const from = r.from < first ? first : r.from > last ? last : r.from;
  const to = r.to > last ? last : r.to < from ? from : r.to;
  return { from, to };
}

/** The selected event: what happened, the indicator before and after, and verified sources. */
function EventFocus({ episode, files, main, days, evWin, onEvWin }: { episode: Episode; files: Record<string, SeriesFile>; main: SeriesFile[]; days: number; evWin: EvWin; onEvWin: (w: EvWin) => void }) {
  const { t, f, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fd = (d: string) => df.format(new Date(`${d}T00:00:00Z`));
  return (
    <section className="card event-focus" aria-labelledby={`focus-${episode.id}`}>
      <div className="card-head">
        <div>
          <span className="kicker">
            {fd(episode.date)} · {t(`obs.kind.${episode.kind}`)}
          </span>
          <h3 id={`focus-${episode.id}`}>{L(episode.title)}</h3>
        </div>
        <div className="segmented compact" role="group" aria-label={t('obs.window')}>
          {(Object.keys(EVIDENCE_DAYS) as EvWin[]).map((k) => (
            <button key={k} aria-pressed={evWin === k} onClick={() => onEvWin(k)}>
              {t(`obs.win.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="lede-sm">{L(episode.decision)}</p>
      <dl className="before-after">
        {main.map((s) => {
          const ba = beforeAfter(s.data, episode.date, days);
          const rate = isRateKind(s.meta.unitKind);
          const fmt = FMT[s.meta.unitKind];
          return (
            <div key={s.meta.id}>
              <dt>{L(s.meta.name)}</dt>
              <dd>
                <span>
                  {t('obs.ep.before')}: <b className="num">{ba.before ? f(ba.before[1], fmt) : '—'}</b> {ba.before && <span className="muted small">({fd(ba.before[0])})</span>}
                </span>
                <span>
                  {t('obs.ep.after', { n: days })}: <b className="num">{ba.after ? f(ba.after[1], fmt) : t('obs.ep.noData')}</b> {ba.after && <span className="muted small">({fd(ba.after[0])})</span>}
                  {ba.after && !ba.complete && <span className="muted small"> · {t('obs.ep.incomplete')}</span>}
                </span>
                <span>
                  {t('obs.ep.change')}: <b className="num">{ba.abs === null ? '—' : rate ? `${f(ba.abs, 'sn2')} ${t('obs.unit.pp')}` : ba.pct === null ? f(ba.abs, 'sn1') : `${f(ba.pct, 'sn1')}%`}</b>
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="claim claim-obs">{t('obs.ep.evidenceNote')}</p>
      <h4>{t('obs.ep.sources')}</h4>
      <SourceList sources={episode.sources} />
      <details className="episode-more">
        <summary>{t('obs.ep.more')}</summary>
        <EpisodeDetail episode={episode} files={files} />
      </details>
    </section>
  );
}

/**
 * Argentina vs United States: peso rates and dollar yields side by side, never
 * on one axis, with the decomposition that makes them comparable in expectation.
 */
function UsComparison({ files, range }: { files: Record<string, SeriesFile>; range: { from: string; to: string } }) {
  const { t, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const ar = ['ar_badlar', 'ar_tasa_politica'].map((id) => files[id]).filter((f): f is SeriesFile => !!f);
  const us = ['us_t2y', 'us_fed_upper'].map((id) => files[id]).filter((f): f is SeriesFile => !!f);
  const tc = files.ar_tc_mayorista;
  const inflAr = files.ar_inflacion_interanual;
  if (!ar.length || !us.length || !tc) return null;
  const dep: Obs[] = transformSeries(tc.data, tc.meta.unitKind, 'D', 'yoy', range.from).data;
  const panels: TimePanel[] = [
    { id: 'ar', title: t('obs.cmp.ar'), unit: t('obs.cmp.unit.ars'), yLabel: t('obs.cmp.axis.ars'), lines: ar.map((f, k) => ({ id: f.meta.id, label: L(f.meta.name), color: colorOf(f.meta.id, k), data: f.data })), fmt: 'n1' },
    { id: 'us', title: t('obs.cmp.us'), unit: t('obs.cmp.unit.usd'), yLabel: t('obs.cmp.axis.usd'), lines: us.map((f, k) => ({ id: f.meta.id, label: L(f.meta.name), color: colorOf(f.meta.id, k), data: f.data, dash: f.meta.id === 'us_fed_upper' })), fmt: 'n2' },
    {
      id: 'dep',
      title: t('obs.cmp.dep'),
      unit: t('obs.unit.yoy'),
      yLabel: t('obs.cmp.axis.dep'),
      lines: [
        { id: 'dep', label: t('obs.cmp.dep'), color: colorOf('ar_tc_mayorista'), data: dep },
        ...(inflAr ? [{ id: 'infl', label: L(inflAr.meta.name), color: colorOf('ar_inflacion_interanual'), data: inflAr.data, dash: true }] : []),
      ],
      fmt: 'n1',
    },
  ];
  return (
    <details className="card chart-card us-compare">
      <summary>
        <span>{t('obs.cmp.title')}</span>
        <span className="muted small">{t('obs.cmp.sub')}</span>
      </summary>
      <div className="issue-box warning">
        <strong>{t('obs.cmp.warn.title')}</strong>
        {t('obs.cmp.warn')}
      </div>
      <TimeChart from={range.from} to={range.to} panels={panels} ariaLabel={t('obs.cmp.title')} panelHeight={130} />
      <div className="cmp-explain">
        <p className="formula-line">{t('obs.cmp.parity')}</p>
        <ul>
          {['fx', 'inflation', 'expected', 'sovereign', 'premium', 'currency', 'controls'].map((k) => (
            <li key={k}>
              <b>{t(`obs.cmp.f.${k}`)}</b> {t(`obs.cmp.f.${k}.d`)}
            </li>
          ))}
        </ul>
        <p className="note">{t('obs.cmp.notcountry')}</p>
      </div>
    </details>
  );
}
