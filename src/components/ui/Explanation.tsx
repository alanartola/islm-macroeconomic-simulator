import { useI18n } from '../../i18n';
import type { Level, LeveledReport } from '../../interpretation/levels';
import { useMode } from '../../state/mode';

const LEVELS: Level[] = [1, 2, 3, 4, 5];

/**
 * Five-level explanation. In educational mode levels 1–3 are open and the
 * mathematical/interpretive levels are collapsible; advanced mode opens all.
 */
export function Explanation({ report }: { report: LeveledReport }) {
  const { t } = useI18n();
  const { isAdvanced } = useMode();
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{t('insights.title')}</h2>
          <p>{t('lvl.subtitle')}</p>
        </div>
      </div>
      <div className="card-body">
        <p className="headline">{report.headline.map((h) => t(h.key, h.vars)).join(' ')}</p>
        {LEVELS.map((lv) => {
          const items = report.levels[lv];
          if (items.length === 0) return null;
          const open = isAdvanced || lv <= 3;
          return (
            <details className="insight-group level" key={lv} open={open}>
              <summary>
                <span className="badge">{lv}</span>
                {t(`lvl.title.${lv}`)}
              </summary>
              <ul className={lv === 4 ? 'math-list' : undefined}>
                {items.map((it, k) => (
                  <li key={`${it.key}-${k}`} className={it.math ? 'math' : undefined}>
                    {it.nature && <span className={`nature nature-${it.nature}`}>{t(`lvl.nature.${it.nature}`)}</span>}
                    {t(it.key, it.vars)}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}

interface IssueLike {
  code: string;
  severity: 'error' | 'warning' | 'info';
  values?: Record<string, number>;
  field?: string;
}

/** Validation messages for any module; `prefix` selects the translation namespace (e.g. "adv.issue."). */
export function IssueList({ groups, prefix }: { groups: { side: 'baseline' | 'shocked'; issues: IssueLike[] }[]; prefix: string }) {
  const { t } = useI18n();
  const boxes: { severity: IssueLike['severity']; lines: string[] }[] = [];
  for (const severity of ['error', 'warning', 'info'] as const) {
    const lines: string[] = [];
    for (const g of groups) {
      for (const is of g.issues.filter((x) => x.severity === severity)) {
        const line = `${t(`issues.side.${g.side}`)}: ${t(`${prefix}${is.code}`, { ...(is.values ?? {}), field: is.field ?? '' })}`;
        if (!lines.includes(line)) lines.push(line);
      }
    }
    if (lines.length) boxes.push({ severity, lines });
  }
  if (!boxes.length) return null;
  const icon = { error: '⛔', warning: '⚠', info: 'ℹ' } as const;
  const title = { error: 'issues.errors', warning: 'issues.warnings', info: 'issues.notes' } as const;
  return (
    <div className="issues" role={boxes.some((b) => b.severity === 'error') ? 'alert' : 'status'}>
      {boxes.map((b) => (
        <div key={b.severity} className={`issue-box ${b.severity}`}>
          <strong>
            <span aria-hidden="true">{icon[b.severity]}</span>
            {t(title[b.severity])}
          </strong>
          <ul>
            {b.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export interface Row {
  id: string;
  label: string;
  v0: number | null;
  v1: number | null;
  fmt: string;
  emph?: boolean;
}

/** E₀ / E₁ / Δ / %Δ table used by the advanced modules. */
export function CompareTable({ title, subtitle, rows }: { title: string; subtitle?: string; rows: Row[] }) {
  const { t, f } = useI18n();
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="card-body table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">{t('table.variable')}</th>
              <th scope="col">E₀</th>
              <th scope="col">E₁</th>
              <th scope="col">Δ</th>
              <th scope="col">%Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.v0 !== null && r.v1 !== null ? r.v1 - r.v0 : null;
              const pct = d !== null && r.v0 !== null && Math.abs(r.v0) > 1e-9 ? (d / Math.abs(r.v0)) * 100 : null;
              return (
                <tr key={r.id} className={r.emph ? 'emph' : undefined}>
                  <th scope="row" style={{ fontWeight: r.emph ? 600 : 400 }}>{r.label}</th>
                  <td className="num">{r.v0 === null ? '—' : f(r.v0, r.fmt)}</td>
                  <td className="num">{r.v1 === null ? '—' : f(r.v1, r.fmt)}</td>
                  <td className={`num ${d === null || Math.abs(d) < 1e-9 ? 'delta-flat' : d > 0 ? 'delta-up' : 'delta-down'}`}>{d === null ? '—' : f(d, r.fmt === 'n4' || r.fmt === 'n3' ? r.fmt : 'sn2')}</td>
                  <td className="num">{pct === null ? t('table.na') : f(pct, 'spct')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
