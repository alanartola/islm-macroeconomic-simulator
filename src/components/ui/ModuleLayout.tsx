import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';

interface Props {
  sidebar: ReactNode;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}

/** Left parameter panel + central content; the panel becomes a drawer on small screens. */
export function ModuleLayout({ sidebar, children, open, onClose }: Props) {
  const { t } = useI18n();
  return (
    <div className="layout">
      {open && <div className="scrim mobile-only" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label={t('panel.params')}>
        <div className="mobile-only" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{t('panel.params')}</strong>
          <button className="btn small" onClick={onClose}>
            {t('btn.close')}
          </button>
        </div>
        {sidebar}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function Kpi({ label, value, sub, delta, deltaClass }: { label: string; value: string; sub?: string; delta?: string; deltaClass?: string }) {
  return (
    <div className="kpi">
      <div className="label" title={label}>{label}</div>
      <div className="value num">{value}</div>
      {(sub || delta) && (
        <div className="sub">
          {sub && <span>{sub}</span>}
          {delta && <span className={deltaClass}>{delta}</span>}
        </div>
      )}
    </div>
  );
}

