import { useI18n } from '../i18n';
import { addDays, addMonths, isStale, type SeriesFile, type UnitKind } from '../data/core';
import type { SourceRef } from './episodes';

/** Number format (i18n code) adequate for each unit. */
export const FMT: Record<UnitKind, string> = {
  rate_tna: 'n1',
  rate_pct: 'n2',
  pct: 'n1',
  ars_per_usd: 'n1',
  index: 'n1',
  musd: 'n0',
  usd: 'n0',
  mars: 'n0',
  pct_labour: 'n1',
};

/** Stable colours: the same series keeps its colour across views (money market steel, demand copper…). */
export const SERIES_COLOR: Record<string, string> = {
  ar_tasa_politica: 'var(--series-lm)',
  ar_badlar: 'var(--series-4)',
  ar_tamar: 'var(--series-6)',
  ar_pases_terceros: 'var(--series-ref)',
  ar_tc_mayorista: 'var(--series-ext)',
  ar_itcrm: 'var(--series-5)',
  ar_reservas: 'var(--series-4)',
  ar_base_monetaria: 'var(--series-lm)',
  ar_m2: 'var(--series-6)',
  ar_inflacion_mensual: 'var(--series-supply)',
  ar_inflacion_interanual: 'var(--series-supply)',
  ar_inflacion_esperada: 'var(--series-ref)',
  ar_emae: 'var(--series-is)',
  ar_resultado_primario: 'var(--series-6)',
  us_t2y: 'var(--series-7)',
  us_t10y: 'var(--series-lm)',
  us_t3m: 'var(--series-ref)',
  us_fed_upper: 'var(--series-8)',
  ar_x: 'var(--series-ext)',
  ar_m: 'var(--series-is)',
  ar_saldo: 'var(--up)',
};

export const colorOf = (id: string, k = 0) => SERIES_COLOR[id] ?? ['var(--series-3)', 'var(--series-5)', 'var(--series-6)', 'var(--series-4)', 'var(--series-8)', 'var(--series-7)', 'var(--series-is)'][k % 7]!;

export type WindowKey = '1m' | '3m' | '6m' | '1y' | '5y' | 'all';
export const WINDOWS: WindowKey[] = ['1m', '3m', '6m', '1y', '5y', 'all'];

/** Interval of a window, centred on an event (half before, half after) or ending at the last date. */
export function windowRange(key: WindowKey, last: string, first: string, center?: string | null): { from: string; to: string } {
  if (key === 'all') return { from: first, to: last };
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, '5y': 60 }[key];
  if (center) {
    const from = addDays(addMonths(center, -Math.max(1, Math.round(months / 2))), 0);
    const to = addMonths(center, Math.max(1, Math.round(months / 2)));
    return { from: from < first ? first : from, to: to > last ? last : to };
  }
  return { from: addMonths(last, -months), to: last };
}

/** Days after an event used for the before/after evidence of each window. */
export const EVIDENCE_DAYS: Record<Exclude<WindowKey, 'all' | '5y'>, number> = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };

export function SourceList({ sources }: { sources: SourceRef[] }) {
  const { t, lang } = useI18n();
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <ul className="source-list">
      {sources.map((s) => (
        <li key={s.url}>
          <span className={`src-kind src-${s.kind}`}>{t(`obs.src.${s.kind}`)}</span>
          <a href={s.url} target="_blank" rel="noreferrer">
            {s.title}
          </a>
          <span className="muted">
            {' '}
            — {s.publisher}
            {s.date ? `, ${df.format(new Date(`${s.date}T00:00:00Z`))}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Metadata of the series shown in a view: what each line is, where it comes from and how fresh it is. */
export function SeriesMetaTable({ files, today }: { files: SeriesFile[]; today: string }) {
  const { t, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  return (
    <div className="table-wrap">
      <table className="data meta-table">
        <thead>
          <tr>
            <th>{t('obs.meta.series')}</th>
            <th>{t('obs.meta.unit')}</th>
            <th>{t('obs.meta.freq')}</th>
            <th>{t('obs.meta.coverage')}</th>
            <th>{t('obs.meta.source')}</th>
            <th>{t('obs.meta.status')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => {
            const stale = f.status.state === 'fallback' || isStale(f.status.lastObservation, f.meta.frequency, today);
            return (
              <tr key={f.meta.id}>
                <td>
                  <details className="meta-details">
                    <summary>
                      {L(f.meta.name)} {!f.meta.original && <span className="tag-derived">{t('obs.meta.derived')}</span>}
                    </summary>
                    <p>{L(f.meta.definition)}</p>
                    <p className="muted small">{L(f.meta.methodology)}</p>
                    {f.meta.derivation && (
                      <p className="small">
                        <b>{t('obs.meta.derivation')}:</b> {L(f.meta.derivation)}
                      </p>
                    )}
                    <p className="muted small">
                      {t('obs.meta.channel')}: {f.meta.source.channel} · {t('obs.meta.id')}: <code>{f.meta.source.seriesId}</code>
                    </p>
                  </details>
                </td>
                <td>{L(f.meta.unit)}</td>
                <td>{t(`obs.freq.${f.meta.frequency}`)}</td>
                <td className="num">
                  {f.status.firstObservation} → {f.status.lastObservation}
                </td>
                <td>
                  <a href={f.meta.source.docUrl} target="_blank" rel="noreferrer">
                    {f.meta.source.org}
                  </a>
                </td>
                <td>
                  <span className={`state state-${stale ? 'stale' : 'fresh'}`}>{t(stale ? (f.status.state === 'fallback' ? 'obs.state.fallback' : 'obs.state.stale') : 'obs.state.fresh')}</span>
                  <div className="muted small">
                    {t('obs.meta.fetched')}: {f.status.fetchedAt.slice(0, 10)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
