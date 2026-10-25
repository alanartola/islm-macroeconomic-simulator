import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../../App';
import { DEFAULT_PARAMS } from '../../engine';
import { ADAS_DEFAULTS } from '../../engine/adas/adas';
import { ISMP_DEFAULTS } from '../../engine/ismp/ismp';
import { decodeConfigHash, encodeConfigHash, exportScenarios, type LabConfig } from '../../lab/scenario';

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

const open = (url: string) => {
  window.history.replaceState(null, '', url);
  return render(<App />);
};
const nav = () => screen.getByRole('navigation', { name: 'Módulos del laboratorio' });
const goTo = (name: RegExp) => fireEvent.click(within(nav()).getByRole('button', { name }));

const basic: LabConfig = { model: 'basic', baseline: { ...DEFAULT_PARAMS }, shocked: { ...DEFAULT_PARAMS, G: 300 }, regime: 'money-supply', target0: 5, target1: 5 };
const adas: LabConfig = { model: 'adas', baseline: { ...ADAS_DEFAULTS }, shocked: { ...ADAS_DEFAULTS, M: 1200 } };
const ismp: LabConfig = { model: 'ismp', baseline: { ...ISMP_DEFAULTS }, shocked: { ...ISMP_DEFAULTS, d: 2 }, regime: 'rule' };

describe('Module H — scenario lab', () => {
  it('starts empty and explains how to add scenarios', () => {
    open('/?m=lab');
    expect(screen.getByRole('heading', { name: 'Laboratorio de escenarios', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay escenarios guardados')).toBeInTheDocument();
  });

  it('saves experiments from different modules and compares only equivalent variables', () => {
    open('/?m=basic');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar experimento' }));
    goTo(/IS-MP y política monetaria/);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar experimento' }));
    goTo(/Laboratorio de escenarios/);

    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(2);
    // Output exists in IS-LM but not in IS-MP: reported as undefined, never compared.
    expect(screen.getAllByText('Producto Y (mil M)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('no definido en este modelo').length).toBeGreaterThan(0);
    expect(screen.getByText(/El modelo IS-MP mide la actividad como brecha del producto/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Comparación de equilibrios en (Y, i)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Variación por escenario' })).toBeInTheDocument();
  });

  it('stores scenarios across reloads, limits the comparison to four and deletes', () => {
    const list = [basic, adas, ismp, basic, adas].map((config, k) => ({ id: `s${k}`, name: `Escenario ${k + 1}`, createdAt: '2026-10-25T12:00:00.000Z', config }));
    localStorage.setItem('islm.lab.v1', JSON.stringify(list));
    open('/?m=lab');
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    boxes.slice(0, 4).forEach((b) => fireEvent.click(b));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(4);
    expect(boxes[4]).toBeDisabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]!);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(JSON.parse(localStorage.getItem('islm.lab.v1')!)).toHaveLength(4);
  });

  it('imports a JSON export (recomputing results) and rejects invalid files', async () => {
    open('/?m=lab');
    const input = screen.getByTestId('lab-import') as HTMLInputElement;
    const good = new File([exportScenarios([{ id: 'a', name: 'Importado', createdAt: '2026-10-25T12:00:00.000Z', config: adas }])], 'lab.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(() => expect(screen.getByText('Importados: 1. Rechazados por datos inválidos: 0.')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Importado')).toBeInTheDocument();

    const bad = new File(['{"format":"otro"}'], 'x.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [bad] } });
    await waitFor(() => expect(screen.getByText(/no es una exportación del laboratorio/)).toBeInTheDocument());
  });

  it('the report lists assumptions, shock, equilibria, explanation, equations and limitations', () => {
    localStorage.setItem('islm.lab.v1', JSON.stringify([{ id: 'a', name: 'Expansión monetaria', createdAt: '2026-10-25T12:00:00.000Z', config: adas }]));
    open('/?m=lab');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Informe' }));
    expect(screen.getByRole('heading', { name: 'Informe de escenarios' })).toBeInTheDocument();
    for (const h of ['Supuestos', 'Perturbación', 'Parámetros iniciales y perturbación', 'Equilibrio inicial (E₀), final (E₁) y variaciones', 'Explicación económica', 'Ecuaciones', 'Limitaciones']) {
      expect(screen.getByRole('heading', { name: h })).toBeInTheDocument();
    }
    const shock = screen.getAllByText((_, el) => el?.tagName === 'LI' && /\(M\):/.test(el.textContent ?? ''));
    expect(shock[0]!.textContent).toMatch(/→ 1\.?200,0000 \(\+100,0000\)/);
  });

  it('opens a saved scenario in its module with its parameters', () => {
    localStorage.setItem('islm.lab.v1', JSON.stringify([{ id: 'a', name: 'OA-DA', createdAt: '2026-10-25T12:00:00.000Z', config: adas }]));
    open('/?m=lab');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(screen.getByRole('heading', { name: 'Oferta y demanda agregada', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('1200').length).toBeGreaterThan(0);
  });

  it('a "#x=" link reopens the exact configuration in its module', () => {
    open(`/?m=ismp${encodeConfigHash(ismp)}`);
    expect(screen.getByRole('heading', { name: 'IS-MP y política monetaria', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('2').length).toBeGreaterThan(0);
  });

  it('a malformed link is ignored and the module opens with its defaults', () => {
    open('/?m=adas#x=%%%');
    expect(screen.getByRole('heading', { name: 'Oferta y demanda agregada', level: 2 })).toBeInTheDocument();
  });

  it('the top-bar link reproduces the configuration of modules that keep local state (F)', async () => {
    const copied: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (s: string) => void copied.push(s) } });
    open('/?m=adas');
    fireEvent.click(screen.getByRole('button', { name: /^Expansión monetaria/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() => expect(copied).toHaveLength(1));
    const url = new URL(copied[0]!);
    expect(url.searchParams.get('m')).toBe('adas');
    const cfg = decodeConfigHash(url.hash);
    expect(cfg?.model === 'adas' && cfg.shocked.M).toBe(1200);
  });
});
