import { useEffect, useMemo, useReducer, useState } from 'react';
import { DEFAULT_LANG, I18nProvider, detectLang, makeI18n, type Lang } from './i18n';
import { OVERLAY_COLORS } from './components/charts/colors';
import type { SavedOverlay } from './components/charts/ISLMChart';
import { initialState, reducer, type SimState } from './state/store';
import { runSimulation } from './state/simulation';
import { decodeShareHash, encodeShareHash, loadSavedScenarios, readPref, storeSavedScenarios, writePref } from './state/persistence';
import { ModeProvider, useMode } from './state/mode';
import { advReducer, initialAdvState, runAdvanced } from './state/advancedState';
import { BasicModule } from './modules/basic/BasicModule';
import { BASIC_TABS, type BasicTab } from './modules/basic/tabs';
import { AdvancedModule } from './modules/advanced/AdvancedModule';
import { ConstructionModule } from './modules/construction/ConstructionModule';
import { PolicyModule } from './modules/policy/PolicyModule';
import { OpenModule } from './modules/open/OpenModule';
import { ADASModule } from './modules/adas/ADASModule';
import { ISMPModule } from './modules/ismp/ISMPModule';
import { LabModule } from './modules/lab/LabModule';
import { HomeModule } from './modules/home/HomeModule';
import { LabProvider } from './state/lab';
import { getCurrentConfig } from './state/currentConfig';
import { MODULE_OF, decodeConfigHash, encodeConfigHash, type LabConfig } from './lab/scenario';

type Theme = 'light' | 'dark';
const DEFAULT_THEME: Theme = 'dark';

/** Laboratory modules, in navigation order. */
export const MODULES = ['basic', 'advanced', 'construction', 'policy', 'open', 'adas', 'ismp', 'lab'] as const;
/** Navigation letters A–H. */
const LETTER: Record<string, string> = { basic: 'A', advanced: 'B', construction: 'C', policy: 'D', open: 'E', adas: 'F', ismp: 'G', lab: 'H' };
/** Screens: the introductory home screen plus the lettered modules. */
export type ModuleId = 'home' | (typeof MODULES)[number];
const SCREENS: readonly string[] = ['home', ...MODULES];

const REPO_URL = 'https://github.com/alanartola/islm-macroeconomic-simulator';

/** Configuration carried by a "#x=" link (any module); read once at start-up. */
function linkedConfig(): LabConfig | null {
  return typeof window !== 'undefined' ? decodeConfigHash(window.location.hash) : null;
}

function init(): SimState {
  const base = initialState();
  const shared = typeof window !== 'undefined' ? decodeShareHash(window.location.hash) : null;
  const linked = linkedConfig();
  const fromLink =
    linked?.model === 'basic'
      ? { baseline: linked.baseline, shocked: linked.shocked, regime: linked.regime, target0: linked.target0, target1: linked.target1 }
      : {};
  return { ...base, ...(shared ?? {}), ...fromLink, saved: loadSavedScenarios() };
}

function initAdv() {
  const base = initialAdvState();
  const linked = linkedConfig();
  return linked?.model === 'advanced'
    ? advReducer(base, { type: 'hydrate', baseline: linked.baseline, shocked: linked.shocked, lm: linked.lm, regime: linked.regime, target0: linked.target0, target1: linked.target1 })
    : base;
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
  // Dark is the default for every visitor without an explicit choice (OS preference ignored).
  return DEFAULT_THEME;
}

function detectTab(): BasicTab {
  const q = queryParam('tab');
  return q && (BASIC_TABS as string[]).includes(q) ? (q as BasicTab) : 'simulator';
}

function detectModule(): ModuleId {
  const q = queryParam('m');
  if (q && SCREENS.includes(q)) return q as ModuleId;
  if (typeof window !== 'undefined' && window.location.hash.startsWith('#s=')) return 'basic';
  const linked = linkedConfig();
  if (linked) return MODULE_OF[linked.model] as ModuleId;
  const stored = readPref('islm.module');
  // First visit (no explicit choice): the introductory home screen.
  return stored && SCREENS.includes(stored) ? (stored as ModuleId) : 'home';
}

function ModeSwitch({ t }: { t: (k: string) => string }) {
  const { mode, setMode } = useMode();
  return (
    <div className="segmented compact" role="group" aria-label={t('mode.label')}>
      <button aria-pressed={mode === 'edu'} onClick={() => setMode('edu')} title={t('mode.edu.hint')}>
        {t('mode.edu')}
      </button>
      <button aria-pressed={mode === 'adv'} onClick={() => setMode('adv')} title={t('mode.adv.hint')}>
        {t('mode.adv')}
      </button>
    </div>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const [lang, setLang] = useState<Lang>(detectLang);
  const [theme, setTheme] = useState<Theme>(detectTheme);
  const [initialTab] = useState<BasicTab>(detectTab);
  const [module, setModuleState] = useState<ModuleId>(detectModule);
  const [adv, advDispatch] = useReducer(advReducer, undefined, initAdv);
  /** Configuration opened from the lab or a link, for modules that keep their own state (E, F, G). */
  const [opened, setOpened] = useState<{ cfg: LabConfig | null; nonce: number }>(() => ({ cfg: linkedConfig(), nonce: 0 }));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useMemo(() => makeI18n(lang), [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t('app.title');
  }, [lang, t]);
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
  const advSim = useMemo(() => runAdvanced(adv), [adv]);
  const setModule = (m: ModuleId) => {
    setModuleState(m);
    setSidebarOpen(false);
    writePref('islm.module', m);
    document.documentElement.scrollTop = 0;
  };
  const openConfig = (cfg: LabConfig) => {
    if (cfg.model === 'basic') {
      dispatch({ type: 'hydrate', state: { baseline: cfg.baseline, shocked: cfg.shocked, regime: cfg.regime, target0: cfg.target0, target1: cfg.target1 } });
    } else if (cfg.model === 'advanced') {
      advDispatch({ type: 'hydrate', baseline: cfg.baseline, shocked: cfg.shocked, lm: cfg.lm, regime: cfg.regime, target0: cfg.target0, target1: cfg.target1 });
    } else {
      setOpened((o) => ({ cfg, nonce: o.nonce + 1 }));
    }
    setModule(MODULE_OF[cfg.model] as ModuleId);
  };
  const initialFor = <M extends LabConfig['model']>(model: M) =>
    opened.cfg?.model === model ? (opened.cfg as Extract<LabConfig, { model: M }>) : undefined;
  const overlays: SavedOverlay[] = savedSims.flatMap((s) => (s.sim.ok ? [{ id: s.id, name: s.name, color: s.color, e1: s.sim.e1 }] : []));

  const share = async () => {
    // Links open in Spanish unless they were shared from the English interface.
    const params = new URLSearchParams();
    if (lang !== DEFAULT_LANG) params.set('lang', lang);
    if (module !== 'basic') params.set('m', module);
    const query = params.toString() ? `?${params}` : '';
    // Module A keeps its compact "#s=" link; B, C and D share the advanced configuration;
    // E, F and G share the configuration registered by the module on screen.
    const onScreen = getCurrentConfig();
    const hash =
      module === 'basic'
        ? encodeShareHash(state)
        : module === 'advanced' || module === 'construction' || module === 'policy'
          ? encodeConfigHash({ model: 'advanced', baseline: adv.baseline, shocked: adv.shocked, lm: adv.lm, regime: adv.regime, target0: adv.target0, target1: adv.target1 })
          : onScreen && MODULE_OF[onScreen.model] === module
            ? encodeConfigHash(onScreen)
            : '';
    const url = `${window.location.origin}${window.location.pathname}${query}${hash}`;
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
    // Keep the address consistent with the explicit choice so a reload does not revert it.
    try {
      const url = new URL(window.location.href);
      if (l === DEFAULT_LANG) url.searchParams.delete('lang');
      else url.searchParams.set('lang', l);
      window.history.replaceState(null, '', url);
    } catch {
      /* ignore */
    }
  };
  const themeLabel = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');

  return (
    <I18nProvider lang={lang}>
      <ModeProvider>
      <LabProvider>
      <div className="app">
        <header className="topbar">
          <button className="btn icon mobile-only" aria-label={t('btn.params')} onClick={() => setSidebarOpen(true)} hidden={module === 'home' || module === 'lab'}>
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
            <span className="hide-sm">
              <ModeSwitch t={t} />
            </span>
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

        <nav className="module-nav" aria-label={t('nav.modules')}>
          <button aria-current={module === 'home' ? 'page' : undefined} onClick={() => setModule('home')}>
            {t('mod.home')}
          </button>
          {MODULES.map((m) => (
            <button
              key={m}
              aria-current={module === m ? 'page' : undefined}
              onClick={() => setModule(m)}
              aria-label={`${LETTER[m]} ${t(`mod.${m}`)}`}
              title={`${t(`mod.${m}`)}: ${t(`mod.${m}.desc`)}`}
            >
              <span className="mod-letter">{LETTER[m]}</span> {t(`nav.short.${m}`)}
            </button>
          ))}
        </nav>

        {module === 'basic' && (
          <BasicModule
            state={state}
            dispatch={dispatch}
            sim={sim}
            savedSims={savedSims}
            overlays={overlays}
            initialTab={initialTab}
            sidebarOpen={sidebarOpen}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        )}
        {module === 'advanced' && (
          <AdvancedModule state={adv} dispatch={advDispatch} sim={advSim} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />
        )}
        {module === 'adas' && <ADASModule key={opened.nonce} initial={initialFor('adas')} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />}
        {module === 'ismp' && <ISMPModule key={opened.nonce} initial={initialFor('ismp')} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />}
        {module === 'open' && <OpenModule key={opened.nonce} initial={initialFor('open')} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />}
        {module === 'lab' && <LabModule onOpen={openConfig} />}
        {module === 'home' && <HomeModule modules={MODULES} letters={LETTER} onOpen={(m) => setModule(m as ModuleId)} />}
        {module === 'policy' && <PolicyModule state={adv} dispatch={advDispatch} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />}
        {module === 'construction' && (
          <ConstructionModule state={adv} dispatch={advDispatch} sim={advSim} sidebarOpen={sidebarOpen} onCloseSidebar={() => setSidebarOpen(false)} />
        )}

        <footer className="footer">
          <span>{t('app.disclaimer')}</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {t('app.source')}
          </a>
        </footer>
      </div>
      </LabProvider>
      </ModeProvider>
    </I18nProvider>
  );
}
