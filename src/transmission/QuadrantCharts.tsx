import type { ReactNode } from 'react';
import { scaleLinear, type ScaleLinear } from 'd3-scale';
import { isOutputAt, lmOutputAt } from '../engine';
import { useI18n } from '../i18n';
import { AxisBottom, AxisLeft } from '../components/charts/common';
import { clipSegment, paddedExtent } from '../components/charts/utils';
import { demandAt, plannedDemand, type Element, type TransmissionGeometry } from './model';

/** Identical margins in every cell: shared scales then map to the same pixels across cells. */
export const QM = { top: 22, right: 16, bottom: 40, left: 54 };

export interface Domains {
  Y: [number, number];
  i: [number, number];
  m: [number, number];
}

/** Values that must be visible: both equilibria and the auxiliary points. */
export interface Needed {
  Y: number[];
  i: number[];
  m: number[];
}

export function neededOf(g: TransmissionGeometry): Needed {
  return {
    Y: [g.e0.Y, g.e1.Y, ...(g.keynes ? [g.keynes.Y] : [])],
    i: [g.e0.i, g.e1.i, ...(g.liquidity ? [g.liquidity.i] : [])],
    m: [g.e0.m, g.e1.m, ...(g.liquidity ? [g.liquidity.m] : [])],
  };
}

const niceDomain = (d: [number, number]) => scaleLinear().domain(d).nice(6).domain() as [number, number];

/**
 * Frame of one axis. Starts from the values with a padding, applies the zoom
 * around their centre and always keeps every value inside (5 % inset). While
 * the values stay well inside the previous frame and it is not much wider than
 * needed, the previous frame is kept, so a slider does not make the axes jump.
 */
export function frameAxis(values: number[], minPad: number, zoom: number, prev: [number, number] | null, floorZero: boolean): [number, number] {
  const finite = values.filter(Number.isFinite);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const [plo, phi] = paddedExtent(finite, minPad, 0.3);
  const c = (plo + phi) / 2;
  const half = ((phi - plo) / 2) * zoom;
  const span = Math.max(hi - lo, minPad * 0.2);
  let t: [number, number] = [Math.min(c - half, lo - 0.05 * span), Math.max(c + half, hi + 0.05 * span)];
  if (floorZero && lo >= 0) t = [Math.max(0, t[0]), t[1]];
  t = niceDomain(t);
  if (prev) {
    const inset = (prev[1] - prev[0]) * 0.06;
    const inside = lo >= prev[0] + inset && hi <= prev[1] - inset;
    const notTooWide = prev[1] - prev[0] <= 1.9 * (t[1] - t[0]);
    if (inside && notTooWide) return prev;
  }
  return t;
}

/** Shared frames: output for both right-hand charts, the rate for both lower charts. */
export function frameDomains(n: Needed, base: { Y0: number; m0: number }, zoom = 1, prev: Domains | null = null): Domains {
  return {
    Y: frameAxis(n.Y, Math.max(120, base.Y0 * 0.15), zoom, prev?.Y ?? null, true),
    i: frameAxis(n.i, 2, zoom, prev?.i ?? null, false),
    m: frameAxis(n.m, Math.max(100, base.m0 * 0.3), zoom, prev?.m ?? null, true),
  };
}

/** Frame of a geometry without history (tests, first render). */
export const domainsOf = (g: TransmissionGeometry, zoom = 1): Domains => frameDomains(neededOf(g), { Y0: g.e0.Y, m0: g.e0.m }, zoom);

export interface Scales {
  w: number;
  h: number;
  /** Plot width and height (inside the margins). */
  pw: number;
  ph: number;
  Y: ScaleLinear<number, number>;
  i: ScaleLinear<number, number>;
  m: ScaleLinear<number, number>;
  /** Vertical scale of the goods market: DA = Y at 45° whenever every equilibrium fits. */
  DA: ScaleLinear<number, number>;
}

export function scalesOf(d: Domains, w: number, h: number, daValues: number[] = []): Scales {
  const pw = Math.max(40, w - QM.left - QM.right);
  const ph = Math.max(40, h - QM.top - QM.bottom);
  const Y = scaleLinear().domain(d.Y).range([0, pw]);
  const mid = (d.Y[0] + d.Y[1]) / 2;
  let half = ((d.Y[1] - d.Y[0]) * ph) / pw / 2;
  // Planned demand at the equilibria equals output: enlarge the DA axis rather than cut a point.
  for (const v of daValues) half = Math.max(half, Math.abs(v - mid) * 1.12);
  const DA = scaleLinear().domain([mid - half, mid + half]).range([ph, 0]);
  return { w, h, pw, ph, Y, i: scaleLinear().domain(d.i).range([ph, 0]), m: scaleLinear().domain(d.m).range([0, pw]), DA };
}

type Seg = [number, number, number, number];
type Kind = 'goods' | 'islm' | 'money';

interface ChartProps {
  kind: Kind;
  g: TransmissionGeometry;
  s: Scales;
  visible: Set<Element>;
  /** Elements revealed by the current step (drawn with an entrance highlight). */
  fresh: Set<Element>;
  dim?: boolean;
  focus?: boolean;
  /** Drawn alone (phone tabs): reference lines stop at the axes instead of running into the neighbouring cell. */
  standalone?: boolean;
}

const COLOR = { is: 'var(--series-is)', lm: 'var(--series-lm)', ms: 'var(--series-6)', ref: 'var(--series-ref)' };

/**
 * A straight curve clipped to the plot. The label sits just inside one end:
 * 'end' = right end (top end for vertical lines), 'start' = left end; for
 * vertical lines `side` puts it to the left or right of the line.
 */
function Curve({ seg, s, color, dashed, dotted, label, fresh, id, at = 'end', side = 'right' }: { seg: Seg; s: Scales; color: string; dashed?: boolean; dotted?: boolean; label?: string; fresh?: boolean; id: string; at?: 'start' | 'end' | number; side?: 'left' | 'right' }) {
  const c = clipSegment(seg[0], seg[1], seg[2], seg[3], 0, s.pw, 0, s.ph);
  if (!c) return null;
  const [ax, ay, bx, by] = c;
  const vertical = Math.abs(ax - bx) < 2;
  const right = ax > bx ? { x: ax, y: ay } : { x: bx, y: by };
  const left = ax > bx ? { x: bx, y: by } : { x: ax, y: ay };
  const top = ay < by ? { x: ax, y: ay } : { x: bx, y: by };
  // A number places the label at that fraction of the visible segment, measured from the left end.
  const P = vertical ? top : typeof at === 'number' ? { x: left.x + (right.x - left.x) * at, y: left.y + (right.y - left.y) * at } : at === 'end' ? right : left;
  const anchor = vertical ? (side === 'left' ? 'end' : 'start') : at === 'end' ? 'end' : 'start';
  const lx = vertical ? P.x + (side === 'left' ? -5 : 5) : P.x + (at === 'end' ? -4 : typeof at === 'number' ? 6 : 4);
  const ly = vertical ? P.y + 14 : P.y < 16 ? P.y + 16 : P.y > s.ph - 10 ? P.y - 8 : P.y - 7;
  return (
    <g className={`tq-curve${fresh ? ' tq-fresh' : ''}`} data-curve={id}>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={dashed || dotted ? 1.5 : 2.2} strokeDasharray={dotted ? '2 4' : dashed ? '6 4' : undefined} strokeLinecap="round" />
      {label && (
        <text x={lx} y={ly} textAnchor={anchor} fontSize={12.5} fontStyle="italic" fontWeight={600} fill={color} paintOrder="stroke" stroke="var(--surface-1)" strokeWidth={3}>
          {label}
        </text>
      )}
    </g>
  );
}

function Marker({ x, y, final, label, testid, title, fresh, aux }: { x: number; y: number; final?: boolean; label: string; testid: string; title: string; fresh?: boolean; aux?: boolean }) {
  return (
    <g className={`tq-point${fresh ? ' tq-fresh' : ''}`} data-testid={testid} data-px={x.toFixed(3)} data-py={y.toFixed(3)}>
      <title>{title}</title>
      {aux ? (
        <circle cx={x} cy={y} r={4.5} fill="var(--surface-1)" stroke="var(--text-secondary)" strokeWidth={1.3} strokeDasharray="2 2" />
      ) : final ? (
        <circle cx={x} cy={y} r={5.5} fill="var(--eq1)" stroke="var(--surface-1)" strokeWidth={1.5} />
      ) : (
        <circle cx={x} cy={y} r={5.5} fill="var(--surface-1)" stroke="var(--eq0)" strokeWidth={2} />
      )}
      <text x={x + 8} y={y - 8} fontSize={12} fontWeight={600} fill="var(--text-primary)" paintOrder="stroke" stroke="var(--surface-1)" strokeWidth={3}>
        {label}
      </text>
    </g>
  );
}

/**
 * One of the three markets. Reference lines run to the edges of the cell so
 * that, with zero gap between cells, Y₀/Y₁ continue from the goods market into
 * the IS-LM chart and i₀/i₁ continue from the money market into the IS-LM chart.
 */
export function QuadrantChart({ kind, g, s, visible, fresh, dim, focus, standalone }: ChartProps) {
  const { t, f } = useI18n();
  const { p0, p1 } = g;
  const target = g.regime === 'interest-target';
  const [Ylo, Yhi] = s.Y.domain() as [number, number];
  const [ilo, ihi] = s.i.domain() as [number, number];
  const showE1 = (k: Kind) => visible.has(k === 'goods' ? 'e1Goods' : k === 'islm' ? 'e1IsLm' : 'e1Money');
  const isFresh = (e: Element) => fresh.has(e);
  const children: ReactNode[] = [];
  const refs: ReactNode[] = [];
  const edge = { top: standalone ? 0 : -QM.top, bottom: standalone ? s.ph : s.h - QM.top, left: standalone ? 0 : -QM.left, right: standalone ? s.pw : s.w - QM.left };
  const dash = { stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 4', opacity: 0.85 };
  const e1Visible = showE1(kind);
  const eq = (k: 0 | 1) => (k === 0 ? g.e0 : g.e1);
  const eqTitle = (k: 0 | 1) => {
    const e = eq(k);
    return `E${k === 0 ? '₀' : '₁'}: Y = ${f(e.Y, 'bn')}, i = ${f(e.i, 'rate')}, I = ${f(e.I, 'bn')}, M/P = ${f(e.m, 'bn')}`;
  };

  let xAxis: ReactNode;
  let yAxis: ReactNode;
  let title = '';

  if (kind === 'goods') {
    title = t('tq.chart.goods');
    xAxis = <AxisBottom scale={s.Y} gridLength={s.ph} ticks={Math.max(3, Math.floor(s.pw / 80))} label={t('tq.axis.Y')} />;
    yAxis = <AxisLeft scale={s.DA} gridLength={s.pw} ticks={Math.max(3, Math.floor(s.ph / 42))} label={t(s.ph < 260 ? 'tq.axis.DA.short' : 'tq.axis.DA')} />;
    const da = (p: typeof p0, i: number): Seg => [s.Y(Ylo), s.DA(plannedDemand(p, Ylo, i)), s.Y(Yhi), s.DA(plannedDemand(p, Yhi, i))];
    children.push(<Curve key="45" id="45" seg={[s.Y(Ylo), s.DA(Ylo), s.Y(Yhi), s.DA(Yhi)]} s={s} color={COLOR.ref} label={t('tq.label.45')} at="end" />);
    const moved = g.moved.da;
    children.push(<Curve key="da0" id="da0" seg={da(p0, g.e0.i)} s={s} color={COLOR.is} dashed={moved && visible.has('da1')} label={moved ? 'DA₀' : 'DA'} at="end" />);
    if (visible.has('daPre') && g.keynes) children.push(<Curve key="dapre" id="daPre" seg={da(p1, g.e0.i)} s={s} color={COLOR.is} dotted label="DA′" at={0.16} fresh={isFresh('daPre')} />);
    if (moved && visible.has('da1')) children.push(<Curve key="da1" id="da1" seg={da(p1, g.e1.i)} s={s} color={COLOR.is} label="DA₁" at="start" fresh={isFresh('da1')} />);
    for (const k of [0, 1] as const) {
      if (k === 1 && !e1Visible) continue;
      const e = eq(k);
      const x = s.Y(e.Y);
      const y = s.DA(e.DA);
      refs.push(<line key={`vy${k}`} x1={x} x2={x} y1={y} y2={edge.bottom} {...dash} />);
      children.push(<Marker key={`e${k}`} x={x} y={y} final={k === 1} label={k === 0 ? 'E₀' : 'E₁'} testid={`e${k}-goods`} title={eqTitle(k)} fresh={k === 1 && isFresh('e1Goods')} />);
    }
    if (visible.has('daPre') && g.keynes) {
      const x = s.Y(g.keynes.Y);
      children.push(<Marker key="k" x={x} y={s.DA(g.keynes.Y)} aux label="Y_K" testid="keynes-goods" title={`${t('tq.aux.keynes')}: Y = ${f(g.keynes.Y, 'bn')}`} fresh={isFresh('daPre')} />);
    }
  } else if (kind === 'islm') {
    title = t('tq.chart.islm');
    xAxis = <AxisBottom scale={s.Y} gridLength={s.ph} ticks={Math.max(3, Math.floor(s.pw / 80))} label={t('tq.axis.Y')} />;
    yAxis = <AxisLeft scale={s.i} gridLength={s.pw} ticks={Math.max(3, Math.floor(s.ph / 36))} format={(v) => f(v, 'n1')} label={t('tq.axis.i')} />;
    const isSeg = (p: typeof p0): Seg => [s.Y(isOutputAt(p, ilo)), s.i(ilo), s.Y(isOutputAt(p, ihi)), s.i(ihi)];
    const lmSeg = (p: typeof p0, tgt: number): Seg => (target ? [0, s.i(tgt), s.pw, s.i(tgt)] : [s.Y(lmOutputAt(p, ilo)), s.i(ilo), s.Y(lmOutputAt(p, ihi)), s.i(ihi)]);
    const isMoved = g.moved.is && visible.has('is1');
    const lmMoved = g.moved.lm && visible.has('lm1');
    children.push(<Curve key="is0" id="is0" seg={isSeg(p0)} s={s} color={COLOR.is} dashed={isMoved} label={g.moved.is ? 'IS₀' : 'IS'} />);
    if (isMoved) children.push(<Curve key="is1" id="is1" seg={isSeg(p1)} s={s} color={COLOR.is} label="IS₁" fresh={isFresh('is1')} />);
    children.push(<Curve key="lm0" id="lm0" seg={lmSeg(p0, g.e0.i)} s={s} color={COLOR.lm} dashed={lmMoved} label={g.moved.lm ? 'LM₀' : 'LM'} />);
    if (lmMoved) children.push(<Curve key="lm1" id="lm1" seg={lmSeg(p1, g.e1.i)} s={s} color={COLOR.lm} label="LM₁" fresh={isFresh('lm1')} />);
    for (const k of [0, 1] as const) {
      if (k === 1 && !e1Visible) continue;
      const e = eq(k);
      const x = s.Y(e.Y);
      const y = s.i(e.i);
      refs.push(<line key={`vy${k}`} x1={x} x2={x} y1={edge.top} y2={s.ph} {...dash} />);
      refs.push(<line key={`hi${k}`} x1={edge.left} x2={x} y1={y} y2={y} {...dash} />);
      children.push(<Marker key={`e${k}`} x={x} y={y} final={k === 1} label={k === 0 ? 'E₀' : 'E₁'} testid={`e${k}-islm`} title={eqTitle(k)} fresh={k === 1 && isFresh('e1IsLm')} />);
      children.push(
        <text key={`ly${k}`} x={x + 4} y={s.ph - 6} textAnchor="start" fontSize={11} fontWeight={600} fill="var(--text-primary)" className="tq-axis-mark">
          {k === 0 ? 'Y₀' : 'Y₁'}
        </text>,
      );
    }
    if (visible.has('keynes') && g.keynes) children.push(<Marker key="k" x={s.Y(g.keynes.Y)} y={s.i(g.keynes.i)} aux label="Y_K" testid="keynes-islm" title={`${t('tq.aux.keynes')}: Y = ${f(g.keynes.Y, 'bn')}`} fresh={isFresh('keynes')} />);
  } else {
    title = t('tq.chart.money');
    xAxis = <AxisBottom scale={s.m} gridLength={s.ph} ticks={Math.max(3, Math.floor(s.pw / 80))} label={t(s.pw < 430 ? 'tq.axis.m.short' : 'tq.axis.m')} />;
    yAxis = <AxisLeft scale={s.i} gridLength={s.pw} ticks={Math.max(3, Math.floor(s.ph / 36))} format={(v) => f(v, 'n1')} label={t('tq.axis.i')} />;
    const ld = (p: typeof p0, Y: number): Seg => [s.m(demandAt(p, Y, ilo)), s.i(ilo), s.m(demandAt(p, Y, ihi)), s.i(ihi)];
    const ms = (m: number, i: number): Seg => (target ? [0, s.i(i), s.pw, s.i(i)] : [s.m(m), s.i(ilo), s.m(m), s.i(ihi)]);
    const ldMoved = g.moved.ld && visible.has('ld1');
    const msMoved = g.moved.ms && visible.has('ms1');
    children.push(<Curve key="ld0" id="ld0" seg={ld(p0, g.e0.Y)} s={s} color={COLOR.lm} dashed={ldMoved} label={g.moved.ld ? 'L(Y₀)' : 'L(Y)'} at="start" />);
    if (ldMoved) children.push(<Curve key="ld1" id="ld1" seg={ld(p1, g.e1.Y)} s={s} color={COLOR.lm} label="L(Y₁)" at="end" fresh={isFresh('ld1')} />);
    const msLabel = (k: 0 | 1) => (target ? (g.moved.ms ? `ī${k === 0 ? '₀' : '₁'}` : 'ī') : g.moved.ms ? `M${k === 0 ? '₀' : '₁'}/P` : 'M/P');
    children.push(<Curve key="ms0" id="ms0" seg={ms(g.e0.m, g.e0.i)} s={s} color={COLOR.ms} dashed={msMoved} label={msLabel(0)} side="left" at="start" />);
    if (msMoved) children.push(<Curve key="ms1" id="ms1" seg={ms(g.e1.m, g.e1.i)} s={s} color={COLOR.ms} label={msLabel(1)} side="right" at="end" fresh={isFresh('ms1')} />);
    for (const k of [0, 1] as const) {
      if (k === 1 && !e1Visible) continue;
      const e = eq(k);
      const x = s.m(e.m);
      const y = s.i(e.i);
      refs.push(<line key={`hi${k}`} x1={x} x2={edge.right} y1={y} y2={y} {...dash} />);
      refs.push(<line key={`vm${k}`} x1={x} x2={x} y1={y} y2={s.ph} {...dash} />);
      children.push(<Marker key={`e${k}`} x={x} y={y} final={k === 1} label={k === 0 ? 'E₀' : 'E₁'} testid={`e${k}-money`} title={eqTitle(k)} fresh={k === 1 && isFresh('e1Money')} />);
      children.push(
        <text key={`li${k}`} x={s.pw - 4} y={y - 6} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text-primary)" className="tq-axis-mark">
          {k === 0 ? 'i₀' : 'i₁'}
        </text>,
      );
    }
    if (visible.has('liq') && g.liquidity) {
      children.push(<Marker key="liq" x={s.m(g.liquidity.m)} y={s.i(g.liquidity.i)} aux label="i_L" testid="liquidity-money" title={`${t('tq.aux.liquidity')}: i = ${f(g.liquidity.i, 'rate')}`} fresh={isFresh('liq')} />);
    }
  }

  return (
    <figure
      className={`tq-chart tq-${kind}${dim ? ' tq-dim' : ''}${focus ? ' tq-focus' : ''}`}
      data-quadrant={kind}
      data-frame={JSON.stringify({ Y: s.Y.domain(), i: s.i.domain(), m: s.m.domain(), DA: s.DA.domain(), w: s.w, h: s.h })}
    >
      <svg viewBox={`0 0 ${s.w} ${s.h}`} width={s.w} height={s.h} role="img" aria-label={title} overflow="visible">
        <text x={QM.left} y={15} fontSize={12.5} fontWeight={600} fill="var(--text-primary)">
          {title}
        </text>
        <defs>
          <clipPath id={`tq-clip-${kind}`}>
            <rect x={0} y={0} width={s.pw} height={s.ph} />
          </clipPath>
        </defs>
        <g transform={`translate(${QM.left},${QM.top})`}>
          <rect className="plot-area" x={0} y={0} width={s.pw} height={s.ph} fill="none" pointerEvents="none" />
          <g transform={`translate(0,${s.ph})`}>{xAxis}</g>
          {yAxis}
          <g className="tq-refs">{refs}</g>
          <g clipPath={`url(#tq-clip-${kind})`}>{children.filter((c) => (c as { type?: unknown }).type === Curve)}</g>
          {children.filter((c) => (c as { type?: unknown }).type !== Curve)}
        </g>
      </svg>
    </figure>
  );
}
