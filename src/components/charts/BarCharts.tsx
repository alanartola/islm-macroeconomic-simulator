import { useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { useI18n } from '../../i18n';
import { Tooltip } from './common';
import { useWidth } from './utils';

export interface GroupedDatum {
  label: string;
  a: number;
  b: number;
}

/** Vertical grouped bars: two series (E₀, E₁) per category. */
export function GroupedBars({ data, aLabel, bLabel, ariaLabel }: { data: GroupedDatum[]; aLabel: string; bLabel: string; ariaLabel: string }) {
  const { f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const height = 250;
  const m = { top: 12, right: 12, bottom: 30, left: 52 };
  const w = width - m.left - m.right;
  const h = height - m.top - m.bottom;
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const min = Math.min(0, ...data.flatMap((d) => [d.a, d.b]));
  const y = scaleLinear().domain([min, max]).range([h, 0]).nice(5);
  const band = w / data.length;
  const bw = Math.min(34, (band - 18) / 2);
  const [hover, setHover] = useState<{ x: number; y: number; d: GroupedDatum } | null>(null);

  return (
    <div className="chart-wrap" ref={ref}>
      <div className="chart-legend" style={{ marginBottom: 6 }}>
        <span className="legend-item"><span className="legend-dot" style={{ color: 'var(--axis)' }} />{aLabel}</span>
        <span className="legend-item"><span className="legend-dot" style={{ color: 'var(--series-is)' }} />{bLabel}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel}>
        <g transform={`translate(${m.left},${m.top})`}>
          {y.ticks(5).map((v) => (
            <g key={v} transform={`translate(0,${y(v)})`}>
              <line x1={0} x2={w} stroke="var(--grid)" />
              <text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-muted)" className="num">{f(v, 'n0')}</text>
            </g>
          ))}
          <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
          {data.map((d, k) => {
            const cx = band * k + band / 2;
            const bar = (v: number, dx: number, fill: string) => {
              const top = Math.min(y(v), y(0));
              const hh = Math.max(1, Math.abs(y(v) - y(0)));
              return <rect x={cx + dx} y={top} width={bw} height={hh} rx={3} fill={fill} />;
            };
            return (
              <g key={d.label} onPointerEnter={() => setHover({ x: cx + m.left, y: y(Math.max(d.a, d.b)) + m.top, d })} onPointerLeave={() => setHover(null)}>
                <rect x={cx - band / 2} y={0} width={band} height={h} fill="transparent" />
                {bar(d.a, -bw - 1, 'var(--axis)')}
                {bar(d.b, 1, 'var(--series-is)')}
                <text x={cx} y={h + 18} textAnchor="middle" fontSize={12} fill="var(--text-secondary)" fontWeight={600}>{d.label}</text>
              </g>
            );
          })}
        </g>
      </svg>
      {hover && (
        <Tooltip x={hover.x} y={hover.y} width={width}>
          <div className="tt-title">{hover.d.label}</div>
          <div className="tt-row"><span>{aLabel}</span><span>{f(hover.d.a, 'bn')}</span></div>
          <div className="tt-row"><span>{bLabel}</span><span>{f(hover.d.b, 'bn')}</span></div>
          <div className="tt-row"><span>Δ</span><span>{f(hover.d.b - hover.d.a, 'sbn')}</span></div>
        </Tooltip>
      )}
    </div>
  );
}

export interface DeltaDatum {
  label: string;
  value: number;
  emphasis?: boolean;
}

/** Horizontal diverging bars for signed changes (blue = increase, red = decrease). */
export function DeltaBars({ data, ariaLabel, format = 'sbn' }: { data: DeltaDatum[]; ariaLabel: string; format?: string }) {
  const { f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const row = 26;
  const m = { top: 6, right: 78, bottom: 6, left: 156 };
  const height = m.top + m.bottom + row * data.length;
  const w = width - m.left - m.right;
  const ext = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const x = scaleLinear().domain([-ext, ext]).range([0, w]);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel}>
        <g transform={`translate(${m.left},${m.top})`}>
          <line x1={x(0)} x2={x(0)} y1={0} y2={row * data.length} stroke="var(--axis)" />
          {data.map((d, k) => {
            const yy = k * row;
            const v = Math.abs(d.value) < 1e-9 ? 0 : d.value;
            const x0 = Math.min(x(0), x(v));
            const bwidth = Math.abs(x(v) - x(0));
            // Sign of the change: the same convention as every Δ figure in the laboratory.
            const color = v >= 0 ? 'var(--up)' : 'var(--down)';
            return (
              <g key={d.label} transform={`translate(0,${yy})`}>
                <text x={-10} y={row / 2} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--text-secondary)" fontWeight={d.emphasis ? 700 : 400}>{d.label}</text>
                {bwidth > 0.5 && <rect x={x0} y={5} width={bwidth} height={row - 10} rx={3} fill={color} />}
                <text
                  x={w + 8}
                  y={row / 2}
                  dy="0.32em"
                  textAnchor="start"
                  fontSize={11.5}
                  className="num"
                  fill="var(--text-primary)"
                  fontWeight={d.emphasis ? 700 : 500}
                >
                  {f(v, format)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
