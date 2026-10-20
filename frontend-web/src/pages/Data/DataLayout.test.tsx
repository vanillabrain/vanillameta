import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DataLayout from './DataLayout';
import { LoadingContext } from '@/contexts/LoadingContext';
import { sourceDeletionDependencyLabels } from '@/api/sourceDeletionService';
import { setToken } from '@/helpers/authHelper';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  postForm: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('react-alert', () => ({ useAlert: () => ({ error: api.error, success: api.success }) }));
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: {} }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, args?: any) => (args?.name ? `${key} ${args.name}` : key) }),
}));
vi.mock('@/components/datagrid', () => ({
  default: ({ data }: any) => <div>{JSON.stringify(data)}</div>,
  DataGridWrapper: ({ children }: any) => <div>{children}</div>,
}));
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const source = { id: 7, name: 'Private source A' };
const other = { id: 8, name: 'Other source' };
const dataset = {
  id: 11,
  databaseId: 7,
  datasetType: 'DATASET',
  title: 'Private dataset A',
  query: 'SELECT private_column',
};
const impact = {
  sourceId: 7,
  actorId: 19,
  organizationId: 3,
  revision: 'a'.repeat(64),
  canDelete: true,
  managedFileCount: 2,
  dependencies: Object.keys(sourceDeletionDependencyLabels).map(kind => ({ kind, count: 0 })),
};
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const setup = (props: any = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <LoadingContext.Provider value={{ loading: false, showLoading: api.show, hideLoading: api.hide }}>
          <DataLayout {...props} />
        </LoadingContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...render(tree) };
};
const changeAccount = () =>
  act(() => {
    setToken('account-b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
const openDelete = async () => {
  await screen.findByText(source.name);
  fireEvent.click(screen.getByRole('button', { name: `data.deleteItem ${source.name}` }));
  await screen.findByText('현재 확인한 사용처가 없습니다. 소스 연결 정보를 영구 삭제하며 파일 정리는 별도로 실행합니다.');
};
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setToken('account-a');
  api.get.mockImplementation(async path =>
    response(
      path === '/database'
        ? [source, other]
        : path === '/database/7'
        ? { datasets: [dataset], tables: [] }
        : path === '/database/8'
        ? { datasets: [], tables: [] }
        : path === '/database/data'
        ? { datas: [{ result: 'Private preview A' }] }
        : impact,
    ),
  );
  api.del.mockImplementation(async (_path, config) =>
    response({
      sourceId: 7,
      requestId: config.data.requestId,
      receiptId: 41,
      deleted: true,
      replayed: false,
      cleanup: { status: 'pending', managedFiles: 2 },
    }),
  );
});
afterEach(cleanup);
it('uses the source card id and refreshes only after confirmed metadata deletion, keeping cleanup explicit', async () => {
  setup();
  await openDelete();
  expect(api.get).toHaveBeenCalledWith('/database/7/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
  api.get.mockImplementation(async path => response(path === '/database' ? [other] : { datasets: [], tables: [] }));
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제' }));
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '파일 정리' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '닫기', exact: true }));
  await waitFor(() => expect(screen.queryByRole('button', { name: `data.selectSource ${source.name}` })).toBeNull());
  expect(api.del).toHaveBeenCalledWith('/database/7', {
    data: {
      requestId: expect.any(String),
      expectedRevision: impact.revision,
      expectedActorId: 19,
      expectedOrganizationId: 3,
    },
  });
  expect(api.post).not.toHaveBeenCalled();
});
it('does not refresh sources or lose frozen intent on unknown delete and collapse', async () => {
  api.del.mockRejectedValueOnce(new Error('response lost'));
  setup();
  await openDelete();
  const count = api.get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제' }));
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  fireEvent.click(screen.getByRole('button', { name: '닫기', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제·파일 정리 기록' }));
  expect(screen.getByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(count);
  expect(api.del).toHaveBeenCalledOnce();
});
it('allows manual pending-history recovery after reload without automatic requests or mutation', async () => {
  setup();
  await screen.findByText(source.name);
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제·파일 정리 기록' }));
  expect(api.get.mock.calls.some(([path]) => path === '/database/deletions')).toBe(false);
  api.get.mockResolvedValueOnce(response({ nextBeforeId: null, actorId: 19, organizationId: 3, entries: [] }));
  fireEvent.click(screen.getByRole('button', { name: '파일 정리 기록 읽기' }));
  await screen.findByText('미완료 파일 정리 기록이 없습니다.');
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('keeps another selected source when deleting a different source', async () => {
  setup();
  await screen.findByText(source.name);
  fireEvent.click(screen.getByRole('button', { name: `data.selectSource ${other.name}` }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/database/8', null));
  await openDelete();
  api.get.mockImplementation(async path => response(path === '/database' ? [other] : { datasets: [], tables: [] }));
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제' }));
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  fireEvent.click(screen.getByRole('button', { name: '닫기', exact: true }));
  expect(screen.getByRole('button', { name: `data.selectSource ${other.name}` }).getAttribute('aria-pressed')).toBe('true');
});
it('hides old source, dataset, preview and pending deletion when the account changes', async () => {
  setup();
  await screen.findByText(dataset.title);
  fireEvent.click(screen.getByRole('button', { name: `data.previewItem ${dataset.title}` }));
  await screen.findByText(/Private preview A/);
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  changeAccount();
  expect(screen.queryByText(source.name)).toBeNull();
  expect(screen.queryByText(dataset.title)).toBeNull();
  expect(screen.queryByText(/Private preview A/)).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  pending.resolve(response([]));
});
it('drops old in-flight source list results after a new login', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  setup();
  api.get.mockResolvedValue(response([]));
  changeAccount();
  await act(async () => pending.resolve(response([source])));
  expect(screen.queryByText(source.name)).toBeNull();
});
it('drops late preview rows and alerts after switching accounts', async () => {
  setup();
  await screen.findByText(dataset.title);
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  fireEvent.click(screen.getByRole('button', { name: `data.previewItem ${dataset.title}` }));
  api.get.mockResolvedValue(response([]));
  changeAccount();
  await act(async () => pending.resolve(response({ datas: [{ value: 'Late secret' }] })));
  expect(screen.queryByText(/Late secret/)).toBeNull();
  expect(api.error).not.toHaveBeenCalled();
});
it('hides stale source cards and previews on list read failure', async () => {
  const { client } = setup();
  await screen.findByText(dataset.title);
  fireEvent.click(screen.getByRole('button', { name: `data.previewItem ${dataset.title}` }));
  await screen.findByText(/Private preview A/);
  api.get.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['databases'] });
  });
  await screen.findByRole('button', { name: '목록 다시 읽기' });
  expect(screen.queryByText(source.name)).toBeNull();
  expect(screen.queryByText(/Private preview A/)).toBeNull();
  expect(screen.queryByText(dataset.title)).toBeNull();
});
it('preserves view-mode dataset selection without deletion controls', async () => {
  const selected = vi.fn();
  setup({ isViewMode: true, setDataSet: selected });
  await screen.findByText(dataset.title);
  fireEvent.click(screen.getByRole('button', { name: `data.selectItem ${dataset.title}` }));
  expect(selected).toHaveBeenCalledWith(dataset);
  expect(screen.queryByRole('button', { name: `data.deleteItem ${source.name}` })).toBeNull();
  expect(screen.queryByRole('button', { name: '소스 삭제·파일 정리 기록' })).toBeNull();
});
it('does not clear unrelated editor draft storage when deletion confirms', async () => {
  sessionStorage.setItem('existing-sql-editor-draft', 'SELECT kept');
  setup();
  await openDelete();
  fireEvent.click(screen.getByRole('button', { name: '소스 삭제' }));
  await screen.findByText('소스 #7 연결 정보 삭제 확정 · 영수증 #41');
  expect(sessionStorage.getItem('existing-sql-editor-draft')).toBe('SELECT kept');
});
it('does not fetch sources or delete without authentication', async () => {
  localStorage.clear();
  setup();
  await act(async () => Promise.resolve());
  expect(api.get).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: '소스 삭제·파일 정리 기록' }) as HTMLButtonElement).disabled).toBe(true);
});
it('recovers from a failed source detail read when another source is selected', async () => {
  api.get.mockImplementation(async path => {
    if (path === '/database') return response([source, other]);
    if (path === '/database/7') throw new Error('corrupt config');
    return response({ datasets: [{ ...dataset, databaseId: 8, title: 'Healthy dataset' }], tables: [] });
  });
  setup();
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('common.dbFetchFailed'));
  fireEvent.click(screen.getByRole('button', { name: `data.selectSource ${other.name}` }));
  await screen.findByText('Healthy dataset');
});
it.each(['semantic', 'transport'])('clears preview rows on authenticated %s failure', async kind => {
  setup();
  await screen.findByText(dataset.title);
  if (kind === 'semantic') api.get.mockResolvedValueOnce({ data: { status: 'ERROR', message: 'Preview rejected' } });
  else api.get.mockRejectedValueOnce(new Error('Preview rejected'));
  fireEvent.click(screen.getByRole('button', { name: `data.previewItem ${dataset.title}` }));
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('common.dbFetchFailed'));
  expect(screen.queryByText(/Private preview A/)).toBeNull();
  expect(api.hide).toHaveBeenCalled();
});
it('does not alert on an intentionally cancelled source detail request', async () => {
  api.get.mockImplementation(async path => {
    if (path === '/database') return response([source]);
    throw Object.assign(new Error('cancelled'), { code: 'ERR_CANCELED' });
  });
  setup();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/database/7', null));
  await act(async () => Promise.resolve());
  expect(api.error).not.toHaveBeenCalled();
});
