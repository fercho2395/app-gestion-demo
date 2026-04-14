import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '../components/DateRangePicker';

describe('DateRangePicker', () => {
  beforeEach(() => {
    // Mock localStorage and location
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() },
      writable: true,
    });
    Object.defineProperty(window, 'location', {
      value: { search: '', href: 'http://localhost/' },
      writable: true,
    });
    Object.defineProperty(window, 'history', {
      value: { replaceState: vi.fn() },
      writable: true,
    });
  });

  it('renders the trigger button', () => {
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(/Rango de fechas/i)).toBeInTheDocument();
  });

  it('opens the dropdown when button is clicked', () => {
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all preset options in the dropdown', () => {
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Esta semana')).toBeInTheDocument();
    expect(screen.getByText('Este mes')).toBeInTheDocument();
    expect(screen.getByText('Mes anterior')).toBeInTheDocument();
    expect(screen.getByText('Trimestre a la fecha')).toBeInTheDocument();
    expect(screen.getByText('Año a la fecha')).toBeInTheDocument();
  });

  it('calls onChange with a valid date range when "Hoy" is clicked', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Hoy'));
    expect(onChange).toHaveBeenCalledOnce();
    const [range] = onChange.mock.calls[0];
    expect(range.from).toBe(range.to);
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('calls onChange with first-of-month for "Este mes"', () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ from: '', to: '' }} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Este mes'));
    const [range] = onChange.mock.calls[0];
    expect(range.from).toMatch(/-01$/);  // first day of month
  });

  it('displays custom range label when a non-preset range is active', () => {
    render(
      <DateRangePicker
        value={{ from: '2025-01-10', to: '2025-02-20' }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/2025-01-10 → 2025-02-20/)).toBeInTheDocument();
  });

  it('shows "Limpiar fechas" button when range is set', () => {
    render(
      <DateRangePicker
        value={{ from: '2025-01-01', to: '2025-01-31' }}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /2025-01-01/i }));
    expect(screen.getByText(/Limpiar fechas/i)).toBeInTheDocument();
  });

  it('calls onChange with empty range when "Limpiar fechas" is clicked', () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: '2025-01-01', to: '2025-01-31' }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /2025-01-01/i }));
    fireEvent.click(screen.getByText(/Limpiar fechas/i));
    expect(onChange).toHaveBeenCalledWith({ from: '', to: '' });
  });
});
