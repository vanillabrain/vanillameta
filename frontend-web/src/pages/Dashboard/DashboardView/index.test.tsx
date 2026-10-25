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
  realAnalysis: false,
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
vi.mock('@/components/button/ShareButton', () => ({ default: () => <button>공유 상태</button> }));
vi.mock('@/api/aiService', () => ({ default: { dashboardInsight: vi.fn() } }));
vi.mock('react-grid-layout', () => ({
  Responsive: ({ children }: any) => <div>{children}</div>,
  WidthProvider: (component: any) => component,
}));
vi.mock('../Components/DashboardAnalysis', async importOriginal => {
  const actual = await importOriginal<typeof import('../Components/DashboardAnalysis')>();
  return {
    default: (props: any) =>
      api.realAnalysis ? (
        <actual.default {...props} />
      ) : (
        <>
          <input aria-label="편집기 질문" defaultValue="보존할 질문" />
          {props.children}
        </>
      ),
  };
});
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
  api.realAnalysis = false;
  localStorage.clear();
  sessionStorage.clear();
  setToken('view-actor-token');
  api.get.mockImplementation(async path =>
    path.endsWith('/delete-impact')
      ? impact(Number(path.split('/')[2]))
      : envelope({
          id: Number(path.split('/')[2]),
          title: `Local dashboard ${path.split('/')[2]}`,
          widgets: [],
          layout: [],
          analysisDefinition: '{}',
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
const permissionMessage = '현재 이 대시보드를 볼 권한이 없습니다. 소유권 또는 접근 권한이 변경되었을 수 있습니다.';
it('keeps a former owner with content and impact403 blocked without stale data, actions or repeated requests', async () => {
  api.get.mockRejectedValue({ response: { status: 403, data: { message: 'private server detail' } } });
  show();
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', permissionMessage);
  expect(api.error).not.toHaveBeenCalled();
  expect(screen.queryByText('private server detail')).toBeNull();
  expect(screen.queryByLabelText('편집기 질문')).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 상태' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'dashboard.delete' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'dashboard.refresh' })).toBeNull();
  expect(screen.queryByRole('combobox', { name: 'dashboard.autoRefresh' })).toBeNull();
  for (const name of ['dashboardModify.edit', '차트·배치 편집', '복제해서 재사용', 'Studio 편집', '게시 버전'])
    expect(screen.queryByRole('link', { name })).toBeNull();
  await act(async () => undefined);
  expect(api.get.mock.calls.filter(([path]) => path === '/dashboard/7')).toHaveLength(1);
  expect(api.get.mock.calls.filter(([path]) => path === '/dashboard/7/delete-impact')).toHaveLength(1);
  expect(screen.queryByRole('button', { name: '삭제 영향 확인' })).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByText('현재 경로 /dashboard')).toBeNull();
});
it('keeps generic loading failures separate from 403 permission denial', async () => {
  api.get.mockRejectedValue({ response: { status: 500 } });
  show();
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('dashboard.loadFailed'));
  expect(screen.queryByText(permissionMessage)).toBeNull();
  expect(screen.getByRole('link', { name: 'Studio 편집' })).toBeTruthy();
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('clears previously loaded private content on 403 and prevents share-state reset from refetching indefinitely', async () => {
  api.get.mockResolvedValueOnce(
    envelope({
      id: 7,
      title: 'Previously private dashboard',
      widgets: [],
      layout: [],
      updatedAt: '2026-10-18',
      shareYn: 'Y',
      endDate: null,
    }),
  );
  api.get.mockRejectedValue({ response: { status: 403 } });
  show();
  await screen.findByText(permissionMessage);
  expect(screen.queryByText('Previously private dashboard')).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 상태' })).toBeNull();
  await act(async () => undefined);
  expect(api.get.mock.calls.filter(([path]) => path === '/dashboard/7')).toHaveLength(2);
  expect(api.get.mock.calls.filter(([path]) => path === '/dashboard/7/delete-impact')).toHaveLength(1);
  expect(api.error).not.toHaveBeenCalled();
});
it('allows explicit navigation to another permitted dashboard after a 403 without redirecting or retrying the denied target', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  show();
  await screen.findByText(permissionMessage);
  fireEvent.click(screen.getByText('다른 대상 이동'));
  await screen.findByText('Local dashboard 8');
  expect(screen.queryByText(permissionMessage)).toBeNull();
  expect(screen.getByRole('link', { name: 'Studio 편집' })).toBeTruthy();
  expect(api.get.mock.calls.filter(([path]) => path === '/dashboard/7')).toHaveLength(1);
  expect(api.error).not.toHaveBeenCalled();
});
it('restores current-owner deletion management via protected impact200 while ordinary source-backed detail is403', async () => {
  api.get.mockImplementation(async path => {
    if (path.endsWith('/delete-impact')) return impact();
    throw { response: { status: 403, data: { message: 'private source details' } } };
  });
  show();
  await screen.findByRole('button', { name: '삭제 영향 확인' });
  expect(screen.getByText(permissionMessage)).toBeTruthy();
  expect(screen.queryByText('private source details')).toBeNull();
  expect(screen.queryByLabelText('편집기 질문')).toBeNull();
  expect(screen.queryByRole('button', { name: '공유 상태' })).toBeNull();
  for (const name of ['dashboardModify.edit', '차트·배치 편집', '복제해서 재사용', 'Studio 편집', '게시 버전'])
    expect(screen.queryByRole('link', { name })).toBeNull();
  expect(api.get.mock.calls.filter(([path]) => path.endsWith('/delete-impact'))).toHaveLength(1);
  expect(api.del).not.toHaveBeenCalled();
  expect(api.error).not.toHaveBeenCalled();
  click('삭제 영향 확인');
  await ready();
  expect(api.get.mock.calls.filter(([path]) => path.endsWith('/delete-impact'))).toHaveLength(2);
  expect(api.get).toHaveBeenCalledWith('/dashboard/7/delete-impact', undefined, { signal: expect.anything() });
  expect(screen.queryByText('Local dashboard 7')).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
  click('대시보드 삭제');
  await screen.findByText('현재 경로 /dashboard');
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(api.del.mock.calls[0][1].data.expectedActorId).toBe(19);
});
it('keeps owner management available when impact200 has blocking dependencies, without granting deletion', async () => {
  const blocked = impact(7, {
    canDelete: false,
    dependencies: deps().map(entry => (entry.kind === 'liveShare' ? { ...entry, count: 1 } : entry)),
  });
  api.get.mockImplementation(async path => {
    if (path.endsWith('/delete-impact')) return blocked;
    throw { response: { status: 403 } };
  });
  show();
  await screen.findByRole('button', { name: '삭제 영향 확인' });
  click('삭제 영향 확인');
  await screen.findByText(/사용처 설정이 남아 있어 삭제할 수 없습니다/);
  expect(screen.getByRole('button', { name: '대시보드 삭제' })).toHaveProperty('disabled', true);
  expect(screen.queryByRole('button', { name: '공유 상태' })).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
});
it('does not restore management for malformed or failed impact responses', async () => {
  api.get.mockImplementation(async path => {
    if (path.endsWith('/delete-impact')) return impact(8);
    throw { response: { status: 403 } };
  });
  show();
  await screen.findByText(permissionMessage);
  await act(async () => undefined);
  expect(screen.queryByRole('button', { name: '삭제 영향 확인' })).toBeNull();
  expect(screen.queryByLabelText('편집기 질문')).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
});
it('ignores a late owner-management proof after the dashboard target changes', async () => {
  const pending = deferred();
  api.get.mockRejectedValueOnce({ response: { status: 403 } }).mockReturnValueOnce(pending.promise);
  show();
  await screen.findByText(permissionMessage);
  fireEvent.click(screen.getByText('다른 대상 이동'));
  await screen.findByText('Local dashboard 8');
  await act(async () => pending.resolve(impact()));
  expect(screen.queryByRole('button', { name: '삭제 영향 확인' })).toBeNull();
  expect(screen.getByText('Local dashboard 8')).toBeTruthy();
  expect(api.del).not.toHaveBeenCalled();
});

const emptyMessage = '아직 추가한 위젯이 없습니다. 편집 화면에서 위젯을 추가해 주세요.';
const emptyDashboard = {
  id: 7,
  title: 'Empty legacy dashboard',
  widgets: [],
  layout: [],
  updatedAt: '2026-10-25',
  shareYn: 'N',
};
const analysisReadError = '저장된 대시보드 정의를 다시 읽지 못했습니다. 화면을 다시 열어 주세요.';
it('shows a successfully loaded empty legacy dashboard without invoking real analysis, preserving edit and deletion actions', async () => {
  api.realAnalysis = true;
  api.get.mockImplementation(async path => {
    if (path === '/dashboard/7') return envelope(emptyDashboard);
    throw { response: { status: 400 } };
  });
  show();
  await screen.findByText(emptyMessage);
  expect(screen.queryByText(analysisReadError)).toBeNull();
  expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard/7']);
  expect(screen.getByRole('link', { name: '위젯 추가하기' }).getAttribute('href')).toBe(
    '/dashboard/modify?id=7&name=Empty%20legacy%20dashboard',
  );
  expect(screen.getByRole('button', { name: 'dashboard.delete' })).toBeTruthy();
});
it.each(['analysisDefinition', 'structuredDefinition', 'pivotDefinitions'])(
  'keeps real analysis400 protected when %s exists even with no widgets/layout',
  async field => {
    api.realAnalysis = true;
    api.get.mockImplementation(async path => {
      if (path === '/dashboard/7') return envelope({ ...emptyDashboard, [field]: '{}' });
      throw { response: { status: 400, data: { code: 'INVALID_STUDIO_SCOPE' } } };
    });
    show();
    await screen.findByText(/저장된 날짜 범위·공통 필터 조건을 확인할 수 없습니다/);
    expect(api.get.mock.calls.some(([path]) => path === '/ai/dashboard-analysis/7')).toBe(true);
    expect(screen.queryByText(emptyMessage)).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  },
);
it('never classifies pending, failed, or a previous target response as an empty dashboard', async () => {
  api.realAnalysis = true;
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise).mockRejectedValue({ response: { status: 500 } });
  show();
  expect(screen.queryByText(emptyMessage)).toBeNull();
  fireEvent.click(screen.getByText('다른 대상 이동'));
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('dashboard.loadFailed'));
  await act(async () => pending.resolve(envelope(emptyDashboard)));
  expect(screen.queryByText(emptyMessage)).toBeNull();
  expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard/7', '/dashboard/8']);
});

it('retains a generic analysis400 error for a saved definition rather than declaring it empty', async () => {
  api.realAnalysis = true;
  api.get.mockImplementation(async path => {
    if (path === '/dashboard/7') return envelope({ ...emptyDashboard, analysisDefinition: '{malformed' });
    throw { response: { status: 400 } };
  });
  show();
  await screen.findByText(analysisReadError);
  expect(screen.queryByText(emptyMessage)).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});
it('clears a loaded empty state immediately on navigation while the new dashboard is still pending', async () => {
  api.realAnalysis = true;
  const pending = deferred();
  api.get.mockResolvedValueOnce(envelope(emptyDashboard)).mockReturnValueOnce(pending.promise);
  show();
  await screen.findByText(emptyMessage);
  fireEvent.click(screen.getByText('다른 대상 이동'));
  expect(screen.queryByText(emptyMessage)).toBeNull();
  await act(async () => pending.resolve(envelope({ ...emptyDashboard, id: 7 })));
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('dashboard.loadFailed'));
  expect(screen.queryByText(emptyMessage)).toBeNull();
  expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard/7', '/dashboard/8']);
});

it('round trips special characters in both empty-dashboard edit links title query parameters', async () => {
  api.realAnalysis = true;
  const title = '매출 & 환불 #비교? 기간/채널';
  api.get.mockResolvedValueOnce(envelope({ ...emptyDashboard, title }));
  show();
  await screen.findByRole('link', { name: '위젯 추가하기' });
  for (const name of ['위젯 추가하기', 'dashboardModify.edit']) {
    const link = screen.getByRole('link', { name });
    const url = new URL(link.getAttribute('href') ?? '', 'https://example.test');
    expect(url.pathname).toBe('/dashboard/modify');
    expect(url.searchParams.get('id')).toBe('7');
    expect(url.searchParams.get('name')).toBe(title);
    expect(Array.from(url.searchParams.keys())).toEqual(['id', 'name']);
    expect(url.hash).toBe('');
  }
  expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard/7']);
});

it('rejects a missing dashboard ID before showing empty state or mounting real analysis', async () => {
  api.realAnalysis = true;
  const withoutId: Partial<typeof emptyDashboard> = { ...emptyDashboard };
  delete withoutId.id;
  api.get.mockResolvedValueOnce(envelope(withoutId));
  show();
  await waitFor(() => expect(api.error).toHaveBeenCalledWith('dashboard.loadFailed'));
  expect(screen.queryByText(emptyMessage)).toBeNull();
  expect(screen.queryByText(analysisReadError)).toBeNull();
  expect(screen.queryByText(emptyDashboard.title)).toBeNull();
  expect(api.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard/7']);
  expect(api.post).not.toHaveBeenCalled();
});
