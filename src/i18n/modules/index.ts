import { advEn, advEs } from './advanced';
import { uiEn, uiEs } from './ui';
import { conEn, conEs } from './construction';
import { polEn, polEs } from './policy';
import { openEn, openEs } from './open';
import { adasEn, adasEs } from './adas';
import { ismpEn, ismpEs } from './ismp';
import { labEn, labEs } from './lab';
import { obsEn, obsEs } from './observatory';
import { exEn, exEs } from './exercises';
import { trEn, trEs } from './transmission';

/** Per-module dictionaries; each module file defines Spanish (primary) and English with identical keys. */
export const MODULE_PAIRS: { name: string; es: Record<string, string>; en: Record<string, string> }[] = [
  { name: 'ui', es: uiEs, en: uiEn },
  { name: 'advanced', es: advEs, en: advEn },
  { name: 'construction', es: conEs, en: conEn },
  { name: 'policy', es: polEs, en: polEn },
  { name: 'open', es: openEs, en: openEn },
  { name: 'adas', es: adasEs, en: adasEn },
  { name: 'ismp', es: ismpEs, en: ismpEn },
  { name: 'lab', es: labEs, en: labEn },
  { name: 'observatory', es: obsEs, en: obsEn },
  { name: 'exercises', es: exEs, en: exEn },
  { name: 'transmission', es: trEs, en: trEn },
];

export const MODULE_DICTS = {
  es: Object.assign({}, ...MODULE_PAIRS.map((p) => p.es)) as Record<string, string>,
  en: Object.assign({}, ...MODULE_PAIRS.map((p) => p.en)) as Record<string, string>,
};
