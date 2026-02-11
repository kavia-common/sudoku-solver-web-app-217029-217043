import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Sudoku Solver title', () => {
  render(<App />);
  const title = screen.getByText(/Sudoku Solver/i);
  expect(title).toBeInTheDocument();
});
