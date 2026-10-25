import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { LETTER, groupOf, type LabModuleId } from '../../modules/catalog';

/**
 * Header shared by the eight modules: letter and theme as a kicker, the model
 * name as the page title, a one-line description and the module actions.
 */
export function ModuleHeader({ id, description, children, className }: { id: LabModuleId; description?: string; children?: ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={`module-intro${className ? ` ${className}` : ''}`}>
      <div>
        <span className="kicker">
          <span className="mod-letter">{LETTER[id]}</span>
          {t('mod.kicker', { l: LETTER[id] })} · {t(`group.${groupOf(id)}`)}
        </span>
        <h2>{t(`mod.${id}`)}</h2>
        <p>{description ?? t(`mod.${id}.desc`)}</p>
      </div>
      {children}
    </div>
  );
}
