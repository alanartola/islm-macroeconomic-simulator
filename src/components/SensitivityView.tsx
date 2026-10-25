import { Fragment, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { computeMultipliers, sensitivityProfile, validateSpec, type EconomySpec, type SensitivityParam, type SensitivityPoint } from '../engine';
import { useI18n } from '../i18n';
import type { SimulationOk } from '../state/simulation';
import { AxisBottom, AxisLeft, LegendLine, Tooltip } from './charts/common';
import { useWidth } from './charts/utils';

const FISCAL = 'var(--series-is)';
const MONETARY = 'var(--series-lm)';

function ProfileChart({ points, current, keynesian, xLabel, param }: { points: SensitivityPoint[]; current: number; keynesian: number; xLabel: string; param: SensitivityParam }) {
  const { t, f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const height = Math.round(Math.max(260, Math.min(340, width * 0.6)));
  const m = { top: 14, right: 20, bottom: 42, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const xs = points.map((p) => p.x);
  const x = scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([0, w]);
  const yMax = Math.max(keynesian, ...points.map((p) => Math.max(p.fiscal, p.monetary)));
  const y = scaleLinear().domain([0, yMax * 1.08]).range([h, 0]).nice(6);
  const [hover, setHover] = useState<SensitivityPoint | null>(null);

  const path = (acc: (p: SensitivityPoint) => number) =>
    line<SensitivityPoint>()
      .x((p) => x(p.x))
      .y((p) => y(acc(p)))(points) ?? '';

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={xLabel}>
        <g transform={`translate(${m.left},${m.top})`}>
          <g transform={`translate(0,${h})`}>
            <AxisBottom scale={x} gridLength={h} ticks={6} label={xLabel} />
          </g>
          <AxisLeft scale={y} gridLength={w} ticks={6} label={t('sens.y')} format={(v) => f(v, 'n1')} />
          <line x1={0} x2={w} y1={y(keynesian)} y2={y(keynesian)} stroke="var(--text-muted)" strokeDasharray="6 5" strokeWidth={1.5} />
          <path d={path((p) => p.fiscal)} fill="none" stroke={FISCAL} strokeWidth={2.25} />
          <path d={path((p) => p.monetary)} fill="none" stroke={MONETARY} strokeWidth={2.25} />
          {current >= x.domain()[0]! && current <= x.domain()[1]! && (
            <g>
              <line x1={x(current)} x2={x(current)} y1={0} y2={h} stroke="var(--text-primary)" strokeDasharray="2 3" />
              <text x={x(current) + 4} y={10} fontSize={11} fill="var(--text-secondary)">
                {t('sens.current')}: {param} = {f(current, 'n1')}
              </text>
            </g>
          )}
          {hover && (
            <g pointerEvents="none">
              <line x1={x(hover.x)} x2={x(hover.x)} y1={0} y2={h} stroke="var(--text-muted)" opacity={0.6} />
              <circle cx={x(hover.x)} cy={y(hover.fiscal)} r={4} fill={FISCAL} stroke="var(--surface-1)" strokeWidth={2} />
              <circle cx={x(hover.x)} cy={y(hover.monetary)} r={4} fill={MONETARY} stroke="var(--surface-1)" strokeWidth={2} />
            </g>
          )}
          <rect
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={(ev) => {
              const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
              const xv = x.invert(((ev.clientX - r.left) * w) / (r.width || w));
              let best = points[0] ?? null;
              for (const p of points) if (best && Math.abs(p.x - xv) < Math.abs(best.x - xv)) best = p;
              setHover(best);
            }}
            onPointerLeave={() => setHover(null)}
          />
        </g>
      </svg>
      {hover && (
        <Tooltip x={x(hover.x) + m.left} y={y(hover.fiscal) + m.top} width={width}>
          <div className="tt-title">{param} = {f(hover.x, 'n1')}</div>
          <div className="tt-row"><span className="tt-key"><span className="legend-swatch" style={{ color: FISCAL }} />{t('sens.fiscal')}</span><span>{f(hover.fiscal, 'n3')}</span></div>
          <div className="tt-row"><span className="tt-key"><span className="legend-swatch" style={{ color: MONETARY }} />{t('sens.monetary')}</span><span>{f(hover.monetary, 'n3')}</span></div>
          <div className="tt-row"><span>{t('mult.crowdingOutShare')}</span><span>{f(hover.crowdingOutShare * 100, 'pct')}</span></div>
        </Tooltip>
      )}
    </div>
  );
}

const DG = 50;
const DM = 100;

export function SensitivityView({ sim }: { sim: SimulationOk }) {
  const { t, f } = useI18n();
  const spec: EconomySpec = useMemo(() => ({ ...sim.e1.spec, regime: 'money-supply' }), [sim.e1.spec]);
  const p = spec.params;
  const bMax = Math.max(100, p.b * 3);
  const hMax = Math.max(300, p.h * 3);
  const bProfile = useMemo(() => sensitivityProfile(spec, 'b', 0, bMax, 120), [spec, bMax]);
  const hProfile = useMemo(() => sensitivityProfile(spec, 'h', 0, hMax, 120), [spec, hMax]);
  const alpha = 1 / (1 - p.c);

  const bVals = [p.b / 2, p.b, p.b * 2];
  const hVals = [p.h / 3, p.h, p.h * 3];
  const cell = (b: number, h: number) => {
    const s: EconomySpec = { ...spec, params: { ...p, b, h } };
    if (validateSpec(s).some((x) => x.severity === 'error')) return null;
    const mm = computeMultipliers(s);
    return { fiscal: mm.dY_dG * DG, monetary: mm.dY_dRealMoney * DM };
  };

  return (
    <>
      <div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 16 }}>{t('sens.title')}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12.5 }}>{t('sens.subtitle')}</p>
      </div>
      {sim.e1.spec.regime === 'interest-target' && <p className="note">{t('sens.targetNote')}</p>}
      <div className="grid-2">
        {(
          [
            ['b', bProfile, t('sens.b.title'), `b (${t('unit.bnPerPp')})`],
            ['h', hProfile, t('sens.h.title'), `h (${t('unit.bnPerPp')})`],
          ] as const
        ).map(([param, pts, title, xl]) => (
          <div className="card" key={param}>
            <div className="card-head">
              <div>
                <h3>{title}</h3>
              </div>
              <div className="chart-legend">
                <LegendLine color={FISCAL} label={t('sens.fiscal')} />
                <LegendLine color={MONETARY} label={t('sens.monetary')} />
                <LegendLine color="var(--text-muted)" dashed label={t('sens.keynesian')} />
              </div>
            </div>
            <div className="card-body">
              <ProfileChart points={pts} current={p[param]} keynesian={alpha} xLabel={xl} param={param} />
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-head">
          <div>
            <h3>{t('sens.grid.title')}</h3>
            <p>{t('sens.grid.desc', { dG: String(DG), dm: String(DM) })}</p>
          </div>
        </div>
        <div className="card-body table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">b \ h</th>
                {hVals.map((h) => (
                  <th scope="col" key={h} colSpan={2}>h = {f(h, 'n1')}</th>
                ))}
              </tr>
              <tr>
                <th scope="col"></th>
                {hVals.map((h) => (
                  <Fragment key={h}>
                    <th scope="col">{t('sens.grid.fiscal')}</th>
                    <th scope="col">{t('sens.grid.monetary')}</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {bVals.map((b) => (
                <tr key={b}>
                  <th scope="row">b = {f(b, 'n1')}</th>
                  {hVals.map((h) => {
                    const c = cell(b, h);
                    return (
                      <Fragment key={h}>
                        <td className="num" style={{ fontWeight: b === p.b && h === p.h ? 700 : undefined }}>{c ? f(c.fiscal, 'sbn') : '—'}</td>
                        <td className="num" style={{ fontWeight: b === p.b && h === p.h ? 700 : undefined }}>{c ? f(c.monetary, 'sbn') : '—'}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 10 }}>{t('sens.reading')}</p>
        </div>
      </div>
    </>
  );
}
