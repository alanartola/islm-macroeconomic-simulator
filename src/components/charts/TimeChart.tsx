import { useMemo, useState } from 'react';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { line } from 'd3-shape';
import { useI18n } from '../../i18n';
import { toTime, valueAtOrBefore, type Obs } from '../../data/core';
import { useWidth } from './utils';

export interface TimeLine {
  id: string;
  label: string;
  color: string;
  data: Obs[];
  dash?: boolean;
}

export interface TimePanel {
  id: string;
  title: string;
  unit: string;
  /** Vertical-axis title: variable and unit, e.g. "Tasa de interés (% TNA)". Defaults to the unit. */
  yLabel?: string;
  lines: TimeLine[];
  /** Number format for axis and read-out (i18n format code). */
  fmt?: string;
  /** Draw the first line as signed bars (flows such as the trade balance). */
  bars?: boolean;
}

export interface TimeMarker {
  id: string;
  date: string;
  label: string;
  active?: boolean;
}

interface Props {
  from: string;
  to: string;
  panels: TimePanel[];
  markers?: TimeMarker[];
  /** Shaded interval (e.g. the before/after window of an episode). */
  band?: { from: string; to: string } | null;
  onMarker?: (id: string) => void;
  ariaLabel: string;
  panelHeight?: number;
  /** Hides the per-panel title above the plot (single-variable charts already name it in the axis). */
  hideTitles?: boolean;
  /** 'all' draws a guide line for every event; 'active' only for the selected one (the rest stay as ticks on the date axis). */
  markerLines?: 'all' | 'active';
}

const M = { top: 22, right: 18, bottom: 6, left: 84 };
const AXIS_H = 40;

/** Keeps the shape of dense series: first, min, max and last point of every pixel bucket. */
function thin(points: Obs[], x: (d: string) => number, budget: number): Obs[] {
  if (points.length <= budget) return points;
  const out: Obs[] = [];
  let bucket = -1;
  let group: Obs[] = [];
  const flush = () => {
    if (!group.length) return;
    let lo = group[0]!;
    let hi = group[0]!;
    for (const p of group) {
      if (p[1] < lo[1]) lo = p;
      if (p[1] > hi[1]) hi = p;
    }
    const pick = [group[0]!, lo, hi, group[group.length - 1]!].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    for (const p of pick) if (out[out.length - 1] !== p) out.push(p);
    group = [];
  };
  for (const p of points) {
    const b = Math.floor(x(p[0]));
    if (b !== bucket) {
      flush();
      bucket = b;
    }
    group.push(p);
  }
  flush();
  return out;
}

/** Shortens a rotated axis title that would not fit the panel height (the full text stays in <title>). */
function fitLabel(text: string, length: number): string {
  const max = Math.max(8, Math.floor(length / 6.2));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * Synchronised time-series panels: each indicator keeps its own vertical axis
 * (no misleading shared scale for different units) while all panels share the
 * date axis, the hover read-out, episode markers and the highlighted window.
 */
export function TimeChart({ from, to, panels, markers = [], band, onMarker, ariaLabel, panelHeight = 132, hideTitles = false, markerLines = 'all' }: Props) {
  const { t, f, lang } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<string | null>(null);
  const w = Math.max(120, width - M.left - M.right);
  const x = useMemo(() => scaleUtc().domain([new Date(toTime(from)), new Date(toTime(to))]).range([0, w]), [from, to, w]);
  const xd = (d: string) => x(new Date(toTime(d)));
  const spanDays = (toTime(to) - toTime(from)) / 86_400_000;
  const dateFmt = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', spanDays > 900 ? { year: 'numeric', timeZone: 'UTC' } : spanDays > 120 ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const fullDate = new Intl.DateTimeFormat(lang === 'es' ? 'es-AR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const ticks = x.ticks(Math.max(3, Math.floor(w / 110)));
  // The date axis says which calendar unit its ticks show.
  const xLabel = t(spanDays > 900 ? 'chart.time.x.years' : spanDays > 120 ? 'chart.time.x.months' : 'chart.time.x.days');
  const height = panels.length * (panelHeight + M.top) + AXIS_H + M.bottom;
  const visibleMarkers = markers.filter((m) => m.date >= from && m.date <= to);

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * width - M.left;
    if (px < 0 || px > w) return setHover(null);
    setHover(x.invert(px).toISOString().slice(0, 10));
  };

  return (
    <div className="chart-wrap time-chart" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        xmlns="http://www.w3.org/2000/svg"
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        {panels.map((p, k) => {
          const top = k * (panelHeight + M.top) + M.top;
          const inWindow = p.lines.map((l) => l.data.filter(([d]) => d >= from && d <= to));
          const values = inWindow.flat().map((o) => o[1]);
          if (p.bars) values.push(0);
          const lo = values.length ? Math.min(...values) : 0;
          const hi = values.length ? Math.max(...values) : 1;
          const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
          // Series that are never negative (levels, rates above zero) do not get a negative axis.
          const y = scaleLinear().domain([lo >= 0 ? Math.max(0, lo - pad) : lo - pad, hi + pad]).range([panelHeight, 0]).nice(4);
          const fmt = (v: number) => f(v, p.fmt ?? 'n1');
          const path = line<Obs>().x((o) => xd(o[0])).y((o) => y(o[1]));
          const barW = Math.max(1, (w / Math.max(1, spanDays / 30.4)) * 0.7);
          return (
            <g key={p.id} transform={`translate(${M.left},${top})`}>
              {!hideTitles && (
                <text x={-M.left + 2} y={-8} fontSize={12} fontWeight={600} fill="var(--text-primary)">
                  {p.title}
                  {p.unit && <tspan fill="var(--text-muted)" fontWeight={400}> · {p.unit}</tspan>}
                </text>
              )}
              <text className="axis-title" transform={`translate(${-M.left + 14},${panelHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
                {fitLabel(p.yLabel ?? p.unit, panelHeight)}
                <title>{p.yLabel ?? p.unit}</title>
              </text>
              {y.ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x1={0} x2={w} stroke="var(--grid)" />
                  <text x={-6} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--text-muted)">
                    {fmt(t)}
                  </text>
                </g>
              ))}
              {lo < 0 && hi > 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--axis)" />}
              {band && band.to >= from && band.from <= to && (
                <rect x={Math.max(0, xd(band.from))} y={0} width={Math.max(1, Math.min(w, xd(band.to)) - Math.max(0, xd(band.from)))} height={panelHeight} fill="var(--accent-soft)" />
              )}
              {k === 0 && markerLines === 'active' && visibleMarkers.filter((m) => m.active).map((m) => (
                <text key={`lbl-${m.id}`} x={xd(m.date) + (xd(m.date) > w - 260 ? -6 : 6)} y={12} textAnchor={xd(m.date) > w - 260 ? 'end' : 'start'} fontSize={11.5} fontWeight={600} fill="var(--accent)" paintOrder="stroke" stroke="var(--surface-1)" strokeWidth={3}>
                  {m.label}
                </text>
              ))}
              {visibleMarkers.filter((m) => markerLines === 'all' || m.active).map((m) => (
                <line key={m.id} x1={xd(m.date)} x2={xd(m.date)} y1={0} y2={panelHeight} stroke={m.active ? 'var(--accent)' : 'var(--axis)'} strokeWidth={m.active ? 1.6 : 1} strokeDasharray={m.active ? undefined : '3 3'} />
              ))}
              {p.bars && p.lines[0]
                ? inWindow[0]!.map(([d, v]) => (
                    <rect key={d} x={xd(d) - barW / 2} width={barW} y={Math.min(y(0), y(v))} height={Math.max(0.5, Math.abs(y(v) - y(0)))} fill={v >= 0 ? 'var(--up)' : 'var(--down)'} opacity={0.85} />
                  ))
                : p.lines.map((l, j) => (
                    <path key={l.id} d={path(thin(inWindow[j]!, xd, w * 2)) ?? ''} fill="none" stroke={l.color} strokeWidth={1.7} strokeDasharray={l.dash ? '5 4' : undefined} strokeLinejoin="round" />
                  ))}
              {hover && (
                <g>
                  <line x1={xd(hover)} x2={xd(hover)} y1={0} y2={panelHeight} stroke="var(--text-muted)" opacity={0.6} />
                  {p.lines.map((l, j) => {
                    const o = valueAtOrBefore(l.data, hover);
                    if (!o || o[0] < from) return null;
                    const tx = xd(hover) > w - 170 ? xd(hover) - 8 : xd(hover) + 8;
                    return (
                      <text key={l.id} x={tx} y={12 + j * 14} textAnchor={xd(hover) > w - 170 ? 'end' : 'start'} fontSize={11} fill={l.color} fontWeight={600}>
                        {p.lines.length > 1 ? `${l.label}: ` : ''}
                        {fmt(o[1])} <tspan fill="var(--text-muted)" fontWeight={400}>({fullDate.format(new Date(toTime(o[0])))})</tspan>
                      </text>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
        <g transform={`translate(${M.left},${panels.length * (panelHeight + M.top) + M.top - 14})`}>
          <line x1={0} x2={w} stroke="var(--axis)" />
          {ticks.map((d) => (
            <g key={d.toISOString()} transform={`translate(${x(d)},0)`}>
              <line y1={0} y2={3} stroke="var(--axis)" />
              <text y={15} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                {dateFmt.format(d)}
              </text>
            </g>
          ))}
          <text className="axis-title" x={w / 2} y={33} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
            {xLabel}
          </text>
          {visibleMarkers.map((m) => (
            <g key={m.id} className="event-marker" transform={`translate(${xd(m.date)},0)`} style={{ cursor: onMarker ? 'pointer' : undefined }} onClick={() => onMarker?.(m.id)} data-event={m.id}>
              <title>{m.label}</title>
              <rect x={-7} y={-12} width={14} height={14} fill="transparent" />
              <path d="M -5 -1 L 5 -1 L 0 -8 z" fill={m.active ? 'var(--accent)' : 'var(--text-muted)'} />
            </g>
          ))}
        </g>
      </svg>
      {panels.length > 0 && (
        <div className="chart-legend time-legend">
          {panels.flatMap((p) =>
            p.lines.length > 1 && !p.bars
              ? p.lines.map((l) => (
                  <span className="legend-item" key={`${p.id}-${l.id}`}>
                    <span className={`legend-swatch${l.dash ? ' dashed' : ''}`} style={{ color: l.color }} />
                    {l.label}
                  </span>
                ))
              : [],
          )}
        </div>
      )}
    </div>
  );
}
