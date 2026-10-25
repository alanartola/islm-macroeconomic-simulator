import { Suspense, lazy, useEffect, useMemo, useReducer, useState } from 'react';
import { I18nProvider, detectLang, makeI18n, type Lang } from './i18n';
import { Sidebar } from './components/Sidebar';
import { SimulatorView } from './components/SimulatorView';
import { TransmissionView } from './components/TransmissionView';
import { SensitivityView } from './components/SensitivityView';
import { ScenariosView } from './components/ScenariosView';
import { IssuesPanel } from './components/Results';
import { OVERLAY_COLORS } from './components/charts/colors';
import type { SavedOverlay } from './components/charts/ISLMChart';
import { initialState, reducer, type SimState } from './state/store';
import { runSimulation } from './state/simulation';
import { decodeShareHash, encodeShareHash, loadSavedScenarios, readPref, storeSavedScenarios, writePref } from './state/persistence';

const ModelView = lazy(() => import('./components/ModelView'));

type Tab = 'simulator' | 'transmission' | 'sensitivity' | 'scenarios' | 'model';
const TABS: Tab[] = ['simulator', 'transmission', 'sensitivity', 'scenarios', 'model'];
type Theme = 'light' | 'dark';

const REPO_URL = 'https://github.com/alanartola/islm-macroeconomic-simulator';

function init(): SimState {
  const base = initialState();
  const shared = typeof window !== 'undefined' ? decodeShareHash(window.location.hash) : null;
  return { ...base, ...(shared ?? {}), saved: loadSavedScenarios() };
}

function queryParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function detectTheme(): Theme {
  const q = queryParam('theme');
  if (q === 'light' || q === 'dark') return q;
  const stored = readPref('islm.theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function detectTab(): Tab {
  const q = queryParam('tab');
  return q && (TABS as string[]).includes(q) ? (q as Tab) : 'simulator';
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [lang, setLang] = useState<Lang>(detectLang);
  const [theme, setTheme] = useState<Theme>(detectTheme);
  const [tab, setTab] = useState<Tab>(detectTab);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useMemo(() => makeI18n(lang), [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => storeSavedScenarios(state.saved), [state.saved]);

  const { baseline, shocked, regime, target0, target1 } = state;
  const sim = useMemo(
    () => runSimulation({ baseline, shocked, regime, target0, target1 }),
    [baseline, shocked, regime, target0, target1],
  );
  const savedSims = useMemo(
    () =>
      state.saved.map((s, k) => ({
        id: s.id,
        name: s.name,
        sim: runSimulation(s),
        color: OVERLAY_COLORS[k % OVERLAY_COLORS.length] as string,
      })),
    [state.saved],
  );
  const overlays: SavedOverlay[] = savedSims.flatMap((s) => (s.sim.ok ? [{ id: s.id, name: s.name, color: s.color, e1: s.sim.e1 }] : []));

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${encodeShareHash(state)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.history.replaceState(null, '', url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    writePref('islm.theme', next);
  };
  const changeLang = (l: Lang) => {
    setLang(l);
    writePref('islm.lang', l);
  };
  const themeLabel = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');

  return (
    <I18nProvider lang={lang}>
      <div className="app">
        <header className="topbar">
          <button className="btn icon mobile-only" aria-label={t('btn.params')} onClick={() => setSidebarOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="brand">
            <h1>
              <span className="title-full">{t('app.title')}</span>
              <span className="title-short">{t('app.short')}</span>
            </h1>
            <p>{t('app.subtitle')}</p>
          </div>
          <div className="spacer" />
          <div className="toolbar">
            <button className="btn small hide-sm" onClick={share}>
              {copied ? t('btn.copied') : t('btn.share')}
            </button>
            <label className="sr-only" htmlFor="lang">
              {t('lang.label')}
            </label>
            <select id="lang" className="select" value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
            <button className="btn icon" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="3.2" fill="currentColor" />
                  <path
                    d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <div className="layout">
          {sidebarOpen && <div className="scrim mobile-only" onClick={() => setSidebarOpen(false)} />}
          <Sidebar state={state} dispatch={dispatch} sim={sim} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <main className="main">
            <nav className="tabs" role="tablist">
              {TABS.map((k) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                  {t(`nav.${k}`)}
                </button>
              ))}
            </nav>

            <IssuesPanel sim={sim} />

            {tab === 'model' ? (
              <Suspense fallback={<div className="card" style={{ padding: 20 }}>…</div>}>
                <ModelView e1={sim.e1} />
              </Suspense>
            ) : tab === 'scenarios' ? (
              <ScenariosView state={state} dispatch={dispatch} current={sim} savedSims={savedSims} />
            ) : sim.ok ? (
              tab === 'simulator' ? (
                <SimulatorView sim={sim} state={state} dispatch={dispatch} overlays={overlays} />
              ) : tab === 'transmission' ? (
                <TransmissionView sim={sim} />
              ) : (
                <SensitivityView sim={sim} />
              )
            ) : null}
          </main>
        </div>

        <footer className="footer">
          <span>{t('app.disclaimer')}</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t('app.source')}
          </a>
        </footer>
      </div>
    </I18nProvider>
  );
}
