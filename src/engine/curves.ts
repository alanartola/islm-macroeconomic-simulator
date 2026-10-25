import { isOutputAt, lmOutputAt } from './islm';
import type { EconomySpec } from './types';

export interface CurvePoint {
  Y: number;
  i: number;
}

/**
 * Samples the IS curve as Y(i) over [iMin, iMax]. Parameterising by i keeps
 * the curve well defined even when it is vertical (b = 0).
 */
export function sampleIS(spec: EconomySpec, iMin: number, iMax: number, n = 2): CurvePoint[] {
  // The IS is linear, so two points are exact; n > 2 is supported for generality.
  const pts: CurvePoint[] = [];
  for (let j = 0; j < n; j += 1) {
    const i = iMin + ((iMax - iMin) * j) / (n - 1);
    pts.push({ Y: isOutputAt(spec.params, i), i });
  }
  return pts;
}

/**
 * Samples the LM curve. Under the money-supply regime it is Y(i) = (m + h·i)/k;
 * under interest targeting it is the horizontal line i = ī over [yMin, yMax].
 */
export function sampleLM(
  spec: EconomySpec,
  iMin: number,
  iMax: number,
  yMin: number,
  yMax: number,
  n = 2,
): CurvePoint[] {
  if (spec.regime === 'interest-target') {
    return [
      { Y: yMin, i: spec.targetRate },
      { Y: yMax, i: spec.targetRate },
    ];
  }
  const pts: CurvePoint[] = [];
  for (let j = 0; j < n; j += 1) {
    const i = iMin + ((iMax - iMin) * j) / (n - 1);
    pts.push({ Y: lmOutputAt(spec.params, i), i });
  }
  return pts;
}
