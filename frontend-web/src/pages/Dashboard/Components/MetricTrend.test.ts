import { expect, it } from 'vitest';
import { trendGeometry } from './trendGeometry';

it('uses actual date distances rather than equally spacing missing dates', () => {
  const { dots } = trendGeometry([
    { time: '2023-09-09', value: 1 },
    { time: '2023-09-10', value: 2 },
    { time: '2023-09-12', value: 3 },
  ]);
  expect(dots[1].x - dots[0].x).toBeCloseTo((dots[2].x - dots[1].x) / 2);
});
it('breaks across nulls and preserves legitimate zero observations', () => {
  const { path, dots } = trendGeometry([
    { time: '2023-09-09', value: 0 },
    { time: '2023-09-10', value: null },
    { time: '2023-09-11', value: 5 },
  ]);
  expect(path.match(/M/g)).toHaveLength(2);
  expect(path).not.toContain('L');
  expect(dots).toHaveLength(2);
});
it('renders constant/single and absent series without NaN coordinates', () => {
  expect(trendGeometry([{ time: '2023-09-09', value: 3 }]).dots).toEqual([{ x: 300, y: 8 }]);
  expect(trendGeometry([{ time: '2023-09-09', value: null }]).path).toBe('');
});

it('uses a zero baseline and closes separate filled areas across missing values', () => {
  const { dots, area } = trendGeometry([
    { time: '2023-09-09', value: 80 },
    { time: '2023-09-10', value: null },
    { time: '2023-09-11', value: 100 },
  ]);
  expect(dots[0].y).toBeCloseTo(16.8);
  expect(area.match(/Z/g)).toHaveLength(2);
  const negative = trendGeometry([
    { time: '2023-09-09', value: -2 },
    { time: '2023-09-10', value: 2 },
  ]);
  expect(negative.area).toContain(',30');
});
