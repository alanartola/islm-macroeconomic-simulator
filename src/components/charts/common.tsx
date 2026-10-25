import type { ReactNode } from 'react';
import type { ScaleLinear } from 'd3-scale';
import { useI18n } from '../../i18n';

interface AxisProps {
  scale: ScaleLinear<number, number>;
  /** Length of the perpendicular gridlines (plot height for x, plot width for y). */
  gridLength: number;
  ticks?: number;
  format?: (v: number) => string;
  label?: string;
}

/** Horizontal axis drawn at the bottom of the plot area (translate the group to y = plot height). */
export function AxisBottom({ scale, gridLength, ticks = 6, format, label }: AxisProps) {
  const { f } = useI18n();
  const fmt = format ?? ((v: number) => f(v, 'n0'));
  const [r0, r1] = scale.range() as [number, number];
  return (
    <g className="axis axis-x" aria-hidden="true">
      {scale.ticks(ticks).map((v) => (
        <g key={v} transform={`translate(${scale(v)},0)`}>
          <line y1={0} y2={-gridLength} stroke="var(--grid)" strokeWidth={1} />
          <line y1={0} y2={4} stroke="var(--axis)" />
          <text y={16} textAnchor="middle" fontSize={11} fill="var(--text-muted)" className="num">
            {fmt(v)}
          </text>
        </g>
      ))}
      <line x1={r0} x2={r1} stroke="var(--axis)" />
      {label && (
        <text x={(r0 + r1) / 2} y={34} textAnchor="middle" fontSize={11.5} fill="var(--text-secondary)">
          {label}
        </text>
      )}
    </g>
  );
}

/** Vertical axis drawn at x = 0 of the plot area. */
export function AxisLeft({ scale, gridLength, ticks = 6, format, label }: AxisProps) {
  const { f } = useI18n();
  const fmt = format ?? ((v: number) => f(v, 'n0'));
  const [r0, r1] = scale.range() as [number, number];
  return (
    <g className="axis axis-y" aria-hidden="true">
      {scale.ticks(ticks).map((v) => (
        <g key={v} transform={`translate(0,${scale(v)})`}>
          <line x1={0} x2={gridLength} stroke="var(--grid)" strokeWidth={1} />
          <line x1={-4} x2={0} stroke="var(--axis)" />
          <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)" className="num">
            {fmt(v)}
          </text>
        </g>
      ))}
      <line y1={r0} y2={r1} stroke="var(--axis)" />
      {label && (
        <text transform={`translate(-42,${(r0 + r1) / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill="var(--text-secondary)">
          {label}
        </text>
      )}
    </g>
  );
}

export function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  // Flip to the left of the cursor near the right edge.
  const flip = x > width - 230;
  const style: React.CSSProperties = {
    left: flip ? x - 14 : x + 14,
    top: Math.max(0, y - 10),
    transform: flip ? 'translateX(-100%)' : undefined,
  };
  return (
    <div className="tooltip" style={style} role="status">
      {children}
    </div>
  );
}

export function LegendLine({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="legend-item">
      <span className={`legend-swatch${dashed ? ' dashed' : ''}`} style={{ color }} />
      {label}
    </span>
  );
}
