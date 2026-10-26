import { useState } from 'react';
import { useI18n } from '../i18n';
import { ArgentinaView } from './ArgentinaView';
import { HistoryView } from './HistoryView';
import { TradeView } from './TradeView';
import { NewsView, SourcesView } from './NewsView';

export const OBS_TABS = ['argentina', 'history', 'trade', 'news', 'sources'] as const;
export type ObsTab = (typeof OBS_TABS)[number];

/**
 * Macroeconomic observatory: official series of Argentina (and the United
 * States as reference), documented episodes, foreign trade and news. It shows
 * published data; the theoretical modules are simulations under assumptions.
 */
export function ObservatoryModule({ initialTab = 'argentina', initialFocus }: { initialTab?: ObsTab; initialFocus?: { date: string; episode?: string } | null }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<ObsTab>(initialTab);
  const [focus, setFocus] = useState<{ date: string | null; episode: string | null; nonce: number }>({ date: initialFocus?.date ?? null, episode: initialFocus?.episode ?? null, nonce: 0 });
  const openDate = (date: string, episode?: string | null) => {
    setFocus((f) => ({ date, episode: episode ?? null, nonce: f.nonce + 1 }));
    setTab('argentina');
    document.documentElement.scrollTop = 0;
  };
  return (
    <main className="main obs-main">
      <div className="module-intro">
        <div>
          <span className="kicker">{t('obs.kicker')}</span>
          <h2>{t('obs.title')}</h2>
          <p>{t('obs.desc')}</p>
        </div>
      </div>
      <p className="note evidence-note">{t('obs.evidenceNote')}</p>
      <nav className="tabs" role="tablist" aria-label={t('obs.title')}>
        {OBS_TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {t(`obs.tab.${k}`)}
          </button>
        ))}
      </nav>
      {tab === 'argentina' && <ArgentinaView key={focus.nonce} focusDate={focus.date} focusEpisode={focus.episode} onFocus={(d, e) => setFocus((f) => ({ ...f, date: d, episode: e ?? null }))} />}
      {tab === 'history' && <HistoryView onOpenChart={(d, id) => openDate(d, id)} />}
      {tab === 'trade' && <TradeView />}
      {tab === 'news' && <NewsView onOpenDate={openDate} />}
      {tab === 'sources' && <SourcesView />}
    </main>
  );
}
