import { advEn, advEs } from './advanced';
import { uiEn, uiEs } from './ui';
import { conEn, conEs } from './construction';
import { polEn, polEs } from './policy';
import { openEn, openEs } from './open';
import { adasEn, adasEs } from './adas';
import { ismpEn, ismpEs } from './ismp';

/** Per-module dictionaries; each module file defines Spanish (primary) and English with identical keys. */
export const MODULE_PAIRS: { name: string; es: Record<string, string>; en: Record<string, string> }[] = [
  { name: 'ui', es: uiEs, en: uiEn },
  { name: 'advanced', es: advEs, en: advEn },
  { name: 'construction', es: conEs, en: conEn },
  { name: 'policy', es: polEs, en: polEn },
  { name: 'open', es: openEs, en: openEn },
  { name: 'adas', es: adasEs, en: adasEn },
  { name: 'ismp', es: ismpEs, en: ismpEn },
];

export const MODULE_DICTS = {
  es: Object.assign({}, ...MODULE_PAIRS.map((p) => p.es)) as Record<string, string>,
  en: Object.assign({}, ...MODULE_PAIRS.map((p) => p.en)) as Record<string, string>,
};
