import { useState } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { useI18n } from '../../i18n';
import { Tooltip } from './common';
import { useWidth } from './utils';

/** Sequential single-hue ramp (sand → deep copper): readable on both themes, ordered by lightness. */
const RAMP = ['#f2e6d0', '#ead6b5', '#e2c39a', '#d9ae80', '#cf9868', '#c38253', '#b46c41', '#a15934', '#8a482a', '#713922', '#582c1b'];

function colorFor(t: number): string {
  const k = Math.max(0, Math.min(RAMP.length - 1, Math.round(t * (RAMP.length - 1))));
  return RAMP[k]!;
}

interface Props {
  xs: number[];
  ys: number[];
  z: (number | null)[][];
  xLabel: string;
  yLabel: string;
  valueLabel: string;
  ariaLabel: string;
  /** Current parameter values, marked with a ring. */
  current?: { x: number; y: number };
  format?: (v: number) => string;
}

/** Grid heat map of a model output over two parameters (each cell is a computed equilibrium). */
export function HeatMap({ xs, ys, z, xLabel, yLabel, valueLabel, ariaLabel, current, format }: Props) {
  const { f } = useI18n();
  const fmt = format ?? ((v: number) => f(v, 'n3'));
  const [ref, width] = useWidth<HTMLDivElement>(480);
  const m = { top: 10, right: 16, bottom: 44, left: 58 };
  const w = width - m.left - m.right;
  const h = Math.round(Math.min(420, Math.max(240, w * 0.7)));
  const height = h + m.top + m.bottom + 34;
  const x = scaleBand<number>().domain(xs.map((_, k) => k)).range([0, w]).paddingInner(0.04);
  const y = scaleBand<number>().domain(ys.map((_, k) => k)).range([h, 0]).paddingInner(0.04);
  const vals = z.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const norm = (v: number) => (hi - lo < 1e-12 ? 0.5 : (v - lo) / (hi - lo));
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const lx = scaleLinear().domain([lo, hi]).range([0, Math.min(260, w)]);
  const nearest = (arr: number[], v: number) => arr.reduce((best, a, k) => (Math.abs(a - v) < Math.abs(arr[best]! - v) ? k : best), 0);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel} xmlns="http://www.w3.org/2000/svg">
        <g transform={`translate(${m.left},${m.top})`}>
          {z.map((row, j) =>
            row.map((v, i) => (
              <rect
                key={`${i}-${j}`}
                x={x(i)}
                y={y(j)}
                width={x.bandwidth()}
                height={y.bandwidth()}
                rx={2}
                fill={v === null ? 'var(--surface-3)' : colorFor(norm(v))}
                stroke={hover && hover.i === i && hover.j === j ? 'var(--text-primary)' : 'none'}
                strokeWidth={1.5}
                onPointerEnter={() => setHover({ i, j })}
                onPointerLeave={() => setHover(null)}
              />
            )),
          )}
          {current && (
            <rect
              x={x(nearest(xs, current.x))! - 1.5}
              y={y(nearest(ys, current.y))! - 1.5}
              width={x.bandwidth() + 3}
              height={y.bandwidth() + 3}
              rx={3}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth={2.5}
            />
          )}
          {xs.map((v, i) =>
            i % Math.ceil(xs.length / 6) === 0 ? (
              <text key={`x${i}`} x={x(i)! + x.bandwidth() / 2} y={h + 14} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)" className="num">
                {f(v, 'n1')}
              </text>
            ) : null,
          )}
          {ys.map((v, j) =>
            j % Math.ceil(ys.length / 6) === 0 ? (
              <text key={`y${j}`} x={-6} y={y(j)! + y.bandwidth() / 2} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--text-muted)" className="num">
                {f(v, 'n1')}
              </text>
            ) : null,
          )}
          <text x={w / 2} y={h + 32} textAnchor="middle" fontSize={11.5} fill="var(--text-secondary)">{xLabel}</text>
          <text transform={`translate(-44,${h / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--text-secondary)">{yLabel}</text>
          <g transform={`translate(0,${h + 42})`}>
            <defs>
              <linearGradient id="hm-grad" x1="0" x2="1" y1="0" y2="0">
                {RAMP.map((c, k) => (
                  <stop key={c} offset={`${(k / (RAMP.length - 1)) * 100}%`} stopColor={c} />
                ))}
              </linearGradient>
            </defs>
            <rect x={0} y={0} width={lx.range()[1]!} height={8} rx={2} fill="url(#hm-grad)" />
            <text x={0} y={22} fontSize={10.5} fill="var(--text-muted)" className="num">{fmt(lo)}</text>
            <text x={lx.range()[1]!} y={22} textAnchor="end" fontSize={10.5} fill="var(--text-muted)" className="num">{fmt(hi)}</text>
            <text x={lx.range()[1]! + 10} y={8} fontSize={11} fill="var(--text-secondary)">{valueLabel}</text>
          </g>
        </g>
      </svg>
      {hover && (
        <Tooltip x={m.left + x(hover.i)! + x.bandwidth()} y={m.top + y(hover.j)!} width={width}>
          <div className="tt-title">{valueLabel}</div>
          <div className="tt-row"><span>{xLabel}</span><span>{f(xs[hover.i]!, 'n2')}</span></div>
          <div className="tt-row"><span>{yLabel}</span><span>{f(ys[hover.j]!, 'n2')}</span></div>
          <div className="tt-row"><span>{valueLabel}</span><span>{z[hover.j]![hover.i] === null ? '—' : fmt(z[hover.j]![hover.i]!)}</span></div>
        </Tooltip>
      )}
    </div>
  );
}
