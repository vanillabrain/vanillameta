import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LineChart from './LineChart';
const state = vi.hoisted(() => ({
  resize: vi.fn(),
  disconnect: vi.fn(),
  observe: vi.fn(),
  callback: null as (() => void) | null,
  option: null as any,
  theme: null as any,
}));
vi.mock('echarts-for-react', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props: any, ref) => {
      state.option = props.option;
      state.theme = props.theme;
      const element = React.useRef<HTMLDivElement>(null);
      React.useImperativeHandle(ref, () => ({
        getEchartsInstance: () => ({ getDom: () => element.current, resize: state.resize, isDisposed: () => false }),
      }));
      return <div ref={element} data-testid="chart" />;
    }),
  };
});
it('avoids crowded value labels without dropping devices or rounding their exact values', () => {
  const devices = [
    { device: 'Mobile/Tablet', value: 307763000 },
    { device: 'Connected Device', value: 17000 },
  ];
  const view = render(
    <LineChart
      axis="y"
      seriesOp={{ type: 'bar' }}
      option={{ yField: 'device', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={devices}
    />,
  );
  expect(state.option.xAxis.axisLabel.hideOverlap).toBe(true);
  expect(state.option.media).toEqual([
    {
      query: { maxWidth: 260 },
      option: {
        xAxis: { splitNumber: 2 },
        yAxis: { axisLabel: { width: 48, overflow: 'truncate' } },
        grid: { right: 12 },
      },
    },
    {
      query: { minWidth: 261, maxWidth: 480 },
      option: {
        xAxis: { splitNumber: 2 },
        yAxis: { axisLabel: { width: null, overflow: 'none' } },
        grid: { right: 28 },
      },
    },
    {
      option: {
        xAxis: { splitNumber: 5 },
        yAxis: { axisLabel: { width: null, overflow: 'none' } },
        grid: { right: '3%' },
      },
    },
  ]);
  expect(state.option.xAxis.axisLabel.formatter(307763000)).toBe('307.8M');
  expect(state.option.yAxis.data).toEqual(devices.map(device => device.device));
  expect(state.option.yAxis.axisLabel.interval).toBe(0);
  expect(state.option.series[0].data).toEqual([307763000, 17000]);
  expect(state.option.tooltip.valueFormatter(307763000)).toBe('307,763,000');
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.getByRole('table').textContent).toContain('Connected Device');
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('resizes the canvas after its container changes and disconnects on unmount', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        state.callback = callback;
      }
      observe = state.observe;
      disconnect = state.disconnect;
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback();
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const view = render(
    <LineChart
      option={{ xField: 'date', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={[{ date: '2025-01-01', value: 10 }]}
    />,
  );
  expect(state.observe).toHaveBeenCalledWith(view.getByTestId('chart'));
  state.callback?.();
  expect(state.resize).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(state.disconnect).toHaveBeenCalledTimes(1);
});
it('keeps SQL NULL as a gap and a dash in the chart table while retaining real zero', () => {
  const view = render(
    <LineChart
      axis="y"
      option={{ yField: 'group', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={[
        { group: 'missing', value: null },
        { group: 'zero', value: 0 },
      ]}
    />,
  );
  expect(state.option.series[0].data).toEqual([null, 0]);
  expect(state.option.tooltip.valueFormatter(null)).toBe('—');
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.getByRole('table').textContent).toContain('missing—zero0');
  expect(view.getByRole('table').textContent).not.toContain('NaN');
});
it('shows short UTC bucket dates on the axis while retaining exact category values in the table', () => {
  const view = render(
    <LineChart
      option={{ xField: 'day', categoryDateFormat: 'day', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={[{ day: '2026-01-05T00:00:00Z', value: 30 }]}
    />,
  );
  expect(state.option.xAxis.axisLabel.formatter('2026-01-05T00:00:00Z')).toBe('2026-01-05');
  expect(state.option.xAxis.axisLabel.formatter('other')).toBe('other');
  expect(state.option.xAxis.data).toEqual(['2026-01-05T00:00:00Z']);
  fireEvent.click(view.getByRole('button', { name: 'chart.showDataTable' }));
  expect(view.getByRole('table').textContent).toContain('2026-01-05T00:00:00Z30');
});

it('keeps raw timestamp ticks inside the chart without changing their underlying categories', () => {
  render(
    <LineChart
      option={{ xField: 'time', categoryDateFormat: 'datetime', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={[{ time: '2023-09-09 00:00:00', value: 1 }]}
    />,
  );
  expect(state.option.xAxis.axisLabel.formatter('2023-09-09 00:00:00')).toBe('09-09 00:00');
  expect(state.option.xAxis.axisLabel.alignMinLabel).toBe('left');
  expect(state.option.xAxis.axisLabel.alignMaxLabel).toBe('right');
  expect(state.option.xAxis.data).toEqual(['2023-09-09 00:00:00']);
});

it('uses shared presentation defaults without overriding saved colors or data', () => {
  const dataSet = [
    { category: 'A', amount: 1234.567 },
    { category: 'B', amount: 0 },
  ];
  const option = { xField: 'category', series: [{ field: 'amount', aggregation: 'sum', color: '#123456' }] };
  const before = JSON.stringify({ option, dataSet });
  render(<LineChart option={option} dataSet={dataSet} />);
  expect(state.theme.tooltip.confine).toBe(true);
  expect(state.theme.valueAxis.splitLine.lineStyle.type).toBe('dashed');
  expect(state.option.series[0].color).toBe('#123456');
  expect(state.option.series[0].data).toEqual([1234.567, 0]);
  expect(JSON.stringify({ option, dataSet })).toBe(before);
});
