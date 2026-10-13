import React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
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
vi.mock('@mui/material', () => {
  const element =
    (tag: string) =>
    ({ children, component, ...props }: any) =>
      React.createElement(
        component || tag,
        Object.fromEntries(
          Object.entries(props).filter(
            ([key]) => !['sx', 'size', 'align', 'direction', 'justifyContent', 'alignItems', 'variant'].includes(key),
          ),
        ),
        children,
      );
  return {
    Box: element('div'),
    Stack: element('div'),
    Typography: element('span'),
    Button: element('button'),
    Table: element('table'),
    TableHead: element('thead'),
    TableBody: element('tbody'),
    TableCell: element('td'),
    TableRow: element('tr'),
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
