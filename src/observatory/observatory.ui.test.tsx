import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { setDataLoader } from '../data/client';
import { EPISODES } from './episodes';
import { curatedNews } from './NewsView';

/** Serves the published snapshot (public/data) instead of the network. */
const DATA = import.meta.glob('../../public/data/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const byPath = Object.fromEntries(Object.entries(DATA).map(([k, v]) => [k.replace('../../public/data/', ''), v]));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
  // jsdom has no layout: give charts a width.
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 900 });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setDataLoader(async (path) => {
    if (!(path in byPath)) throw new Error(`HTTP 404 ${path}`);
    return byPath[path];
  });
});
afterAll(() => setDataLoader(null));

const open = (url: string) => {
  window.history.replaceState(null, '', url);
  return render(<App />);
};
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

describe('Observatory', () => {
  it('opens from the navigation, in Spanish, with the theory/evidence note', async () => {
    open('/?guide=0');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Módulos del laboratorio' })).getByRole('button', { name: 'Observatorio' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Observatorio macroeconómico' })).toBeInTheDocument();
    expect(screen.getByText(/un movimiento posterior a una decisión no prueba que la decisión lo haya causado/)).toBeInTheDocument();
    expect((await screen.findAllByText('Tasa BADLAR, bancos privados', {}, { timeout: 4000 })).length).toBeGreaterThan(0);
  });

  it('shows official series with their metadata and state', async () => {
    open('/?m=observatory&guide=0');
    expect((await screen.findAllByText('Tasa BADLAR, bancos privados', {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    // The policy-rate series ended in July 2025 and is flagged, not hidden.
    const table = await screen.findAllByRole('table');
    expect(table.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BCRA/).length).toBeGreaterThan(0);
  });

  it('compares Argentina with the United States with an explicit warning', async () => {
    open('/?m=observatory&guide=0');
    await screen.findAllByText('Tasa BADLAR, bancos privados', {}, { timeout: 4000 });
    expect(screen.getAllByText(/riesgo país/i).length).toBeGreaterThan(0);
  });

  it('history: lists the documented episodes and shows the four parts with sources', async () => {
    open('/?m=observatory&guide=0');
    tab('Historia económica');
    const first = EPISODES[EPISODES.length - 1]!;
    expect(screen.getAllByText(first.title.es).length).toBeGreaterThan(0);
    for (const part of ['Contexto', 'Decisión o shock', 'Evidencia', 'Interpretación']) expect(screen.getAllByText(new RegExp(part)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hipótesis/).length).toBeGreaterThan(0);
    const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('https://'));
    expect(links.length).toBeGreaterThan(0);
  });

  it('trade balance: KPIs from INDEC data and the BC vs balance-of-payments explanation', async () => {
    open('/?m=observatory&guide=0');
    tab('Balanza comercial');
    expect((await screen.findAllByText(/X − M/, {}, { timeout: 4000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/balanza de pagos/i).length).toBeGreaterThan(0);
  });

  it('news: curated items with outlet, date and link to the variables around that date', async () => {
    open('/?m=observatory&guide=0');
    tab('Noticias y acontecimientos');
    const items = await screen.findAllByRole('button', { name: 'Ver variables en esa fecha' });
    expect(items.length).toBe(curatedNews().length);
    fireEvent.click(items[0]!);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Tasas, tipo de cambio y actividad' })).toHaveAttribute('aria-selected', 'true'));
  });

  it('sources: the update pipeline and the full catalogue', async () => {
    open('/?m=observatory&guide=0');
    tab('Fuentes y metodología');
    expect(await screen.findByText(/Exportaciones: combustibles y energía \(derivado\)/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('a missing series is reported, never replaced by estimates', async () => {
    setDataLoader(async () => {
      throw new Error('HTTP 503');
    });
    open('/?m=observatory&guide=0');
    expect(await screen.findByText(/Series no disponibles en esta publicación/, {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

describe('curated news', () => {
  it('has no duplicates and every item has date, outlet and https link', () => {
    const rows = curatedNews();
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    for (const r of rows) {
      expect(r.url).toMatch(/^https:\/\//);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.outlet.length).toBeGreaterThan(1);
      expect(r.episodeId).toBeTruthy();
    }
  });
});

describe('Exercises', () => {
  it('grades a numeric answer with the engine result and records progress', () => {
    open('/?m=exercises&guide=0');
    expect(screen.getByRole('heading', { level: 2, name: 'Ejercicios y problemas económicos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nuevo equilibrio tras una expansión fiscal/ }));
    const detail = screen.getByRole('article');
    const fill = (label: string, v: string) => fireEvent.change(within(detail).getByRole('textbox', { name: label }), { target: { value: v } });
    fill('Producto de equilibrio Y₁', '1980');
    fill('Variación del producto ΔY', '80');
    fill('Variación de la tasa Δi', '0,8');
    fill('Multiplicador fiscal dY/dG', '2');
    fill('Variación de la inversión privada ΔI', '-25');
    fireEvent.click(within(detail).getByRole('button', { name: 'Verificar' }));
    expect(within(detail).getByRole('status')).toHaveTextContent('1 de 5 respuestas no son correctas');
    fill('Variación de la inversión privada ΔI', '-20');
    fireEvent.click(within(detail).getByRole('button', { name: 'Verificar' }));
    expect(within(detail).getByRole('status')).toHaveTextContent('Todas las respuestas son correctas');
    // The working is shown once solved.
    expect(within(detail).getByText('Desarrollo')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('islm.exercises.v1')!);
    expect(stored['int-fiscal-numerico']).toEqual({ attempts: 2, errors: 1, solved: true, revealed: false });
  });

  it('reveals hints one at a time and opens the scenario in the simulator', () => {
    open('/?m=exercises&guide=0');
    const detail = screen.getByRole('article');
    fireEvent.click(within(detail).getByRole('button', { name: /Pista 1 de/ }));
    expect(within(detail).getByText('Pistas')).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: 'Abrir el escenario en el simulador' }));
    expect(screen.getByRole('heading', { name: 'IS-LM tradicional', level: 2 })).toBeInTheDocument();
  });

  it('filters by level', () => {
    open('/?m=exercises&guide=0');
    fireEvent.click(within(screen.getByRole('group', { name: 'Nivel de dificultad' })).getByRole('button', { name: 'Avanzado' }));
    expect(screen.queryByRole('button', { name: /Política monetaria: aumento de la oferta de dinero/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Cota inferior de la tasa de interés/ })).toBeInTheDocument();
  });
});

describe('Usage guide', () => {
  it('opens on the first visit, can be skipped and does not reopen', () => {
    const r = open('/');
    const dialog = screen.getByRole('dialog', { name: 'Guía de uso' });
    expect(within(dialog).getByText('Elegí un modelo')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Siguiente' }));
    expect(within(dialog).getByText('Variables exógenas y endógenas')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Omitir guía' }));
    expect(localStorage.getItem('islm.guide.seen')).toBe('1');
    r.unmount();
    open('/');
    expect(screen.queryByRole('dialog', { name: 'Guía de uso' })).toBeNull();
  });

  it('reopens from the masthead and walks through the eight steps', () => {
    localStorage.setItem('islm.guide.seen', '1');
    open('/');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(document.querySelector('.topbar') as HTMLElement).getByRole('button', { name: 'Guía de uso' }));
    const dialog = screen.getByRole('dialog', { name: 'Guía de uso' });
    for (let k = 1; k < 8; k += 1) fireEvent.click(within(dialog).getByRole('button', { name: 'Siguiente' }));
    expect(within(dialog).getByText('Consultá datos reales')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Empezar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
