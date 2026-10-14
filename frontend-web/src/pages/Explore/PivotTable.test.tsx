import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PivotTable, { PivotResult } from './PivotTable';
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post }));
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Box: ({ component: Tag = 'div', children, ...props }: any) => (
      <Tag role={props.role} aria-label={props['aria-label']} title={props.title} id={props.id}>
        {children}
      </Tag>
    ),
    Stack: Container,
    Card: Container,
    Divider: () => <hr />,
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    Typography: ({ component: Tag = 'p', children, role, title, 'aria-label': label }: any) => (
      <Tag role={role} title={title} aria-label={label}>
        {children}
      </Tag>
    ),
    Button: ({
      children,
      disabled,
      onClick,
      'aria-label': ariaLabel,
      'aria-pressed': pressed,
      'aria-expanded': expanded,
      'aria-describedby': describedBy,
    }: any) => (
      <button
        aria-label={ariaLabel}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    ),
    Chip: ({ label, onDelete }: any) => (
      <span>
        {label}
        {onDelete && (
          <button aria-label={`삭제 ${label}`} onClick={onDelete}>
            삭제
          </button>
        )}
      </span>
    ),
    Checkbox: ({ checked, onChange, inputProps }: any) => (
      <input type="checkbox" aria-label={inputProps?.['aria-label']} checked={checked} onChange={onChange} />
    ),
    FormControlLabel: ({ control, label }: any) => (
      <label>
        {control}
        {label}
      </label>
    ),
    // Emulate MUI: a select only becomes a native <select> when the caller asks for it.
    // Raw <option> children inside a non-native MUI Select are inert, so any test that
    // drives the control by change fails unless the component passes native: true.
    TextField: ({ label, select, type, value, onChange, disabled, children, placeholder, slotProps }: any) => {
      const native = slotProps?.select?.native === true;
      return (
        <label>
          {label}
          {select ? (
            native ? (
              <select aria-label={label} data-native="true" value={value} onChange={onChange} disabled={disabled}>
                {children}
              </select>
            ) : (
              <span role="combobox" aria-label={label} data-native="false">
                {children}
              </span>
            )
          ) : (
            <input
              aria-label={label}
              type={type || 'text'}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              disabled={disabled}
            />
          )}
        </label>
      );
    },
  };
});

const sample: PivotResult = {
  sourceRevision: 'rev',
  metrics: [
    { id: 1, label: 'Requests', decimalPlaces: 0, numberNotation: 'compact' },
    { id: 2, label: 'Ratio', prefix: '$', decimalPlaces: 2 },
  ],
  rows: [
    {
      key: '[null]',
      values: [null],
      totals: ['9007199254740993', null],
      cells: [{ columnKey: '["App"]', values: ['9007199254740993', null] }],
    },
  ],
  columns: [
    { key: '["App"]', values: ['App'], totals: ['9007199254740993', null] },
    { key: '["Site"]', values: ['Site'], totals: [0, null] },
  ],
  grandTotals: ['9007199254740993', null],
  limits: {
    rowLimit: 50,
    columnLimit: 12,
    totalRowGroups: 60,
    totalColumnGroups: 15,
    truncatedRows: true,
    truncatedColumns: true,
  },
};
const success = (data: PivotResult = sample) => ({ data: { status: 'SUCCESS', data } });
const props = () => ({
  sourceId: 3,
  sourceRevision: 'rev',
  dimensions: [
    { column: 'device_type' },
    { column: 'app_or_site' },
    { column: 'device_os' },
    { column: '__time', temporal: true },
  ],
  measureIds: [1, 2],
  filters: [{ column: 'amount', range: { min: 1, max: 10 } }],
  dateRange: { column: '__time', start: '2023-09-10', end: '2023-09-11', timeZone: 'UTC' },
  paused: false,
  onFilter: vi.fn(),
  onReloadCatalog: vi.fn(),
});
beforeEach(() => {
  api.post.mockReset();
  api.post.mockResolvedValue(success());
});
afterEach(cleanup);
it('pivot sends only canonical current conditions and preserves sparse/null/exact values and full totals', async () => {
  const p = props();
  render(<PivotTable {...p} />);
  await screen.findByRole('table');
  fireEvent.change(screen.getByRole('combobox', { name: 'Pivot 열 차원' }), { target: { value: 'app_or_site' } });
  await waitFor(() =>
    expect(api.post.mock.calls.at(-1)[1]).toEqual({
      sourceId: 3,
      sourceRevision: 'rev',
      measureIds: [1, 2],
      rowDimensions: ['device_type'],
      columnDimensions: ['app_or_site'],
      filters: p.filters,
      dateRange: p.dateRange,
    }),
  );
  await screen.findByRole('table');
  expect(screen.getByText(/합계에는 숨겨진 그룹/)).toBeTruthy();
  expect(screen.getAllByLabelText('9007199254740993').length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText('조합 없음').length).toBe(2);
  expect(screen.getAllByText('값 없음').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 행 필터 (NULL)' }));
  expect(p.onFilter).toHaveBeenCalledWith([...p.filters, { column: 'device_type', values: [null] }]);
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 열 필터 App' }));
  expect(p.onFilter).toHaveBeenLastCalledWith([...p.filters, { column: 'app_or_site', values: ['App'] }]);
});
it('pivot swaps axes and restricts overlap without changing the shared filters', async () => {
  render(<PivotTable {...props()} />);
  await screen.findByRole('table');
  fireEvent.change(screen.getByRole('combobox', { name: 'Pivot 열 차원' }), { target: { value: 'app_or_site' } });
  await screen.findByRole('table');
  fireEvent.click(screen.getByRole('button', { name: '행·열 바꾸기' }));
  await waitFor(() =>
    expect(api.post.mock.calls.at(-1)[1]).toMatchObject({
      rowDimensions: ['app_or_site'],
      columnDimensions: ['device_type'],
    }),
  );
  expect(
    (screen.getByRole('combobox', { name: 'Pivot 두 번째 행 차원' }) as HTMLSelectElement).options.namedItem('device_type'),
  ).toBeNull();
  fireEvent.change(screen.getByRole('combobox', { name: 'Pivot 두 번째 행 차원' }), { target: { value: 'device_os' } });
  await waitFor(() => expect(api.post.mock.calls.at(-1)[1].rowDimensions).toEqual(['app_or_site', 'device_os']));
  expect((screen.getByRole('button', { name: '행·열 바꾸기' }) as HTMLButtonElement).disabled).toBe(true);
});
it('pivot clears stale results on failure and retries the current request', async () => {
  render(<PivotTable {...props()} />);
  await screen.findByRole('table');
  api.post.mockRejectedValueOnce(
    Object.assign(new Error('503'), { response: { status: 503, data: { data: { message: '연결 장애' } } } }),
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Pivot 열 차원' }), { target: { value: 'app_or_site' } });
  await screen.findByText('연결 장애');
  expect(screen.queryByRole('table')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 다시 시도' }));
  await screen.findByRole('table');
  expect(screen.queryByText('연결 장애')).toBeNull();
});
it('pivot discards superseded axis responses and aborts when source state changes or pauses', async () => {
  let resolve: (v: any) => void;
  api.post.mockImplementationOnce(() => new Promise(r => (resolve = r)));
  const p = props();
  const rendered = render(<PivotTable {...p} />);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const signal = api.post.mock.calls[0][2].signal;
  fireEvent.change(screen.getByRole('combobox', { name: 'Pivot 열 차원' }), { target: { value: 'app_or_site' } });
  await screen.findByRole('table');
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(success({ ...sample, rows: [] })));
  expect(screen.queryByText(/조건에 해당하는 원본 행/)).toBeNull();
  const before = api.post.mock.calls.length;
  rendered.rerender(<PivotTable {...p} paused />);
  expect(screen.queryByRole('table')).toBeNull();
  expect(api.post.mock.calls.length).toBe(before);
});
it('pivot rejects mismatched revisions and routes 409 retry to catalog reload', async () => {
  const p = props();
  api.post.mockRejectedValueOnce(
    Object.assign(new Error('409'), { response: { status: 409, data: { data: { message: '버전 변경' } } } }),
  );
  render(<PivotTable {...p} />);
  await screen.findByText('버전 변경');
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 카탈로그 다시 불러오기' }));
  expect(p.onReloadCatalog).toHaveBeenCalledTimes(1);
});

it('pivot puts full totals first and keeps compact integer tenths with exact cell labels', async () => {
  const data: PivotResult = {
    ...sample,
    rows: [
      {
        key: '["Mobile"]',
        values: ['Mobile'],
        totals: [23850800, 2.84],
        cells: [{ columnKey: '["App"]', values: [23850800, 2.84] }],
      },
    ],
    columns: [{ key: '["App"]', values: ['App'], totals: [23850800, 2.84] }],
    grandTotals: [23850800, 2.84],
  };
  api.post.mockResolvedValue(success(data));
  render(<PivotTable {...props()} />);
  const table = await screen.findByRole('table');
  expect(table.querySelector('tbody tr th')?.textContent).toBe('전체 합계');
  expect(screen.getAllByText('23.9M').length).toBeGreaterThan(0);
  expect(screen.getAllByLabelText('23850800').length).toBeGreaterThan(0);
});

it('controlled restored axes notify readiness and block stale exports until the new request finishes', async () => {
  const ready = vi.fn();
  const p = { ...props(), onReady: ready, axes: { rowDimensions: ['device_os'], columnDimensions: ['app_or_site'] } };
  const { rerender } = render(<PivotTable {...p} />);
  await screen.findByRole('table');
  expect(api.post.mock.calls.at(-1)[1].rowDimensions).toEqual(['device_os']);
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(false);
  let finish: any;
  api.post.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  rerender(<PivotTable {...p} axes={{ rowDimensions: ['device_type'], columnDimensions: [] }} />);
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(ready.mock.calls.at(-1)[0].reason).not.toBe('');
  await act(async () => finish(success()));
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(false);
  expect(ready.mock.calls.at(-1)[0].reason).toBe('');
});

it('explains paused reason without querying or enabling export', async () => {
  render(<PivotTable {...props()} paused pauseReason="필터를 5개 이하로 줄여 주세요." />);
  expect(screen.getByText('필터를 5개 이하로 줄여 주세요.')).toBeTruthy();
  expect(screen.queryByText('완성한 기간과 지표·행 차원을 선택하세요.')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
});
