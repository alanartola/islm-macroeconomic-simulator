import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { useLab } from '../../state/lab';
import { setCurrentConfig } from '../../state/currentConfig';
import type { LabConfig } from '../../lab/scenario';

/**
 * Saves the current experiment (inputs only) to the scenario lab and registers
 * it as the configuration shared by the top-bar "Copiar enlace" button.
 */
export function SaveToLab({ config, defaultName }: { config: LabConfig | null; defaultName: string }) {
  const { t, lang } = useI18n();
  const { save } = useLab();
  const [done, setDone] = useState(false);
  useEffect(() => {
    setCurrentConfig(config);
  }, [config]);
  useEffect(() => () => setCurrentConfig(null), []);
  return (
    <div className="save-to-lab">
      <button
        className="btn small"
        disabled={!config}
        onClick={() => {
          if (!config) return;
          const time = new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
          save(config, `${defaultName} · ${time}`);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        }}
        title={t('lab.save.hint')}
      >
        {done ? t('ui.saved') : t('ui.saveExperiment')}
      </button>
    </div>
  );
}
