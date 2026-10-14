vi.mock('./DashboardPivots', () => ({ default: () => null }));
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardAnalysis from './DashboardAnalysis';
import userEvent from '@testing-library/user-event';
import type { DateRange } from './PersonalSavedViews';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), timeProps: vi.fn() }));
vi.mock('@/helpers/apiHelper', () => api);
vi.mock('./DashboardAssistant', () => ({ default: () => null }));
// Saved-view API/UI behavior is exercised by PersonalSavedViews.test.tsx.
vi.mock('./PersonalSavedViews', async importOriginal => ({
  ...(await importOriginal<typeof import('./PersonalSavedViews')>()),
  default: ({ state, disabledReason }: any) => (
    <span data-testid="saved-state" data-blocked={disabledReason}>
      {JSON.stringify(state)}
    </span>
  ),
}));
vi.mock('./MetricTrend', () => ({
  default: ({ trend, onTimeSelect, timeSelectionDisabled, selectedTimeRange }: any) => (
    <span data-testid="trend-range">
      {JSON.stringify(selectedTimeRange)}
      {onTimeSelect &&
        trend?.timeSelection?.ranges.map((range: DateRange, i: number) => (
          <button key={range.start} aria-disabled={timeSelectionDisabled} onClick={() => onTimeSelect(range)}>
            KPI 기간 {i}
          </button>
        ))}
    </span>
  ),
}));
vi.mock('@/widget/wrapper/WidgetViewer', () => ({
  default: ({ dataSet, description, timeSelection, onTimeSelect, timeSelectionDisabled, selectedTimeRange }: any) => {
    api.timeProps(onTimeSelect);
    return (
      <span>
        {description}
        <span data-testid="line-range">{JSON.stringify(selectedTimeRange)}</span>
        <span>{dataSet[0].requests}</span>
        {onTimeSelect &&
          timeSelection?.ranges.map((range: DateRange, i: number) => (
            <button key={range.start} aria-disabled={timeSelectionDisabled} onClick={() => onTimeSelect(range)}>
              차트 기간 {i}
            </button>
          ))}
        {onTimeSelect && (
          <svg>
            {timeSelection?.ranges.map((range: DateRange, i: number) => (
              <g
                key={range.start}
                tabIndex={0}
                role="button"
                aria-label={`SVG 기간 ${i}`}
                onClick={() => onTimeSelect(range)}
                onKeyDown={event => {
                  if (event.key === 'Enter') onTimeSelect(range);
                }}
              />
            ))}
          </svg>
        )}
      </span>
    );
  },
}));
// The repository's Vitest runtime cannot import the Emotion/MUI styled engine.
// Model the Select array event contract while keeping primitive menu values intact.
vi.mock('@mui/material', () => {
  const container = ({ children, component: Tag = 'div' }: any) => <Tag>{children}</Tag>;
  return {
    Box: container,
    Card: container,
    Stack: container,
    Typography: container,
    FormControl: container,
    InputLabel: container,
    Checkbox: ({ checked }: any) => <input type="checkbox" checked={checked} readOnly />,
    Button: React.forwardRef<HTMLButtonElement, any>(({ children, onClick, disabled, ...props }, ref) => (
      <button ref={ref} onClick={onClick} disabled={disabled} aria-disabled={props['aria-disabled']}>
        {children}
      </button>
    )),
    Alert: ({ children }: any) => <div role="alert">{children}</div>,
    LinearProgress: () => <div role="progressbar" />,
    TextField: ({ label, value, onChange, type }: any) => (
      <label>
        {label}
        <input type={type} value={value} onChange={onChange} />
      </label>
    ),
    Select: ({ label, children, value, onChange, multiple, disabled, renderValue }: any) => {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button role="combobox" aria-label={label} disabled={disabled} onMouseDown={() => setOpen(true)}>
            {renderValue ? renderValue(value) : value}
          </button>
          {open && (
            <div
              role="listbox"
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen(false);
              }}
            >
              {React.Children.map(React.Children.toArray(children), (child: any) => (
                <div
                  role="option"
                  aria-selected={multiple ? value.includes(child.props.value) : value === child.props.value}
                  onClick={() => {
                    if (!child.props.disabled)
                      onChange({
                        target: {
                          value: multiple
                            ? value.includes(child.props.value)
                              ? value.filter((key: string) => key !== child.props.value)
                              : [...value, child.props.value]
                            : child.props.value,
                        },
                      });
                  }}
                >
                  {child.props.children}
                </div>
              ))}
            </div>
          )}
        </>
      );
    },
    MenuItem: container,
  };
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const response = (data: any) => ({ data: { status: 'SUCCESS', data } });
const preview = (requests: number) => ({
  widgets: [{ type: 'BOARD_NUMERIC', title: 'Requests', valueField: 'requests', datas: [{ requests }] }],
  dimensions: [{ column: 'device_type', values: ['Mobile/Tablet', 1, '1', true, null, 'a,b'] }],
  temporalColumns: [{ column: 'created_at', min: null, max: null }],
});
const mount = async (data: any = preview(10)) => {
  api.get.mockResolvedValue(response({ databaseId: 3, widgets: [] }));
  api.post.mockResolvedValue(response(data));
  const view = render(
    <DashboardAnalysis dashboardId={3} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByText(String(data.widgets[0].datas[0].requests));
  const settings = screen.queryByText('기간·필터 설정');
  if (settings) fireEvent.click(settings);
  return view;
};
const idle = () => waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
const choose = async (label: string, option: string, index = 0) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: label }));
  fireEvent.click(within(screen.getByRole('listbox')).getAllByRole('option', { name: option })[index]);
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  await idle();
};
const dates = (start: string, end: string) => {
  fireEvent.change(screen.getByLabelText('시작일 (UTC)'), { target: { value: start } });
  fireEvent.change(screen.getByLabelText('종료일 (UTC)'), { target: { value: end } });
};
it('preserves all primitive types, deselects values, and restores after a failed query', async () => {
  await mount();
  await choose('device_type', 'Mobile/Tablet');
  await choose('device_type', 'true');
  await choose('device_type', 'null');
  await choose('device_type', 'a,b');
  await choose('device_type', '1');
  await choose('device_type', '1', 1);
  expect(api.post.mock.lastCall?.[1].filters).toEqual([
    { column: 'device_type', values: ['Mobile/Tablet', true, null, 'a,b', 1, '1'] },
  ]);
  api.post.mockRejectedValueOnce(new Error('worker unavailable'));
  await choose('device_type', 'Mobile/Tablet');
  expect(api.post.mock.lastCall?.[1].filters[0].values).toEqual([true, null, 'a,b', 1, '1']);
  expect((await screen.findByRole('alert')).textContent).toContain('worker unavailable');
  expect(screen.getByText(/이전 조회 결과 · 현재 선택 조건 미적용/)).toBeTruthy();
  expect(screen.queryByText(/선택한 필터 적용/)).toBeNull();
  expect(screen.getByText('10')).toBeTruthy();
  fireEvent.click(screen.getByText('전체 데이터로 복구'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  await idle();
  expect(screen.queryByText(/이전 조회 결과 · 현재 선택 조건 미적용/)).toBeNull();
  expect(api.post.mock.lastCall?.[1].filters).toEqual([]);
});
it('stages UTC dates, rejects partial/reversed ranges without querying, and applies all time', async () => {
  await mount();
  dates('2024-02-29', '');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('적용'));
  expect(screen.getByRole('alert').textContent).toContain('시작일과 종료일');
  expect(api.post).toHaveBeenCalledTimes(1);
  dates('2024-03-02', '2024-03-01');
  fireEvent.click(screen.getByText('적용'));
  expect(api.post).toHaveBeenCalledTimes(1);
  dates('2024-02-29', '2024-02-29');
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.lastCall?.[1].dateRange).toEqual({ column: 'created_at', start: '2024-02-29', end: '2024-02-29' });
  await idle();
  dates('', '');
  expect(api.post).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
});
it('stages multiple temporal columns and resets all applied and edited filters', async () => {
  await mount({
    ...preview(10),
    temporalColumns: [
      { column: 'created_at', min: null, max: null },
      { column: 'updated_at', min: null, max: null },
    ],
  });
  await choose('날짜 컬럼 (UTC)', 'updated_at');
  dates('2024-01-01', '2024-01-31');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('적용'));
  await waitFor(() => expect(api.post.mock.lastCall?.[1].dateRange?.column).toBe('updated_at'));
  await idle();
  await choose('device_type', 'true');
  expect(api.post.mock.lastCall?.[1].dateRange.column).toBe('updated_at');
  dates('2024-02-01', '');
  fireEvent.click(screen.getByText('적용'));
  fireEvent.click(screen.getByText('필터 초기화'));
  await waitFor(() => expect(api.post.mock.lastCall?.[1].filters).toEqual([]));
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
  expect((screen.getByLabelText('시작일 (UTC)') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('종료일 (UTC)') as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('alert')).toBeNull();
});
it('limits dimensions and offered values to five and fifty', async () => {
  await mount({
    ...preview(10),
    dimensions: Array.from({ length: 6 }, (_, i) => ({
      column: `column${i}`,
      values: Array.from({ length: 51 }, (_, j) => j),
    })),
  });
  expect(screen.getAllByRole('combobox', { name: /^column/ })).toHaveLength(5);
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'column0' }));
  expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(50);
});
it.each(['error', 'success'])('ignores stale %s after switching dashboards', async outcome => {
  const view = await mount();
  let rejectOld: (reason: Error) => void = () => undefined;
  let resolveOld: (value: any) => void = () => undefined;
  api.post.mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        resolveOld = resolve;
        rejectOld = reject;
      }),
  );
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'device_type' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'true' }));
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  api.post.mockResolvedValue(response(preview(42)));
  view.rerender(
    <DashboardAnalysis dashboardId={4} onSaved={vi.fn()}>
      Fallback
    </DashboardAnalysis>,
  );
  await screen.findByText('42');
  await act(async () => {
    if (outcome === 'error') rejectOld(new Error('stale error'));
    else resolveOld(response(preview(999)));
  });
  await idle();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByText('42')).toBeTruthy();
});

it('keeps ordinary previews without temporal metadata usable', async () => {
  await mount({ ...preview(10), temporalColumns: [] });
  expect(screen.queryByLabelText('시작일 (UTC)')).toBeNull();
  expect(screen.queryByText('적용')).toBeNull();
  await choose('device_type', 'true');
  expect(api.post.mock.lastCall?.[1].filters).toEqual([{ column: 'device_type', values: [true] }]);
  expect(api.post.mock.lastCall?.[1]).not.toHaveProperty('dateRange');
});

it('keeps the three-widget preview visible when a one-widget revision awaits repreview', async () => {
  class RenderBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    render() {
      return this.state.error ? <div data-testid="render-error">{this.state.error.message}</div> : this.props.children;
    }
  }
  const oldDraft = {
    databaseId: 3,
    widgets: Array.from({ length: 3 }, () => ({ type: 'BOARD_NUMERIC' })),
    layoutSizes: [
      { width: 6, height: 3 },
      { width: 6, height: 5 },
      { width: 12, height: 7 },
    ],
  };
  const oldPreview = {
    ...preview(11),
    draft: oldDraft,
    widgets: [11, 22, 33].map(requests => ({ ...preview(requests).widgets[0] })),
  };
  const nextDraft = { ...oldDraft, widgets: oldDraft.widgets.slice(0, 1), layoutSizes: [{ width: 12, height: 3 }] };
  let resolveAnalysis: (value: any) => void = () => undefined;
  let resolvePreview: (value: any) => void = () => undefined;
  api.get.mockResolvedValueOnce(response(oldDraft)).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolveAnalysis = resolve;
      }),
  );
  api.post.mockResolvedValueOnce(response(oldPreview)).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        resolvePreview = resolve;
      }),
  );
  const content = (revision: number) => (
    <RenderBoundary>
      <DashboardAnalysis dashboardId={3} revision={revision} onSaved={vi.fn()}>
        Fallback
      </DashboardAnalysis>
    </RenderBoundary>
  );
  const view = render(content(1));
  await screen.findByText('33');
  await idle();
  view.rerender(content(2));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolveAnalysis(response(nextDraft));
  });
  // A render error must fail the test; catching it avoids an unhandled React error.
  expect(screen.queryByTestId('render-error')).toBeNull();
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByText('11')).toBeTruthy();
  expect(screen.getByText('22')).toBeTruthy();
  expect(screen.getByText('33')).toBeTruthy();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await act(async () => {
    resolvePreview(response({ ...preview(44), draft: nextDraft }));
  });
  await idle();
  expect(screen.getByText('44')).toBeTruthy();
  expect(screen.queryByText('22')).toBeNull();
  expect(screen.queryByText('33')).toBeNull();
});

const hourRange: DateRange = {
  column: 'created_at',
  start: '2026-01-11T10:00:00Z',
  end: '2026-01-11T11:00:00Z',
  precision: 'timestamp',
};
const timePreview = (ranges: DateRange[] = [hourRange]) => {
  const selection = { column: 'created_at', grain: 'hour', ranges };
  return {
    ...preview(10),
    widgets: [
      {
        ...preview(10).widgets[0],
        timeSelection: selection,
        trend: { timeSelection: selection, points: ranges.map(range => ({ time: range.start, value: 10 })) },
      },
    ],
  };
};
const recovery = () => screen.getByRole('button', { name: '선택한 기간 되돌리기' }) as HTMLButtonElement;
const savedState = () => JSON.parse(screen.getByTestId('saved-state').textContent);
const stageAndApply = async (start: string, end: string) => {
  dates(start, end);
  fireEvent.click(screen.getByText('적용'));
  await idle();
};
function pendingPreview() {
  let resolve!: (value: any) => void;
  let reject!: (value: any) => void;
  api.post.mockReturnValueOnce(
    new Promise((done, fail) => {
      resolve = done;
      reject = fail;
    }),
  );
  return { resolve, reject };
}

it.each(['차트', 'KPI'])(
  'time bucket %s applies exact UTC hour and retains categories, grain and comparison',
  async label => {
    await mount(timePreview());
    await choose('device_type', 'true');
    await stageAndApply('2026-01-01', '2026-01-31');
    fireEvent.click(screen.getByRole('checkbox', { name: '이전 기간 비교' }));
    await idle();
    // The mocked grain TextField is a native input; production uses a select.
    fireEvent.change(screen.getByLabelText('시계열 집계 단위'), { target: { value: 'week' } });
    await idle();
    fireEvent.click(screen.getByRole('button', { name: `${label} 기간 0` }));
    await idle();
    expect(api.post.mock.lastCall[1]).toMatchObject({
      dateRange: hourRange,
      filters: [{ column: 'device_type', values: [true] }],
      trendGrain: 'week',
      comparePrevious: true,
    });
    expect(screen.getByLabelText('시작일 (UTC)')).toHaveProperty('value', '2026-01-11');
    expect(screen.getByLabelText('종료일 (UTC)')).toHaveProperty('value', '2026-01-11');
    expect(screen.getAllByText(/created_at: UTC 2026-01-11 10:00:00 ~ 2026-01-11 11:00:00 \(종료 미포함\)/)).toHaveLength(2);
    expect(screen.getByTestId('saved-state').dataset.blocked).toBe('');
    expect(savedState()).toMatchObject({ dateRange: hourRange, relativePeriod: null });
    expect(screen.getByTestId('line-range').textContent).toBe(JSON.stringify(hourRange));
    expect(screen.getByTestId('trend-range').textContent).toContain(JSON.stringify(hourRange));
  },
);

it('time bucket displays the last included UTC day for a midnight end and manual apply deliberately returns to inclusive days', async () => {
  const month: DateRange = { ...hourRange, start: '2026-01-01T00:00:00Z', end: '2026-02-01T00:00:00Z' };
  await mount(timePreview([month]));
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  expect(screen.getByLabelText('종료일 (UTC)')).toHaveProperty('value', '2026-01-31');
  expect(screen.getByTestId('saved-state').dataset.blocked).toBe('');
  fireEvent.click(screen.getByText('적용'));
  await idle();
  expect(api.post.mock.lastCall[1].dateRange).toEqual({ column: 'created_at', start: '2026-01-01', end: '2026-01-31' });
  expect(recovery().getAttribute('aria-disabled')).toBe('true');
});

it.each(['pending', 'error', 'unapplied', 'invalid', 'malformed'])(
  'time bucket guards %s callbacks without changing current range',
  async blocked => {
    await mount(timePreview(blocked === 'malformed' ? [{ ...hourRange, end: hourRange.start }] : [hourRange]));
    if (blocked === 'pending' || blocked === 'error') {
      const pending = pendingPreview();
      fireEvent.click(screen.getByText('최근 기간 적용'));
      if (blocked === 'error') await act(async () => pending.reject(new Error('조회 실패')));
    } else if (blocked === 'unapplied' || blocked === 'invalid') {
      dates('2026-01-31', blocked === 'invalid' ? '2026-01-01' : '2026-02-01');
      if (blocked === 'invalid') fireEvent.click(screen.getByText('적용'));
    }
    const count = api.post.mock.calls.length;
    const before = savedState();
    if (blocked === 'malformed') {
      expect(screen.queryByRole('button', { name: '차트 기간 0' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'KPI 기간 0' })).toBeNull();
    } else {
      fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
      fireEvent.click(screen.getByRole('button', { name: 'KPI 기간 0' }));
    }
    expect(api.post).toHaveBeenCalledTimes(count);
    expect(savedState()).toEqual(before);
    expect(recovery().getAttribute('aria-disabled')).toBe('true');
  },
);

it('time bucket restores the relative expression and original day inputs while preserving newly changed categories', async () => {
  await mount(timePreview());
  fireEvent.click(screen.getByText('최근 기간 적용'));
  await idle();
  const previous = api.post.mock.lastCall[1].dateRange;
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  expect(savedState().relativePeriod).toBeNull();
  await choose('device_type', 'true');
  recovery().focus();
  const pending = pendingPreview();
  fireEvent.click(recovery());
  expect(api.post.mock.lastCall[1]).toMatchObject({
    dateRange: previous,
    filters: [{ column: 'device_type', values: [true] }],
  });
  expect(savedState().relativePeriod).toEqual({ column: 'created_at', days: 7 });
  expect(recovery().disabled).toBe(false);
  expect(recovery().getAttribute('aria-disabled')).toBe('true');
  expect(document.activeElement).toBe(recovery());
  fireEvent.click(recovery());
  expect(api.post).toHaveBeenCalledTimes(5);
  await act(async () => pending.resolve(response(timePreview())));
  await idle();
  expect(document.activeElement).toBe(recovery());
  expect(screen.getByLabelText('시작일 (UTC)')).toHaveProperty('value', previous.start);
});

it('time bucket keeps at most ten period backups and reset clears them', async () => {
  await mount(timePreview());
  for (let i = 0; i < 12; i++) {
    fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
    await idle();
  }
  for (let i = 0; i < 10; i++) {
    expect(recovery().getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(recovery());
    await idle();
  }
  expect(recovery().getAttribute('aria-disabled')).toBe('true');
  expect(api.post.mock.lastCall[1].dateRange).toEqual(hourRange);
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  fireEvent.click(screen.getByText('필터 초기화'));
  await idle();
  expect(recovery().getAttribute('aria-disabled')).toBe('true');
  expect(api.post.mock.lastCall[1]).not.toHaveProperty('dateRange');
});

it.each(['{enter}', ' '])('time bucket keyboard %s recovers only removed row focus after successful preview', async key => {
  await mount(timePreview());
  const button = screen.getByRole('button', { name: '차트 기간 0' });
  button.focus();
  const pending = pendingPreview();
  userEvent.keyboard(key);
  expect(document.activeElement).toBe(button);
  expect(recovery().getAttribute('aria-disabled')).toBe('true');
  await act(async () => pending.resolve(response(timePreview([]))));
  await idle();
  expect(document.activeElement).toBe(recovery());
});

it.each(['surviving', 'moved', 'failed'])('time bucket avoids stealing %s focus after preview', async kind => {
  await mount(timePreview());
  const button = screen.getByRole('button', { name: 'KPI 기간 0' });
  button.focus();
  const pending = pendingPreview();
  userEvent.keyboard('{enter}');
  const elsewhere = screen.getByRole('button', { name: 'Assistant' });
  if (kind === 'moved') elsewhere.focus();
  await act(async () => {
    if (kind === 'failed') pending.reject(new Error('집계 실패'));
    else pending.resolve(response(timePreview(kind === 'moved' ? [] : [hourRange])));
  });
  await idle();
  expect(document.activeElement).toBe(kind === 'moved' ? elsewhere : button);
});

it.each(['absent', 'unaligned', 'null', 'other-column'])(
  'time bucket %s metadata leaves ordinary chart and KPI previews noninteractive',
  async kind => {
    const data = timePreview();
    const ranges =
      kind === 'unaligned' ? [hourRange, hourRange] : kind === 'null' ? [null] : [{ ...hourRange, column: 'other' }];
    const selection = kind === 'absent' ? undefined : { column: 'created_at', grain: 'hour', ranges };
    await mount({
      ...data,
      widgets: [
        { ...data.widgets[0], timeSelection: selection, trend: { ...data.widgets[0].trend, timeSelection: selection } },
      ],
    } as any);
    expect(screen.queryByRole('button', { name: '차트 기간 0' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'KPI 기간 0' })).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(1);
  },
);

it.each([
  ['day', '2026-01-11T00:00:00Z', '2026-01-12T00:00:00Z'],
  ['week', '2026-01-11T00:00:00Z', '2026-01-12T00:00:00Z'],
  ['month', '2026-01-11T00:00:00Z', '2026-02-01T00:00:00Z'],
])('time bucket applies server-proven %s bounds without inferring full calendar periods', async (grain, start, end) => {
  const range = { ...hourRange, start, end };
  const data = timePreview([range]);
  await mount({ ...data, widgets: [{ ...data.widgets[0], timeSelection: { ...data.widgets[0].timeSelection, grain } }] });
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  expect(api.post.mock.lastCall[1].dateRange).toEqual(range);
});

it.each(['removed', 'surviving'])(
  'time bucket SVG %s focus follows the same recovery rule as native buttons',
  async kind => {
    await mount(timePreview());
    const point = screen.getByRole('button', { name: 'SVG 기간 0' }) as unknown as SVGElement;
    (point as SVGElement & { focus: () => void }).focus();
    expect(document.activeElement).toBe(point);
    const pending = pendingPreview();
    fireEvent.keyDown(point, { key: 'Enter' });
    await act(async () => pending.resolve(response(timePreview(kind === 'removed' ? [] : [hourRange]))));
    await idle();
    expect(document.activeElement).toBe(kind === 'removed' ? recovery() : point);
  },
);

it('time bucket failed preview keeps undo accessible and recovers the exact prior timestamp range', async () => {
  const first = { ...hourRange, start: '2026-01-11T00:00:00Z', end: '2026-01-12T00:00:00Z' };
  await mount(timePreview([first]));
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  api.post.mockResolvedValueOnce(response(timePreview()));
  await choose('device_type', 'true');
  api.post.mockRejectedValueOnce(new Error('선택 기간 조회 실패'));
  fireEvent.click(screen.getByRole('button', { name: 'KPI 기간 0' }));
  await screen.findByText('선택 기간 조회 실패');
  expect(savedState().dateRange).toEqual(hourRange);
  expect(recovery().getAttribute('aria-disabled')).toBe('false');
  recovery().focus();
  userEvent.keyboard('{enter}');
  await idle();
  expect(api.post.mock.lastCall[1]).toMatchObject({
    dateRange: first,
    filters: [{ column: 'device_type', values: [true] }],
  });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(document.activeElement).toBe(recovery());
});

it('time bucket different active date column stays plain and rejects callbacks until the period is cleared', async () => {
  await mount(timePreview());
  await stageAndApply('2026-01-01', '2026-01-31');
  const selected = savedState();
  const count = api.post.mock.calls.length;
  const otherRange = { ...hourRange, column: 'updated_at' };
  act(() => api.timeProps.mock.lastCall[0](otherRange));
  expect(api.post).toHaveBeenCalledTimes(count);
  expect(savedState()).toEqual(selected);
  expect(recovery().getAttribute('aria-disabled')).toBe('true');

  const data = timePreview([otherRange]);
  const otherSelection = { ...data.widgets[0].timeSelection, column: 'updated_at' };
  const otherPreview = {
    ...data,
    widgets: [
      {
        ...data.widgets[0],
        timeSelection: otherSelection,
        trend: { ...data.widgets[0].trend, timeSelection: otherSelection },
      },
    ],
  };
  api.post.mockResolvedValue(response(otherPreview));
  fireEvent.change(screen.getByLabelText('시계열 집계 단위'), { target: { value: 'day' } });
  await idle();
  expect(screen.queryByRole('button', { name: '차트 기간 0' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'KPI 기간 0' })).toBeNull();
  expect(savedState().dateRange).toEqual(selected.dateRange);
  expect(recovery().getAttribute('aria-disabled')).toBe('true');

  await stageAndApply('', '');
  fireEvent.click(screen.getByRole('button', { name: '차트 기간 0' }));
  await idle();
  expect(api.post.mock.lastCall[1].dateRange).toEqual(otherRange);
});
it('applies KST calendar dates to preview and saved state', async () => {
  await mount();
  await idle();
  await choose('업무 시간대', '한국 (Asia/Seoul)');
  fireEvent.change(screen.getByLabelText('시작일 (Asia/Seoul)'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('종료일 (Asia/Seoul)'), { target: { value: '2026-01-02' } });
  fireEvent.click(screen.getByRole('button', { name: '적용', exact: true }));
  await waitFor(() =>
    expect(api.post).toHaveBeenLastCalledWith(
      '/ai/dashboard-preview',
      expect.objectContaining({
        dateRange: { column: 'created_at', start: '2026-01-01', end: '2026-01-02', timeZone: 'Asia/Seoul' },
      }),
      expect.anything(),
    ),
  );
  expect(JSON.parse(screen.getByTestId('saved-state').textContent).dateRange.timeZone).toBe('Asia/Seoul');
});

it('keeps business timezone when selecting a KPI bucket', async () => {
  const range = { ...hourRange, start: '2025-12-31T15:00:00Z', end: '2026-01-01T15:00:00Z', timeZone: 'Asia/Seoul' };
  const data = timePreview([range]);
  await mount(data);
  fireEvent.click(screen.getByRole('button', { name: 'KPI 기간 0' }));
  await idle();
  expect(api.post.mock.lastCall[1].dateRange).toEqual(range);
});

it('keeps settings collapsed by default and preserves conditions on disclosure toggle', async () => {
  await mount();
  await choose('device_type', 'Mobile/Tablet');
  const summary = screen.getByText('기간·필터 설정');
  const disclosure = summary.closest('details');
  expect(disclosure?.open).toBe(true);
  const calls = api.post.mock.calls.length;
  fireEvent.click(summary);
  expect(disclosure?.open).toBe(false);
  expect(screen.getByTestId('saved-state').textContent).toContain('Mobile/Tablet');
  fireEvent.click(summary);
  expect(disclosure?.open).toBe(true);
  expect(api.post.mock.calls.length).toBe(calls);
});

it('starts with only the applied summary visible without changing the query', async () => {
  api.get.mockResolvedValue(response({ databaseId: 3, widgets: [] }));
  api.post.mockResolvedValue(response(preview(10)));
  render(<DashboardAnalysis dashboardId={3}>Fallback</DashboardAnalysis>);
  await screen.findByText('10');
  expect(screen.getByText('기간·필터 설정').closest('details')?.open).toBe(false);
  expect(screen.getByText('개인 저장 보기').closest('details')?.open).toBe(false);
  expect(api.post.mock.calls[0][1]).toMatchObject({ filters: [], comparePrevious: false });
});
