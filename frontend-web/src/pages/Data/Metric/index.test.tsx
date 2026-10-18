import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Metric from './index';
import { metricDeletionDependencyLabels } from '@/api/metricDeletionService';
import { setToken } from '@/helpers/authHelper';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('react-alert', () => ({ useAlert: () => ({ error: api.error, success: api.success }) }));
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: {} }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, args?: any) => (args?.name ? `${key} ${args.name}` : key) }),
}));
vi.mock('@/components/PageTitleBox', () => ({
  default: ({ button, children }: any) => (
    <>
      {button}
      {children}
    </>
  ),
}));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/datagrid', () => ({ default: ({ data }: any) => <div>{JSON.stringify(data)}</div> }));
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const metric = {
  id: 7,
  name: 'Private metric A',
  aggregation: 'SUM',
  expression: 'private_column',
  tableName: 'private_table',
};
const impact = {
  metricId: 7,
  actorId: 19,
  organizationId: null,
  revision: 'a'.repeat(64),
  canDelete: true,
  dependencies: Object.keys(metricDeletionDependencyLabels).map(kind => ({ kind, count: 0 })),
};
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Metric />
    </QueryClientProvider>,
  );
  return { client, ...view };
};
const switchAccount = () =>
  act(() => {
    setToken('account-b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setToken('account-a');
  api.get.mockImplementation(async path =>
    response(path === '/metric' ? [metric] : path === '/database' ? [{ id: 3, name: 'Database A' }] : impact),
  );
  api.post.mockResolvedValue(response({ result: [{ value: 'Private evaluation A' }] }));
  api.del.mockImplementation(async (_path, config) =>
    response({ metricId: 7, requestId: config.data.requestId, receiptId: 4, deleted: true, replayed: false }),
  );
});
afterEach(cleanup);
it('opens impact without deleting and refreshes metrics only after confirmed receipt', async () => {
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: `data.deleteItem ${metric.name}` }));
  await screen.findByRole('dialog', { name: '지표 삭제 영향' });
  await screen.findByText('현재 확인한 사용처가 없습니다. 삭제한 지표는 사용 목록에서 제외됩니다.');
  expect(api.del).not.toHaveBeenCalled();
  const reads = api.get.mock.calls.filter(([path]) => path === '/metric').length;
  fireEvent.click(screen.getByRole('button', { name: '지표 삭제' }));
  await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path === '/metric').length).toBe(reads + 1));
  expect(api.del.mock.calls[0]).toEqual([
    '/metric/7',
    {
      data: {
        requestId: expect.any(String),
        expectedRevision: impact.revision,
        expectedActorId: 19,
        expectedOrganizationId: null,
      },
    },
  ]);
});
it('preserves unknown deletion across closing without list refresh or new impact read', async () => {
  api.del.mockRejectedValue(new Error('lost response'));
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: `data.deleteItem ${metric.name}` }));
  await screen.findByText('현재 확인한 사용처가 없습니다. 삭제한 지표는 사용 목록에서 제외됩니다.');
  fireEvent.click(screen.getByRole('button', { name: '지표 삭제' }));
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const count = api.get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: '닫기', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: `data.deleteItem ${metric.name}` }));
  expect(screen.getByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(count);
  expect(api.del).toHaveBeenCalledTimes(1);
});
it('hides old metrics, evaluation and form on account change and ignores old cache', async () => {
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: `metric.evaluateNamed ${metric.name}` }));
  await screen.findByText(/Private evaluation A/);
  fireEvent.click(screen.getByRole('button', { name: 'metric.add' }));
  fireEvent.change(screen.getByLabelText(/metric.form.name/), { target: { value: 'Private draft A' } });
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  switchAccount();
  expect(screen.queryByText(metric.name)).toBeNull();
  expect(screen.queryByText(/Private evaluation A/)).toBeNull();
  expect(screen.queryByDisplayValue('Private draft A')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  pending.resolve(response([]));
  await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path === '/metric')).toHaveLength(2));
});
it('ignores a late evaluation from the previous account', async () => {
  const pending = deferred();
  api.post.mockReturnValue(pending.promise);
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: `metric.evaluateNamed ${metric.name}` }));
  api.get.mockResolvedValue(response([]));
  switchAccount();
  await act(async () => pending.resolve(response({ result: [{ value: 'Late private result' }] })));
  expect(screen.queryByText(/Late private result/)).toBeNull();
  expect(api.error).not.toHaveBeenCalled();
});
it('rejects old in-flight list results after switching accounts', async () => {
  const pending = deferred();
  api.get.mockImplementation(path => (path === '/metric' ? pending.promise : Promise.resolve(response([]))));
  setup();
  api.get.mockResolvedValue(response([]));
  switchAccount();
  await act(async () => pending.resolve(response([metric])));
  expect(screen.queryByText(metric.name)).toBeNull();
});
it('hides stale metrics after a failed explicit cache refresh', async () => {
  const { client } = setup();
  await screen.findByText(metric.name);
  api.get.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['metrics'] });
  });
  await screen.findByRole('button', { name: '목록 다시 읽기' });
  expect(screen.queryByText(metric.name)).toBeNull();
});
it('does not read or mutate without a token', async () => {
  localStorage.clear();
  setup();
  await act(async () => Promise.resolve());
  expect(api.get).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
  expect((screen.getByRole('button', { name: 'metric.add' }) as HTMLButtonElement).disabled).toBe(true);
});

it('drops unknown deletion on a new login and never exposes the old target to the new account', async () => {
  api.del.mockRejectedValue(new Error('response lost'));
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: `data.deleteItem ${metric.name}` }));
  await screen.findByText('현재 확인한 사용처가 없습니다. 삭제한 지표는 사용 목록에서 제외됩니다.');
  fireEvent.click(screen.getByRole('button', { name: '지표 삭제' }));
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  api.get.mockResolvedValue(response([]));
  switchAccount();
  expect(screen.queryByText(new RegExp(metric.name))).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '같은 요청으로 삭제 결과 확인' })).toBeNull();
  expect(api.del).toHaveBeenCalledTimes(1);
});
it('keeps form state on healthy same-actor refresh without refetch or mutation', async () => {
  const token = (iat: number) =>
    `header.${btoa(JSON.stringify({ accessKeyData: { id: 19, authVersion: 0 }, iat }))}.signature`;
  setToken(token(1));
  setup();
  await screen.findByText(metric.name);
  fireEvent.click(screen.getByRole('button', { name: 'metric.add' }));
  fireEvent.change(screen.getByLabelText(/metric.form.name/), { target: { value: 'Retained draft' } });
  const reads = api.get.mock.calls.length;
  act(() => {
    setToken(token(2), true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.getByDisplayValue('Retained draft')).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(reads);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});
