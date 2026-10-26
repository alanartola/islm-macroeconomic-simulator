import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { readPref, writePref } from '../state/persistence';

export const GUIDE_KEY = 'islm.guide.seen';
export const GUIDE_STEPS = 8;

/** True on a visitor's first visit (the guide was never closed or skipped). */
export function guideUnseen(): boolean {
  return readPref(GUIDE_KEY) !== '1';
}

/**
 * Step-by-step usage guide. It opens by itself on the first visit, can be
 * skipped at any step and reopened from the masthead.
 */
export function GuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      setStep(1);
      if (!d.open) {
        if (typeof d.showModal === 'function') d.showModal();
        else d.setAttribute('open', '');
      }
    } else if (d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  const close = () => {
    writePref(GUIDE_KEY, '1');
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className="guide"
      aria-labelledby="guide-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="guide-head">
        <div>
          <span className="kicker">
            {t('guide.kicker')} · {t('guide.step', { n: step, total: GUIDE_STEPS })}
          </span>
          <h2 id="guide-title">{t('guide.title')}</h2>
        </div>
        <button className="btn icon" onClick={close} aria-label={t('guide.close')} title={t('guide.close')}>
          ×
        </button>
      </div>
      <ol className="guide-steps" aria-label={t('guide.title')}>
        {Array.from({ length: GUIDE_STEPS }, (_, k) => k + 1).map((n) => (
          <li key={n}>
            <button aria-current={n === step ? 'step' : undefined} onClick={() => setStep(n)} aria-label={t(`guide.${n}.t`)}>
              {n}
            </button>
          </li>
        ))}
      </ol>
      <section className="guide-body" aria-live="polite">
        <h3>
          <span className="num">{step}.</span> {t(`guide.${step}.t`)}
        </h3>
        <p>{t(`guide.${step}.d`)}</p>
      </section>
      <p className="note">{t('guide.reopen')}</p>
      <div className="guide-actions">
        <button className="btn link" onClick={close}>
          {t('guide.skip')}
        </button>
        <span className="spacer" />
        <button className="btn" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
          {t('guide.prev')}
        </button>
        {step < GUIDE_STEPS ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)}>
            {t('guide.next')}
          </button>
        ) : (
          <button className="btn primary" onClick={close}>
            {t('guide.done')}
          </button>
        )}
      </div>
    </dialog>
  );
}
