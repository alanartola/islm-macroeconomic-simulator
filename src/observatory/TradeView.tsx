import { useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useSeries } from '../data/client';
import { addMonths, annualSums, tradeRows, yearToDate, type Obs, type SeriesFile } from '../data/core';
import { TimeChart, type TimePanel } from '../components/charts/TimeChart';
import { TRADE_EVENTS } from './episodes';
import { EpisodeDetail } from './HistoryView';
import { SeriesMetaTable, colorOf, today } from './shared';

const X_GROUPS = ['ar_x_pp', 'ar_x_moa', 'ar_x_moi', 'ar_x_cye'];
const M_USES = ['ar_m_bk', 'ar_m_bi', 'ar_m_cyl', 'ar_m_pya', 'ar_m_bc', 'ar_m_vap', 'ar_m_resto'];
const X_PARTNERS = ['ar_x_brasil', 'ar_x_china', 'ar_x_eeuu', 'ar_x_chile', 'ar_x_india'];
const M_PARTNERS = ['ar_m_brasil', 'ar_m_eeuu', 'ar_m_india'];
const IDS = ['ar_x', 'ar_m', 'ar_saldo', ...X_GROUPS, ...M_USES, ...X_PARTNERS, ...M_PARTNERS];

const sumYear = (data: Obs[], year: number) => data.filter(([d]) => d.startsWith(String(year))).reduce((a, [, v]) => a + v, 0);
const monthsIn = (data: Obs[], year: number) => data.filter(([d]) => d.startsWith(String(year))).length;

export function TradeView() {
  const { t, f, lang } = useI18n();
  const L = (x: { es: string; en: string }) => x[lang === 'es' ? 'es' : 'en'];
  const { files, loading } = useSeries(IDS);
  const [range, setRange] = useState<'5y' | 'all'>('5y');
  const x = useMemo(() => files.ar_x?.data ?? [], [files.ar_x]);
  const m = useMemo(() => files.ar_m?.data ?? [], [files.ar_m]);
  const rows = useMemo(() => tradeRows(x, m, files.ar_saldo?.data ?? []), [x, m, files.ar_saldo]);
  const lastRow = rows[rows.length - 1];
  const years = annualSums(x, true).map((r) => r.year);
  const lastYear = years[years.length - 1] ?? new Date().getFullYear();
  const [yearA, setYearA] = useState<number | null>(null);
  const [yearB, setYearB] = useState<number | null>(null);
  const [compYear, setCompYear] = useState<number | null>(null);
  const [eventId, setEventId] = useState(TRADE_EVENTS[TRADE_EVENTS.length - 1]!.id);
  if (loading) return <p className="muted">{t('obs.loading')}</p>;
  if (!lastRow) return <p className="issue-box warning">{t('obs.missing')}</p>;

  const lastDate = lastRow.date;
  const from = range === 'all' ? rows[0]!.date : addMonths(lastDate, -60);
  const df = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const monthLabel = df.format(new Date(`${lastDate}T00:00:00Z`));
  const yoyRow = rows.find((r) => r.date === addMonths(lastDate, -12));
  const ytdNow = { x: yearToDate(x).find(([d]) => d === lastDate)?.[1] ?? 0, m: yearToDate(m).find(([d]) => d === lastDate)?.[1] ?? 0 };
  const prevYtdDate = addMonths(lastDate, -12);
  const ytdPrev = { x: yearToDate(x).find(([d]) => d === prevYtdDate)?.[1] ?? null, m: yearToDate(m).find(([d]) => d === prevYtdDate)?.[1] ?? null };
  const maxGap = rows.reduce((a, r) => Math.max(a, Math.abs(r.gap ?? 0)), 0);
  const pct = (a: number, b: number | null | undefined) => (b ? (a / b - 1) * 100 : null);
  const kpi = (label: string, value: number, prev: number | null | undefined, sub?: string) => (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value num">{f(value, 'n0')}</div>
      <div className="sub">
        {sub && <span>{sub}</span>}
        {prev !== null && prev !== undefined && <span className={value >= prev ? 'delta-up' : 'delta-down'}>{f(pct(value, prev) ?? 0, 'sn1')}% {t('obs.trade.yoy')}</span>}
      </div>
    </div>
  );

  const line = (id: string, k: number) => {
    const s = files[id];
    return s ? { id, label: L(s.meta.name).replace(/^(Exportaciones|Importaciones|Exports|Imports): /, ''), color: colorOf(id, k), data: s.data, dash: !s.meta.original } : null;
  };
  const panels: TimePanel[] = [
    { id: 'xm', title: t('obs.trade.xm'), unit: t('obs.unit.musd'), lines: [line('ar_x', 0), line('ar_m', 1)].filter(Boolean) as never, fmt: 'n0' },
    { id: 'bal', title: t('obs.trade.balance'), unit: t('obs.unit.musd'), lines: [{ id: 'bal', label: t('obs.trade.balance'), color: 'var(--up)', data: rows.map((r) => [r.date, r.balance] as Obs) }], fmt: 'n0', bars: true },
    { id: 'groups', title: t('obs.trade.groups'), unit: t('obs.unit.musd'), lines: X_GROUPS.map(line).filter(Boolean) as never, fmt: 'n0' },
    { id: 'uses', title: t('obs.trade.uses'), unit: t('obs.unit.musd'), lines: M_USES.map(line).filter(Boolean) as never, fmt: 'n0' },
    { id: 'xp', title: t('obs.trade.xpartners'), unit: t('obs.unit.musd'), lines: X_PARTNERS.map(line).filter(Boolean) as never, fmt: 'n0' },
    { id: 'mp', title: t('obs.trade.mpartners'), unit: t('obs.unit.musd'), lines: M_PARTNERS.map(line).filter(Boolean) as never, fmt: 'n0' },
  ];

  const cy = compYear ?? lastYear;
  const share = (ids: string[], total: Obs[]) => {
    const tot = sumYear(total, cy);
    return ids
      .map((id) => files[id])
      .filter((s): s is SeriesFile => !!s)
      .map((s) => ({ id: s.meta.id, label: L(s.meta.name).replace(/^(Exportaciones|Importaciones|Exports|Imports): /, ''), value: sumYear(s.data, cy), share: tot ? (sumYear(s.data, cy) / tot) * 100 : 0, derived: !s.meta.original }));
  };
  const xs = share(X_GROUPS, x);
  const ms = share(M_USES, m);
  const ya = yearA ?? (years.length > 1 ? years[years.length - 2]! : lastYear);
  const yb = yearB ?? lastYear;
  const compareRow = (label: string, series: Obs[]) => {
    const a = sumYear(series, ya);
    const b = sumYear(series, yb);
    return { label, a, b, d: b - a, p: a ? (b / a - 1) * 100 : null };
  };
  const cmpRows = [
    compareRow(t('obs.trade.x'), x),
    compareRow(t('obs.trade.m'), m),
    compareRow(t('obs.trade.balance'), rows.map((r) => [r.date, r.balance] as Obs)),
    compareRow(t('obs.trade.turnover'), rows.map((r) => [r.date, r.turnover] as Obs)),
    ...[...X_GROUPS, ...M_USES].map((id) => files[id]).filter((s): s is SeriesFile => !!s).map((s) => compareRow(L(s.meta.name), s.data)),
  ];
  const partial = (y: number) => monthsIn(x, y) < 12;
  const shown = IDS.map((id) => files[id]).filter((s): s is SeriesFile => !!s);

  return (
    <div className="obs-view">
      <div className="kpis">
        {kpi(`${t('obs.trade.x')} · ${monthLabel}`, lastRow.x, yoyRow?.x)}
        {kpi(`${t('obs.trade.m')} · ${monthLabel}`, lastRow.m, yoyRow?.m)}
        <div className="kpi">
          <div className="label">{t('obs.trade.balance')} (X − M)</div>
          <div className={`value num ${lastRow.balance >= 0 ? 'pos' : 'neg'}`}>{f(lastRow.balance, 'sn0')}</div>
          <div className="sub">
            <span>{t(lastRow.balance >= 0 ? 'obs.trade.surplus' : 'obs.trade.deficit')}</span>
          </div>
        </div>
        {kpi(`${t('obs.trade.turnover')} (X + M)`, lastRow.turnover, yoyRow?.turnover)}
        {kpi(t('obs.trade.ytdX', { y: lastDate.slice(0, 4) }), ytdNow.x, ytdPrev.x)}
        {kpi(t('obs.trade.ytdM', { y: lastDate.slice(0, 4) }), ytdNow.m, ytdPrev.m)}
        <div className="kpi">
          <div className="label">{t('obs.trade.ytdBal', { y: lastDate.slice(0, 4) })}</div>
          <div className={`value num ${ytdNow.x - ytdNow.m >= 0 ? 'pos' : 'neg'}`}>{f(ytdNow.x - ytdNow.m, 'sn0')}</div>
          <div className="sub">{ytdPrev.x !== null && ytdPrev.m !== null && <span>{t('obs.trade.prevYtd')}: {f(ytdPrev.x - ytdPrev.m, 'sn0')}</span>}</div>
        </div>
        <div className="kpi">
          <div className="label">{t('obs.trade.identity')}</div>
          <div className="value num">{f(maxGap, 'n3')}</div>
          <div className="sub">
            <span>{t('obs.trade.identity.sub')}</span>
          </div>
        </div>
      </div>
      <p className="note">{t('obs.trade.units')}</p>

      <div className="card chart-card">
        <div className="card-head">
          <div>
            <h3>{t('obs.trade.chart')}</h3>
            <p>{t('obs.trade.chart.sub')}</p>
          </div>
          <div className="segmented compact" role="group">
            <button aria-pressed={range === '5y'} onClick={() => setRange('5y')}>
              {t('obs.win.5y')}
            </button>
            <button aria-pressed={range === 'all'} onClick={() => setRange('all')}>
              {t('obs.win.all')}
            </button>
          </div>
        </div>
        <TimeChart from={from} to={lastDate} panels={panels} markers={TRADE_EVENTS.map((e) => ({ id: e.id, date: e.date, label: L(e.title), active: e.id === eventId }))} onMarker={setEventId} ariaLabel={t('obs.trade.chart')} panelHeight={120} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.trade.composition', { y: String(cy) })}</h3>
              <p>{partial(cy) ? t('obs.trade.partialYear', { n: monthsIn(x, cy) }) : t('obs.trade.fullYear')}</p>
            </div>
            <select className="select" value={cy} onChange={(e) => setCompYear(Number(e.target.value))} aria-label={t('obs.hist.year')}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {[
            { title: t('obs.trade.x'), rows: xs },
            { title: t('obs.trade.m'), rows: ms },
          ].map((b) => (
            <div key={b.title} className="share-block">
              <h4>{b.title}</h4>
              {b.rows.map((r) => (
                <div className="share-row" key={r.id}>
                  <span className="share-label">
                    {r.label}
                    {r.derived && <span className="tag-derived">{t('obs.meta.derived')}</span>}
                  </span>
                  <span className="share-bar">
                    <span style={{ width: `${Math.max(0, Math.min(100, r.share))}%`, background: colorOf(r.id) }} />
                  </span>
                  <span className="num share-val">{f(r.share, 'n1')}%</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.trade.compare')}</h3>
              <p>{t('obs.trade.compare.sub')}</p>
            </div>
            <span className="inline-field">
              <select className="select" value={ya} onChange={(e) => setYearA(Number(e.target.value))} aria-label="A">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              →
              <select className="select" value={yb} onChange={(e) => setYearB(Number(e.target.value))} aria-label="B">
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </span>
          </div>
          {(partial(ya) || partial(yb)) && <p className="issue-box warning">{t('obs.trade.partialWarn')}</p>}
          <div className="table-wrap">
            <table className="data compact">
              <thead>
                <tr>
                  <th>{t('obs.meta.series')}</th>
                  <th>{ya}</th>
                  <th>{yb}</th>
                  <th>Δ</th>
                  <th>%Δ</th>
                </tr>
              </thead>
              <tbody>
                {cmpRows.map((r, k) => (
                  <tr key={r.label} className={k < 4 ? 'emph' : undefined}>
                    <td>{r.label}</td>
                    <td className="num">{f(r.a, 'n0')}</td>
                    <td className="num">{f(r.b, 'n0')}</td>
                    <td className="num">{f(r.d, 'sn0')}</td>
                    <td className="num">{r.p === null || k === 2 ? '—' : `${f(r.p, 'sn1')}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.trade.behaviour')}</h3>
              <p>{t('obs.trade.behaviour.sub')}</p>
            </div>
          </div>
          {['surplus', 'deficit', 'depreciation', 'imports', 'foreign', 'rer', 'prices', 'drought'].map((k) => (
            <details key={k} className="qa">
              <summary>{t(`obs.trade.q.${k}`)}</summary>
              <p>{t(`obs.trade.a.${k}`)}</p>
            </details>
          ))}
          <p className="note">{t('obs.trade.surplusNote')}</p>
        </div>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>{t('obs.trade.bop')}</h3>
              <p>{t('obs.trade.bop.sub')}</p>
            </div>
          </div>
          <dl className="bop-list">
            {['goods', 'services', 'current', 'financial', 'reserves', 'bop'].map((k) => (
              <div key={k}>
                <dt>{t(`obs.trade.bop.${k}`)}</dt>
                <dd>{t(`obs.trade.bop.${k}.d`)}</dd>
              </div>
            ))}
          </dl>
          <p className="note">{t('obs.trade.bop.note')}</p>
        </div>
      </div>

      <div className="history">
        <aside className="card history-list">
          <div className="card-head">
            <div>
              <h3>{t('obs.trade.events')}</h3>
              <p>{t('obs.trade.events.sub')}</p>
            </div>
          </div>
          <ol className="episode-list">
            {TRADE_EVENTS.map((e) => (
              <li key={e.id}>
                <button className="preset" aria-pressed={e.id === eventId} onClick={() => setEventId(e.id)}>
                  <span className="p-title">{L(e.title)}</span>
                  <span className="p-desc">{e.date.slice(0, 7)}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <div className="history-detail">
          <EpisodeDetail key={eventId} episode={TRADE_EVENTS.find((e) => e.id === eventId)!} files={files} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>{t('obs.meta.title')}</h3>
            <p>{t('obs.meta.sub')}</p>
          </div>
        </div>
        <SeriesMetaTable files={shown} today={today()} />
      </div>
    </div>
  );
}
