import { exercises, isCorrect, parseAnswer, type Exercise } from './bank';
import { loadProgress, recordAttempt, storeProgress, summarizeProgress, PROGRESS_KEY } from './progress';
import { summarize, validateConfig } from '../lab/scenario';
import { solveADAS, ADAS_DEFAULTS } from '../engine/adas/adas';
import type { SeriesFile } from '../data/core';

const list = exercises();
const byId = (id: string): Exercise => {
  const e = list.find((x) => x.id === id);
  if (!e) throw new Error(id);
  return e;
};
const answer = (id: string, q: string): number | string => {
  const c = byId(id).content!;
  const found = c.questions.find((x) => x.id === q);
  if (!found || found.kind === 'classify') throw new Error(`${id}.${q}`);
  return found.answer;
};

/** The published snapshot, as the site serves it. */
const SNAPSHOT = import.meta.glob('../../public/data/series/*.json', { eager: true, import: 'default' }) as Record<string, SeriesFile>;
const snapshot: Record<string, SeriesFile> = Object.fromEntries(Object.entries(SNAPSHOT).map(([k, v]) => [k.replace(/^.*\/(.*)\.json$/, '$1'), v]));

describe('exercise bank: structure', () => {
  it('has unique ids and covers every level, topic and requested exercise type', () => {
    expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
    for (const level of ['inicial', 'intermedio', 'avanzado']) expect(list.filter((e) => e.level === level).length).toBeGreaterThanOrEqual(5);
    const types = new Set(list.flatMap((e) => e.types));
    for (const t of ['concept', 'choice', 'numeric', 'graph', 'shift', 'prediction', 'equilibrium', 'policy', 'history', 'data']) expect(types.has(t as never), t).toBe(true);
    for (const topic of ['closed', 'open', 'prices', 'data']) expect(list.some((e) => e.topic === topic), topic).toBe(true);
  });

  it('every exercise has statement, objective, hints and either content or a data builder', () => {
    for (const e of list) {
      expect(e.title.es && e.title.en, e.id).toBeTruthy();
      expect(e.statement.es.length, e.id).toBeGreaterThan(20);
      expect(e.objective.es.length, e.id).toBeGreaterThan(10);
      expect(e.hints.length, e.id).toBeGreaterThan(0);
      expect(!!e.content !== !!e.build, e.id).toBe(true);
      if (e.build) expect(e.dataSeries?.length, e.id).toBeGreaterThan(0);
    }
  });

  it('model questions are well formed: finite numeric answers, keys among the options', () => {
    for (const e of list.filter((x) => x.content)) {
      const c = e.content!;
      expect(c.questions.length, e.id).toBeGreaterThan(0);
      expect(c.steps.length, e.id).toBeGreaterThan(0);
      expect(c.interpretation.es.length, e.id).toBeGreaterThan(20);
      for (const q of c.questions) {
        if (q.kind === 'number') {
          expect(Number.isFinite(q.answer), `${e.id}.${q.id}`).toBe(true);
          expect(q.tolerance, `${e.id}.${q.id}`).toBeGreaterThan(0);
        }
        if (q.kind === 'choice') expect(q.options.map((o) => o.id), `${e.id}.${q.id}`).toContain(q.answer);
      }
      // Steps never print NaN or undefined.
      for (const s of [...c.steps, c.interpretation, ...c.data]) expect(`${s.es} ${s.en}`, e.id).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('every scenario opens in a module (valid configuration that the engines solve)', () => {
    for (const e of list.filter((x) => x.config)) {
      expect(validateConfig(JSON.parse(JSON.stringify(e.config))), e.id).not.toBeNull();
      const s = summarize(e.config!, false);
      expect('ok' in s && s.ok === false, e.id).toBe(false);
    }
  });
});

describe('exercise answers agree with closed-form solutions', () => {
  // Module A defaults: A = C₀ − cT + I₀ + G = 600, D = h(1 − c) + bk = 25, Y₀ = 1,900, i₀ = 5%.
  it('monetary expansion of 10%: LM right, rate down, investment and output up', () => {
    expect(answer('ini-monetaria-10', 'curve')).toBe('LM');
    expect(answer('ini-monetaria-10', 'side')).toBe('right');
    expect(answer('ini-monetaria-10', 'i')).toBe('down');
    expect(answer('ini-monetaria-10', 'inv')).toBe('up');
    expect(answer('ini-monetaria-10', 'Y')).toBe('up');
  });

  it('fiscal expansion ΔG = 40: Y₁ = 1,980, Δi = 0.8 pp, multiplier h/D = 2, ΔI = −20', () => {
    expect(answer('int-fiscal-numerico', 'Y1')).toBeCloseTo(1980, 9);
    expect(answer('int-fiscal-numerico', 'dY')).toBeCloseTo(80, 9);
    expect(answer('int-fiscal-numerico', 'di')).toBeCloseTo(0.8, 9);
    expect(answer('int-fiscal-numerico', 'mult')).toBeCloseTo(2, 9);
    expect(answer('int-fiscal-numerico', 'dI')).toBeCloseTo(-20, 9);
  });

  it('monetary expansion to M = 840: Y = 2,040, i = 3.6%', () => {
    expect(answer('int-monetario-numerico', 'Y1')).toBeCloseTo(2040, 9);
    expect(answer('int-monetario-numerico', 'i1')).toBeCloseTo(3.6, 9);
    expect(answer('int-monetario-numerico', 'dI')).toBeCloseTo(35, 9);
  });

  it('fixed-rate regime: ΔY = αΔG = 200 and the money supply accommodates', () => {
    expect(answer('int-regimen-tasa', 'dY')).toBeCloseTo(200, 9);
    expect(answer('int-regimen-tasa', 'M')).toBeCloseTo(0.5 * 2100 - 50 * 5, 9);
    expect(answer('int-regimen-tasa', 'cmp')).toBe('rate');
  });

  it('tax cut versus spending: the spending multiplier is larger', () => {
    expect(answer('ini-impuestos', 'cmp')).toBe('g');
    expect(answer('ini-impuestos', 'Y')).toBe('up');
  });

  it('Mundell-Fleming: fiscal policy under a float crowds out net exports one for one', () => {
    expect(answer('int-mf-flexible-fiscal', 'Y')).toBe('none');
    expect(answer('int-mf-flexible-fiscal', 'q')).toBe('down');
    expect(answer('int-mf-flexible-fiscal', 'nx')).toBeCloseTo(-50, 6);
  });

  it('Mundell-Fleming: monetary policy under a peg is lost in reserves', () => {
    expect(answer('int-mf-fijo-monetaria', 'Y')).toBe('none');
    expect(answer('int-mf-fijo-monetaria', 'dR')).toBeCloseTo(-100, 6);
  });

  it('a higher world rate depreciates the currency and raises output in the model', () => {
    expect(answer('int-mf-tasa-internacional', 'q')).toBe('up');
    expect(answer('int-mf-tasa-internacional', 'Y')).toBe('up');
    expect(answer('int-mf-tasa-internacional', 'I')).toBe('down');
  });

  it('AD-AS: money is neutral in the medium run (P moves in proportion to M)', () => {
    const r0 = solveADAS(ADAS_DEFAULTS);
    if (!r0.ok) throw new Error('ADAS');
    expect(answer('int-oada-monetaria', 'Pmr')).toBeCloseTo((r0.value.mediumRun!.P * 1200) / 1100, 9);
    expect(answer('int-oada-monetaria', 'Ysr')).toBe('up');
  });

  it('IS-MP: demand shock x = d/Δ, Δ = 1 + σκ(1 + φπ) + σφy = 1.95', () => {
    const x = 2 / 1.95;
    expect(answer('av-ismp-demanda', 'x')).toBeCloseTo(x, 9);
    expect(answer('av-ismp-demanda', 'pi')).toBeCloseTo(2 + 0.3 * x, 9);
    expect(answer('av-ismp-demanda', 'i')).toBeCloseTo(2 + (2 + 0.3 * x) + 0.5 * 0.3 * x + 0.5 * x, 9);
  });

  it('IS-MP: supply shock — the rule trades activity for inflation; the peg keeps x = 0', () => {
    const x = (-1 * 1.5 * 1) / 1.95;
    expect(answer('av-ismp-oferta', 'piRule')).toBeCloseTo(2 + 0.3 * x + 1, 9);
    expect(answer('av-ismp-oferta', 'piPeg')).toBeCloseTo(3, 9);
    expect(answer('av-ismp-oferta', 'x')).toBe('down');
  });

  it('IS-MP: at the lower bound x = d + σ(πᵉ + rₙ) = −6', () => {
    expect(answer('av-cota-inferior', 'binds')).toBe('yes');
    expect(answer('av-cota-inferior', 'x')).toBeCloseTo(-6, 9);
    expect(answer('av-cota-inferior', 'pi')).toBeCloseTo(2 + 0.3 * -6, 9);
  });

  it('liquidity trap: the economy is in the trap region and money barely moves output', () => {
    expect(answer('av-trampa-liquidez', 'zone')).toBe('trap');
    const dY = answer('av-trampa-liquidez', 'dY') as number;
    expect(dY).toBeGreaterThan(0);
    // Far below the (b/D)·Δm of a linear LM with the same parameters.
    expect(dY).toBeLessThan(20);
  });
});

describe('real-data exercises use the published official series', () => {
  it('trade exercise: balance and turnover of the last published month', () => {
    const c = byId('int-datos-comercio').build!(snapshot)!;
    expect(c).not.toBeNull();
    const x = snapshot.ar_x!.data.at(-1)!;
    const m = snapshot.ar_m!.data.at(-1)!;
    expect(x[0]).toBe(m[0]);
    const bc = c.questions.find((q) => q.id === 'bc')!;
    const ic = c.questions.find((q) => q.id === 'ic')!;
    expect(bc.kind === 'number' && bc.answer).toBeCloseTo(x[1] - m[1], 9);
    expect(ic.kind === 'number' && ic.answer).toBeCloseTo(x[1] + m[1], 9);
  });

  it('historical exercises build from data and classify observations, hypotheses and interpretations', () => {
    for (const id of ['av-historia-2018', 'av-historia-2023']) {
      const e = byId(id);
      for (const s of e.dataSeries!) expect(snapshot[s], `${id} ${s}`).toBeDefined();
      const c = e.build!(snapshot);
      expect(c, id).not.toBeNull();
      const cl = c!.questions.find((q) => q.kind === 'classify');
      expect(cl && cl.kind === 'classify' && new Set(cl.statements.map((s) => s.answer)), id).toEqual(new Set(['obs', 'hyp', 'int']));
      for (const s of [...c!.steps, ...c!.data]) expect(s.es, id).not.toMatch(/NaN|undefined/);
    }
    // August 2023 monthly inflation was higher than July's in the official series.
    const inf = new Map(snapshot.ar_inflacion_mensual!.data);
    expect(inf.get('2023-08-01')!).toBeGreaterThan(inf.get('2023-07-01')!);
  });

  it('returns null instead of inventing values when a series is missing', () => {
    expect(byId('int-datos-comercio').build!({})).toBeNull();
    expect(byId('av-historia-2018').build!({})).toBeNull();
  });
});

describe('grading', () => {
  it('reads numbers in Spanish and English notation', () => {
    expect(parseAnswer('1980')).toBe(1980);
    expect(parseAnswer('0,8')).toBe(0.8);
    expect(parseAnswer('0.8')).toBe(0.8);
    expect(parseAnswer('1.980,5')).toBe(1980.5);
    expect(parseAnswer('1,980.5')).toBe(1980.5);
    expect(parseAnswer('−20')).toBe(-20);
    expect(parseAnswer(' 3,6 % ')).toBe(3.6);
    expect(parseAnswer('abc')).toBeNull();
    expect(parseAnswer('')).toBeNull();
  });

  it('accepts answers within tolerance and exact options', () => {
    const q = byId('int-fiscal-numerico').content!.questions.find((x) => x.id === 'di')!;
    expect(isCorrect(q, '0,8')).toBe(true);
    expect(isCorrect(q, '0,805')).toBe(true);
    expect(isCorrect(q, '0,9')).toBe(false);
    expect(isCorrect(q, '')).toBe(false);
    const c = byId('ini-monetaria-10').content!.questions[0]!;
    expect(isCorrect(c, 'LM')).toBe(true);
    expect(isCorrect(c, 'IS')).toBe(false);
  });
});

describe('local progress', () => {
  beforeEach(() => localStorage.clear());

  it('records attempts, errors and solved exercises, and survives a reload', () => {
    let p = recordAttempt({}, 'ini-fiscal-g', 2, false);
    p = recordAttempt(p, 'ini-fiscal-g', 0, true);
    p = recordAttempt(p, 'av-cota-inferior', 1, false);
    expect(p['ini-fiscal-g']).toEqual({ attempts: 2, errors: 2, solved: true, revealed: false });
    storeProgress(p);
    expect(loadProgress()).toEqual(p);
    const s = summarizeProgress(list, p);
    expect(s).toMatchObject({ attempted: 2, solved: 1, errors: 3, total: list.length });
    expect(s.byLevel.find((l) => l.level === 'inicial')).toMatchObject({ attempted: 1, solved: 1 });
  });

  it('ignores corrupt stored progress', () => {
    localStorage.setItem(PROGRESS_KEY, '{not json');
    expect(loadProgress()).toEqual({});
  });
});
