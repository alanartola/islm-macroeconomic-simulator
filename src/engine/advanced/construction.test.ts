import {
  ADV_DEFAULTS,
  advSpec,
  alphaOf,
  consumptionAt,
  crossEquilibrium,
  injections,
  isOutput,
  leakages,
  lmPointForOutput,
  lmOutput,
  multiplierRounds,
  outputForInjections,
  plannedExpenditure,
  speculativeAt,
  speculativeBalances,
  transactionDemand,
  type LMSpec,
} from './index';

const p = ADV_DEFAULTS;

describe('Module C — IS construction (Keynesian cross and four quadrants)', () => {
  it.each([0, 2.5, 5, 7.5, 12])('at i = %s the cross equilibrium satisfies Y = AE(Y) and lies on the IS', (i) => {
    const Y = crossEquilibrium(p, i);
    expect(plannedExpenditure(p, Y, i)).toBeCloseTo(Y, 9);
    expect(Y).toBeCloseTo(isOutput(p, i), 12);
  });

  it.each([0, 3, 5, 9])('four quadrants close: W(Y) = J(i) at the IS point for i = %s', (i) => {
    const J = injections(p, i);
    const Y = outputForInjections(p, J);
    expect(Y).toBeCloseTo(isOutput(p, i), 9);
    expect(leakages(p, Y)).toBeCloseTo(J, 9);
  });

  it('leakages equal private saving plus net taxes', () => {
    const Y = 2000;
    const T = p.T0 + p.t * Y;
    const Sp = Y - T + p.TR - consumptionAt(p, Y);
    expect(leakages(p, Y)).toBeCloseTo(Sp + T - p.TR, 9);
  });

  it('multiplier rounds converge to α·ΔA (geometric series with ratio c(1 − t))', () => {
    const rounds = multiplierRounds(p, 50, 200);
    expect(rounds[0]).toBe(50);
    expect(rounds[1]).toBeCloseTo(50 + 50 * 0.6, 12);
    expect(rounds.at(-1)!).toBeCloseTo(alphaOf(p) * 50, 9);
  });
});

describe('Module C — LM construction (money market and four quadrants)', () => {
  it.each(['nonlinear', 'linear'] as LMSpec[])('%s: kY + L_s(i(Y)) = M/P for every Y on the LM', (lm) => {
    const spec = advSpec({}, lm);
    for (const Y of [1200, 1600, 2000, 2150]) {
      const i = lmPointForOutput(spec, Y);
      if (i === null) continue;
      expect(transactionDemand(p, Y) + speculativeAt(spec, i)!).toBeCloseTo(p.M / p.P, 8);
      expect(speculativeAt(spec, i)!).toBeCloseTo(speculativeBalances(p, Y), 8);
      expect(lmOutput(spec, i)!).toBeCloseTo(Y, 7);
    }
  });

  it('outside the non-linear LM domain (M/P − kY ≤ 0) no point is produced', () => {
    expect(lmPointForOutput(advSpec(), 2200)).toBeNull();
    expect(lmPointForOutput(advSpec(), 2300)).toBeNull();
  });

  it('the IS and LM constructions meet at the solved equilibrium (2000, 5)', () => {
    const spec = advSpec();
    expect(lmPointForOutput(spec, 2000)!).toBeCloseTo(5, 10);
    expect(crossEquilibrium(p, 5)).toBeCloseTo(2000, 10);
  });
});
