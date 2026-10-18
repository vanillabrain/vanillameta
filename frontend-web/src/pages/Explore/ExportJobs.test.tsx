import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ExportJobs from './ExportJobs';
import ExploreExport from './ExploreExport';
import { ExportJob, ExportJobStatus, exportJobsService } from '@/api/exportJobsService';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
const payload = {
  mode: 'explore' as const,
  query: { sourceId: 3, sourceRevision: 'rev-3', measureIds: [1], filters: [{ column: 'kind', values: ['app'] }] },
};
const versions = { '1': 2 };
const job = (over: Partial<ExportJob> = {}): ExportJob => ({
  id: 7,
  requestId: '11111111-1111-4111-8111-111111111111',
  sourceId: 3,
  sourceRevision: 'rev-3',
  measureVersions: versions,
  payload,
  status: 'queued',
  version: 1,
  createdAt: '2026-10-18T00:00:00Z',
  expiresAt: '2026-10-19T00:00:00Z',
  filename: null,
  errorCode: null,
  rowCount: 0,
  bytes: 0,
  ...over,
});
const reply = (data: unknown) => ({ data });
const failure = (status: number) => Object.assign(new Error('request failed'), { response: { status } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(res => {
    resolve = res;
  });
  return { promise, resolve };
};
const setup = () => {
  const view = render(<ExportJobs payload={payload} measureVersions={versions} disabled={false} />);
  click('파일 작업 펼치기');
  return view;
};
const create = async () => {
  click('현재 조건으로 작업 접수');
  await waitFor(() => expect(screen.getByText(/작업 #7 ·/)).toBeTruthy());
};
const file = (over: Record<string, unknown> = {}) => {
  const csv = '종류,값\n앱,42\n';
  return {
    sourceRevision: 'rev-3',
    filename: 'export-7.csv',
    mimeType: 'text/csv;charset=utf-8',
    csv,
    rowCount: 1,
    bytes: new TextEncoder().encode(csv).length,
    sha256: 'a'.repeat(64),
    ...over,
  };
};
let blobs: Blob[];
beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.post.mockImplementation(async (_path, body) => reply(job({ requestId: body.requestId ?? job().requestId })));
  blobs = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:test';
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('opens and collapses without any automatic read, create, run or polling', async () => {
  render(<ExportJobs payload={payload} measureVersions={versions} disabled={false} />);
  expect(screen.queryByText('현재 조건으로 작업 접수')).toBeNull();
  click('파일 작업 펼치기');
  click('파일 작업 접기');
  click('파일 작업 펼치기');
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

it('posts pinned versions, then explicitly runs and cancels with current versions', async () => {
  setup();
  await create();
  expect(api.post).toHaveBeenCalledTimes(1);
  const body = api.post.mock.calls[0][1];
  expect(body).toEqual({ requestId: expect.any(String), payload, measureVersions: versions });
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  api.post.mockResolvedValueOnce(reply(job({ status: 'ready', version: 2 })));
  click('CSV 만들기');
  await waitFor(() => expect(screen.getByText(/파일 준비됨 · 버전 2/)).toBeTruthy());
  expect(api.post).toHaveBeenLastCalledWith('/bi/export-jobs/7/run', { expectedVersion: 1 });
  expect(button('CSV 만들기').disabled).toBe(true);
  api.post.mockResolvedValueOnce(reply(job({ status: 'cancelled', version: 3 })));
  click('작업 취소');
  await waitFor(() => expect(screen.getByText(/취소됨 · 버전 3/)).toBeTruthy());
  expect(api.post).toHaveBeenLastCalledWith('/bi/export-jobs/7/cancel', { expectedVersion: 2 });
  expect(button('고정 파일 받기').disabled).toBe(true);
  expect(api.get).not.toHaveBeenCalled();
});

it('freezes ambiguous UUID/body and locks history across collapse and changed conditions', async () => {
  const pendingResponse = deferred();
  api.post.mockReturnValueOnce(pendingResponse.promise);
  const view = setup();
  click('현재 조건으로 작업 접수');
  const original = JSON.parse(JSON.stringify(api.post.mock.calls[0][1]));
  expect(button('이전 작업 읽기').disabled).toBe(true);
  click('파일 작업 접기');
  view.rerender(
    <ExportJobs payload={{ ...payload, query: { ...payload.query, filters: [] } }} measureVersions={{ '1': 9 }} disabled />,
  );
  click('파일 작업 펼치기');
  await act(async () => pendingResponse.resolve(Promise.reject(failure(503))));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(button('이전 작업 읽기').disabled).toBe(true);
  expect(button('같은 접수 재확인').disabled).toBe(false);
  click('같은 접수 재확인');
  await waitFor(() => expect(button('이전 작업 읽기').disabled).toBe(false));
  expect(api.post.mock.calls[1][1]).toEqual(original);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.get).not.toHaveBeenCalled();
});

it('keeps the selected job immutable after current revision and conditions change', async () => {
  const view = setup();
  await create();
  view.rerender(
    <ExportJobs
      payload={{ mode: 'pivot', query: { ...payload.query, sourceRevision: 'new-revision', filters: [] } }}
      measureVersions={{ '1': 3 }}
      disabled
    />,
  );
  expect(screen.getByText(/고정 revision rev-3/)).toBeTruthy();
  expect(screen.getByText(/"app"/)).toBeTruthy();
  api.post.mockResolvedValueOnce(reply(job({ status: 'ready', version: 2 })));
  click('CSV 만들기');
  await waitFor(() => expect(screen.getByText(/파일 준비됨/)).toBeTruthy());
  expect(api.post).toHaveBeenLastCalledWith('/bi/export-jobs/7/run', { expectedVersion: 1 });
});

it('reads paginated server history after remount without automatically recreating jobs', async () => {
  const first = setup();
  await create();
  first.unmount();
  setup();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(reply({ entries: [job()], nextBeforeId: 7 }));
  click('이전 작업 읽기');
  await waitFor(() => expect(screen.getByText('작업 #7 · 소스 3 · 대기')).toBeTruthy());
  api.get.mockResolvedValueOnce(reply({ entries: [job({ id: 6 })], nextBeforeId: null }));
  click('이전 20개 읽기');
  await waitFor(() => expect(screen.getByText('작업 #6 · 소스 3 · 대기')).toBeTruthy());
  expect(api.get).toHaveBeenLastCalledWith('/bi/export-jobs', { beforeId: 7 });
  api.get.mockResolvedValueOnce(reply(job({ id: 6, status: 'interrupted', version: 4 })));
  click('작업 #6 · 소스 3 · 대기');
  await waitFor(() => expect(screen.getByText(/작업 #6 · 실행 중단 · 버전 4/)).toBeTruthy());
  expect(api.get).toHaveBeenLastCalledWith('/bi/export-jobs/6');
  expect(button('CSV 만들기').disabled).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('ignores late create, list and file responses after source changes', async () => {
  for (const kind of ['create', 'list', 'file']) {
    const response = deferred();
    const view = setup();
    if (kind === 'create') {
      api.post.mockReturnValueOnce(response.promise);
      click('현재 조건으로 작업 접수');
    }
    if (kind === 'list') {
      api.get.mockReturnValueOnce(response.promise);
      click('이전 작업 읽기');
    }
    if (kind === 'file') {
      api.post.mockImplementationOnce(async (_path, body) => reply(job({ requestId: body.requestId, status: 'ready' })));
      await create();
      api.get.mockReturnValueOnce(response.promise);
      click('고정 파일 받기');
    }
    view.rerender(
      <ExportJobs
        payload={{ ...payload, query: { ...payload.query, sourceId: 4 } }}
        measureVersions={versions}
        disabled={false}
      />,
    );
    click('파일 작업 펼치기');
    await act(async () =>
      response.resolve(
        reply(
          kind === 'list'
            ? { entries: [job()], nextBeforeId: null }
            : kind === 'file'
            ? file()
            : job({ requestId: api.post.mock.calls.at(-1)?.[1].requestId }),
        ),
      ),
    );
    expect(screen.queryByText(/작업 #7/)).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    view.unmount();
  }
});

it('requires state read after a lost run response and uses the freshly read version', async () => {
  setup();
  await create();
  api.post.mockRejectedValueOnce(failure(503));
  click('CSV 만들기');
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(button('CSV 만들기').disabled).toBe(true);
  expect(button('작업 취소').disabled).toBe(true);
  api.get.mockResolvedValueOnce(reply(job({ status: 'failed', errorCode: 'QUERY_FAILED', version: 3 })));
  click('선택 작업 다시 읽기');
  await waitFor(() => expect(screen.getByText(/실행 오류: QUERY_FAILED/)).toBeTruthy());
  api.post.mockResolvedValueOnce(reply(job({ status: 'ready', version: 4 })));
  click('CSV 만들기');
  await waitFor(() => expect(screen.getByText(/파일 준비됨/)).toBeTruthy());
  expect(api.post).toHaveBeenLastCalledWith('/bi/export-jobs/7/run', { expectedVersion: 3 });
});

it.each([
  ['queued', true, true, false],
  ['running', false, true, false],
  ['ready', false, true, true],
  ['failed', true, true, false],
  ['cancelled', false, false, false],
  ['interrupted', true, false, false],
  ['expired', false, false, false],
] as [ExportJobStatus, boolean, boolean, boolean][])('gates %s actions', async (status, run, cancel, download) => {
  setup();
  api.post.mockImplementationOnce(async (_path, body) => reply(job({ requestId: body.requestId, status })));
  await create();
  expect(button('CSV 만들기').disabled).toBe(!run);
  expect(button('작업 취소').disabled).toBe(!cancel);
  expect(button('고정 파일 받기').disabled).toBe(!download);
  expect(api.post).toHaveBeenCalledTimes(1);
});

it.each([
  [401, '로그인'],
  [403, '권한'],
  [404, '접근'],
  [409, '기준'],
  [410, '만료'],
  [400, '조건'],
] as const)('handles explicit read HTTP %i errors', async (status, message) => {
  setup();
  api.get.mockRejectedValueOnce(failure(status));
  click('이전 작업 읽기');
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
  expect(api.post).not.toHaveBeenCalled();
});

it('downloads authenticated raw UTF8 JSON against the selected fixed revision', async () => {
  const view = setup();
  api.post.mockImplementationOnce(async (_path, body) => reply(job({ requestId: body.requestId, status: 'ready' })));
  await create();
  view.rerender(
    <ExportJobs
      payload={{ ...payload, query: { ...payload.query, sourceRevision: 'new-revision' } }}
      measureVersions={versions}
      disabled={false}
    />,
  );
  api.get.mockResolvedValueOnce(reply(file()));
  click('고정 파일 받기');
  await waitFor(() => expect(blobs).toHaveLength(1));
  expect(api.get).toHaveBeenLastCalledWith('/bi/export-jobs/7/file');
  expect(blobs[0].size).toBe(file().bytes);
  expect(blobs[0].type).toBe('text/csv;charset=utf-8');
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  expect(document.querySelector('a')).toBeNull();
});

it.each([
  ['revision', { sourceRevision: 'new-revision' }],
  ['filename path', { filename: '../export.csv' }],
  ['non ASCII', { filename: '내보내기.csv' }],
  ['extension', { filename: 'export.html' }],
  ['mime', { mimeType: 'text/html' }],
  ['missing CSV', { csv: undefined }],
  ['bytes', { bytes: 1 }],
  ['row limit', { rowCount: 10001 }],
  ['size limit', { csv: 'x'.repeat(2097153), bytes: 2097153 }],
])('rejects invalid fixed files: %s', async (_label, over) => {
  api.get.mockResolvedValueOnce(reply(file(over as Record<string, unknown>)));
  await expect(exportJobsService.file(job({ status: 'ready' }))).rejects.toThrow();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('rejects envelopes and mismatched create receipts while preserving the pending request', async () => {
  setup();
  api.post.mockResolvedValueOnce(reply({ status: 'SUCCESS', data: job() }));
  click('현재 조건으로 작업 접수');
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(button('이전 작업 읽기').disabled).toBe(true);
  api.post.mockResolvedValueOnce(
    reply(job({ sourceId: 4, payload: { ...payload, query: { ...payload.query, sourceId: 4 } } })),
  );
  click('같은 접수 재확인');
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(button('이전 작업 읽기').disabled).toBe(true);
});

it('keeps history accessible with unknown versions while disabling new jobs, independently of immediate CSV collapse', () => {
  const view = render(<ExploreExport payload={payload} disabled={false} />);
  expect(screen.queryByText('파일 작업 펼치기')).toBeNull();
  for (const unknown of [{}, { '1': 0 }]) {
    view.rerender(<ExploreExport payload={payload} disabled={false} measureVersions={unknown} />);
    if (screen.queryByRole('button', { name: '파일 작업 펼치기' })) click('파일 작업 펼치기');
    expect(button('현재 조건으로 작업 접수').disabled).toBe(true);
    expect(button('이전 작업 읽기').disabled).toBe(false);
    click('파일 작업 접기');
  }
  view.rerender(<ExploreExport payload={payload} disabled={false} measureVersions={versions} />);
  click('내보내기 ▾');
  expect(screen.getByRole('button', { name: 'CSV 다운로드' })).toBeTruthy();
  click('파일 작업 펼치기');
  click('내보내기 ▾');
  expect(screen.getByRole('button', { name: '현재 조건으로 작업 접수' })).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it('rejects substituted versions or conditions and accepts canonical object key ordering', async () => {
  const request = { requestId: job().requestId, payload, measureVersions: versions };
  for (const changed of [
    job({ measureVersions: { '1': 9 } }),
    job({ payload: { ...payload, query: { ...payload.query, filters: [] } } }),
  ]) {
    api.post.mockResolvedValueOnce(reply(changed));
    await expect(exportJobsService.create(request)).rejects.toThrow();
  }
  api.post.mockResolvedValueOnce(
    reply(
      job({
        payload: {
          query: { filters: payload.query.filters, measureIds: [1], sourceRevision: 'rev-3', sourceId: 3 },
          mode: 'explore',
        },
      }),
    ),
  );
  await expect(exportJobsService.create(request)).resolves.toMatchObject({ id: 7 });
});

it('preserves an active job when selected measures are cleared and allows history without new creation', async () => {
  const view = render(<ExploreExport payload={payload} measureVersions={versions} disabled={false} />);
  click('파일 작업 펼치기');
  await create();
  view.rerender(
    <ExploreExport payload={{ ...payload, query: { ...payload.query, measureIds: [] } }} measureVersions={{}} disabled />,
  );
  expect(screen.getByText(/작업 #7 ·/)).toBeTruthy();
  expect(button('현재 조건으로 작업 접수').disabled).toBe(true);
  expect(button('이전 작업 읽기').disabled).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('locks double clicks and survives immediate CSV collapse during ambiguous creation', async () => {
  const response = deferred();
  api.post.mockReturnValueOnce(response.promise);
  render(<ExploreExport payload={payload} measureVersions={versions} disabled={false} />);
  click('내보내기 ▾');
  click('파일 작업 펼치기');
  click('현재 조건으로 작업 접수');
  click('내보내기 ▾');
  click('파일 작업 접기');
  click('파일 작업 펼치기');
  fireEvent.click(button('같은 접수 재확인'));
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => response.resolve(reply(job({ requestId: api.post.mock.calls[0][1].requestId }))));
  await waitFor(() => expect(screen.getByText(/작업 #7 ·/)).toBeTruthy());
  expect(button('이전 작업 읽기').disabled).toBe(false);
});

it('preserves the selected fixed job when current metric versions become unknown', async () => {
  const view = render(<ExploreExport payload={payload} measureVersions={versions} disabled={false} />);
  click('파일 작업 펼치기');
  await create();
  view.rerender(<ExploreExport payload={payload} measureVersions={{}} disabled={false} />);
  expect(screen.getByText(/작업 #7 ·/)).toBeTruthy();
  expect(button('현재 조건으로 작업 접수').disabled).toBe(true);
  expect(button('이전 작업 읽기').disabled).toBe(false);
});

it.each([400, 403, 409, 410, 422])(
  'clears a definite creation rejection (%i) so current conditions can create a new request',
  async status => {
    const view = setup();
    api.post.mockRejectedValueOnce(failure(status));
    click('현재 조건으로 작업 접수');
    const rejected = api.post.mock.calls[0][1];
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('button', { name: '같은 접수 재확인' })).toBeNull();
    expect(button('이전 작업 읽기').disabled).toBe(false);
    const currentPayload = { ...payload, query: { ...payload.query, filters: [] } };
    const currentVersions = { '1': 3 };
    view.rerender(<ExportJobs payload={currentPayload} measureVersions={currentVersions} disabled={false} />);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    api.get.mockResolvedValueOnce(reply({ entries: [], nextBeforeId: null }));
    click('이전 작업 읽기');
    await waitFor(() => expect(screen.getByText('조회한 작업이 없습니다.')).toBeTruthy());
    api.post.mockImplementationOnce(async (_path, body) =>
      reply(job({ requestId: body.requestId, payload: currentPayload, measureVersions: currentVersions })),
    );
    await create();
    const fresh = api.post.mock.calls[1][1];
    expect(fresh.requestId).not.toBe(rejected.requestId);
    expect(fresh.payload).toEqual(currentPayload);
    expect(fresh.measureVersions).toEqual(currentVersions);
    expect(api.post).toHaveBeenCalledTimes(2);
  },
);

it.each(['transport', 'malformed', 'mismatch'])(
  'preserves exact pending UUID/body on %s failure across changed inputs',
  async kind => {
    const view = setup();
    if (kind === 'transport') api.post.mockRejectedValueOnce(new Error('response lost'));
    if (kind === 'malformed') api.post.mockResolvedValueOnce(reply({}));
    if (kind === 'mismatch')
      api.post.mockImplementationOnce(async (_path, body) =>
        reply(job({ requestId: body.requestId, measureVersions: { '1': 99 } })),
      );
    click('현재 조건으로 작업 접수');
    const original = JSON.parse(JSON.stringify(api.post.mock.calls[0][1]));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    view.rerender(
      <ExportJobs
        payload={{ ...payload, query: { ...payload.query, filters: [] } }}
        measureVersions={{ '1': 9 }}
        disabled={false}
      />,
    );
    expect(button('이전 작업 읽기').disabled).toBe(true);
    click('같은 접수 재확인');
    await waitFor(() => expect(screen.getByText(/작업 #7 ·/)).toBeTruthy());
    expect(api.post.mock.calls[1][1]).toEqual(original);
    expect(button('이전 작업 읽기').disabled).toBe(false);
  },
);
