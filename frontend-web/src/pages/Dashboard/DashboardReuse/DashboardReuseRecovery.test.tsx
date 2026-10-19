import React from 'react';
import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { setToken } from '@/helpers/authHelper';
import { editorDraftKey } from '@/helpers/editorDraftStorage';
import DashboardReuse from './index';
import { mixedReusePreview } from './studioReusePreview.fixture';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), navigate: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dashboardId: '12' }),
  useSearchParams: () => [new URLSearchParams('editor=studio')],
  useNavigate: () => api.navigate,
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));
vi.mock('./StudioReusePreview', () => ({ default: ({ preview }: any) => <div>새 미리보기 {preview.title}</div> }));
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const record = () => ({
  version: 1,
  updatedAt: Date.now(),
  originalId: 12,
  sourceId: 2,
  title: '복구할 제목',
  columnMap: { amount: 'amount_new', os: 'os_new' },
  blockIds: ['chart1', 'pivot1'],
  unitConfirmed: true,
  request: { ticket: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222' },
});
const cols = [
  { name: 'amount', type: 'DOUBLE', numeric: true, temporal: false },
  { name: 'os', type: 'VARCHAR', numeric: false, temporal: false },
];
const draft = () => ({
  originalId: 12,
  originalTitle: '원본',
  expectedRevision: 'a'.repeat(64),
  studioMixed: true,
  originalSourceId: 1,
  title: '원본 복사본',
  columns: cols,
  currency: 'USD',
  sources: [{ id: 2, name: '내 파일' }],
  blocks: [
    { id: 'chart1', title: 'Sales', kind: 'BOARD_NUMERIC', columns: ['amount'] },
    { id: 'pivot1', title: 'Margin', kind: 'SEGMENT_PIVOT', columns: ['amount', 'os'] },
  ],
});
const profile = () => ({
  sourceId: 2,
  dataVersion: 'b'.repeat(64),
  supported: true,
  columns: cols.map(c => ({ ...c, name: c.name + '_new' })),
});
async function seed() {
  const key = (await editorDraftKey('test-token', 12)) + ':studio-reuse-save';
  const value = record();
  sessionStorage.setItem(key, JSON.stringify(value));
  return { key, value };
}
async function recoveryReady() {
  const button = await screen.findByRole('button', { name: '같은 저장 요청 확인' });
  await waitFor(() => expect(button.getAttribute('aria-busy')).toBeNull());
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('crypto', webcrypto);
  setToken('test-token');
  api.get.mockImplementation(async url => wrap(url.endsWith('/reuse') ? draft() : profile()));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('reload gates the saved request without automatic reads or writes and confirms exactly once', async () => {
  const { key, value } = await seed();
  render(<DashboardReuse />);
  await screen.findByRole('heading', { name: '복사본 저장 결과 확인' });
  await recoveryReady();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce(wrap({ id: 90, replayed: true }));
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/90/studio'));
  expect(api.post.mock.calls[0][0]).toBe('/bi/dashboards/12/reuse');
  expect(api.post.mock.calls[0][1]).toEqual(value.request);
  expect(sessionStorage.getItem(key)).toBeNull();
});
it('expired server ticket preserves the record and restores connection inputs only explicitly', async () => {
  const { key, value } = await seed();
  render(<DashboardReuse />);
  await recoveryReady();
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { message: '미리보기가 만료되었습니다.' } } });
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await screen.findByRole('button', { name: '연결 입력으로 돌아가기' });
  expect(JSON.parse(sessionStorage.getItem(key))).toEqual(value);
  expect(api.get).not.toHaveBeenCalled();
  screen.getByRole('button', { name: '연결 입력으로 돌아가기' }).focus();
  fireEvent.click(screen.getByRole('button', { name: '연결 입력으로 돌아가기' }));
  await screen.findByLabelText('amount 연결');
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe(value.title);
  expect((screen.getByLabelText('amount 연결') as HTMLSelectElement).value).toBe('amount_new');
  expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('2');
  expect(screen.getByRole('button', { name: '복사본 저장' }).matches(':disabled')).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '전체 미리보기' }));
});
it('source permission failure during input restoration keeps the same request and record', async () => {
  const { key, value } = await seed();
  render(<DashboardReuse />);
  await recoveryReady();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: '기준 변경' } } });
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await screen.findByRole('button', { name: '연결 입력으로 돌아가기' });
  api.get.mockImplementation(async url => {
    if (url.includes('/profile')) throw { response: { status: 403 } };
    return wrap(draft());
  });
  fireEvent.click(screen.getByRole('button', { name: '연결 입력으로 돌아가기' }));
  await screen.findByRole('alert');
  expect(JSON.parse(sessionStorage.getItem(key))).toEqual(value);
  expect(api.navigate).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: '복사본 저장 결과 확인' })).toBeTruthy();
});
it('changed login scope prevents explicit confirmation without deleting the old record', async () => {
  const { key } = await seed();
  render(<DashboardReuse />);
  await recoveryReady();
  localStorage.setItem('accessToken', JSON.stringify('different-token'));
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await screen.findByRole('alert');
  expect(api.post).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).not.toBeNull();
});
it('confirmed save retains the gate when local record removal fails', async () => {
  const { key } = await seed();
  render(<DashboardReuse />);
  await recoveryReady();
  api.post.mockResolvedValueOnce(wrap({ id: 90, replayed: true }));
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw Error('unavailable');
  });
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await screen.findByRole('alert');
  expect(api.navigate).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(key)).not.toBeNull();
});
it('persists before sending and keeps the identical request across an uncertain save remount', async () => {
  const view = render(<DashboardReuse />);
  await screen.findByLabelText('데이터 소스');
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  await screen.findByLabelText('amount 연결');
  fireEvent.change(screen.getByLabelText('amount 연결'), { target: { value: 'amount_new' } });
  fireEvent.change(screen.getByLabelText('os 연결'), { target: { value: 'os_new' } });
  const v = mixedReusePreview();
  v.title = '원본 복사본';
  api.post.mockResolvedValueOnce(
    wrap({ ticket: '11111111-1111-4111-8111-111111111111', originalId: 12, sourceId: 2, studioPreview: v }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '전체 미리보기' }).getAttribute('aria-disabled')).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('새 미리보기 원본 복사본');
  let sent: any, storedAtSend: any;
  api.post.mockImplementationOnce(async (_url, body) => {
    sent = body;
    const k = (await editorDraftKey('test-token', 12)) + ':studio-reuse-save';
    storedAtSend = JSON.parse(sessionStorage.getItem(k));
    throw { response: { status: 503 } };
  });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  expect(storedAtSend.request).toEqual(sent);
  view.unmount();
  render(<DashboardReuse />);
  await screen.findByRole('heading', { name: '복사본 저장 결과 확인' });
  await recoveryReady();
  expect(api.post).toHaveBeenCalledTimes(2);
  api.post.mockResolvedValueOnce(wrap({ id: 91, replayed: true }));
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/91/studio'));
  expect(api.post.mock.calls[2][1]).toEqual(sent);
});
async function prepare(title = '원본 복사본', ticket = '11111111-1111-4111-8111-111111111111') {
  if (!screen.queryByLabelText('amount 연결')) {
    await screen.findByLabelText('데이터 소스');
    fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
    await screen.findByLabelText('amount 연결');
    fireEvent.change(screen.getByLabelText('amount 연결'), { target: { value: 'amount_new' } });
    fireEvent.change(screen.getByLabelText('os 연결'), { target: { value: 'os_new' } });
  }
  fireEvent.change(screen.getByLabelText('복사본 제목'), { target: { value: title } });
  const value = mixedReusePreview();
  value.title = title;
  api.post.mockResolvedValueOnce(wrap({ ticket, originalId: 12, sourceId: 2, studioPreview: value }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '전체 미리보기' }).getAttribute('aria-disabled')).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('새 미리보기 ' + title);
}
it('failed storage sends nothing and a changed preview records only its new request', async () => {
  const view = render(<DashboardReuse />);
  await prepare();
  const originalSet = Storage.prototype.setItem;
  let attemptedWrite = false;
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key.endsWith(':studio-reuse-save')) {
      attemptedWrite = true;
      throw Error('quota');
    }
    return originalSet.call(this, key, value);
  });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/요청을 보내지 않았습니다/);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(attemptedWrite).toBe(true);
  storage.mockRestore();
  await prepare('수정된 제목', '33333333-3333-4333-8333-333333333333');
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  const sent = api.post.mock.calls[2][1];
  const key = (await editorDraftKey('test-token', 12)) + ':studio-reuse-save';
  expect(JSON.parse(sessionStorage.getItem(key)).request).toEqual(sent);
  expect(JSON.parse(sessionStorage.getItem(key)).title).toBe('수정된 제목');
  view.unmount();
  render(<DashboardReuse />);
  await recoveryReady();
  api.post.mockResolvedValueOnce(wrap({ id: 92, replayed: true }));
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 확인' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/92/studio'));
  expect(api.post.mock.calls[3][1]).toEqual(sent);
});
it.each([401, 403])('uncertain save then %s preserves the exact record and locks input edits', async status => {
  render(<DashboardReuse />);
  await prepare();
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  const key = (await editorDraftKey('test-token', 12)) + ':studio-reuse-save';
  const before = sessionStorage.getItem(key);
  api.post.mockRejectedValueOnce({ response: { status } });
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 다시 확인' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  await screen.findByText(/확인 기록은 유지됩니다/);
  expect(sessionStorage.getItem(key)).toBe(before);
  expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[2][1]);
  expect(screen.getByLabelText('복사본 제목').matches(':disabled')).toBe(true);
});
