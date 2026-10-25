/** Direction-only class for signed changes (blue up, red down; no normative colouring). */
export function deltaCls(x: number): string {
  if (Math.abs(x) < 1e-9) return 'delta-flat';
  return x > 0 ? 'delta-up' : 'delta-down';
}
