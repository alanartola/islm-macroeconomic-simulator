import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const open = (query: string) => {
  window.history.replaceState(null, '', `/${query}`);
  return render(<App />);
};

describe('module navigation', () => {
  it('lists the modules A–H in Spanish and opens the home screen on a first visit', () => {
    open('');
    const nav = screen.getByRole('navigation', { name: 'Módulos del laboratorio' });
    for (const name of ['Inicio', 'A IS-LM tradicional', 'B IS-LM avanzado', 'C Construcción de curvas', 'D Políticas económicas', 'E Mundell-Fleming', 'F Oferta y demanda agregada', 'G IS-MP y política monetaria', 'H Laboratorio de escenarios']) {
      expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(nav).getAllByRole('button')).toHaveLength(9);
    expect(screen.getByRole('heading', { level: 2, name: 'Laboratorio Avanzado de Macroeconomía' })).toBeInTheDocument();
    // Each home card opens its module.
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: /^G IS-MP y política monetaria/ }));
    expect(screen.getByRole('heading', { name: 'IS-MP y política monetaria', level: 2 })).toBeInTheDocument();
  });

  it('remembers the last module', () => {
    const r = open('');
    const nav = screen.getByRole('navigation', { name: 'Módulos del laboratorio' });
    fireEvent.click(within(nav).getByRole('button', { name: /IS-LM avanzado/ }));
    expect(localStorage.getItem('islm.module')).toBe('advanced');
    r.unmount();
    open('');
    expect(screen.getByRole('heading', { name: 'IS-LM avanzado', level: 2 })).toBeInTheDocument();
  });
});

describe('Module B (advanced IS-LM) in the interface', () => {
  it('shows the hand-checked equilibrium and its LM region', () => {
    open('?m=advanced');
    expect(screen.getAllByText('2.000,0 mil M').length).toBeGreaterThan(0);
    expect(screen.getByText('Zona intermedia')).toBeInTheDocument();
  });

  it('the liquidity-trap scenario is classified and explained from computed values', () => {
    open('?m=advanced');
    fireEvent.click(screen.getByRole('button', { name: /Trampa de liquidez: política monetaria/ }));
    expect(screen.getAllByText('Zona de trampa de liquidez').length).toBeGreaterThan(0);
    expect(screen.getByText(/la economía se encuentra en la zona de trampa de liquidez/)).toBeInTheDocument();
  });

  it('educational mode hides advanced parameters; advanced mode reveals them', () => {
    open('?m=advanced');
    expect(screen.queryByRole('slider', { name: /i_min/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Avanzado' }));
    expect(screen.getByRole('slider', { name: /i_min/ })).toBeInTheDocument();
    expect(screen.getByText('Elasticidades')).toBeInTheDocument();
  });

  it('switching to the lower-bound specification exposes the floor parameter', () => {
    open('?m=advanced');
    fireEvent.click(screen.getByRole('button', { name: 'Con cota inferior' }));
    expect(screen.getByRole('slider', { name: /i_piso/ })).toBeInTheDocument();
  });
});

describe('Module C (curve construction)', () => {
  it('renders the seven coordinated charts', () => {
    open('?m=construction');
    for (const title of [
      '1 · Cruz keynesiana',
      '2 · Formación de la IS',
      '3 · IS en cuatro cuadrantes',
      '4 · Mercado monetario',
      '5 · Formación de la LM',
      '6 · LM en cuatro cuadrantes',
      '7 · Equilibrio IS-LM completo',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
  });

  it('step-by-step IS construction uses the model numbers', () => {
    open('?m=construction');
    // I(3) = 300 − 25·3 = 225 and Y(3) = 2.5·(925 − 75) = 2125
    expect(screen.getByText(/I\(i_a\) = I₀ − b·3,00 = 225,0 mil M/)).toBeInTheDocument();
    expect(screen.getByText(/Y_a = 2\.125,0 mil M/)).toBeInTheDocument();
  });

  it('presentation mode shows one chart at a time and navigates with the keyboard', () => {
    open('?m=construction');
    fireEvent.click(screen.getByRole('button', { name: 'Modo presentación' }));
    const dialog = screen.getByRole('dialog', { name: 'Modo presentación' });
    expect(dialog).toHaveTextContent('1 / 7');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(dialog).toHaveTextContent('2 / 7');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Modo presentación' })).not.toBeInTheDocument();
  });
});

describe('Module D (policy lab)', () => {
  it('runs the default fiscal experiment and reports crowding out from the solved equilibria', () => {
    open('?m=policy');
    expect(screen.getByRole('heading', { name: 'Políticas económicas', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Multiplicador efectivo')).toBeInTheDocument();
    expect(screen.getByText('Efecto desplazamiento')).toBeInTheDocument();
  });

  it('accommodated fiscal expansion has zero rate change and the full simple multiplier', () => {
    open('?m=policy');
    fireEvent.click(screen.getByRole('radio', { name: /Expansión fiscal con acomodación/ }));
    // ΔG = 50, α = 2.5 ⇒ ΔY = 125 at a constant rate
    expect(screen.getAllByText('+125,0 mil M').length).toBeGreaterThan(0);
  });

  it('the policy-mix matrix shows four joint equilibria', () => {
    open('?m=policy');
    fireEvent.click(screen.getByRole('tab', { name: 'Combinación de políticas' }));
    expect(screen.getAllByText(/Suma de efectos aislados/)).toHaveLength(4);
  });
});

describe('Module E (Mundell-Fleming)', () => {
  it('starts at the hand-checked equilibrium with balanced trade', () => {
    open('?m=open');
    expect(screen.getByRole('heading', { name: 'Mundell-Fleming', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('2.000,0 mil M').length).toBeGreaterThan(0);
  });

  it('fiscal expansion with a flexible rate: no output change and a real appreciation', () => {
    open('?m=open');
    fireEvent.click(screen.getByRole('button', { name: /Expansión fiscal \(flexible\)/ }));
    expect(screen.getByText(/la moneda se aprecia en términos reales/)).toBeInTheDocument();
  });

  it('monetary expansion under a peg is offset by reserve losses', () => {
    open('?m=open');
    fireEvent.click(screen.getByRole('button', { name: /Expansión monetaria \(fijo\)/ }));
    expect(screen.getByText(/el banco central vende reservas \(-100,0 mil M\)/)).toBeInTheDocument();
  });
});

describe('Module F (AD-AS)', () => {
  it('starts at the medium-run equilibrium P = 1, Y = Yₙ = 2000', () => {
    open('?m=adas');
    expect(screen.getByRole('heading', { name: 'Oferta y demanda agregada', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('2.000,0 mil M').length).toBeGreaterThan(0);
  });

  it('a negative supply shock raises prices and lowers output (explained from computed values)', () => {
    open('?m=adas');
    fireEvent.click(screen.getByRole('button', { name: /Shock negativo de oferta/ }));
    expect(screen.getByText(/Precios y producto se mueven en direcciones opuestas/)).toBeInTheDocument();
  });

  it('a monetary expansion shows medium-run neutrality', () => {
    open('?m=adas');
    fireEvent.click(screen.getByRole('button', { name: /Expansión monetaria/ }));
    expect(screen.getByText(/el dinero es neutral en el mediano plazo/)).toBeInTheDocument();
  });
});

describe('Module G (IS-MP, Phillips, Taylor)', () => {
  it('starts at x = 0, π = π* = 2 and i = 4', () => {
    open('?m=ismp');
    expect(screen.getByRole('heading', { name: 'IS-MP y política monetaria', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText('4,00%').length).toBeGreaterThan(0);
  });

  it('the lower-bound scenario reports a binding bound', () => {
    open('?m=ismp');
    fireEvent.click(screen.getByRole('button', { name: /Cota inferior efectiva/ }));
    expect(screen.getByText('Vinculante')).toBeInTheDocument();
  });
});
