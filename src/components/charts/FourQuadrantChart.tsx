import { useId, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import { useI18n } from '../../i18n';
import { Tooltip } from './common';
import { useWidth } from './utils';
import type { Pt } from './XYChart';

export type Quadrant = 1 | 2 | 3 | 4;

/** A curve drawn in one quadrant, in that quadrant's own positive coordinates. */
export interface QSeries {
  id: string;
  quadrant: Quadrant;
  /** Q1: (right, up) · Q2: (left, up) · Q3: (left, down) · Q4: (right, down). */
  points: Pt[];
  color: string;
  dash?: 'dash' | 'dot';
  label?: string;
}

/** Rectangle linking the four quadrants for one constructed point. */
export interface QConnector {
  id: string;
  left: number;
  down: number;
  right: number;
  up: number;
  color: string;
  label?: string;
  rows?: [string, string][];
}

interface Props {
  /** Domains of the four half-axes. `left` and `down` share one magnitude scale (45° in Q3). */
  right: [number, number];
  up: [number, number];
  side: number;
  labels: { right: string; up: string; left: string; down: string };
  quadrantTitles: [string, string, string, string];
  series: QSeries[];
  connectors: QConnector[];
  ariaLabel: string;
}

/**
 * Four-quadrant derivation diagram. The origin sits at the centre; the
 * horizontal axis measures `right` to the right and `left` (a magnitude) to the
 * left, the vertical axis `up` upwards and `down` (same magnitude scale as
 * `left`) downwards, so a 45° line in quadrant III maps equal magnitudes.
 */
export function FourQuadrantChart({ right, up, side, labels, quadrantTitles, series, connectors, ariaLabel }: Props) {
  const { f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const height = Math.round(Math.min(640, Math.max(380, width * 0.9)));
  const pad = { top: 22, right: 46, bottom: 30, left: 30 };
  const W = width - pad.left - pad.right;
  const H = height - pad.top - pad.bottom;
  // The left magnitude half and the bottom half must have equal pixel length.
  const half = Math.min(W * 0.42, H * 0.46);
  const ox = pad.left + half;
  const oy = pad.top + (H - half);
  const xr = scaleLinear().domain(right).range([ox, pad.left + W]);
  const yu = scaleLinear().domain(up).range([oy, pad.top]);
  const xl = scaleLinear().domain([0, side]).range([ox, ox - half]);
  const yd = scaleLinear().domain([0, side]).range([oy, oy + half]);
  const clip = useId().replace(/:/g, '');
  const [hover, setHover] = useState<QConnector | null>(null);

  const map = (q: Quadrant, [u, v]: Pt): Pt => {
    switch (q) {
      case 1:
        return [xr(u), yu(v)];
      case 2:
        return [xl(u), yu(v)];
      case 3:
        return [xl(u), yd(v)];
      default:
        return [xr(u), yd(v)];
    }
  };
  const path = line<Pt>().defined((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const dash = (d?: 'dash' | 'dot') => (d === 'dash' ? '6 5' : d === 'dot' ? '2 3' : undefined);
  const tickFmt = (v: number) => f(v, 'n0');

  const clipRect = (q: Quadrant) => {
    const x0 = q === 1 || q === 4 ? ox : ox - half;
    const x1 = q === 1 || q === 4 ? pad.left + W : ox;
    const y0 = q === 1 || q === 2 ? pad.top : oy;
    const y1 = q === 1 || q === 2 ? oy : oy + half;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  };

  return (
    <div className="chart-wrap" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={ariaLabel} xmlns="http://www.w3.org/2000/svg">
        <defs>
          {([1, 2, 3, 4] as Quadrant[]).map((q) => (
            <clipPath key={q} id={`${clip}-q${q}`}>
              <rect {...clipRect(q)} />
            </clipPath>
          ))}
        </defs>
        {/* Quadrant backgrounds and titles */}
        {([1, 2, 3, 4] as Quadrant[]).map((q) => {
          const r = clipRect(q);
          return (
            <g key={`bg${q}`}>
              <rect {...r} fill={q % 2 === 0 ? 'var(--surface-2)' : 'transparent'} opacity={0.6} />
              <text x={q === 1 || q === 4 ? r.x + r.width - 6 : r.x + 6} y={q <= 2 ? r.y + 14 : r.y + r.height - 6} textAnchor={q === 1 || q === 4 ? 'end' : 'start'} fontSize={10.5} fill="var(--text-muted)" fontWeight={600}>
                {quadrantTitles[q - 1]}
              </text>
            </g>
          );
        })}
        {/* Axes */}
        <line x1={ox - half} x2={pad.left + W} y1={oy} y2={oy} stroke="var(--axis)" />
        <line x1={ox} x2={ox} y1={pad.top} y2={oy + half} stroke="var(--axis)" />
        {xr.ticks(5).filter((v) => v !== right[0]).map((v) => (
          <text key={`xr${v}`} x={xr(v)} y={oy + 13} textAnchor="middle" fontSize={10} fill="var(--text-muted)" className="num">{tickFmt(v)}</text>
        ))}
        {xl.ticks(4).filter((v) => v > 0).map((v) => (
          <text key={`xl${v}`} x={xl(v)} y={oy - 5} textAnchor="middle" fontSize={10} fill="var(--text-muted)" className="num">{tickFmt(v)}</text>
        ))}
        {yu.ticks(5).filter((v) => v !== up[0]).map((v) => (
          <text key={`yu${v}`} x={ox - 5} y={yu(v)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-muted)" className="num">{f(v, 'n1')}</text>
        ))}
        {yd.ticks(4).filter((v) => v > 0).map((v) => (
          <text key={`yd${v}`} x={ox + 5} y={yd(v)} dy="0.32em" fontSize={10} fill="var(--text-muted)" className="num">{tickFmt(v)}</text>
        ))}
        <text x={pad.left + W} y={oy + 26} textAnchor="end" fontSize={11} fill="var(--text-secondary)">{labels.right} →</text>
        <text x={ox - half} y={oy + 26} fontSize={11} fill="var(--text-secondary)">← {labels.left}</text>
        <text x={ox + 6} y={pad.top - 8} fontSize={11} fill="var(--text-secondary)">↑ {labels.up}</text>
        <text x={ox + 6} y={oy + half + 18} fontSize={11} fill="var(--text-secondary)">↓ {labels.down}</text>

        {/* Construction rectangles */}
        {connectors.map((c) => {
          const pts: Pt[] = [
            [xl(c.left), yu(c.up)],
            [xl(c.left), yd(c.down)],
            [xr(c.right), yd(c.down)],
            [xr(c.right), yu(c.up)],
            [xl(c.left), yu(c.up)],
          ];
          return (
            <g key={c.id} onPointerEnter={() => setHover(c)} onPointerLeave={() => setHover(null)}>
              <path d={path(pts) ?? ''} fill="none" stroke={c.color} strokeWidth={1.3} strokeDasharray="4 3" />
              <path d={path(pts) ?? ''} fill="none" stroke="transparent" strokeWidth={10} />
              {pts.slice(0, 4).map(([x, y], k) => (
                <circle key={k} cx={x} cy={y} r={k === 3 ? 5 : 3.2} fill={k === 3 ? c.color : 'var(--page)'} stroke={c.color} strokeWidth={1.5} />
              ))}
              {c.label && (
                <text x={xr(c.right) + 7} y={yu(c.up) - 7} fontFamily="var(--font-serif)" fontStyle="italic" fontSize={13} fontWeight={600} fill="var(--text-primary)">
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
        {/* Curves, clipped per quadrant */}
        {series.map((s) => (
          <g key={s.id} clipPath={`url(#${clip}-q${s.quadrant})`}>
            <path d={path(s.points.map((p) => map(s.quadrant, p))) ?? ''} fill="none" stroke={s.color} strokeWidth={2.1} strokeDasharray={dash(s.dash)} strokeLinecap="round" />
          </g>
        ))}
        {series
          .filter((s) => s.label)
          .map((s) => {
            const r = clipRect(s.quadrant);
            const vis = s.points.map((p) => map(s.quadrant, p)).filter(([x, y]) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
            if (!vis.length) return null;
            const end = s.quadrant === 1 || s.quadrant === 4 ? vis.reduce((a, b) => (b[0] > a[0] ? b : a)) : vis.reduce((a, b) => (b[0] < a[0] ? b : a));
            return (
              <text key={`${s.id}-l`} x={end[0] + (s.quadrant === 1 || s.quadrant === 4 ? 4 : -4)} y={end[1] - 4} textAnchor={s.quadrant === 1 || s.quadrant === 4 ? 'start' : 'end'} fontSize={11} fontWeight={600} fill="var(--text-primary)">
                {s.label}
              </text>
            );
          })}
      </svg>
      {hover?.rows && (
        <Tooltip x={xr(hover.right)} y={yu(hover.up)} width={width}>
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
