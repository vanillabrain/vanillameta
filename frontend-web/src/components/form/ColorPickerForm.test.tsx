import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ColorPickerForm from './ColorPickerForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);

const openPicker = () => {
  const onChange = vi.fn();
  render(<ColorPickerForm name="color" color="#4a4a4a" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'common.colorPicker' }));
  return onChange;
};

const hexField = () => screen.getByRole('textbox', { name: 'hex' }) as HTMLInputElement;
const applyButton = () => screen.getByRole('button', { name: 'common.apply' }) as HTMLButtonElement;

it('stages a complete HEX edit until explicit apply', () => {
  const onChange = openPicker();
  fireEvent.change(hexField(), { target: { value: 'abcdef' } });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#abcdef' } });
});

it('discards draft changes on cancel and reopens with the original color', () => {
  const onChange = openPicker();
  fireEvent.click(screen.getByRole('button', { name: '#000000' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'common.colorPicker' }));
  expect(hexField().value.toLowerCase()).toBe('4a4a4a');
});

it('blocks invalid raw HEX and recovers through a named preset', () => {
  const onChange = openPicker();
  fireEvent.change(hexField(), { target: { value: 'xyz' } });
  expect(applyButton().disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '#4A4A4A' }));
  expect(hexField().value.toLowerCase()).toBe('4a4a4a');
  fireEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#4A4A4A' } });
});

it('rejects malformed HEX lengths and accepts short and long forms', () => {
  const onChange = openPicker();
  for (const invalid of ['12', '1234', '12345', 'zzz']) {
    fireEvent.change(hexField(), { target: { value: invalid } });
    expect(applyButton().disabled).toBe(true);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  }
  fireEvent.change(hexField(), { target: { value: '0af' } });
  expect(applyButton().disabled).toBe(false);
  fireEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#0af' } });
});

it('rejects out-of-range RGB while accepting zero as a channel value', () => {
  const onChange = openPicker();
  fireEvent.change(screen.getByRole('textbox', { name: 'r', exact: true }), { target: { value: '999' } });
  expect(applyButton().disabled).toBe(true);
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'r', exact: true }), { target: { value: '0' } });
  expect(applyButton().disabled).toBe(false);
  fireEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#004a4a' } });
});

it('keeps HEX, native and RGB inputs synchronized', () => {
  openPicker();
  fireEvent.change(hexField(), { target: { value: 'ffffff' } });
  expect((screen.getByRole('textbox', { name: 'r', exact: true }) as HTMLInputElement).value).toBe('255');
  fireEvent.change(screen.getByRole('textbox', { name: 'b', exact: true }), { target: { value: '0' } });
  expect(hexField().value).toBe('ffff00');
  expect((screen.getByRole('textbox', { name: 'g', exact: true }) as HTMLInputElement).value).toBe('255');
});
