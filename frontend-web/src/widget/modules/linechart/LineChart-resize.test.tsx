import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LineChart from './LineChart';
const state = vi.hoisted(() => ({
  resize: vi.fn(),
  disconnect: vi.fn(),
  observe: vi.fn(),
  callback: null as (() => void) | null,
}));
vi.mock('echarts-for-react', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef((_props: any, ref) => {
      const element = React.useRef<HTMLDivElement>(null);
      React.useImperativeHandle(ref, () => ({
        getEchartsInstance: () => ({ getDom: () => element.current, resize: state.resize, isDisposed: () => false }),
      }));
      return <div ref={element} data-testid="chart" />;
    }),
  };
});
vi.mock('@mui/material', () => {
  const element =
    (tag: string) =>
    ({ children, component, ...props }: any) =>
      React.createElement(
        component || tag,
        Object.fromEntries(Object.entries(props).filter(([key]) => !['sx', 'size', 'align'].includes(key))),
        children,
      );
  return {
    Box: element('div'),
    Button: element('button'),
    Table: element('table'),
    TableHead: element('thead'),
    TableBody: element('tbody'),
    TableCell: element('td'),
    TableRow: element('tr'),
  };
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
