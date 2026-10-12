import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ColorPickerForm from './ColorPickerForm';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('@mui/material');
});
afterEach(cleanup);

const openPicker = () => {
  const onChange = vi.fn();
  render(<ColorPickerForm name="color" color="#4a4a4a" onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'common.colorPicker' }));
  return onChange;
};

it('stages a complete HEX edit until explicit apply', () => {
  const onChange = openPicker();
  fireEvent.change(screen.getByRole('textbox', { name: 'hex' }), { target: { value: 'abcdef' } });
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'common.apply' }));
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#abcdef' } });
});

it('discards draft changes on cancel and reopens with the original color', () => {
  const onChange = openPicker();
  fireEvent.click(screen.getByRole('button', { name: '#000000' }));
  fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'common.colorPicker' }));
  expect((screen.getByRole('textbox', { name: 'hex' }) as HTMLInputElement).value.toLowerCase()).toBe('4a4a4a');
});

it('blocks invalid raw HEX and recovers through a named preset', () => {
  const onChange = openPicker();
  fireEvent.change(screen.getByRole('textbox', { name: 'hex' }), { target: { value: 'xyz' } });
  expect((screen.getByRole('button', { name: 'common.apply' }) as HTMLButtonElement).disabled).toBe(true);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '#4A4A4A' }));
  expect((screen.getByRole('textbox', { name: 'hex' }) as HTMLInputElement).value.toLowerCase()).toBe('4a4a4a');
  fireEvent.click(screen.getByRole('button', { name: 'common.apply' }));
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#4A4A4A' } });
});

it('rejects out-of-range RGB while accepting zero as a channel value', () => {
  const onChange = openPicker();
  fireEvent.change(screen.getByRole('textbox', { name: 'r', exact: true }), { target: { value: '999' } });
  expect((screen.getByRole('button', { name: 'common.apply' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'r', exact: true }), { target: { value: '0' } });
  expect((screen.getByRole('button', { name: 'common.apply' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'common.apply' }));
  expect(onChange).toHaveBeenCalledWith({ target: { name: 'color', value: '#004a4a' } });
});
