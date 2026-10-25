import { DEFAULT_PARAMS } from '../engine';
import { decodeShareHash, encodeShareHash } from './persistence';
import { runSimulation } from './simulation';
import { initialState, reducer, type SimState } from './store';

const apply = (s: SimState, ...actions: Parameters<typeof reducer>[1][]) => actions.reduce(reducer, s);

describe('reducer', () => {
  it('editing E₁ never modifies E₀', () => {
    const s = apply(initialState(), { type: 'setParam', key: 'G', value: 300 });
    expect(s.shocked.G).toBe(300);
    expect(s.baseline.G).toBe(DEFAULT_PARAMS.G);
  });

  it('editing E₀ carries unshocked parameters to E₁ but preserves an existing shock', () => {
    let s = apply(initialState(), { type: 'setParam', key: 'G', value: 300 }, { type: 'setEditing', side: 'baseline' });
    s = apply(s, { type: 'setParam', key: 'c', value: 0.6 }, { type: 'setParam', key: 'G', value: 260 });
    expect(s.shocked.c).toBe(0.6); // linked
    expect(s.baseline.G).toBe(260);
    expect(s.shocked.G).toBe(300); // shock preserved
  });

  it('presets build E₁ from E₀ with the documented round shocks', () => {
    const base = initialState();
    expect(apply(base, { type: 'applyPreset', id: 'A' }).shocked.M).toBe(800);
    expect(apply(base, { type: 'applyPreset', id: 'B' }).shocked.M).toBe(600);
    expect(apply(base, { type: 'applyPreset', id: 'C1' }).shocked.G).toBe(300);
    expect(apply(base, { type: 'applyPreset', id: 'C2' }).shocked.T).toBe(150);
    expect(apply(base, { type: 'applyPreset', id: 'D1' }).shocked.G).toBe(200);
    expect(apply(base, { type: 'applyPreset', id: 'D2' }).shocked.T).toBe(250);
    expect(apply(base, { type: 'applyPreset', id: 'E1' }).shocked.I0).toBe(250);
    expect(apply(base, { type: 'applyPreset', id: 'E2' }).shocked.I0).toBe(350);
    expect(apply(base, { type: 'applyPreset', id: 'F1' }).shocked.b).toBe(50);
    expect(apply(base, { type: 'applyPreset', id: 'F2' }).shocked.h).toBe(150);
  });

  it('switching to interest targeting pegs the rate at the initial equilibrium (E₀ unchanged)', () => {
    const before = runSimulation(initialState());
    const s = apply(initialState(), { type: 'setRegime', regime: 'interest-target' });
    const after = runSimulation(s);
    expect(s.target0).toBe(5);
    expect(before.ok && after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(after.e0.equilibrium.Y).toBeCloseTo(before.e0.equilibrium.Y, 9);
      expect(after.e0.equilibrium.M).toBeCloseTo(before.e0.equilibrium.M, 9);
    }
  });

  it('switching back to the money-supply regime freezes M at the stock required at E₀', () => {
    const s = apply(
      initialState(),
      { type: 'setRegime', regime: 'interest-target' },
      { type: 'setEditing', side: 'baseline' },
      { type: 'setTarget', value: 4 },
      { type: 'setRegime', regime: 'money-supply' },
    );
    const sim = runSimulation(s);
    expect(sim.ok).toBe(true);
    if (sim.ok) expect(sim.e0.equilibrium.i).toBeCloseTo(4, 2);
  });

  it('monetary presets require (and switch to) the money-supply regime; rate presets to targeting', () => {
    const t = apply(initialState(), { type: 'setRegime', regime: 'interest-target' }, { type: 'applyPreset', id: 'A' });
    expect(t.regime).toBe('money-supply');
    const r = apply(initialState(), { type: 'applyPreset', id: 'R2' });
    expect(r.regime).toBe('interest-target');
    expect(r.target1).toBe(r.target0 + 1);
  });

  it('fiscal presets keep the current regime (to compare crowding out across regimes)', () => {
    const s = apply(initialState(), { type: 'setRegime', regime: 'interest-target' }, { type: 'applyPreset', id: 'C1' });
    expect(s.regime).toBe('interest-target');
  });

  it('reset, adopt, save, load and delete scenarios', () => {
    let s = apply(initialState(), { type: 'applyPreset', id: 'C1' }, { type: 'saveScenario', name: 'Fiscal' });
    expect(s.saved).toHaveLength(1);
    const id = s.saved[0]!.id;
    s = apply(s, { type: 'resetShock' });
    expect(s.shocked).toEqual(s.baseline);
    s = apply(s, { type: 'loadScenario', id });
    expect(s.shocked.G).toBe(300);
    s = apply(s, { type: 'adoptShock' });
    expect(s.baseline.G).toBe(300);
    s = apply(s, { type: 'toggleSaved', id });
    expect(s.view.hiddenSaved).toContain(id);
    s = apply(s, { type: 'deleteScenario', id });
    expect(s.saved).toHaveLength(0);
    expect(s.view.hiddenSaved).not.toContain(id);
  });

  it('caps the number of saved scenarios', () => {
    let s = initialState();
    for (let k = 0; k < 10; k += 1) s = reducer(s, { type: 'saveScenario', name: `S${k}` });
    expect(s.saved.length).toBe(6);
    expect(s.saved[0]!.name).toBe('S4');
  });
});

describe('share links', () => {
  it('round-trips the model inputs through the URL hash', () => {
    const s = apply(initialState(), { type: 'applyPreset', id: 'C2' }, { type: 'setRegime', regime: 'interest-target' });
    const decoded = decodeShareHash(encodeShareHash(s));
    expect(decoded?.baseline).toEqual(s.baseline);
    expect(decoded?.shocked).toEqual(s.shocked);
    expect(decoded?.regime).toBe('interest-target');
    expect(decoded?.target0).toBe(s.target0);
  });

  it.each(['', '#', '#s=', '#s=@@@', '#s=bm90LWpzb24', '#x=abc'])('rejects malformed hash %j without throwing', (h) => {
    expect(decodeShareHash(h)).toBeNull();
  });

  it('rejects payloads with non-numeric parameters', () => {
    const bad = btoa(JSON.stringify({ b: { ...DEFAULT_PARAMS, G: 'x' }, s: DEFAULT_PARAMS, r: 'money-supply', t0: 5, t1: 5 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeShareHash(`#s=${bad}`)).toBeNull();
  });
});

describe('runSimulation', () => {
  it('reports which side fails and keeps the solvable side', () => {
    const s = apply(initialState(), { type: 'setParam', key: 'c', value: 1 });
    const sim = runSimulation(s);
    expect(sim.ok).toBe(false);
    if (!sim.ok) {
      expect(sim.failures.map((f) => f.side)).toEqual(['shocked']);
      expect(sim.e0).not.toBeNull();
      expect(sim.e1).toBeNull();
    }
  });
});
