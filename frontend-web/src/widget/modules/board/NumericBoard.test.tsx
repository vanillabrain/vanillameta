import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analysisOptions } from '@/pages/Dashboard/analysisOptions';
import NumericBoard from './NumericBoard';
import NumericBoardSetting from '@/widget/settings/NumericBoardSetting';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key }),
}));
vi.mock('@/components/form/SelectForm', () => ({
  default: ({ name, label, value, optionList, onChange }: any) => (
    <select name={name} aria-label={label} value={value ?? ''} onChange={onChange}>
      <option value="">Default</option>
      {optionList.map((item: any) => (
        <option key={item.value ?? item} value={item.value ?? item}>
          {item.label ?? item}
        </option>
      ))}
    </select>
  ),
}));
vi.mock('@/components/form/TextFieldForm', () => ({ default: () => null }));
vi.mock('@/components/form/ColorPickerForm', () => ({ default: () => null }));
afterEach(cleanup);
const option = (content: Record<string, unknown> = {}) => ({
  header: { title: 'KPI', fontSize: 16, color: '#444' },
  content: { field: 'amount', aggregation: 'sum', fontSize: 80, color: '#222', prefix: '', suffix: '', ...content },
});
const board = (dataSet: any[], content: Record<string, unknown> = {}) =>
  render(<NumericBoard option={option(content)} dataSet={dataSet} />);

describe('NumericBoard precision and readable values', () => {
  it('renders a saved analysis unit after the value while preserving the exact amount', () => {
    render(
      <NumericBoard
        option={analysisOptions({
          type: 'BOARD_NUMERIC',
          valueField: 'value',
          suffix: ' kg',
          decimalPlaces: 0,
          numberNotation: 'full',
        })}
        dataSet={[{ value: 150 }]}
      />,
    );
    expect(screen.getByText('150 kg').title).toBe('150');
  });

  it.each([
    [634513000, 0, '635M'],
    [1500, 1, '1.5K'],
    [1000000000, 0, '1B'],
    [1000000000000, 0, '1T'],
    [999500, 0, '1M'],
    [-1500, 1, '-1.5K'],
  ])('compacts %s without changing its exact value', (amount, decimalPlaces, display) => {
    board([{ amount }], { numberNotation: 'compact', decimalPlaces });
    const value = screen.getByText(display);
    expect(value.title).toBe(String(amount));
    expect(value.getAttribute('aria-label')).toBe(String(amount));
  });
  it('preserves affixes, sub-thousand precision, and full values when compact is disabled', () => {
    const view = board([{ amount: 5.57 }], { numberNotation: 'compact', decimalPlaces: 2, prefix: '$' });
    expect(screen.getByText('$5.57')).not.toBeNull();
    view.rerender(
      <NumericBoard option={option({ numberNotation: 'full', numForm: true })} dataSet={[{ amount: 634513000 }]} />,
    );
    expect(screen.getByText('634,513,000')).not.toBeNull();
  });
  it('displays average 5.571 as 5.57 with two decimal places and exposes the unrounded value', () => {
    board([{ amount: 5.57 }, { amount: 5.572 }], { aggregation: 'avg', decimalPlaces: 2 });
    const value = screen.getByText('5.57');
    expect(value.title).toBe('5.571');
    expect(value.getAttribute('aria-label')).toBe('5.571');
  });
  it('preserves the existing one-decimal average when precision is unset', () => {
    board([{ amount: 5.571 }], { aggregation: 'avg' });
    expect(screen.getByText('5.6').title).toBe('5.571');
  });
  it('formats 634513000 with commas and keeps its exact raw title without ellipsis', () => {
    board([{ amount: 634513000 }], { numForm: true });
    const value = screen.getByText('634,513,000') as HTMLElement;
    expect(value.title).toBe('634513000');
    expect(value.className).toContain('whitespace-normal');
    expect(value.className).toContain('[overflow-wrap:anywhere]');
    expect(value.className).not.toContain('ellipsis');
    expect(value.style.fontSize).toMatch(/^clamp\(10px, .*cqw, 80px\)$/);
  });
  it.each([0, 1, 2, 3, 4, 5, 6])('supports %i decimal places with affixes', decimalPlaces => {
    board([{ amount: 12.3456789 }], { decimalPlaces, prefix: '$', suffix: ' USD' });
    expect(screen.getByText(`$${(12.3456789).toFixed(decimalPlaces)} USD`).title).toBe('12.3456789');
  });
  it.each(['sum', 'avg', 'min', 'max'])('preserves unsafe integer strings during %s aggregation', aggregation => {
    board([{ amount: '9007199254740993' }], { aggregation, numForm: true, decimalPlaces: 2 });
    expect(screen.getByText('9,007,199,254,740,993.00').title).toBe('9007199254740993');
  });
  it('sums unsafe strings exactly without an explicit precision setting', () => {
    board([{ amount: '9007199254740993' }, { amount: '2' }]);
    expect(screen.getByText('9007199254740995').title).toBe('9007199254740995');
  });
  it.each([{ rows: [] }, { rows: [{ amount: null }] }, { rows: [{ amount: '' }] }, { rows: [{ amount: 'invalid' }] }])(
    'distinguishes missing numeric data from valid zero: %j',
    ({ rows }) => {
      const view = board(rows);
      expect(screen.getByText('—').title).toBe('No data');
      view.rerender(<NumericBoard option={option()} dataSet={[{ amount: 0 }]} />);
      expect(screen.getByText('0').title).toBe('0');
    },
  );
  it('keeps an empty count as valid zero', () => {
    board([], { aggregation: 'cnt' });
    expect(screen.getByText('0').title).toBe('0');
  });
  it('clears the prior score when new input has no data', () => {
    const view = board([{ amount: 42 }]);
    view.rerender(<NumericBoard option={option()} dataSet={[]} />);
    expect(screen.queryByText('42')).toBeNull();
    expect(screen.getByText('—')).not.toBeNull();
  });
});

describe('NumericBoard precision setting', () => {
  it('stores the compact display option without changing other widget settings', () => {
    const initial = option({ decimalPlaces: 2 });
    const setOption = vi.fn();
    render(<NumericBoardSetting option={initial} setOption={setOption} spec={[]} />);
    fireEvent.change(screen.getByLabelText('Number display'), { target: { value: 'compact' } });
    expect(setOption.mock.calls[0][0].content).toMatchObject({ numberNotation: 'compact', decimalPlaces: 2 });
    expect(initial.content).not.toHaveProperty('numberNotation');
  });
  it('stores numeric precision and removes it on default without mutating input', () => {
    const initial = option();
    const setOption = vi.fn();
    const view = render(<NumericBoardSetting option={initial} setOption={setOption} spec={[]} />);
    const select = screen.getByLabelText('Decimal places') as HTMLSelectElement;
    expect(Array.from(select.options).map(item => item.value)).toEqual(['', '0', '1', '2', '3', '4', '5', '6']);
    fireEvent.change(select, { target: { value: '2' } });
    const next = setOption.mock.calls[0][0];
    expect(next.content.decimalPlaces).toBe(2);
    expect(initial.content).not.toHaveProperty('decimalPlaces');
    view.rerender(<NumericBoardSetting option={next} setOption={setOption} spec={[]} />);
    fireEvent.change(screen.getByLabelText('Decimal places'), { target: { value: '' } });
    expect(setOption.mock.calls[1][0].content).not.toHaveProperty('decimalPlaces');
    expect(next.content.decimalPlaces).toBe(2);
  });
});
