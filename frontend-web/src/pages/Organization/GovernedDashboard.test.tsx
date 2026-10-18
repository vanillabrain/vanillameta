import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GovernedDashboard from './GovernedDashboard';
import { validateScopedCsv, validateScopedRows, validateViewCatalog, validateViewResult } from './governanceApi';
const identity = vi.hoisted(() => ({ token: 'a', epoch: 'a' }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => identity.token, STORAGE_ACCESS_TOKEN: 'accessToken' }));
vi.mock('@/helpers/editorDraftStorage', () => ({ editorDraftSessionEpoch: () => identity.epoch }));
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('./ConditionReports', () => ({ default: () => null }));
vi.mock('@/pages/Dashboard/Studio/PublishedDashboard', () => ({
  PublishedBlockView: ({ block }: any) => (
    <p>
      {block.title}: {block.datas[0]?.value}
    </p>
  ),
}));
const revision = 'a'.repeat(64);
const catalog = {
  dashboardId: 11,
  organization: 'Demo',
  title: 'Sales',
  scope: '서버 행·열 정책 적용',
  viewRevision: revision,
  columns: [
    { name: 'day', type: 'DATE' },
    { name: 'revenue', type: 'DOUBLE' },
  ],
  blocks: [{ id: 'sales', title: '허용 매출', kind: 'BOARD_NUMERIC', display: {} }],
  capabilities: { ai: true, export: true, edit: false },
};
const result = (value = 250) => ({
  viewRevision: revision,
  queriedAt: new Date().toISOString(),
  filters: [],
  blocks: [{ ...catalog.blocks[0], valueField: 'value', datas: [{ value }] }],
});
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const mount = (url = '/organizations/1/dashboard/11') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/organizations/:orgId/dashboard/:dashboardId" element={<GovernedDashboard />} />
      </Routes>
    </MemoryRouter>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  identity.token = 'a';
  identity.epoch = 'a';
  api.get.mockResolvedValue(wrap(catalog));
  api.post.mockResolvedValue(wrap(result()));
});
afterEach(cleanup);
it('removes previous numbers on revoked access', async () => {
  mount();
  await screen.findByText('허용 매출: 250');
  api.post.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(screen.getByRole('button', { name: '지표 보기' }));
  await screen.findByText(/권한이 회수/);
  expect(screen.queryByText('허용 매출: 250')).toBeNull();
  expect(screen.queryByLabelText('허용된 분석에 질문')).toBeNull();
});
it('cancels AI, preserves question and ignores late successful response', async () => {
  mount();
  await screen.findByText('허용 매출: 250');
  let resolve: (value: unknown) => void;
  api.post.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  fireEvent.change(screen.getByLabelText('허용된 분석에 질문'), { target: { value: '허용 매출 조회' } });
  fireEvent.click(screen.getByRole('button', { name: '질문으로 조회' }));
  fireEvent.click(await screen.findByRole('button', { name: '취소' }));
  await act(async () => resolve(wrap(result(9000))));
  expect(api.post.mock.calls.at(-1)[2].signal.aborted).toBe(true);
  expect(screen.queryByText('허용 매출: 9000')).toBeNull();
  expect((screen.getByLabelText('허용된 분석에 질문') as HTMLTextAreaElement).value).toBe('허용 매출 조회');
});
it('hides AI and export actions disabled by group policy', async () => {
  api.get.mockResolvedValue(wrap({ ...catalog, capabilities: { ai: false, export: false, edit: false } }));
  mount();
  await screen.findByText('허용 매출: 250');
  expect(screen.queryByRole('button', { name: '질문으로 조회' })).toBeNull();
  expect(screen.queryByRole('button', { name: '집계 CSV 내보내기' })).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('rejects a result for another policy revision', async () => {
  mount();
  await screen.findByText('허용 매출: 250');
  api.post.mockResolvedValueOnce(wrap({ ...result(9000), viewRevision: 'b'.repeat(64) }));
  fireEvent.click(screen.getByRole('button', { name: '지표 보기' }));
  await waitFor(() => expect(screen.queryByText('허용 매출: 250')).toBeNull());
  await screen.findByRole('alert');
  expect(screen.queryByText('허용 매출: 9000')).toBeNull();
});
it('rejects hidden columns, malformed rows, inconsistent CSV and mismatched identity', () => {
  const c = validateViewCatalog(catalog, 11);
  expect(() => validateViewCatalog(catalog, 12)).toThrow();
  expect(() =>
    validateViewResult({ ...result(), blocks: [{ ...result().blocks[0], datas: [{ value: 250, cost: 9 }] }] }, c),
  ).toThrow();
  expect(() => validateScopedRows({ viewRevision: revision, rows: [{ value: { secret: 4 } }] }, c, true)).toThrow();
  expect(() =>
    validateScopedRows({ viewRevision: revision, rows: [{ day: '2026-01-01', revenue: 3, cost: 4 }] }, c),
  ).toThrow();
  expect(() => validateScopedCsv({ viewRevision: revision, csv: 'abc' }, c)).toThrow();
  expect(() => validateScopedCsv({ viewRevision: revision, csv: '매출', bytes: 2 }, c)).toThrow();
  expect(validateScopedCsv({ viewRevision: revision, csv: '매출', bytes: 6 }, c)).toBe('매출');
});

it('rejects the old identity response before the storage event is delivered', async () => {
  mount();
  await screen.findByText('허용 매출: 250');
  let resolve: (v: unknown) => void;
  api.post.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '지표 보기' }));
  identity.token = 'b';
  identity.epoch = 'b';
  await act(async () => resolve(wrap(result(9000))));
  await screen.findByText(/권한이 회수/);
  expect(screen.queryByText('허용 매출: 9000')).toBeNull();
  expect(screen.queryByText('허용 매출: 250')).toBeNull();
});
it('does not download A CSV when login changes before the storage event', async () => {
  mount();
  await screen.findByText('허용 매출: 250');
  let resolve: (v: unknown) => void;
  api.post.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  const original = URL.createObjectURL,
    download = vi.fn();
  URL.createObjectURL = download;
  try {
    fireEvent.click(screen.getByRole('button', { name: '집계 CSV 내보내기' }));
    identity.token = 'b';
    identity.epoch = 'b';
    await act(async () => resolve(wrap({ viewRevision: revision, csv: '250', bytes: 3 })));
    await screen.findByText(/권한이 회수/);
    expect(download).not.toHaveBeenCalled();
  } finally {
    URL.createObjectURL = original;
  }
});

it('applies only allowed embed filter state before its first query and scopes the local theme', async () => {
  mount(
    '/organizations/1/dashboard/11?embed=1&theme=dark&filters=' +
      encodeURIComponent(JSON.stringify([{ column: 'revenue', values: [100] }])),
  );
  await screen.findByText('허용 매출: 250');
  expect(api.post.mock.calls[0][1].filters).toEqual([{ column: 'revenue', values: [100] }]);
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
it('rejects hidden handoff columns before querying any values', async () => {
  mount(
    '/organizations/1/dashboard/11?embed=1&filters=' + encodeURIComponent(JSON.stringify([{ column: 'cost', values: [1] }])),
  );
  await screen.findByRole('alert');
  expect(api.post).not.toHaveBeenCalled();
});
it('rejects URL identity impersonation before reading a catalog', async () => {
  mount('/organizations/1/dashboard/11?embed=1&actorId=2');
  await screen.findByText(/신뢰된 같은 origin/);
  expect(api.get).not.toHaveBeenCalled();
});
it('binds subject as well as generation when an epoch write precedes the new login token', async () => {
  const jwt = (id: number) => 'header.' + btoa(JSON.stringify({ accessKeyData: { id } })) + '.signature';
  identity.epoch = 'new-login';
  identity.token = jwt(1);
  mount();
  await screen.findByText('허용 매출: 250');
  let resolve: (v: unknown) => void;
  api.post.mockReturnValueOnce(
    new Promise(r => {
      resolve = r;
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: '지표 보기' }));
  identity.token = jwt(2);
  await act(async () => resolve(wrap(result(9000))));
  await screen.findByText(/권한이 회수/);
  expect(screen.queryByText('허용 매출: 9000')).toBeNull();
});

it('clears a question when the same JWT refreshes into a different policy scope', async () => {
  mount('/organizations/1/dashboard/11?embed=1');
  await screen.findByText('허용 매출: 250');
  fireEvent.change(screen.getByLabelText('허용된 분석에 질문'), { target: { value: 'A 그룹만의 질문' } });
  const next = 'b'.repeat(64);
  api.get.mockResolvedValueOnce(wrap({ ...catalog, viewRevision: next }));
  api.post.mockResolvedValueOnce(wrap({ ...result(9000), viewRevision: next }));
  fireEvent.click(screen.getByRole('button', { name: '접근·데이터 다시 확인' }));
  await screen.findByText('허용 매출: 9000');
  expect((screen.getByLabelText('허용된 분석에 질문') as HTMLTextAreaElement).value).toBe('');
  expect(api.post.mock.calls.at(-1)[1].viewRevision).toBe(next);
});
