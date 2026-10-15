import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LineChart from './LineChart';
const state = vi.hoisted(() => ({
  resize: vi.fn(),
  disconnect: vi.fn(),
  observe: vi.fn(),
  callback: null as (() => void) | null,
  option: null as any,
}));
vi.mock('echarts-for-react', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((props: any, ref) => {
      state.option = props.option;
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
  render(
    <LineChart
      axis="y"
      seriesOp={{ type: 'bar' }}
      option={{ yField: 'device', series: [{ field: 'value', aggregation: 'sum' }] }}
      dataSet={devices}
    />,
  );
  expect(state.option.xAxis.axisLabel.hideOverlap).toBe(true);
  expect(state.option.media).toEqual([
    { query: { maxWidth: 480 }, option: { xAxis: { splitNumber: 2 }, grid: { right: 28 } } },
    { option: { xAxis: { splitNumber: 5 }, grid: { right: '3%' } } },
  ]);
  expect(state.option.xAxis.axisLabel.formatter(307763000)).toBe('307.8M');
  expect(state.option.yAxis.data).toEqual(devices.map(device => device.device));
  expect(state.option.yAxis.axisLabel.interval).toBe(0);
  expect(state.option.series[0].data).toEqual([307763000, 17000]);
  expect(state.option.tooltip.valueFormatter(307763000)).toBe('307,763,000');
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
