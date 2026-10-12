import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LineChart from './linechart/LineChart';
import MixedLinePieChart from './mixedchart/MixedLinePieChart';

const chart = vi.hoisted(() => ({ option: null as any }));
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    chart.option = props.option;
    return null;
  },
}));
vi.mock('@mui/material', () => {
  const element =
    (tag: string) =>
    ({ children, sx, size, align, component, ...props }: any) =>
      React.createElement(component || tag, props, children);
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
  chart.option = null;
});

const rows = [
  { region: 'Seoul', amount: 100 },
  { region: 'Busan', amount: 250 },
  { region: 'Jeju', amount: 150 },
];
const expectedPairs = [
  ['Seoul', 100],
  ['Busan', 250],
  ['Jeju', 150],
];

describe.each([
  ['normal', LineChart],
  ['mixed pie', MixedLinePieChart],
] as const)('%s category/value order', (_name, Renderer) => {
  it.each(['y', 'x'])('keeps categories paired with amounts on the %s category axis', axis => {
    const option = {
      [axis + 'Field']: 'region',
      series: [{ field: 'amount', aggregation: 'sum', type: 'bar' }],
      pie: { name: 'region', field: 'amount', aggregation: 'sum', color: ['#123456'] },
    };
    const originalOption = JSON.parse(JSON.stringify(option));
    render(<Renderer option={option} dataSet={rows} axis={axis} />);

    const categoryAxis = chart.option[axis + 'Axis'];
    const bars = chart.option.series.find(series => series.type === 'bar');
    expect(categoryAxis.data.map((category, index) => [category, bars.data[index]])).toEqual(expectedPairs);
    // ECharts' inverse y axis places the first category at the top without changing its value index.
    expect(Boolean(categoryAxis.inverse)).toBe(axis === 'y');
    expect(chart.option[axis === 'y' ? 'xAxis' : 'yAxis'].type).toBe('value');
    const pie = chart.option.series.find(series => series.type === 'pie');
    if (pie) expect(pie.data.map(item => [item.name, item.value])).toEqual(expectedPairs);
    expect(option).toEqual(originalOption);
    expect(rows).toEqual([
      { region: 'Seoul', amount: 100 },
      { region: 'Busan', amount: 250 },
      { region: 'Jeju', amount: 150 },
    ]);
  });
});

it('offers exact accessible values for tiny bars and uses compact numeric axes', () => {
  render(
    <LineChart
      axis="y"
      defaultOp={{ xAxis: { boundaryGap: [0, 0.01] }, tooltip: { axisPointer: { type: 'shadow' } } }}
      option={{ yField: 'region', series: [{ field: 'amount', aggregation: 'sum', type: 'bar' }] }}
      dataSet={rows}
    />,
  );
  expect(chart.option.yAxis.axisLabel.interval).toBe(0);
  expect(chart.option.xAxis.axisLabel.formatter(307763000)).toBe('307.8M');
  expect(chart.option.tooltip.valueFormatter(307763000)).toBe('307,763,000');
  fireEvent.click(screen.getByRole('button', { name: 'chart.showDataTable' }));
  expect(screen.getByRole('table').textContent).toContain('Seoul100Busan250Jeju150');
});
