import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BubbleChart from './scatterchart/BubbleChart';
import RadarChart from './radarchart/RadarChart';
import HeatmapChart from './heatmapchart/HeatmapChart';
import PolarBarChart from './barchart/PolarBarChart';

const chart = vi.hoisted(() => ({ option: null as any }));
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    chart.option = props.option;
    return null;
  },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  cleanup();
  chart.option = null;
});

const rows = [
  { category: 'A', region: 'East', x: 1, y: 2, amount: 100, size: 4 },
  { category: 'B', region: 'West', x: 3, y: 4, amount: 250, size: 0 },
  { category: 'C', region: 'East', x: 5, y: 6, amount: 150, size: 9 },
];
const series = [{ field: 'amount', aggregation: 'sum', color: '#123456' }];

describe('settled legacy renderer field aliases', () => {
  it.each(['sizeField', 'symbolSize'])('bubble uses %s without mutating options', sizeField => {
    const option = { series: [{ xField: 'x', yField: 'y', [sizeField]: 'size' }] };
    const original = JSON.parse(JSON.stringify(option));
    render(<BubbleChart option={option} dataSet={rows} />);
    const output = chart.option.series[0];
    expect(output.data).toEqual([
      [1, 2, 4],
      [3, 4, 0],
      [5, 6, 9],
    ]);
    expect(output.data.map(value => output.symbolSize(value))).toEqual([2, 0, 3]);
    expect(option).toEqual(original);
  });

  it('bubble excludes missing, negative and nonnumeric sizes rather than emitting NaN graphics', () => {
    render(
      <BubbleChart
        option={{ series: [{ xField: 'x', yField: 'y', sizeField: 'size' }] }}
        dataSet={[...rows, { x: 7, y: 8 }, { x: 7, y: 8, size: -1 }, { x: 7, y: 8, size: 'bad' }]}
      />,
    );
    expect(chart.option.series[0].data).toEqual([
      [1, 2, 4],
      [3, 4, 0],
      [5, 6, 9],
    ]);
  });

  it.each(['xField', 'field'])('radar uses %s for both groups and indicators', categoryField => {
    const option = { [categoryField]: 'category', series };
    render(<RadarChart option={option} dataSet={rows} />);
    expect(chart.option.radar.indicator).toEqual([{ name: 'A' }, { name: 'B' }, { name: 'C' }]);
    expect(chart.option.series[0].data[0].value).toEqual([100, 250, 150]);
    expect(option).toEqual({ [categoryField]: 'category', series });
  });

  it.each(['field', 'series'])('heatmap uses %s and retains numeric zero and palettes', valueField => {
    render(
      <HeatmapChart
        option={{ xField: 'category', yField: 'region', [valueField]: 'amount', color: ['#000', '#fff'] }}
        dataSet={[...rows, { category: 'D', region: 'East', amount: 0 }]}
      />,
    );
    expect(chart.option.series[0].data.map(value => value[2])).toEqual([100, 250, 150, 0]);
    expect(chart.option.visualMap.min).toBe(0);
    expect(chart.option.visualMap.max).toBe(250);
    expect(chart.option.visualMap.inRange.color).toEqual(['#000', '#fff']);
  });

  it('heatmap ignores a malformed array series when a field string is available', () => {
    render(
      <HeatmapChart
        option={{ xField: 'category', yField: 'region', series: [], field: 'amount', color: ['#000'] }}
        dataSet={rows}
      />,
    );
    expect(chart.option.series[0].data.map(value => value[2])).toEqual([100, 250, 150]);
  });

  it.each(['xField', 'axisField'])('polar uses %s and preserves stacked wrapper props', categoryField => {
    const option = { [categoryField]: 'category', series, radius: '70%' };
    render(<PolarBarChart option={option} dataSet={rows} seriesOp={{ stack: 'total' }} />);
    expect(chart.option.radiusAxis.data).toEqual(['A', 'B', 'C']);
    expect(chart.option.series[0].data).toEqual([100, 250, 150]);
    expect(chart.option.series[0].stack).toBe('total');
    expect(chart.option.polar.radius).toBe('70%');
    expect(option).toEqual({ [categoryField]: 'category', series, radius: '70%' });
  });
});
