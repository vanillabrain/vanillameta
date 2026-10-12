import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ColorButtonForm from './ColorButtonForm';
import ColorFieldForm from './ColorFieldForm';
import ColorFieldReForm from './ColorFieldReForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material');
});
// Test the adapter boundary; the real shared picker has its own four regression tests.
vi.mock('react-color', () => ({
  SketchPicker: props => <button onClick={() => props.onChangeComplete({ hex: '#123456' })}>choose-color</button>,
}));
vi.mock('./ColorPickerForm', () => ({
  default: props => (
    <button onClick={() => props.onChange({ target: { name: props.name, value: '#123456' } })}>choose-color</button>
  ),
}));
afterEach(cleanup);

const choose = () => {
  const opener = screen.queryByRole('button', { name: 'common.colorPicker' });
  if (opener) fireEvent.click(opener);
  fireEvent.click(screen.getByRole('button', { name: 'choose-color' }));
};

it('updates one series color without mutating previous options', () => {
  const previous = {
    series: [
      { color: '#aaaaaa', field: 'a' },
      { color: '#bbbbbb', field: 'b' },
    ],
  };
  const setOption = vi.fn();
  render(<ColorButtonForm option={previous} index={1} setOption={setOption} />);
  choose();
  const next = setOption.mock.calls[0][0](previous);
  expect(previous.series[1].color).toBe('#bbbbbb');
  expect(next.series[1]).toEqual({ color: '#123456', field: 'b' });
  expect(next.series).not.toBe(previous.series);
  expect(next.series[0]).toBe(previous.series[0]);
});

it.each(['root', 'nested'])('updates %s palette without mutating its previous array', scope => {
  const colors = ['#aaaaaa', '#bbbbbb'];
  const previous = scope === 'root' ? { color: colors } : { series: { color: colors, field: 'value' } };
  const setOption = vi.fn();
  render(<ColorFieldForm value={colors[1]} colorList={colors} index={1} setOption={setOption} />);
  choose();
  const next = setOption.mock.calls[0][0](previous);
  expect(colors).toEqual(['#aaaaaa', '#bbbbbb']);
  expect(scope === 'root' ? next.color : next.series.color).toEqual(['#aaaaaa', '#123456']);
});

it('names raw inputs and preserves the caller field name in changes', () => {
  const onChange = vi.fn();
  render(<ColorFieldReForm name="pieColor" color="#aaaaaa" index={2} onChange={onChange} />);
  const input = screen.getByRole('textbox', { name: 'common.colorValue 3' });
  fireEvent.change(input, { target: { value: '#bbbbbb' } });
  expect(onChange).not.toHaveBeenCalled();
  expect((input as HTMLInputElement).value).toBe('#bbbbbb');
  fireEvent.blur(input);
  expect(onChange.mock.calls[0][0].target.name).toBe('pieColor');
  expect(onChange.mock.calls[0][0].target.value).toBe('#bbbbbb');
});

it('keeps raw palette edits local until focus leaves the input', () => {
  const setOption = vi.fn();
  const previous = { color: ['#aaaaaa', '#bbbbbb'] };
  render(<ColorFieldForm value="#bbbbbb" index={1} setOption={setOption} />);
  const input = screen.getByRole('textbox', { name: 'common.colorValue 2' });
  for (const value of ['#', '#1', '#12', '#123456']) fireEvent.change(input, { target: { value } });
  expect((input as HTMLInputElement).value).toBe('#123456');
  expect(setOption).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(setOption.mock.calls[0][0](previous).color).toEqual(['#aaaaaa', '#123456']);
});
