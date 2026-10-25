import { render, screen } from '@testing-library/react';
import App from './App';

describe('App scaffold', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('IS-LM');
  });
});
