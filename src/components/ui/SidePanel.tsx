import { useState, type ReactNode } from 'react';

/**
 * A bordered, collapsible block of the parameter panel (regime, scenarios,
 * parameters). Long lists such as the policy scenarios start collapsed and
 * show how many items they hold, so the parameters stay within reach.
 */
export function SidePanel({ title, count, defaultOpen = true, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="side-panel" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <h2 className="section-title">{title}</h2>
        {count !== undefined && <span className="side-count">{count}</span>}
        <span className="side-caret" aria-hidden="true" />
      </summary>
      <div className="side-panel-body">{children}</div>
    </details>
  );
}
