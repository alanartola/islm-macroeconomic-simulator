import { advParamName } from '../interpretation/advancedInsights';
import { adasParamName } from '../interpretation/adasInsights';
import type { ADASParamKey } from '../engine/adas/adas';
import type { AdvParamKey } from '../engine/advanced';
import { MODULE_OF, encodeConfigHash, type LabConfig, type LabModel } from './scenario';

/** Translation key of a parameter name in the module that owns the scenario. */
export function paramNameKey(model: LabModel, key: string): string {
  switch (model) {
    case 'basic':
      return `param.${key}.name`;
    case 'advanced':
      return advParamName(key as AdvParamKey);
    case 'open':
      return `open.param.${key}.name`;
    case 'adas':
      return adasParamName(key as ADASParamKey);
    case 'ismp':
      return `ismp.param.${key}.name`;
  }
}

/** Translation key describing the monetary / exchange-rate regime of a scenario. */
export function regimeKey(cfg: LabConfig): string | null {
  switch (cfg.model) {
    case 'basic':
      return cfg.regime === 'money-supply' ? 'regime.ms' : 'regime.it';
    case 'advanced':
      return cfg.regime === 'money' ? 'regime.ms' : 'adv.regime.rate';
    case 'open':
      return `open.regime.${cfg.regime}`;
    case 'ismp':
      return `ismp.regime.${cfg.regime}`;
    default:
      return null;
  }
}

/** Absolute link that reopens a configuration in its module (Spanish unless shared from English). */
export function configUrl(cfg: LabConfig, lang: string): string {
  const params = new URLSearchParams();
  if (lang !== 'es') params.set('lang', lang);
  params.set('m', MODULE_OF[cfg.model]);
  return `${window.location.origin}${window.location.pathname}?${params}${encodeConfigHash(cfg)}`;
}

/** Copies text to the clipboard; falls back to placing the link in the address bar. */
export async function copyLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.history.replaceState(null, '', url);
  }
}
