import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LineChart from './LineChart';
import WidgetViewer from '@/widget/wrapper/WidgetViewer';
import { LoadingContext } from '@/contexts/LoadingContext';
import userEvent from '@testing-library/user-event';

const state = vi.hoisted(() => ({ option: null as any, events: undefined as any }));
vi.mock('echarts-for-react', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props: any, ref) => {
      state.option = props.option;
      state.events = props.onEvents;
      React.useImperativeHandle(ref, () => ({ getEchartsInstance: () => undefined }));
      return <div data-testid="chart" />;
    }),
  };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/LoadingContext', async () => {
  const React = await import('react');
  return { LoadingContext: React.createContext({ showLoading: () => undefined, hideLoading: () => undefined }) };
});
afterEach(cleanup);

const option = { xField: 'category', yField: 'category', series: [{ field: 'value', aggregation: 'sum' }] };
const dataSet = [
  { category: null, value: 2 },
  { category: 'null', value: 3 },
  { category: 1, value: 4 },
  { category: '1', value: 5 },
  { category: false, value: 6 },
  { category: 'false', value: 7 },
  { category: null, value: 8 },
];
const seriesClick = (dataIndex: number, extras = {}) =>
  act(() => state.events?.click({ componentType: 'series', dataIndex, name: 'formatted wrong value', ...extras }));

const contributionAction = /^이 항목의 집계 원본 행 보기:/;
it.each(['x', 'y'] as const)(
  'contribution action preserves each %s-axis typed group and coalesces duplicate rows without changing canvas selection',
  axis => {
    const contribution = vi.fn();
    const view = render(<LineChart option={option} dataSet={dataSet} axis={axis} onContributionSelect={contribution} />);
    expect(state.option[axis + 'Axis'].data).toEqual([null, 'null', 1, '1', false, 'false']);
    expect(state.option.series[0].data).toEqual([10, 3, 4, 5, 6, 7]);
    expect(state.events).toBeUndefined();
    fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
    const actions = view.getAllByRole('button', { name: contributionAction });
    expect(actions).toHaveLength(6);
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual([
      '이 항목의 집계 원본 행 보기: 값 없음 (NULL)',
      '이 항목의 집계 원본 행 보기: null (문자열)',
      '이 항목의 집계 원본 행 보기: 1 (숫자)',
      '이 항목의 집계 원본 행 보기: 1 (문자열)',
      '이 항목의 집계 원본 행 보기: false (불리언)',
      '이 항목의 집계 원본 행 보기: false (문자열)',
    ]);
    expect(within(view.getAllByRole('row')[1]).getByRole('cell', { name: '10' })).toBeTruthy();
    actions.forEach(button => fireEvent.click(button));
    expect(contribution.mock.calls).toEqual([[null], ['null'], [1], ['1'], [false], ['false']]);
  },
);
it.each(['{Enter}', ' '])('contribution action retains focus and guards native %s while pending', async key => {
  const contribution = vi.fn();
  const chart = (pending: boolean, rows = dataSet) => (
    <LineChart option={option} dataSet={rows} onContributionSelect={contribution} contributionDisabled={pending} />
  );
  const view = render(chart(false));
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  const action = view.getByRole('button', { name: '이 항목의 집계 원본 행 보기: 1 (숫자)' });
  action.focus();
  await userEvent.keyboard(key);
  expect(contribution.mock.calls).toEqual([[1]]);
  view.rerender(chart(true));
  expect(document.activeElement).toBe(action);
  expect(action.hasAttribute('disabled')).toBe(false);
  expect(action.getAttribute('aria-disabled')).toBe('true');
  await userEvent.keyboard(key);
  fireEvent.click(action);
  expect(contribution).toHaveBeenCalledTimes(1);
  view.rerender(chart(false, [dataSet[2]]));
  expect(document.activeElement).toBe(action);
  expect(action.getAttribute('aria-disabled')).toBeNull();
  await userEvent.keyboard(key);
  expect(contribution.mock.calls).toEqual([[1], [1]]);
});
it('contribution action stays separate from common category filtering and time selection, including raw temporal labels', () => {
  const contribution = vi.fn(),
    category = vi.fn(),
    time = vi.fn();
  const view = render(
    <LineChart option={option} dataSet={dataSet} onContributionSelect={contribution} onCategorySelect={category} />,
  );
  seriesClick(0);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  fireEvent.click(view.getByRole('button', { name: '필터: null' }));
  expect(category.mock.calls).toEqual([[null], ['null']]);
  expect(contribution).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole('button', { name: '이 항목의 집계 원본 행 보기: 1 (문자열)' }));
  expect(category).toHaveBeenCalledTimes(2);
  expect(contribution.mock.calls).toEqual([['1']]);
  view.rerender(
    <LineChart
      option={option}
      dataSet={timeRows}
      onContributionSelect={contribution}
      onTimeSelect={time}
      timeSelection={timeMetadata}
    />,
  );
  seriesClick(1);
  fireEvent.click(view.getByRole('button', { name: /기간 선택: UTC 2026-01-12 10:00:00/ }));
  expect(time.mock.calls).toEqual([[hourRange('11')], [hourRange('10')]]);
  expect(contribution).toHaveBeenCalledTimes(1);
  fireEvent.click(view.getByRole('button', { name: '이 항목의 집계 원본 행 보기: 2026-01-12T11:00:00Z (문자열)' }));
  expect(contribution.mock.calls).toEqual([['1'], ['2026-01-12T11:00:00Z']]);
  expect(time).toHaveBeenCalledTimes(2);
});
it('contribution action requires a callback and an own finite primitive raw category', () => {
  const contribution = vi.fn();
  const view = render(<LineChart option={option} dataSet={dataSet} />);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.queryByRole('button', { name: contributionAction })).toBeNull();
  expect(view.queryByText('집계 원본 행')).toBeNull();
  view.rerender(
    <LineChart
      option={option}
      dataSet={[
        { value: 1 },
        { category: {}, value: 2 },
        { category: NaN, value: 3 },
        { category: 'x'.repeat(2001), value: 4 },
        Object.assign(Object.create({ category: 'inherited' }), { value: 5 }),
      ]}
      onContributionSelect={contribution}
    />,
  );
  expect(view.queryByRole('button', { name: contributionAction })).toBeNull();
  expect(contribution).not.toHaveBeenCalled();
});
it.each(['CHART_LINE', 'CHART_COLUMN', 'CHART_BAR'])(
  'contribution action propagates through WidgetViewer for %s with current callbacks and disabled state',
  widgetType => {
    const first = vi.fn(),
      second = vi.fn();
    const loading = { loading: false, showLoading: vi.fn(), hideLoading: vi.fn() };
    const widget = (callback: typeof first, pending = false) => (
      <LoadingContext.Provider value={loading}>
        <WidgetViewer
          title="Groups"
          widgetType={widgetType}
          widgetOption={option}
          dataSet={dataSet}
          onContributionSelect={callback}
          contributionDisabled={pending}
        />
      </LoadingContext.Provider>
    );
    const view = render(widget(first));
    fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
    const action = view.getByRole('button', { name: '이 항목의 집계 원본 행 보기: 값 없음 (NULL)' });
    fireEvent.click(action);
    view.rerender(widget(second));
    fireEvent.click(action);
    view.rerender(widget(second, true));
    expect(action.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(action);
    expect(first.mock.calls).toEqual([[null]]);
    expect(second.mock.calls).toEqual([[null]]);
    view.rerender(widget(undefined));
    expect(view.queryByRole('button', { name: contributionAction })).toBeNull();
  },
);

const hourRange = (hour: string) => ({
  column: 'event_time',
  start: `2026-01-12T${hour}:00:00Z`,
  end: `2026-01-12T${String(Number(hour) + 1).padStart(2, '0')}:00:00Z`,
  precision: 'timestamp' as const,
});
const timeRows = [
  { category: '2026-01-12T10:00:00Z', value: 3 },
  { category: '2026-01-12T11:00:00Z', value: 7 },
];
const timeMetadata = { column: 'event_time', grain: 'hour' as const, ranges: [hourRange('10'), hourRange('11')] };
it('time bucket canvas selects proven aligned ranges rather than the formatted name', () => {
  const selected = vi.fn();
  const view = render(<LineChart option={option} dataSet={timeRows} onTimeSelect={selected} timeSelection={timeMetadata} />);
  seriesClick(1);
  expect(selected).toHaveBeenCalledWith(hourRange('11'));
  seriesClick(0, { componentType: 'xAxis' });
  seriesClick(3);
  expect(selected).toHaveBeenCalledTimes(1);
  view.rerender(
    <LineChart
      option={option}
      dataSet={[timeRows[1]]}
      onTimeSelect={selected}
      timeSelection={{ ...timeMetadata, ranges: [hourRange('11')] }}
      timeSelectionDisabled
    />,
  );
  seriesClick(0);
  expect(selected).toHaveBeenCalledTimes(1);
});
it.each(['{Enter}', ' '])('time bucket table retains focus with native %s and pending guard', async key => {
  const selected = vi.fn();
  const chart = (pending: boolean) => (
    <LineChart
      option={option}
      dataSet={timeRows}
      onTimeSelect={selected}
      timeSelection={timeMetadata}
      timeSelectionDisabled={pending}
      selectedTimeRange={hourRange('11')}
    />
  );
  const view = render(chart(false));
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  const button = view.getByRole('button', { name: /기간 선택: UTC 2026-01-12 11:00:00/ });
  button.focus();
  await userEvent.keyboard(key);
  expect(selected.mock.calls).toEqual([[hourRange('11')]]);
  view.rerender(chart(true));
  expect(document.activeElement).toBe(button);
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(button.getAttribute('aria-disabled')).toBe('true');
  await userEvent.keyboard(key);
  seriesClick(1);
  expect(selected).toHaveBeenCalledTimes(1);
});
it('time bucket metadata mismatch and conflicting duplicate axes cannot apply a fabricated range', () => {
  const selected = vi.fn();
  const view = render(
    <LineChart
      option={option}
      dataSet={timeRows}
      onTimeSelect={selected}
      timeSelection={{ ...timeMetadata, ranges: [hourRange('10')] }}
    />,
  );
  seriesClick(0);
  expect(selected).not.toHaveBeenCalled();
  view.rerender(
    <LineChart option={option} dataSet={[timeRows[0], timeRows[0]]} onTimeSelect={selected} timeSelection={timeMetadata} />,
  );
  seriesClick(0);
  expect(selected).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.queryByRole('button', { name: /기간 선택:/ })).toBeNull();
});
it('time bucket props propagate through WidgetViewer and refresh current range callbacks', () => {
  const first = vi.fn(),
    second = vi.fn();
  const widget = (callback: typeof first, pending = false) => (
    <LoadingContext.Provider value={{ loading: false, showLoading: vi.fn(), hideLoading: vi.fn() }}>
      <WidgetViewer
        title="Hourly revenue"
        widgetType="CHART_LINE"
        widgetOption={option}
        dataSet={timeRows}
        onTimeSelect={callback}
        timeSelection={timeMetadata}
        timeSelectionDisabled={pending}
      />
    </LoadingContext.Provider>
  );
  const view = render(widget(first));
  seriesClick(0);
  view.rerender(widget(second));
  seriesClick(1);
  view.rerender(widget(second, true));
  seriesClick(0);
  expect(first.mock.calls).toEqual([[hourRange('10')]]);
  expect(second.mock.calls).toEqual([[hourRange('11')]]);
});

it.each(['x', 'y'] as const)(
  'maps %s-axis canvas indices to distinct original typed categories and matching aggregates',
  axis => {
    const selected = vi.fn();
    render(<LineChart option={option} dataSet={dataSet} axis={axis} onCategorySelect={selected} />);
    expect(state.option[axis + 'Axis'].data).toEqual([null, 'null', 1, '1', false, 'false']);
    expect(state.option.series[0].data).toEqual([10, 3, 4, 5, 6, 7]);
    [null, 'null', 1, '1', false, 'false'].forEach((value, index) => {
      seriesClick(index);
      expect(selected).toHaveBeenLastCalledWith(value);
    });
  },
);
it('uses current callback and categories after a render and ignores non-series/invalid indices', () => {
  const first = vi.fn();
  const second = vi.fn();
  const view = render(<LineChart option={option} dataSet={dataSet} onCategorySelect={first} />);
  seriesClick(0);
  view.rerender(<LineChart option={option} dataSet={[{ category: 'updated', value: 2 }]} onCategorySelect={second} />);
  seriesClick(0);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledWith('updated');
  seriesClick(0, { componentType: 'xAxis' });
  [-1, 1, 0.5, NaN].forEach(index => seriesClick(index));
  expect(second).toHaveBeenCalledTimes(1);
});
it('renders controlled native filter buttons and distinguishes NULL from the literal string', () => {
  const selected = vi.fn();
  const view = render(
    <LineChart option={option} dataSet={dataSet} onCategorySelect={selected} selectedCategoryValues={[null, 1]} />,
  );
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  const missing = view.getByRole('button', { name: '필터: 값 없음 (NULL)' });
  const literal = view.getByRole('button', { name: '필터: null' });
  expect(missing.getAttribute('aria-pressed')).toBe('true');
  expect(literal.getAttribute('aria-pressed')).toBe('false');
  const numbers = view.getAllByRole('button', { name: '필터: 1' });
  expect(numbers.map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  fireEvent.click(missing);
  fireEvent.click(literal);
  expect(selected.mock.calls).toEqual([[null], ['null']]);
  view.rerender(
    <LineChart
      option={option}
      dataSet={dataSet}
      onCategorySelect={selected}
      selectedCategoryValues={['null']}
      categorySelectionDisabled
    />,
  );
  expect(view.getByRole('button', { name: '필터: null' }).getAttribute('aria-pressed')).toBe('true');
  expect(view.getByRole('button', { name: '필터: null' }).hasAttribute('disabled')).toBe(false);
  expect(view.getByRole('button', { name: '필터: null' }).getAttribute('aria-disabled')).toBe('true');
  seriesClick(0);
  fireEvent.click(view.getByRole('button', { name: '필터: null' }));
  expect(selected).toHaveBeenCalledTimes(2);
});
it('keeps legacy aggregation and plain table cells when there is no selection callback', () => {
  const view = render(<LineChart option={option} dataSet={dataSet} />);
  expect(state.events).toBeUndefined();
  expect(state.option.xAxis.data).toEqual(['1', 'null', 'false']);
  expect(state.option.series[0].data).toEqual([9, 13, 13]);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.queryByRole('button', { name: /^필터:/ })).toBeNull();
});
it('accepts 2,000-character filter values and disables longer strings in both interaction paths', () => {
  const selected = vi.fn();
  const allowed = 'a'.repeat(2000);
  const oversized = 'b'.repeat(2001);
  const view = render(
    <LineChart
      option={option}
      dataSet={[
        { category: allowed, value: 1 },
        { category: oversized, value: 2 },
      ]}
      onCategorySelect={selected}
    />,
  );
  seriesClick(0);
  seriesClick(1);
  expect(selected.mock.calls).toEqual([[allowed]]);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  const blocked = view.getByRole('button', { name: `필터: ${oversized}` });
  expect(blocked.hasAttribute('disabled')).toBe(true);
  expect(blocked.getAttribute('title')).toBe('필터 값은 2,000자 이하만 지원합니다.');
  fireEvent.click(blocked);
  expect(selected).toHaveBeenCalledTimes(1);
  fireEvent.click(view.getByRole('button', { name: `필터: ${allowed}` }));
  expect(selected.mock.calls).toEqual([[allowed], [allowed]]);
});
it('propagates controlled selection props through WidgetViewer without stale callbacks', () => {
  const first = vi.fn();
  const second = vi.fn();
  const loading = { loading: false, showLoading: vi.fn(), hideLoading: vi.fn() };
  const widget = (callback: (value: any) => void, disabled = false, values: any[] = []) => (
    <LoadingContext.Provider value={loading}>
      <WidgetViewer
        title="Devices"
        widgetType="CHART_COLUMN"
        widgetOption={option}
        dataSet={dataSet}
        onCategorySelect={callback}
        selectedCategoryValues={values}
        categorySelectionDisabled={disabled}
      />
    </LoadingContext.Provider>
  );
  const view = render(widget(first));
  seriesClick(0);
  view.rerender(widget(second, false, [null]));
  seriesClick(1);
  expect(first.mock.calls).toEqual([[null]]);
  expect(second.mock.calls).toEqual([['null']]);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.getByRole('button', { name: '필터: 값 없음 (NULL)' }).getAttribute('aria-pressed')).toBe('true');
  view.rerender(widget(second, true));
  seriesClick(0);
  expect(second).toHaveBeenCalledTimes(1);
  expect(view.getByRole('button', { name: '필터: 값 없음 (NULL)' }).hasAttribute('disabled')).toBe(false);
  expect(view.getByRole('button', { name: '필터: 값 없음 (NULL)' }).getAttribute('aria-disabled')).toBe('true');
});
it.each(['{Enter}', ' '])(
  'retains focus and native %s activation across pending state and category filtering',
  async key => {
    const selected = vi.fn();
    const full = [
      { category: 'online', value: 2 },
      { category: 'retail', value: 3 },
    ];
    const chart = (rows: typeof full, pending: boolean, values: string[] = []) => (
      <LineChart
        option={option}
        dataSet={rows}
        onCategorySelect={selected}
        selectedCategoryValues={values}
        categorySelectionDisabled={pending}
      />
    );
    const view = render(chart(full, false));
    fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
    const retail = view.getByRole('button', { name: '필터: retail' });
    retail.focus();
    await userEvent.keyboard(key);
    expect(selected.mock.calls).toEqual([['retail']]);
    view.rerender(chart(full, true, ['retail']));
    expect(document.activeElement).toBe(retail);
    expect(retail.hasAttribute('disabled')).toBe(false);
    expect(retail.getAttribute('aria-disabled')).toBe('true');
    await userEvent.keyboard(key);
    fireEvent.click(retail);
    seriesClick(1);
    expect(selected).toHaveBeenCalledTimes(1);
    view.rerender(chart([full[1]], false, ['retail']));
    expect(view.getByRole('button', { name: '필터: retail' })).toBe(retail);
    expect(document.activeElement).toBe(retail);
    expect(retail.getAttribute('aria-disabled')).toBeNull();
    expect(retail.getAttribute('aria-pressed')).toBe('true');
    await userEvent.keyboard(key);
    expect(selected.mock.calls).toEqual([['retail'], ['retail']]);
    view.rerender(chart([full[1]], true, []));
    view.rerender(chart(full, false, []));
    expect(document.activeElement).toBe(retail);
    expect(view.getByRole('button', { name: '필터: retail' })).toBe(retail);
    expect(retail.getAttribute('aria-pressed')).toBe('false');
  },
);
