vi.mock('./DashboardPivots', () => ({ default: () => null }));
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PersonalSavedViews, { DateRange, resolveRelativePeriod, SavedViewState, validTimeZone } from './PersonalSavedViews';
import DashboardAnalysis from './DashboardAnalysis';
import { installRadixBrowserAPIs, selectRadixOption } from './dashboardTestUtils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn(), apply: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => ({ get: api.get, post: api.post, del: api.del }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./DashboardAssistant', () => ({
  default: ({ trendGrain, comparePrevious, disabled }: any) => (
    <aside
      data-testid="assistant"
      data-grain={trendGrain}
      data-compare={String(comparePrevious)}
      data-disabled={String(disabled)}
    >
      Assistant
    </aside>
  ),
}));
vi.mock('./MetricTrend', () => ({
  default: ({ comparison }: any) =>
    comparison ? <div data-testid="metric-comparison">{JSON.stringify(comparison)}</div> : null,
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: ({ widgetOption, description, dataSet }: any) => (
    <div data-testid="widget">
      {description} · {dataSet[0]?.requests} · {widgetOption.content?.numberNotation} · {JSON.stringify(dataSet)}
    </div>
  ),
}));
installRadixBrowserAPIs();

const revision = 'opaque-dashboard-revision';
const success = (data?: unknown) => ({ data: { status: 'SUCCESS', data } });
const state = (): SavedViewState => ({
  version: 1,
  filters: [],
  dateRange: null,
  relativePeriod: null,
  numberNotation: 'auto',
});
const row = (id = 1, viewState = state()) => ({
  id,
  name: `보기 ${id}`,
  state: viewState,
  revision,
  createdAt: '2026-10-13T00:00:00Z',
});
const props = () => ({ dashboardId: 3, revision, state: state(), onApply: api.apply });
const button = (name: string) => screen.getByRole('button', { name, exact: true });
const disabled = (name: string) => (button(name) as HTMLButtonElement).disabled;
const nameView = (name = '내 조건') =>
  fireEvent.change(screen.getByLabelText('저장 보기 이름'), { target: { value: name } });
const idle = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
function deferred() {
  let resolve: (result: unknown) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve: (result: unknown) => resolve(result), reject: (error: unknown) => reject(error) };
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.get.mockResolvedValue(success([row()]));
  api.post.mockResolvedValue(success(row(2)));
  api.del.mockResolvedValue(success());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const mount = async (overrides = {}) => {
  const result = render(<PersonalSavedViews {...props()} {...overrides} />);
  await screen.findByRole('button', { name: '보기 1 보기 불러오기' });
  return result;
};

it.each([
  [7, '2024-02-24'],
  [30, '2024-02-01'],
  [90, '2023-12-03'],
] as const)('resolves inclusive last %s days in UTC across the leap year and local offsets', (days, start) => {
  expect(resolveRelativePeriod({ column: 'created_at', days }, new Date('2024-03-01T09:30:00+09:00'))).toEqual({
    column: 'created_at',
    start,
    end: '2024-03-01',
  });
});

it('saves only view settings with all nullable keys, primitive filters and opaque revision, then lists the server row', async () => {
  const selected: SavedViewState = {
    ...state(),
    filters: [{ column: 'device', values: [null, true, 1, '1', 'a,b'] }],
    dateRange: { column: 'created_at', start: '2026-01-01', end: '2026-01-31' },
    numberNotation: 'full',
  };
  await mount({ state: { ...selected, draft: { sql: 'private' }, rows: [42], credentials: 'private' } });
  nameView('  개인 분석  ');
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '보기 2 보기 불러오기' });
  expect(api.post).toHaveBeenCalledWith(
    '/dashboard/3/views',
    { name: '개인 분석', state: selected, revision },
    { signal: expect.any(AbortSignal) },
  );
  expect(screen.getByLabelText('저장 보기 이름').getAttribute('maxlength')).toBe('80');
  expect((screen.getByLabelText('저장 보기 이름') as HTMLInputElement).value).toBe('');
  expect(localStorage.length).toBe(0);
  expect(api.apply).not.toHaveBeenCalled();
});

it('validates the name and caps the list and saves at twenty views', async () => {
  await mount();
  for (const name of ['  ', 'a'.repeat(81)]) {
    nameView(name);
    expect(disabled('현재 보기 저장')).toBe(true);
  }
  nameView('a'.repeat(80));
  expect(disabled('현재 보기 저장')).toBe(false);
  api.get.mockResolvedValueOnce(success(Array.from({ length: 20 }, (_, index) => row(index + 1))));
  fireEvent.click(button('저장 보기 목록 다시 불러오기'));
  await screen.findByRole('button', { name: '보기 20 보기 불러오기' });
  nameView();
  expect(screen.getAllByRole('listitem')).toHaveLength(20);
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});

it('loads details from the server and applies all settings once using the authoritative resolved relative dates', async () => {
  await mount();
  const relative: SavedViewState = {
    ...state(),
    filters: [{ column: 'device', values: ['Mobile', 1] }],
    relativePeriod: { column: 'created_at', days: 30 },
    numberNotation: 'compact',
  };
  const resolved = { column: 'created_at', start: '2026-09-14', end: '2026-10-13' };
  api.get.mockResolvedValueOnce(success({ ...row(1, relative), resolvedDateRange: resolved }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await waitFor(() => expect(api.apply).toHaveBeenCalledTimes(1));
  expect(api.get.mock.calls[1]).toEqual(['/dashboard/3/views/1', undefined, { signal: expect.any(AbortSignal) }]);
  expect(api.apply).toHaveBeenCalledWith(relative, resolved);
  expect(api.post).not.toHaveBeenCalled();
});

it.each([
  { resolvedDateRange: null },
  { resolvedDateRange: { column: 'wrong', start: '2026-01-01', end: '2026-01-07' } },
  { resolvedDateRange: { column: 'created_at', start: '2026-02-30', end: '2026-03-01' } },
])('does not apply relative views with missing or invalid resolved dates: %j', async result => {
  await mount();
  api.get.mockResolvedValueOnce(
    success({ ...row(1, { ...state(), relativePeriod: { column: 'created_at', days: 7 } }), ...result }),
  );
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByRole('alert');
  expect(api.apply).not.toHaveBeenCalled();
});

it('retains stale views on 409, renders server text safely, and allows explicit list retry', async () => {
  await mount();
  const message = '정의가 바뀌었습니다. <img src=x onerror=alert(1)>';
  api.get.mockRejectedValueOnce({ response: { status: 409, data: { data: message } } });
  fireEvent.click(button('보기 1 보기 불러오기'));
  const alert = await screen.findByRole('alert');
  expect(alert.textContent).toContain('보기는 삭제되지 않았습니다.');
  expect(alert.textContent).toContain(message);
  expect(alert.querySelector('img')).toBeNull();
  expect(api.apply).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
  fireEvent.click(button('저장 보기 목록 다시 불러오기'));
  await waitFor(() => expect(disabled('보기 1 보기 불러오기')).toBe(false));
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each([
  { revision: undefined },
  { disabledReason: '현재 조회 중' },
  { disabledReason: '조회 오류' },
  { disabledReason: '날짜 미적용' },
])('blocks save/load for missing revision or invalid screen state: %j', async blocked => {
  await mount(blocked);
  nameView();
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
  fireEvent.click(button('보기 1 보기 불러오기'));
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.apply).not.toHaveBeenCalled();
});

it('rejects changed revisions and malformed view states without applying or deleting them', async () => {
  await mount();
  api.get.mockResolvedValueOnce(success({ ...row(), revision: 'old' }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText(/대시보드 정의가 변경되어/);
  fireEvent.click(button('저장 보기 목록 다시 불러오기'));
  await waitFor(() => expect(disabled('보기 1 보기 불러오기')).toBe(false));
  api.get.mockResolvedValueOnce(success({ ...row(), state: { ...state(), relativePeriod: undefined } }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('저장 보기의 조건을 확인할 수 없습니다. 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
  expect(api.del).not.toHaveBeenCalled();
});

it('locks requests, discards a late load after the current conditions change, and aborts on dashboard change', async () => {
  const view = await mount();
  const request = deferred();
  api.get.mockReturnValueOnce(request.promise);
  fireEvent.click(button('보기 1 보기 불러오기'));
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
  fireEvent.click(button('보기 1 보기 불러오기'));
  expect(api.get).toHaveBeenCalledTimes(2);
  view.rerender(<PersonalSavedViews {...props()} disabledReason="날짜 미적용" />);
  await act(async () => request.resolve(success(row())));
  await screen.findByText('화면 조건이 바뀌었습니다. 저장 보기를 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
  view.rerender(<PersonalSavedViews {...props()} />);
  const stale = deferred();
  api.get.mockReturnValueOnce(stale.promise);
  fireEvent.click(button('보기 1 보기 불러오기'));
  const signal = api.get.mock.lastCall[2].signal;
  api.get.mockResolvedValueOnce(success([row(4)]));
  view.rerender(<PersonalSavedViews {...props()} dashboardId={4} />);
  await screen.findByRole('button', { name: '보기 4 보기 불러오기' });
  expect(signal.aborted).toBe(true);
  await act(async () => stale.resolve(success(row())));
  expect(api.apply).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: '보기 1 보기 불러오기' })).toBeNull();
});

it('requires the delete dialog, restores trigger focus on Escape, and uses a fallback after deletion', async () => {
  await mount();
  const remove = button('보기 1 보기 삭제');
  remove.focus();
  fireEvent.click(remove);
  const dialog = screen.getByRole('dialog', { name: '개인 저장 보기 삭제' });
  expect(within(dialog).getByText(/보기 1 보기를 삭제할까요/)).not.toBeNull();
  expect(api.del).not.toHaveBeenCalled();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  // Radix FocusScope는 닫힘 뒤 다음 tick에 런처로 포커스를 되돌린다.
  await waitFor(() => expect(document.activeElement).toBe(remove));
  fireEvent.click(remove);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));
  await screen.findByText('개인 저장 보기를 삭제했습니다.');
  expect(api.del).toHaveBeenCalledWith('/dashboard/3/views/1', { signal: expect.any(AbortSignal) });
  expect(screen.queryByRole('button', { name: '보기 1 보기 불러오기' })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(button('저장 보기 목록 다시 불러오기')));
});

it('keeps a failed delete dialog for retry without removing the view', async () => {
  await mount();
  // 모달이 열린 동안에는 배경이 aria-hidden이므로 런처는 미리 참조해 둔다.
  const remove = button('보기 1 보기 삭제');
  fireEvent.click(remove);
  api.del.mockRejectedValueOnce({ response: { data: { message: '삭제 실패' } } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe('삭제 실패'));
  expect((remove as HTMLButtonElement).disabled).toBe(false);
  expect(document.activeElement).toBe(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '삭제 확인' }));
  await screen.findByText('개인 저장 보기를 삭제했습니다.');
  expect(api.del).toHaveBeenCalledTimes(2);
});

it('retries list errors, rejects failed success envelopes, and displays only the readable data revision', async () => {
  api.get.mockRejectedValueOnce({ response: { data: { message: '목록 오류' } } });
  render(<PersonalSavedViews {...props()} sourceRevision={'a'.repeat(64)} />);
  await screen.findByText('목록 오류');
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(screen.getByText('데이터 버전: aaaaaaaaaaaa')).not.toBeNull();
  fireEvent.click(button('저장 보기 목록 다시 불러오기'));
  await screen.findByRole('button', { name: '보기 1 보기 불러오기' });
  api.get.mockResolvedValueOnce({ data: { status: 'ERROR', data: '보기 조회 오류' } });
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 조회 오류');
  expect(api.apply).not.toHaveBeenCalled();
});

const draft = { databaseId: 3, widgets: [], revision };
const preview = {
  widgets: [
    { type: 'BOARD_NUMERIC', title: '요청', valueField: 'requests', datas: [{ requests: 42 }], numberNotation: 'compact' },
  ],
  dimensions: [{ column: 'device', values: ['Mobile', true, null, 1] }],
  temporalColumns: [{ column: 'created_at' }],
  sourceRevision: 'b'.repeat(64),
};
const previewCalls = () => api.post.mock.calls.filter(([url]) => url === '/ai/dashboard-preview');
const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
// 실제 구현의 집계 단위·최근 기간 컨트롤은 Radix Select이므로 트리거를 열고 옵션을 골라야 한다.
const grainLabels = { auto: '자동', day: '일별', week: '주별', month: '월별' } as const;
const chooseGrain = (grain: keyof typeof grainLabels) =>
  selectRadixOption(screen.getByRole('combobox', { name: '시계열 집계 단위' }), grainLabels[grain]);
const chooseRecentDays = (days: number) =>
  selectRadixOption(screen.getByRole('combobox', { name: /^최근 기간/ }), `최근 ${days}일`);
async function analysis() {
  api.get.mockImplementation(async (url: string) =>
    url.startsWith('/ai/dashboard-analysis') ? success(draft) : url.endsWith('/views') ? success([row()]) : success(row()),
  );
  api.post.mockImplementation(async (url: string, body: any) =>
    url === '/ai/dashboard-preview' ? success(preview) : success({ ...row(2, body.state), name: body.name }),
  );
  const view = render(
    <DashboardAnalysis dashboardId={3} revision={1} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByTestId('widget');
  await idle();
  await waitFor(() => expect(disabled('보기 1 보기 불러오기')).toBe(false));
  return view;
}

it.each([7, 30, 90] as const)(
  'requests and saves the explicit recent %s UTC days while keeping absolute inputs visible',
  async days => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2024-03-01T00:30:00Z'));
    await analysis();
    await chooseRecentDays(days);
    fireEvent.click(button('최근 기간 적용'));
    await idle();
    const range = resolveRelativePeriod({ column: 'created_at', days });
    expect(previewCalls().at(-1)[1].dateRange).toEqual(range);
    expect((screen.getByLabelText('시작일 (UTC)') as HTMLInputElement).value).toBe(range.start);
    expect((screen.getByLabelText('종료일 (UTC)') as HTMLInputElement).value).toBe(range.end);
    nameView();
    fireEvent.click(button('현재 보기 저장'));
    await screen.findByRole('button', { name: '내 조건 보기 불러오기' });
    expect(api.post.mock.lastCall[1]).toEqual({
      name: '내 조건',
      state: { ...state(), relativePeriod: { column: 'created_at', days }, trendGrain: 'auto', comparePrevious: false },
      revision,
    });
  },
);

it('blocks saving/loading unapplied absolute date edits and clears the relative expression on edits and reset', async () => {
  await analysis();
  fireEvent.click(button('최근 기간 적용'));
  await idle();
  nameView();
  choose('시작일 (UTC)', '2020-01-01');
  expect(screen.getByText(/입력한 날짜를 적용하거나 초기화/)).not.toBeNull();
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
  fireEvent.click(button('적용'));
  await idle();
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '내 조건 보기 불러오기' });
  expect(api.post.mock.lastCall[1].state.relativePeriod).toBeNull();
  expect(api.post.mock.lastCall[1].state.dateRange.start).toBe('2020-01-01');
  fireEvent.click(button('최근 기간 적용'));
  await idle();
  fireEvent.click(button('필터 초기화'));
  await idle();
  nameView('초기화');
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '초기화 보기 불러오기' });
  expect(api.post.mock.lastCall[1].state).toEqual({ ...state(), trendGrain: 'auto', comparePrevious: false });
});

it('allows saving all time after explicitly clearing and applying a previously relative date range', async () => {
  await analysis();
  fireEvent.click(button('최근 기간 적용'));
  await idle();
  choose('시작일 (UTC)', '');
  choose('종료일 (UTC)', '');
  nameView();
  expect(disabled('현재 보기 저장')).toBe(true);
  fireEvent.click(button('적용'));
  await idle();
  expect(disabled('현재 보기 저장')).toBe(false);
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '내 조건 보기 불러오기' });
  expect(api.post.mock.lastCall[1].state).toEqual({ ...state(), trendGrain: 'auto', comparePrevious: false });
  expect(previewCalls().at(-1)[1]).not.toHaveProperty('dateRange');
});

it('atomically loads filters, resolved dates and notation, preserves the definition, and respects notation storage', async () => {
  localStorage.setItem('dashboard-number-notation:3', 'full');
  await analysis();
  expect(screen.getByTestId('widget').textContent).toContain('full');
  const selected: SavedViewState = {
    ...state(),
    filters: [{ column: 'device', values: ['Mobile', true, null, 1] }],
    relativePeriod: { column: 'created_at', days: 7 },
    numberNotation: 'compact',
  };
  const range = { column: 'created_at', start: '2026-10-01', end: '2026-10-07' };
  api.get.mockResolvedValueOnce(success({ ...row(1, selected), resolvedDateRange: range }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 1 보기를 적용했습니다.');
  await idle();
  expect(previewCalls()).toHaveLength(2);
  expect(previewCalls()[1][1]).toEqual({
    draft,
    dashboardId: 3,
    includeTrends: true,
    trendGrain: 'auto',
    comparePrevious: false,
    filters: selected.filters,
    dateRange: range,
  });
  expect((screen.getByLabelText('시작일 (UTC)') as HTMLInputElement).value).toBe(range.start);
  expect((screen.getByLabelText('종료일 (UTC)') as HTMLInputElement).value).toBe(range.end);
  expect(localStorage.getItem('dashboard-number-notation:3')).toBe('compact');
  expect(screen.getByTestId('widget').textContent).toContain('compact');
  expect(api.post.mock.calls.every(([url]) => url === '/ai/dashboard-preview')).toBe(true);
});

it('keeps one saved-view region across filter, date, pending and error state changes beside Assistant', async () => {
  await analysis();
  const single = () => expect(screen.getAllByRole('region', { name: '개인 저장 보기' })).toHaveLength(1);
  single();
  for (const day of ['2026-01-01', '2026-01-02', '2026-01-03']) {
    choose('시작일 (UTC)', day);
    single();
  }
  choose('종료일 (UTC)', '2026-01-31');
  fireEvent.click(button('적용'));
  await idle();
  single();
  const request = deferred();
  api.post.mockReturnValueOnce(request.promise);
  fireEvent.click(button('최근 기간 적용'));
  single();
  await screen.findByRole('progressbar');
  single();
  await act(async () => request.reject(new Error('공통 필터 조회 오류')));
  await screen.findByText('공통 필터 조회 오류');
  single();
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
  fireEvent.click(button('전체 데이터로 복구'));
  await idle();
  single();
  expect(screen.getAllByRole('complementary')).toHaveLength(1);
});

it('blocks saved views until the analysis draft revision is available', async () => {
  api.get.mockImplementation(async (url: string) =>
    url.startsWith('/ai/dashboard-analysis') ? success({ ...draft, revision: undefined }) : success([row()]),
  );
  api.post.mockResolvedValue(success(preview));
  render(
    <DashboardAnalysis dashboardId={3} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByTestId('widget');
  await idle();
  await screen.findByRole('button', { name: '보기 1 보기 불러오기' });
  nameView();
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
});

const comparisonToggle = () => screen.getByRole('checkbox', { name: '이전 기간 비교' }) as HTMLInputElement;
const appliedRange = { column: 'created_at', start: '2026-01-11', end: '2026-01-12' };
async function applyComparisonDates() {
  choose('시작일 (UTC)', appliedRange.start);
  choose('종료일 (UTC)', appliedRange.end);
  fireEvent.click(button('적용'));
  await idle();
}

it.each(['day', 'week', 'month'] as const)(
  'period comparison sends %s grain with applied dates and preserves Assistant access',
  async grain => {
    await analysis();
    expect(previewCalls().at(-1)[1]).toMatchObject({ trendGrain: 'auto', comparePrevious: false });
    expect(comparisonToggle().disabled).toBe(true);
    await applyComparisonDates();
    await chooseGrain(grain);
    await idle();
    fireEvent.click(comparisonToggle());
    await idle();
    expect(previewCalls().at(-1)[1]).toMatchObject({
      trendGrain: grain,
      comparePrevious: true,
      dateRange: appliedRange,
      filters: [],
    });
    expect(disabled('Assistant')).toBe(false);
    expect(screen.getByTestId('assistant').dataset).toMatchObject({ grain, compare: 'true', disabled: 'false' });
    expect(screen.getByText(/선택 범위에 걸친 주·월은 범위 안의 데이터만 집계합니다/)).toBeTruthy();
  },
);

it.each(['clear', 'reset'] as const)('period comparison %s disables comparison and resets grain to auto', async action => {
  await analysis();
  await applyComparisonDates();
  await chooseGrain('week');
  await idle();
  fireEvent.click(comparisonToggle());
  await idle();
  choose('시작일 (UTC)', '2026-01-10');
  expect(comparisonToggle().disabled).toBe(true);
  expect(disabled('현재 보기 저장')).toBe(true);
  if (action === 'clear') {
    choose('시작일 (UTC)', '');
    choose('종료일 (UTC)', '');
    fireEvent.click(button('적용'));
  } else fireEvent.click(button('필터 초기화'));
  await idle();
  const body = previewCalls().at(-1)[1];
  expect(body).toMatchObject({ trendGrain: 'auto', comparePrevious: false });
  expect(body).not.toHaveProperty('dateRange');
  expect(comparisonToggle().getAttribute('aria-checked')).toBe('false');
  expect(comparisonToggle().disabled).toBe(true);
});

it('period comparison saves whitelisted new settings with relative dates and no definition or data', async () => {
  const selected = {
    ...state(),
    relativePeriod: { column: 'created_at', days: 30 as const },
    trendGrain: 'month' as const,
    comparePrevious: true,
  };
  await mount({ state: { ...selected, draft: { sql: 'private' }, rows: [42], credentials: 'private' } });
  nameView();
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '보기 2 보기 불러오기' });
  expect(api.post.mock.calls[0][1]).toEqual({ name: '내 조건', state: selected, revision });
});

it.each([
  ['new', { trendGrain: 'week' as const, comparePrevious: true }],
  ['legacy', {} as Pick<SavedViewState, 'trendGrain' | 'comparePrevious'>],
])('period comparison atomically loads %s view settings and server resolved dates', async (_name, extra) => {
  await analysis();
  await applyComparisonDates();
  await chooseGrain('month');
  await idle();
  fireEvent.click(comparisonToggle());
  await idle();
  const selected = {
    ...state(),
    filters: [{ column: 'device', values: ['Mobile'] }],
    relativePeriod: { column: 'created_at', days: 30 as const },
    numberNotation: 'compact' as const,
    ...extra,
  };
  api.get.mockResolvedValueOnce(success({ ...row(1, selected), resolvedDateRange: appliedRange }));
  const before = previewCalls().length;
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 1 보기를 적용했습니다.');
  await idle();
  expect(previewCalls()).toHaveLength(before + 1);
  expect(previewCalls().at(-1)[1]).toMatchObject({
    filters: selected.filters,
    dateRange: appliedRange,
    trendGrain: extra.trendGrain ?? 'auto',
    comparePrevious: extra.comparePrevious ?? false,
  });
  expect(localStorage.getItem('dashboard-number-notation:3')).toBe('compact');
  expect(screen.getByRole('combobox', { name: '시계열 집계 단위' }).textContent).toBe(
    grainLabels[(extra.trendGrain ?? 'auto') as keyof typeof grainLabels],
  );
  expect(comparisonToggle().getAttribute('aria-checked')).toBe(String(extra.comparePrevious ?? false));
});

it.each([{ trendGrain: 'year' }, { comparePrevious: 'true' }, { comparePrevious: true }])(
  'period comparison rejects invalid saved settings %j before apply',
  async invalid => {
    await mount();
    api.get.mockResolvedValueOnce(success(row(1, { ...state(), ...invalid } as SavedViewState)));
    fireEvent.click(button('보기 1 보기 불러오기'));
    await screen.findByText('저장 보기의 조건을 확인할 수 없습니다. 다시 불러와 주세요.');
    expect(api.apply).not.toHaveBeenCalled();
  },
);

it('period comparison renders authoritative dates, KPI comparison and actual previous chart dates with no fill', async () => {
  await analysis();
  await applyComparisonDates();
  const comparison = { previousValue: 10, delta: 40, percentChange: 400 };
  api.post.mockResolvedValueOnce(
    success({
      ...preview,
      comparison: { current: appliedRange, previous: { column: 'created_at', start: '2026-01-09', end: '2026-01-10' } },
      widgets: [
        { ...preview.widgets[0], comparison },
        {
          title: '일별 매출',
          type: 'CHART_LINE',
          categoryField: 'day',
          valueField: 'amount',
          datas: [{ day: '2026-01-11', amount: 20 }],
          previousDatas: [{ day: '2026-01-10', amount: 10 }],
          trendGrain: 'week',
        },
      ],
    }),
  );
  fireEvent.click(comparisonToggle());
  await idle();
  expect(screen.getByText('이전 기간: created_at · 2026-01-09 ~ 2026-01-10 (UTC)')).toBeTruthy();
  expect(screen.getByTestId('metric-comparison').textContent).toBe(JSON.stringify(comparison));
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="card"]'));
  expect(cards).toHaveLength(2);
  // 기간 비교로 늘어난 내용이 잘리지 않도록 카드는 고정 height 없이 minHeight만 사용한다.
  expect(cards.every(card => card.style.height === '')).toBe(true);
  expect(cards.every(card => card.style.minHeight !== '')).toBe(true);
  expect(screen.getByText(/적용된 집계 단위: 주별/)).toBeTruthy();
  const table = screen.getByRole('table', { hidden: true });
  expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(2);
  expect(within(table).getByText('2026-01-10')).toBeTruthy();
  expect(screen.getAllByTestId('widget')[1].textContent).toContain('"amount":20');
});

it('period comparison shows unsupported grain and previous limit messages while retaining original data', async () => {
  await analysis();
  api.post.mockResolvedValueOnce(
    success({
      ...preview,
      widgets: [
        {
          title: '원본',
          type: 'CHART_LINE',
          categoryField: 'day',
          valueField: 'amount',
          datas: [{ day: '2026-01-11', amount: 20 }],
          grainUnavailable: '지원하지 않는 SQL입니다.',
          previousUnavailable: '이전 기간 행 수 제한입니다.',
        },
      ],
    }),
  );
  await chooseGrain('week');
  await idle();
  expect(screen.getByText(/선택한 집계 단위를 적용하지 못했습니다/).textContent).toContain('지원하지 않는 SQL입니다.');
  expect(screen.getByText(/이전 기간 결과를 표시할 수 없습니다/).textContent).toContain('이전 기간 행 수 제한입니다.');
  expect(screen.getByTestId('widget').textContent).toContain('"amount":20');
  expect(screen.queryByText(/적용된 집계 단위/)).toBeNull();
});

it.each(['grain', 'comparison'] as const)(
  'pending focus keeps %s enabled and focused, accepts another commit and ignores the stale response',
  async kind => {
    await analysis();
    await applyComparisonDates();
    const first = deferred();
    const latest = deferred();
    api.post.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    const control = (kind === 'grain' ? screen.getByLabelText('시계열 집계 단위') : comparisonToggle()) as
      | HTMLSelectElement
      | HTMLInputElement;
    control.focus();
    if (kind === 'grain') await chooseGrain('day');
    else fireEvent.click(control);
    await screen.findByRole('progressbar');
    expect(control.disabled).toBe(false);
    // Radix Select는 닫힘 뒤 트리거로 포커스를 되돌리며 그 시점은 다음 tick이다.
    await waitFor(() => expect(document.activeElement).toBe(control));
    expect(disabled('현재 보기 저장')).toBe(true);
    if (kind === 'grain') await chooseGrain('week');
    else fireEvent.click(control);
    expect(control.disabled).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(control));
    expect(previewCalls().at(-1)[1]).toMatchObject({
      dateRange: appliedRange,
      trendGrain: kind === 'grain' ? 'week' : 'auto',
      comparePrevious: false,
    });
    await act(async () =>
      latest.resolve(
        success({
          ...preview,
          widgets: [{ ...preview.widgets[0], datas: [{ requests: 84 }] }],
        }),
      ),
    );
    await idle();
    expect(screen.getByTestId('widget').textContent).toContain('"requests":84');
    expect(document.activeElement).toBe(control);
    await act(async () =>
      first.resolve(
        success({
          ...preview,
          widgets: [{ ...preview.widgets[0], datas: [{ requests: 999 }] }],
        }),
      ),
    );
    expect(screen.getByTestId('widget').textContent).toContain('"requests":84');
    expect(screen.getByTestId('widget').textContent).not.toContain('999');
    expect(document.activeElement).toBe(control);
  },
);

const selectedHour: DateRange = {
  column: 'created_at',
  start: '2026-01-11T10:00:00Z',
  end: '2026-01-11T11:00:00Z',
  precision: 'timestamp',
};
it('time bucket saves only the timestamp range whitelist including precision', async () => {
  const selected: SavedViewState = { ...state(), dateRange: selectedHour, trendGrain: 'day', comparePrevious: true };
  await mount({ state: { ...selected, dateRange: { ...selectedHour, rawRows: [1], sql: 'private' } } });
  nameView();
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '보기 2 보기 불러오기' });
  expect(api.post.mock.calls[0][1]).toEqual({ name: '내 조건', state: selected, revision });
});

it('time bucket loads exact timestamp precision instead of flattening it to days', async () => {
  await mount();
  const selected: SavedViewState = { ...state(), dateRange: selectedHour, comparePrevious: true };
  api.get.mockResolvedValueOnce(success(row(1, selected)));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 1 보기를 적용했습니다.');
  expect(api.apply).toHaveBeenCalledWith(selected, selectedHour);
});

it.each([
  { ...selectedHour, precision: 'day' },
  { ...selectedHour, start: '2026-01-11T10:00:00+00:00' },
  { ...selectedHour, start: '2026-02-30T10:00:00Z' },
  { ...selectedHour, start: '2026-01-11T10:00:00.000Z' },
  { ...selectedHour, end: selectedHour.start },
  { ...selectedHour, start: selectedHour.end, end: selectedHour.start },
])('time bucket rejects malformed saved timestamp range %j before applying', async dateRange => {
  await mount();
  api.get.mockResolvedValueOnce(success(row(1, { ...state(), dateRange } as SavedViewState)));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('저장 보기의 조건을 확인할 수 없습니다. 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
});

it('time bucket rejects a timestamp resolution for an inclusive relative day expression', async () => {
  await mount();
  const selected = { ...state(), relativePeriod: { column: 'created_at', days: 7 as const } };
  api.get.mockResolvedValueOnce(success({ ...row(1, selected), resolvedDateRange: selectedHour }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('서버에서 상대 기간을 확인하지 못했습니다. 저장 보기를 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
});

it('time bucket applied saved hour keeps date inputs usable and preserves precision through later category changes and save', async () => {
  await analysis();
  const selected: SavedViewState = {
    ...state(),
    dateRange: selectedHour,
    filters: [{ column: 'device', values: ['Mobile'] }],
    trendGrain: 'week',
    comparePrevious: true,
    numberNotation: 'compact',
  };
  api.get.mockResolvedValueOnce(success(row(1, selected)));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 1 보기를 적용했습니다.');
  await idle();
  expect(previewCalls().at(-1)[1]).toMatchObject({ dateRange: selectedHour, trendGrain: 'week', comparePrevious: true });
  expect(screen.getByLabelText('시작일 (UTC)')).toHaveProperty('value', '2026-01-11');
  expect(screen.getByLabelText('종료일 (UTC)')).toHaveProperty('value', '2026-01-11');
  expect(disabled('보기 1 보기 불러오기')).toBe(false);
  // Clear the active category while keeping the hour boundary.
  fireEvent.click(screen.getByRole('button', { name: /device: Mobile .*공통 필터 해제/ }));
  await idle();
  nameView();
  expect(disabled('현재 보기 저장')).toBe(false);
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '내 조건 보기 불러오기' });
  expect(api.post.mock.lastCall[1].state).toEqual({ ...selected, filters: [] });
  expect(localStorage.getItem('dashboard-number-notation:3')).toBe('compact');
  expect(disabled('선택한 기간 되돌리기')).toBe(false);
  choose('시작일 (UTC)', '2026-01-10');
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(disabled('보기 1 보기 불러오기')).toBe(true);
});

it('accepts UTC and real region names while rejecting malformed or unknown zones', () => {
  expect(validTimeZone('UTC')).toBe(true);
  expect(validTimeZone('Asia/Seoul')).toBe(true);
  expect(validTimeZone('America/Argentina/Buenos_Aires')).toBe(true);
  expect(validTimeZone('invalid')).toBe(false);
  expect(validTimeZone('Invalid/Zone')).toBe(false);
  expect(validTimeZone('')).toBe(false);
  expect(validTimeZone(undefined)).toBe(false);
});

it('treats an omitted relative timezone as the legacy UTC default', () => {
  const instant = new Date('2024-03-01T15:30:00Z');
  expect(resolveRelativePeriod({ column: 'created_at', days: 30 }, instant)).toEqual({
    ...resolveRelativePeriod({ column: 'created_at', days: 30, timeZone: 'UTC' }, instant),
    timeZone: undefined,
  });
});

it.each([
  ['Asia/Seoul', '2024-03-01T15:30:00Z', '2024-02-25', '2024-03-02'],
  ['America/New_York', '2024-03-01T04:30:00Z', '2024-02-23', '2024-02-29'],
  ['UTC', '2024-03-01T15:30:00Z', '2024-02-24', '2024-03-01'],
] as const)('resolves inclusive days in the %s calendar independent of the host', (timeZone, instant, start, end) => {
  expect(resolveRelativePeriod({ column: 'created_at', days: 7, timeZone }, new Date(instant))).toEqual({
    column: 'created_at',
    start,
    end,
    timeZone,
  });
});

it('preserves the date range timezone through the save whitelist without leaking extra keys', async () => {
  const selected: SavedViewState = {
    ...state(),
    dateRange: { column: 'created_at', start: '2026-01-01', end: '2026-01-31', timeZone: 'Asia/Seoul' },
    numberNotation: 'full',
  };
  await mount({
    state: { ...selected, dateRange: { ...selected.dateRange, rawRows: [1], sql: 'private', credentials: 'x' } },
  });
  nameView();
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '보기 2 보기 불러오기' });
  expect(api.post.mock.calls[0][1]).toEqual({ name: '내 조건', state: selected, revision });
});

it('preserves the relative period timezone through the save whitelist', async () => {
  const selected: SavedViewState = {
    ...state(),
    relativePeriod: { column: 'created_at', days: 30, timeZone: 'America/New_York' },
    trendGrain: 'week',
    comparePrevious: true,
  };
  await mount({
    state: { ...selected, relativePeriod: { ...selected.relativePeriod, rows: [42], sql: 'private' } },
  });
  nameView();
  fireEvent.click(button('현재 보기 저장'));
  await screen.findByRole('button', { name: '보기 2 보기 불러오기' });
  expect(api.post.mock.calls[0][1]).toEqual({ name: '내 조건', state: selected, revision });
});

it.each([
  { dateRange: { column: 'created_at', start: '2026-01-01', end: '2026-01-31', timeZone: 'Invalid/Zone' } },
  { dateRange: { column: 'created_at', start: '2026-01-01', end: '2026-01-31', timeZone: 'Asia Seoul' } },
  { relativePeriod: { column: 'created_at', days: 7 as const, timeZone: 'GMT+9' } },
])('rejects a saved state with a malformed timezone before applying: %j', async over => {
  await mount();
  api.get.mockResolvedValueOnce(success(row(1, { ...state(), ...over } as SavedViewState)));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('저장 보기의 조건을 확인할 수 없습니다. 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
});

it.each([
  { column: 'created_at', start: '2026-09-14', end: '2026-10-13' },
  { column: 'created_at', start: '2026-09-14', end: '2026-10-13', timeZone: 'UTC' },
  { column: 'created_at', start: '2026-09-14', end: '2026-10-13', timeZone: 'America/New_York' },
])('refuses a relative view whose resolved range timezone does not match the saved period: %j', async resolved => {
  await mount();
  const relative = {
    ...state(),
    relativePeriod: { column: 'created_at', days: 30 as const, timeZone: 'Asia/Seoul' },
  };
  api.get.mockResolvedValueOnce(success({ ...row(1, relative), resolvedDateRange: resolved }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('서버에서 상대 기간을 확인하지 못했습니다. 저장 보기를 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
});

it('applies a relative view when the resolved range carries the matching timezone', async () => {
  await mount();
  const relative = {
    ...state(),
    relativePeriod: { column: 'created_at', days: 30 as const, timeZone: 'Asia/Seoul' },
  };
  const resolved = { column: 'created_at', start: '2026-09-14', end: '2026-10-13', timeZone: 'Asia/Seoul' };
  api.get.mockResolvedValueOnce(success({ ...row(1, relative), resolvedDateRange: resolved }));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText('보기 1 보기를 적용했습니다.');
  expect(api.apply).toHaveBeenCalledWith(relative, resolved);
});

it('exploration endpoint preserves its validated range/sort settings for save and load', async () => {
  const { parseExploreViewState } = await import('@/pages/Explore/exploreViewState');
  const exploreState = {
    version: 1 as const,
    measureIds: [1],
    dimensionColumns: ['device'],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'delta' as const, direction: 'asc' as const },
    filters: [{ column: 'amount', range: { min: 0, max: 10 } }],
    dateRange: { column: 'day', start: '2023-09-10', end: '2023-09-11' },
    relativePeriod: null,
    trendGrain: 'day' as const,
    comparePrevious: true,
    includeRows: false,
  };
  const saved = { ...row(), state: exploreState };
  api.get.mockResolvedValue(success([saved]));
  api.post.mockResolvedValue(success(saved));
  render(
    <PersonalSavedViews
      endpoint="/bi/explore/3/views"
      subject="explore"
      state={exploreState}
      revision={revision}
      parseState={parseExploreViewState}
      onApply={api.apply}
    />,
  );
  await screen.findByRole('button', { name: '보기 1 보기 불러오기' });
  nameView();
  fireEvent.click(button('현재 보기 저장'));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/bi/explore/3/views',
      { name: '내 조건', state: exploreState, revision },
      expect.anything(),
    ),
  );
  await waitFor(() => expect(disabled('보기 1 보기 불러오기')).toBe(false));
  api.get.mockResolvedValue(success(saved));
  fireEvent.click(button('보기 1 보기 불러오기'));
  await waitFor(() => expect(api.apply).toHaveBeenCalledWith(exploreState, exploreState.dateRange));
  expect(api.get).toHaveBeenLastCalledWith('/bi/explore/3/views/1', undefined, expect.anything());
});

it('exploration 409 leaves current state and saved row available for deletion', async () => {
  const { parseExploreViewState } = await import('@/pages/Explore/exploreViewState');
  const exploreState = {
    version: 1 as const,
    measureIds: [1],
    dimensionColumns: [],
    rankingMeasureId: 1,
    leaderboardSort: { by: 'value' as const, direction: 'desc' as const },
    filters: [],
    dateRange: null,
    relativePeriod: null,
    trendGrain: 'day' as const,
    comparePrevious: false,
    includeRows: false,
  };
  api.get.mockResolvedValue(success([{ ...row(), state: exploreState }]));
  render(
    <PersonalSavedViews
      endpoint="/bi/explore/3/views"
      subject="explore"
      state={exploreState}
      revision={revision}
      parseState={parseExploreViewState}
      onApply={api.apply}
    />,
  );
  await screen.findByRole('button', { name: '보기 1 보기 불러오기' });
  api.get.mockRejectedValue({ response: { status: 409 } });
  fireEvent.click(button('보기 1 보기 불러오기'));
  await screen.findByText(/지표·열 정의가 변경되어/);
  expect(api.apply).not.toHaveBeenCalled();
  expect(disabled('보기 1 보기 삭제')).toBe(false);
  fireEvent.click(button('보기 1 보기 삭제'));
  const dialog = screen.getByRole('dialog', { name: '개인 저장 보기 삭제' });
  expect(within(dialog).queryByRole('alert')).toBeNull();
  expect(api.del).not.toHaveBeenCalled();
});

it('allows loading saved conditions when only save readiness is blocked', async () => {
  api.get.mockImplementation(async (url: string) => success(url.endsWith('/1') ? row() : [row()]));
  await mount({ saveDisabledReason: '현재 집계를 먼저 적용해 주세요.' });
  nameView();
  expect(disabled('현재 보기 저장')).toBe(true);
  expect(disabled('보기 1 보기 불러오기')).toBe(false);
  fireEvent.click(button('보기 1 보기 불러오기'));
  await waitFor(() => expect(api.apply).toHaveBeenCalledTimes(1));
});

it('does not apply a delayed load after a partial date edit blocks restoration', async () => {
  const pending = deferred();
  api.get.mockImplementation((url: string) => (url.endsWith('/1') ? pending.promise : Promise.resolve(success([row()]))));
  const view = await mount({ saveDisabledReason: '집계 적용 전' });
  fireEvent.click(button('보기 1 보기 불러오기'));
  view.rerender(<PersonalSavedViews {...props()} disabledReason="기간 입력 중" saveDisabledReason="집계 적용 전" />);
  await act(async () => pending.resolve(success(row())));
  await screen.findByText('화면 조건이 바뀌었습니다. 저장 보기를 다시 불러와 주세요.');
  expect(api.apply).not.toHaveBeenCalled();
});
