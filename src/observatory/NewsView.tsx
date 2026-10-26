import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { loadManifest, loadNews, useResource, useSeries } from '../data/client';
import { isStale, type SeriesFile } from '../data/core';
import { EPISODES, TRADE_EVENTS } from './episodes';
import { SeriesMetaTable, today } from './shared';

export interface NewsRow {
  key: string;
  title: string;
  outlet: string;
  date: string;
  url: string;
  topics: string[];
  country: 'AR' | 'INT';
  /** Curated: linked to a documented episode. Automatic: GDELT feed, no verified link. */
  origin: 'curated' | 'official' | 'auto';
  episodeId?: string;
  episodeTitle?: { es: string; en: string };
}

/** Curated news and official notices, taken from the sources of the documented episodes. */
export function curatedNews(): NewsRow[] {
  const rows: NewsRow[] = [];
  for (const e of [...EPISODES, ...TRADE_EVENTS]) {
    for (const s of e.sources) {
      if (!s.date) continue;
      rows.push({
        key: `${e.id}|${s.url}`,
        title: s.title,
        outlet: s.publisher,
        date: s.date,
        url: s.url,
        topics: e.topics,
        country: e.topics.includes('international') && s.kind === 'news' && !/Argentin/i.test(s.title) ? 'INT' : 'AR',
        origin: s.kind === 'news' || s.kind === 'analysis' ? 'curated' : 'official',
        episodeId: e.id,
        episodeTitle: e.title,
      });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

const TOPICS = ['monetary', 'fiscal', 'fx', 'prices', 'external', 'activity', 'international'];

export function NewsView({ onOpenDate }: { onOpenDate: (date: string, episodeId?: string) => void }) {
  const { t, lang } = useI18n();
  const auto = useResource(loadNews, 'news');
  const [country, setCountry] = useState<'all' | 'AR' | 'INT'>('all');
  const [topic, setTopic] = useState('all');
  const [origin, setOrigin] = useState<'all' | 'curated' | 'official' | 'auto'>('all');
  const [from, setFrom] = useState('2018-01-01');
  const [to, setTo] = useState(today());
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const autoRows: NewsRow[] = (auto.data?.items ?? []).map((n) => ({ key: n.url, title: n.title, outlet: n.domain, date: n.date, url: n.url, topics: [n.topic], country: n.country === 'AR' ? 'AR' : 'INT', origin: 'auto' }));
    return [...curatedNews(), ...autoRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [auto.data]);
  const list = rows.filter(
    (r) =>
      (country === 'all' || r.country === country) &&
      (topic === 'all' || r.topics.includes(topic)) &&
      (origin === 'all' || r.origin === origin) &&
      r.date >= from &&
      r.date <= to &&
      (!q || `${r.title} ${r.outlet}`.toLowerCase().includes(q.toLowerCase())),
  );
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="obs-view">
      <div className="card obs-controls">
        <div className="obs-control-row">
          <label className="inline-field">
            {t('obs.news.country')}
            <select className="select" value={country} onChange={(e) => setCountry(e.target.value as typeof country)}>
              <option value="all">{t('obs.news.all')}</option>
              <option value="AR">Argentina</option>
              <option value="INT">{t('obs.news.int')}</option>
            </select>
          </label>
          <label className="inline-field">
            {t('obs.news.topic')}
            <select className="select" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">{t('obs.news.all')}</option>
              {TOPICS.map((k) => (
                <option key={k} value={k}>
                  {t(`obs.topic.${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            {t('obs.news.origin')}
            <select className="select" value={origin} onChange={(e) => setOrigin(e.target.value as typeof origin)}>
              <option value="all">{t('obs.news.all')}</option>
              <option value="official">{t('obs.news.official')}</option>
              <option value="curated">{t('obs.news.curated')}</option>
              <option value="auto">{t('obs.news.auto')}</option>
            </select>
          </label>
          <label className="inline-field">
            {t('obs.from')}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="inline-field">
            {t('obs.to')}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <input className="text-input news-search" type="search" placeholder={t('obs.news.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('obs.news.search')} />
        </div>
        <p className="note">{t('obs.news.note')}</p>
        {auto.data && auto.data.items.length === 0 && <p className="muted small">{t('obs.news.autoEmpty')}</p>}
      </div>

      <p className="muted small">{t('obs.news.count', { n: list.length })}</p>
      <ol className="news-list">
        {list.map((r) => (
          <li key={r.key} className="news-item">
            <div className="news-meta">
              <span className={`src-kind src-${r.origin === 'official' ? 'official' : r.origin === 'auto' ? 'auto' : 'news'}`}>{t(`obs.news.${r.origin}`)}</span>
              <span>{df.format(new Date(`${r.date}T00:00:00Z`))}</span>
              <span>· {r.outlet}</span>
              <span>· {r.country === 'AR' ? 'Argentina' : t('obs.news.int')}</span>
              <span>· {r.topics.map((k) => t(`obs.topic.${k}`)).join(', ')}</span>
            </div>
            <a className="news-title" href={r.url} target="_blank" rel="noreferrer">
              {r.title}
            </a>
            <div className="news-rel">
              {r.episodeTitle ? (
                <span>
                  {t('obs.news.related')}: <b>{r.episodeTitle[lang === 'es' ? 'es' : 'en']}</b>
                </span>
              ) : (
                <span className="muted">{t('obs.news.unlinked')}</span>
              )}
              <button className="btn link small" onClick={() => onOpenDate(r.date, r.episodeId)}>
                {t('obs.news.openData')}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ALL_SERIES = [
  'ar_tasa_politica', 'ar_badlar', 'ar_tamar', 'ar_pases_terceros', 'ar_tc_mayorista', 'ar_itcrm', 'ar_reservas', 'ar_base_monetaria', 'ar_m2',
  'ar_inflacion_mensual', 'ar_inflacion_interanual', 'ar_inflacion_esperada', 'ar_ipc', 'ar_emae', 'ar_emae_original', 'ar_desocupacion', 'ar_resultado_primario', 'ar_pib_crecimiento',
  'ar_x', 'ar_m', 'ar_saldo', 'ar_x_pp', 'ar_x_moa', 'ar_x_moi', 'ar_x_cye', 'ar_m_bk', 'ar_m_bk_pya', 'ar_m_bi', 'ar_m_cyl', 'ar_m_pya', 'ar_m_bc', 'ar_m_vap', 'ar_m_resto',
  'ar_x_brasil', 'ar_x_china', 'ar_x_eeuu', 'ar_x_chile', 'ar_x_india', 'ar_m_brasil', 'ar_m_eeuu', 'ar_m_india', 'ar_saldo_eeuu',
  'us_t3m', 'us_t2y', 'us_t10y', 'us_fed_upper', 'us_fed_lower', 'us_ipc', 'us_desempleo', 'us_pib_crecimiento',
];

/** Every series, its metadata and freshness; how and how often the data are refreshed. */
export function SourcesView() {
  const { t, lang } = useI18n();
  const manifest = useResource(loadManifest, 'manifest');
  const { files } = useSeries(ALL_SERIES);
  const list = ALL_SERIES.map((id) => files[id]).filter((s): s is SeriesFile => !!s);
  const stale = list.filter((s) => s.status.state !== 'fresh' && isStale(s.status.lastObservation, s.meta.frequency, today()));
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { dateStyle: 'long', timeStyle: 'short' });
  return (
    <div className="obs-view">
      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.src.update')}</h3>
              <p>{manifest.data ? t('obs.src.generated', { d: df.format(new Date(manifest.data.generatedAt)) }) : t('obs.loading')}</p>
            </div>
          </div>
          <ol className="steps-list">
            {['1', '2', '3', '4', '5', '6'].map((k) => (
              <li key={k}>{t(`obs.src.step.${k}`)}</li>
            ))}
          </ol>
          <div className="table-wrap">
            <table className="data compact">
              <tbody>
                {['D', 'M', 'Q', 'A', 'news'].map((k) => (
                  <tr key={k}>
                    <td>{t(`obs.src.freq.${k}`)}</td>
                    <td>{t(`obs.src.freq.${k}.d`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.src.theory')}</h3>
              <p>{t('obs.src.theory.sub')}</p>
            </div>
          </div>
          {['models', 'data', 'link'].map((k) => (
            <div key={k} className="theory-block">
              <h4>{t(`obs.src.theory.${k}`)}</h4>
              <p>{t(`obs.src.theory.${k}.d`)}</p>
            </div>
          ))}
          <h4>{t('obs.src.limits')}</h4>
          <ul>
            {['revisions', 'official', 'policy', 'gaps', 'derived', 'country'].map((k) => (
              <li key={k}>{t(`obs.src.limits.${k}`)}</li>
            ))}
          </ul>
        </div>
      </div>
      {stale.length > 0 && (
        <div className="issue-box warning">
          <strong>{t('obs.src.staleTitle')}</strong>
          {stale.map((s) => `${s.meta.name[lang === 'es' ? 'es' : 'en']} (${s.status.lastObservation})`).join(' · ')}
        </div>
      )}
      <div className="card">
        <div className="card-head">
          <div>
            <h3>{t('obs.src.catalog')}</h3>
            <p>{t('obs.src.catalog.sub', { n: list.length })}</p>
          </div>
        </div>
        <SeriesMetaTable files={list} today={today()} />
      </div>
    </div>
  );
}
