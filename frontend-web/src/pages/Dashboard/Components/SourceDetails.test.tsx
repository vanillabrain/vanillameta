import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceDetails, {
  ContributionRequest,
  canRequestNextPage,
  validPreviousContributionRange,
  sameContributionDateRange,
} from './SourceDetails';
import DashboardAnalysis from './DashboardAnalysis';
import { classNamesOf, installRadixBrowserAPIs, selectRadixOption } from './dashboardTestUtils';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), widget: vi.fn(), trend: vi.fn(), previous: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./DashboardAssistant', () => ({ default: () => null }));
vi.mock('./MetricTrend', () => ({
  default: (props: any) => {
    api.trend(props);
    return (
      <div>
        {props.onContributionSelect &&
          props.trend?.points?.map((point: any) => (
            <button
              key={point.time}
              aria-label={`${props.title.endsWith(' · 이전 기간') ? '이전 추세 원본' : '추세 원본'} ${point.time}`}
              aria-disabled={props.contributionDisabled}
              onClick={() => props.onContributionSelect(point.time)}
            >
              집계 원본 행 보기
            </button>
          ))}
        {props.contributionDisabledReason && <span>{props.contributionDisabledReason}</span>}
      </div>
    );
  },
}));
vi.mock('./PeriodComparison', async importOriginal => ({
  ...(await importOriginal<typeof import('./PeriodComparison')>()),
  PreviousPeriodData: (props: any) => {
    api.previous(props);
    return (
      <div>
        {props.onContributionSelect &&
          props.data?.map((row: any, index: number) => (
            <button
              key={index}
              aria-label={`이전 그룹 ${JSON.stringify(row[props.categoryField])}`}
              aria-disabled={props.contributionDisabled}
              onClick={() => props.onContributionSelect(row[props.categoryField])}
            >
              집계 원본 행 보기
            </button>
          ))}
        {props.contributionDisabledReason && <span>{props.contributionDisabledReason}</span>}
      </div>
    );
  },
}));
vi.mock('./PersonalSavedViews', async importOriginal => ({
  ...(await importOriginal<typeof import('./PersonalSavedViews')>()),
  default: ({ state }: any) => <div data-testid="saved-state">{JSON.stringify(state)}</div>,
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: (props: any) => {
    api.widget(props);
    return (
      <div data-testid="widget">
        {props.title}
        {props.dataSet.map((row: any, index: number) => (
          <button
            key={index}
            aria-label={`차원 ${JSON.stringify(row.category)}`}
            disabled={props.categorySelectionDisabled}
            aria-pressed={props.selectedCategoryValues?.some(
              (value: unknown) => JSON.stringify(value) === JSON.stringify(row.category),
            )}
            onClick={() => props.onCategorySelect?.(row.category)}
          >
            {JSON.stringify(row.category)}
          </button>
        ))}
        {props.onContributionSelect &&
          props.dataSet.map((row: any, index: number) => (
            <button
              key={`contribution-${index}`}
              aria-disabled={props.contributionDisabled}
              aria-label={`집계 그룹 ${JSON.stringify(row.category)}`}
              onClick={() => props.onContributionSelect(row.category)}
            >
              집계 원본 행 보기
            </button>
          ))}
      </div>
    );
  },
}));
installRadixBrowserAPIs();

const success = (data: unknown) => ({ data: { status: 'SUCCESS', data } });
const draft = { databaseId: 24, revision: 'definition-version', widgets: [] };
const range = { column: 'day', start: '2026-01-11', end: '2026-01-12' };
const props = {
  open: true,
  dashboardId: 26,
  draft,
  filters: [{ column: 'channel', values: ['A', null] }],
  dateRange: range,
  sourceRevision: 'opaque-source-version',
  onClose: vi.fn(),
  onRefresh: vi.fn(),
  onExited: vi.fn(),
};
const detailData = (page = 0, pageSize = 25, sourceRevision = props.sourceRevision) => ({
  fields: [
    { columnName: 'channel', columnType: 'VARCHAR' },
    { columnName: 'day', columnType: 'DATE' },
  ],
  datas: [{ channel: 'record-A', day: '2026-01-11T00:00:00.000Z' }],
  totalRows: '26',
  page,
  pageSize,
  sourceRevision,
  scope: 'current common-filter source rows',
  columnCount: 2,
});
const button = (name: string) => screen.getByRole('button', { name, exact: true }) as HTMLButtonElement;
const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
// 실제 구현의 페이지 크기·집계 단위 컨트롤은 Radix Select이므로 트리거를 열고 옵션을 골라야 한다.
// 실제 Radix Select의 옵션 레이블은 "25행/50행/100행"이다(값은 "25"/"50"/"100").
const choosePageSize = (size: number) =>
  selectRadixOption(screen.getByRole('combobox', { name: '페이지당 행 수' }), size + '행');
const grainLabels = { auto: '자동', day: '일별', week: '주별', month: '월별' } as const;
const chooseGrain = (grain: keyof typeof grainLabels) =>
  selectRadixOption(screen.getByRole('combobox', { name: '시계열 집계 단위' }), grainLabels[grain]);
const idle = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
/**
 * 닫힘 후 포커스 복원 계약.
 *
 * Radix Dialog는 닫힐 때 onCloseAutoFocus에서 event.preventDefault()를 호출한 뒤
 * DialogTrigger에만 포커스를 되돌린다(@radix-ui/react-dialog/dist/index.mjs:174-176).
 * 그 preventDefault 때문에 FocusScope의 previouslyFocusedElement 복원도 실행되지 않는다
 * (@radix-ui/react-focus-scope/dist/index.mjs:111-116).
 * SourceDetails는 DialogTrigger를 렌더링하지 않으므로, 이 파일의 "launcher 포커스 복원"
 * 단언들은 DashboardAnalysis의 onExited 복원 경로에 의존한다. 현재 그 경로는 닫힘 시
 * focus()를 전혀 호출하지 않아(HTMLElement.prototype.focus 계측 결과 호출 0회,
 * document.activeElement는 body) 해당 단언들이 실패한다. 제품 결함이며 테스트는 계약을 그대로 유지한다.
 */
function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve: (value: unknown) => resolve(value), reject: (error: unknown) => reject(error) };
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  api.post.mockResolvedValue(success(detailData()));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('time bucket details preserves the exact timestamp request and captions its exclusive UTC end', async () => {
  const dateRange = {
    column: 'day',
    start: '2026-01-11T10:00:00Z',
    end: '2026-01-11T11:00:00Z',
    precision: 'timestamp' as const,
  };
  render(<SourceDetails {...props} dateRange={dateRange} />);
  await screen.findByText('record-A');
  expect(api.post.mock.lastCall[1].dateRange).toEqual(dateRange);
  expect(screen.getByText(/day: UTC 2026-01-11 10:00:00 ~ 2026-01-11 11:00:00 \(종료 미포함\)/)).toBeTruthy();
});

it('requests only the specified details contract and renders a bounded keyboard region with safe NULL/date text', async () => {
  api.post.mockResolvedValueOnce(success({ ...detailData(), datas: [{ channel: '<img onerror=attack>', day: null }] }));
  render(<SourceDetails {...props} />);
  await screen.findByText('<img onerror=attack>');
  expect(api.post).toHaveBeenCalledWith(
    '/ai/dashboard-details',
    {
      dashboardId: 26,
      draft,
      filters: props.filters,
      dateRange: range,
      sourceRevision: props.sourceRevision,
      page: 0,
      pageSize: 25,
    },
    { timeout: 60000, signal: expect.any(AbortSignal) },
  );
  const dialog = screen.getByRole('dialog', { name: '현재 공통 필터의 원본 행' });
  expect(within(dialog).getByText(/개별 차트에 설정한 추가 조건은 포함하지 않습니다/)).toBeTruthy();
  const region = screen.getByRole('region', { name: '현재 공통 필터의 원본 행 표' });
  expect(region.tabIndex).toBe(0);
  // 경계·스크롤은 이제 Tailwind 유틸리티로 표현된다(인라인 style 아님).
  expect(classNamesOf(region)).toEqual(expect.arrayContaining(['max-h-[50dvh]', 'max-w-full', 'overflow-auto']));
  expect(region.querySelector('img')).toBeNull();
  expect(within(region).getByText('값 없음')).toBeTruthy();
  expect(button('이전 페이지').disabled).toBe(true);
});

it('paginates with string row totals, omits all-time dates and resets page for page size changes', async () => {
  api.post.mockImplementation(async (_url, body) => success(detailData(body.page, body.pageSize)));
  render(<SourceDetails {...props} dateRange={null} />);
  await screen.findByText('record-A');
  expect(api.post.mock.lastCall[1]).not.toHaveProperty('dateRange');
  fireEvent.click(button('다음 페이지'));
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ page: 1, pageSize: 25 });
  expect(button('다음 페이지').disabled).toBe(true);
  fireEvent.click(button('이전 페이지'));
  await idle();
  expect(api.post.mock.lastCall[1].page).toBe(0);
  await choosePageSize(50);
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ page: 0, pageSize: 50 });
  await choosePageSize(100);
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ page: 0, pageSize: 100 });
});

it('explains first fifty columns without ordinary page-limit clutter, preserves precise large row totals and empty results', async () => {
  api.post.mockResolvedValueOnce(
    success({ ...detailData(), columnCount: 70, totalRows: '90071992547409931234', datas: [] }),
  );
  render(<SourceDetails {...props} />);
  await screen.findByText('원본 70개 컬럼 중 처음 50개 컬럼만 표시합니다.');
  expect(screen.getByText(/총 90071992547409931234행/)).toBeTruthy();
  expect(screen.getByText('현재 조건에 해당하는 원본 행이 없습니다.')).toBeTruthy();
  expect(screen.queryByText(/10,001페이지|페이지 번호|조회 한도에 도달/)).toBeNull();
  expect(canRequestNextPage(9999, 100, '90071992547409931234')).toBe(true);
  expect(canRequestNextPage(10000, 100, '90071992547409931234')).toBe(false);
  expect(canRequestNextPage(0, 25, '25')).toBe(false);
});

it.each([
  { filters: [{ column: 'channel', values: ['B'] }] },
  { dateRange: { ...range, start: '2026-01-12' } },
  { sourceRevision: 'new-source-version' },
  { dashboardId: 27 },
  { draft: { ...draft, revision: 'new-definition' } },
])('hides stale records immediately and aborts requests for changed context %j', async changed => {
  const old = deferred();
  const latest = deferred();
  const view = render(<SourceDetails {...props} />);
  await screen.findByText('record-A');
  api.post.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  fireEvent.click(button('다음 페이지'));
  await screen.findByRole('progressbar');
  const signal = api.post.mock.lastCall[2].signal as AbortSignal;
  view.rerender(<SourceDetails {...props} {...changed} />);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(signal.aborted).toBe(true);
  expect(api.post.mock.lastCall[1].page).toBe(0);
  await act(async () => old.resolve(success({ ...detailData(1), datas: [{ channel: 'stale-record' }] })));
  expect(screen.queryByText('stale-record')).toBeNull();
  await act(async () =>
    latest.resolve(
      success({
        ...detailData(0, 25, 'sourceRevision' in changed ? changed.sourceRevision : props.sourceRevision),
        datas: [{ channel: 'fresh-record' }],
      }),
    ),
  );
  await screen.findByText('fresh-record');
});

it('blocks while parent conditions are pending and hides previously loaded rows', async () => {
  const view = render(<SourceDetails {...props} />);
  await screen.findByText('record-A');
  const before = api.post.mock.calls.length;
  view.rerender(<SourceDetails {...props} disabledReason="공통 필터 조회 중" />);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(before);
  expect(screen.getByText(/공통 필터 조회 중/)).toBeTruthy();
  view.rerender(<SourceDetails {...props} sourceRevision={undefined} />);
  expect(screen.getByText(/데이터 버전을 확인한 뒤/)).toBeTruthy();
  expect(api.post).toHaveBeenCalledTimes(before);
});

it.each([
  { response: { data: { data: '<b>worker 오류</b>' } } },
  { response: { data: { data: { message: '<b>worker 오류</b>' } } } },
  { response: { data: { message: '<b>worker 오류</b>' } } },
])('safely presents server errors and retries the same conditions %j', async error => {
  api.post.mockRejectedValueOnce(error);
  render(<SourceDetails {...props} />);
  await screen.findByText('<b>worker 오류</b>');
  expect(screen.getByRole('alert').querySelector('b')).toBeNull();
  const originalBody = api.post.mock.calls[0][1];
  fireEvent.click(button('원본 행 다시 조회'));
  await screen.findByText('record-A');
  expect(api.post.mock.lastCall[1]).toEqual(originalBody);
});

it('requires refreshing the dashboard on 409 and never retains rows or retries the obsolete version', async () => {
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { data: '파일 교체됨' } } });
  render(<SourceDetails {...props} />);
  await screen.findByText(/원본 데이터 버전이 변경되었습니다/);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByRole('button', { name: '원본 행 다시 조회' })).toBeNull();
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  expect(props.onRefresh).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledTimes(1);
});

it.each([
  { sourceRevision: 'wrong-version' },
  { page: 2 },
  { pageSize: 50 },
  { scope: 'metric contributor proof' },
  { totalRows: 26 },
])('rejects mismatched or malformed response without showing its rows %j', async invalid => {
  api.post.mockResolvedValueOnce(success({ ...detailData(), ...invalid }));
  render(<SourceDetails {...props} />);
  await screen.findByText(/원본 행 응답의 조건 또는 데이터 버전/);
  expect(screen.queryByText('record-A')).toBeNull();
});

it('announces detail loading and completion in the same atomic live status across pages and retry', async () => {
  const first = deferred();
  api.post.mockReturnValueOnce(first.promise);
  render(<SourceDetails {...props} />);
  const status = screen.getByRole('status');
  expect(status.textContent).toBe('원본 행 조회 중 · 1페이지 · 페이지당 25행');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(status.getAttribute('aria-atomic')).toBe('true');
  await act(async () => first.resolve(success(detailData())));
  expect(screen.getByRole('status')).toBe(status);
  expect(status.textContent).toBe('총 26행 · 1페이지 · 현재 1행');
  const next = deferred();
  api.post.mockReturnValueOnce(next.promise);
  fireEvent.click(button('다음 페이지'));
  expect(status.textContent).toBe('원본 행 조회 중 · 2페이지 · 페이지당 25행');
  await act(async () => next.reject(new Error('조회 실패')));
  await screen.findByText('조회 실패');
  expect(status.textContent).toBe('');
  const retry = deferred();
  api.post.mockReturnValueOnce(retry.promise);
  fireEvent.click(button('원본 행 다시 조회'));
  expect(screen.getByRole('status')).toBe(status);
  expect(status.textContent).toBe('원본 행 조회 중 · 2페이지 · 페이지당 25행');
  await act(async () => retry.resolve(success(detailData(1))));
  expect(status.textContent).toBe('총 26행 · 2페이지 · 현재 1행');
});

it('ignores failed envelopes and late errors after closing, aborts and restores focus after dialog exit', async () => {
  api.post.mockResolvedValueOnce({ data: { status: 'ERROR', data: '조회 거부' } });
  const view = render(<SourceDetails {...props} />);
  await screen.findByText('조회 거부');
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  fireEvent.click(button('원본 행 다시 조회'));
  const signal = api.post.mock.lastCall[2].signal as AbortSignal;
  fireEvent.click(button('원본 상세 닫기'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
  view.rerender(<SourceDetails {...props} open={false} />);
  expect(signal.aborted).toBe(true);
  expect(props.onExited).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
  await act(async () => pending.reject(new Error('late error')));
  expect(screen.queryByRole('dialog')).toBeNull();
});

const preview = {
  sourceRevision: props.sourceRevision,
  widgets: [
    {
      title: '채널 매출',
      type: 'CHART_COLUMN',
      categoryField: 'category',
      valueField: 'amount',
      dimensionColumn: 'channel',
      datas: [null, 'null', 1, '1', true, 'a,b'].map(category => ({ category, amount: 10 })),
    },
  ],
  dimensions: [{ column: 'device', values: ['Mobile'] }],
  temporalColumns: [{ column: 'day' }],
};
const previewCalls = () => api.post.mock.calls.filter(([url]) => url === '/ai/dashboard-preview');
async function analysis(data = preview, definition: any = draft) {
  api.get.mockImplementation(async (url: string) => success(url.endsWith('/pivots') ? [] : definition));
  api.post.mockImplementation(async (url, body) =>
    success(url === '/ai/dashboard-preview' ? data : detailData(body.page, body.pageSize, body.sourceRevision)),
  );
  const view = render(
    <DashboardAnalysis dashboardId={26} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findAllByTestId('widget');
  await idle();
  return view;
}
const categoryButton = (value: unknown) => button(`차원 ${JSON.stringify(value)}`);

it('toggles typed chart categories, shows independently clearable chips absent from Select and preserves all view conditions', async () => {
  await analysis();
  choose('시작일 (UTC)', range.start);
  choose('종료일 (UTC)', range.end);
  fireEvent.click(button('적용'));
  await idle();
  await chooseGrain('week');
  await idle();
  fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
  await idle();
  for (const value of [null, 'null', 1, '1', true, 'a,b']) {
    fireEvent.click(categoryButton(value));
    await idle();
  }
  expect(previewCalls().at(-1)[1]).toMatchObject({
    filters: [{ column: 'channel', values: [null, 'null', 1, '1', true, 'a,b'] }],
    dateRange: range,
    trendGrain: 'week',
    comparePrevious: true,
  });
  expect(screen.queryByLabelText('channel')).toBeNull();
  expect(categoryButton(null).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(button('channel: 값 없음 (NULL) 공통 필터 해제'));
  await idle();
  expect(previewCalls().at(-1)[1].filters[0].values).toEqual(['null', 1, '1', true, 'a,b']);
  fireEvent.click(categoryButton(1));
  await idle();
  expect(previewCalls().at(-1)[1].filters[0].values).toEqual(['null', '1', true, 'a,b']);
  const saved = JSON.parse(screen.getByTestId('saved-state').textContent);
  expect(saved).toMatchObject({
    dateRange: range,
    trendGrain: 'week',
    comparePrevious: true,
    filters: [{ column: 'channel', values: ['null', '1', true, 'a,b'] }],
  });
  expect(screen.getByText(/공통 필터 변경: channel · 1 \(숫자\) 해제/).getAttribute('aria-live')).toBe('polite');
});

it('supports keyboard category activation and disables selection/detail while pending or after preview errors', async () => {
  await analysis();
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  categoryButton(null).focus();
  userEvent.keyboard('{Enter}');
  await screen.findByRole('progressbar');
  await waitFor(() => expect(previewCalls().at(-1)[1].filters).toEqual([{ column: 'channel', values: [null] }]));
  expect(categoryButton('null').disabled).toBe(true);
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
  const before = api.post.mock.calls.length;
  fireEvent.click(categoryButton('null'));
  expect(api.post).toHaveBeenCalledTimes(before);
  await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
  await act(async () => pending.reject(new Error('preview failed')));
  await screen.findByText(/preview failed/);
  expect(categoryButton('null').disabled).toBe(true);
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
});

it.each([{ dimensionColumn: undefined }, { dimensionColumn: 'day' }])(
  'does not filter temporal or unconfirmed chart categories %j',
  async changed => {
    await analysis({ ...preview, widgets: [{ ...preview.widgets[0], ...changed }] });
    const before = previewCalls().length;
    fireEvent.click(categoryButton(null));
    expect(previewCalls()).toHaveLength(before);
    expect(api.widget.mock.lastCall[0].onCategorySelect).toBeUndefined();
  },
);

it('limits chart selections to fifty values and five columns while keeping deselection available', async () => {
  const many = {
    ...preview,
    widgets: Array.from({ length: 6 }, (_, index) => ({
      ...preview.widgets[0],
      dimensionColumn: `col${index}`,
      title: `컬럼${index}`,
      datas: Array.from({ length: index === 0 ? 51 : 1 }, (_, category) => ({ category, amount: 10 })),
    })),
  };
  await analysis(many);
  vi.useFakeTimers();
  const widgets = screen.getAllByTestId('widget');
  for (let i = 0; i < 50; i++) {
    fireEvent.click(within(widgets[0]).getByRole('button', { name: `차원 ${i}`, exact: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await idle();
  }
  fireEvent.click(within(widgets[0]).getByRole('button', { name: '차원 50', exact: true }));
  expect(screen.getByText(/최대 50개 값까지 선택/)).toBeTruthy();
  expect(previewCalls().at(-1)[1].filters[0].values).toHaveLength(50);
  for (let i = 1; i < 5; i++) {
    fireEvent.click(within(widgets[i]).getByRole('button', { name: '차원 0', exact: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await idle();
  }
  const before = previewCalls().length;
  fireEvent.click(within(widgets[5]).getByRole('button', { name: '차원 0', exact: true }));
  expect(screen.getByText(/최대 5개 컬럼까지 선택/)).toBeTruthy();
  expect(previewCalls()).toHaveLength(before);
  fireEvent.click(within(widgets[0]).getByRole('button', { name: '차원 0', exact: true }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  await idle();
  expect(previewCalls().at(-1)[1].filters[0].values).toHaveLength(49);
});

it('opens current filtered source details globally, restores trigger focus, and refreshes preview on stale version', async () => {
  await analysis();
  fireEvent.click(categoryButton(null));
  await idle();
  button('원본 상세 보기').focus();
  fireEvent.click(button('원본 상세 보기'));
  await screen.findByText('record-A', {}, { timeout: 5000 });
  expect(api.post.mock.lastCall[1]).toMatchObject({
    sourceRevision: props.sourceRevision,
    dashboardId: 26,
    filters: [{ column: 'channel', values: [null] }],
  });
  fireEvent.click(button('원본 상세 닫기'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(button('원본 상세 보기'));
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'version changed' } } });
  fireEvent.click(button('원본 상세 보기'));
  await screen.findByText(/원본 데이터 버전이 변경되었습니다/);
  const before = previewCalls().length;
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  await idle();
  expect(previewCalls()).toHaveLength(before + 1);
  expect(previewCalls().at(-1)[1].filters).toEqual([{ column: 'channel', values: [null] }]);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('rejects nonprimitive and nonfinite category callback values before transport', async () => {
  await analysis();
  const select = api.widget.mock.lastCall[0].onCategorySelect;
  const before = previewCalls().length;
  for (const value of [undefined, {}, [], Infinity, NaN]) {
    act(() => select(value));
  }
  expect(previewCalls()).toHaveLength(before);
  expect(JSON.parse(screen.getByTestId('saved-state').textContent).filters).toEqual([]);
});

async function pendingChipClear(focused = true, keys = '{Enter}') {
  await analysis();
  fireEvent.click(categoryButton(null));
  await idle();
  const chip = button('channel: 값 없음 (NULL) 공통 필터 해제');
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  if (focused) {
    chip.focus();
    userEvent.keyboard(keys);
  } else fireEvent.click(chip);
  await screen.findByRole('progressbar');
  return pending;
}

it.each([
  ['Enter', '{Enter}'],
  ['Space', ' '],
])('chip focus returns to details only after successful pending keyboard removal completes via %s', async (_name, keys) => {
  const pending = await pendingChipClear(true, keys);
  expect(screen.queryByRole('button', { name: 'channel: 값 없음 (NULL) 공통 필터 해제' })).toBeNull();
  expect(document.activeElement).toBe(document.body);
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
  await act(async () => pending.resolve(success(preview)));
  await idle();
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(document.activeElement).toBe(button('원본 상세 보기'));
});

it('chip focus stays on a surviving aria-disabled chip during pending and activation is guarded', async () => {
  await analysis();
  fireEvent.click(categoryButton(null));
  await idle();
  const chip = button('channel: 값 없음 (NULL) 공통 필터 해제');
  chip.focus();
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  fireEvent.click(categoryButton('null'));
  await screen.findByRole('progressbar');
  expect(chip.disabled).toBe(false);
  expect(chip.getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(chip);
  const before = previewCalls().length;
  userEvent.keyboard(' ');
  expect(previewCalls()).toHaveLength(before);
  await act(async () => pending.resolve(success(preview)));
  await idle();
  expect(document.activeElement).toBe(chip);
  expect(chip.getAttribute('aria-disabled')).toBe('false');
});

it('chip focus does not steal focus after the user moved elsewhere, even if that target is then removed', async () => {
  const pending = await pendingChipClear();
  const elsewhere = document.createElement('button');
  document.body.appendChild(elsewhere);
  elsewhere.focus();
  elsewhere.remove();
  expect(document.activeElement).toBe(document.body);
  await act(async () => pending.resolve(success(preview)));
  await idle();
  expect(document.activeElement).toBe(document.body);
});

it('chip focus does not jump outside a dialog opened while its response was pending', async () => {
  const pending = await pendingChipClear();
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  document.body.appendChild(dialog);
  try {
    await act(async () => pending.resolve(success(preview)));
    await idle();
    expect(document.activeElement).toBe(document.body);
  } finally {
    dialog.remove();
  }
});

it('chip focus does not infer restore intent from an unfocused pointer clear', async () => {
  const pending = await pendingChipClear(false);
  await act(async () => pending.resolve(success(preview)));
  await idle();
  expect(document.activeElement).toBe(document.body);
});

it('chip focus does not restore on a failed preview response', async () => {
  const pending = await pendingChipClear();
  await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
  await act(async () => pending.reject(new Error('chip request failed')));
  await screen.findByText(/chip request failed/);
  expect(document.activeElement).toBe(document.body);
});

it('renders magic source column names from own properties and hides inherited prototype members', async () => {
  const fields = ['__proto__', 'constructor', 'toString'].map(columnName => ({ columnName, columnType: 'VARCHAR' }));
  api.post.mockResolvedValueOnce(
    success({
      ...detailData(),
      fields,
      columnCount: 3,
      datas: [
        {},
        Object.fromEntries([
          ['__proto__', '원본 proto'],
          ['constructor', '원본 constructor'],
          ['toString', '원본 toString'],
        ]),
      ],
    }),
  );
  render(<SourceDetails {...props} />);
  await screen.findByText('원본 proto');
  const rows = screen.getAllByRole('row');
  expect(within(rows[1]).getAllByText('값 없음')).toHaveLength(3);
  for (const text of ['원본 proto', '원본 constructor', '원본 toString'])
    expect(within(rows[2]).getByText(text)).toBeTruthy();
});

it('keeps magic dimension names usable in common Select controls and chart toggles', async () => {
  await analysis({
    ...preview,
    dimensions: [
      { column: '__proto__', values: ['proto-value'] },
      { column: 'constructor', values: ['constructor-value'] },
    ],
    widgets: ['__proto__', 'constructor'].map((dimensionColumn, index) => ({
      ...preview.widgets[0],
      dimensionColumn,
      datas: [{ category: index ? 'constructor-value' : 'proto-value', amount: 10 }],
    })),
  });
  // 공통 필터 컨트롤은 Radix DropdownMenu 트리거 버튼이며, 트리거 텍스트가 선택 상태를 나타낸다.
  const dimensionTrigger = (column: string) => screen.getByRole('button', { name: column }) as HTMLButtonElement;
  expect(dimensionTrigger('__proto__').textContent).toBe('전체');
  expect(dimensionTrigger('constructor').textContent).toBe('전체');
  fireEvent.click(categoryButton('proto-value'));
  await idle();
  fireEvent.click(categoryButton('constructor-value'));
  await idle();
  expect(previewCalls().at(-1)[1].filters).toEqual([
    { column: '__proto__', values: ['proto-value'] },
    { column: 'constructor', values: ['constructor-value'] },
  ]);
  expect(dimensionTrigger('__proto__').textContent).toBe('proto-value');
  expect(dimensionTrigger('constructor').textContent).toBe('constructor-value');
});

it.each([false, true])(
  'stale refresh focus keeps the launcher enabled during pending and respects user movement=%s',
  async moved => {
    await analysis();
    api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'stale file' } } });
    button('원본 상세 보기').focus();
    fireEvent.click(button('원본 상세 보기'));
    await screen.findByText(/원본 데이터 버전이 변경되었습니다/);
    const pending = deferred();
    api.post.mockReturnValueOnce(pending.promise);
    button('대시보드 데이터 새로 조회').focus();
    userEvent.keyboard('{Enter}');
    await screen.findByRole('progressbar');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('원본 상세 보기').disabled).toBe(false);
    expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(button('원본 상세 보기'));
    const requests = api.post.mock.calls.length;
    userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(requests);
    if (moved) button('Assistant').focus();
    await act(async () => pending.resolve(success({ ...preview, sourceRevision: 'updated-source-version' })));
    await idle();
    expect(document.activeElement).toBe(button(moved ? 'Assistant' : '원본 상세 보기'));
  },
);

it('retains stale refresh focus when the launcher is restored before the preview becomes pending', async () => {
  await analysis();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'stale file' } } });
  const launcher = button('원본 상세 보기');
  launcher.focus();
  fireEvent.click(launcher);
  await screen.findByText(/원본 데이터 버전이 변경되었습니다/);
  const pending = deferred();
  // aria-disabled preserves native focus while the guarded action remains unavailable.
  // 닫힘 커밋과 겹치는 동안 Radix는 앱 루트를 aria-hidden으로 유지하므로 role 조회 대신
  // 미리 잡아 둔 launcher 참조로 포커스를 되돌린다(MUI의 자동 복원을 대신하는 명시적 단계).
  api.post.mockImplementationOnce(() => {
    launcher.focus();
    expect(document.activeElement).toBe(launcher);
    return pending.promise;
  });
  button('대시보드 데이터 새로 조회').focus();
  userEvent.keyboard('{Enter}');
  await screen.findByRole('progressbar');
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(button('원본 상세 보기'));
  await act(async () => pending.resolve(success({ ...preview, sourceRevision: 'updated-source-version' })));
  await idle();
  expect(document.activeElement).toBe(button('원본 상세 보기'));
});

const groupFingerprint = 'b'.repeat(64);
const contribution: ContributionRequest = {
  widgetIndex: 0,
  expectedRevision: draft.revision,
  trendGrain: 'week',
  groupFingerprint,
};
const contributionTitle = '채널 매출';
const contributionData = (request = contribution, page = 0, pageSize = 25, title = contributionTitle) => ({
  ...detailData(page, pageSize),
  scope: 'widget aggregate input rows',
  contribution: {
    widgetIndex: request.widgetIndex,
    expectedRevision: request.expectedRevision,
    ...(Object.prototype.hasOwnProperty.call(request, 'category') ? { category: request.category } : {}),
    ...(Object.prototype.hasOwnProperty.call(request, 'groupFingerprint')
      ? { groupFingerprint: request.groupFingerprint }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(request, 'trendPoint') ? { trendPoint: request.trendPoint } : {}),
    ...(request.period ? { period: request.period, dateRange: previousRange } : {}),
    title,
    components: ['SUM(amount)', 'COUNT(*)'],
    semantics: '집계 함수 입력 행의 합집합입니다. MIN/MAX는 모든 비NULL 입력, 비율은 각 구성요소 입력을 포함합니다.',
  },
  contributionComponents: [['SUM(amount)', 'COUNT(*)']],
});

it('contributor detail sends the whole-widget contract, keeps original columns untouched and renders component labels separately', async () => {
  const data = contributionData();
  data.fields = [
    { columnName: '집계 구성요소', columnType: 'VARCHAR' },
    { columnName: '__proto__', columnType: 'INTEGER' },
  ];
  data.datas = [
    Object.fromEntries([
      ['집계 구성요소', '<img onerror=unsafe>'],
      ['__proto__', 0],
    ]),
  ];
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...props} contribution={contribution} widgetTitle={contributionTitle} />);
  await screen.findByText('<img onerror=unsafe>');
  expect(api.post.mock.lastCall[1]).toEqual({
    dashboardId: props.dashboardId,
    draft,
    filters: props.filters,
    dateRange: range,
    sourceRevision: props.sourceRevision,
    page: 0,
    pageSize: 25,
    contribution,
  });
  expect(api.post.mock.lastCall[1].contribution).not.toHaveProperty('category');
  const dialog = screen.getByRole('dialog', { name: '집계에 사용된 원본 행' });
  expect(within(dialog).getByText('차트: 채널 매출 · 위젯 전체')).toBeTruthy();
  expect(within(dialog).getByText(/MIN\/MAX는 모든 비NULL 입력/)).toBeTruthy();
  expect(within(dialog).queryByText(/개별 차트에 설정한 추가 조건은 포함하지 않습니다/)).toBeNull();
  const region = screen.getByRole('region', { name: '집계에 사용된 원본 행 표' });
  expect(region.tabIndex).toBe(0);
  expect(classNamesOf(region)).toEqual(expect.arrayContaining(['max-h-[50dvh]', 'max-w-full', 'overflow-auto']));
  const cells = within(region).getAllByRole('cell');
  expect(cells.map(cell => cell.textContent)).toEqual(['SUM(amount)COUNT(*)', '<img onerror=unsafe>', '0']);
  expect(within(cells[0]).getByText('SUM(amount)').tagName).toBe('SPAN');
  expect(region.querySelector('img')).toBeNull();
  expect(data.fields.map(field => field.columnName)).toEqual(['집계 구성요소', '__proto__']);
});

it.each([null, 'null', 1, '1', true])('contributor detail retains category type and own presence for %j', async category => {
  const request = { ...contribution, category };
  api.post.mockResolvedValueOnce(success(contributionData(request)));
  render(<SourceDetails {...props} contribution={request} widgetTitle={contributionTitle} />);
  await screen.findByText('record-A');
  expect(api.post.mock.lastCall[1].contribution.category).toBe(category);
  expect(Object.prototype.hasOwnProperty.call(api.post.mock.lastCall[1].contribution, 'category')).toBe(true);
  const label =
    category === null
      ? '값 없음 (NULL)'
      : `${String(category)} (${
          typeof category === 'number' ? '숫자' : typeof category === 'boolean' ? '불리언' : '문자열'
        })`;
  expect(screen.getByText(`차트: 채널 매출 · 그룹: ${label}`)).toBeTruthy();
});

it.each([
  [
    'scope',
    (data: any) => {
      data.scope = 'current common-filter source rows';
    },
  ],
  [
    'widget',
    (data: any) => {
      data.contribution.widgetIndex = 1;
    },
  ],
  [
    'definition',
    (data: any) => {
      data.contribution.expectedRevision = 'different';
    },
  ],
  [
    'category presence',
    (data: any) => {
      data.contribution.category = null;
    },
  ],
  [
    'category type',
    (data: any) => {
      data.contribution.category = 'null';
    },
  ],
  [
    'title',
    (data: any) => {
      data.contribution.title = 'another widget';
    },
  ],
  [
    'labels alignment',
    (data: any) => {
      data.contributionComponents = [];
    },
  ],
  [
    'labels identity',
    (data: any) => {
      data.contributionComponents = [['unrelated SQL']];
    },
  ],
  [
    'semantics',
    (data: any) => {
      data.contribution.semantics = { message: 'unknown' };
    },
  ],
])('contributor detail rejects mismatched %s without displaying wrong rows', async (kind, mutate) => {
  const request = kind === 'category type' ? { ...contribution, category: null } : contribution;
  const data = contributionData(request);
  mutate(data);
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...props} contribution={request} widgetTitle={contributionTitle} />);
  await screen.findByText(/원본 행 응답의 조건 또는 데이터 버전/);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(screen.queryByRole('table')).toBeNull();
  expect(button('원본 행 다시 조회')).toBeTruthy();
});

it.each([
  { ...contribution, widgetIndex: 1 },
  { ...contribution, expectedRevision: 'new-definition' },
  { ...contribution, trendGrain: 'month' as const },
  { ...contribution, category: null },
])('contributor detail pins changed identity %j and ignores aborted older records', async changed => {
  api.post
    .mockResolvedValueOnce(success(contributionData()))
    .mockResolvedValueOnce(success(contributionData(contribution, 1)));
  const view = render(<SourceDetails {...props} contribution={contribution} widgetTitle={contributionTitle} />);
  await screen.findByText('record-A');
  fireEvent.click(button('다음 페이지'));
  await idle();
  const old = deferred();
  api.post.mockReturnValueOnce(old.promise);
  fireEvent.click(button('이전 페이지'));
  const oldSignal = api.post.mock.lastCall[2].signal;
  const current = deferred();
  api.post.mockReturnValueOnce(current.promise);
  view.rerender(<SourceDetails {...props} contribution={changed} widgetTitle={contributionTitle} />);
  expect(oldSignal.aborted).toBe(true);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: changed, page: 0 });
  await act(async () => current.resolve(success({ ...contributionData(changed), datas: [{ channel: 'fresh-row' }] })));
  await screen.findByText('fresh-row');
  await act(async () => old.resolve(success({ ...contributionData(), datas: [{ channel: 'stale-row' }] })));
  expect(screen.queryByText('stale-row')).toBeNull();
});

it('contributor detail preserves grouping across pagination and changes cleanly back to raw source mode', async () => {
  const request = { ...contribution, category: null };
  api.post.mockImplementation(async (_url, body) => success(contributionData(body.contribution, body.page, body.pageSize)));
  const view = render(<SourceDetails {...props} contribution={request} widgetTitle={contributionTitle} />);
  await screen.findByText('record-A');
  fireEvent.click(button('다음 페이지'));
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: request, page: 1, pageSize: 25 });
  await choosePageSize(50);
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: request, page: 0, pageSize: 50 });
  const raw = deferred();
  api.post.mockReturnValueOnce(raw.promise);
  view.rerender(<SourceDetails {...props} />);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(api.post.mock.lastCall[1]).not.toHaveProperty('contribution');
  await act(async () => raw.resolve(success(detailData(0, 50))));
  await screen.findByRole('dialog', { name: '현재 공통 필터의 원본 행' });
  await screen.findByText('record-A');
  expect(screen.queryByText('SUM(amount)')).toBeNull();
});

const contributorPreview = {
  ...preview,
  widgets: [{ ...preview.widgets[0], contribution: { supported: true, components: ['SUM(amount)'], groupFingerprint } }],
};
const contributorCalls = () =>
  api.post.mock.calls.filter(([url, body]) => url === '/ai/dashboard-details' && body.contribution);
async function contributorAnalysis(data: any = contributorPreview) {
  await analysis(
    data,
    data.widgets.some((widget: any) => widget.trend?.contribution || widget.previousContribution)
      ? { ...draft, widgets: data.widgets.map((widget: any) => ({ type: widget.type })) }
      : draft,
  );
  api.post.mockImplementation(async (url, body) =>
    success(
      url === '/ai/dashboard-preview'
        ? data
        : body.contribution
        ? contributionData(body.contribution, body.page, body.pageSize, data.widgets[body.contribution.widgetIndex].title)
        : detailData(body.page, body.pageSize),
    ),
  );
}

it.each(['{Enter}', ' '])(
  'contributor detail whole-widget launcher keyboard %s preserves current conditions and restores exact focus',
  async keys => {
    await contributorAnalysis();
    choose('시작일 (UTC)', range.start);
    choose('종료일 (UTC)', range.end);
    fireEvent.click(button('적용'));
    await idle();
    await chooseGrain('week');
    await idle();
    fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
    await idle();
    fireEvent.click(categoryButton(null));
    await idle();
    const launcher = button('채널 매출 집계 원본 행 보기');
    launcher.focus();
    userEvent.keyboard(keys);
    await screen.findByText('record-A');
    expect(contributorCalls().at(-1)[1]).toMatchObject({
      contribution,
      dateRange: range,
      filters: [{ column: 'channel', values: [null] }],
    });
    expect(JSON.parse(screen.getByTestId('saved-state').textContent)).toMatchObject({
      comparePrevious: true,
      trendGrain: 'week',
      dateRange: range,
    });
    expect(api.widget.mock.lastCall[0].contributionDisabled).toBe(true);
    button('원본 상세 닫기').focus();
    fireEvent.click(button('원본 상세 닫기'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(launcher);
    button('원본 상세 보기').focus();
    fireEvent.click(button('원본 상세 보기'));
    await screen.findByText('record-A');
    expect(api.post.mock.lastCall[1]).not.toHaveProperty('contribution');
  },
);

it.each([null, 'null', 1, '1'])(
  'contributor detail row launcher keeps raw category %j and returns to that exact row',
  async category => {
    await contributorAnalysis();
    const launcher = button(`집계 그룹 ${JSON.stringify(category)}`);
    launcher.focus();
    userEvent.keyboard('{Enter}');
    await screen.findByText('record-A');
    expect(contributorCalls().at(-1)[1].contribution).toEqual({ ...contribution, trendGrain: 'auto', category });
    button('원본 상세 닫기').focus();
    fireEvent.click(button('원본 상세 닫기'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(launcher);
  },
);

it('contributor detail unsupported/KPI cards expose reasons and only KPI whole-widget entry', async () => {
  await contributorAnalysis({
    ...preview,
    widgets: [
      { ...preview.widgets[0], type: 'BOARD_NUMERIC', title: '총 매출', contribution: { supported: true } },
      {
        ...preview.widgets[0],
        title: 'DISTINCT 건수',
        contribution: { supported: false, reason: 'DISTINCT는 입력 행을 확인할 수 없습니다.' },
      },
    ],
  });
  expect(button('DISTINCT 건수 집계 원본 행 보기').disabled).toBe(true);
  expect(screen.getByText('DISTINCT는 입력 행을 확인할 수 없습니다.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^집계 그룹/ })).toBeNull();
  fireEvent.click(button('총 매출 집계 원본 행 보기'));
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('category');
  expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('groupFingerprint');
});

it.each([undefined, 'b'.repeat(63), 'B'.repeat(64)])(
  'contributor fingerprint blocks a chart with missing or invalid hint %j before any request',
  async value => {
    await contributorAnalysis({
      ...preview,
      widgets: [{ ...preview.widgets[0], contribution: { supported: true, groupFingerprint: value } }],
    });
    const launcher = button('채널 매출 집계 원본 행 보기');
    expect(launcher.disabled).toBe(true);
    expect(launcher.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('집계 그룹 버전을 확인할 수 없습니다. 대시보드 데이터를 새로 조회해 주세요.')).toBeTruthy();
    expect(api.widget.mock.lastCall[0].onContributionSelect).toBeUndefined();
    expect(api.widget.mock.lastCall[0].contributionDisabled).toBe(true);
    fireEvent.click(launcher);
    expect(contributorCalls()).toHaveLength(0);
  },
);

it.each(['missing', 'different', 'unexpected numeric'])(
  'contributor fingerprint rejects %s echo without showing records',
  async kind => {
    const request: ContributionRequest =
      kind === 'unexpected numeric'
        ? { widgetIndex: 0, expectedRevision: draft.revision, trendGrain: 'week' }
        : contribution;
    const data = contributionData(request);
    if (kind === 'missing') delete data.contribution.groupFingerprint;
    else data.contribution.groupFingerprint = kind === 'different' ? 'c'.repeat(64) : groupFingerprint;
    api.post.mockResolvedValueOnce(success(data));
    render(<SourceDetails {...props} contribution={request} widgetTitle={contributionTitle} />);
    await screen.findByText(/원본 행 응답의 조건 또는 데이터 버전/);
    expect(screen.queryByText('record-A')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  },
);

it('contributor fingerprint context change hides rows, aborts and ignores the earlier group selection', async () => {
  api.post.mockResolvedValueOnce(success(contributionData()));
  const view = render(<SourceDetails {...props} contribution={contribution} widgetTitle={contributionTitle} />);
  await screen.findByText('record-A');
  const earlier = deferred();
  api.post.mockReturnValueOnce(earlier.promise);
  fireEvent.click(button('다음 페이지'));
  const oldSignal = api.post.mock.lastCall[2].signal;
  const current = deferred();
  api.post.mockReturnValueOnce(current.promise);
  const changed = { ...contribution, groupFingerprint: 'c'.repeat(64) };
  view.rerender(<SourceDetails {...props} contribution={changed} widgetTitle={contributionTitle} />);
  expect(oldSignal.aborted).toBe(true);
  expect(screen.queryByText('record-A')).toBeNull();
  expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: changed, page: 0 });
  await act(async () => current.resolve(success({ ...contributionData(changed), datas: [{ channel: 'fresh-group' }] })));
  await screen.findByText('fresh-group');
  await act(async () =>
    earlier.resolve(success({ ...contributionData(contribution, 1), datas: [{ channel: 'old-group' }] })),
  );
  expect(screen.queryByText('old-group')).toBeNull();
});

it.each(['unapplied', 'invalid date', 'pending', 'error', 'editing', 'invalid category'])(
  'contributor detail guards %s including retained chart callbacks',
  async blocked => {
    await contributorAnalysis();
    const select = api.widget.mock.lastCall[0].onContributionSelect;
    if (blocked === 'unapplied' || blocked === 'invalid date') {
      choose('시작일 (UTC)', range.start);
      if (blocked === 'invalid date') fireEvent.click(button('적용'));
    } else if (blocked === 'editing') fireEvent.click(button('Assistant'));
    else if (blocked === 'pending' || blocked === 'error') {
      const pending = deferred();
      api.post.mockReturnValueOnce(pending.promise);
      fireEvent.click(categoryButton(null));
      if (blocked === 'error') {
        await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
        await act(async () => pending.reject(new Error('preview failed')));
      }
    }
    const count = contributorCalls().length;
    act(() => select(blocked === 'invalid category' ? { raw: 'value' } : null));
    if (blocked !== 'invalid category') fireEvent.click(button('채널 매출 집계 원본 행 보기'));
    expect(contributorCalls()).toHaveLength(count);
    expect(screen.queryByRole('dialog')).toBeNull();
  },
);

it('contributor detail 409 refresh fetches the canonical definition before preview while retaining filters and dates', async () => {
  await contributorAnalysis();
  choose('시작일 (UTC)', range.start);
  choose('종료일 (UTC)', range.end);
  fireEvent.click(button('적용'));
  await idle();
  fireEvent.click(categoryButton(null));
  await idle();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { data: 'definition changed' } } });
  fireEvent.click(button('채널 매출 집계 원본 행 보기'));
  await screen.findByText(/집계 정의 또는 원본 데이터 버전이 변경되었습니다/);
  const nextDraft = { ...draft, revision: 'updated-definition' };
  const canonical = deferred();
  api.get.mockReturnValueOnce(canonical.promise);
  const before = previewCalls().length;
  button('대시보드 데이터 새로 조회').focus();
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  expect(api.get.mock.lastCall[0]).toBe('/ai/dashboard-analysis/26');
  expect(previewCalls()).toHaveLength(before);
  expect(screen.queryByRole('dialog')).toBeNull();
  await act(async () => canonical.resolve(success(nextDraft)));
  await idle();
  expect(previewCalls()).toHaveLength(before + 1);
  expect(previewCalls().at(-1)[1]).toMatchObject({
    draft: nextDraft,
    dateRange: range,
    filters: [{ column: 'channel', values: [null] }],
  });
  fireEvent.click(button('채널 매출 집계 원본 행 보기'));
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1].contribution.expectedRevision).toBe(nextDraft.revision);
});

it('contributor detail failed canonical refresh does not query an old definition and offers a canonical retry', async () => {
  await contributorAnalysis();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'definition changed' } } });
  fireEvent.click(button('채널 매출 집계 원본 행 보기'));
  await screen.findByText(/집계 정의 또는 원본/);
  api.get.mockRejectedValueOnce(new Error('canonical unavailable'));
  const before = previewCalls().length;
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  await screen.findByText('저장된 대시보드 정의를 다시 읽지 못했습니다. 화면을 다시 열어 주세요.');
  expect(previewCalls()).toHaveLength(before);
  const nextDraft = { ...draft, revision: 'recovered-definition' };
  api.get.mockResolvedValueOnce(success(nextDraft));
  fireEvent.click(button('대시보드 정의 다시 조회'));
  await idle();
  expect(previewCalls().at(-1)[1].draft).toEqual(nextDraft);
  expect(screen.queryByRole('alert')).toBeNull();
});

const trendTime = '2026-01-11T08:00:00Z';
const trendPointRequest: ContributionRequest = {
  widgetIndex: 0,
  expectedRevision: draft.revision,
  trendGrain: 'auto',
  trendPoint: { column: 'day', grain: 'hour', time: trendTime, groupFingerprint },
};
const trendProps = { ...props, draft: { ...draft, widgets: [{ type: 'BOARD_NUMERIC' }] } };
const trendPreview = {
  ...contributorPreview,
  widgets: [
    {
      ...contributorPreview.widgets[0],
      type: 'BOARD_NUMERIC',
      trend: {
        column: 'day',
        grain: 'hour',
        points: [
          { time: trendTime, value: 10 },
          { time: '2026-01-11T09:00:00Z', value: null },
        ],
        contribution: { supported: true, groupFingerprint },
      },
    },
  ],
};
const trendLauncher = () => button(`추세 원본 ${trendTime}`);

it.each(['{Enter}', ' '])(
  'trend point contributor keyboard %s preserves view state and returns exact launcher focus',
  async keys => {
    await contributorAnalysis(trendPreview);
    choose('시작일 (UTC)', range.start);
    choose('종료일 (UTC)', range.end);
    fireEvent.click(button('적용'));
    await idle();
    await chooseGrain('week');
    await idle();
    fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
    await idle();
    fireEvent.click(categoryButton(null));
    await idle();
    const saved = screen.getByTestId('saved-state').textContent;
    const before = previewCalls().length;
    const launcher = trendLauncher();
    launcher.focus();
    await userEvent.keyboard(keys);
    await screen.findByText('record-A');
    expect(contributorCalls().at(-1)[1]).toMatchObject({
      contribution: { ...trendPointRequest, trendGrain: 'week' },
      filters: [{ column: 'channel', values: [null] }],
      dateRange: range,
      sourceRevision: props.sourceRevision,
    });
    expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('category');
    expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('groupFingerprint');
    expect(previewCalls()).toHaveLength(before);
    expect(screen.getByTestId('saved-state').textContent).toBe(saved);
    expect(screen.getByText(/추세 시점: day · UTC 2026-01-11 08:00:00 · 시간 집계/)).toBeTruthy();
    button('원본 상세 닫기').focus();
    fireEvent.click(button('원본 상세 닫기'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(launcher);
  },
);

it.each([
  'column',
  'grain',
  'time',
  'groupFingerprint',
  'extra',
  'missing',
  'unexpected category',
  'unexpected fingerprint',
  'source version',
])('trend point contributor rejects mismatched echo %s without rendering records', async kind => {
  const data: any = contributionData(trendPointRequest);
  data.contribution.trendPoint = { ...trendPointRequest.trendPoint };
  if (kind === 'missing') delete data.contribution.trendPoint;
  else if (kind === 'extra') data.contribution.trendPoint.extra = true;
  else if (kind === 'unexpected category') data.contribution.category = null;
  else if (kind === 'unexpected fingerprint') data.contribution.groupFingerprint = groupFingerprint;
  else if (kind === 'source version') data.sourceRevision = 'other-source';
  else
    data.contribution.trendPoint[kind] = (
      { column: 'other', grain: 'day', time: '2026-01-11T09:00:00Z', groupFingerprint: 'c'.repeat(64) } as any
    )[kind];
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...trendProps} contribution={trendPointRequest} widgetTitle={contributionTitle} />);
  await screen.findByText(/원본 행 응답의 조건/);
  expect(screen.queryByText('record-A')).toBeNull();
});

it.each(['category', 'fingerprint', 'nonnumeric', 'invalid instant', 'extra key'])(
  'trend point contributor blocks invalid request %s before transport',
  async kind => {
    const request: any = { ...trendPointRequest, trendPoint: { ...trendPointRequest.trendPoint } };
    if (kind === 'category') request.category = null;
    if (kind === 'fingerprint') request.groupFingerprint = groupFingerprint;
    if (kind === 'invalid instant') request.trendPoint.time = '2026-02-30T08:00:00Z';
    if (kind === 'extra key') request.trendPoint.extra = true;
    render(
      <SourceDetails
        {...trendProps}
        draft={kind === 'nonnumeric' ? { ...draft, widgets: [{ type: 'CHART_LINE' }] } : trendProps.draft}
        contribution={request}
      />,
    );
    expect(screen.getByText(/집계 조건을 확인/)).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  },
);

it.each(['time', 'fingerprint', 'source', 'filters', 'dates'])(
  'trend point contributor context %s aborts late responses and clears old records',
  async kind => {
    api.post.mockResolvedValueOnce(success(contributionData(trendPointRequest)));
    const view = render(<SourceDetails {...trendProps} contribution={trendPointRequest} />);
    await screen.findByText('record-A');
    const earlier = deferred();
    api.post.mockReturnValueOnce(earlier.promise);
    fireEvent.click(button('다음 페이지'));
    const signal = api.post.mock.lastCall[2].signal;
    const pending = deferred();
    api.post.mockReturnValueOnce(pending.promise);
    const changed = { ...trendPointRequest, trendPoint: { ...trendPointRequest.trendPoint } };
    if (kind === 'time') changed.trendPoint.time = '2026-01-11T09:00:00Z';
    if (kind === 'fingerprint') changed.trendPoint.groupFingerprint = 'c'.repeat(64);
    const changedProps = {
      ...trendProps,
      ...(kind === 'source' ? { sourceRevision: 'new-source' } : {}),
      ...(kind === 'filters' ? { filters: [] } : {}),
      ...(kind === 'dates' ? { dateRange: { ...range, start: '2026-01-12' } } : {}),
    };
    view.rerender(<SourceDetails {...changedProps} contribution={changed} />);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('record-A')).toBeNull();
    expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: changed, page: 0 });
    await act(async () =>
      pending.resolve(
        success({
          ...contributionData(changed),
          sourceRevision: changedProps.sourceRevision,
          datas: [{ channel: 'new-point' }],
        }),
      ),
    );
    await screen.findByText('new-point');
    await act(async () =>
      earlier.resolve(success({ ...contributionData(trendPointRequest, 1), datas: [{ channel: 'old-point' }] })),
    );
    expect(screen.queryByText('old-point')).toBeNull();
  },
);

it.each(['column', 'grain', 'fingerprint', 'unsupported', 'missing source', 'raw time'])(
  'trend point contributor current preview metadata guard %s',
  async kind => {
    const data: any = structuredClone(trendPreview);
    if (kind === 'column') data.widgets[0].trend.column = '';
    if (kind === 'grain') data.widgets[0].trend.grain = 'auto';
    if (kind === 'fingerprint') data.widgets[0].trend.contribution.groupFingerprint = 'bad';
    if (kind === 'unsupported') data.widgets[0].trend.contribution = { supported: false, reason: '지원하지 않는 추세 집계' };
    if (kind === 'missing source') delete data.sourceRevision;
    await contributorAnalysis(data);
    const select = api.trend.mock.lastCall[0].onContributionSelect;
    const count = contributorCalls().length;
    act(() => select(kind === 'raw time' ? '2026-01-11T08:00:00.000Z' : trendTime));
    expect(contributorCalls()).toHaveLength(count);
    expect(screen.queryByRole('dialog')).toBeNull();
    if (kind !== 'raw time') expect(api.trend.mock.lastCall[0].contributionDisabled).toBe(true);
  },
);

it.each(['unapplied', 'invalid date', 'pending', 'error', 'editing', 'old preview', 'dialog'])(
  'trend point contributor live interaction guard %s rejects retained callbacks',
  async kind => {
    await contributorAnalysis(trendPreview);
    const select = api.trend.mock.lastCall[0].onContributionSelect;
    if (kind === 'unapplied' || kind === 'invalid date') {
      choose('시작일 (UTC)', range.start);
      if (kind === 'invalid date') fireEvent.click(button('적용'));
    } else if (kind === 'editing') fireEvent.click(button('Assistant'));
    else if (kind === 'dialog') {
      fireEvent.click(button('원본 상세 보기'));
      await screen.findByText('record-A');
    } else {
      const pending = deferred();
      api.post.mockReturnValueOnce(pending.promise);
      fireEvent.click(categoryButton(null));
      if (kind === 'error') {
        await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
        await act(async () => pending.reject(new Error('preview failed')));
      }
      if (kind === 'old preview') {
        await act(async () => pending.resolve(success({ ...trendPreview, sourceRevision: 'fresh-source' })));
        await idle();
      }
    }
    const count = contributorCalls().length;
    act(() => select(trendTime));
    expect(contributorCalls()).toHaveLength(count);
    if (kind !== 'dialog') expect(screen.queryByRole('dialog')).toBeNull();
  },
);

it('trend point contributor 409 reloads canonical definition then fresh source preview without narrowing common dates', async () => {
  await contributorAnalysis(trendPreview);
  choose('시작일 (UTC)', range.start);
  choose('종료일 (UTC)', range.end);
  fireEvent.click(button('적용'));
  await idle();
  fireEvent.click(categoryButton(null));
  await idle();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'changed trend groups' } } });
  fireEvent.click(trendLauncher());
  await screen.findByText(/집계 정의 또는 원본 데이터 버전이 변경/);
  const canonical = deferred();
  api.get.mockReturnValueOnce(canonical.promise);
  const before = previewCalls().length;
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  expect(api.get.mock.lastCall[0]).toBe('/ai/dashboard-analysis/26');
  expect(previewCalls()).toHaveLength(before);
  const nextDraft = { ...trendProps.draft, revision: 'fresh-definition' };
  const freshPreview = { ...trendPreview, sourceRevision: 'fresh-source' };
  api.post.mockImplementation(async (url, body) =>
    success(
      url === '/ai/dashboard-preview'
        ? freshPreview
        : { ...contributionData(body.contribution), sourceRevision: body.sourceRevision },
    ),
  );
  await act(async () => canonical.resolve(success(nextDraft)));
  await idle();
  expect(previewCalls().at(-1)[1]).toMatchObject({
    draft: nextDraft,
    dateRange: range,
    filters: [{ column: 'channel', values: [null] }],
  });
  fireEvent.click(trendLauncher());
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1]).toMatchObject({
    sourceRevision: 'fresh-source',
    dateRange: range,
    contribution: { ...trendPointRequest, expectedRevision: nextDraft.revision },
  });
});

it('trend point contributor missing definition revision cannot open point detail', async () => {
  await analysis(trendPreview, { ...trendProps.draft, revision: '' });
  const select = api.trend.mock.lastCall[0].onContributionSelect;
  expect(api.trend.mock.lastCall[0].contributionDisabled).toBe(true);
  act(() => select(trendTime));
  expect(contributorCalls()).toHaveLength(0);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('trend point contributor is numeric only even with copied trend metadata', async () => {
  await contributorAnalysis({ ...trendPreview, widgets: [{ ...trendPreview.widgets[0], type: 'CHART_LINE' }] });
  expect(api.trend).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: `추세 원본 ${trendTime}` })).toBeNull();
});

it('trend point contributor retry retains the exact point and common scope', async () => {
  api.post.mockRejectedValueOnce(new Error('잠시 후 다시 시도해 주세요.'));
  api.post.mockResolvedValueOnce(success(contributionData(trendPointRequest)));
  render(<SourceDetails {...trendProps} contribution={trendPointRequest} />);
  await screen.findByText('잠시 후 다시 시도해 주세요.');
  expect(screen.queryByText('record-A')).toBeNull();
  fireEvent.click(button('원본 행 다시 조회'));
  await screen.findByText('record-A');
  expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
  expect(api.post.mock.lastCall[1]).toMatchObject({
    contribution: trendPointRequest,
    filters: props.filters,
    dateRange: range,
  });
});

it('trend point contributor keeps the independent time filter action available', async () => {
  const bucket = { column: 'day', precision: 'timestamp' as const, start: trendTime, end: '2026-01-11T09:00:00Z' };
  await contributorAnalysis({
    ...trendPreview,
    widgets: [
      {
        ...trendPreview.widgets[0],
        trend: {
          ...trendPreview.widgets[0].trend,
          timeSelection: { column: 'day', grain: 'hour', ranges: [bucket, null] },
        },
      },
    ],
  });
  const selectTime = api.trend.mock.lastCall[0].onTimeSelect;
  expect(typeof selectTime).toBe('function');
  act(() => selectTime(bucket));
  await idle();
  expect(previewCalls().at(-1)[1].dateRange).toEqual(bucket);
  expect(contributorCalls()).toHaveLength(0);
  fireEvent.click(trendLauncher());
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1]).toMatchObject({ dateRange: bucket, contribution: trendPointRequest });
});

it('trend point contributor cannot appear in an ordinary whole-widget response', async () => {
  const data = {
    ...contributionData(contribution),
    contribution: { ...contributionData(contribution).contribution, trendPoint: trendPointRequest.trendPoint },
  };
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...props} contribution={contribution} />);
  await screen.findByText(/원본 행 응답의 조건/);
  expect(screen.queryByText('record-A')).toBeNull();
});

const previousRange = { column: 'day', start: '2026-01-09', end: '2026-01-10' };
const previousTime = '2026-01-09T08:00:00Z';
const previousRequest: ContributionRequest = {
  ...trendPointRequest,
  period: 'previous',
  trendPoint: { ...trendPointRequest.trendPoint, time: previousTime, groupFingerprint: 'c'.repeat(64) },
};
const previousProps = { ...trendProps, comparePrevious: true, previousDateRange: previousRange };
const previousNumericPreview = {
  ...trendPreview,
  comparison: { current: range, previous: previousRange },
  widgets: [
    {
      ...trendPreview.widgets[0],
      previousTrend: {
        ...trendPreview.widgets[0].trend,
        points: [{ time: previousTime, value: null }],
        contribution: { supported: true, groupFingerprint: 'c'.repeat(64) },
      },
    },
  ],
};
const previousLauncher = () => button(`이전 추세 원본 ${previousTime}`);
const previousTrendProps = () => api.trend.mock.calls.filter(([value]) => value.title.endsWith(' · 이전 기간')).at(-1)[0];
async function previousAnalysis(data: any = previousNumericPreview) {
  await contributorAnalysis(data);
  choose('시작일 (UTC)', range.start);
  choose('종료일 (UTC)', range.end);
  fireEvent.click(button('적용'));
  await idle();
  fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
  await idle();
}

it.each(['{Enter}', ' '])(
  'previous contributor numeric keyboard %s preserves current basis and restores launcher',
  async keys => {
    await previousAnalysis();
    fireEvent.click(categoryButton(null));
    await idle();
    const saved = screen.getByTestId('saved-state').textContent;
    const before = previewCalls().length;
    const launcher = previousLauncher();
    launcher.focus();
    await userEvent.keyboard(keys);
    await screen.findByText('record-A');
    expect(contributorCalls().at(-1)[1]).toMatchObject({
      contribution: previousRequest,
      comparePrevious: true,
      dateRange: range,
      filters: [{ column: 'channel', values: [null] }],
      sourceRevision: props.sourceRevision,
    });
    expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('dateRange');
    expect(screen.getByText('이전 기간: day: 2026-01-09 ~ 2026-01-10 (UTC)')).toBeTruthy();
    expect(screen.getByText(/현재 비교 기준: day: 2026-01-11 ~ 2026-01-12/)).toBeTruthy();
    expect(previousTrendProps().onTimeSelect).toBeUndefined();
    expect(screen.getByTestId('saved-state').textContent).toBe(saved);
    expect(previewCalls()).toHaveLength(before);
    button('원본 상세 닫기').focus();
    fireEvent.click(button('원본 상세 닫기'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(launcher);
    fireEvent.click(trendLauncher());
    await screen.findByText('record-A');
    expect(contributorCalls().at(-1)[1].contribution).not.toHaveProperty('period');
    expect(contributorCalls().at(-1)[1]).not.toHaveProperty('comparePrevious');
  },
);

it.each([
  'period missing',
  'period current',
  'range missing',
  'range length',
  'range column',
  'range precision',
  'range extra',
  'point time',
  'source',
])('previous contributor declines mismatched response %s', async kind => {
  const data: any = contributionData(previousRequest);
  data.contribution.dateRange = { ...previousRange };
  data.contribution.trendPoint = { ...previousRequest.trendPoint };
  if (kind === 'period missing') delete data.contribution.period;
  if (kind === 'period current') data.contribution.period = 'current';
  if (kind === 'range missing') delete data.contribution.dateRange;
  if (kind === 'range length') data.contribution.dateRange.start = '2026-01-08';
  if (kind === 'range column') data.contribution.dateRange.column = 'other';
  if (kind === 'range precision') data.contribution.dateRange.precision = 'timestamp';
  if (kind === 'range extra') data.contribution.dateRange.extra = true;
  if (kind === 'point time') data.contribution.trendPoint.time = trendTime;
  if (kind === 'source') data.sourceRevision = 'wrong-source';
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...previousProps} contribution={previousRequest} />);
  await screen.findByText(/원본 행 응답의 조건/);
  expect(screen.queryByText('record-A')).toBeNull();
});

it.each(['unexpected period', 'unexpected range'])('previous contributor current response rejects %s', async kind => {
  const data: any = contributionData(trendPointRequest);
  if (kind === 'unexpected period') data.contribution.period = 'previous';
  else data.contribution.dateRange = previousRange;
  api.post.mockResolvedValueOnce(success(data));
  render(<SourceDetails {...previousProps} contribution={trendPointRequest} />);
  await screen.findByText(/원본 행 응답의 조건/);
  expect(screen.queryByText('record-A')).toBeNull();
});

it.each([
  'compare off',
  'current absent',
  'previous absent',
  'gap',
  'length',
  'column',
  'precision',
  'extra',
  'wrong period',
])('previous contributor invalid scope %s prevents transport', async kind => {
  const changed: any = { ...previousProps, previousDateRange: { ...previousRange } };
  const request: any = { ...previousRequest };
  if (kind === 'compare off') changed.comparePrevious = false;
  if (kind === 'current absent') changed.dateRange = null;
  if (kind === 'previous absent') changed.previousDateRange = undefined;
  if (kind === 'gap') changed.previousDateRange = { ...previousRange, start: '2026-01-08', end: '2026-01-09' };
  if (kind === 'length') changed.previousDateRange.start = '2026-01-08';
  if (kind === 'column') changed.previousDateRange.column = 'other';
  if (kind === 'precision') changed.previousDateRange.precision = 'timestamp';
  if (kind === 'extra') changed.previousDateRange.extra = true;
  if (kind === 'wrong period') request.period = 'current';
  render(<SourceDetails {...changed} contribution={request} />);
  expect(screen.getByText(/집계 조건을 확인/)).toBeTruthy();
  expect(api.post).not.toHaveBeenCalled();
});

it('previous contributor timestamp boundary uses exact adjacent equal duration and preserves current request', async () => {
  const current = {
    column: 'day',
    precision: 'timestamp' as const,
    start: '2026-01-11T08:00:00Z',
    end: '2026-01-11T10:00:00Z',
  };
  const previous = { ...current, start: '2026-01-11T06:00:00Z', end: current.start };
  expect(validPreviousContributionRange(current, previous)).toBe(true);
  expect(validPreviousContributionRange(current, { ...previous, end: '2026-01-11T07:59:59Z' })).toBe(false);
  expect(validPreviousContributionRange(current, { ...previous, start: '2026-01-11T05:00:00Z' })).toBe(false);
  expect(sameContributionDateRange(current, { ...current, extra: true })).toBe(false);
  api.post.mockResolvedValueOnce(
    success({
      ...contributionData(previousRequest),
      contribution: {
        ...contributionData(previousRequest).contribution,
        dateRange: previous,
      },
    }),
  );
  render(
    <SourceDetails {...previousProps} dateRange={current} previousDateRange={previous} contribution={previousRequest} />,
  );
  await screen.findByText('record-A');
  expect(api.post.mock.lastCall[1]).toMatchObject({ dateRange: current, comparePrevious: true });
  expect(screen.getByText(/이전 기간: day: UTC 2026-01-11 06:00:00 ~ 2026-01-11 08:00:00 \(종료 미포함\)/)).toBeTruthy();
});

it.each(['period', 'previous range', 'compare off', 'source', 'current range'])(
  'previous contributor context change %s hides rows and ignores pending replies',
  async kind => {
    api.post.mockResolvedValueOnce(success(contributionData(previousRequest)));
    const view = render(<SourceDetails {...previousProps} contribution={previousRequest} />);
    await screen.findByText('record-A');
    const late = deferred();
    api.post.mockReturnValueOnce(late.promise);
    fireEvent.click(button('다음 페이지'));
    const signal = api.post.mock.lastCall[2].signal;
    const changed: any = { ...previousProps };
    const request = kind === 'period' ? trendPointRequest : previousRequest;
    if (kind === 'previous range') changed.previousDateRange = { ...previousRange, start: '2026-01-08' };
    if (kind === 'compare off') changed.comparePrevious = false;
    if (kind === 'source') changed.sourceRevision = 'new-source';
    if (kind === 'current range') changed.dateRange = { ...range, start: '2026-01-12' };
    const fresh = deferred();
    api.post.mockReturnValueOnce(fresh.promise);
    view.rerender(<SourceDetails {...changed} contribution={request} />);
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('record-A')).toBeNull();
    await act(async () =>
      late.resolve(success({ ...contributionData(previousRequest, 1), datas: [{ channel: 'old-previous' }] })),
    );
    expect(screen.queryByText('old-previous')).toBeNull();
    if (kind === 'period' || kind === 'source') {
      expect(api.post.mock.lastCall[1]).toMatchObject({ contribution: request, page: 0 });
      await act(async () =>
        fresh.resolve(
          success({
            ...contributionData(request),
            sourceRevision: changed.sourceRevision,
            datas: [{ channel: 'fresh-mode' }],
          }),
        ),
      );
      await screen.findByText('fresh-mode');
    }
  },
);

it.each(['unapplied', 'pending', 'error', 'editing', 'compare off', 'old preview'])(
  'previous contributor numeric live guard %s rejects retained callbacks',
  async kind => {
    await previousAnalysis();
    const select = previousTrendProps().onContributionSelect;
    if (kind === 'unapplied') choose('시작일 (UTC)', '2026-01-12');
    else if (kind === 'editing') fireEvent.click(button('Assistant'));
    else if (kind === 'compare off') {
      fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
      await idle();
    } else {
      const pending = deferred();
      api.post.mockReturnValueOnce(pending.promise);
      fireEvent.click(categoryButton(null));
      if (kind === 'error') {
        await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
        await act(async () => pending.reject(new Error('failed preview')));
      }
      if (kind === 'old preview') {
        await act(async () => pending.resolve(success({ ...previousNumericPreview, sourceRevision: 'new-source' })));
        await idle();
      }
    }
    const count = contributorCalls().length;
    act(() => select(previousTime));
    expect(contributorCalls()).toHaveLength(count);
    expect(screen.queryByRole('dialog')).toBeNull();
  },
);

it.each([
  'current mismatch',
  'previous length',
  'previous gap',
  'previous column',
  'previous precision',
  'no points',
  'fingerprint',
])('previous contributor preview proof %s blocks before transport', async kind => {
  const data: any = structuredClone(previousNumericPreview);
  if (kind === 'current mismatch') data.comparison.current.start = '2026-01-10';
  if (kind === 'previous length') data.comparison.previous.start = '2026-01-08';
  if (kind === 'previous gap') data.comparison.previous = { ...previousRange, start: '2026-01-08', end: '2026-01-09' };
  if (kind === 'previous column') data.comparison.previous.column = 'other';
  if (kind === 'previous precision') data.comparison.previous.precision = 'timestamp';
  if (kind === 'no points') data.widgets[0].previousTrend.points = [];
  if (kind === 'fingerprint') data.widgets[0].previousTrend.contribution.groupFingerprint = 'bad';
  await previousAnalysis(data);
  const select = previousTrendProps().onContributionSelect;
  expect(previousTrendProps().contributionDisabled).toBe(true);
  act(() => select(previousTime));
  expect(contributorCalls()).toHaveLength(0);
});

const previousCategory = '2026-01-09T00:00:00Z';
const previousLinePreview = {
  ...contributorPreview,
  comparison: { current: range, previous: previousRange },
  widgets: [
    {
      ...contributorPreview.widgets[0],
      type: 'CHART_LINE',
      previousDatas: [{ category: previousCategory, amount: 10 }],
      previousTimeSelection: {
        column: 'day',
        grain: 'day',
        ranges: [{ column: 'day', precision: 'timestamp', start: previousCategory, end: '2026-01-10T00:00:00Z' }],
      },
      previousContribution: { supported: true, groupFingerprint: 'd'.repeat(64) },
    },
  ],
};

it('previous contributor safe line group sends stored typed category and fingerprint, preserves dates and restores focus', async () => {
  await previousAnalysis(previousLinePreview);
  const launcher = button(`이전 그룹 ${JSON.stringify(previousCategory)}`);
  launcher.focus();
  await userEvent.keyboard('{Enter}');
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1]).toMatchObject({
    dateRange: range,
    comparePrevious: true,
    contribution: {
      widgetIndex: 0,
      expectedRevision: draft.revision,
      trendGrain: 'auto',
      period: 'previous',
      category: previousCategory,
      groupFingerprint: 'd'.repeat(64),
    },
  });
  button('원본 상세 닫기').focus();
  fireEvent.click(button('원본 상세 닫기'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(launcher);
});

it.each(['bar', 'unsupported', 'fingerprint', 'unaligned', 'unknown group'])(
  'previous contributor line guard %s offers no wrong group request',
  async kind => {
    const data: any = structuredClone(previousLinePreview);
    if (kind === 'bar') data.widgets[0].type = 'CHART_COLUMN';
    if (kind === 'unsupported')
      data.widgets[0].previousContribution = { supported: false, reason: '안전하지 않은 시간 집계' };
    if (kind === 'fingerprint') data.widgets[0].previousContribution.groupFingerprint = '';
    if (kind === 'unaligned') data.widgets[0].previousTimeSelection.ranges = [];
    await previousAnalysis(data);
    const callback = api.previous.mock.lastCall[0].onContributionSelect;
    if (kind === 'bar') expect(callback).toBeUndefined();
    else act(() => callback(kind === 'unknown group' ? 'other' : previousCategory));
    expect(contributorCalls()).toHaveLength(0);
  },
);

it('previous contributor 409 canonical refresh preserves comparison and current dates before reopening previous point', async () => {
  await previousAnalysis();
  fireEvent.click(categoryButton(null));
  await idle();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'changed prior groups' } } });
  fireEvent.click(previousLauncher());
  await screen.findByText(/집계 정의 또는 원본/);
  const nextDraft = { ...trendProps.draft, revision: 'fresh-definition' };
  api.get.mockResolvedValueOnce(success(nextDraft));
  const refreshed = { ...previousNumericPreview, sourceRevision: 'fresh-source' };
  api.post.mockImplementation(async (url, body) =>
    success(
      url === '/ai/dashboard-preview'
        ? refreshed
        : {
            ...contributionData(body.contribution),
            sourceRevision: body.sourceRevision,
          },
    ),
  );
  fireEvent.click(button('대시보드 데이터 새로 조회'));
  await idle();
  expect(previewCalls().at(-1)[1]).toMatchObject({
    draft: nextDraft,
    dateRange: range,
    comparePrevious: true,
    filters: [{ column: 'channel', values: [null] }],
  });
  fireEvent.click(previousLauncher());
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1]).toMatchObject({
    dateRange: range,
    comparePrevious: true,
    sourceRevision: 'fresh-source',
    contribution: { ...previousRequest, expectedRevision: nextDraft.revision },
  });
});

it('previous contributor stored NULL line group is distinct from string null without local range inference', async () => {
  const widget = previousLinePreview.widgets[0];
  await previousAnalysis({
    ...previousLinePreview,
    widgets: [
      {
        ...widget,
        previousDatas: [...widget.previousDatas, { category: null, amount: 10 }],
        previousTimeSelection: { ...widget.previousTimeSelection, ranges: [...widget.previousTimeSelection.ranges, null] },
      },
    ],
  });
  const callback = api.previous.mock.lastCall[0].onContributionSelect;
  act(() => callback('null'));
  expect(contributorCalls()).toHaveLength(0);
  act(() => callback(null));
  await screen.findByText('record-A');
  expect(contributorCalls().at(-1)[1].contribution).toMatchObject({ period: 'previous', category: null });
});

it.each(['success', 'failure'])(
  'retry focus recovery %s keeps focus on the stable named close button and Escape closes',
  async outcome => {
    api.post.mockRejectedValueOnce({ response: { status: 503, data: { message: '일시적 조회 오류' } } });
    const pending = deferred();
    api.post.mockReturnValueOnce(pending.promise);
    render(<SourceDetails {...previousProps} contribution={previousRequest} />);
    await screen.findByText('일시적 조회 오류');
    const retry = button('원본 행 다시 조회');
    const close = button('원본 상세 닫기');
    const originalRequest = api.post.mock.calls[0][1];
    retry.focus();
    await userEvent.keyboard('{Enter}');
    expect(retry.isConnected).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '원본 상세 닫기' })).toBe(close);
    expect(api.post.mock.lastCall[1]).toEqual(originalRequest);
    if (outcome === 'success') {
      await act(async () => pending.resolve(success(contributionData(previousRequest))));
      await screen.findByText('record-A');
    } else {
      await waitFor(() => expect(api.post.mock.results.some(result => result.value === pending.promise)).toBe(true));
      await act(async () => pending.reject(new Error('재시도 오류')));
      await screen.findByText('재시도 오류');
    }
    expect(document.activeElement).toBe(close);
    await userEvent.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  },
);

it('retry focus recovery does not steal focus moved by the user while the request is pending', async () => {
  api.post.mockRejectedValueOnce(new Error('조회 오류'));
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  render(<SourceDetails {...previousProps} contribution={previousRequest} />);
  await screen.findByText('조회 오류');
  button('원본 행 다시 조회').focus();
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(button('원본 상세 닫기'));
  const other = document.createElement('button');
  other.textContent = '사용자가 선택한 대상';
  screen.getByRole('dialog').append(other);
  other.focus();
  await act(async () => pending.resolve(success(contributionData(previousRequest))));
  await screen.findByText('record-A');
  expect(document.activeElement).toBe(other);
  await userEvent.keyboard('{Escape}');
  expect(props.onClose).toHaveBeenCalledTimes(1);
});
