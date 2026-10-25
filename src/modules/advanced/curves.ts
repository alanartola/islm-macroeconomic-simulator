import { alphaOf, isOutput, lmOutput, realMoneyOf, ZONE_CLASSICAL_MIN, ZONE_TRAP_MAX, type AdvSolved, type AdvSpec } from '../../engine/advanced';
import type { Pt, XYBand } from '../../components/charts/XYChart';

/** IS as a polyline (Y, i) over [iLo, iHi]. */
export function isPoints(spec: AdvSpec, iLo: number, iHi: number): Pt[] {
  return [
    [isOutput(spec.params, iLo), iLo],
    [isOutput(spec.params, iHi), iHi],
  ];
}

/**
 * LM as a polyline (Y, i) sampled from the model's own equations.
 *   nonlinear: dense sampling near i_min (where the curve flattens)
 *   floor:     horizontal segment at i_floor up to the kink, then linear
 *   rate:      horizontal line at ī
 */
export function lmPoints(spec: AdvSpec, iLo: number, iHi: number, yLo: number, yHi: number): Pt[] {
  const p = spec.params;
  if (spec.regime === 'rate') return [[yLo, spec.targetRate], [yHi, spec.targetRate]];
  if (spec.lm === 'nonlinear') {
    // i_j = i_min + (i_hi − i_min)·(j/n)^2.5: dense near the asymptote i → i_min.
    const pts: Pt[] = [];
    const n = 200;
    const minY = yLo - (yHi - yLo);
    for (let j = 1; j <= n; j += 1) {
      const i = p.iMin + (iHi - p.iMin) * (j / n) ** 2.5;
      const Y = lmOutput(spec, i);
      if (Y !== null && Y >= minY) pts.push([Y, i]);
    }
    return pts;
  }
  const lin = (i: number) => lmOutput({ ...spec, lm: 'linear' }, i)!;
  if (spec.lm === 'floor') {
    const kinkY = lin(p.iFloor);
    return [
      [Math.min(yLo, kinkY) - (yHi - yLo), p.iFloor],
      [kinkY, p.iFloor],
      [lin(Math.max(iHi, p.iFloor)), Math.max(iHi, p.iFloor)],
    ];
  }
  return [
    [lin(iLo), iLo],
    [lin(iHi), iHi],
  ];
}

/**
 * Output levels along the non-linear LM at which the crowding-out share equals
 * the zone thresholds, given the IS slope of `isSpec`:
 *   share = αbs/(1 + αbs),  s(Y) = ak/(m − kY)²  ⇒  Y = (m − √(ak/s*))/k,
 *   with s* = θ/[(1 − θ)αb] for threshold θ.
 * Exact (closed form), not sampled.
 */
export function zoneBoundaries(lmSpec: AdvSpec, isSpec: AdvSpec): { trapMax: number; classicalMin: number } | null {
  const p = lmSpec.params;
  if (lmSpec.lm !== 'nonlinear' || lmSpec.regime !== 'money' || isSpec.params.b <= 0) return null;
  const ab = alphaOf(isSpec.params) * isSpec.params.b;
  const yAt = (theta: number) => {
    const s = theta / ((1 - theta) * ab);
    return (realMoneyOf(p) - Math.sqrt((p.a * p.k) / s)) / p.k;
  };
  return { trapMax: yAt(ZONE_TRAP_MAX), classicalMin: yAt(ZONE_CLASSICAL_MIN) };
}

export function zoneBands(s1: AdvSolved, labels: { trap: string; intermediate: string; classical: string; floor: string }): XYBand[] {
  const spec = s1.spec;
  if (spec.regime === 'rate') return [];
  if (spec.lm === 'floor') return [{ id: 'floor', y1: spec.params.iFloor, color: 'var(--band-trap)', label: labels.floor }];
  const zb = zoneBoundaries(spec, spec);
  if (!zb) return [];
  return [
    { id: 'trap', x1: zb.trapMax, color: 'var(--band-trap)', label: labels.trap },
    { id: 'mid', x0: zb.trapMax, x1: zb.classicalMin, color: 'transparent', label: labels.intermediate },
    { id: 'classical', x0: zb.classicalMin, color: 'var(--band-classical)', label: labels.classical },
  ];
}

/** Plot window around E₀/E₁ that also shows the LM asymptote(s). */
export function advWindow(s0: AdvSolved, s1: AdvSolved): { y: [number, number]; i: [number, number] } {
  const ys = [s0.equilibrium.Y, s1.equilibrium.Y];
  const is = [s0.equilibrium.i, s1.equilibrium.i];
  const span = Math.max(...ys) - Math.min(...ys);
  const pad = Math.max(0.35 * s0.equilibrium.Y, span * 0.8, 150);
  const yLo = Math.max(0, Math.min(...ys) - pad);
  const yHi = Math.max(...ys) + pad;
  let iLo = Math.min(...is) - 3;
  const iHi = Math.max(...is) + 4;
  if (s1.spec.lm === 'nonlinear') iLo = Math.min(iLo, s1.spec.params.iMin - 0.5);
  if (s1.spec.lm === 'floor') iLo = Math.min(iLo, s1.spec.params.iFloor - 1);
  return { y: [yLo, yHi], i: [iLo, iHi] };
}
