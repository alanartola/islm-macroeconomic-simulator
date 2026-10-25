import { en } from './en';
import { es } from './es';
import { formatAs, formatNumber } from './format';
import { makeI18n } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)(?:\|(\w+))?\}/g)].map((m) => m[0]).sort();

describe('translations', () => {
  it('English and Spanish define exactly the same keys', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it('every Spanish string uses the same placeholders (and formats) as English', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(es[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('no translation is empty', () => {
    for (const [k, v] of [...Object.entries(en), ...Object.entries(es)]) expect(v.trim(), k).not.toBe('');
  });

  it('falls back to the key for unknown entries instead of throwing', () => {
    expect(makeI18n('es').t('does.not.exist')).toBe('does.not.exist');
  });
});

describe('number formatting', () => {
  it('formats according to locale conventions', () => {
    expect(formatNumber('en', 1900, 1)).toBe('1,900.0');
    expect(formatNumber('es', 1900, 1)).toBe('1.900,0');
    expect(formatAs('en', 5, 'rate')).toBe('5.00%');
    expect(formatAs('es', 5, 'rate')).toBe('5,00%');
  });

  it('never prints negative zero or non-finite values', () => {
    expect(formatAs('en', -0.00001, 'sbn')).toBe('0.0 bn');
    expect(formatAs('en', -0, 'n2')).toBe('0.00');
    expect(formatAs('en', NaN, 'n2')).toBe('—');
    expect(formatAs('en', Infinity, 'bn')).toBe('—');
  });

  it('signs changes explicitly', () => {
    expect(formatAs('en', 100, 'sbn')).toBe('+100.0 bn');
    expect(formatAs('en', -1, 'spp')).toBe('-1.00 pp');
  });
});
