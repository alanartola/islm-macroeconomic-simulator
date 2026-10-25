import { useEffect, useRef, useState } from 'react';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Tracks the rendered width of a container (charts are sized to their card). */
export function useWidth<T extends HTMLElement>(fallback = 640): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(Math.max(260, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Liang–Barsky clipping of a segment to a rectangle; returns null when fully outside. */
export function clipSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xmin: number,
  xmax: number,
  ymin: number,
  ymax: number,
): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let k = 0; k < 4; k += 1) {
    const pk = p[k]!;
    const qk = q[k]!;
    if (pk === 0) {
      if (qk < 0) return null;
    } else {
      const r = qk / pk;
      if (pk < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/** Pads a numeric extent by max(minPad, rel × range) on each side. */
export function paddedExtent(values: number[], minPad: number, rel = 0.15): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const pad = Math.max(minPad, (hi - lo) * rel);
  return [lo - pad, hi + pad];
}
