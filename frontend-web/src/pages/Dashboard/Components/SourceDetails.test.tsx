import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SourceDetails, { canRequestNextPage } from './SourceDetails';
import DashboardAnalysis from './DashboardAnalysis';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), widget: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('./DashboardAssistant', () => ({ default: () => null }));
vi.mock('./MetricTrend', () => ({ default: () => null }));
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
      </div>
    );
  },
}));
vi.mock('@mui/material', () => {
  const Container = React.forwardRef<HTMLElement, any>(
    (
      { children, component: Tag = 'div', role, id, onSubmit, 'aria-label': label, 'aria-live': live, sx, tabIndex },
      ref,
    ) => (
      <Tag
        ref={ref}
        role={role}
        id={id}
        onSubmit={onSubmit}
        aria-label={label}
        aria-live={live}
        tabIndex={tabIndex}
        style={{ maxHeight: sx?.maxHeight, maxWidth: sx?.maxWidth, overflow: sx?.overflow }}
      >
        {children}
      </Tag>
    ),
  );
  return {
    Box: Container,
    Stack: Container,
    Card: ({ children, sx }: any) => (
      <div data-testid="analysis-card" data-height={sx?.height}>
        {children}
      </div>
    ),
    Typography: Container,
    FormControl: Container,
    InputLabel: Container,
    DialogContent: Container,
    DialogActions: Container,
    DialogTitle: ({ children, id }: any) => <h2 id={id}>{children}</h2>,
    Dialog: ({ open, children, onClose, TransitionProps, ...props }: any) => {
      const wasOpen = React.useRef(false);
      React.useEffect(() => {
        if (wasOpen.current && !open) TransitionProps?.onExited();
        wasOpen.current = open;
      }, [open]);
      return open ? (
        <div
          role="dialog"
          aria-labelledby={props['aria-labelledby']}
          aria-describedby={props['aria-describedby']}
          onKeyDown={event => {
            if (event.key === 'Escape') onClose();
          }}
        >
          {children}
        </div>
      ) : null;
    },
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    LinearProgress: () => <div role="progressbar" />,
    Checkbox: ({ checked }: any) => <input type="checkbox" checked={checked} readOnly />,
    Button: React.forwardRef<HTMLButtonElement, any>(
      ({ children, disabled, onClick, autoFocus, type = 'button', ...props }, ref) => (
        <button
          ref={ref}
          type={type}
          disabled={disabled}
          onClick={onClick}
          autoFocus={autoFocus}
          aria-label={props['aria-label']}
          aria-disabled={props['aria-disabled']}
        >
          {children}
        </button>
      ),
    ),
    TextField: ({ label, value, onChange, disabled, type, select, children, inputProps }: any) => (
      <label>
        {label}
        {select ? (
          <select value={value} onChange={onChange} disabled={disabled}>
            {children}
          </select>
        ) : (
          <input type={type} value={value} onChange={onChange} disabled={disabled} maxLength={inputProps?.maxLength} />
        )}
      </label>
    ),
    MenuItem: ({ value, children }: any) => <option value={value}>{children}</option>,
    Select: ({ label, multiple, value, onChange, children, disabled }: any) => (
      <select
        aria-label={label}
        multiple={multiple}
        value={value}
        disabled={disabled}
        onChange={event =>
          onChange({
            target: {
              value: multiple ? Array.from(event.target.selectedOptions).map(option => option.value) : event.target.value,
            },
          })
        }
      >
        {children}
      </select>
    ),
  };
});

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
const idle = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
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
afterEach(cleanup);

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
  expect(region.style.maxHeight).toBe('50dvh');
  expect(region.style.maxWidth).toBe('100%');
  expect(region.style.overflow).toBe('auto');
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
  choose('페이지당 행 수', '50');
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({ page: 0, pageSize: 50 });
  choose('페이지당 행 수', '100');
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
async function analysis(data = preview) {
  api.get.mockResolvedValue(success(draft));
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
  choose('시계열 집계 단위', 'week');
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
  expect(previewCalls().at(-1)[1].filters).toEqual([{ column: 'channel', values: [null] }]);
  expect(categoryButton('null').disabled).toBe(true);
  expect(button('원본 상세 보기').disabled).toBe(false);
  expect(button('원본 상세 보기').getAttribute('aria-disabled')).toBe('true');
  const before = api.post.mock.calls.length;
  fireEvent.click(categoryButton('null'));
  expect(api.post).toHaveBeenCalledTimes(before);
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
  const widgets = screen.getAllByTestId('widget');
  for (let i = 0; i < 50; i++) {
    fireEvent.click(within(widgets[0]).getByRole('button', { name: `차원 ${i}`, exact: true }));
    await idle();
  }
  fireEvent.click(within(widgets[0]).getByRole('button', { name: '차원 50', exact: true }));
  expect(screen.getByText(/최대 50개 값까지 선택/)).toBeTruthy();
  expect(previewCalls().at(-1)[1].filters[0].values).toHaveLength(50);
  for (let i = 1; i < 5; i++) {
    fireEvent.click(within(widgets[i]).getByRole('button', { name: '차원 0', exact: true }));
    await idle();
  }
  const before = previewCalls().length;
  fireEvent.click(within(widgets[5]).getByRole('button', { name: '차원 0', exact: true }));
  expect(screen.getByText(/최대 5개 컬럼까지 선택/)).toBeTruthy();
  expect(previewCalls()).toHaveLength(before);
  fireEvent.click(within(widgets[0]).getByRole('button', { name: '차원 0', exact: true }));
  await idle();
  expect(previewCalls().at(-1)[1].filters[0].values).toHaveLength(49);
});

it('opens current filtered source details globally, restores trigger focus, and refreshes preview on stale version', async () => {
  await analysis();
  fireEvent.click(categoryButton(null));
  await idle();
  button('원본 상세 보기').focus();
  fireEvent.click(button('원본 상세 보기'));
  await screen.findByText('record-A');
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
  expect((screen.getByLabelText('__proto__') as HTMLSelectElement).value).toBe('');
  expect((screen.getByLabelText('constructor') as HTMLSelectElement).value).toBe('');
  fireEvent.click(categoryButton('proto-value'));
  await idle();
  fireEvent.click(categoryButton('constructor-value'));
  await idle();
  expect(previewCalls().at(-1)[1].filters).toEqual([
    { column: '__proto__', values: ['proto-value'] },
    { column: 'constructor', values: ['constructor-value'] },
  ]);
  expect((screen.getByLabelText('__proto__') as HTMLSelectElement).selectedOptions).toHaveLength(1);
  expect((screen.getByLabelText('constructor') as HTMLSelectElement).selectedOptions).toHaveLength(1);
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

it('retains stale refresh focus when MUI automatically restores the enabled launcher before preview is pending', async () => {
  await analysis();
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { message: 'stale file' } } });
  button('원본 상세 보기').focus();
  fireEvent.click(button('원본 상세 보기'));
  await screen.findByText(/원본 데이터 버전이 변경되었습니다/);
  const pending = deferred();
  // Reproduce MUI's automatic launcher restoration during the close/preview commit.
  // aria-disabled preserves native focus while the guarded action remains unavailable.
  api.post.mockImplementationOnce(() => {
    const launcher = button('원본 상세 보기');
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
