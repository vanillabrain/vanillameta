import { fetchBusinessBasis } from '@/api/businessBasis';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FileVersions from './FileVersions';
import Explore from './index';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), postForm: vi.fn(), changed: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, postForm: api.postForm }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams('sourceId=1')],
}));
vi.mock('@/widget/modules/board/NumericBoard', () => ({ default: () => <div>숫자 미리보기</div> }));
const revision = 'opaque/revision:+==';
const version = (id: string, current = false) => ({
  id,
  originalname: `${id}.csv`,
  rows: 42,
  uploadedAt: '2026-10-13T01:00:00Z',
  current,
});
const snapshot = (sourceId = 1, nextRevision = revision, currentVersionId = 'filename-derived') => ({
  sourceId,
  revision: nextRevision,
  currentVersionId,
  limit: 5,
  versions: [version(currentVersionId, true), version(currentVersionId === 'older' ? 'filename-derived' : 'older')],
});
const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
function deferred() {
  let resolve: (value: unknown) => void;
  let reject: (reason: unknown) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve: (value: unknown) => resolve(value), reject: (reason: unknown) => reject(reason) };
}
const button = (name: string) => screen.getByRole('button', { name });
const disabled = (name: string) => (button(name) as HTMLButtonElement).disabled;
const selectFile = (name = 'new.csv') => {
  const file = new File(['amount\n7'], name, { type: 'text/csv' });
  fireEvent.change(screen.getByLabelText('교체할 파일'), { target: { files: [file] } });
  return file;
};
const mount = async () => {
  const result = render(<FileVersions sourceId={1} onChanged={api.changed} />);
  await screen.findByRole('rowheader', { name: /filename-derived.csv/ });
  return result;
};
vi.mock('@/api/businessBasis', async importOriginal => ({
  ...(await importOriginal<typeof import('@/api/businessBasis')>()),
  fetchBusinessBasis: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchBusinessBasis).mockImplementation(async id => {
    const index = api.get.mock.calls.findLastIndex(([url]) => url === `/bi/sources/${id}/profile`);
    const response = await api.get.mock.results[index].value;
    const native = response.data.data;
    return { sourceId: id, sourceRevision: native.dataVersion, businessBasis: null, businessColumns: native.columns };
  });
  api.get.mockResolvedValue(success(snapshot()));
  api.postForm.mockResolvedValue(success(snapshot(1, 'fresh opaque revision', 'new-uuid')));
  api.post.mockResolvedValue(success(snapshot(1, 'restored revision', 'older')));
});
afterEach(cleanup);

it.each(['payload', 'envelope'])(
  'handles an unchanged replacement as a no-op (%s) with the large-import timeout',
  async location => {
    await mount();
    const file = selectFile('same.csv');
    const data = snapshot();
    api.postForm.mockResolvedValueOnce(
      location === 'payload'
        ? success({ ...data, unchanged: true })
        : { data: { status: 'SUCCESS', data, unchanged: true } },
    );
    fireEvent.click(button('검증 후 파일 교체'));
    await screen.findByText('같은 파일입니다. 현재 버전과 이력을 유지했습니다.');
    const [url, form, config] = api.postForm.mock.calls[0];
    expect(url).toBe('/database/1/file-replacement');
    expect(form.get('file')).toBe(file);
    expect(form.get('expectedRevision')).toBe(revision);
    expect(config).toEqual({ signal: expect.any(AbortSignal), timeout: 360000 });
    expect(api.changed).not.toHaveBeenCalled();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole('row', { name: /filename-derived.csv/ })).getByText('현재 버전')).not.toBeNull();
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    expect(screen.getByText('선택한 파일 없음')).not.toBeNull();
    expect(disabled('파일 선택')).toBe(false);
    expect(disabled('검증 후 파일 교체')).toBe(true);
  },
);

it('sends exactly the selected file and opaque CAS revision, locks controls, then uses the fresh response', async () => {
  await mount();
  expect(disabled('검증 후 파일 교체')).toBe(true);
  expect(screen.getByText(/열 이름과 타입이 모두 같은 파일/).textContent).toContain('최대 5개');
  expect(within(screen.getByRole('row', { name: /filename-derived.csv/ })).queryByRole('button')).toBeNull();
  const file = selectFile();
  expect(screen.getByText('선택한 파일: new.csv')).not.toBeNull();
  const request = deferred();
  api.postForm.mockReturnValueOnce(request.promise);
  fireEvent.click(button('검증 후 파일 교체'));
  const [url, form, config] = api.postForm.mock.calls[0];
  expect(url).toBe('/database/1/file-replacement');
  expect([...form.keys()]).toEqual(['file', 'expectedRevision']);
  expect(form.get('file')).toBe(file);
  expect(form.get('expectedRevision')).toBe(revision);
  expect(config.signal).toBeInstanceOf(AbortSignal);
  for (const name of ['파일 선택', '검증 후 파일 교체', '이 버전으로 복원', '버전 목록 새로고침'])
    expect(disabled(name)).toBe(true);
  expect((screen.getByLabelText('교체할 파일') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(button('검증 후 파일 교체'));
  expect(api.postForm).toHaveBeenCalledTimes(1);
  await act(async () => request.resolve(success(snapshot(1, 'fresh opaque revision', 'new-uuid'))));
  await screen.findByRole('rowheader', { name: /new-uuid.csv/ });
  expect(api.changed).toHaveBeenCalledTimes(1);
  expect(screen.getByText('선택한 파일 없음')).not.toBeNull();
  expect(disabled('검증 후 파일 교체')).toBe(true);
  selectFile('next.csv');
  fireEvent.click(button('검증 후 파일 교체'));
  await waitFor(() => expect(api.postForm).toHaveBeenCalledTimes(2));
  expect(api.postForm.mock.calls[1][1].get('expectedRevision')).toBe('fresh opaque revision');
});

it.each([
  { data: '열 타입 불일치 <img src=x onerror=alert(1)>' },
  { message: '다른 사용자가 파일을 변경했습니다.' },
  { data: { message: '열 이름 불일치' } },
  { data: { message: { invalid: true } }, message: '파일 크기 제한' },
])('shows server error strings as safe text and retains the selected file: %j', async envelope => {
  await mount();
  const file = selectFile();
  api.postForm.mockRejectedValueOnce({ response: { data: envelope } });
  fireEvent.click(button('검증 후 파일 교체'));
  const alert = await screen.findByRole('alert');
  const nested = typeof envelope.data === 'string' ? envelope.data : envelope.data?.message;
  const message = typeof nested === 'string' ? nested : envelope.message;
  expect(alert.textContent).toBe(message);
  expect(alert.querySelector('img')).toBeNull();
  expect(screen.getByText(`선택한 파일: ${file.name}`)).not.toBeNull();
  expect(disabled('검증 후 파일 교체')).toBe(false);
  expect(api.changed).not.toHaveBeenCalled();
  expect(screen.getByRole('rowheader', { name: /filename-derived.csv/ })).not.toBeNull();
});

it('rejects a failed success envelope, falls back for object errors and refreshes revision for retry', async () => {
  await mount();
  selectFile();
  api.postForm.mockResolvedValueOnce({ data: { status: 'ERROR', data: '검증에 실패했습니다.' } });
  fireEvent.click(button('검증 후 파일 교체'));
  await screen.findByText('검증에 실패했습니다.');
  api.postForm.mockRejectedValueOnce({ response: { data: { data: { reason: 'unknown' } } } });
  fireEvent.click(button('검증 후 파일 교체'));
  await screen.findByText(/파일 변경에 실패했습니다/);
  expect(api.changed).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce(success(snapshot(1, 'revision after conflict')));
  fireEvent.click(button('버전 목록 새로고침'));
  await waitFor(() => expect(disabled('파일 선택')).toBe(false));
  selectFile();
  fireEvent.click(button('검증 후 파일 교체'));
  await waitFor(() => expect(api.postForm).toHaveBeenCalledTimes(3));
  expect(api.postForm.mock.calls[2][1].get('expectedRevision')).toBe('revision after conflict');
});

it('requires explicit inline restore confirmation below the table, supports cancel, and posts the opaque version id', async () => {
  await mount();
  fireEvent.click(button('이 버전으로 복원'));
  expect(api.post).not.toHaveBeenCalled();
  const confirmation = screen.getByRole('region', { name: '파일 버전 복원 확인' });
  expect(within(confirmation).getByText('복원할 파일: older.csv')).not.toBeNull();
  expect(screen.getByRole('table').contains(confirmation)).toBe(false);
  expect(within(screen.getByRole('table')).queryByRole('button', { name: '복원 확인' })).toBeNull();
  expect(screen.getByText(/연결된 대시보드 데이터도 바뀝니다/)).not.toBeNull();
  fireEvent.click(button('취소'));
  expect(screen.queryByRole('button', { name: '복원 확인' })).toBeNull();
  expect(screen.queryByRole('region', { name: '파일 버전 복원 확인' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(button('이 버전으로 복원'));
  const request = deferred();
  api.post.mockReturnValueOnce(request.promise);
  fireEvent.click(button('복원 확인'));
  expect(api.post).toHaveBeenCalledWith(
    '/database/1/file-restore',
    { expectedRevision: revision, versionId: 'older' },
    { signal: expect.any(AbortSignal) },
  );
  expect(disabled('복원 확인')).toBe(true);
  expect(disabled('취소')).toBe(true);
  await act(async () => request.resolve(success(snapshot(1, 'restored revision', 'older'))));
  await screen.findByText('선택한 파일 버전으로 복원했습니다.');
  expect(api.changed).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: '복원 확인' })).toBeNull();
  expect(within(screen.getByRole('row', { name: /older.csv/ })).getByText('현재 버전')).not.toBeNull();
});

it('renders fixed mobile columns and compact date and time without splitting short filenames', async () => {
  const data = snapshot();
  const uploadedAt = new Date(2026, 9, 13, 12, 56).toISOString();
  data.versions = [
    { ...version('filename-derived', true), originalname: 'week1.csv', uploadedAt },
    { ...version('older'), originalname: 'a-very-long-file-name-for-a-weekly-sales-export.csv', uploadedAt },
  ];
  api.get.mockResolvedValueOnce(success(data));
  render(<FileVersions sourceId={1} onChanged={api.changed} />);
  const rowHeader = await screen.findByRole('rowheader', { name: /week1.csv/ });
  const table = screen.getByRole('table') as HTMLTableElement;
  expect(table.style.width).toBe('100%');
  expect(table.style.tableLayout).toBe('fixed');
  expect(Array.from(table.querySelectorAll('col')).map(column => column.style.width)).toEqual(['28%', '14%', '30%', '28%']);
  expect(rowHeader.style.overflowWrap).toBe('break-word');
  expect(rowHeader.style.wordBreak).toBe('normal');
  expect(within(table).getByRole('columnheader', { name: '행 수' })).not.toBeNull();
  const times = Array.from(table.querySelectorAll('time'));
  expect(times).toHaveLength(2);
  for (const time of times) {
    expect(time.dateTime).toBe(uploadedAt);
    expect(Array.from(time.children).map(line => line.textContent)).toEqual(['2026.10.13', '12:56']);
  }
  fireEvent.click(button('이 버전으로 복원'));
  expect(
    within(screen.getByRole('region', { name: '파일 버전 복원 확인' })).getByText(
      `복원할 파일: ${data.versions[1].originalname}`,
    ),
  ).not.toBeNull();
});

it('switches the chosen restore filename below the table and confirms only the chosen version', async () => {
  const data = snapshot();
  data.versions.push({ ...version('another'), originalname: 'week0.csv' });
  api.get.mockResolvedValueOnce(success(data));
  await mount();
  fireEvent.click(within(screen.getByRole('row', { name: /older.csv/ })).getByRole('button', { name: '이 버전으로 복원' }));
  fireEvent.click(within(screen.getByRole('row', { name: /week0.csv/ })).getByRole('button', { name: '이 버전으로 복원' }));
  const confirmation = screen.getByRole('region', { name: '파일 버전 복원 확인' });
  expect(within(confirmation).getByText('복원할 파일: week0.csv')).not.toBeNull();
  expect(within(confirmation).queryByText('복원할 파일: older.csv')).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
  api.post.mockResolvedValueOnce(success(snapshot(1, 'restored revision', 'another')));
  fireEvent.click(within(confirmation).getByRole('button', { name: '복원 확인' }));
  await screen.findByText('선택한 파일 버전으로 복원했습니다.');
  expect(api.post.mock.calls[0][1]).toEqual({ expectedRevision: revision, versionId: 'another' });
});

it('keeps restore failure visible without changing the current version', async () => {
  await mount();
  fireEvent.click(button('이 버전으로 복원'));
  api.post.mockRejectedValueOnce({ response: { data: { message: '버전이 만료되었습니다.' } } });
  fireEvent.click(button('복원 확인'));
  await screen.findByText('버전이 만료되었습니다.');
  expect(disabled('복원 확인')).toBe(false);
  expect(api.changed).not.toHaveBeenCalled();
  expect(within(screen.getByRole('row', { name: /filename-derived.csv/ })).getByText('현재 버전')).not.toBeNull();
});

it('aborts an old load and ignores its late response after changing source', async () => {
  const request = deferred();
  api.get.mockReturnValueOnce(request.promise);
  const view = render(<FileVersions sourceId={1} onChanged={api.changed} />);
  const signal = api.get.mock.calls[0][2].signal;
  api.get.mockResolvedValueOnce(success(snapshot(2, 'second', 'source-two')));
  view.rerender(<FileVersions sourceId={2} onChanged={api.changed} />);
  expect(signal.aborted).toBe(true);
  await screen.findByRole('rowheader', { name: /source-two.csv/ });
  await act(async () => request.resolve(success(snapshot())));
  expect(screen.queryByRole('rowheader', { name: /filename-derived.csv/ })).toBeNull();
  expect(screen.getByRole('rowheader', { name: /source-two.csv/ })).not.toBeNull();
  expect(api.changed).not.toHaveBeenCalled();
});

it.each(['replace', 'restore'])('aborts %s on source change and discards stale success and callback', async action => {
  const view = await mount();
  const request = deferred();
  if (action === 'replace') {
    selectFile();
    api.postForm.mockReturnValueOnce(request.promise);
    fireEvent.click(button('검증 후 파일 교체'));
  } else {
    api.post.mockReturnValueOnce(request.promise);
    fireEvent.click(button('이 버전으로 복원'));
    fireEvent.click(button('복원 확인'));
  }
  const signal = (action === 'replace' ? api.postForm : api.post).mock.calls[0][2].signal;
  const nextLoad = deferred();
  api.get.mockReturnValueOnce(nextLoad.promise);
  view.rerender(<FileVersions sourceId={2} onChanged={api.changed} />);
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('button', { name: '복원 확인' })).toBeNull();
  expect(screen.getByText('선택한 파일 없음')).not.toBeNull();
  await act(async () => request.resolve(success(snapshot(1, 'stale', 'stale-uuid'))));
  expect(disabled('파일 선택')).toBe(true);
  expect(api.changed).not.toHaveBeenCalled();
  expect(screen.queryByRole('rowheader', { name: /stale-uuid/ })).toBeNull();
  await act(async () => nextLoad.resolve(success(snapshot(2, 'second', 'source-two'))));
  selectFile('source-two.csv');
  api.postForm.mockResolvedValueOnce(success(snapshot(2, 'new', 'two-new')));
  fireEvent.click(button('검증 후 파일 교체'));
  await screen.findByRole('rowheader', { name: /two-new.csv/ });
  const [url, form] = api.postForm.mock.calls.at(-1);
  expect(url).toBe('/database/2/file-replacement');
  expect(form.get('expectedRevision')).toBe('second');
});

it('ignores late errors after source change and aborts the active request on unmount', async () => {
  const view = await mount();
  const request = deferred();
  api.postForm.mockReturnValueOnce(request.promise);
  selectFile();
  fireEvent.click(button('검증 후 파일 교체'));
  api.get.mockResolvedValueOnce(success(snapshot(2, 'second', 'source-two')));
  view.rerender(<FileVersions sourceId={2} onChanged={api.changed} />);
  await screen.findByRole('rowheader', { name: /source-two.csv/ });
  await act(async () => request.reject({ response: { data: { message: 'stale error' } } }));
  expect(screen.queryByRole('alert')).toBeNull();
  const nextRequest = deferred();
  api.postForm.mockReturnValueOnce(nextRequest.promise);
  selectFile();
  fireEvent.click(button('검증 후 파일 교체'));
  const signal = api.postForm.mock.calls[1][2].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => nextRequest.resolve(success(snapshot(2))));
  expect(api.changed).not.toHaveBeenCalled();
});

it('loads errors with a retry and respects Explore busy state', async () => {
  api.get.mockRejectedValueOnce({ response: { data: { message: '조회 실패' } } });
  const view = render(<FileVersions sourceId={1} onChanged={api.changed} />);
  await screen.findByText('조회 실패');
  expect(disabled('파일 선택')).toBe(true);
  fireEvent.click(button('버전 목록 새로고침'));
  await screen.findByRole('rowheader', { name: /filename-derived.csv/ });
  selectFile();
  view.rerender(<FileVersions sourceId={1} onChanged={api.changed} disabled />);
  for (const name of ['파일 선택', '검증 후 파일 교체', '이 버전으로 복원', '버전 목록 새로고침'])
    expect(disabled(name)).toBe(true);
  expect(api.postForm).not.toHaveBeenCalled();
});

it('reloads Explore profile and metrics and clears a chart preview after replacement', async () => {
  const definition = {
    sourceId: 1,
    label: '매출',
    aggregation: 'SUM',
    column: 'amount',
    unit: '',
    decimalPlaces: 0,
    numberNotation: 'plain',
  };
  const metric = { id: 10, label: '매출', definitionVersion: 1, definition };
  let rowCount = '42';
  let metricLoads = 0;
  api.get.mockImplementation(async (url: string) => {
    if (url.endsWith('/file-versions')) return success(snapshot());
    if (url.endsWith('/profile'))
      return success({
        sourceId: 1,
        name: '파일',
        engine: 'duckdb',
        status: 'ready',
        supported: true,
        dataVersion: revision,
        rowCount,
        columns: [{ name: 'amount', type: 'DOUBLE', numeric: true, temporal: false, nullCount: '0' }],
      });
    if (url === '/bi/metrics') {
      metricLoads += 1;
      return success([metric]);
    }
    return success([{ id: 1, name: '파일', engine: 'duckdb' }]);
  });
  api.post.mockResolvedValueOnce(
    success({
      rows: [{ value: 7 }],
      metric: definition,
      sourceRevision: revision,
      definitionVersion: 1,
      complete: true,
      limit: 500,
    }),
  );
  render(<Explore />);
  await screen.findByRole('rowheader', { name: /filename-derived.csv/ });
  fireEvent.change(screen.getByLabelText('저장된 지표'), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('차트 제목'), { target: { value: '매출 차트' } });
  fireEvent.click(button('결과 미리보기'));
  await screen.findByRole('region', { name: '집계 결과 표' });
  selectFile();
  rowCount = '99';
  fireEvent.click(button('검증 후 파일 교체'));
  await screen.findByText(/저장된 전체 행 수: 99/);
  expect(metricLoads).toBe(2);
  expect(screen.queryByRole('region', { name: '집계 결과 표' })).toBeNull();
  expect(disabled('대시보드 저장')).toBe(true);
  expect((screen.getByLabelText('저장된 지표') as HTMLSelectElement).value).toBe('10');
});
