import { useI18n } from '../../i18n';

/** Introductory screen: what the lab is, the eight modules and how to use them. */
export function HomeModule({ modules, letters, onOpen }: { modules: readonly string[]; letters: Record<string, string>; onOpen: (m: string) => void }) {
  const { t } = useI18n();
  return (
    <main className="main home">
      <section className="home-hero">
        <h2>{t('home.title')}</h2>
        <p>{t('home.lead')}</p>
        <button className="btn primary" onClick={() => onOpen('basic')}>
          {t('home.start')}
        </button>
      </section>

      <section aria-labelledby="home-modules">
        <h3 id="home-modules" className="home-h">
          {t('home.modules')}
        </h3>
        <ul className="home-grid">
          {modules.map((m) => (
            <li key={m}>
              <button className="home-card" onClick={() => onOpen(m)}>
                <span className="mod-letter">{letters[m]}</span>
                <span className="home-card-text">
                  <strong>{t(`mod.${m}`)}</strong>
                  <span>{t(`mod.${m}.desc`)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-how" aria-labelledby="home-how">
        <h3 id="home-how" className="home-h">
          {t('home.how.title')}
        </h3>
        <ol>
          <li>{t('home.how.1')}</li>
          <li>{t('home.how.2')}</li>
          <li>{t('home.how.3')}</li>
        </ol>
        <p className="muted">{t('home.modes')}</p>
      </section>
    </main>
  );
}
