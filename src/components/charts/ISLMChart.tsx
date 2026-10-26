import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { isOutputAt, isRateAt, lmOutputAt, lmRateAt, type EconomySpec, type SolvedEconomy } from '../../engine';
import { useI18n } from '../../i18n';
import { AxisBottom, AxisLeft, Tooltip } from './common';
import { clipSegment, paddedExtent, useWidth, type Margin } from './utils';

export interface SavedOverlay {
  id: string;
  name: string;
  color: string;
  e1: SolvedEconomy;
}

interface Props {
  e0: SolvedEconomy;
  e1: SolvedEconomy;
  showInitial: boolean;
  showShifted: boolean;
  showGuides: boolean;
  saved: SavedOverlay[];
}

const MARGIN: Margin = { top: 16, right: 56, bottom: 44, left: 54 };
const IS_COLOR = 'var(--series-is)';
const LM_COLOR = 'var(--series-lm)';

type Line = [number, number, number, number]; // x0, y0, x1, y1 in data space (Y, i)

function isLine(spec: EconomySpec, iLo: number, iHi: number): Line {
  return [isOutputAt(spec.params, iLo), iLo, isOutputAt(spec.params, iHi), iHi];
}
function lmLine(spec: EconomySpec, iLo: number, iHi: number, yLo: number, yHi: number): Line {
  if (spec.regime === 'interest-target') return [yLo, spec.targetRate, yHi, spec.targetRate];
  return [lmOutputAt(spec.params, iLo), iLo, lmOutputAt(spec.params, iHi), iHi];
}
function sameLine(a: Line, b: Line) {
  return a.every((v, k) => Math.abs(v - b[k]!) < 1e-9);
}

export function ISLMChart({ e0, e1, showInitial, showShifted, showGuides, saved }: Props) {
  const { t, f } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const height = Math.round(Math.min(560, Math.max(320, width * 0.6)));
  const w = width - MARGIN.left - MARGIN.right;
  const h = height - MARGIN.top - MARGIN.bottom;
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);

  const q0 = e0.equilibrium;
  const q1 = e1.equilibrium;
  const keynesY = isOutputAt(e1.spec.params, q0.i);

  const { x, y, yDomain, iDomain } = useMemo(() => {
    const ys = [q0.Y, q1.Y, keynesY, ...saved.map((s) => s.e1.equilibrium.Y)];
    const is = [q0.i, q1.i, ...saved.map((s) => s.e1.equilibrium.i)];
    const [ylo, yhi] = paddedExtent(ys, Math.max(150, q0.Y * 0.28), 0.25);
    const [ilo, ihi] = paddedExtent(is, 3, 0.35);
    const xs = scaleLinear().domain([Math.max(0, ylo), yhi]).range([0, w]).nice(8);
    const ysc = scaleLinear().domain([ilo, ihi]).range([h, 0]).nice(8);
    return { x: xs, y: ysc, yDomain: xs.domain() as [number, number], iDomain: ysc.domain() as [number, number] };
  }, [q0.Y, q1.Y, q0.i, q1.i, keynesY, saved, w, h]);

  const [iLo, iHi] = iDomain;
  const [yLo, yHi] = yDomain;
  const is0 = isLine(e0.spec, iLo, iHi);
  const is1 = isLine(e1.spec, iLo, iHi);
  const lm0 = lmLine(e0.spec, iLo, iHi, yLo, yHi);
  const lm1 = lmLine(e1.spec, iLo, iHi, yLo, yHi);
  const isMoved = !sameLine(is0, is1);
  const lmMoved = !sameLine(lm0, lm1);

  const toPx = (l: Line): Line => [x(l[0]), y(l[1]), x(l[2]), y(l[3])];
  const clip = (l: Line) => {
    const p = toPx(l);
    return clipSegment(p[0], p[1], p[2], p[3], 0, w, 0, h);
  };

  // Curve-end labels placed so far in this render, used to avoid overlaps (e.g. LM₀ / LM₁ at the top edge).
  const placed: { x: number; y: number }[] = [];

  function renderLine(l: Line, color: string, dashed: boolean, label: string, key: string, opacity = 1, labelAt: 'right' | 'top' = 'right') {
    const c = clip(l);
    if (!c) return null;
    const [ax, ay, bx, by] = c;
    // Label at the end that is further right (or higher, for near-vertical lines).
    const useA = labelAt === 'right' ? ax > bx : ay < by;
    const lx = Math.min((useA ? ax : bx) + 6, w + 4);
    let ly = Math.max(10, Math.min(h - 14, useA ? ay : by));
    if (label) {
      while (placed.some((p) => Math.abs(p.x - lx) < 34 && Math.abs(p.y - ly) < 14)) ly += 14;
      placed.push({ x: lx, y: ly });
    }
    return (
      <g key={key} opacity={opacity}>
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={dashed ? 1.4 : 2} strokeDasharray={dashed ? '5 4' : undefined} strokeLinecap="round" />
        {label && (
          <text x={lx} y={ly} dy="0.32em" fontFamily="var(--font-sans)" fontStyle="italic" fontSize={14} fontWeight={500} fill="var(--text-primary)">
            {label}
          </text>
        )}
      </g>
    );
  }

  function arrow(x0: number, x1: number, yy: number, color: string, key: string) {
    if (Math.abs(x1 - x0) < 8) return null;
    const dirn = x1 > x0 ? 1 : -1;
    const tip = x1 - dirn * 4;
    return (
      <g key={key} stroke={color} fill={color}>
        <line x1={x0 + dirn * 6} y1={yy} x2={tip - dirn * 6} y2={yy} strokeWidth={1.5} />
        <path d={`M ${tip} ${yy} l ${-dirn * 8} -4.5 l 0 9 z`} stroke="none" />
      </g>
    );
  }

  const pxE0 = { x: x(q0.Y), y: y(q0.i) };
  const pxE1 = { x: x(q1.Y), y: y(q1.i) };
  const moved = Math.hypot(pxE1.x - pxE0.x, pxE1.y - pxE0.y) > 1;

  // Hover: tooltip with the rates on each visible curve at the hovered Y, or equilibrium details near a point.
  let tooltip: React.ReactNode = null;
  if (hover) {
    const near = [
      { name: 'E₀', p: pxE0, e: e0 },
      { name: 'E₁', p: pxE1, e: e1 },
      ...saved.map((s) => ({ name: s.name, p: { x: x(s.e1.equilibrium.Y), y: y(s.e1.equilibrium.i) }, e: s.e1 })),
    ].find((c) => Math.hypot(c.p.x - hover.px, c.p.y - hover.py) < 14);
    if (near) {
      const q = near.e.equilibrium;
      tooltip = (
        <Tooltip x={hover.px + MARGIN.left} y={hover.py + MARGIN.top} width={width}>
          <div className="tt-title">{t('chart.tooltip.eq', { name: near.name })}</div>
          <div className="tt-row"><span>Y</span><span>{f(q.Y, 'bn')}</span></div>
          <div className="tt-row"><span>i</span><span>{f(q.i, 'rate')}</span></div>
          <div className="tt-row"><span>C</span><span>{f(q.C, 'bn')}</span></div>
          <div className="tt-row"><span>I</span><span>{f(q.I, 'bn')}</span></div>
          <div className="tt-row"><span>G</span><span>{f(q.G, 'bn')}</span></div>
          <div className="tt-row"><span>M/P</span><span>{f(q.realMoney, 'bn')}</span></div>
        </Tooltip>
      );
    } else {
      const Yh = x.invert(hover.px);
      const rows: { label: string; color: string; dashed: boolean; v: number | null }[] = [];
      const lmRate = (s: SolvedEconomy) => (s.spec.regime === 'interest-target' ? s.spec.targetRate : lmRateAt(s.spec.params, Yh));
      if (showInitial || !isMoved) rows.push({ label: isMoved ? 'IS₀' : 'IS', color: IS_COLOR, dashed: isMoved, v: isRateAt(e0.spec.params, Yh) });
      if (showShifted && isMoved) rows.push({ label: 'IS₁', color: IS_COLOR, dashed: false, v: isRateAt(e1.spec.params, Yh) });
      if (showInitial || !lmMoved) rows.push({ label: lmMoved ? 'LM₀' : 'LM', color: LM_COLOR, dashed: lmMoved, v: lmRate(e0) });
      if (showShifted && lmMoved) rows.push({ label: 'LM₁', color: LM_COLOR, dashed: false, v: lmRate(e1) });
      tooltip = (
        <Tooltip x={hover.px + MARGIN.left} y={hover.py + MARGIN.top} width={width}>
          <div className="tt-title">{t('chart.tooltip.at', { Y: f(Yh, 'bn') })}</div>
          {rows.map((r) => (
            <div className="tt-row" key={r.label}>
              <span className="tt-key">
                <span className={`legend-swatch${r.dashed ? ' dashed' : ''}`} style={{ color: r.color }} />
                {r.label}
              </span>
              <span>{r.v === null ? '—' : f(r.v, 'rate')}</span>
            </div>
          ))}
        </Tooltip>
      );
    }
  }

  const label = (base: string, moved: boolean, sub: '₀' | '₁') => (moved ? `${base}${sub}` : base);

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={t('chart.aria', { Y0: f(q0.Y, 'bn'), i0: f(q0.i, 'rate'), Y1: f(q1.Y, 'bn'), i1: f(q1.i, 'rate') })}
      >
        <defs>
          <clipPath id="plot-clip">
            <rect x={0} y={0} width={w} height={h} />
          </clipPath>
        </defs>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          <rect className="plot-area" x={0} y={0} width={w} height={h} fill="none" pointerEvents="none" />
          <g transform={`translate(0,${h})`}>
            <AxisBottom scale={x} gridLength={h} ticks={Math.max(3, Math.floor(w / 90))} label={t('chart.x')} />
          </g>
          <AxisLeft scale={y} gridLength={w} ticks={7} format={(v) => f(v, 'n0')} label={t('chart.y')} />
          {iLo < 0 && iHi > 0 && <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1.25} />}

          <g clipPath="url(#plot-clip)">
            {/* Saved scenarios (behind the current curves) */}
            {saved.map((s) => {
              const lIS = isLine(s.e1.spec, iLo, iHi);
              const lLM = lmLine(s.e1.spec, iLo, iHi, yLo, yHi);
              return (
                <g key={s.id}>
                  {renderLine(lIS, s.color, false, '', `${s.id}-is`, 0.75)}
                  {renderLine(lLM, s.color, false, '', `${s.id}-lm`, 0.75)}
                </g>
              );
            })}

            {/* Guides: drop lines and shift arrows */}
            {showGuides && (
              <g stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="2 4">
                <line x1={pxE0.x} x2={pxE0.x} y1={pxE0.y} y2={h} />
                <line x1={0} x2={pxE0.x} y1={pxE0.y} y2={pxE0.y} />
                {moved && <line x1={pxE1.x} x2={pxE1.x} y1={pxE1.y} y2={h} />}
                {moved && <line x1={0} x2={pxE1.x} y1={pxE1.y} y2={pxE1.y} />}
              </g>
            )}
          </g>

          {/* Curves */}
          {isMoved ? (
            <>
              {showInitial && renderLine(is0, IS_COLOR, true, label('IS', true, '₀'), 'is0', 0.85)}
              {showShifted && renderLine(is1, IS_COLOR, false, label('IS', true, '₁'), 'is1')}
            </>
          ) : (
            renderLine(is0, IS_COLOR, false, 'IS', 'is')
          )}
          {lmMoved ? (
            <>
              {showInitial && renderLine(lm0, LM_COLOR, true, label('LM', true, '₀'), 'lm0', 0.85)}
              {showShifted && renderLine(lm1, LM_COLOR, false, label('LM', true, '₁'), 'lm1')}
            </>
          ) : (
            renderLine(lm0, LM_COLOR, false, 'LM', 'lm')
          )}

          {/* Shift arrows at the initial interest rate */}
          {showGuides && showInitial && showShifted && (
            <g>
              {isMoved && e0.spec.params.b === e1.spec.params.b && e0.spec.params.c === e1.spec.params.c &&
                arrow(x(isOutputAt(e0.spec.params, q0.i)), x(keynesY), y(q0.i) + 12, IS_COLOR, 'arr-is')}
              {lmMoved && e1.spec.regime === 'money-supply' && e0.spec.params.k === e1.spec.params.k && e0.spec.params.h === e1.spec.params.h &&
                arrow(x(lmOutputAt(e0.spec.params, q0.i)), x(lmOutputAt(e1.spec.params, q0.i)), y(q0.i) - 12, LM_COLOR, 'arr-lm')}
            </g>
          )}

          {/* Constant-rate (Keynesian) point: output on IS₁ at i₀ */}
          {showGuides && isMoved && Math.abs(q1.i - q0.i) > 1e-6 && keynesY >= yLo && keynesY <= yHi && (
            <g>
              <circle cx={x(keynesY)} cy={y(q0.i)} r={4.5} fill="var(--page)" stroke={IS_COLOR} strokeWidth={1.5} strokeDasharray="2 2" />
              <title>{t('chart.keynesian.desc')}</title>
            </g>
          )}

          {/* Saved equilibria */}
          {saved.map((s) => {
            const q = s.e1.equilibrium;
            return (
              <g key={`${s.id}-pt`} transform={`translate(${x(q.Y)},${y(q.i)})`}>
                <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" fill={s.color} stroke="var(--page)" strokeWidth={2} />
              </g>
            );
          })}

          {/* Equilibria */}
          <g>
            <circle cx={pxE0.x} cy={pxE0.y} r={5} fill="var(--page)" stroke="var(--eq0)" strokeWidth={1.6} />
            <text x={pxE0.x - 10} y={pxE0.y - 10} textAnchor="end" fontFamily="var(--font-sans)" fontStyle="italic" fontSize={14.5} fontWeight={500} fill="var(--text-secondary)">E₀</text>
            {moved && (
              <>
                <circle cx={pxE1.x} cy={pxE1.y} r={5.5} fill="var(--eq1)" stroke="var(--page)" strokeWidth={2} />
                <text x={pxE1.x + 10} y={pxE1.y - 10} fontFamily="var(--font-sans)" fontStyle="italic" fontSize={14.5} fontWeight={600} fill="var(--text-primary)">E₁</text>
              </>
            )}
          </g>

          {/* Axis value labels for equilibria */}
          {showGuides && (
            <g fontSize={10.5} className="num" fill="var(--text-secondary)">
              <text x={4} y={pxE0.y - 4}>{f(q0.i, 'rate')}</text>
              {moved && Math.abs(pxE1.y - pxE0.y) > 12 && <text x={4} y={pxE1.y - 4} fill="var(--text-primary)">{f(q1.i, 'rate')}</text>}
            </g>
          )}

          <rect
            x={0}
            y={0}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={(ev) => {
              const r = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
              const scale = r.width > 0 ? w / r.width : 1;
              setHover({ px: (ev.clientX - r.left) * scale, py: (ev.clientY - r.top) * scale });
            }}
            onPointerLeave={() => setHover(null)}
          />
          {hover && <line x1={hover.px} x2={hover.px} y1={0} y2={h} stroke="var(--text-muted)" strokeWidth={1} pointerEvents="none" opacity={0.5} />}
        </g>
      </svg>
      {tooltip}
    </div>
  );
}
