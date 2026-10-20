import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Bubble3dChart from './Bubble3dChart';

const chart = vi.hoisted(() => ({ option: null as any }));
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    chart.option = props.option;
    return null;
  },
}));
vi.mock('echarts-gl', () => ({}));

afterEach(() => {
  cleanup();
  chart.option = null;
});

const rows = [
  { x: 1, y: 2, z: 3, size: 4 },
  { x: 3, y: 4, z: 5, size: 0 },
  { x: 5, y: 6, z: 7, size: 9 },
];
const expected = [
  [1, 2, 3, 4],
  [3, 4, 5, 0],
  [5, 6, 7, 9],
];
const makeOption = (sizeField: string) =>
  Object.freeze({
    series: Object.freeze([
      Object.freeze({ xField: 'x', yField: 'y', zField: 'z', [sizeField]: 'size', title: 'sizes', color: '#123456' }),
    ]),
  });

describe('Bubble3d size-field compatibility', () => {
  it.each(['sizeField', 'symbolSize'])('uses %s for fourth values and preserves options and XYZ values', sizeField => {
    const option = makeOption(sizeField);
    const original = JSON.parse(JSON.stringify(option));
    const originalRows = rows.map(row => ({ ...row }));
    render(<Bubble3dChart option={option} dataSet={rows} />);
    const output = chart.option.series[0];
    expect(output.type).toBe('scatter3D');
    expect(output.data).toEqual(expected);
    expect(output.data.map(value => output.symbolSize(value))).toEqual([2, 0, 3]);
    expect(output.name).toBe('sizes');
    expect(output.color).toBe('#123456');
    expect(option).toEqual(original);
    expect(rows).toEqual(originalRows);
  });

  it.each(['sizeField', 'symbolSize'])(
    'accepts numeric strings and excludes invalid %s sizes without NaN graphics',
    sizeField => {
      const dataSet = [
        ...rows.map(row => ({ ...row, size: String(row.size) })),
        { x: 7, y: 8, z: 9 },
        ...[-1, NaN, Infinity, -Infinity, null, undefined, '', ' ', 'bad', true].map(size => ({ x: 7, y: 8, z: 9, size })),
      ];
      const originalRows = dataSet.map(row => ({ ...row }));
      render(<Bubble3dChart option={makeOption(sizeField)} dataSet={dataSet} />);
      const output = chart.option.series[0];
      expect(output.data).toEqual(expected);
      const sizes = output.data.map(value => output.symbolSize(value));
      expect(sizes).toEqual([2, 0, 3]);
      expect(sizes.every(size => Number.isFinite(size) && size >= 0)).toBe(true);
      expect(dataSet).toEqual(originalRows);
    },
  );

  it('prefers the current symbolSize field when both names are provided', () => {
    const option = Object.freeze({
      series: Object.freeze([
        Object.freeze({ xField: 'x', yField: 'y', zField: 'z', symbolSize: 'size', sizeField: 'legacySize' }),
      ]),
    });
    const original = JSON.parse(JSON.stringify(option));
    render(<Bubble3dChart option={option} dataSet={rows.map(row => ({ ...row, legacySize: 100 }))} />);
    expect(chart.option.series[0].data).toEqual(expected);
    expect(option).toEqual(original);
  });
});
