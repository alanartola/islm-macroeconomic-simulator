import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { exportPng, exportSvg, slug } from '../../lab/exporters';

interface Props {
  title: string;
  subtitle?: string;
  /** Optional formula / explanation block shown on demand. */
  formula?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Card wrapper for every chart: title, legend, optional formulas, enlarge
 * (modal) and export to SVG/PNG. The chart itself is rendered once and moved
 * into the enlarged view, so both always show the same model output.
 */
export function ChartCard({ title, subtitle, formula, legend, children, footer, className }: Props) {
  const { t } = useI18n();
  const body = useRef<HTMLDivElement>(null);
  const [showFormula, setShowFormula] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  const svg = () => body.current?.querySelector('svg') ?? null;
  const name = slug(title) || 'grafico';

  const card = (
    <div className={`card chart-card${expanded ? ' expanded' : ''}${className ? ` ${className}` : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? title : undefined}>
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="card-tools">
          {formula && (
            <button className="btn small ghost" aria-expanded={showFormula} onClick={() => setShowFormula((s) => !s)}>
              {showFormula ? t('ui.hideFormula') : t('ui.showFormula')}
            </button>
          )}
          <button className="btn small ghost" onClick={() => { const s = svg(); if (s) exportSvg(s, `${name}.svg`); }} title={t('ui.exportSvg')}>
            SVG
          </button>
          <button
            className="btn small ghost"
            disabled={busy}
            onClick={async () => {
              const s = svg();
              if (!s) return;
              setBusy(true);
              try {
                await exportPng(s, `${name}.png`);
              } finally {
                setBusy(false);
              }
            }}
            title={t('ui.exportPng')}
          >
            PNG
          </button>
          <button className="btn small ghost" onClick={() => setExpanded((e) => !e)} aria-label={expanded ? t('ui.collapse') : t('ui.expand')} title={expanded ? t('ui.collapse') : t('ui.expand')}>
            {expanded ? '✕' : '⤢'}
          </button>
        </div>
      </div>
      <div className="card-body" ref={body}>
        {legend && <div className="chart-legend" style={{ marginBottom: 6 }}>{legend}</div>}
        {showFormula && formula && <div className="formula-box">{formula}</div>}
        {children}
        {footer}
      </div>
    </div>
  );

  return expanded ? (
    <>
      <div className="card chart-card placeholder" aria-hidden="true">
        <div className="card-head"><div><h3>{title}</h3></div></div>
      </div>
      <div className="modal-scrim" onClick={() => setExpanded(false)} />
      {card}
    </>
  ) : (
    card
  );
}
