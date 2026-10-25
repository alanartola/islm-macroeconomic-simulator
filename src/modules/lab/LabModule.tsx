import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { useLab } from '../../state/lab';
import { buildComparison, comparisonCsvRows, type Comparison } from '../../lab/compare';
import { downloadText, toCSV } from '../../lab/exporters';
import { configUrl, copyLink, paramNameKey, regimeKey } from '../../lab/labels';
import {
  FAMILY_FORMAT,
  MAX_COMPARE,
  exportScenarios,
  importScenarios,
  indicatorValue,
  summarize,
  withShockedParam,
  type Family,
  type LabConfig,
  type LabScenario,
  type ScenarioSummary,
  type SummaryResult,
} from '../../lab/scenario';
import type { Level } from '../../interpretation/levels';
import { ChartCard } from '../../components/ui/ChartCard';
import { DeltaBars } from '../../components/charts/BarCharts';
import { HeatMap } from '../../components/charts/HeatMap';
import { XYChart, type Pt, type XYMarker, type XYSegment, type XYSeries } from '../../components/charts/XYChart';
import { LegendLine } from '../../components/charts/common';
import { OVERLAY_COLORS } from '../../components/charts/colors';

const COLORS = OVERLAY_COLORS.slice(0, MAX_COMPARE) as readonly string[];
const LEVELS: Level[] = [1, 2, 3, 4, 5];
const SENS_POINTS = 41;
const HEAT_N = 13;
/** Half-width of the sensitivity range for parameters whose current value is zero (model units). */
const ZERO_SPAN: Record<string, number> = { s: 0.1, u: 2, d: 4, v: 2, TR: 50, T0: 50, L0: 50, iLB: 1, iMin: 0.5, iFloor: 1, t: 0.1 };

function rangeAround(values: number[], key: string): [number, number] {
  const spans = values.map((v) => (Math.abs(v) > 1e-12 ? 0.5 * Math.abs(v) : (ZERO_SPAN[key] ?? 1)));
  const lo = Math.min(...values.map((v, k) => v - spans[k]!));
  const hi = Math.max(...values.map((v, k) => v + spans[k]!));
  return [lo, hi];
}

const grid = (lo: number, hi: number, n: number) => Array.from({ length: n }, (_, k) => lo + ((hi - lo) * k) / (n - 1));

/** Splits a sampled curve at unsolvable points so gaps are never bridged by a line. */
function chunks(points: (Pt | null)[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of points) {
    if (p) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

const okSummary = (s: SummaryResult): s is ScenarioSummary => s.ok;

/** Short chart label: scenario number and a truncated name (the legend shows the full name). */
const shortLabel = (k: number, name: string) => `${k + 1}. ${name.length > 18 ? `${name.slice(0, 17)}…` : name}`;

/** Reads a local file as text (FileReader works in every supported browser). */
function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function LabModule({ onOpen }: { onOpen: (cfg: LabConfig) => void }) {
  const { t, lang } = useI18n();
  const lab = useLab();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [view, setView] = useState<'compare' | 'report'>('compare');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selected = useMemo(
    () => lab.selected.map((id) => lab.scenarios.find((s) => s.id === id)).filter((s): s is LabScenario => !!s),
    [lab.selected, lab.scenarios],
  );
  const status = useMemo(() => new Map(lab.scenarios.map((s) => [s.id, summarize(s.config, false).ok])), [lab.scenarios]);
  const cmp = useMemo(() => buildComparison(selected), [selected]);
  const modelName = (m: string) => t(`mod.${m}`);
  const famLabel = (f: Family) => t(`lab.fam.${f}`);

  const onImport = async (file: File) => {
    const rep = importScenarios(await readText(file));
    if (rep.error) setNotice({ kind: 'error', text: t(`lab.import.${rep.error}`) });
    else {
      lab.addMany(rep.imported);
      setNotice({ kind: 'ok', text: t('lab.import.ok', { n: rep.imported.length, r: rep.rejected }) });
    }
  };
  const stamp = () => new Date().toISOString().slice(0, 10);
  const exportJson = (list: LabScenario[]) => downloadText(`escenarios-${stamp()}.json`, exportScenarios(list), 'application/json;charset=utf-8');
  const exportCsv = () => downloadText(`comparacion-${stamp()}.csv`, toCSV(comparisonCsvRows(cmp, famLabel, modelName)), 'text/csv;charset=utf-8');
  const print = () => {
    setView('report');
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <main className="main lab-main">
      <div className="module-intro lab-screen-only">
        <div>
          <h2>{t('mod.lab')}</h2>
          <p>{t('lab.intro')}</p>
        </div>
        <div className="save-to-lab">
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            {t('lab.import')}
          </button>
          <button className="btn small ghost" disabled={lab.scenarios.length === 0} onClick={() => exportJson(lab.scenarios)}>
            {t('lab.exportAll')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            data-testid="lab-import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {notice && (
        <div className={`issue-box ${notice.kind === 'ok' ? 'info' : 'error'} lab-screen-only`} role="status">
          {notice.text}
        </div>
      )}

      {lab.scenarios.length === 0 ? (
        <div className="card lab-screen-only">
          <div className="card-body">
            <h3>{t('lab.empty.title')}</h3>
            <p className="muted">{t('lab.empty.body')}</p>
          </div>
        </div>
      ) : (
        <div className="card lab-screen-only">
          <div className="card-head">
            <div>
              <h3>{t('lab.list.title')}</h3>
              <p>{t('lab.list.sub', { max: MAX_COMPARE, n: selected.length })}</p>
            </div>
          </div>
          <div className="card-body table-wrap">
            <table className="data lab-table">
              <thead>
                <tr>
                  <th>{t('lab.col.select')}</th>
                  <th>{t('lab.col.name')}</th>
                  <th>{t('lab.col.model')}</th>
                  <th>{t('lab.col.regime')}</th>
                  <th>{t('lab.col.date')}</th>
                  <th>{t('lab.col.status')}</th>
                  <th>{t('lab.col.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {lab.scenarios.map((s) => {
                  const k = lab.selected.indexOf(s.id);
                  const full = k < 0 && lab.selected.length >= MAX_COMPARE;
                  const rk = regimeKey(s.config);
                  return (
                    <tr key={s.id}>
                      <td>
                        <label className="lab-check">
                          <input
                            type="checkbox"
                            checked={k >= 0}
                            disabled={full}
                            title={full ? t('lab.limit', { max: MAX_COMPARE }) : undefined}
                            onChange={() => lab.toggleSelected(s.id)}
                            aria-label={`${t('lab.col.select')}: ${s.name}`}
                          />
                          {k >= 0 && <span className="swatch" style={{ background: COLORS[k] }} />}
                        </label>
                      </td>
                      <td>
                        <input className="text-input" aria-label={t('lab.rename')} value={s.name} onChange={(e) => lab.rename(s.id, e.target.value)} />
                      </td>
                      <td>{modelName(s.config.model)}</td>
                      <td>{rk ? t(rk) : '—'}</td>
                      <td className="num">{new Date(s.createdAt).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>{status.get(s.id) ? t('lab.status.ok') : <span className="neg">{t('lab.status.fail')}</span>}</td>
                      <td className="lab-actions">
                        <button className="btn small ghost" onClick={() => onOpen(s.config)}>
                          {t('lab.action.open')}
                        </button>
                        <button
                          className="btn small ghost"
                          onClick={async () => {
                            await copyLink(configUrl(s.config, lang));
                            setCopiedId(s.id);
                            window.setTimeout(() => setCopiedId(null), 1800);
                          }}
                          title={t('lab.copyLink.hint')}
                        >
                          {copiedId === s.id ? t('lab.copied') : t('lab.action.link')}
                        </button>
                        <button className="btn small ghost danger" onClick={() => lab.remove(s.id)}>
                          {t('lab.action.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lab.scenarios.length > 0 && selected.length === 0 && <p className="muted lab-screen-only">{t('lab.select.prompt')}</p>}

      {selected.length > 0 && (
        <>
          <div className="lab-toolbar lab-screen-only">
            <div className="segmented compact" role="group">
              <button aria-pressed={view === 'compare'} onClick={() => setView('compare')}>
                {t('lab.view.compare')}
              </button>
              <button aria-pressed={view === 'report'} onClick={() => setView('report')}>
                {t('lab.view.report')}
              </button>
            </div>
            <div className="spacer" />
            <button className="btn small ghost" onClick={exportCsv}>
              {t('lab.export.csv')}
            </button>
            <button className="btn small ghost" onClick={() => exportJson(selected)}>
              {t('lab.export.json')}
            </button>
            <button className="btn small" onClick={print}>
              {t('lab.print')}
            </button>
          </div>
          {view === 'compare' ? <CompareView cmp={cmp} /> : <ReportView cmp={cmp} />}
        </>
      )}
    </main>
  );
}

// ── Comparison ──────────────────────────────────────────────────────────────

function Legend({ cmp, only }: { cmp: Comparison; only?: (k: number) => boolean }) {
  return (
    <>
      {cmp.scenarios.map((s, k) => (only && !only(k) ? null : <LegendLine key={s.id} color={COLORS[k]!} label={`${k + 1}. ${s.name}`} />))}
    </>
  );
}

function CompareTable({ cmp }: { cmp: Comparison }) {
  const { t, f } = useI18n();
  const models = new Set(cmp.summaries.map((s) => s.model));
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>{t('lab.cmp.title')}</h3>
          <p>{t('lab.cmp.sub')}</p>
        </div>
      </div>
      <div className="card-body table-wrap">
        <table className="data lab-cmp">
          <thead>
            <tr>
              <th>{t('lab.cmp.var')}</th>
              {cmp.scenarios.map((s, k) => (
                <th key={s.id}>
                  <span className="swatch" style={{ background: COLORS[k] }} /> {s.name}
                  <div className="muted small">{t(`mod.${s.config.model}`)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cmp.rows.map((r) => {
              const fm = FAMILY_FORMAT[r.family];
              return (
                <tr key={r.family} className={r.comparable ? undefined : 'single'}>
                  <th scope="row" title={r.comparable ? undefined : t('lab.cmp.single')}>
                    {t(`lab.fam.${r.family}`)}
                    {!r.comparable && cmp.scenarios.length > 1 && <span className="muted"> *</span>}
                  </th>
                  {r.cells.map((c, k) =>
                    c ? (
                      <td key={k} className="num">
                        {f(c.v0, fm.fmt)} → {f(c.v1, fm.fmt)}{' '}
                        <span className={c.delta > 1e-9 ? 'pos' : c.delta < -1e-9 ? 'neg' : 'muted'}>({f(c.delta, fm.dfmt)})</span>
                      </td>
                    ) : (
                      <td key={k} className="muted small">
                        {cmp.summaries[k]!.ok ? t('lab.cmp.undefined') : t('lab.cmp.unsolved')}
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {cmp.scenarios.length > 1 && cmp.rows.some((r) => !r.comparable) && <p className="muted small">* {t('lab.cmp.single')}</p>}
        {models.has('ismp') && models.size > 1 && <p className="muted small">{t('lab.cmp.note.ismp')}</p>}
        {models.has('adas') && [...models].some((m) => m === 'basic' || m === 'advanced' || m === 'open') && <p className="muted small">{t('lab.cmp.note.adas')}</p>}
      </div>
    </div>
  );
}

function DeltaChart({ cmp, family, onFamily }: { cmp: Comparison; family?: Family; onFamily?: (f: Family) => void }) {
  const { t } = useI18n();
  const [own, setOwn] = useState<Family | null>(null);
  const fam = family ?? own ?? cmp.rows[0]?.family;
  const row = cmp.rows.find((r) => r.family === fam) ?? cmp.rows[0];
  if (!row) return null;
  const data = row.cells.flatMap((c, k) => (c ? [{ label: shortLabel(k, cmp.scenarios[k]!.name), value: c.delta }] : []));
  return (
    <ChartCard
      title={`${t('lab.delta.title')}: ${t(`lab.fam.${row.family}`)}`}
      subtitle={t('lab.delta.sub')}
      legend={
        onFamily || !family ? (
          <label className="inline-field lab-screen-only">
            {t('lab.delta.var')}
            <select className="select" value={row.family} onChange={(e) => (onFamily ? onFamily(e.target.value as Family) : setOwn(e.target.value as Family))}>
              {cmp.rows.map((r) => (
                <option key={r.family} value={r.family}>
                  {t(`lab.fam.${r.family}`)}
                </option>
              ))}
            </select>
          </label>
        ) : undefined
      }
    >
      <DeltaBars data={data} ariaLabel={t('lab.delta.title')} format={FAMILY_FORMAT[row.family].dfmt} />
    </ChartCard>
  );
}

function EquilibriumChart({ cmp }: { cmp: Comparison }) {
  const { t, f } = useI18n();
  const pts = cmp.summaries.map((s) => (okSummary(s) ? s.yi : null));
  const all = pts.flatMap((p) => (p ? [p] : []));
  if (all.length === 0) {
    return (
      <div className="card">
        <div className="card-body muted">{t('lab.eq.none')}</div>
      </div>
    );
  }
  const ys = all.flatMap((p) => [p.Y0, p.Y1]);
  const is = all.flatMap((p) => [p.i0, p.i1]);
  const pad = (lo: number, hi: number, min: number) => {
    const span = Math.max(hi - lo, min);
    return [lo - span * 0.25, hi + span * 0.25] as [number, number];
  };
  const markers: XYMarker[] = [];
  const segments: XYSegment[] = [];
  pts.forEach((p, k) => {
    if (!p) return;
    const name = cmp.scenarios[k]!.name;
    const color = COLORS[k]!;
    const rows: [string, string][] = [
      ['Y', `${f(p.Y0, 'n1')} → ${f(p.Y1, 'n1')}`],
      ['i', `${f(p.i0, 'n3')} → ${f(p.i1, 'n3')}`],
    ];
    markers.push({ id: `e0-${k}`, x: p.Y0, y: p.i0, kind: 'ghost', color, rows: [[name, t('lab.eq.e0')], ...rows] });
    markers.push({ id: `e1-${k}`, x: p.Y1, y: p.i1, kind: 'point', color, label: `${t('lab.eq.e1')} ${k + 1}`, rows: [[name, t('lab.eq.e1')], ...rows] });
    if (Math.hypot(p.Y1 - p.Y0, p.i1 - p.i0) > 1e-9) segments.push({ id: `a-${k}`, x0: p.Y0, y0: p.i0, x1: p.Y1, y1: p.i1, color, arrow: true });
  });
  return (
    <ChartCard title={t('lab.eq.title')} subtitle={t('lab.eq.sub')} legend={<Legend cmp={cmp} only={(k) => pts[k] !== null} />}>
      <XYChart
        xDomain={pad(Math.min(...ys), Math.max(...ys), 50)}
        yDomain={pad(Math.min(...is), Math.max(...is), 1)}
        xLabel={t('lab.fam.Y')}
        yLabel={t('lab.fam.i')}
        series={[]}
        markers={markers}
        segments={segments}
        ariaLabel={t('lab.eq.title')}
        xFormat={(v) => f(v, 'n0')}
        yFormat={(v) => f(v, 'n1')}
        valueFormat={(v) => f(v, 'n2')}
      />
    </ChartCard>
  );
}

function SensitivityCurves({ cmp }: { cmp: Comparison }) {
  const { t, f } = useI18n();
  const solved = cmp.scenarios.map((s, k) => ({ s, k, sum: cmp.summaries[k]! })).filter((x) => x.sum.ok);
  const keySets = solved.map((x) => new Set((x.sum as ScenarioSummary).params.map((p) => p.key)));
  const common = solved.length ? [...keySets[0]!].filter((key) => keySets.every((ks) => ks.has(key))) : [];
  const params = common.length ? common : solved.length ? [...keySets[0]!] : [];
  const [param, setParam] = useState<string>('G');
  const [family, setFamily] = useState<Family>('Y');
  const p = params.includes(param) ? param : params[0];
  const fams = cmp.rows.map((r) => r.family);
  const fam = fams.includes(family) ? family : fams[0];

  const series = useMemo(() => {
    if (!p || !fam) return [] as XYSeries[];
    const users = solved.filter((x) => (x.sum as ScenarioSummary).params.some((q) => q.key === p) && (x.sum as ScenarioSummary).indicators.some((i) => i.family === fam));
    if (!users.length) return [];
    const values = users.map((x) => (x.s.config.shocked as unknown as Record<string, number>)[p]!);
    const [lo, hi] = rangeAround(values, p);
    const xs = grid(lo, hi, SENS_POINTS);
    return users.flatMap((x) =>
      chunks(xs.map((v) => {
        const y = indicatorValue(withShockedParam(x.s.config, p, v), fam, 'E1');
        return y === null ? null : ([v, y] as Pt);
      })).map((pts, c) => ({ id: `${x.s.id}-${c}`, points: pts, color: COLORS[x.k]!, label: c === 0 ? String(x.k + 1) : undefined })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmp, p, fam]);

  if (!p || !fam) return null;
  const xsAll = series.flatMap((s) => s.points.map((q) => q[0]));
  const ysAll = series.flatMap((s) => s.points.map((q) => q[1]));
  const model = solved[0]?.s.config.model ?? 'basic';
  const marks: XYSegment[] = solved
    .filter((x) => (x.sum as ScenarioSummary).params.some((q) => q.key === p))
    .map((x) => {
      const v = (x.s.config.shocked as unknown as Record<string, number>)[p]!;
      return { id: `cur-${x.k}`, x0: v, y0: -1e9, x1: v, y1: 1e9, color: COLORS[x.k]!, dash: 'dot' as const };
    });
  const yPad = Math.max((Math.max(...ysAll) - Math.min(...ysAll)) * 0.08, 1e-3);
  return (
    <ChartCard
      title={t('lab.sens.title')}
      subtitle={t('lab.sens.sub', { n: SENS_POINTS })}
      legend={
        <div className="lab-controls lab-screen-only">
          <label className="inline-field">
            {t('lab.sens.param')}
            <select className="select" value={p} onChange={(e) => setParam(e.target.value)}>
              {params.map((key) => (
                <option key={key} value={key}>
                  {key} — {t(paramNameKey(model, key))}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            {t('lab.sens.out')}
            <select className="select" value={fam} onChange={(e) => setFamily(e.target.value as Family)}>
              {fams.map((x) => (
                <option key={x} value={x}>
                  {t(`lab.fam.${x}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {series.length === 0 ? (
        <p className="muted">{t('lab.sens.none')}</p>
      ) : (
        <XYChart
          xDomain={[Math.min(...xsAll), Math.max(...xsAll)]}
          yDomain={[Math.min(...ysAll) - yPad, Math.max(...ysAll) + yPad]}
          xLabel={`${p} — ${t(paramNameKey(model, p))}`}
          yLabel={t(`lab.fam.${fam}`)}
          series={series}
          segments={marks}
          ariaLabel={t('lab.sens.title')}
          valueFormat={(v) => f(v, FAMILY_FORMAT[fam].fmt)}
          nice={false}
        />
      )}
    </ChartCard>
  );
}

function HeatMapCard({ cmp }: { cmp: Comparison }) {
  const { t, f } = useI18n();
  const solved = cmp.scenarios.map((s, k) => ({ s, k, sum: cmp.summaries[k]! })).filter((x): x is { s: LabScenario; k: number; sum: ScenarioSummary } => x.sum.ok);
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = solved.find((x) => x.s.id === focusId) ?? solved[0];
  const keys = focus ? focus.sum.params.map((q) => q.key) : [];
  const fams = focus ? focus.sum.indicators.map((i) => i.family) : [];
  const [px, setPx] = useState('G');
  const [py, setPy] = useState('M');
  const [family, setFamily] = useState<Family>('Y');
  const [stat, setStat] = useState<'E1' | 'delta'>('E1');
  const kx = keys.includes(px) ? px : keys[0];
  const ky = keys.includes(py) && py !== kx ? py : keys.find((k) => k !== kx);
  const fam = fams.includes(family) ? family : fams[0];

  const data = useMemo(() => {
    if (!focus || !kx || !ky || !fam) return null;
    const sh = focus.s.config.shocked as unknown as Record<string, number>;
    const xs = grid(...rangeAround([sh[kx]!], kx), HEAT_N);
    const ys = grid(...rangeAround([sh[ky]!], ky), HEAT_N);
    const z = ys.map((vy) => xs.map((vx) => indicatorValue(withShockedParam(withShockedParam(focus.s.config, kx, vx), ky, vy), fam, stat)));
    return { xs, ys, z, current: { x: sh[kx]!, y: sh[ky]! } };
  }, [focus, kx, ky, fam, stat]);

  if (!focus || !kx || !ky || !fam || !data) return null;
  const model = focus.s.config.model;
  const fmt = stat === 'E1' ? FAMILY_FORMAT[fam].fmt : FAMILY_FORMAT[fam].dfmt;
  const sel = (label: string, value: string, set: (v: string) => void, opts: [string, string][]) => (
    <label className="inline-field">
      {label}
      <select className="select" value={value} onChange={(e) => set(e.target.value)}>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  const paramOpts = keys.map((k): [string, string] => [k, `${k} — ${t(paramNameKey(model, k))}`]);
  return (
    <ChartCard
      title={t('lab.heat.title')}
      subtitle={t('lab.heat.sub', { n: HEAT_N, name: focus.s.name })}
      legend={
        <div className="lab-controls lab-screen-only">
          {solved.length > 1 && sel(t('lab.heat.scenario'), focus.s.id, setFocusId, solved.map((x) => [x.s.id, x.s.name]))}
          {sel(t('lab.heat.x'), kx, setPx, paramOpts)}
          {sel(t('lab.heat.y'), ky, setPy, paramOpts.filter(([k]) => k !== kx))}
          {sel(t('lab.sens.out'), fam, (v) => setFamily(v as Family), fams.map((x) => [x, t(`lab.fam.${x}`)]))}
          {sel(t('lab.heat.stat'), stat, (v) => setStat(v as 'E1' | 'delta'), [['E1', t('lab.stat.E1')], ['delta', t('lab.stat.delta')]])}
        </div>
      }
    >
      <HeatMap
        xs={data.xs}
        ys={data.ys}
        z={data.z}
        xLabel={`${kx} — ${t(paramNameKey(model, kx))}`}
        yLabel={ky}
        valueLabel={`${t(`lab.fam.${fam}`)} (${stat === 'E1' ? t('lab.stat.E1') : t('lab.stat.delta')})`}
        ariaLabel={t('lab.heat.title')}
        current={data.current}
        format={(v) => f(v, fmt)}
      />
    </ChartCard>
  );
}

function CompareView({ cmp }: { cmp: Comparison }) {
  return (
    <>
      <CompareTable cmp={cmp} />
      <div className="grid-2">
        <DeltaChart cmp={cmp} />
        <EquilibriumChart cmp={cmp} />
      </div>
      <SensitivityCurves cmp={cmp} />
      <HeatMapCard cmp={cmp} />
    </>
  );
}

// ── Printable report ───────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="report-section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function ScenarioReport({ s, sum, k }: { s: LabScenario; sum: SummaryResult; k: number }) {
  const { t, f, lang } = useI18n();
  const model = s.config.model;
  const rk = regimeKey(s.config);
  const shocks = okSummary(sum) ? sum.params.filter((p) => Math.abs(p.v1 - p.v0) > 1e-12) : [];
  return (
    <article className="card report-scenario">
      <div className="card-head">
        <div>
          <h3>
            <span className="swatch" style={{ background: COLORS[k] }} /> {s.name}
          </h3>
          <p>
            {t('lab.report.model')}: {t(`mod.${model}`)}
            {rk && ` · ${t('lab.report.regime')}: ${t(rk)}`}
            {s.config.model === 'advanced' && ` · ${t('adv.lm.label')}: ${t(`adv.lm.${s.config.lm}`)}`} · {t('lab.report.created')}:{' '}
            {new Date(s.createdAt).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
      </div>
      <div className="card-body">
        <Section title={t('lab.report.assumptions')}>
          <ul>
            {[1, 2, 3].map((n) => (
              <li key={n}>{t(`lab.assume.${model}.${n}`)}</li>
            ))}
          </ul>
        </Section>
        {!okSummary(sum) ? (
          <p className="neg">{t('lab.report.unsolved')}</p>
        ) : (
          <>
            <Section title={t('lab.report.shock')}>
              {shocks.length === 0 ? (
                <p>{t('lab.report.noShock')}</p>
              ) : (
                <ul>
                  {shocks.map((p) => (
                    <li key={p.key}>
                      {t(paramNameKey(model, p.key))} ({p.key}): {f(p.v0, 'n4')} → {f(p.v1, 'n4')} ({f(p.v1 - p.v0, 'sn4')})
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            <Section title={t('lab.report.params')}>
              <table className="data compact">
                <thead>
                  <tr>
                    <th>{t('lab.report.param')}</th>
                    <th>E₀</th>
                    <th>E₁</th>
                  </tr>
                </thead>
                <tbody>
                  {sum.params.map((p) => (
                    <tr key={p.key} className={Math.abs(p.v1 - p.v0) > 1e-12 ? 'changed' : undefined}>
                      <td>
                        {p.key} — {t(paramNameKey(model, p.key))}
                      </td>
                      <td className="num">{f(p.v0, 'n4')}</td>
                      <td className="num">{f(p.v1, 'n4')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
            <Section title={t('lab.report.results')}>
              <table className="data compact">
                <thead>
                  <tr>
                    <th>{t('lab.cmp.var')}</th>
                    <th>E₀</th>
                    <th>E₁</th>
                    <th>Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {sum.indicators.map((it) => {
                    const fm = FAMILY_FORMAT[it.family];
                    return (
                      <tr key={it.family}>
                        <td>{t(`lab.fam.${it.family}`)}</td>
                        <td className="num">{f(it.v0, fm.fmt)}</td>
                        <td className="num">{f(it.v1, fm.fmt)}</td>
                        <td className="num">{f(it.v1 - it.v0, fm.dfmt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
            <Section title={t('lab.report.explanation')}>
              <p className="headline">{sum.report.headline.map((h) => t(h.key, h.vars)).join(' ')}</p>
              {LEVELS.map((lv) =>
                sum.report.levels[lv].length ? (
                  <div key={lv} className="report-level">
                    <h5>
                      {lv}. {t(`lvl.title.${lv}`)}
                    </h5>
                    <ul className={lv === 4 ? 'math-list' : undefined}>
                      {sum.report.levels[lv].map((it, j) => (
                        <li key={`${it.key}-${j}`} className={it.math ? 'math' : undefined}>
                          {it.nature && <span className={`nature nature-${it.nature}`}>{t(`lvl.nature.${it.nature}`)}</span>}
                          {t(it.key, it.vars)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </Section>
          </>
        )}
        <Section title={t('lab.report.equations')}>
          <pre className="equations">{t(`lab.eqs.${model}`)}</pre>
        </Section>
        <Section title={t('lab.report.limitations')}>
          <p>{t(`lab.limit.${model}`)}</p>
        </Section>
      </div>
    </article>
  );
}

function ReportView({ cmp }: { cmp: Comparison }) {
  const { t, lang } = useI18n();
  const date = new Date().toLocaleString(lang, { dateStyle: 'long', timeStyle: 'short' });
  return (
    <div className="lab-report">
      <header className="report-head">
        <h2>{t('lab.report.title')}</h2>
        <p className="muted">{t('lab.report.generated', { date })}</p>
        <p>{t('lab.report.intro')}</p>
      </header>
      {cmp.scenarios.map((s, k) => (
        <ScenarioReport key={s.id} s={s} sum={cmp.summaries[k]!} k={k} />
      ))}
      {cmp.scenarios.length > 0 && (
        <>
          <h3 className="report-h">{t('lab.report.comparison')}</h3>
          <CompareTable cmp={cmp} />
          <h3 className="report-h">{t('lab.report.charts')}</h3>
          <DeltaChart cmp={cmp} family={cmp.rows[0]?.family} />
          <EquilibriumChart cmp={cmp} />
        </>
      )}
      <p className="muted small">{t('lab.limit.general')}</p>
    </div>
  );
}
