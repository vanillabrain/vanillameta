import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TreemapChart from './TreemapChart';

const chart = vi.hoisted(() => ({ option: null as any }));
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    chart.option = props.option;
    return null;
  },
}));

afterEach(() => {
  cleanup();
  chart.option = null;
});

const option = {
  series: {
    name: ['occupation', 'education'],
    field: 'age',
    aggregation: 'sum',
    color: ['#2870c4', '#4ecef6', '#ffd43b', '#fa5a5a'],
  },
  label: true,
};
const rows = [
  { occupation: 100, education: 100, age: 100 },
  { occupation: 250, education: 250, age: 250 },
  { occupation: 150, education: 150, age: 150 },
];

describe('treemap and sunburst category hierarchy', () => {
  it('renders the saved sunburst name array as ordered named parents and children totaling 500', () => {
    const original = structuredClone(option);
    render(<TreemapChart option={option} dataSet={rows} seriesOp={{ type: 'sunburst' }} />);
    const series = chart.option.series[0];
    expect(series.type).toBe('sunburst');
    expect(series.data).toEqual([
      { name: '100', value: 100, children: [{ name: '100', value: 100 }] },
      { name: '250', value: 250, children: [{ name: '250', value: 250 }] },
      { name: '150', value: 150, children: [{ name: '150', value: 150 }] },
    ]);
    expect(series.data.reduce((sum, parent) => sum + parent.value, 0)).toBe(500);
    expect(JSON.stringify(series.data)).not.toContain('undefined');
    expect(option).toEqual(original);
  });

  it.each([
    ['sum', 30, 60],
    ['avg', 15, 45],
    ['count', 2, 3],
  ])(
    'aggregates duplicate leaves with %s and sums their parent without mixing another branch',
    (aggregation, leaf, parent) => {
      render(
        <TreemapChart
          option={{ ...option, series: { ...option.series, aggregation } }}
          dataSet={[
            { occupation: 'A', education: 'X', age: 10 },
            { occupation: 'A', education: 'X', age: 20 },
            { occupation: 'A', education: 'Y', age: 30 },
            { occupation: 'B', education: 'X', age: 40 },
          ]}
          seriesOp={{ type: 'sunburst' }}
        />,
      );
      expect(chart.option.series[0].data).toEqual([
        {
          name: 'A',
          value: parent,
          children: [
            { name: 'X', value: leaf },
            { name: 'Y', value: aggregation === 'count' ? 1 : 30 },
          ],
        },
        {
          name: 'B',
          value: aggregation === 'count' ? 1 : 40,
          children: [{ name: 'X', value: aggregation === 'count' ? 1 : 40 }],
        },
      ]);
    },
  );

  it('provides explicit labels for missing categories while preserving numeric zero labels and values', () => {
    render(
      <TreemapChart
        option={option}
        dataSet={[
          { occupation: 0, education: null, age: 0 },
          { occupation: 'A', age: 20 },
        ]}
        seriesOp={{ type: 'sunburst' }}
      />,
    );
    expect(chart.option.series[0].data).toEqual([
      { name: '0', value: 0, children: [{ name: '(empty)', value: 0 }] },
      { name: 'A', value: 20, children: [{ name: '(empty)', value: 20 }] },
    ]);
  });

  it('keeps the single-field treemap flat with the same aggregated values and palette bounds', () => {
    render(
      <TreemapChart
        option={{ ...option, series: { ...option.series, name: 'occupation' } }}
        dataSet={[
          { occupation: 'A', age: 100 },
          { occupation: 'B', age: 250 },
          { occupation: 'A', age: 150 },
        ]}
      />,
    );
    expect(chart.option.series[0].type).toBe('treemap');
    expect(chart.option.series[0].name).toBe('occupation');
    expect(chart.option.series[0].data).toEqual([
      { name: 'A', value: 250 },
      { name: 'B', value: 250 },
    ]);
    expect(chart.option.visualMap).toMatchObject({ min: 250, max: 250, inRange: { color: option.series.color } });
  });

  it('keeps configured category order across three hierarchy levels', () => {
    render(
      <TreemapChart
        option={{ ...option, series: { ...option.series, name: ['region', 'occupation', 'education'] } }}
        dataSet={rows.map(row => ({ ...row, region: 'East' }))}
        seriesOp={{ type: 'sunburst' }}
      />,
    );
    expect(chart.option.series[0].data).toEqual([
      {
        name: 'East',
        value: 500,
        children: rows.map(row => ({
          name: String(row.occupation),
          value: row.age,
          children: [{ name: String(row.education), value: row.age }],
        })),
      },
    ]);
  });

  it('leaves an empty category selection without a fabricated hierarchy', () => {
    render(<TreemapChart option={{ ...option, series: { ...option.series, name: [] } }} dataSet={rows} />);
    expect(chart.option.series).toEqual([]);
  });
});
