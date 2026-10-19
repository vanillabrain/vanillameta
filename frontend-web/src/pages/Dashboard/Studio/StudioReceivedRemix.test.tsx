import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import StudioReceivedRemix from './StudioReceivedRemix';
import { fetchRemixRequirements } from './studioRemixApi';
const mocks = vi.hoisted(() => ({
  session: 'session-1' as string | null,
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  id: '20',
  save: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useParams: () => ({ dashboardId: mocks.id }) }));
vi.mock('@/helpers/apiHelper', () => ({ get: mocks.get, post: mocks.post }));
vi.mock('@/api/personalLibraryService', () => ({ personalLibrarySessionScope: () => mocks.session }));
import { readReceivedRemixPending } from './receivedRemixPendingStorage';
vi.mock('./StudioRemix', () => ({
  StudioRemixFlow: ({ token, onSave, onOriginRefresh }: any) => (
    <div>
      <p>{token}</p>
      <button onClick={onOriginRefresh}>원본 새로 확인</button>
      <button onClick={() => onSave(request(), () => true).catch(() => undefined)}>복제 저장</button>
      <button onClick={() => onSave(request(), () => false).catch(() => undefined)}>늦은 복제 응답</button>
    </div>
  ),
}));
vi.mock('./studioRemixApi', async () => ({
  ...(await vi.importActual<any>('./studioRemixApi')),
  saveRemix: (...args: unknown[]) => mocks.save(...args),
}));
const reference = 'd-1-7-20-2-' + 'a'.repeat(64);
const request = () => ({
  requestId: '533c472f-b03d-40a1-804c-4af4d787506c',
  targetSourceId: 22,
  mapping: { amount: 'total' },
  excludedBlockIds: [],
  expectedVersion: 2,
  expectedLifecycleRevision: 'c'.repeat(64),
  expectedSourceRevision: 'b'.repeat(64),
});
const scope = { actorId: 3, organizationId: 1, originId: 20, session: 'session-1' };
const context = { organization: { id: 1, name: 'Org', version: 3 }, membership: { userId: 3, role: 'member', team: '' } };
beforeEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  mocks.session = 'session-1';
  mocks.id = '20';
  mocks.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/enterprise/context' ? context : { reference } }),
  );
  mocks.save.mockResolvedValue({ dashboardId: 90 });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it('fetches a private current reference then saves through the same remix flow and opens only the new copy', async () => {
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  expect(mocks.get).toHaveBeenCalledWith('/studio/received/20/remix-reference');
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/90/studio'));
  expect(mocks.save).toHaveBeenCalledWith(reference, request());
  expect(readReceivedRemixPending(scope).pending).toBeNull();
  mocks.navigate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: '늦은 복제 응답' }));
  await act(async () => undefined);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it('keeps denial separate and explicitly retries permission/reference lookup', async () => {
  mocks.get.mockResolvedValueOnce({ data: context }).mockRejectedValueOnce(new Error('403'));
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 조직·복제 허용과 원본/);
  expect(screen.queryByRole('button', { name: '복제 저장' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '복제 허용 다시 확인' }));
  await screen.findByText(reference);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('refreshes the immutable reference explicitly when the original changes', async () => {
  const latest = 'd-1-7-20-3-' + 'b'.repeat(64);
  mocks.get
    .mockResolvedValueOnce({ data: context })
    .mockResolvedValueOnce({ data: { reference } })
    .mockResolvedValueOnce({ data: context })
    .mockResolvedValueOnce({ data: { reference: latest } });
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  fireEvent.click(screen.getByRole('button', { name: '원본 새로 확인' }));
  await screen.findByText(latest);
  expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects a reference for a different dashboard and ignores late lookup answers', async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  const view = render(<StudioReceivedRemix />);
  view.unmount();
  await act(async () => finish({ data: { reference } }));
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.get
    .mockResolvedValueOnce({ data: context })
    .mockResolvedValueOnce({ data: { reference: reference.replace('-20-', '-21-') } });
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 조직·복제 허용과 원본/);
  expect(screen.queryByRole('button', { name: '복제 저장' })).toBeNull();
});
it('routes received templates to the JWT-only API and keeps publication requests separate', async () => {
  const requirements = {
    token: reference,
    version: 2,
    lifecycleRevision: 'c'.repeat(64),
    title: 'Received',
    requiredFields: [],
    blocks: [{ id: 'block-1', title: 'Total', kind: 'BOARD_NUMERIC', supported: true }],
  };
  mocks.get.mockResolvedValueOnce({ data: requirements });
  await fetchRemixRequirements(reference);
  expect(mocks.get.mock.calls[0][0]).toBe('/studio/received/' + reference + '/remix-template');
  mocks.get.mockResolvedValueOnce({ data: { ...requirements, token: 'c'.repeat(64) } });
  await fetchRemixRequirements('c'.repeat(64));
  expect(mocks.get.mock.calls[1][0]).toBe('/studio/publications/' + 'c'.repeat(64) + '/remix-template');
});

it('accepts a group reference only for this dashboard and routes it to received JWT endpoints', async () => {
  const grouped = 'g-1-7-20-2-80-3-' + 'a'.repeat(64);
  mocks.get.mockResolvedValueOnce({ data: context }).mockResolvedValueOnce({ data: { reference: grouped } });
  render(<StudioReceivedRemix />);
  await screen.findByText(grouped);
  mocks.get.mockRejectedValueOnce(new Error('stop after route'));
  await expect(fetchRemixRequirements(grouped)).rejects.toThrow();
  expect(mocks.get).toHaveBeenLastCalledWith(
    '/studio/received/' + grouped + '/remix-template',
    undefined,
    expect.anything(),
  );
  cleanup();
  mocks.get
    .mockResolvedValueOnce({ data: context })
    .mockResolvedValueOnce({ data: { reference: grouped.replace('-20-', '-21-') } });
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 조직·복제 허용과 원본/);
  expect(screen.queryByRole('button', { name: '복제 저장' })).toBeNull();
});

it('stores the frozen private reference/body before POST without unmounting the live success callback', async () => {
  mocks.save.mockImplementationOnce(async (_reference, body) => {
    expect(readReceivedRemixPending(scope).pending).toMatchObject({ reference, input: body });
    expect(screen.getByRole('button', { name: '복제 저장' })).toBeTruthy();
    return { dashboardId: 90 };
  });
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard/90/studio'));
  expect(readReceivedRemixPending(scope).pending).toBeNull();
});
it('failed save switches to recovery; reload checks own pending before obtaining a newly authorized origin reference', async () => {
  mocks.save.mockRejectedValueOnce({ response: { status: 403 } });
  const view = render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  await screen.findByRole('button', { name: '저장 결과 확인' });
  view.unmount();
  mocks.get.mockClear();
  render(<StudioReceivedRemix />);
  await screen.findByRole('button', { name: '저장 결과 확인' });
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/enterprise/context', undefined, expect.anything());
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(readReceivedRemixPending(scope).pending?.reference).toBe(reference);
});
it('corrupt storage or failure to write blocks save and prevents new reference lookup until warned discard', async () => {
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  await screen.findByText(/복구 기록을 안전하게/);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '복제 요청 보관 해제' })).toBeTruthy();
});
it('no organization fails received flow before reference, and mismatched JWT actor cannot bind the server context', async () => {
  mocks.get.mockResolvedValueOnce({ data: { organization: null, membership: null } });
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 조직·복제 허용과 원본/);
  expect(mocks.get).toHaveBeenCalledTimes(1);
  cleanup();
  mocks.get.mockClear();
  localStorage.setItem('accessToken', JSON.stringify('x.' + btoa(JSON.stringify({ accessKeyData: { id: 4 } })) + '.x'));
  render(<StudioReceivedRemix />);
  await screen.findByText(/현재 조직·복제 허용과 원본/);
  expect(mocks.get).toHaveBeenCalledTimes(1);
});
it('a late save after session change cannot navigate or erase the original recovery ticket', async () => {
  let finish!: (v: unknown) => void;
  mocks.save.mockImplementationOnce(
    () =>
      new Promise(r => {
        finish = r;
      }),
  );
  render(<StudioReceivedRemix />);
  await screen.findByText(reference);
  fireEvent.click(screen.getByRole('button', { name: '복제 저장' }));
  mocks.session = 'session-2';
  fireEvent(window, new Event('storage'));
  await act(async () => finish({ dashboardId: 90 }));
  expect(mocks.navigate).not.toHaveBeenCalled();
  expect(readReceivedRemixPending(scope).pending?.input).toEqual(request());
});
