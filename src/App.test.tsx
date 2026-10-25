import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  // jsdom does not implement matchMedia; the app falls back to the light theme.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/?lang=en');
});

function kpi(label: string) {
  const card = screen.getByTitle(label).closest('.kpi') as HTMLElement;
  return within(card).getByText((_, el) => el?.classList.contains('value') ?? false).textContent;
}

describe('App (integration)', () => {
  it('renders the title, the IS-LM chart and the default equilibrium', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('IS-LM');
    expect(screen.getByRole('img', { name: /IS-LM chart/ })).toBeInTheDocument();
    expect(kpi('Output / income')).toBe('1,900.0 bn');
    expect(kpi('Interest rate')).toBe('5.00%');
  });

  it('applying the fiscal-expansion scenario updates results and insights', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /C · Fiscal expansion: G↑/ }));
    expect(kpi('Output / income')).toBe('2,000.0 bn');
    expect(kpi('Interest rate')).toBe('6.00%');
    expect(screen.getByText(/Crowding out: the higher interest rate/)).toBeInTheDocument();
  });

  it('the interest-target regime hides the money-supply control and keeps i at the target', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Interest-rate target/ }));
    expect(screen.queryByRole('slider', { name: /M — Nominal money supply/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /C · Fiscal expansion: G↑/ }));
    expect(kpi('Interest rate')).toBe('5.00%');
    expect(kpi('Output / income')).toBe('2,100.0 bn');
  });

  it('invalid input shows an error instead of silently computing', () => {
    render(<App />);
    const input = screen.getAllByRole('textbox').find((el) => (el as HTMLInputElement).value === '0.75') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/marginal propensity to consume must satisfy/);
  });

  it('switches the interface to Spanish', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'es' } });
    expect(screen.getByRole('tab', { name: 'Simulador' })).toBeInTheDocument();
  });
});
