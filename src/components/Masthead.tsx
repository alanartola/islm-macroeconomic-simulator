import { Fragment, useEffect, useRef, useState } from 'react';
import type { Lang } from '../i18n';
import { useMode } from '../state/mode';
import { GROUPS, LETTER, type LabModuleId } from '../modules/catalog';

type Screen = 'home' | LabModuleId;
type T = (k: string, v?: Record<string, string | number>) => string;

function ModeSwitch({ t }: { t: T }) {
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

interface Props {
  t: T;
  module: Screen;
  onModule: (m: Screen) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onShare: () => void;
  copied: boolean;
  /** Opens the parameter drawer on narrow screens (modules with a parameter panel). */
  onOpenParams: () => void;
}

/**
 * Masthead: wordmark, interface preferences and the section navigation.
 * Wide screens show the modules as text sections separated by theme; narrow
 * screens replace them with a module switcher and a parameters button.
 */
export function Masthead({ t, module, onModule, lang, onLang, theme, onToggleTheme, onShare, copied, onOpenParams }: Props) {
  const [sheet, setSheet] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [kicker, title] = t('app.title').split('|').map((s) => s.trim());
  const themeLabel = theme === 'dark' ? t('theme.toLight') : t('theme.toDark');
  const hasPanel = module !== 'home' && module !== 'lab';

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(false);
    const onDown = (e: PointerEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setSheet(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [sheet]);

  const go = (m: Screen) => {
    setSheet(false);
    onModule(m);
  };
  const currentLabel = module === 'home' ? t('mod.home') : `${LETTER[module]} · ${t(`mod.${module}`)}`;

  return (
    <div className="masthead">
      <header className="topbar">
        <div className="brand">
          <h1>
            <button className="wordmark" onClick={() => go('home')} title={t('mod.home')}>
              <span className="wm-kicker">{kicker}</span>
              <span className="wm-title">
                <span className="title-full">{title ?? kicker}</span>
                <span className="title-short">{t('app.short')}</span>
              </span>
            </button>
          </h1>
        </div>
        <div className="spacer" />
        <div className="toolbar">
          <span className="hide-sm">
            <ModeSwitch t={t} />
          </span>
          <span className="tool-sep hide-sm" aria-hidden="true" />
          <button className="btn link small hide-sm" onClick={onShare}>
            {copied ? t('btn.copied') : t('btn.share')}
          </button>
          <label className="sr-only" htmlFor="lang">
            {t('lang.label')}
          </label>
          <select id="lang" className="select" value={lang} onChange={(e) => onLang(e.target.value as Lang)}>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>
          <button className="btn icon" onClick={onToggleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <nav className="module-nav" aria-label={t('nav.modules')}>
        <button aria-current={module === 'home' ? 'page' : undefined} onClick={() => go('home')}>
          {t('mod.home')}
        </button>
        {GROUPS.map((g) => (
          <Fragment key={g.id}>
            <span className="nav-sep" aria-hidden="true" title={t(`group.${g.id}`)} />
            {g.modules.map((m) => (
              <button
                key={m}
                aria-current={module === m ? 'page' : undefined}
                onClick={() => go(m)}
                aria-label={`${LETTER[m]} ${t(`mod.${m}`)}`}
                title={`${t(`mod.${m}`)}: ${t(`mod.${m}.desc`)}`}
              >
                <span className="mod-letter">{LETTER[m]}</span> {t(`nav.short.${m}`)}
              </button>
            ))}
          </Fragment>
        ))}
      </nav>

      <div className="section-bar" ref={sheetRef}>
        {hasPanel && (
          <button className="params-btn" onClick={onOpenParams}>
            {t('btn.params')}
          </button>
        )}
        <button className="section-switch" aria-expanded={sheet} aria-haspopup="true" onClick={() => setSheet((s) => !s)}>
          <span className="kicker">{t('nav.switch')}</span>
          <span className="current">{currentLabel}</span>
          <span className="caret" aria-hidden="true">
            {sheet ? '−' : '+'}
          </span>
        </button>
        {sheet && (
          <div className="section-sheet" role="menu" aria-label={t('nav.modules')}>
            <button role="menuitem" aria-current={module === 'home' ? 'page' : undefined} onClick={() => go('home')}>
              {t('mod.home')}
            </button>
            {GROUPS.map((g) => (
              <div className="sheet-group" key={g.id}>
                <div className="kicker">{t(`group.${g.id}`)}</div>
                {g.modules.map((m) => (
                  <button role="menuitem" key={m} aria-current={module === m ? 'page' : undefined} onClick={() => go(m)}>
                    <span className="mod-letter">{LETTER[m]}</span>
                    {t(`mod.${m}`)}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

