import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { en, type TranslationKey } from './en';
import { es } from './es';
import { MODULE_DICTS } from './modules';
import { formatAs, interpolate, type Lang, type TemplateVar } from './format';

export type { Lang, TemplateVar, TranslationKey };

const DICTS: Record<Lang, Record<string, string>> = {
  en: { ...en, ...MODULE_DICTS.en },
  es: { ...es, ...MODULE_DICTS.es },
};

export interface I18n {
  lang: Lang;
  /** Translates a key, interpolating `{name|fmt}` placeholders. Falls back to English, then to the key. */
  t: (key: string, vars?: Record<string, TemplateVar>) => string;
  /** Formats a number with one of the formats documented in format.ts. */
  f: (x: number, fmt?: string) => string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function makeI18n(lang: Lang): I18n {
  const dict = DICTS[lang];
  const raw = (key: string) => dict[key] ?? DICTS.en[key] ?? key;
  const t = (key: string, vars?: Record<string, TemplateVar>) => interpolate(lang, raw(key), vars, raw);
  return { lang, t, f: (x, fmt = 'n2') => formatAs(lang, x, fmt) };
}

const I18nContext = createContext<I18n>(makeI18n('en'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18n {
  return useContext(I18nContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT() {
  const { t } = useI18n();
  return useCallback((key: TranslationKey, vars?: Record<string, TemplateVar>) => t(key, vars), [t]);
}

export const DEFAULT_LANG: Lang = 'es';

/**
 * Initial interface language. Spanish is the default for every visitor; English
 * is used only when explicitly requested, either by the link (`?lang=en`) or by
 * a choice the user made earlier with the language selector (stored locally).
 * The browser language is deliberately ignored.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function detectLang(search: string = typeof window !== 'undefined' ? window.location.search : ''): Lang {
  try {
    const q = new URLSearchParams(search).get('lang');
    if (q === 'en' || q === 'es') return q;
  } catch {
    /* malformed query: ignore */
  }
  try {
    const stored = localStorage.getItem('islm.lang');
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    /* storage unavailable: ignore */
  }
  return DEFAULT_LANG;
}
