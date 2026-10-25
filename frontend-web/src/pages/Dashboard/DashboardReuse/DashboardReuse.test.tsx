import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardReuse from './index';
import { mixedReusePreview } from './studioReusePreview.fixture';
import { CHART_SETUP_UNAVAILABLE_MESSAGE } from '../Studio/studioCreation';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  navigate: vi.fn(),
  id: '12',
  query: '',
  kind: undefined as string | undefined,
  uuid: undefined as string | undefined,
}));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ dashboardId: api.id, kind: api.kind, uuid: api.uuid }),
  useNavigate: () => api.navigate,
  useSearchParams: () => [new URLSearchParams(api.query)],
  Link: ({ to, children }: any) => <a href={to}>{children}</a>,
}));
vi.mock('../../Publication/SnapshotView', () => ({
  default: ({ snapshot, context }: any) => (
    <div>
      미리보기: {snapshot.title} · {context}
    </div>
  ),
}));
vi.mock('./StudioReusePreview', () => ({ default: ({ preview }: any) => <div>혼합 미리보기: {preview.title}</div> }));
const columns = [
  { name: 'amount', numeric: true, temporal: false, type: 'DOUBLE' },
  { name: 'os', numeric: false, temporal: false, type: 'VARCHAR' },
];
const original = () => ({
  originalId: Number(api.id),
  originalTitle: '원본',
  expectedRevision: 'a'.repeat(64),
  originalSourceId: 1,
  title: '원본 복사본',
  columns,
  sources: [
    { id: 1, name: '원본 소스' },
    { id: 2, name: '새 소스' },
  ],
});
const profile = (id = 1) => ({
  sourceId: id,
  supported: true,
  dataVersion: 'b'.repeat(64),
  columns: id === 1 ? columns : columns.map(column => ({ ...column, name: column.name + '_new' })),
});
const wrap = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const preview = (title = '원본 복사본', sourceId = 1) => ({
  originalId: Number(api.id),
  sourceId,
  ticket: 'one-preview',
  snapshot: { title, widgets: [{ type: 'BOARD_NUMERIC', datas: [{ value: 42 }] }] },
});
beforeEach(() => {
  vi.clearAllMocks();
  api.id = '12';
  api.query = '';
  api.kind = undefined;
  api.uuid = undefined;
  api.get.mockImplementation(async (url: string) =>
    wrap(url.endsWith('/reuse') ? original() : profile(url.includes('/2/') ? 2 : 1)),
  );
});
afterEach(cleanup);
const mixedOriginal = () => ({
  ...original(),
  studioMixed: true,
  blocks: [
    { id: 'chart1', title: 'Sales', kind: 'BOARD_NUMERIC', columns: ['amount'] },
    { id: 'pivot1', title: 'Margin', kind: 'SEGMENT_PIVOT', columns: ['amount', 'os'] },
  ],
});
it('mixed_source_mapping_has_no_automatic_source_or_write_and_renders_whole_preview', async () => {
  api.query = 'editor=studio';
  api.get.mockImplementation(async (url: string) =>
    wrap(url.endsWith('/reuse') ? mixedOriginal() : { ...profile(2), columns }),
  );
  render(<DashboardReuse />);
  await screen.findByLabelText('데이터 소스');
  await waitFor(() => expect(screen.queryByText('원본을 불러오는 중…')).toBeNull());
  expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  const value = mixedReusePreview();
  value.title = '원본 복사본';
  api.post.mockResolvedValueOnce(wrap({ ticket: 'mixed-ticket', originalId: 12, sourceId: 2, studioPreview: value }));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('혼합 미리보기: 원본 복사본');
  expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByLabelText('Sales 포함'));
  expect(screen.queryByText('혼합 미리보기: 원본 복사본')).toBeNull();
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/일반 차트가 하나 이상/)).toBeTruthy();
});
it('unsupported_blocks_require_explicit_exclusion', async () => {
  const source = mixedOriginal();
  (source.blocks[1] as any).unsupportedReason = '업무 의미 매핑 미지원';
  api.get.mockImplementation(async (url: string) => wrap(url.endsWith('/reuse') ? source : { ...profile(2), columns }));
  render(<DashboardReuse />);
  await screen.findByLabelText('데이터 소스');
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  await screen.findByText('업무 의미 매핑 미지원');
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Margin 포함'));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  expect(api.post).not.toHaveBeenCalled();
});
async function open() {
  const view = render(<DashboardReuse />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  return view;
}
async function makePreview() {
  api.post.mockResolvedValueOnce(wrap(preview()));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('미리보기: 원본 복사본 · reuse');
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
}
it('opens an unwritten copy, maps renamed columns explicitly and saves only a ticket', async () => {
  await open();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  await screen.findByLabelText('amount 연결');
  await waitFor(() => expect((screen.getByLabelText('amount 연결') as HTMLSelectElement).disabled).toBe(false));
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('amount 연결'), { target: { value: 'amount_new' } });
  fireEvent.change(screen.getByLabelText('os 연결'), { target: { value: 'os_new' } });
  api.post.mockResolvedValueOnce(wrap(preview('원본 복사본', 2)));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('미리보기: 원본 복사본 · reuse');
  expect(api.post.mock.calls[0][1]).toEqual({
    expectedRevision: 'a'.repeat(64),
    sourceId: 2,
    sourceRevision: 'b'.repeat(64),
    title: '원본 복사본',
    columnMap: { amount: 'amount_new', os: 'os_new' },
  });
  api.post.mockResolvedValueOnce(wrap({ id: 90 }));
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/90'));
  expect(api.post.mock.calls[1][1]).toEqual({ ticket: 'one-preview', requestId: expect.any(String) });
  expect(api.post.mock.calls.every(call => !call[1].draft && !call[1].sql && !call[1].dashboardId)).toBe(true);
});
it('invalidates preview after title change and refuses the old save', async () => {
  await open();
  await makePreview();
  fireEvent.change(screen.getByLabelText('복사본 제목'), { target: { value: '새 제목' } });
  expect(screen.queryByText(/미리보기:/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  expect(api.post).toHaveBeenCalledTimes(1);
});
it('ignores a preview arriving after the input changed', async () => {
  await open();
  let resolve: any;
  api.post.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  fireEvent.change(screen.getByLabelText('복사본 제목'), { target: { value: '다음 초안' } });
  await act(async () => resolve(wrap(preview())));
  expect(screen.queryByText(/미리보기:/)).toBeNull();
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe('다음 초안');
});
it('keeps failed preview inputs editable without enabling save', async () => {
  await open();
  api.post.mockRejectedValueOnce({ response: { status: 400, data: { message: '연결할 숫자 열이 없습니다.' } } });
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('연결할 숫자 열이 없습니다.');
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe('원본 복사본');
  expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it('recovers an uncertain save with the same request id and locks edits', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce({ response: { status: 503 } });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  const body = api.post.mock.calls[1][1];
  expect(screen.getByLabelText('복사본 제목').matches(':disabled')).toBe(true);
  api.post.mockResolvedValueOnce(wrap({ id: 90, replayed: true }));
  fireEvent.click(screen.getByRole('button', { name: '같은 저장 요청 다시 확인' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/90'));
  expect(api.post.mock.calls[2][1]).toEqual(body);
});
it('409 preserves inputs and restores keyboard focus to another preview', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: '원본이 변경되었습니다.' } } });
  screen.getByRole('button', { name: '복사본 저장' }).focus();
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText('원본이 변경되었습니다.');
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '전체 미리보기' })));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.queryByText(/미리보기:/)).toBeNull();
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe('원본 복사본');
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(false);
});
it('ignores a source profile from the previous route', async () => {
  const view = await open();
  let resolve: any;
  api.get.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  api.id = '13';
  view.rerender(<DashboardReuse />);
  await waitFor(() =>
    expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(false),
  );
  await act(async () => resolve(wrap(profile(2))));
  expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('1');
});
it('malformed save response never navigates over the original', async () => {
  await open();
  await makePreview();
  api.post.mockResolvedValueOnce(wrap({ id: 12 }));
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(/저장 결과를 확인하지 못했습니다/);
  expect(api.navigate).not.toHaveBeenCalled();
});

it('shared origin never selects or profiles the owner source and requires my source', async () => {
  api.kind = 'publication';
  api.query = 'editor=studio';
  api.uuid = '11111111-1111-4111-8111-111111111111';
  api.get.mockImplementation(async (url: string) =>
    wrap(
      url.includes('/bi/reuse/')
        ? { ...original(), originalId: api.uuid, originalSourceId: undefined, sources: [{ id: 2, name: '내 소스' }] }
        : profile(2),
    ),
  );
  render(<DashboardReuse />);
  await screen.findByText('원본: 원본 · 내 소스를 선택해 주세요');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('link', { name: '원본 보기' }).getAttribute('href')).toBe('/published/' + api.uuid);
  expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('');
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('데이터 소스'), { target: { value: '2' } });
  await screen.findByLabelText('amount 연결');
  expect(screen.queryByText('원본: 원본 · 내 소스를 선택해 주세요')).toBeNull();
  fireEvent.change(screen.getByLabelText('amount 연결'), { target: { value: 'amount_new' } });
  fireEvent.change(screen.getByLabelText('os 연결'), { target: { value: 'os_new' } });
  api.post.mockResolvedValueOnce(wrap({ ...preview('원본 복사본', 2), originalId: api.uuid }));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('미리보기: 원본 복사본 · reuse');
  api.post.mockResolvedValueOnce(wrap({ id: 99 }));
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith('/dashboard/99'));
});

it('UC024 removes only explicitly excluded block requirements and invalidates preview on restore', async () => {
  api.get.mockImplementation(async (url: string) =>
    wrap(
      url.endsWith('/reuse')
        ? {
            ...original(),
            blocks: [
              { id: 'sales', title: '총 매출', columns: ['amount'] },
              { id: 'os', title: 'OS별 매출', columns: ['amount', 'os'] },
            ],
          }
        : { ...profile(), columns: [columns[0]] },
    ),
  );
  render(<DashboardReuse />);
  await screen.findByLabelText('OS별 매출 포함');
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('연결 필요: os')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('OS별 매출 포함'));
  api.post.mockResolvedValueOnce(wrap(preview()));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('미리보기: 원본 복사본 · reuse');
  expect(api.post.mock.calls[0][1]).toMatchObject({ blockIds: ['sales'], columnMap: { amount: 'amount' } });
  fireEvent.click(screen.getByLabelText('OS별 매출 포함'));
  expect(screen.queryByText(/미리보기:/)).toBeNull();
  expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('총 매출 포함'));
  fireEvent.click(screen.getByLabelText('OS별 매출 포함'));
  expect((screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement).disabled).toBe(true);
});

it.each([
  ['editor=studio', '/dashboard/90/studio', '/dashboard/12/studio'],
  ['editor=https%3A%2F%2Fexample.com', '/dashboard/90', '/dashboard/12'],
])('keeps the copy handoff bounded for %s', async (query, target, origin) => {
  api.query = query;
  await open();
  expect(screen.getByRole('link', { name: '원본 보기' }).getAttribute('href')).toBe(origin);
  if (query === 'editor=studio') expect(screen.getByText(/원본 Studio의 미저장 변경은 포함하지 않습니다/)).toBeTruthy();
  await makePreview();
  api.post.mockResolvedValueOnce(wrap({ id: 90 }));
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await waitFor(() => expect(api.navigate).toHaveBeenCalledWith(target));
});

it('preserves mapping and title after unit failure and sends only explicit same-unit confirmation', async () => {
  api.get.mockImplementation(async (url: string) =>
    wrap(url.endsWith('/reuse') ? { ...original(), currency: 'USD' } : profile()),
  );
  await open();
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { message: '새 파일의 금액 단위를 자동으로 확인할 수 없습니다.' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('새 파일의 금액 단위를 자동으로 확인할 수 없습니다.');
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe('원본 복사본');
  expect((screen.getByLabelText('amount 연결') as HTMLSelectElement).value).toBe('amount');
  fireEvent.click(screen.getByRole('checkbox', { name: /같은 USD 금액 단위/ }));
  api.post.mockResolvedValueOnce(wrap(preview()));
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  await screen.findByText('미리보기: 원본 복사본 · reuse');
  expect(api.post.mock.calls[1][1].unitConfirmation).toBe('same-unit');
});
it('prepares a private demo source without automatic preview, AI or dashboard save', async () => {
  api.query = 'editor=studio';
  api.get.mockImplementation(async (url: string) =>
    wrap(url.endsWith('/reuse') ? { ...original(), currency: 'USD' } : profile(url.includes('/2/') ? 2 : 1)),
  );
  await open();
  api.post.mockResolvedValueOnce({ data: { sourceId: 2, name: '새 USD 파일' } });
  fireEvent.click(screen.getByRole('button', { name: '정상 USD 파일' }));
  await waitFor(() => expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('2'));
  await waitFor(() => expect((screen.getByLabelText('amount 연결') as HTMLSelectElement).value).toBe(''));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0].slice(0, 2)).toEqual(['/studio/samples', { sample: 'margin-reuse' }]);
  expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(true);
});
it('explains a preview network failure and retains inputs for retry', async () => {
  await open();
  fireEvent.change(screen.getByLabelText('복사본 제목'), { target: { value: '보존한 제목' } });
  api.post.mockRejectedValueOnce({ code: 'ERR_NETWORK', message: 'Network Error', response: { status: 0 } });
  fireEvent.click(screen.getByRole('button', { name: '전체 미리보기' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    '서버에 연결하지 못했습니다. 연결을 확인한 뒤 다시 미리보기해 주세요. 입력은 유지됩니다.',
  );
  expect((screen.getByLabelText('복사본 제목') as HTMLInputElement).value).toBe('보존한 제목');
  expect((screen.getByLabelText('데이터 소스') as HTMLSelectElement).value).toBe('1');
  expect((screen.getByRole('button', { name: '복사본 저장' }) as HTMLButtonElement).disabled).toBe(true);
});

it('keeps the preview trigger focusable while rejecting duplicate pending requests', async () => {
  await open();
  let reject: (e: any) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const trigger = screen.getByRole('button', { name: '전체 미리보기' }) as HTMLButtonElement;
  trigger.focus();
  fireEvent.click(trigger);
  await waitFor(() => expect(trigger.getAttribute('aria-busy')).toBe('true'));
  expect(trigger.disabled).toBe(false);
  fireEvent.click(trigger);
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => reject({ code: 'ERR_NETWORK', message: 'Network Error', response: { status: 0 } }));
  await screen.findByRole('alert');
  expect(document.activeElement).toBe(trigger);
});

it('explains a missing chart setup on save in Korean without the raw server text', async () => {
  await open();
  await makePreview();
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { success: false, code: 400, data: 'chart component unavailable' } },
  });
  fireEvent.click(screen.getByRole('button', { name: '복사본 저장' }));
  await screen.findByText(CHART_SETUP_UNAVAILABLE_MESSAGE);
  expect(screen.queryByText('chart component unavailable')).toBeNull();
  expect(api.navigate).not.toHaveBeenCalled();
});
it('409 does not steal focus after the user moves to the original link', async () => {
  await open();
  await makePreview();
  let reject: (error: any) => void;
  api.post.mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const save = screen.getByRole('button', { name: '복사본 저장' });
  save.focus();
  fireEvent.click(save);
  const originalLink = screen.getByRole('link', { name: '원본 보기' });
  originalLink.focus();
  await act(async () => reject({ response: { status: 409, data: { message: '원본이 변경되었습니다.' } } }));
  await screen.findByText('원본이 변경되었습니다.');
  expect(document.activeElement).toBe(originalLink);
  expect(api.post).toHaveBeenCalledTimes(2);
});
