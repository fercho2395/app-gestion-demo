import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthYearPicker } from '../components/MonthYearPicker';

describe('MonthYearPicker', () => {
  it('renders a label', () => {
    render(<MonthYearPicker label="Fecha inicio" value={{ month: 4, year: 2026 }} onChange={vi.fn()} />);
    expect(screen.getByText('Fecha inicio')).toBeInTheDocument();
  });

  it('renders month select with Spanish names', () => {
    render(<MonthYearPicker label="Inicio" value={{ month: 4, year: 2026 }} onChange={vi.fn()} />);
    expect(screen.getByText('Abril')).toBeInTheDocument();
    expect(screen.getByText('Enero')).toBeInTheDocument();
    expect(screen.getByText('Diciembre')).toBeInTheDocument();
  });

  it('renders year select starting from current year', () => {
    const currentYear = new Date().getFullYear();
    render(<MonthYearPicker label="Inicio" value={{ month: 4, year: currentYear }} onChange={vi.fn()} />);
    expect(screen.getByText(String(currentYear))).toBeInTheDocument();
  });

  it('calls onChange with updated month when month is changed', () => {
    const onChange = vi.fn();
    render(<MonthYearPicker label="Inicio" value={{ month: 4, year: 2026 }} onChange={onChange} />);
    const monthSelect = screen.getByRole('combobox', { name: /inicio — mes/i });
    fireEvent.change(monthSelect, { target: { value: '7' } });
    expect(onChange).toHaveBeenCalledWith({ month: 7, year: 2026 });
  });

  it('calls onChange with updated year when year is changed', () => {
    const onChange = vi.fn();
    const currentYear = new Date().getFullYear();
    render(<MonthYearPicker label="Inicio" value={{ month: 4, year: currentYear }} onChange={onChange} />);
    const yearSelect = screen.getByRole('combobox', { name: /inicio — año/i });
    fireEvent.change(yearSelect, { target: { value: String(currentYear + 1) } });
    expect(onChange).toHaveBeenCalledWith({ month: 4, year: currentYear + 1 });
  });

  it('clamps month to min when year changes to min year', () => {
    const onChange = vi.fn();
    const currentYear = new Date().getFullYear();
    render(
      <MonthYearPicker
        label="Fin"
        value={{ month: 2, year: currentYear + 1 }}
        onChange={onChange}
        min={{ month: 5, year: currentYear }}
      />
    );
    const yearSelect = screen.getByRole('combobox', { name: /fin — año/i });
    fireEvent.change(yearSelect, { target: { value: String(currentYear) } });
    // month 2 < min.month 5, so should be clamped to 5
    expect(onChange).toHaveBeenCalledWith({ month: 5, year: currentYear });
  });

  it('disables month options before min when on min year', () => {
    const currentYear = new Date().getFullYear();
    render(
      <MonthYearPicker
        label="Fin"
        value={{ month: 6, year: currentYear }}
        onChange={vi.fn()}
        min={{ month: 4, year: currentYear }}
      />
    );
    // January (1) should be disabled since it's before April (min month)
    const monthSelect = screen.getByRole('combobox', { name: /fin — mes/i });
    const options = Array.from(monthSelect.querySelectorAll('option')) as HTMLOptionElement[];
    const jan = options.find((o) => o.value === '1');
    const apr = options.find((o) => o.value === '4');
    expect(jan?.disabled).toBe(true);
    expect(apr?.disabled).toBe(false);
  });

  it('uses id prop in label htmlFor', () => {
    const { container } = render(
      <MonthYearPicker id="my-picker" label="Inicio" value={{ month: 4, year: 2026 }} onChange={vi.fn()} />
    );
    const label = container.querySelector('label');
    expect(label?.htmlFor).toBe('my-picker-month');
  });
});
