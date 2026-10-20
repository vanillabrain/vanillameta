import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FileRefreshJob from './FileRefreshJob';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), postForm: vi.fn(), done: vi.fn(), locked: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, postForm: api.postForm }));
vi.mock('@/helpers/authHelper', () => ({ getToken: () => 'test-token' }));
vi.mock('@/helpers/editorDraftStorage', () => ({
  editorDraftKey: async (_token: unknown, source: number) => 'scope:' + source,
}));
const id = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const result = { sourceId: 1, revision: 'b'.repeat(64), currentVersionId: 'version', versions: [], limit: 5 };
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const job = (request = requestId, status = 'queued') => ({
  id,
  requestId: request,
  sourceId: 1,
  originalname: 'new.csv',
  status,
  attempts: 1,
  ...(status === 'succeeded' ? { result } : {}),
});
const props = { sourceId: 1, revision: 'a'.repeat(64), onCompleted: api.done, onLockedChange: api.locked };
const select = () => {
  const file = new File(['day,amount\n2025-01-01,20'], 'new.csv');
  fireEvent.change(screen.getByLabelText('교체할 파일'), { target: { files: [file] } });
  return file;
};
const enabled = async () => {
  await waitFor(() => expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(false));
};
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.get.mockResolvedValue(wrap(null));
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it('admits exactly one UUID/file/revision and confirms completion with GET, without another POST', async () => {
  render(<FileRefreshJob {...props} />);
  await enabled();
  const file = select();
  let request = '';
  api.postForm.mockImplementation(async (_url, form) => {
    request = form.get('requestId');
    return wrap(job(request));
  });
  fireEvent.click(screen.getByRole('button', { name: '검증 후 파일 교체' }));
  await screen.findByText(/new.csv · 대기 중/);
  const [url, form] = api.postForm.mock.calls[0];
  expect(url).toBe('/database/1/file-refreshes');
  expect(form.get('file')).toBe(file);
  expect(form.get('expectedRevision')).toBe('a'.repeat(64));
  expect(request).toMatch(/^[a-f0-9-]{36}$/);
  expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(wrap(job(request, 'succeeded')));
  fireEvent.click(screen.getByRole('button', { name: '같은 갱신 요청 확인' }));
  await screen.findByText(/갱신 완료/);
  expect(api.done).toHaveBeenCalledTimes(1);
  expect(api.done).toHaveBeenCalledWith(result);
  expect(api.postForm).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem('scope:1:file-refresh')).toBeNull();
});
it('locks edits after a lost admission response and resolves that exact stored request with GET', async () => {
  render(<FileRefreshJob {...props} />);
  await enabled();
  select();
  api.postForm.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error' });
  fireEvent.click(screen.getByRole('button', { name: '검증 후 파일 교체' }));
  await screen.findByText(/실행 결과를 확인하지 못했습니다/);
  await screen.findByText(/서버에 연결하지 못했습니다/);
  const saved = JSON.parse(sessionStorage.getItem('scope:1:file-refresh'));
  expect(saved.sourceId).toBe(1);
  expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(wrap(job(saved.requestId, 'succeeded')));
  fireEvent.click(screen.getByRole('button', { name: '같은 갱신 요청 확인' }));
  await screen.findByText(/갱신 완료/);
  expect(api.get.mock.calls.at(-1)[0]).toBe('/database/1/file-refreshes/' + saved.requestId);
  expect(api.postForm).toHaveBeenCalledTimes(1);
});
it('reloads a saved request read-only and requires an explicit retry for an interrupted input', async () => {
  sessionStorage.setItem(
    'scope:1:file-refresh',
    JSON.stringify({ version: 1, updatedAt: Date.now(), sourceId: 1, requestId }),
  );
  api.get.mockResolvedValueOnce(wrap(job(requestId, 'interrupted')));
  render(<FileRefreshJob {...props} />);
  await screen.findByText(/실행 연결 끊김/);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.postForm).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce(wrap(job()));
  fireEvent.click(screen.getByRole('button', { name: '보관한 입력으로 다시 실행' }));
  await screen.findByText(/대기 중/);
  expect(api.post.mock.calls[0][0]).toBe('/database/1/file-refreshes/' + requestId + '/retry');
  expect(api.postForm).not.toHaveBeenCalled();
});
it('distinguishes confirmed cancellation from pending cleanup and confirms with GET only', async () => {
  api.get.mockResolvedValueOnce(wrap(job(requestId, 'running')));
  api.post.mockResolvedValueOnce(wrap({ ...job(requestId, 'cancelled'), cleanupPending: true }));
  render(<FileRefreshJob {...props} />);
  await screen.findByText(/파일 검증·갱신 중/);
  fireEvent.click(screen.getByRole('button', { name: '활성화 취소' }));
  await screen.findByText(/취소됨 · 기존 데이터 유지/);
  await screen.findByText(/실행과 보관 입력 정리 중/);
  expect(screen.queryByRole('button', { name: '보관한 입력으로 다시 실행' })).toBeNull();
  api.get.mockResolvedValueOnce(wrap({ ...job(requestId, 'cancelled'), cleanupPending: false }));
  fireEvent.click(screen.getByRole('button', { name: '같은 갱신 요청 확인' }));
  await waitFor(() => expect(screen.queryByText(/실행과 보관 입력 정리 중/)).toBeNull());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.postForm).not.toHaveBeenCalled();
  expect(api.done).not.toHaveBeenCalled();
});
it('blocks a new import while latest-job lookup failed and retries only that read', async () => {
  api.get.mockRejectedValueOnce({ response: { status: 503 } });
  render(<FileRefreshJob {...props} />);
  await screen.findByText(/실행 결과를 확인하지 못했습니다/);
  expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
  api.get.mockResolvedValueOnce(wrap(null));
  fireEvent.click(screen.getByRole('button', { name: '같은 갱신 요청 확인' }));
  await enabled();
  expect(api.postForm).not.toHaveBeenCalled();
  expect(api.get.mock.calls[1][0]).toBe('/database/1/file-refreshes/latest');
});
it('does not transmit when the tab cannot preserve a confirmation request', async () => {
  render(<FileRefreshJob {...props} />);
  await enabled();
  select();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  fireEvent.click(screen.getByRole('button', { name: '검증 후 파일 교체' }));
  await screen.findByText('storage blocked');
  expect(api.postForm).not.toHaveBeenCalled();
  await enabled();
});
it('does not replay a historical success into the current Explore profile', async () => {
  api.get.mockResolvedValueOnce(wrap(job(requestId, 'succeeded')));
  render(<FileRefreshJob {...props} />);
  await screen.findByText(/갱신 완료/);
  expect(api.done).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
it('ignores an old source response and aborts the old read after a source change', async () => {
  let resolve: (v: unknown) => void;
  api.get.mockImplementationOnce(
    () =>
      new Promise(r => {
        resolve = r;
      }),
  );
  const view = render(<FileRefreshJob {...props} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  const signal = api.get.mock.calls[0][2].signal;
  view.rerender(<FileRefreshJob {...props} sourceId={2} />);
  await enabled();
  await act(async () => resolve(wrap(job(requestId, 'succeeded'))));
  expect(signal.aborted).toBe(true);
  expect(api.done).not.toHaveBeenCalled();
  expect(screen.queryByText(/new.csv/)).toBeNull();
});

const correctionColumns = [
  { name: 'order_id', type: 'VARCHAR' },
  { name: 'updated_at', type: 'TIMESTAMP' },
  { name: 'ordered_at', type: 'TIMESTAMP' },
  { name: 'revenue', type: 'DOUBLE' },
];
const correction = { keyColumn: 'order_id', updatedAtColumn: 'updated_at' };
it('requires explicit correction settings and sends the immutable pair in the admitted request', async () => {
  render(<FileRefreshJob {...props} columns={correctionColumns} allowCorrection />);
  await enabled();
  select();
  fireEvent.click(screen.getByText('지연·정정 데이터 반영 설정'));
  fireEvent.click(screen.getByRole('checkbox', { name: '업무 키와 수정 시점으로 정정' }));
  expect((screen.getByRole('button', { name: '검증 후 정정 반영' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('업무 키'), { target: { value: 'order_id' } });
  fireEvent.change(screen.getByLabelText('수정 시점'), { target: { value: 'updated_at' } });
  api.postForm.mockImplementation(async (_url, form) => wrap({ ...job(form.get('requestId')), correction }));
  fireEvent.click(screen.getByRole('button', { name: '검증 후 정정 반영' }));
  await screen.findByText(/new.csv · 대기 중/);
  expect(JSON.parse(api.postForm.mock.calls[0][1].get('correction'))).toEqual(correction);
  expect(api.postForm).toHaveBeenCalledTimes(1);
});
it('restores historical correction settings and exact no-change counts without invalidating the current source', async () => {
  const stats = {
    rows: 4,
    inputRows: 6,
    duplicateRowsDropped: 1,
    supersededRows: 1,
    inserted: 0,
    updated: 0,
    identical: 3,
    ignoredOlder: 1,
    unchanged: true,
  };
  api.get.mockResolvedValueOnce(
    wrap({ ...job(requestId, 'succeeded'), correction, result: { ...result, unchanged: true, correctionStats: stats } }),
  );
  render(<FileRefreshJob {...props} columns={correctionColumns} allowCorrection />);
  await screen.findByText('변경 없이 확인 완료 · 현재 버전 유지');
  fireEvent.click(screen.getByText('지연·정정 데이터 반영 설정'));
  expect((screen.getByLabelText('업무 키') as HTMLSelectElement).value).toBe('order_id');
  expect((screen.getByLabelText('수정 시점') as HTMLSelectElement).value).toBe('updated_at');
  expect(api.done).not.toHaveBeenCalled();
  expect(api.postForm).not.toHaveBeenCalled();
});
it('does not accept malformed correction counts as a proven successful job', async () => {
  api.get.mockResolvedValueOnce(
    wrap({ ...job(requestId, 'succeeded'), correction, result: { ...result, correctionStats: { rows: -1 } } }),
  );
  render(<FileRefreshJob {...props} columns={correctionColumns} allowCorrection />);
  await screen.findByText('정정 결과의 처리 건수를 확인하지 못했습니다.');
  expect(screen.queryByRole('region', { name: '정정 처리 결과' })).toBeNull();
  expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
  expect(api.done).not.toHaveBeenCalled();
});
it('keeps correction intent after an unadmitted request reload so preparing again cannot silently become full replacement', async () => {
  sessionStorage.setItem(
    'scope:1:file-refresh',
    JSON.stringify({ version: 1, updatedAt: Date.now(), sourceId: 1, requestId, correction }),
  );
  api.get.mockRejectedValueOnce({ response: { status: 404 } });
  render(<FileRefreshJob {...props} columns={correctionColumns} allowCorrection />);
  await screen.findByRole('button', { name: '확인 후 새 요청 준비' });
  fireEvent.click(screen.getByRole('button', { name: '확인 후 새 요청 준비' }));
  fireEvent.click(screen.getByText('지연·정정 데이터 반영 설정'));
  expect((screen.getByLabelText('업무 키') as HTMLSelectElement).value).toBe('order_id');
  expect((screen.getByLabelText('수정 시점') as HTMLSelectElement).value).toBe('updated_at');
  expect(screen.getByRole('button', { name: '검증 후 정정 반영' })).not.toBeNull();
  expect(api.postForm).not.toHaveBeenCalled();
});
it('hides correction admission unless the server explicitly confirms support', async () => {
  render(<FileRefreshJob {...props} columns={correctionColumns} />);
  await enabled();
  expect(screen.queryByText('지연·정정 데이터 반영 설정')).toBeNull();
});
it('locks an operation mismatch instead of accepting a replacement receipt for the requested correction', async () => {
  render(<FileRefreshJob {...props} columns={correctionColumns} allowCorrection />);
  await enabled();
  select();
  fireEvent.click(screen.getByText('지연·정정 데이터 반영 설정'));
  fireEvent.click(screen.getByRole('checkbox', { name: '업무 키와 수정 시점으로 정정' }));
  fireEvent.change(screen.getByLabelText('업무 키'), { target: { value: 'order_id' } });
  fireEvent.change(screen.getByLabelText('수정 시점'), { target: { value: 'updated_at' } });
  api.postForm.mockImplementation(async (_url, form) => wrap(job(form.get('requestId'), 'succeeded')));
  fireEvent.click(screen.getByRole('button', { name: '검증 후 정정 반영' }));
  await screen.findByText(/요청한 정정 설정과 서버 작업이 다릅니다/);
  expect(api.done).not.toHaveBeenCalled();
  expect(api.postForm).toHaveBeenCalledTimes(1);
  expect(JSON.parse(sessionStorage.getItem('scope:1:file-refresh')).correction).toEqual(correction);
  expect((screen.getByRole('button', { name: '파일 선택' }) as HTMLButtonElement).disabled).toBe(true);
});
