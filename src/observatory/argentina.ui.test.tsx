import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App';
import { setDataLoader } from '../data/client';
import type { SeriesFile } from '../data/core';
import { VARIABLES, relevantEpisodes, sameUnit } from './ArgentinaView';

/** Serves the published snapshot (public/data) instead of the network. */
const DATA = import.meta.glob('../../public/data/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const byPath = Object.fromEntries(Object.entries(DATA).map(([k, v]) => [k.replace('../../public/data/', ''), v]));
const series = (id: string) => byPath[`series/${id}.json`] as SeriesFile;

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});
beforeEach(() => {
  localStorage.clear();
  setDataLoader(async (path) => {
    if (!(path in byPath)) throw new Error(`HTTP 404 ${path}`);
    return byPath[path];
  });
});
afterAll(() => setDataLoader(null));

const open = async () => {
  window.history.replaceState(null, '', '/?m=observatory&guide=0');
  render(<App />);
  return screen.findByRole('heading', { level: 3, name: 'Tipo de cambio ARS/USD (mayorista)' }, { timeout: 4000 });
};
const mainChart = () => document.querySelector('.main-series') as HTMLElement;
const choose = (label: string, value: string) => fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });
const axisTitles = () => [...mainChart().querySelectorAll('.axis-title')].map((n) => n.firstChild?.textContent ?? '');

describe('Argentina: one indicator at a time', () => {
  it('shows a single main indicator by default, with both axes named', async () => {
    await open();
    const svgs = mainChart().querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    // One vertical axis (variable and unit) and one date axis.
    expect(axisTitles()).toEqual(['Tipo de cambio (ARS por USD)', 'Fecha (años)']);
    expect(mainChart().querySelectorAll('path[fill="none"]')).toHaveLength(1);
  });

  it('the menu replaces the indicator and its axis', async () => {
    await open();
    choose('Indicador', 'reserves');
    expect(within(mainChart()).getByRole('heading', { name: 'Reservas internacionales del BCRA' })).toBeInTheDocument();
    expect(axisTitles()[0]).toBe('Reservas (millones de USD)');
    choose('Indicador', 't10y');
    expect(axisTitles()[0]).toBe('Rendimiento a 10 años (% anual)');
    choose('Indicador', 'inflationM');
    expect(axisTitles()[0]).toBe('Inflación (% mensual)');
    // The transformation is stated in the axis.
    choose('Transformación', 'yoy');
    choose('Indicador', 'reserves');
    expect(axisTitles()[0]).toBe('Variación interanual de Reservas (%)');
  });

  it('uses every published observation of the period', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    const fx = series('ar_tc_mayorista');
    expect(mainChart().textContent).toContain(`${fx.data.length.toLocaleString('es-AR')} observaciones en el período (diaria)`);
    expect(mainChart().textContent).toContain('Banco Central de la República Argentina');
  });

  it('periods follow the coverage of the series', async () => {
    await open();
    choose('Indicador', 'market');
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    // TAMAR starts later, BADLAR in 2016: the window starts with the earliest of the two.
    const from = (screen.getByLabelText('Desde') as HTMLInputElement).value;
    expect(from).toBe(series('ar_badlar').status.firstObservation);
    const to = (screen.getByLabelText('Hasta') as HTMLInputElement).value;
    expect(to).toBe([series('ar_badlar'), series('ar_tamar')].map((s) => s.status.lastObservation!).sort().at(-1));
  });

  it('events can be hidden, shown as relevant ticks, or studied one at a time', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(mainChart().querySelectorAll('.event-marker').length).toBeGreaterThan(0);
    // Relevant mode: ticks on the date axis only, no vertical lines.
    expect(mainChart().querySelectorAll('line[stroke="var(--accent)"]')).toHaveLength(0);
    choose('Acontecimientos económicos', 'none');
    expect(mainChart().querySelectorAll('.event-marker')).toHaveLength(0);
    choose('Acontecimientos económicos', 'one');
    choose('Acontecimiento', '2018-08-tasa-60');
    const focus = document.querySelector('.event-focus') as HTMLElement;
    expect(focus.querySelector('h3')!.textContent).toBe('Tasa de política al 60%');
    // Before and after values of the selected indicator, from the official series.
    expect(focus.textContent).toContain('31,9');
    expect(within(focus).getAllByText('Fuentes').length).toBeGreaterThan(0);
    expect(within(focus).getAllByRole('link').every((a) => a.getAttribute('href')!.startsWith('https://'))).toBe(true);
    expect(within(focus).getByText('Ver la información histórica completa')).toBeInTheDocument();
    // The chart is positioned around the event and highlights it.
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value < '2018-08-30').toBe(true);
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value > '2018-08-30').toBe(true);
    expect(mainChart().querySelectorAll('.event-marker')).toHaveLength(1);
    expect(mainChart().querySelectorAll('rect[fill="var(--accent-soft)"]')).toHaveLength(1);
  });

  it('comparison is off by default; different units go to a synchronised panel, equal units share the axis', async () => {
    await open();
    const details = document.querySelector('.compare-panel') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    details.open = true;
    fireEvent(details, new Event('toggle'));
    choose('Segunda variable', 'policy');
    // ARS/USD and % TNA: two panels, each with its own named axis.
    expect(mainChart().querySelectorAll('.axis-title')).toHaveLength(3);
    expect(screen.getByText(/Las unidades son distintas/)).toBeInTheDocument();
    choose('Indicador', 'market');
    choose('Segunda variable', 'repo');
    // Same unit (% nominal anual, TNA): one axis.
    expect(mainChart().querySelectorAll('.axis-title')).toHaveLength(2);
    expect(screen.getByText(/Misma unidad y definición/)).toBeInTheDocument();
  });
});

describe('indicator catalogue', () => {
  it('every option refers to published series and has named axis parts', () => {
    for (const v of VARIABLES) for (const id of v.series) expect(series(id), `${v.id} ${id}`).toBeDefined();
  });

  it('series grouped in one option share unit kind (no hidden mixing of units)', () => {
    for (const v of VARIABLES) {
      const kinds = new Set(v.series.map((id) => series(id).meta.unitKind));
      expect(kinds.size, v.id).toBe(1);
    }
  });

  it('peso rates and dollar yields are never put on one axis', () => {
    expect(sameUnit(series('ar_badlar'), series('us_t10y'))).toBe(false);
    expect(sameUnit(series('ar_badlar'), series('ar_tamar'))).toBe(true);
  });

  it('relevant events are a subset of the documented episodes for every indicator', () => {
    for (const v of VARIABLES) for (const e of relevantEpisodes(v)) expect(e.topics.some((t) => v.topics.includes(t))).toBe(true);
    expect(relevantEpisodes(VARIABLES.find((v) => v.id === 'fx')!).length).toBeGreaterThan(5);
  });
});
