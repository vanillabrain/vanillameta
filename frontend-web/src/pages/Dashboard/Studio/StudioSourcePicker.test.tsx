import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import StudioSourcePicker from './StudioSourcePicker';
import { StudioSource } from './studioCreation';
const callbacks = { onSource: vi.fn(), onFile: vi.fn(), onSample: vi.fn(), onRefresh: vi.fn() };
const sources: StudioSource[] = [
  { id: 3, name: 'orders.csv', engine: 'duckdb', catalogLabel: '매출', catalogVersion: 2 },
  { id: 4, name: 'billing.csv', engine: 'duckdb', catalogLabel: '매출', catalogVersion: 1 },
  { id: 5, name: 'ＢＩＤＳ.csv', engine: 'duckdb' },
  { id: 6, name: 'external', engine: 'mysql' },
];
const props = () => ({ sources, sourceId: 3, profile: null, busy: false, ...callbacks });
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const open = () => fireEvent.click(screen.getByRole('button', { name: '데이터 검색' }));
const search = (value: string) =>
  fireEvent.change(screen.getByLabelText('업무 이름·원본 이름으로 검색'), { target: { value } });
it('starts collapsed and distinguishes equal business names by original name and ID', () => {
  render(<StudioSourcePicker {...props()} />);
  expect(screen.queryByLabelText('업무 이름·원본 이름으로 검색')).toBeNull();
  expect(screen.getByRole('option', { name: '매출 · orders.csv · #3' })).toBeTruthy();
  expect(screen.getByRole('option', { name: '매출 · billing.csv · #4' })).toBeTruthy();
});
it('filters business names while preserving the selected source and invoking no callbacks', () => {
  render(<StudioSourcePicker {...props()} />);
  open();
  search('매출');
  expect(screen.getByText('검색 결과 2개')).toBeTruthy();
  expect(screen.queryByRole('option', { name: /ＢＩＤＳ/ })).toBeNull();
  search('billing');
  expect(screen.getByText(/검색 결과 1개 · 현재 선택한 데이터는 유지/)).toBeTruthy();
  expect((screen.getByLabelText('저장된 데이터') as HTMLSelectElement).value).toBe('3');
  Object.values(callbacks).forEach(fn => expect(fn).not.toHaveBeenCalled());
});
it('normalizes unicode case and whitespace and matches ID', () => {
  render(<StudioSourcePicker {...props()} />);
  open();
  search(' bids ');
  expect(screen.getByText(/검색 결과 1개/)).toBeTruthy();
  expect(screen.getByRole('option', { name: /ＢＩＤＳ/ })).toBeTruthy();
  search('4');
  expect(screen.getByRole('option', { name: /billing/ })).toBeTruthy();
  expect(screen.queryByRole('option', { name: /ＢＩＤＳ/ })).toBeNull();
});
it('keeps unsupported engines disabled and changes source only on explicit selection', () => {
  render(<StudioSourcePicker {...props()} />);
  open();
  search('external');
  expect((screen.getByRole('option', { name: /external/ }) as HTMLOptionElement).disabled).toBe(true);
  search('billing');
  fireEvent.change(screen.getByLabelText('저장된 데이터'), { target: { value: '4' } });
  expect(callbacks.onSource).toHaveBeenCalledWith(4);
});
it('shows an empty result without clearing the current selection and restores all options when folded', () => {
  render(<StudioSourcePicker {...props()} />);
  open();
  search('missing');
  expect(screen.getByText(/검색 결과 0개/)).toBeTruthy();
  expect(screen.getByRole('option', { name: /orders/ })).toBeTruthy();
  open();
  expect(screen.getAllByRole('option')).toHaveLength(5);
  expect(callbacks.onSource).not.toHaveBeenCalled();
});
it('updates filtered candidates from a refreshed source list without resetting selection', () => {
  const view = render(<StudioSourcePicker {...props()} />);
  open();
  search('새 이름');
  expect(screen.getByText(/검색 결과 0개/)).toBeTruthy();
  view.rerender(
    <StudioSourcePicker {...props()} sources={sources.map(s => (s.id === 4 ? { ...s, catalogLabel: '새 이름' } : s))} />,
  );
  expect(screen.getByText(/검색 결과 1개/)).toBeTruthy();
  expect((screen.getByLabelText('저장된 데이터') as HTMLSelectElement).value).toBe('3');
});
it('locks search controls with the existing busy state', () => {
  const view = render(<StudioSourcePicker {...props()} />);
  open();
  view.rerender(<StudioSourcePicker {...props()} busy />);
  expect((screen.getByRole('button', { name: '데이터 검색' }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('업무 이름·원본 이름으로 검색') as HTMLInputElement).disabled).toBe(true);
});
