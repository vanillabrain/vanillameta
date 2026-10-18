import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PivotTable, { PivotResult } from './PivotTable';
const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ post: api.post, get: api.get }));
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

it('explains rate limiting and blocks export until retry succeeds', async () => {
  api.post.mockRejectedValueOnce(Object.assign(new Error('429'), { response: { status: 429 } }));
  render(<PivotTable {...props()} />);
  await screen.findByText('요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.');
  expect(screen.queryByRole('table')).toBeNull();
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Pivot 다시 시도' }));
  await screen.findByRole('table');
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(false);
});

it('does not refetch for equal-value filter objects after a parent rerender', async () => {
  const p = { ...props(), filters: [{ column: 'device_type', values: ['Mobile'] }] };
  const rendered = render(<PivotTable {...p} />);
  await screen.findByRole('table');
  const calls = api.post.mock.calls.length;
  rendered.rerender(<PivotTable {...p} filters={[{ column: 'device_type', values: ['Mobile'] }]} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(api.post.mock.calls.length).toBe(calls);
});

it('coalesces rapid filters, blocks stale exports during the delay and queries only the last condition', async () => {
  const p = { ...props(), filterDelayMs: 250 };
  const rendered = render(<PivotTable {...p} />);
  await screen.findByRole('table');
  const before = api.post.mock.calls.length;
  rendered.rerender(<PivotTable {...p} filters={[{ column: 'device_type', values: ['Mobile'] }]} />);
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('table')).toBeNull();
  rendered.rerender(<PivotTable {...p} filters={[{ column: 'device_type', values: ['Tablet'] }]} />);
  expect(api.post.mock.calls.length).toBe(before);
  await screen.findByRole('table');
  expect(api.post.mock.calls.length).toBe(before + 1);
  expect(api.post.mock.calls.at(-1)[1].filters).toEqual([{ column: 'device_type', values: ['Tablet'] }]);
});

it('cancels a scheduled filter query when unmounted', async () => {
  const p = { ...props(), filterDelayMs: 250 };
  const rendered = render(<PivotTable {...p} />);
  await screen.findByRole('table');
  const before = api.post.mock.calls.length;
  rendered.rerender(<PivotTable {...p} filters={[{ column: 'device_type', values: ['Mobile'] }]} />);
  rendered.unmount();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 300));
  });
  expect(api.post.mock.calls.length).toBe(before);
});

it.each(['success', 'error'])(
  'keeps the new source after an uncancellable old-source %s with a shared request pool',
  async outcome => {
    let finish: (value: any) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    api.post.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
    );
    const pool = new Map();
    const p = { ...props(), requestPool: pool, axes: { rowDimensions: ['device_type'], columnDimensions: ['app_or_site'] } };
    const mounted = render(<PivotTable {...p} />);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const oldSignal = api.post.mock.calls[0][2].signal;
    api.post.mockResolvedValue(success({ ...sample, sourceRevision: 'source4-rev', grandTotals: ['123456789', null] }));
    mounted.rerender(<PivotTable {...p} sourceId={4} sourceRevision="source4-rev" measureIds={[3, 4]} />);
    await screen.findByLabelText('123456789');
    expect(oldSignal.aborted).toBe(true);
    expect(api.post.mock.calls.at(-1)[1]).toMatchObject({ sourceId: 4, sourceRevision: 'source4-rev', measureIds: [3, 4] });
    await act(async () => {
      if (outcome === 'success') finish(success({ ...sample, rows: [] }));
      else fail(new Error('old source failure'));
    });
    expect(screen.getByLabelText('123456789')).toBeTruthy();
    expect(screen.queryByText('old source failure')).toBeNull();
    expect(screen.queryByText(/조건에 해당하는 원본 행/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(false);
    expect(pool.size).toBe(0);
  },
);

it('checks current server export rights before making a CSV from rendered pivot data', async () => {
  api.get.mockResolvedValue({ data: { rights: { read: true, export: false } } });
  const blob = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:denied');
  render(<PivotTable {...props()} canExport />);
  const button = await screen.findByRole('button', { name: /CSV/ });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/enterprise/resources/source/3/access'));
  expect(blob).not.toHaveBeenCalled();
  blob.mockRestore();
});
it('UC052 conditions reach Pivot requests/cache identity, readonly label and CSV selector; late old scope is discarded', async () => {
  const conditions = {
    sourceRevision: 'b'.repeat(64),
    definition: { include: { kind: 'predicate' as const, column: 'amount', operator: 'gt', values: [10] }, exclude: null },
  };
  const p = props();
  const view = render(<PivotTable {...p} conditions={conditions} />);
  await screen.findByRole('table');
  expect(api.post.mock.lastCall[1].conditions).toEqual(conditions);
  expect(api.post.mock.lastCall[1].sourceRevision).toBe('rev');
  expect(screen.getByRole('note').textContent).toContain('포함·제외 조건 적용됨');
  view.rerender(<PivotTable {...p} conditions={structuredClone(conditions)} />);
  expect(api.post).toHaveBeenCalledTimes(1);
  let late: (value: any) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        late = resolve;
      }),
  );
  const next = {
    ...conditions,
    definition: { ...conditions.definition, include: { ...conditions.definition.include, values: [20] } },
  };
  view.rerender(<PivotTable {...p} conditions={next} />);
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.post.mock.lastCall[1].conditions).toEqual(next);
  view.rerender(<PivotTable {...p} conditions={conditions} />);
  await screen.findByRole('table');
  await act(async () => late(success({ ...sample, grandTotals: ['wrong-old-scope', null] })));
  expect(screen.queryByText('wrong-old-scope')).toBeNull();
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(false);
});
it('UC052 malformed conditions block Pivot queries and CSV without unscoped fallback', () => {
  render(
    <PivotTable {...props()} conditions={{ sourceRevision: 'malformed', definition: { include: null, exclude: null } }} />,
  );
  expect(screen.getByRole('alert').textContent).toContain('조건 없는 결과로 대체하지 않습니다');
  expect(api.post).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'Pivot CSV 내보내기' }) as HTMLButtonElement).disabled).toBe(true);
});
it.each([false, true])(
  'review BLOCK2 rejects absent export authority with undefined canExport (embedded=%s)',
  async embedded => {
    api.get.mockResolvedValue({ data: { rights: { read: true, export: false } } });
    const blob = vi.spyOn(globalThis, 'Blob');
    const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:denied');
    try {
      render(<PivotTable {...props()} embedded={embedded} />);
      await screen.findByRole('table');
      fireEvent.click(screen.getByRole('button', { name: 'Pivot CSV 내보내기' }));
      await screen.findByText('CSV를 만들지 못했습니다. 다시 시도해 주세요.');
      expect(api.get).toHaveBeenCalledWith('/enterprise/resources/source/3/access');
      expect(blob).not.toHaveBeenCalled();
      expect(url).not.toHaveBeenCalled();
    } finally {
      blob.mockRestore();
      url.mockRestore();
    }
  },
);
it('review BLOCK2 checks fresh export authorization per download and fails closed on revoked, malformed or failed permission reads', async () => {
  api.get.mockReset();
  api.get
    .mockResolvedValueOnce({ data: { rights: { read: true, export: true } } })
    .mockResolvedValueOnce({ data: { rights: { read: true, export: false } } })
    .mockResolvedValueOnce({ data: { rights: { export: 'true' } } })
    .mockRejectedValueOnce(new Error('permission unavailable'));
  const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:authorized');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  try {
    render(<PivotTable {...props()} />);
    await screen.findByRole('table');
    const download = screen.getByRole('button', { name: 'Pivot CSV 내보내기' });
    fireEvent.click(download);
    await screen.findByText('Pivot CSV를 내보냈습니다. 숫자는 축약·반올림하지 않은 집계값입니다.');
    expect(url).toHaveBeenCalledTimes(1);
    for (let attempt = 2; attempt <= 4; attempt++) {
      await act(async () => {
        fireEvent.click(download);
      });
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(attempt));
      expect(url).toHaveBeenCalledTimes(1);
      expect(click).toHaveBeenCalledTimes(1);
    }
  } finally {
    url.mockRestore();
    click.mockRestore();
  }
});
it('review BLOCK2 drops export permission arriving after the source scope changes', async () => {
  let permit: (value: any) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        permit = resolve;
      }),
  );
  const url = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale');
  try {
    const p = props();
    const view = render(<PivotTable {...p} />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Pivot CSV 내보내기' }));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    view.rerender(<PivotTable {...p} filters={[{ column: 'device_type', values: ['next'] }]} />);
    await act(async () => permit({ data: { rights: { read: true, export: true } } }));
    expect(url).not.toHaveBeenCalled();
  } finally {
    url.mockRestore();
  }
});
