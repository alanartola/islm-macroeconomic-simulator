import { advEn, advEs } from './advanced';
import { uiEn, uiEs } from './ui';

/** Per-module dictionaries; each module file defines Spanish (primary) and English with identical keys. */
export const MODULE_PAIRS: { name: string; es: Record<string, string>; en: Record<string, string> }[] = [
  { name: 'ui', es: uiEs, en: uiEn },
  { name: 'advanced', es: advEs, en: advEn },
];

export const MODULE_DICTS = {
  es: Object.assign({}, ...MODULE_PAIRS.map((p) => p.es)) as Record<string, string>,
  en: Object.assign({}, ...MODULE_PAIRS.map((p) => p.en)) as Record<string, string>,
};
