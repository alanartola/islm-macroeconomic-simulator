import { DEFAULT_PARAMS, solve, type EconomySpec, type ModelParams, type SolvedEconomy } from '../engine';
import { makeI18n } from '../i18n';
import { buildInsights, moneySupplyCounterfactual, type Insight } from './insights';

function spec(params: Partial<ModelParams> = {}, extra: Partial<EconomySpec> = {}): EconomySpec {
  return { params: { ...DEFAULT_PARAMS, ...params }, regime: 'money-supply', targetRate: 5, ...extra };
}
function solved(s: EconomySpec): SolvedEconomy {
  const r = solve(s);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
}
const keys = (xs: Insight[]) => xs.map((x) => x.key);
const find = (xs: Insight[], key: string) => xs.find((x) => x.key === key);

describe('buildInsights — statements match the computed results', () => {
  it('reports no shock when E₁ = E₀', () => {
    const r = buildInsights(solved(spec()), solved(spec()));
    expect(r.noShock).toBe(true);
    expect(keys(r.headline)).toEqual(['ins.noShock']);
  });

  it('monetary expansion: LM shift right, movement along IS, interest-rate channel', () => {
    const r = buildInsights(solved(spec()), solved(spec({ M: 800 })));
    const k = keys(r.items);
    expect(k).toContain('ins.cause.realMoney');
    expect(k).toContain('ins.shift.lm.money');
    expect(k).not.toContain('ins.shift.is.multiplier');
    expect(k).toContain('ins.move.alongIS');
    expect(k).toContain('ins.tr.monetary');
    const lm = find(r.items, 'ins.shift.lm.money')!;
    expect(lm.vars?.dir).toEqual({ key: 'w.right' });
    expect(lm.vars?.amount).toBeCloseTo(200, 9);
    const tr = find(r.items, 'ins.tr.monetary')!;
    expect(tr.vars?.rateDir).toEqual({ key: 'w.falls' });
    expect(tr.vars?.excess).toEqual({ key: 'w.excessSupply' });
    expect(tr.vars?.dY).toBeCloseTo(100, 9);
    const head = find(r.headline, 'ins.head.result')!;
    expect(head.vars?.yDir).toEqual({ key: 'w.higherOutput' });
    expect(head.vars?.iDir).toEqual({ key: 'w.lowerRate' });
  });

  it('fiscal expansion: IS shift by αΔG, movement along LM, quantified crowding out', () => {
    const r = buildInsights(solved(spec()), solved(spec({ G: 300 })));
    const k = keys(r.items);
    expect(k).toContain('ins.shift.is.multiplier');
    expect(k).toContain('ins.move.alongLM');
    expect(k).toContain('ins.tr.demand');
    expect(k).toContain('ins.tr.crowdingOut');
    const co = find(r.items, 'ins.tr.crowdingOut')!;
    expect(co.vars?.crowd).toBeCloseTo(100, 9);
    expect(co.vars?.share).toBeCloseTo(50, 9);
    const sh = find(r.items, 'ins.shift.is.multiplier')!;
    expect(sh.vars?.amount).toBeCloseTo(200, 9);
    expect(sh.vars?.alpha).toBeCloseTo(4, 12);
  });

  it('fiscal contraction is described as crowding in, not crowding out', () => {
    const k = keys(buildInsights(solved(spec()), solved(spec({ G: 200 }))).items);
    expect(k).toContain('ins.tr.crowdingIn');
    expect(k).not.toContain('ins.tr.crowdingOut');
  });

  it('tax change adds the tax channel with the leakage (1 − c)·|ΔT|', () => {
    const r = buildInsights(solved(spec()), solved(spec({ T: 150 })));
    const tax = find(r.items, 'ins.tr.tax')!;
    expect(tax.vars?.dCaut).toBeCloseTo(37.5, 9);
    expect(tax.vars?.leak).toBeCloseTo(12.5, 9);
  });

  it('structural changes are reported as rotations', () => {
    const r = buildInsights(solved(spec()), solved(spec({ b: 50 })));
    const rot = find(r.items, 'ins.shift.isRotation')!;
    expect(rot.vars?.how).toEqual({ key: 'w.flatter' });
    expect(keys(r.items)).toContain('ins.tr.structural');
  });

  it('interest-target regime: full Keynesian effect, endogenous M and a money-supply counterfactual', () => {
    const e0 = solved(spec({}, { regime: 'interest-target', targetRate: 5 }));
    const e1 = solved(spec({ G: 300 }, { regime: 'interest-target', targetRate: 5 }));
    const r = buildInsights(e0, e1);
    const k = keys(r.items);
    expect(k).toContain('ins.move.alongFlatLM');
    expect(k).toContain('ins.tr.targetDemand');
    expect(k).not.toContain('ins.tr.crowdingOut');
    expect(find(r.items, 'ins.tr.targetDemand')!.vars?.dM).toBeCloseTo(100, 9);
    const cf = find(r.items, 'ins.reg.counterfactual')!;
    expect(cf.vars?.dYcf).toBeCloseTo(100, 9);
    expect(cf.vars?.dicf).toBeCloseTo(1, 12);
    const cfe = moneySupplyCounterfactual(e0, e1)!;
    expect(cfe.spec.regime).toBe('money-supply');
  });

  it('interest-target regime: a rate cut is transmitted through investment and requires money injection', () => {
    const r = buildInsights(
      solved(spec({}, { regime: 'interest-target', targetRate: 5 })),
      solved(spec({}, { regime: 'interest-target', targetRate: 4 })),
    );
    const tr = find(r.items, 'ins.tr.targetRate')!;
    expect(tr.vars?.rateDir).toEqual({ key: 'w.lowers' });
    expect(tr.vars?.moneyDir).toEqual({ key: 'w.injects' });
    expect(tr.vars?.dY).toBeCloseTo(100, 9);
    expect(tr.vars?.dIrate).toBeCloseTo(25, 9);
    expect(keys(r.items)).toContain('ins.shift.lmTarget');
  });

  it('every generated insight renders without unresolved placeholders in both languages', () => {
    const cases: [EconomySpec, EconomySpec][] = [
      [spec(), spec({ M: 800 })],
      [spec(), spec({ G: 300, T: 250 })],
      [spec(), spec({ I0: 250, b: 40, h: 80, k: 0.4, c: 0.7, P: 1.1 })],
      [spec({}, { regime: 'interest-target', targetRate: 5 }), spec({ G: 320 }, { regime: 'interest-target', targetRate: 6 })],
    ];
    for (const lang of ['en', 'es'] as const) {
      const { t } = makeI18n(lang);
      for (const [a, b] of cases) {
        const r = buildInsights(solved(a), solved(b));
        for (const ins of [...r.headline, ...r.items]) {
          const text = t(ins.key, ins.vars);
          expect(text, `${lang}:${ins.key}`).not.toMatch(/\{\w+(\|\w+)?\}/);
          expect(text).not.toMatch(/NaN|Infinity|undefined/);
          expect(text).not.toBe(ins.key);
        }
      }
    }
  });
});
