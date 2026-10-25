export type Lang = 'en' | 'es';

/** A template variable: a number (formatted by the placeholder) or a translation key. */
export type TemplateVar = number | string | { key: string };

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-ES' };

const cache = new Map<string, Intl.NumberFormat>();
function nf(lang: Lang, digits: number, signed = false): Intl.NumberFormat {
  const id = `${lang}|${digits}|${signed}`;
  let f = cache.get(id);
  if (!f) {
    f = new Intl.NumberFormat(LOCALES[lang], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? 'exceptZero' : 'auto',
      useGrouping: true,
    });
    cache.set(id, f);
  }
  return f;
}

/** Normalises −0 and tiny rounding noise so that "−0.0" is never displayed. */
function clean(x: number, digits: number): number {
  const r = Number(x.toFixed(digits));
  return Object.is(r, -0) || Math.abs(r) < 10 ** -(digits + 1) ? 0 : r;
}

export function formatNumber(lang: Lang, x: number, digits = 2, signed = false): string {
  if (!Number.isFinite(x)) return '—';
  return nf(lang, digits, signed).format(clean(x, digits));
}

/**
 * Number formats used across the UI:
 *  bn / sbn   billions, 1 decimal (signed)
 *  rate       interest rate level, 2 decimals + "%"
 *  pp / spp   interest-rate change in percentage points (signed)
 *  pct / spct percentage change, 1 decimal (signed)
 *  n0..n4 / sn2  plain numbers with the given decimals (signed)
 */
export function formatAs(lang: Lang, x: number, fmt: string): string {
  if (!Number.isFinite(x)) return '—';
  const bn = lang === 'es' ? 'mm' : 'bn';
  switch (fmt) {
    case 'bn':
      return `${formatNumber(lang, x, 1)} ${bn}`;
    case 'sbn':
      return `${formatNumber(lang, x, 1, true)} ${bn}`;
    case 'abn':
      return `${formatNumber(lang, Math.abs(x), 1)} ${bn}`;
    case 'rate':
      return `${formatNumber(lang, x, 2)}%`;
    case 'pp':
      return `${formatNumber(lang, x, 2)} pp`;
    case 'app':
      return `${formatNumber(lang, Math.abs(x), 2)} pp`;
    case 'spp':
      return `${formatNumber(lang, x, 2, true)} pp`;
    case 'pct':
      return `${formatNumber(lang, x, 1)}%`;
    case 'spct':
      return `${formatNumber(lang, x, 1, true)}%`;
    case 'n0':
      return formatNumber(lang, x, 0);
    case 'n1':
      return formatNumber(lang, x, 1);
    case 'n3':
      return formatNumber(lang, x, 3);
    case 'n4':
      return formatNumber(lang, x, 4);
    case 'sn2':
      return formatNumber(lang, x, 2, true);
    case 'n2':
    default:
      return formatNumber(lang, x, 2);
  }
}

const PLACEHOLDER = /\{(\w+)(?:\|(\w+))?\}/g;

/** Interpolates `{name}` / `{name|fmt}` placeholders. Unknown names are left visible. */
export function interpolate(
  lang: Lang,
  template: string,
  vars: Record<string, TemplateVar> | undefined,
  translate: (key: string) => string,
): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (whole, name: string, fmt: string | undefined) => {
    const v = vars[name];
    if (v === undefined) return whole;
    if (typeof v === 'number') return formatAs(lang, v, fmt ?? 'n2');
    if (typeof v === 'string') return v;
    return translate(v.key);
  });
}
