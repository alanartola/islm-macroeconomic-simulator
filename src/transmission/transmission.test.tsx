import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { isOutputAt, keynesianMultiplier, lmOutputAt, moneyDemand, solve } from '../engine';
import { runSimulation } from '../state/simulation';
import { SCENARIOS, demandAt, familyOf, geometry, plannedDemand, scenarioInput, stepsOf, visibleAt, type TransmissionInput } from './model';
import { domainsOf, scalesOf } from './QuadrantCharts';

const solved = (x: TransmissionInput) => {
  const sim = runSimulation(x);
  if (!sim.ok) throw new Error('no equilibrium');
  return { sim, g: geometry(x, sim.e0, sim.e1) };
};
const byId = (id: string) => solved(scenarioInput(SCENARIOS.find((s) => s.id === id)!));

describe('three markets share one solution', () => {
  it.each(SCENARIOS.map((s) => s.id))('%s: every chart uses the engine equilibria and they clear every market', (id) => {
    const x = scenarioInput(SCENARIOS.find((s) => s.id === id)!);
    const { g } = solved(x);
    const r1 = solve({ params: x.shocked, regime: x.regime, targetRate: x.target1 });
    if (!r1.ok) throw new Error('engine');
    expect(g.e1.Y).toBe(r1.value.equilibrium.Y);
    expect(g.e1.i).toBe(r1.value.equilibrium.i);
    for (const [p, e] of [
      [g.p0, g.e0],
      [g.p1, g.e1],
    ] as const) {
      // Goods market: planned demand equals output (the point lies on the 45° line).
      expect(plannedDemand(p, e.Y, e.i)).toBeCloseTo(e.Y, 9);
      expect(e.DA).toBeCloseTo(e.Y, 9);
      // IS-LM: the point lies on the IS and on the LM (or at the target rate).
      expect(isOutputAt(p, e.i)).toBeCloseTo(e.Y, 9);
      if (x.regime === 'money-supply') expect(lmOutputAt(p, e.i)).toBeCloseTo(e.Y, 9);
      // Money market: real balances equal demand kY − h·i at that income and rate.
      expect(demandAt(p, e.Y, e.i)).toBeCloseTo(e.m, 9);
      expect(moneyDemand(p, e.Y, e.i)).toBeCloseTo(e.m, 9);
    }
    if (x.regime === 'interest-target') {
      expect(g.e0.i).toBe(x.target0);
      expect(g.e1.i).toBe(x.target1);
    }
  });
});

describe('effects follow the assumptions of each policy', () => {
  it('monetary expansion: supply right, LM right, rate down, investment, demand and output up, money demand right', () => {
    const { g } = byId('monetaryExpansion');
    expect(g.family).toBe('money');
    expect(g.e1.m).toBeGreaterThan(g.e0.m);
    expect(g.moved).toMatchObject({ lm: true, is: false, ms: true, ld: true, da: true });
    expect(g.e1.i).toBeLessThan(g.e0.i);
    expect(g.e1.I).toBeGreaterThan(g.e0.I);
    expect(g.e1.Y).toBeGreaterThan(g.e0.Y);
    // DA shifts up by ΔI at every output level.
    expect(plannedDemand(g.p1, 1000, g.e1.i) - plannedDemand(g.p0, 1000, g.e0.i)).toBeCloseTo(g.e1.I - g.e0.I, 9);
    // Liquidity point: rate at the initial income; the final rate lies between it and i₀.
    expect(g.liquidity!.i).toBeCloseTo((g.p1.k * g.e0.Y - g.e1.m) / g.p1.h, 12);
    expect(g.liquidity!.i).toBeLessThan(g.e1.i);
    expect(g.e1.i).toBeLessThan(g.e0.i);
    // Money demand at the new income lies to the right at every rate.
    expect(demandAt(g.p1, g.e1.Y, 3)).toBeGreaterThan(demandAt(g.p0, g.e0.Y, 3));
  });

  it('fiscal expansion with fixed M: DA up, IS right, rate up, crowding out, money demand right, supply unchanged', () => {
    const { g } = byId('fiscalExpansion');
    expect(g.family).toBe('spending');
    expect(g.dA).toBe(50);
    expect(plannedDemand(g.p1, 1000, g.e0.i) - plannedDemand(g.p0, 1000, g.e0.i)).toBeCloseTo(50, 9);
    expect(g.moved).toMatchObject({ is: true, lm: false, ms: false, ld: true });
    expect(g.e1.m).toBe(g.e0.m);
    expect(g.e1.i).toBeGreaterThan(g.e0.i);
    expect(g.e1.I).toBeLessThan(g.e0.I);
    expect(g.crowdingOut).toBeCloseTo(-g.p1.b * (g.e1.i - g.e0.i), 12);
    expect(g.keynes!.Y - g.e0.Y).toBeCloseTo(keynesianMultiplier(g.p1) * 50, 9);
    expect(g.e1.Y).toBeLessThan(g.keynes!.Y);
    // Default calibration: half of the Keynesian effect is crowded out.
    expect((g.e1.Y - g.e0.Y) / (g.keynes!.Y - g.e0.Y)).toBeCloseTo(0.5, 9);
  });

  it('tax increase and investment shocks move the IS in the expected direction', () => {
    expect(byId('taxIncrease').g.e1.Y).toBeLessThan(byId('taxIncrease').g.e0.Y);
    expect(byId('taxCut').g.e1.Y).toBeGreaterThan(byId('taxCut').g.e0.Y);
    expect(byId('investmentUp').g.e1.i).toBeGreaterThan(byId('investmentUp').g.e0.i);
    expect(byId('investmentDown').g.e1.Y).toBeLessThan(byId('investmentDown').g.e0.Y);
  });

  it('a rate target: the central bank sets i, output responds and the quantity of money is endogenous', () => {
    const cut = byId('rateCut').g;
    expect(cut.family).toBe('target');
    expect(cut.e1.i).toBe(4);
    expect(cut.e1.Y).toBeGreaterThan(cut.e0.Y);
    expect(cut.e1.m).toBeCloseTo(moneyDemand(cut.p1, cut.e1.Y, 4), 9);
    expect(cut.e1.m).toBeGreaterThan(cut.e0.m);
    expect(cut.moved).toMatchObject({ lm: true, is: false });
    const hike = byId('rateHike').g;
    expect(hike.e1.Y).toBeLessThan(hike.e0.Y);
  });

  it('fiscal expansion with accommodation: the rate stays, no crowding out, the central bank supplies more money', () => {
    const { g } = byId('fiscalAccommodated');
    expect(g.family).toBe('accommodation');
    expect(g.e1.i).toBe(g.e0.i);
    expect(g.e1.Y - g.e0.Y).toBeCloseTo(keynesianMultiplier(g.p1) * 50, 9);
    expect(g.e1.m).toBeGreaterThan(g.e0.m);
    // Distinct from the same policy with a fixed money supply.
    expect(byId('fiscalExpansion').g.e1.Y).toBeLessThan(g.e1.Y);
  });

  it('under a rate target, changing M alone changes nothing (M is endogenous)', () => {
    const x: TransmissionInput = { ...scenarioInput(SCENARIOS[0]!), regime: 'interest-target', shocked: { ...scenarioInput(SCENARIOS[0]!).shocked, M: 900 } };
    expect(familyOf(x)).toBe('none');
    const { g } = solved(x);
    expect(g.e1.Y).toBe(g.e0.Y);
    expect(g.e1.m).toBe(g.e0.m);
  });

  it('sensitivity changes rotate curves and use the generic explanation', () => {
    const b = byId('investmentSensitivity').g;
    expect(b.family).toBe('generic');
    expect(b.moved.is).toBe(true);
    expect(b.moved.lm).toBe(false);
    const h = byId('moneyDemandSensitivity').g;
    expect(h.moved.lm).toBe(true);
    expect(h.moved.ld).toBe(true);
  });
});

describe('step-by-step explanation', () => {
  it('adapts the sequence to the shock and the regime', () => {
    expect(stepsOf('money').map((s) => s.id)).toEqual(['supply', 'lm', 'rate', 'investment', 'demand', 'output', 'joint']);
    expect(stepsOf('money')[0]!.market).toBe('money');
    expect(stepsOf('spending')[0]!.market).toBe('goods');
    expect(stepsOf('target')[0]!.market).toBe('money');
    expect(stepsOf('none')).toEqual([]);
  });

  it('reveals the final curves progressively and everything without step mode', () => {
    const steps = stepsOf('money');
    expect([...visibleAt(steps, 0)]).toEqual(['ms1']);
    expect(visibleAt(steps, 1).has('lm1')).toBe(true);
    expect(visibleAt(steps, 1).has('da1')).toBe(false);
    expect(visibleAt(steps, null).has('e1Money')).toBe(true);
  });
});

describe('the rendered diagram', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
    });
  });
  beforeEach(() => {
    localStorage.clear();
    // Desktop width: jsdom has no layout.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  const open = () => {
    window.history.replaceState(null, '', '/?m=transmission&guide=0');
    render(<App />);
  };
  const point = (id: string) => {
    const el = document.querySelector(`[data-testid="${id}"]`) as SVGGElement | null;
    if (!el) throw new Error(id);
    return { x: Number(el.dataset.px), y: Number(el.dataset.py) };
  };

  it('places summary top left, goods top right, money bottom left and IS-LM bottom right', () => {
    open();
    expect(screen.getByRole('heading', { level: 2, name: 'Transmisión macroeconómica' })).toBeInTheDocument();
    const cells = [...document.querySelectorAll('.tq-grid > .tq-cell')] as HTMLElement[];
    expect(cells.map((c) => c.style.gridArea)).toEqual(['summary', 'goods', 'money', 'islm']);
    expect(cells.map((c) => c.querySelector('[data-quadrant]')?.getAttribute('data-quadrant') ?? c.dataset.quadrant)).toEqual(['summary', 'goods', 'money', 'islm']);
    expect((document.querySelector('.tq-grid') as HTMLElement).style.gridTemplateAreas).toBe('"summary goods" "money islm"');
  });

  it('names both axes of the three charts', () => {
    open();
    for (const label of ['Demanda agregada planeada DA (mil M)', 'Saldos monetarios reales M/P (mil M a precios constantes)']) expect(screen.getAllByText(label)).toHaveLength(1);
    expect(screen.getAllByText('Producto o ingreso Y (mil M)')).toHaveLength(2);
    expect(screen.getAllByText('Tasa de interés i (%)')).toHaveLength(2);
    for (const title of ['Mercado de bienes y servicios', 'Equilibrio macroeconómico IS-LM', 'Mercado monetario']) expect(screen.getByRole('img', { name: title })).toBeInTheDocument();
  });

  it('Y₀ and Y₁ share pixels between goods and IS-LM; i₀ and i₁ between money and IS-LM', () => {
    open();
    for (const k of ['e0', 'e1']) {
      expect(point(`${k}-goods`).x).toBe(point(`${k}-islm`).x);
      expect(point(`${k}-money`).y).toBe(point(`${k}-islm`).y);
    }
  });

  it('pixels correspond to the engine values (monetary expansion, then fiscal expansion)', () => {
    open();
    const check = (id: string) => {
      const { sim, g } = byId(id);
      const s = scalesOf(domainsOf(g), 600, Math.round(Math.max(300, Math.min(500, 600 * 0.8))));
      expect(point('e1-islm').x).toBeCloseTo(s.Y(sim.e1.equilibrium.Y), 2);
      expect(point('e1-islm').y).toBeCloseTo(s.i(sim.e1.equilibrium.i), 2);
      expect(point('e1-money').x).toBeCloseTo(s.m(sim.e1.equilibrium.realMoney), 2);
      expect(point('e1-goods').y).toBeCloseTo(s.DA(sim.e1.equilibrium.Y), 2);
    };
    check('monetaryExpansion');
    fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar política o perturbación' }), { target: { value: 'fiscalExpansion' } });
    check('fiscalExpansion');
    const table = document.querySelector('.tq-values') as HTMLElement;
    expect(within(table).getAllByText('2.000,0').length).toBeGreaterThan(0);
    expect(within(table).getByText('6,00%')).toBeInTheDocument();
  });

  it('step mode walks through the mechanism of the chosen shock', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Explicar transmisión económica' }));
    expect(screen.getByText(/Paso 1 de 7/)).toBeInTheDocument();
    expect(screen.getByRole('status').textContent!.replace(/\u00a0/g, ' ')).toContain('La oferta real de dinero aumenta de 700,0 mil M a 770,0 mil M');
    // Only the money market is in focus at step 1.
    expect(document.querySelector('.tq-money')!.classList.contains('tq-focus')).toBe(true);
    expect(document.querySelector('.tq-goods')!.classList.contains('tq-dim')).toBe(true);
    // The final equilibrium is not drawn yet.
    expect(document.querySelector('[data-testid="e1-islm"]')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar política o perturbación' }), { target: { value: 'fiscalExpansion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Explicar transmisión económica' }));
    expect(screen.getByText(/Paso 1 de 6/)).toBeInTheDocument();
    expect(document.querySelector('.tq-goods')!.classList.contains('tq-focus')).toBe(true);
    expect(document.querySelector('[data-testid="keynes-goods"]')).not.toBeNull();
  });

  it('the rate-target regime makes M endogenous in the parameters panel', () => {
    open();
    fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar política o perturbación' }), { target: { value: 'rateCut' } });
    expect(screen.getAllByText('endógena')).toHaveLength(2);
    expect(screen.getByRole('spinbutton', { name: 'ī Final' })).toHaveValue(4);
  });

  it('manual parameters recompute the three charts together', () => {
    open();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'G Final' }), { target: { value: '320' } });
    const x = { ...scenarioInput(SCENARIOS.find((s) => s.id === 'monetaryExpansion')!) };
    x.shocked = { ...x.shocked, G: 320 };
    const { sim } = solved(x);
    expect(screen.getByRole('combobox', { name: 'Seleccionar política o perturbación' })).toHaveValue('custom');
    expect(point('e1-goods').x).toBe(point('e1-islm').x);
    const table = document.querySelector('.tq-values') as HTMLElement;
    expect(table.textContent).toContain(sim.e1.equilibrium.Y.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  });
});
