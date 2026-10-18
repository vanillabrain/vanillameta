import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, expect, it, afterEach, beforeEach } from 'vitest';
import { LoadingProvider } from '@/contexts/LoadingContext';
import Dashboard from './index';
import { deletionDependencyLabels } from '@/api/dashboardDeletionService';
import { fetchPersonalLibrary, savePersonalLibrary, personalLibrarySessionScope } from '@/api/personalLibraryService';
import { editorDraftSessionEpoch } from '@/helpers/editorDraftStorage';
import { setToken } from '@/helpers/authHelper';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  post: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, put: api.put, del: api.del, post: api.post }));
vi.mock('@/contexts/AlertContext', () => ({ SnackbarContext: {} }));
vi.mock('@/components/loading', () => ({
  Loading: ({ in: loading }: any) => (loading ? <div role="progressbar" /> : null),
}));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: api.error, success: api.success }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/PageTitleBox', () => ({
  default: ({ button, children }: any) => (
    <>
      {button}
      {children}
    </>
  ),
}));
vi.mock('@/components/button/AddIconButton', () => ({
  MenuButton: ({ menuList, handleSelect }: any) =>
    menuList.map((item: any) => (
      <button key={item.id} onClick={() => handleSelect(item)}>
        {item.name}
      </button>
    )),
}));
vi.mock('@/seo/Seo', () => ({ default: () => null }));
vi.mock('./Components/GettingStarted', () => ({ default: () => null }));
vi.mock('./Components/AiDashboardPanel', () => ({
  default: ({ onSaved, open, initialDatabaseId }: any) => (
    <>
      {open && <div role="status">기존 소스 {initialDatabaseId} 편집</div>}
      <button onClick={() => onSaved(31, { publication: true })}>저장 후 게시 준비</button>
    </>
  ),
}));
const SESSION_A = '00000000-0000-4000-8000-000000000001';
const SESSION_B = '00000000-0000-4000-8000-000000000002';
const AUTH_META = 'vm:editor-draft-auth:v1';
const actorToken = (id: unknown, authVersion: unknown = 0, iat = 1, signature = 'signature') => {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ accessKeyData: { id, authVersion }, iat })}.${signature}`;
};
const TOKEN_A = actorToken(7);
const TOKEN_B = actorToken(22);
const changeLogin = () => {
  setToken(TOKEN_B);
  localStorage.setItem(AUTH_META, JSON.stringify({ epoch: SESSION_B }));
};
const alpha = {
  id: 45,
  title: 'Alpha analysis',
  updatedAt: '2026-10-18',
  analysisDefinition: '{}',
  library: { archived: false, version: 2 },
};
const beta = { id: 28, title: 'Beta dashboard', updatedAt: '2026-10-17', library: { archived: false, version: 0 } };
const saved = { ...alpha, id: 9, title: 'Archived analysis', library: { archived: true, version: 4 } };
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const library = (
  view = 'active',
  entries = view === 'active' ? [alpha, beta] : [saved],
  organizationId: number | null = 7,
  canArchive = true,
  actorId = 7,
) => response({ entries, view, organizationId, canArchive, actorId });
const receipt = (over: Record<string, unknown> = {}) =>
  response({ dashboardId: 45, organizationId: 7, archived: true, version: 3, ...over });
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(res => {
    resolve = res;
  });
  return { promise, resolve };
};
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
function Destination() {
  const location = useLocation();
  return <div>이동 완료 {location.pathname + location.search}</div>;
}
const clients: QueryClient[] = [];
function show(path = '/dashboard', strict = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  const tree = (
    <QueryClientProvider client={client}>
      <LoadingProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </LoadingProvider>
    </QueryClientProvider>
  );
  const view = render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
  return { ...view, client };
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setToken(TOKEN_A);
  localStorage.setItem(AUTH_META, JSON.stringify({ epoch: SESSION_A }));
  api.get.mockImplementation(async (path, params) => {
    if (path === '/dashboard/28/delete-impact')
      return response({
        dashboardId: 28,
        actorId: 7,
        organizationId: 7,
        revision: 'a'.repeat(64),
        canDelete: true,
        dependencies: Object.keys(deletionDependencyLabels).map(kind => ({ kind, count: 0 })),
      });
    if (path !== '/dashboard/library') throw new Error('unexpected legacy list request');
    return library(params.view);
  });
  api.put.mockResolvedValue(receipt());
  api.del.mockImplementation(async (_path, config) =>
    response({ dashboardId: 28, requestId: config.data.requestId, receiptId: 1, deleted: true, replayed: false }),
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
});

it.each([
  ['AI 대시보드 만들기', '/studio/new'],
  ['nav.dashboard', '/dashboard/create?createType=dashboard'],
  ['list.recommend', '/dashboard/create?createType=recommend'],
])('routes the %s menu to its intended workflow', async (name, destination) => {
  show();
  click(name);
  expect(await screen.findByText('이동 완료 ' + destination)).toBeTruthy();
});
it('preserves the existing source-specific AI panel link', () => {
  show('/dashboard?aiSourceId=32');
  expect(screen.getByText('기존 소스 32 편집')).toBeTruthy();
});
it('releases the loading overlay on a save handoff and preserves broad dashboard invalidation', async () => {
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  const { client } = show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  expect(screen.getByRole('progressbar')).toBeTruthy();
  click('저장 후 게시 준비');
  expect(await screen.findByText('이동 완료 /dashboard/31/publication')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboards'] });
  await act(async () => pending.resolve(library()));
});
it('preserves title, Studio, rename and delete actions in the new authorized list', async () => {
  show();
  await screen.findByText('Alpha analysis');
  expect(screen.getByRole('link', { name: 'Alpha analysis · Studio 열기' }).getAttribute('href')).toBe(
    '/dashboard/45/studio',
  );
  expect(screen.getByText('Beta dashboard').closest('a')?.getAttribute('href')).toBe('/dashboard/28');
  expect(screen.queryByRole('link', { name: 'Beta dashboard · Studio 열기' })).toBeNull();
  click('Beta dashboard · 삭제');
  await screen.findByText('현재 확인한 사용처 설정이 없습니다. 삭제하면 원본 대시보드를 되돌릴 수 없습니다.');
  expect(api.del).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  click('Beta dashboard · 수정');
  expect(await screen.findByText(/이동 완료 \/dashboard\/modify/)).toBeTruthy();
  expect(
    api.get.mock.calls.every(call => call[0] === '/dashboard/library' || call[0] === '/dashboard/28/delete-impact'),
  ).toBe(true);
});
it('defaults to active, archives with the confirmed organization/version, and restores from the archive', async () => {
  show();
  await screen.findByText('Alpha analysis');
  expect(api.get).toHaveBeenCalledWith('/dashboard/library', { view: 'active' }, { signal: expect.anything() });
  click('Alpha analysis · 보관');
  await waitFor(() => expect(screen.queryByText('Alpha analysis')).toBeNull());
  expect(api.put).toHaveBeenCalledWith('/dashboard/45/library', {
    archived: true,
    expectedVersion: 2,
    expectedOrganizationId: 7,
    expectedActorId: 7,
  });
  expect(api.del).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  click('보관함');
  await screen.findByText('Archived analysis');
  api.put.mockResolvedValueOnce(receipt({ dashboardId: 9, archived: false, version: 5 }));
  click('Archived analysis · 복원');
  await waitFor(() => expect(screen.queryByText('Archived analysis')).toBeNull());
  expect(api.put).toHaveBeenLastCalledWith('/dashboard/9/library', {
    archived: false,
    expectedVersion: 4,
    expectedOrganizationId: 7,
    expectedActorId: 7,
  });
  expect(button('기본 목록')).toBeTruthy();
});
it('keeps legacy no-organization accounts readable without archive controls', async () => {
  api.get.mockImplementation(async (_path, params) =>
    library(params.view, params.view === 'active' ? [alpha, beta] : [], null, false),
  );
  show();
  await screen.findByText('Alpha analysis');
  expect(screen.queryByRole('button', { name: / · 보관$/ })).toBeNull();
  expect(screen.getByRole('link', { name: 'Alpha analysis · Studio 열기' })).toBeTruthy();
  click('보관함');
  await screen.findByText(/조건에 맞는 산출물이 없습니다/);
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(api.put).not.toHaveBeenCalled();
});
it.each(['unknown', '409'])('keeps filters and locks repeat writes after %s until explicit fresh state read', async kind => {
  show();
  await screen.findByText('Alpha analysis');
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'Alpha' } });
  fireEvent.change(screen.getByLabelText('산출물 유형'), { target: { value: 'analysis' } });
  fireEvent.change(screen.getByLabelText('산출물 정렬'), { target: { value: 'title' } });
  api.put.mockRejectedValueOnce(kind === '409' ? { response: { status: 409 } } : new Error('lost write reply'));
  click('Alpha analysis · 보관');
  await screen.findByRole('alert');
  expect((screen.getByLabelText('산출물 제목 검색') as HTMLInputElement).value).toBe('Alpha');
  expect((screen.getByLabelText('산출물 유형') as HTMLSelectElement).value).toBe('analysis');
  expect((screen.getByLabelText('산출물 정렬') as HTMLSelectElement).value).toBe('title');
  expect(button('Alpha analysis · 보관').disabled).toBe(true);
  click('Alpha analysis · 보관');
  expect(api.put).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(library('active', [{ ...alpha, library: { archived: false, version: 8 } }]));
  click('목록 다시 읽기');
  await waitFor(() => expect(button('Alpha analysis · 보관').disabled).toBe(false));
  api.put.mockResolvedValueOnce(receipt({ version: 9 }));
  click('Alpha analysis · 보관');
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
  expect(api.put).toHaveBeenLastCalledWith('/dashboard/45/library', {
    archived: true,
    expectedVersion: 8,
    expectedOrganizationId: 7,
    expectedActorId: 7,
  });
});
it('hides stale lists after a failed read while preserving search and recovering explicitly', async () => {
  show();
  await screen.findByText('Alpha analysis');
  fireEvent.change(screen.getByLabelText('산출물 제목 검색'), { target: { value: 'Alpha' } });
  api.get.mockRejectedValueOnce(new Error('offline'));
  click('목록 다시 읽기');
  await screen.findByRole('alert');
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect((screen.getByLabelText('산출물 제목 검색') as HTMLInputElement).value).toBe('Alpha');
  click('목록 다시 읽기');
  await screen.findByText('Alpha analysis');
  expect(api.put).not.toHaveBeenCalled();
});
it('drops a late active list after selecting the archived view', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  show();
  click('보관함');
  await screen.findByText('Archived analysis');
  await act(async () => pending.resolve(library()));
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(screen.getByText('Archived analysis')).toBeTruthy();
});
it('isolates account caches using stable login generation and ignores normal token renewal', async () => {
  const { client } = show();
  await screen.findByText('Alpha analysis');
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(api.get).toHaveBeenCalledTimes(1);
  const oldScope = personalLibrarySessionScope();
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  act(() => {
    changeLogin();
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  await act(async () => pending.resolve(library('active', [{ ...beta, title: 'New account' }], 22, true, 22)));
  expect(await screen.findByText('New account')).toBeTruthy();
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(
    client
      .getQueryCache()
      .getAll()
      .map(query => query.queryKey),
  ).toContainEqual(['dashboards', 'library', personalLibrarySessionScope(), 'active']);
  expect(client.getQueryData(['dashboards', 'library', oldScope, 'active'])).toBeTruthy();
});
it('ignores old account read and write responses after a login generation change', async () => {
  const pending = deferred();
  show();
  await screen.findByText('Alpha analysis');
  api.put.mockReturnValueOnce(pending.promise);
  click('Alpha analysis · 보관');
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'Other account' }], 22, true, 22));
  act(() => {
    changeLogin();
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('Other account');
  await act(async () => pending.resolve(receipt()));
  expect(screen.getByText('Other account')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(button('Other account · 보관').disabled).toBe(false);
});
it('fences an older write when a refreshed list establishes a different organization', async () => {
  const pending = deferred();
  const { client } = show();
  await screen.findByText('Alpha analysis');
  api.put.mockReturnValueOnce(pending.promise);
  click('Alpha analysis · 보관');
  expect(api.put).toHaveBeenCalledWith('/dashboard/45/library', {
    archived: true,
    expectedVersion: 2,
    expectedOrganizationId: 7,
    expectedActorId: 7,
  });
  api.get.mockResolvedValueOnce(library('active', [{ ...alpha, title: 'Current organization' }], 22));
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['dashboards'] });
  });
  await screen.findByText('Current organization');
  await act(async () => pending.resolve(receipt()));
  expect(screen.getByText('Current organization')).toBeTruthy();
  expect(button('Current organization · 보관').disabled).toBe(true);
  api.get.mockResolvedValueOnce(library('active', [{ ...alpha, title: 'Current organization' }], 22));
  click('목록 다시 읽기');
  await waitFor(() => expect(button('Current organization · 보관').disabled).toBe(false));
});
it.each([{ version: 2 }, { version: 1 }, { organizationId: 22 }, { dashboardId: 28 }, { archived: false }])(
  'rejects an inconsistent archive receipt: %j',
  async over => {
    api.put.mockResolvedValueOnce(receipt(over));
    await expect(savePersonalLibrary(alpha, 7, 7)).rejects.toThrow();
  },
);
it('rejects missing organization before any write and malformed/envelope-mismatched lists', async () => {
  await expect(savePersonalLibrary(alpha, null as any, 7)).rejects.toThrow();
  expect(api.put).not.toHaveBeenCalled();
  for (const data of [
    { data: { status: 'SUCCESS', data: { entries: [alpha], view: 'active', organizationId: null, canArchive: true } } },
    library('active', [alpha], 7, false),
    library('archived', [saved], null, false),
    library('active', [{ ...alpha, library: { archived: false, version: -1 } }]),
    library('archived'),
    { data: { entries: [alpha] } },
  ]) {
    api.get.mockResolvedValueOnce(data);
    await expect(fetchPersonalLibrary('active')).rejects.toThrow();
  }
});

it('reports pending archive state, blocks double writes and does not pretend an equal-version receipt succeeded', async () => {
  const pending = deferred();
  show();
  await screen.findByText('Alpha analysis');
  api.put.mockReturnValueOnce(pending.promise);
  click('Alpha analysis · 보관');
  expect(screen.getByText('보관·복원 처리 중…')).toBeTruthy();
  expect(button('보관함').disabled).toBe(true);
  expect(button('Alpha analysis · 보관').disabled).toBe(true);
  click('Alpha analysis · 보관');
  expect(api.put).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(receipt({ version: 2 })));
  await screen.findByRole('alert');
  expect(screen.getByText('Alpha analysis')).toBeTruthy();
  expect(button('Alpha analysis · 보관').disabled).toBe(true);
  expect(screen.queryByText('보관·복원 처리 중…')).toBeNull();
  expect(api.put).toHaveBeenCalledTimes(1);
});

it('ignores an older account list arriving after the new account list', async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  show();
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'New login list' }], 22, true, 22));
  act(() => {
    changeLogin();
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('New login list');
  await act(async () => pending.resolve(library()));
  expect(screen.getByText('New login list')).toBeTruthy();
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(api.put).not.toHaveBeenCalled();
});

it('keeps unknown writes blocked when explicit reload fails, then uses the new confirmed organization', async () => {
  show();
  await screen.findByText('Alpha analysis');
  api.put.mockRejectedValueOnce({ response: { status: 409 } });
  click('Alpha analysis · 보관');
  await screen.findByRole('alert');
  api.get.mockRejectedValueOnce(new Error('offline'));
  click('목록 다시 읽기');
  await screen.findByText('목록을 확인하지 못했습니다. 목록을 다시 읽어 주세요.');
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(api.put).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValueOnce(library('active', [{ ...alpha, library: { archived: false, version: 0 } }], 22));
  click('목록 다시 읽기');
  await waitFor(() => expect(button('Alpha analysis · 보관').disabled).toBe(false));
  api.put.mockResolvedValueOnce(receipt({ organizationId: 22, version: 1 }));
  click('Alpha analysis · 보관');
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2));
  expect(api.put).toHaveBeenLastCalledWith('/dashboard/45/library', {
    archived: true,
    expectedVersion: 0,
    expectedOrganizationId: 22,
    expectedActorId: 7,
  });
});

it('rejects nonempty legacy archives and inconsistent legacy organization scope', async () => {
  api.get.mockResolvedValueOnce(library('archived', [saved], null, false));
  await expect(fetchPersonalLibrary('archived')).rejects.toThrow();
  api.get.mockResolvedValueOnce(library('active', [alpha], 7, false));
  await expect(fetchPersonalLibrary('active')).rejects.toThrow();
  api.get.mockResolvedValueOnce(library('archived', [], null, false));
  await expect(fetchPersonalLibrary('archived')).resolves.toMatchObject({
    entries: [],
    organizationId: null,
    canArchive: false,
  });
});

it('reads the library with a valid token despite malformed optional auth metadata, using real session helpers', async () => {
  localStorage.setItem(AUTH_META, '{broken-json');
  expect(editorDraftSessionEpoch()).toBeNull();
  const { client } = show();
  await screen.findByText('Alpha analysis');
  expect(api.get).toHaveBeenCalledWith('/dashboard/library', { view: 'active' }, { signal: expect.anything() });
  expect(screen.queryByRole('alert')).toBeNull();
  const session = personalLibrarySessionScope();
  expect(session).toMatch(/^ephemeral:[0-9a-f-]{36}$/);
  expect(
    client
      .getQueryCache()
      .getAll()
      .map(query => query.queryKey),
  ).toContainEqual(['dashboards', 'library', session, 'active']);
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map(query => query.queryKey),
    ),
  ).not.toContain(TOKEN_A);
  expect(personalLibrarySessionScope()).toBe(session);
});

it('keeps a healthy real login generation stable through normal refresh and disables reads without a token', async () => {
  const session = personalLibrarySessionScope();
  setToken(actorToken(7, 0, 2, 'new-signature'), true);
  expect(editorDraftSessionEpoch()).toBe(SESSION_A);
  expect(personalLibrarySessionScope()).toBe(session);
  localStorage.removeItem('accessToken');
  expect(personalLibrarySessionScope()).toBeNull();
  show();
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByText('Alpha analysis')).toBeNull();
});

it('rotates fallback scopes on token changes and fences late old-account reads without exposing tokens', async () => {
  localStorage.setItem(AUTH_META, '{broken-json');
  const oldScope = personalLibrarySessionScope();
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  const { client } = show();
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'Fallback account B' }], 22, true, 22));
  act(() => {
    localStorage.setItem('accessToken', JSON.stringify('account-B-token'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('Fallback account B');
  const newScope = personalLibrarySessionScope();
  expect(newScope).not.toBe(oldScope);
  await act(async () => pending.resolve(library()));
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(screen.getByText('Fallback account B')).toBeTruthy();
  const keys = JSON.stringify(
    client
      .getQueryCache()
      .getAll()
      .map(query => query.queryKey),
  );
  expect(keys).not.toContain(TOKEN_A);
  expect(keys).not.toContain('account-B-token');
  setToken(TOKEN_B); // A new login, even with identical token text, rotates the healthy generation.
  expect(personalLibrarySessionScope()).not.toBe(newScope);
});

it('fences late fallback writes after a different token becomes current', async () => {
  localStorage.setItem(AUTH_META, '{broken-json');
  show();
  await screen.findByText('Alpha analysis');
  const pending = deferred();
  api.put.mockReturnValueOnce(pending.promise);
  click('Alpha analysis · 보관');
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'Fallback current account' }], 22, true, 22));
  act(() => {
    localStorage.setItem('accessToken', JSON.stringify('account-B-token'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('Fallback current account');
  await act(async () => pending.resolve(receipt()));
  expect(screen.getByText('Fallback current account')).toBeTruthy();
  expect(button('Fallback current account · 보관').disabled).toBe(false);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('keeps one scope and one mutation callback in StrictMode with malformed optional metadata', async () => {
  localStorage.setItem(AUTH_META, '{broken-json');
  show('/dashboard', true);
  await screen.findByText('Alpha analysis');
  const session = personalLibrarySessionScope();
  const reads = api.get.mock.calls.length;
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'StrictMode next login' }], 22, true, 22));
  act(() => {
    localStorage.setItem('accessToken', JSON.stringify('account-B-token'));
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('StrictMode next login');
  expect(api.get).toHaveBeenCalledTimes(reads + 1);
  expect(personalLibrarySessionScope()).not.toBe(session);
  const pending = deferred();
  api.put.mockReturnValueOnce(pending.promise);
  click('StrictMode next login · 보관');
  click('StrictMode next login · 보관');
  expect(api.put).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(receipt({ dashboardId: 28, organizationId: 22, version: 1 })));
  await waitFor(() => expect(screen.queryByText('StrictMode next login')).toBeNull());
  expect(api.put).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('separates the healthy new-epoch/old-actor ordering gap from the same-epoch/new-actor token', () => {
  const original = personalLibrarySessionScope();
  localStorage.setItem(AUTH_META, JSON.stringify({ epoch: SESSION_B })); // setToken metadata phase, before token replacement.
  const inBetween = personalLibrarySessionScope();
  expect(inBetween).not.toBe(original);
  setToken(TOKEN_B, true); // Complete the token replacement without rotating the already-published epoch.
  expect(editorDraftSessionEpoch()).toBe(SESSION_B);
  const newActor = personalLibrarySessionScope();
  expect(newActor).not.toBe(inBetween);
  setToken(actorToken(22, 0, 2, 'refreshed-signature'), true);
  expect(personalLibrarySessionScope()).toBe(newActor);
  setToken(actorToken(22, 1, 3), true);
  expect(personalLibrarySessionScope()).not.toBe(newActor);
});

it('rejects late old-actor library data when token replacement completes under the same healthy epoch', async () => {
  localStorage.setItem(AUTH_META, JSON.stringify({ epoch: SESSION_B }));
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  const { client } = show(); // Reads as old actor while new login metadata is already present.
  const oldScope = personalLibrarySessionScope();
  api.get.mockResolvedValueOnce(library('active', [{ ...beta, title: 'Healthy current actor' }], 22, true, 22));
  act(() => {
    setToken(TOKEN_B, true);
    window.dispatchEvent(new StorageEvent('storage', { key: 'accessToken' }));
  });
  await screen.findByText('Healthy current actor');
  expect(personalLibrarySessionScope()).not.toBe(oldScope);
  await act(async () => pending.resolve(library()));
  expect(screen.queryByText('Alpha analysis')).toBeNull();
  expect(screen.getByText('Healthy current actor')).toBeTruthy();
  expect(
    JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map(query => query.queryKey),
    ),
  ).not.toContain(TOKEN_A);
});

it('uses an opaque token-bound scope for undecodable healthy tokens and still rotates on a new epoch', () => {
  setToken('unreadable-A', true);
  const first = personalLibrarySessionScope();
  expect(personalLibrarySessionScope()).toBe(first);
  setToken('unreadable-B', true);
  const second = personalLibrarySessionScope();
  expect(second).not.toBe(first);
  expect(second).not.toContain('unreadable');
  localStorage.setItem(AUTH_META, JSON.stringify({ epoch: SESSION_B }));
  expect(personalLibrarySessionScope()).not.toBe(second);
});

it.each([
  ['7', 0],
  [0, 0],
  [7, '0'],
  [7, -1],
  [7, 0.5],
  [7, null],
])('keeps unsafe actor fields token-isolated (%j, %j)', (id, authVersion) => {
  setToken(actorToken(id, authVersion, 1), true);
  const first = personalLibrarySessionScope();
  setToken(actorToken(id, authVersion, 2), true);
  expect(personalLibrarySessionScope()).not.toBe(first);
});

it.each([undefined, null, 0, -1, 1.5, '7'])(
  'rejects a missing or invalid server-confirmed actor %j before exposing list actions or sending a write',
  async actorId => {
    const data = { entries: [alpha], view: 'active', organizationId: 7, canArchive: true, actorId };
    api.get.mockResolvedValue(response(data));
    await expect(fetchPersonalLibrary('active')).rejects.toThrow();
    show();
    await screen.findByText('목록을 확인하지 못했습니다. 목록을 다시 읽어 주세요.');
    expect(screen.queryByText('Alpha analysis')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Alpha analysis · 보관' })).toBeNull();
    await expect(savePersonalLibrary(alpha, 7, actorId as any)).rejects.toThrow();
    expect(api.put).not.toHaveBeenCalled();
  },
);

it('sends the server-confirmed actor rather than the decoded JWT claim with the original version and organization', async () => {
  api.get.mockResolvedValueOnce(library('active', [beta], 7, true, 99));
  show();
  await screen.findByText('Beta dashboard');
  api.put.mockResolvedValueOnce(receipt({ dashboardId: 28, version: 1 }));
  click('Beta dashboard · 보관');
  await waitFor(() => expect(screen.queryByText('Beta dashboard')).toBeNull());
  expect(api.put).toHaveBeenCalledWith('/dashboard/28/library', {
    archived: true,
    expectedVersion: 0,
    expectedOrganizationId: 7,
    expectedActorId: 99,
  });
});

it('pins the confirmed actor in the body even if the interceptor would receive a switched token before transmission', async () => {
  show();
  await screen.findByText('Beta dashboard');
  api.put.mockImplementationOnce(async () => {
    // The call body already exists; emulate the identity change before Axios sends it.
    setToken(TOKEN_B, true);
    throw { response: { status: 409 } };
  });
  click('Beta dashboard · 보관');
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  expect(api.put).toHaveBeenCalledWith('/dashboard/28/library', {
    archived: true,
    expectedVersion: 0,
    expectedOrganizationId: 7,
    expectedActorId: 7,
  });
  expect(api.post).not.toHaveBeenCalled();
});

it('refreshes the library only after a shared dialog confirms a deletion receipt', async () => {
  const { client } = show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await screen.findByText('Beta dashboard');
  click('Beta dashboard · 삭제');
  await screen.findByText('현재 확인한 사용처 설정이 없습니다. 삭제하면 원본 대시보드를 되돌릴 수 없습니다.');
  expect(invalidate).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '대시보드 삭제' }));
  await waitFor(() => expect(api.success).toHaveBeenCalledWith('dashboard.deleted'));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboards'] });
  expect(api.del).toHaveBeenCalledWith('/dashboard/28', {
    data: {
      requestId: expect.any(String),
      expectedRevision: 'a'.repeat(64),
      expectedActorId: 7,
      expectedOrganizationId: 7,
    },
  });
});

it('keeps the always-mounted dialog frozen across unknown-close and another card selection, then frees the new target after explicit replay confirmation', async () => {
  const { client } = show();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  await screen.findByText('Beta dashboard');
  click('Beta dashboard · 삭제');
  await screen.findByText('현재 확인한 사용처 설정이 없습니다. 삭제하면 원본 대시보드를 되돌릴 수 없습니다.');
  api.del.mockRejectedValueOnce(new Error('committed but receipt lost'));
  fireEvent.click(screen.getByRole('button', { name: '대시보드 삭제' }));
  await screen.findByText(/삭제 결과를 확인하지 못했습니다/);
  const original = { ...api.del.mock.calls[0][1].data };
  const impactReads = api.get.mock.calls.filter(call => call[0].endsWith('/delete-impact')).length;
  api.get.mockImplementation(async (path, params) => {
    if (path.endsWith('/delete-impact')) throw { response: { status: 403 } };
    return library(params.view);
  });
  fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  click('Alpha analysis · 삭제');
  expect(screen.getByRole('dialog', { name: '대시보드 삭제 영향' })).toBeTruthy();
  expect(screen.getByText(/원래 대상의 미확정 요청을 보존했습니다/)).toBeTruthy();
  expect(screen.getByText(/Beta dashboard · 사용처 설정을 먼저 확인합니다/)).toBeTruthy();
  expect((screen.getByRole('button', { name: '같은 요청으로 삭제 결과 확인' }) as HTMLButtonElement).disabled).toBe(false);
  expect(api.get.mock.calls.filter(call => call[0].endsWith('/delete-impact'))).toHaveLength(impactReads);
  expect(api.del).toHaveBeenCalledTimes(1);
  expect(invalidate).not.toHaveBeenCalled();
  api.del.mockResolvedValueOnce(
    response({ dashboardId: 28, requestId: original.requestId, receiptId: 1, deleted: true, replayed: true }),
  );
  fireEvent.click(screen.getByRole('button', { name: '같은 요청으로 삭제 결과 확인' }));
  await waitFor(() => expect(api.success).toHaveBeenCalledWith('dashboard.deleted'));
  expect(api.del.mock.calls[1]).toEqual(['/dashboard/28', { data: original }]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dashboards'] });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await screen.findByRole('button', { name: 'Alpha analysis · 삭제' });
  api.get.mockResolvedValueOnce(
    response({
      dashboardId: 45,
      actorId: 7,
      organizationId: 7,
      revision: 'b'.repeat(64),
      canDelete: true,
      dependencies: Object.keys(deletionDependencyLabels).map(kind => ({ kind, count: 0 })),
    }),
  );
  click('Alpha analysis · 삭제');
  await screen.findByText('현재 확인한 사용처 설정이 없습니다. 삭제하면 원본 대시보드를 되돌릴 수 없습니다.');
  expect((screen.getByRole('button', { name: '대시보드 삭제' }) as HTMLButtonElement).disabled).toBe(false);
  expect(api.get).toHaveBeenLastCalledWith('/dashboard/45/delete-impact', undefined, { signal: expect.anything() });
  expect(api.del).toHaveBeenCalledTimes(2);
});
