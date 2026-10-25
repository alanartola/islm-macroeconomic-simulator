import { useId, useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { useI18n } from '../../i18n';
import { AxisBottom, AxisLeft, Tooltip } from './common';
import { useWidth, type Margin } from './utils';

export type Pt = [number, number];

export interface XYSeries {
  id: string;
  points: Pt[];
  color: string;
  dash?: 'dash' | 'dot';
  width?: number;
  /** Label drawn at the visible end of the curve. */
  label?: string;
  opacity?: number;
  /** Included in the hover read-out (default true). */
  hover?: boolean;
}

export interface XYMarker {
  id: string;
  x: number;
  y: number;
  label?: string;
  kind: 'e0' | 'e1' | 'point' | 'ghost';
  color?: string;
  rows?: [string, string][];
}

export interface XYBand {
  id: string;
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  color: string;
  label?: string;
}

export interface XYSegment {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  dash?: 'dash' | 'dot';
  arrow?: boolean;
  width?: number;
}

export interface XYChartProps {
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  series: XYSeries[];
  markers?: XYMarker[];
  bands?: XYBand[];
  segments?: XYSegment[];
  ariaLabel: string;
  aspect?: number;
  minHeight?: number;
  maxHeight?: number;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  /** Formats the hover read-out values. */
  valueFormat?: (v: number) => string;
  nice?: boolean;
}

const MARGIN: Margin = { top: 14, right: 58, bottom: 44, left: 56 };

/** Linear interpolation of a polyline at x (null when x is outside every segment). */
function valueAt(points: Pt[], x: number): number | null {
  for (let k = 1; k < points.length; k += 1) {
    const [x0, y0] = points[k - 1]!;
    const [x1, y1] = points[k]!;
    if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)) {
      if (x1 === x0) return y0;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return null;
}

/**
 * General-purpose linear-axes chart used by the advanced modules: polylines
 * (any curve sampled from the model), equilibrium markers, shaded regions,
 * guide segments and a crosshair read-out of every curve at the hovered x.
 */
export function XYChart(props: XYChartProps) {
  const { f } = useI18n();
  const { xDomain, yDomain, series, markers = [], bands = [], segments = [], aspect = 0.62, minHeight = 260, maxHeight = 520 } = props;
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const height = Math.round(Math.max(minHeight, Math.min(maxHeight, width * aspect)));
  const w = width - MARGIN.left - MARGIN.right;
  const h = height - MARGIN.top - MARGIN.bottom;
  const clipId = useId().replace(/:/g, '');
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);

  const { x, y } = useMemo(() => {
    const xs = scaleLinear().domain(xDomain).range([0, w]);
    const ys = scaleLinear().domain(yDomain).range([h, 0]);
    if (props.nice !== false) {
      xs.nice(6);
      ys.nice(6);
    }
    return { x: xs, y: ys };
  }, [xDomain, yDomain, w, h, props.nice]);

  const fmt = props.valueFormat ?? ((v: number) => f(v, 'n2'));
  const path = line<Pt>()
    .x((p) => x(p[0]))
    .y((p) => y(p[1]))
    .defined((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

  const [xd0, xd1] = x.domain() as [number, number];
  const [yd0, yd1] = y.domain() as [number, number];
  const inside = (p: Pt) => p[0] >= xd0 && p[0] <= xd1 && p[1] >= yd0 && p[1] <= yd1;

  // Curve-end labels with simple collision avoidance.
  const placed: { x: number; y: number }[] = [];
  const labelFor = (s: XYSeries) => {
    if (!s.label) return null;
    const vis = s.points.filter(inside);
    if (vis.length === 0) return null;
    const last = vis.reduce((a, b) => (x(b[0]) > x(a[0]) ? b : a));
    // Labels that would overflow the right margin are drawn inside the plot, right-aligned.
    const estWidth = s.label.length * 6.6;
    const overflow = x(last[0]) + 6 + estWidth > w + MARGIN.right - 2;
    const lx = overflow ? Math.min(x(last[0]), w) - 4 : Math.min(x(last[0]) + 6, w + 4);
    let ly = Math.max(10, Math.min(h - 4, y(last[1]) - (overflow ? 10 : 0)));
    while (placed.some((p) => Math.abs(p.x - lx) < 40 && Math.abs(p.y - ly) < 13)) ly += 13;
    placed.push({ x: lx, y: ly });
    return (
      <text key={`${s.id}-lbl`} x={lx} y={ly} dy="0.32em" textAnchor={overflow ? 'end' : 'start'} fontSize={11.5} fontWeight={600} fill="var(--text-primary)">
        {s.label}
      </text>
    );
  };

  let tooltip: React.ReactNode = null;
  if (hover) {
    const near = markers.find((m) => m.rows && Math.hypot(x(m.x) - hover.px, y(m.y) - hover.py) < 14);
    if (near) {
      tooltip = (
        <Tooltip x={x(near.x) + MARGIN.left} y={y(near.y) + MARGIN.top} width={width}>
          <div className="tt-title">{near.label}</div>
          {near.rows!.map(([k, v]) => (
            <div className="tt-row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </Tooltip>
      );
    } else {
      const xv = x.invert(hover.px);
      const rows = series
        .filter((s) => s.hover !== false && s.label)
        .map((s) => ({ s, v: valueAt(s.points, xv) }))
        .filter((r) => r.v !== null);
      if (rows.length) {
        tooltip = (
          <Tooltip x={hover.px + MARGIN.left} y={hover.py + MARGIN.top} width={width}>
            <div className="tt-title">
              {props.xLabel.split('(')[0]!.trim()} = {(props.xFormat ?? fmt)(xv)}
            </div>
            {rows.map(({ s, v }) => (
              <div className="tt-row" key={s.id}>
                <span className="tt-key">
                  <span className={`legend-swatch${s.dash ? ' dashed' : ''}`} style={{ color: s.color }} />
                  {s.label}
                </span>
                <span>{fmt(v!)}</span>
              </div>
            ))}
          </Tooltip>
        );
      }
    }
  }

  const dashArray = (d?: 'dash' | 'dot') => (d === 'dash' ? '6 5' : d === 'dot' ? '2 3' : undefined);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={props.ariaLabel} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={w} height={h} />
          </clipPath>
          <marker id={`${clipId}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
          </marker>
        </defs>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <g clipPath={`url(#${clipId})`}>
            {bands.map((b) => {
              const bx0 = x(b.x0 ?? xd0);
              const bx1 = x(b.x1 ?? xd1);
              const by0 = y(b.y1 ?? yd1);
              const by1 = y(b.y0 ?? yd0);
              return (
                <g key={b.id}>
                  <rect x={Math.min(bx0, bx1)} y={Math.min(by0, by1)} width={Math.abs(bx1 - bx0)} height={Math.abs(by1 - by0)} fill={b.color} />
                  {b.label && Math.abs(bx1 - bx0) > b.label.length * 6.2 + 10 && (
                    <text x={Math.min(bx0, bx1) + 6} y={Math.min(by0, by1) + 14} fontSize={10.5} fill="var(--text-muted)" fontWeight={600}>
                      {b.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g transform={`translate(0,${h})`}>
            <AxisBottom scale={x} gridLength={h} ticks={Math.max(3, Math.floor(w / 85))} label={props.xLabel} format={props.xFormat} />
          </g>
          <AxisLeft scale={y} gridLength={w} ticks={6} label={props.yLabel} format={props.yFormat} />
          {yd0 < 0 && yd1 > 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1.2} />}
          {xd0 < 0 && xd1 > 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={h} stroke="var(--axis)" strokeWidth={1.2} />}
          <g clipPath={`url(#${clipId})`}>
            {segments.map((sg) => (
              <line
                key={sg.id}
                x1={x(sg.x0)}
                y1={y(sg.y0)}
                x2={x(sg.x1)}
                y2={y(sg.y1)}
                stroke={sg.color}
                strokeWidth={sg.width ?? 1.2}
                strokeDasharray={dashArray(sg.dash)}
                markerEnd={sg.arrow ? `url(#${clipId}-arrow)` : undefined}
              />
            ))}
            {series.map((s) => (
              <path
                key={s.id}
                d={path(s.points) ?? ''}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? (s.dash ? 1.7 : 2.2)}
                strokeDasharray={dashArray(s.dash)}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={s.opacity ?? 1}
              />
            ))}
          </g>
          {series.map(labelFor)}
          {markers.filter((m) => inside([m.x, m.y])).map((m) => {
            const cx = x(m.x);
            const cy = y(m.y);
            if (m.kind === 'ghost') {
              return <circle key={m.id} cx={cx} cy={cy} r={4.5} fill="var(--surface-1)" stroke={m.color ?? 'var(--text-muted)'} strokeWidth={1.5} strokeDasharray="2 2" />;
            }
            if (m.kind === 'point') {
              return (
                <g key={m.id}>
                  <circle cx={cx} cy={cy} r={4.5} fill={m.color ?? 'var(--series-3)'} stroke="var(--surface-1)" strokeWidth={1.5} />
                  {m.label && (
                    <text x={cx + 7} y={cy - 7} fontSize={11} fontWeight={600} fill="var(--text-primary)">
                      {m.label}
                    </text>
                  )}
                </g>
              );
            }
            const filled = m.kind === 'e1';
            return (
              <g key={m.id}>
                <circle cx={cx} cy={cy} r={6} fill={filled ? 'var(--eq1)' : 'var(--surface-1)'} stroke={filled ? 'var(--surface-1)' : 'var(--eq0)'} strokeWidth={2} />
                {m.label && (
                  <text x={filled ? cx + 9 : cx - 9} y={cy - 9} textAnchor={filled ? 'start' : 'end'} fontSize={12} fontWeight={700} fill="var(--text-primary)">
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={(ev) => {
              const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
              const sc = r.width > 0 ? w / r.width : 1;
              setHover({ px: (ev.clientX - r.left) * sc, py: (ev.clientY - r.top) * sc });
            }}
            onPointerLeave={() => setHover(null)}
          />
          {hover && <line x1={hover.px} x2={hover.px} y1={0} y2={h} stroke="var(--text-muted)" strokeWidth={1} opacity={0.5} pointerEvents="none" />}
        </g>
      </svg>
      {tooltip}
    </div>
  );
}
