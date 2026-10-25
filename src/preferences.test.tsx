import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

/** Simulates an operating system that prefers the LIGHT colour scheme. */
function mockSystemLight() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: q.includes('light'), media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.history.replaceState(null, '', '/');
  mockSystemLight();
});

const theme = () => document.documentElement.getAttribute('data-theme');

describe('default theme: dark', () => {
  it('a first visit without stored preferences opens in dark mode even if the system prefers light', () => {
    render(<App />);
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('islm.theme')).toBeNull(); // nothing is stored until the user chooses
  });

  it('a reload without a choice stays dark', () => {
    render(<App />).unmount();
    render(<App />);
    expect(theme()).toBe('dark');
  });

  it('choosing light persists across reloads, and choosing dark again persists too', () => {
    const r1 = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema claro' }));
    expect(theme()).toBe('light');
    expect(localStorage.getItem('islm.theme')).toBe('light');
    r1.unmount();

    const r2 = render(<App />);
    expect(theme()).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }));
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('islm.theme')).toBe('dark');
    r2.unmount();

    render(<App />);
    expect(theme()).toBe('dark');
  });

  it('a link may request a theme without overwriting the stored preference', () => {
    window.history.replaceState(null, '', '/?theme=light');
    render(<App />);
    expect(theme()).toBe('light');
    expect(localStorage.getItem('islm.theme')).toBeNull();
  });

  it('the dark theme is kept in every module', () => {
    for (const m of ['basic', 'advanced', 'construction', 'policy', 'open']) {
      window.history.replaceState(null, '', `/?m=${m}`);
      const r = render(<App />);
      expect(theme(), m).toBe('dark');
      r.unmount();
    }
  });
});

describe('default language and theme together', () => {
  it('a clean first visit opens in Spanish and dark mode', () => {
    render(<App />);
    expect(document.documentElement.lang).toBe('es');
    expect(theme()).toBe('dark');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laboratorio Avanzado de Macroeconomía');
  });
});
