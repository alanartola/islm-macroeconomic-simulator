import { maxResidual, type Comparison, type EndogenousKey, type Multipliers, type SolvedEconomy, type ValidationIssue } from '../engine';
import { useI18n } from '../i18n';
import type { InsightKind, InsightReport } from '../interpretation/insights';
import type { Simulation } from '../state/simulation';

function deltaClass(x: number, goodWhenUp = true) {
  if (Math.abs(x) < 1e-9) return 'delta-flat';
  return x > 0 === goodWhenUp ? 'delta-up' : 'delta-down';
}

const KPI_VARS: { key: EndogenousKey; fmt: string; dfmt: string }[] = [
  { key: 'Y', fmt: 'bn', dfmt: 'sbn' },
  { key: 'i', fmt: 'rate', dfmt: 'spp' },
  { key: 'C', fmt: 'bn', dfmt: 'sbn' },
  { key: 'I', fmt: 'bn', dfmt: 'sbn' },
  { key: 'Sg', fmt: 'bn', dfmt: 'sbn' },
  { key: 'S', fmt: 'bn', dfmt: 'sbn' },
  { key: 'realMoney', fmt: 'bn', dfmt: 'sbn' },
];

export function Kpis({ e0, e1, cmp }: { e0: SolvedEconomy; e1: SolvedEconomy; cmp: Comparison }) {
  const { t, f } = useI18n();
  return (
    <div className="kpis" aria-label={t('kpi.title')}>
      {KPI_VARS.map(({ key, fmt, dfmt }) => {
        const c = cmp.changes[key];
        return (
          <div className="kpi" key={key}>
            <div className="label" title={t(`var.${key}`)}>{t(`var.${key}`)}</div>
            <div className="value num">{f(e1.equilibrium[key], fmt)}</div>
            <div className="sub">
              <span>{t('kpi.from')} {f(e0.equilibrium[key], fmt)}</span>
              <span className={deltaClass(c.abs)}>{f(c.abs, dfmt)}</span>
            </div>
          </div>
        );
      })}
      <div className="kpi">
        <div className="label">{t('kpi.multiplier')}</div>
        <div className="value num">{f(e1.multipliers.dY_dG, 'n3')}</div>
        <div className="sub">
          <span>{t('kpi.crowding')}</span>
          <span>{f(e1.multipliers.crowdingOutShare * 100, 'pct')}</span>
        </div>
      </div>
    </div>
  );
}

const TABLE_ROWS: { key: EndogenousKey; fmt: string; dfmt: string; emph?: boolean }[] = [
  { key: 'Y', fmt: 'n1', dfmt: 'sn2', emph: true },
  { key: 'i', fmt: 'n2', dfmt: 'sn2', emph: true },
  { key: 'C', fmt: 'n1', dfmt: 'sn2' },
  { key: 'I', fmt: 'n1', dfmt: 'sn2' },
  { key: 'G', fmt: 'n1', dfmt: 'sn2' },
  { key: 'T', fmt: 'n1', dfmt: 'sn2' },
  { key: 'Yd', fmt: 'n1', dfmt: 'sn2' },
  { key: 'Sp', fmt: 'n1', dfmt: 'sn2' },
  { key: 'Sg', fmt: 'n1', dfmt: 'sn2' },
  { key: 'S', fmt: 'n1', dfmt: 'sn2' },
  { key: 'realMoney', fmt: 'n1', dfmt: 'sn2' },
  { key: 'moneyDemand', fmt: 'n1', dfmt: 'sn2' },
  { key: 'M', fmt: 'n1', dfmt: 'sn2' },
  { key: 'A', fmt: 'n1', dfmt: 'sn2' },
];

export function ChangesTable({ e0, e1, cmp }: { e0: SolvedEconomy; e1: SolvedEconomy; cmp: Comparison }) {
  const { t, f } = useI18n();
  const r0 = maxResidual(e0.residuals);
  const r1 = maxResidual(e1.residuals);
  const r = Math.max(r0, r1);
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{t('table.title')}</h2>
          <p>{r < 1e-6 ? t('identity.ok', { r: r.toExponential(1) }) : t('identity.fail', { r: r.toExponential(2) })}</p>
        </div>
      </div>
      <div className="card-body table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">{t('table.variable')}</th>
              <th scope="col">{t('table.e0')}</th>
              <th scope="col">{t('table.e1')}</th>
              <th scope="col">{t('table.abs')}</th>
              <th scope="col">{t('table.pct')}</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map(({ key, fmt, dfmt, emph }) => {
              const c = cmp.changes[key];
              return (
                <tr key={key} className={emph ? 'emph' : undefined}>
                  <th scope="row" style={{ fontWeight: emph ? 600 : 400 }}>
                    {t(`var.${key}`)}
                    {key === 'i' ? ' (%)' : ''}
                  </th>
                  <td className="num">{f(e0.equilibrium[key], fmt)}</td>
                  <td className="num">{f(e1.equilibrium[key], fmt)}</td>
                  <td className={`num ${deltaClass(c.abs)}`}>{f(c.abs, dfmt)}{key === 'i' ? ' pp' : ''}</td>
                  <td className="num">{c.pct === null ? t('table.na') : f(c.pct, 'spct')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const MULT_ROWS: { key: keyof Multipliers; formula: string; target: string; fmt: string }[] = [
  { key: 'keynesian', formula: '1/(1−c)', target: '1/(1−c)', fmt: 'n3' },
  { key: 'dY_dG', formula: 'h/D', target: '1/(1−c)', fmt: 'n3' },
  { key: 'dY_dT', formula: '−c·h/D', target: '−c/(1−c)', fmt: 'n3' },
  { key: 'dY_dBalancedBudget', formula: '(1−c)·h/D', target: '1', fmt: 'n3' },
  { key: 'dY_dRealMoney', formula: 'b/D', target: '—', fmt: 'n3' },
  { key: 'di_dG', formula: 'k/D', target: '0', fmt: 'n4' },
  { key: 'di_dRealMoney', formula: '−(1−c)/D', target: '0', fmt: 'n4' },
  { key: 'dY_dTargetRate', formula: '—', target: '−b/(1−c)', fmt: 'n2' },
  { key: 'crowdingOutShare', formula: 'b·k/D', target: '0', fmt: 'n3' },
];

export function MultipliersTable({ e0, e1 }: { e0: SolvedEconomy; e1: SolvedEconomy }) {
  const { t, f } = useI18n();
  const targeting = e1.spec.regime === 'interest-target';
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>{t('mult.title')}</h2>
          <p>{t('mult.subtitle')} D = h(1−c) + b·k.</p>
        </div>
      </div>
      <div className="card-body table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">{t('mult.name')}</th>
              <th scope="col">{t('mult.formula')}</th>
              <th scope="col">E₀</th>
              <th scope="col">E₁</th>
            </tr>
          </thead>
          <tbody>
            {MULT_ROWS.filter((r) => (targeting ? r.key !== 'dY_dRealMoney' : r.key !== 'dY_dTargetRate')).map((r) => (
              <tr key={r.key}>
                <th scope="row" style={{ fontWeight: 400 }}>{t(`mult.${r.key}`)}</th>
                <td className="mono" style={{ fontSize: 12 }}>{targeting ? r.target : r.formula}</td>
                <td className="num">{f(e0.multipliers[r.key], r.fmt)}</td>
                <td className="num">{f(e1.multipliers[r.key], r.fmt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const KIND_ORDER: InsightKind[] = ['cause', 'shift', 'movement', 'transmission', 'effect', 'regime', 'conclusion'];

export function InsightsPanel({ report }: { report: InsightReport }) {
  const { t } = useI18n();
  return (
    <section className="analysis" aria-label={t('insights.title')}>
      <header>
        <h2>{t('insights.title')}</h2>
        <p>{t('insights.subtitle')}</p>
      </header>
      <div>
        <p className="headline">{report.headline.map((h) => t(h.key, h.vars)).join(' ')}</p>
        {KIND_ORDER.map((kind, n) => {
          const items = report.items.filter((x) => x.kind === kind);
          if (items.length === 0) return null;
          return (
            <div className="insight-group" key={kind}>
              <h4>
                <span className="badge">{n + 1}</span>
                {t(`kind.${kind}`)}
              </h4>
              <ul>
                {items.map((it, k) => (
                  <li key={`${it.key}-${k}`}>{t(it.key, it.vars)}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function issueText(t: (k: string, v?: Record<string, number | string | { key: string }>) => string, issue: ValidationIssue) {
  const fieldKey = issue.field && ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'].includes(issue.field) ? `param.${issue.field}.sym` : null;
  return t(`issue.${issue.code}`, { ...(issue.values ?? {}), field: fieldKey ? { key: fieldKey } : (issue.field ?? '') });
}

export function IssuesPanel({ sim }: { sim: Simulation }) {
  const { t } = useI18n();
  const groups: { side: 'baseline' | 'shocked'; issues: ValidationIssue[] }[] = sim.ok
    ? [
        { side: 'baseline', issues: sim.e0.issues },
        { side: 'shocked', issues: sim.e1.issues },
      ]
    : [
        ...sim.failures,
        ...(sim.e0 ? [{ side: 'baseline' as const, issues: sim.e0.issues }] : []),
        ...(sim.e1 ? [{ side: 'shocked' as const, issues: sim.e1.issues }] : []),
      ];

  const boxes: { severity: 'error' | 'warning' | 'info'; title: string; lines: string[] }[] = [];
  for (const severity of ['error', 'warning', 'info'] as const) {
    const lines: string[] = [];
    for (const g of groups) {
      for (const issue of g.issues.filter((x) => x.severity === severity)) {
        const line = `${t(`issues.side.${g.side}`)}: ${issueText(t, issue)}`;
        if (!lines.includes(line)) lines.push(line);
      }
    }
    if (lines.length) {
      boxes.push({ severity, title: t(severity === 'error' ? 'issues.errors' : severity === 'warning' ? 'issues.warnings' : 'issues.notes'), lines });
    }
  }
  if (boxes.length === 0) return null;
  const icon = { error: '⛔', warning: '⚠', info: 'ℹ' } as const;
  return (
    <div className="issues" role={boxes.some((b) => b.severity === 'error') ? 'alert' : 'status'}>
      {boxes.map((b) => (
        <div key={b.severity} className={`issue-box ${b.severity}`}>
          <strong>
            <span aria-hidden="true">{icon[b.severity]}</span>
            {b.title}
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
