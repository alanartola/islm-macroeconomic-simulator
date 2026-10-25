import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useLab } from '../../state/lab';
import type { LabConfig } from '../../lab/scenario';
import { configUrl, copyLink } from '../../lab/labels';

/** Saves the current experiment (inputs only) to the scenario lab, or copies a link that reopens it. */
export function SaveToLab({ config, defaultName }: { config: LabConfig | null; defaultName: string }) {
  const { t, lang } = useI18n();
  const { save } = useLab();
  const [done, setDone] = useState<'saved' | 'copied' | null>(null);
  const flash = (what: 'saved' | 'copied') => {
    setDone(what);
    window.setTimeout(() => setDone(null), 1800);
  };
  return (
    <div className="save-to-lab">
      <button
        className="btn small"
        disabled={!config}
        onClick={() => {
          if (!config) return;
          const time = new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
          save(config, `${defaultName} · ${time}`);
          flash('saved');
        }}
        title={t('lab.save.hint')}
      >
        {done === 'saved' ? t('ui.saved') : t('ui.saveExperiment')}
      </button>
      <button
        className="btn small ghost"
        disabled={!config}
        onClick={async () => {
          if (!config) return;
          await copyLink(configUrl(config, lang));
          flash('copied');
        }}
        title={t('lab.copyLink.hint')}
      >
        {done === 'copied' ? t('lab.copied') : t('lab.copyLink')}
      </button>
    </div>
  );
}
