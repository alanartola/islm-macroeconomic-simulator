import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { useI18n } from '../../i18n';
import { AxisBottom, AxisLeft, Tooltip } from './common';
import { clipSegment, useWidth, type Margin } from './utils';
import { frameXY } from './XYChart';

export interface PanelLine {
  id: string;
  /** Segment end points in data coordinates. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  dashed?: boolean;
  dotted?: boolean;
  label?: string;
  opacity?: number;
}

export interface PanelPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  filled: boolean;
  /** Rows shown in the tooltip when hovering the point. */
  rows: [string, string][];
}

interface Props {
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  lines: PanelLine[];
  points: PanelPoint[];
  yFormat?: (v: number) => string;
  ariaLabel: string;
  aspect?: number;
}

const MARGIN: Margin = { top: 12, right: 44, bottom: 42, left: 52 };

/** Small linear chart used by the transmission panels (all relationships are linear). */
export function PanelChart({ xDomain, yDomain, xLabel, yLabel, lines, points, yFormat, ariaLabel, aspect = 0.78 }: Props) {
  const { f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const height = Math.round(Math.max(240, Math.min(360, width * aspect)));
  const w = width - MARGIN.left - MARGIN.right;
  const h = height - MARGIN.top - MARGIN.bottom;
  // Every point stays inside the frame, whatever window the caller proposes.
  const frame = frameXY(xDomain, yDomain, points);
  const x = scaleLinear().domain(frame.x).range([0, w]).nice(6);
  const y = scaleLinear().domain(frame.y).range([h, 0]).nice(6);
  const [hover, setHover] = useState<PanelPoint | null>(null);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <g transform={`translate(0,${h})`}>
            <AxisBottom scale={x} gridLength={h} ticks={Math.max(3, Math.floor(w / 80))} label={xLabel} />
          </g>
          <AxisLeft scale={y} gridLength={w} ticks={6} label={yLabel} format={yFormat ?? ((v) => f(v, 'n0'))} />
          {lines.map((l) => {
            const c = clipSegment(x(l.x0), y(l.y0), x(l.x1), y(l.y1), 0, w, 0, h);
            if (!c) return null;
            const [ax, ay, bx, by] = c;
            const right = ax > bx ? { x: ax, y: ay } : { x: bx, y: by };
            return (
              <g key={l.id} opacity={l.opacity ?? 1}>
                <line
                  x1={ax}
                  y1={ay}
                  x2={bx}
                  y2={by}
                  stroke={l.color}
                  strokeWidth={l.dashed || l.dotted ? 1.4 : 2}
                  strokeDasharray={l.dashed ? '5 4' : l.dotted ? '1.5 3' : undefined}
                  strokeLinecap="round"
                />
                {l.label && (
                  <text x={Math.min(right.x + 5, w + 2)} y={Math.max(9, Math.min(h - 3, right.y))} dy="0.32em" fontFamily="var(--font-sans)" fontStyle="italic" fontSize={13} fontWeight={500} fill="var(--text-primary)">
                    {l.label}
                  </text>
                )}
              </g>
            );
          })}
          {points.map((p) => (
            <g key={p.id} transform={`translate(${x(p.x)},${y(p.y)})`}>
              <circle r={p.filled ? 5 : 4.5} fill={p.filled ? 'var(--eq1)' : 'var(--page)'} stroke={p.filled ? 'var(--page)' : 'var(--eq0)'} strokeWidth={p.filled ? 2 : 1.6} />
              <text x={p.filled ? 8 : -8} y={-8} textAnchor={p.filled ? 'start' : 'end'} fontFamily="var(--font-sans)" fontStyle="italic" fontSize={13.5} fontWeight={500} fill="var(--text-primary)">
                {p.label}
              </text>
              <circle
                r={14}
                fill="transparent"
                onPointerEnter={() => setHover(p)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(p)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${p.label}: ${p.rows.map((r) => r.join(' ')).join(', ')}`}
              />
            </g>
          ))}
        </g>
      </svg>
      {hover && (
        <Tooltip x={x(hover.x) + MARGIN.left} y={y(hover.y) + MARGIN.top} width={width}>
          <div className="tt-title">{hover.label}</div>
          {hover.rows.map(([k, v]) => (
            <div className="tt-row" key={k}>
              <span>{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </Tooltip>
      )}
    </div>
  );
}
