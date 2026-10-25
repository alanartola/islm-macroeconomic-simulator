import type { ModelParams, ParamKey, PolicyRegime } from '../engine';
import type { SavedScenario, SimState } from './store';

const KEYS: readonly ParamKey[] = ['C0', 'c', 'T', 'I0', 'b', 'G', 'M', 'P', 'k', 'h'];

function isParams(x: unknown): x is ModelParams {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return KEYS.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]));
}

function isRegime(x: unknown): x is PolicyRegime {
  return x === 'money-supply' || x === 'interest-target';
}

interface SharedState {
  b: ModelParams;
  s: ModelParams;
  r: PolicyRegime;
  t0: number;
  t1: number;
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Encodes the model inputs (no personal data) into a URL hash fragment. */
export function encodeShareHash(state: SimState): string {
  const payload: SharedState = { b: state.baseline, s: state.shocked, r: state.regime, t0: state.target0, t1: state.target1 };
  return `#s=${toBase64Url(JSON.stringify(payload))}`;
}

/** Decodes a share hash; returns null for anything malformed (never throws). */
export function decodeShareHash(hash: string): Partial<SimState> | null {
  const m = /^#s=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!m || !m[1]) return null;
  try {
    const o = JSON.parse(fromBase64Url(m[1])) as Partial<SharedState>;
    if (!isParams(o.b) || !isParams(o.s) || !isRegime(o.r)) return null;
    if (typeof o.t0 !== 'number' || typeof o.t1 !== 'number' || !Number.isFinite(o.t0) || !Number.isFinite(o.t1)) return null;
    return { baseline: o.b, shocked: o.s, regime: o.r, target0: o.t0, target1: o.t1, activePreset: null };
  } catch {
    return null;
  }
}

const SAVED_KEY = 'islm.savedScenarios.v1';

/** Saved scenarios live for the browser session only (sessionStorage). */
export function loadSavedScenarios(): SavedScenario[] {
  try {
    const raw = sessionStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is SavedScenario =>
        typeof x === 'object' && x !== null &&
        typeof (x as SavedScenario).id === 'string' && typeof (x as SavedScenario).name === 'string' &&
        isParams((x as SavedScenario).baseline) && isParams((x as SavedScenario).shocked) &&
        isRegime((x as SavedScenario).regime) &&
        Number.isFinite((x as SavedScenario).target0) && Number.isFinite((x as SavedScenario).target1),
    );
  } catch {
    return [];
  }
}

export function storeSavedScenarios(saved: SavedScenario[]): void {
  try {
    sessionStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable (private mode, quota): scenarios remain in memory */
  }
}

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
