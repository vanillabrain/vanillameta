import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardView from './index';
import { AuthContext } from '@/contexts/AuthContext';
import { LoadingContext } from '@/contexts/LoadingContext';
import { setToken } from '@/helpers/authHelper';
import { deletionDependencyLabels } from '@/api/dashboardDeletionService';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  del: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, del: api.del, put: api.put, post: api.post }));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: api.error, success: api.success }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/PageTitleBox', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/PageViewBox', () => ({
  default: ({ title, button, children }: any) => (
    <>
      <h1>{title}</h1>
      {button}
      {children}
    </>
  ),
}));
vi.mock('@/widget/wrapper/WidgetWrapper', () => ({ default: () => null }));
vi.mock('@/components/button/ShareButton', () => ({ default: () => null }));
vi.mock('@/api/aiService', () => ({ default: { dashboardInsight: vi.fn() } }));
vi.mock('react-grid-layout', () => ({
  Responsive: ({ children }: any) => <div>{children}</div>,
  WidthProvider: (component: any) => component,
}));
vi.mock('../Components/DashboardAnalysis', () => ({
  default: ({ children }: any) => (
    <>
      <input aria-label="편집기 질문" defaultValue="보존할 질문" />
      {children}
    </>
  ),
}));
const envelope = (data: any) => ({ data: { status: 'SUCCESS', data } });
const deps = () => Object.keys(deletionDependencyLabels).map(kind => ({ kind, count: 0 }));
const impact = (id = 7, over: Record<string, unknown> = {}) =>
  envelope({
    dashboardId: id,
    actorId: 19,
    organizationId: null,
    revision: 'a'.repeat(64),
    canDelete: true,
    dependencies: deps(),
    ...over,
  });
const ready = () => screen.findByText('현재 확인한 사용처 설정이 없습니다. 삭제하면 원본 대시보드를 되돌릴 수 없습니다.');
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const deferred = () => {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const clients: QueryClient[] = [];
function Destination() {
  const location = useLocation();
  return <div>현재 경로 {location.pathname}</div>;
}
function Next() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/dashboard/8')}>다른 대상 이동</button>;
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ userState: { userId: 'actor' } } as any}>
        <LoadingContext.Provider value={{ showLoading: vi.fn(), hideLoading: vi.fn() } as any}>
          <MemoryRouter initialEntries={['/dashboard/7']}>
            <Next />
            <Routes>
              <Route path="/dashboard/:dashboardId" element={<DashboardView />} />
              <Route path="/dashboard" element={<Destination />} />
            </Routes>
          </MemoryRouter>
        </LoadingContext.Provider>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setToken('view-actor-token');
  api.get.mockImplementation(async path =>
    path.endsWith('/delete-impact')
      ? impact(Number(path.split('/')[2]))
      : envelope({
          title: `Local dashboard ${path.split('/')[2]}`,
          widgets: [],
          layout: [],
          updatedAt: '2026-10-18',
          shareYn: 'N',
          endDate: null,
        }),
  );
  api.del.mockImplementation(async (path, config) =>
    envelope({
      dashboardId: Number(path.split('/')[2]),
      requestId: config.data.requestId,
      receiptId: 41,
      deleted: true,
      replayed: false,
    }),
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
});
it('replaces the detail delete alert with shared impact/confirmation and navigates only on a receipt', async () => {
  const client = show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await screen.findByText('Local dashboard 7');
  click('dashboard.delete');
  await ready();
  expect(api.del).not.toHaveBeenCalled();
  expect(invalidate).not.toHaveBeenCalled();
  expect(api.success).not.toHaveBeenCalled();
  click('대시보드 삭제');
  await screen.findByText('현재 경로 /dashboard');
  expect(api.del).toHaveBeenCalledWith('/dashboard/7', {
    data: {
      requestId: expect.any(String),
      expectedRevision: 'a'.repeat(64),
      expectedActorId: 19,
      expectedOrganizationId: null,
    },
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboards'] });
  expect(api.success).toHaveBeenCalledWith('dashboard.deleted');
});
it('keeps editor questions and the route after blocked impact or 409 without auto-refetching the impact', async () => {
  show();
  await screen.findByText('Local dashboard 7');
  fireEvent.change(screen.getByLabelText('편집기 질문'), { target: { value: '미저장 질문 유지' } });
  api.get.mockResolvedValueOnce(
    impact(7, {
      canDelete: false,
      dependencies: deps().map(entry => (entry.kind === 'liveShare' ? { ...entry, count: 1 } : entry)),
    }),
  );
  click('dashboard.delete');
  await screen.findByText(/사용처 설정이 남아 있어 삭제할 수 없습니다/);
  expect((screen.getByRole('button', { name: '대시보드 삭제' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.del).not.toHaveBeenCalled();
  click('사용처 다시 읽기');
  await ready();
  api.del.mockRejectedValueOnce({ response: { status: 409 } });
  click('대시보드 삭제');
  await screen.findByText(/삭제 기준이나 사용처가 변경/);
  expect(api.get.mock.calls.filter(call => call[0].endsWith('/delete-impact'))).toHaveLength(2);
  click('닫기');
  expect((screen.getByLabelText('편집기 질문') as HTMLInputElement).value).toBe('미저장 질문 유지');
  expect(screen.getByText('Local dashboard 7')).toBeTruthy();
  expect(api.success).not.toHaveBeenCalled();
});
it('preserves an unknown request and does not navigate until the same request confirms a replay', async () => {
  show();
  await screen.findByText('Local dashboard 7');
  click('dashboard.delete');
  await ready();
  api.del.mockRejectedValueOnce(new Error('lost receipt'));
  click('대시보드 삭제');
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = api.del.mock.calls[0][1].data;
  expect(screen.queryByText('현재 경로 /dashboard')).toBeNull();
  expect(api.success).not.toHaveBeenCalled();
  api.del.mockResolvedValueOnce(
    envelope({ dashboardId: 7, requestId: original.requestId, receiptId: 41, deleted: true, replayed: true }),
  );
  click('같은 요청으로 삭제 결과 확인');
  await screen.findByText('현재 경로 /dashboard');
  expect(api.del.mock.calls[1][1].data).toEqual(original);
});
it('does not navigate a newly selected dashboard on an older target deletion receipt', async () => {
  const pending = deferred();
  show();
  await screen.findByText('Local dashboard 7');
  click('dashboard.delete');
  await ready();
  api.del.mockReturnValueOnce(pending.promise);
  click('대시보드 삭제');
  const original = api.del.mock.calls[0][1].data;
  fireEvent.click(screen.getByText('다른 대상 이동'));
  await screen.findByText('Local dashboard 8');
  await act(async () =>
    pending.resolve(
      envelope({ dashboardId: 7, requestId: original.requestId, receiptId: 41, deleted: true, replayed: false }),
    ),
  );
  expect(api.success).not.toHaveBeenCalled();
  expect(screen.queryByText('현재 경로 /dashboard')).toBeNull();
  expect(screen.getByText('Local dashboard 8')).toBeTruthy();
  api.del.mockResolvedValueOnce(
    envelope({ dashboardId: 7, requestId: original.requestId, receiptId: 41, deleted: true, replayed: true }),
  );
  click('같은 요청으로 삭제 결과 확인');
  await waitFor(() => expect(api.success).toHaveBeenCalledWith('dashboard.deleted'));
  expect(api.del.mock.calls[1][0]).toBe('/dashboard/7');
  expect(api.del.mock.calls[1][1].data).toEqual(original);
  expect(screen.queryByText('현재 경로 /dashboard')).toBeNull();
  expect(screen.getByText('Local dashboard 8')).toBeTruthy();
});
it('can request owner deletion metadata even when the ordinary source-backed detail read is refused', async () => {
  api.get.mockImplementation(async path => {
    if (path.endsWith('/delete-impact')) return impact();
    throw { response: { status: 403 } };
  });
  show();
  await waitFor(() => expect(api.error).toHaveBeenCalled());
  click('dashboard.delete');
  await ready();
  expect(api.get).toHaveBeenCalledWith('/dashboard/7/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).not.toHaveBeenCalled();
});
