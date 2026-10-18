import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExploreExport from './ExploreExport';

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: api.post }));
const BASIS = { '1': 7, '2': 9 };
const CSV = 'metric,device_type,value\n1,app,10\n2,web,20\n';
/** Blob sizing is byte based, so a UTF-8 export must not be compared against string length. */
const bytes = (text: string) => new TextEncoder().encode(text).length;
const exportData = (over: Record<string, unknown> = {}) => ({
  sourceRevision: 'rev-3',
  measureVersions: BASIS,
  filename: 'explore-3.csv',
  mimeType: 'text/csv;charset=utf-8',
  csv: CSV,
  rowCount: 42,
  bytes: bytes(CSV),
  ...over,
});
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const failure = (status: number, message?: string) =>
  Object.assign(new Error('request failed'), { response: { status, data: message ? { message } : {} } });
/** Mirrors the backend HttpExceptionFilter envelope: { success: false, code, data }. */
const filterError = (status: number, data: unknown) =>
  Object.assign(new Error('request failed'), {
    response: { status, data: { success: false, code: status, data } },
  });
const explorePayload = {
  mode: 'explore' as const,
  query: {
    sourceId: 3,
    sourceRevision: 'rev-3',
    measureIds: [1, 2],
    dimensionColumns: ['device_type'],
    rankingMeasureId: 1,
    rankingSort: { by: 'value', direction: 'desc' },
    filters: [{ column: 'device_os', values: ['iOS'] }],
    dateRange: { column: '__time', start: '2023-09-01', end: '2023-09-30', timeZone: 'UTC' },
    trendGrain: 'day',
    comparePrevious: true,
    includeRows: false,
  },
};
const pivotPayload = {
  mode: 'pivot' as const,
  query: {
    sourceId: 3,
    sourceRevision: 'rev-3',
    measureIds: [1, 2],
    filters: [],
    comparePrevious: false,
    rowColumns: ['device_type'],
    columnColumns: ['device_os'],
  },
};

const OBJECT_URL = 'blob:http://localhost/0f0f0f0f-1111-2222-3333-444455556666';
let created: Blob[] = [];
let clicked: HTMLAnchorElement[] = [];

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: '내보내기 ▾' }));
const downloadButton = () => screen.getByRole('button', { name: 'CSV 다운로드' });
const deferred = () => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(res => {
    resolve = res;
  });
  return { promise, resolve };
};
const renderExport = (over: { payload?: any; disabled?: boolean } = {}) =>
  render(<ExploreExport measureVersions={BASIS} payload={explorePayload} disabled={false} {...over} />);

beforeEach(() => {
  api.post.mockReset();
  created = [];
  clicked = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((blob: Blob) => {
      created.push(blob);
      return OBJECT_URL;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(function (this: HTMLElement) {
    if (this.tagName === 'A') clicked.push(this as HTMLAnchorElement);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('posts the payload and downloads a validated CSV blob through a temporary anchor', async () => {
  api.post.mockResolvedValue(success(exportData()));
  renderExport();
  openPanel();
  fireEvent.click(downloadButton());

  await waitFor(() => expect(clicked).toHaveLength(1));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith(
    '/bi/explore/export',
    { ...explorePayload, query: { ...explorePayload.query, expectedMeasureVersions: BASIS } },
    {
      signal: expect.anything(),
    },
  );
  expect(created).toHaveLength(1);
  expect(created[0].type).toBe('text/csv;charset=utf-8');
  expect(created[0].size).toBe(bytes(CSV));
  expect(clicked[0].getAttribute('href')).toBe(OBJECT_URL);
  expect(clicked[0].download).toBe('explore-3.csv');
  expect(document.querySelector('a')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('42행 CSV 다운로드를 시작했습니다.');
  expect(screen.queryByRole('alert')).toBeNull();
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL), { timeout: 2000 });
});

it('accepts a UTF-8 CSV whose byte size exceeds its character count', async () => {
  const korean = '지표,구분,값\n요청수,앱,10\n';
  const koreanBytes = bytes(korean);
  expect(koreanBytes).toBeGreaterThan(korean.length);
  api.post.mockResolvedValue(
    success({ ...exportData(), csv: korean, bytes: koreanBytes, filename: 'export-utf8.csv', rowCount: 2 }),
  );
  renderExport();
  openPanel();
  fireEvent.click(downloadButton());

  await waitFor(() => expect(clicked).toHaveLength(1));
  expect(created[0].size).toBe(koreanBytes);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('stays closed until opened and blocks the download while disabled or busy', async () => {
  api.post.mockResolvedValue(success(exportData()));
  const { rerender } = render(<ExploreExport measureVersions={BASIS} payload={explorePayload} disabled />);
  expect(screen.queryByRole('button', { name: 'CSV 다운로드' })).toBeNull();
  openPanel();
  const disabledButton = downloadButton() as HTMLButtonElement;
  expect(disabledButton.disabled).toBe(true);
  expect(screen.getByText('유효한 결과를 불러온 뒤 내보내세요.')).toBeTruthy();
  fireEvent.click(disabledButton);
  expect(api.post).not.toHaveBeenCalled();

  const pending = deferred();
  api.post.mockImplementation(() => pending.promise);
  rerender(<ExploreExport measureVersions={BASIS} payload={explorePayload} disabled={false} />);
  fireEvent.click(downloadButton());
  await waitFor(() => expect(screen.getByRole('button', { name: 'CSV 준비 중…' })).toBeTruthy());
  const busyButton = screen.getByRole('button', { name: 'CSV 준비 중…' }) as HTMLButtonElement;
  expect(busyButton.disabled).toBe(true);
  fireEvent.click(busyButton);
  expect(api.post).toHaveBeenCalledTimes(1);

  await act(async () => pending.resolve(success(exportData())));
  await waitFor(() => expect(clicked).toHaveLength(1));
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('shows the server message on failure and downloads on retry', async () => {
  api.post.mockRejectedValueOnce(failure(500, '내보낼 데이터가 없습니다.'));
  renderExport();
  openPanel();
  fireEvent.click(downloadButton());

  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('내보낼 데이터가 없습니다.'));
  expect(created).toHaveLength(0);
  expect(clicked).toHaveLength(0);

  api.post.mockResolvedValueOnce(success(exportData()));
  fireEvent.click(downloadButton());
  await waitFor(() => expect(clicked).toHaveLength(1));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('42행 CSV 다운로드를 시작했습니다.');
});

it('explains a 409 revision conflict instead of the generic failure', async () => {
  api.post.mockRejectedValueOnce(failure(409));
  renderExport();
  openPanel();
  fireEvent.click(downloadButton());

  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe(
      '데이터 또는 지표 기준이 변경되었습니다. 현재 입력을 보존하고 다시 조회한 뒤 내보내세요.',
    ),
  );
  expect(created).toHaveLength(0);
  expect(clicked).toHaveLength(0);
});

it('surfaces the real exception envelope for the export limits and keeps the 409 guidance', async () => {
  const cases: Array<[number, unknown, string]> = [
    [
      400,
      '내보낼 파일이 2097152바이트를 넘습니다. 필터를 좁히거나 기간을 줄여 주세요.',
      '내보낼 파일이 2097152바이트를 넘습니다. 필터를 좁히거나 기간을 줄여 주세요.',
    ],
    [
      400,
      '내보낼 행이 10000개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.',
      '내보낼 행이 10000개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.',
    ],
    [
      400,
      { message: '내보낼 파일이 2097152바이트를 넘습니다. 필터를 좁히거나 기간을 줄여 주세요.' },
      '내보낼 파일이 2097152바이트를 넘습니다. 필터를 좁히거나 기간을 줄여 주세요.',
    ],
    [
      400,
      { message: '내보낼 행이 10000개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.' },
      '내보낼 행이 10000개를 넘습니다. 필터를 좁히거나 축을 줄여 주세요.',
    ],
    [
      409,
      { message: '파일 버전이 변경되었습니다.' },
      '데이터 또는 지표 기준이 변경되었습니다. 현재 입력을 보존하고 다시 조회한 뒤 내보내세요.',
    ],
  ];
  for (const [status, data, expected] of cases) {
    api.post.mockRejectedValueOnce(filterError(status, data));
    renderExport();
    openPanel();
    fireEvent.click(downloadButton());
    await waitFor(() => expect(screen.getByRole('alert').textContent, expected).toBe(expected));
    expect(created, expected).toHaveLength(0);
    expect(clicked, expected).toHaveLength(0);
    cleanup();
  }
});

it('drops a late response after the payload changes and aborts the in-flight request', async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  const { rerender } = renderExport();
  openPanel();
  fireEvent.click(downloadButton());
  const signal = api.post.mock.calls[0][2].signal as AbortSignal;
  expect(signal.aborted).toBe(false);

  rerender(<ExploreExport measureVersions={BASIS} payload={pivotPayload} disabled={false} />);
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => pending.resolve(success(exportData())));
  expect(created).toHaveLength(0);
  expect(clicked).toHaveLength(0);
  expect(screen.queryByRole('status')).toBeNull();

  api.post.mockResolvedValueOnce(success({ ...exportData(), filename: 'pivot-3.csv' }));
  fireEvent.click(downloadButton());
  await waitFor(() => expect(clicked).toHaveLength(1));
  expect(api.post.mock.calls.at(-1)?.[1]).toEqual({
    ...pivotPayload,
    query: { ...pivotPayload.query, expectedMeasureVersions: BASIS },
  });
  expect(clicked[0].download).toBe('pivot-3.csv');
});

it('does not download when the response arrives after unmount', async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  const view = renderExport();
  openPanel();
  fireEvent.click(downloadButton());
  const signal = api.post.mock.calls[0][2].signal as AbortSignal;
  view.unmount();

  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(success(exportData())));
  expect(created).toHaveLength(0);
  expect(clicked).toHaveLength(0);
});

it('rejects every invalid export response before creating an object URL', async () => {
  const tooBig = 'x'.repeat(2097153);
  const cases: Array<[string, Record<string, unknown>]> = [
    ['csv missing', { csv: undefined }],
    ['csv not a string', { csv: 42 }],
    ['filename with a path', { filename: '../explore-3.csv' }],
    ['filename not ASCII', { filename: '내보내기.csv' }],
    ['filename wrong extension', { filename: 'explore-3.txt' }],
    ['filename uppercase extension', { filename: 'explore-3.CSV' }],
    ['filename with a space', { filename: 'explore 3.csv' }],
    ['mime type', { mimeType: 'text/plain' }],
    ['rowCount fractional', { rowCount: 1.5 }],
    ['rowCount negative', { rowCount: -1 }],
    ['rowCount over cap', { rowCount: 10001 }],
    ['rowCount not a number', { rowCount: '42' }],
    ['bytes mismatch', { bytes: bytes(CSV) + 1 }],
    ['csv over 2MB', { csv: tooBig, bytes: tooBig.length, rowCount: 1 }],
    ['stale source revision', { sourceRevision: 'rev-2' }],
  ];
  const expectedMessage = (label: string) =>
    label === 'stale source revision'
      ? '데이터 또는 지표 기준이 변경되었습니다. 현재 입력을 보존하고 다시 조회한 뒤 내보내세요.'
      : 'CSV를 내보내지 못했습니다. 조건을 확인하고 다시 시도해 주세요.';
  for (const [label, over] of cases) {
    api.post.mockResolvedValueOnce(success(exportData(over)));
    renderExport();
    openPanel();
    fireEvent.click(downloadButton());
    await waitFor(() => expect(screen.getByRole('alert'), label).toBeTruthy());
    expect(screen.getByRole('alert').textContent, label).toBe(expectedMessage(label));
    expect(created, label).toHaveLength(0);
    expect(clicked, label).toHaveLength(0);
    expect(api.post.mock.calls.at(-1)?.[1], label).toEqual({
      ...explorePayload,
      query: { ...explorePayload.query, expectedMeasureVersions: BASIS },
    });
    cleanup();
  }
});

it('does not offer or request an export when current resource rights deny it', () => {
  render(<ExploreExport measureVersions={BASIS} payload={explorePayload} disabled={false} allowed={false} />);
  expect(screen.queryByRole('button', { name: '내보내기 ▾' })).toBeNull();
  expect(screen.getByText('내보내기 권한이 없습니다.')).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it.each([undefined, {}, { '1': 7 }, { '1': 7, '2': 0 }, { '1': 7, '2': 9, '3': 1 }])(
  'fails closed on absent or malformed actual response basis %j',
  measureVersions => {
    render(<ExploreExport payload={explorePayload} disabled={false} measureVersions={measureVersions} />);
    openPanel();
    expect((downloadButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(downloadButton());
    expect(api.post).not.toHaveBeenCalled();
  },
);
it.each([undefined, { '1': 8, '2': 9 }, { '1': 7 }, { '1': 7, '2': 9, '3': 1 }])(
  'never downloads when export returns a missing or changed metric basis %j',
  async measureVersions => {
    api.post.mockResolvedValue(success(exportData({ measureVersions })));
    renderExport();
    openPanel();
    fireEvent.click(downloadButton());
    await screen.findByText(/지표 기준이 변경/);
    expect(created).toHaveLength(0);
    expect(clicked).toHaveLength(0);
  },
);
it('suppresses an old CSV response when only the actual metric version basis changes', async () => {
  const pending = deferred();
  api.post.mockImplementation(() => pending.promise);
  const { rerender } = renderExport();
  openPanel();
  fireEvent.click(downloadButton());
  rerender(<ExploreExport payload={explorePayload} disabled={false} measureVersions={{ '1': 8, '2': 9 }} />);
  await act(async () => pending.resolve(success(exportData())));
  expect(created).toHaveLength(0);
  expect(clicked).toHaveLength(0);
});
