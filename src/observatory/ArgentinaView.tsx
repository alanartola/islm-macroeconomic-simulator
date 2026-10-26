import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useSeries } from '../data/client';
import { transformSeries, type Obs, type SeriesFile, type Transform } from '../data/core';
import { TimeChart, type TimePanel } from '../components/charts/TimeChart';
import { EPISODES } from './episodes';
import { FMT, SeriesMetaTable, WINDOWS, colorOf, today, windowRange, type WindowKey } from './shared';
import { EpisodeDetail } from './HistoryView';

/** Variable groups that can be shown and hidden; each becomes one synchronised panel. */
const GROUPS: { id: string; series: string[] }[] = [
  { id: 'rates', series: ['ar_tasa_politica', 'ar_badlar', 'ar_tamar', 'ar_pases_terceros'] },
  { id: 'fx', series: ['ar_tc_mayorista'] },
  // Observed year-on-year inflation and REM 12-month expectations share a unit (% per year);
  // monthly inflation (% per month) gets its own panel.
  { id: 'inflation', series: ['ar_inflacion_interanual', 'ar_inflacion_esperada'] },
  { id: 'inflationM', series: ['ar_inflacion_mensual'] },
  { id: 'treasury', series: ['us_t2y', 'us_t10y', 'us_fed_upper'] },
  { id: 'reserves', series: ['ar_reservas'] },
  { id: 'activity', series: ['ar_emae'] },
  { id: 'rer', series: ['ar_itcrm'] },
  { id: 'money', series: ['ar_base_monetaria'] },
];
const DEFAULT_ON = ['rates', 'fx', 'inflation', 'treasury', 'reserves', 'activity'];
const ALL_IDS = GROUPS.flatMap((g) => g.series);

export function ArgentinaView({ focusDate, focusEpisode, onFocus }: { focusDate: string | null; focusEpisode?: string | null; onFocus: (date: string | null, episode?: string | null) => void }) {
  const { t, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const { files, errors, loading } = useSeries([...ALL_IDS, 'us_ipc']);
  const [on, setOn] = useState<string[]>(DEFAULT_ON);
  const [win, setWin] = useState<WindowKey>(focusDate ? '6m' : '5y');
  const [transform, setTransform] = useState<Transform>('level');
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [episodeId, setEpisodeId] = useState<string | null>(focusEpisode && EPISODES.some((e) => e.id === focusEpisode) ? focusEpisode : null);

  const loaded = Object.values(files);
  const last = loaded.reduce((a, f) => (f.status.lastObservation && f.status.lastObservation > a ? f.status.lastObservation : a), '2016-01-01');
  const first = '2016-01-01';
  const episode = EPISODES.find((e) => e.id === episodeId) ?? null;
  const center = episode?.date ?? focusDate;
  const range = custom ?? windowRange(win, last, first, center);

  const panels = useMemo<TimePanel[]>(() => {
    const out: TimePanel[] = [];
    for (const g of GROUPS) {
      if (!on.includes(g.id)) continue;
      const fs = g.series.map((id) => files[id]).filter((f): f is SeriesFile => !!f);
      if (!fs.length) continue;
      const kind = fs[0]!.meta.unitKind;
      const lines = fs.map((f, k) => {
        const tr = transformSeries(f.data, f.meta.unitKind, f.meta.frequency, transform, range.from);
        return { id: f.meta.id, label: L(f.meta.name), color: colorOf(f.meta.id, k), data: tr.data, dash: f.meta.id === 'ar_inflacion_esperada' || f.meta.id === 'us_fed_upper', applied: tr.applied };
      });
      const applied = lines[0]!.applied;
      const unit = applied === 'yoy' ? t('obs.unit.yoy') : applied === 'index' ? t('obs.unit.index') : applied === 'diff' ? (kind.startsWith('rate') || kind === 'pct' ? t('obs.unit.pp') : L(fs[0]!.meta.unit)) : L(fs[0]!.meta.unit);
      out.push({ id: g.id, title: t(`obs.group.${g.id}`), unit, lines, fmt: applied === 'level' ? FMT[kind] : 'n1' });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, on, transform, range.from, lang]);

  const markers = EPISODES.map((e) => ({ id: e.id, date: e.date, label: `${e.date} · ${L(e.title)}`, active: e.id === episodeId }));
  const select = (id: string | null) => {
    setEpisodeId(id);
    setCustom(null);
    if (id) {
      if (win === 'all' || win === '5y') setWin('6m');
      onFocus(EPISODES.find((e) => e.id === id)!.date, id);
    } else onFocus(null, null);
  };
  const shown = GROUPS.filter((g) => on.includes(g.id)).flatMap((g) => g.series.map((id) => files[id])).filter((f): f is SeriesFile => !!f);

  return (
    <div className="obs-view">
      <div className="card obs-controls">
        <div className="obs-control-row">
          <span className="kicker">{t('obs.variables')}</span>
          <div className="chip-row">
            {GROUPS.map((g) => (
              <button key={g.id} className="toggle-chip" aria-pressed={on.includes(g.id)} onClick={() => setOn((s) => (s.includes(g.id) ? s.filter((x) => x !== g.id) : [...s, g.id]))}>
                {t(`obs.group.${g.id}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="obs-control-row">
          <span className="kicker">{t('obs.view')}</span>
          <div className="segmented compact" role="group" aria-label={t('obs.view')}>
            {(['level', 'yoy', 'index', 'diff'] as Transform[]).map((k) => (
              <button key={k} aria-pressed={transform === k} onClick={() => setTransform(k)} title={t(`obs.transform.${k}.hint`)}>
                {t(`obs.transform.${k}`)}
              </button>
            ))}
          </div>
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
            <input type="date" value={range.from} min={first} max={range.to} onChange={(e) => e.target.value && setCustom({ from: e.target.value, to: range.to })} />
          </label>
          <label className="inline-field">
            {t('obs.to')}
            <input type="date" value={range.to} min={range.from} max={last} onChange={(e) => e.target.value && setCustom({ from: range.from, to: e.target.value })} />
          </label>
        </div>
        <div className="obs-control-row">
          <span className="kicker">{t('obs.episode')}</span>
          <select className="select" value={episodeId ?? ''} onChange={(e) => select(e.target.value || null)} aria-label={t('obs.episode')}>
            <option value="">{t('obs.episode.none')}</option>
            {EPISODES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.date} · {L(e.title)}
              </option>
            ))}
          </select>
        </div>
        <p className="note">{t(`obs.transform.${transform}.hint`)} {t('obs.panels.note')}</p>
      </div>

      {loading && <p className="muted">{t('obs.loading')}</p>}
      {Object.keys(errors).length > 0 && (
        <div className="issue-box warning">
          <strong>{t('obs.missing')}</strong>
          {Object.keys(errors).join(', ')}
        </div>
      )}

      {panels.length > 0 && (
        <div className="card chart-card">
          <div className="card-head">
            <div>
              <h3>{t('obs.ar.chart')}</h3>
              <p>{t('obs.ar.chart.sub')}</p>
            </div>
          </div>
          <TimeChart
            from={range.from}
            to={range.to}
            panels={panels}
            markers={markers}
            band={episode ? { from: episode.date, to: range.to } : null}
            onMarker={(id) => select(id)}
            ariaLabel={t('obs.ar.chart')}
          />
        </div>
      )}

      {episode && <EpisodeDetail episode={episode} files={files} />}

      <UsComparison files={files} range={range} />

      {shown.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.meta.title')}</h3>
              <p>{t('obs.meta.sub')}</p>
            </div>
          </div>
          <SeriesMetaTable files={shown} today={today()} />
        </div>
      )}
    </div>
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
    { id: 'ar', title: t('obs.cmp.ar'), unit: t('obs.cmp.unit.ars'), lines: ar.map((f, k) => ({ id: f.meta.id, label: L(f.meta.name), color: colorOf(f.meta.id, k) })).map((l, k) => ({ ...l, data: ar[k]!.data })), fmt: 'n1' },
    { id: 'us', title: t('obs.cmp.us'), unit: t('obs.cmp.unit.usd'), lines: us.map((f, k) => ({ id: f.meta.id, label: L(f.meta.name), color: colorOf(f.meta.id, k), data: f.data, dash: f.meta.id === 'us_fed_upper' })), fmt: 'n2' },
    {
      id: 'dep',
      title: t('obs.cmp.dep'),
      unit: t('obs.unit.yoy'),
      lines: [
        { id: 'dep', label: t('obs.cmp.dep'), color: colorOf('ar_tc_mayorista'), data: dep },
        ...(inflAr ? [{ id: 'infl', label: L(inflAr.meta.name), color: colorOf('ar_inflacion_interanual'), data: inflAr.data, dash: true }] : []),
      ],
      fmt: 'n1',
    },
  ];
  return (
    <div className="card chart-card">
      <div className="card-head">
        <div>
          <h3>{t('obs.cmp.title')}</h3>
          <p>{t('obs.cmp.sub')}</p>
        </div>
      </div>
      <div className="issue-box warning">
        <strong>{t('obs.cmp.warn.title')}</strong>
        {t('obs.cmp.warn')}
      </div>
      <TimeChart from={range.from} to={range.to} panels={panels} ariaLabel={t('obs.cmp.title')} panelHeight={110} />
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
    </div>
  );
}
