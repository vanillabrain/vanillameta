import { expect, it } from 'vitest';
import { categoryTimeRange, sameTimeRange, timeRangeLabel, validTimeRange, TimeSelection } from './timeSelection';

const hour = {
  column: 'event_time',
  start: '2026-10-13T09:00:00Z',
  end: '2026-10-13T10:00:00Z',
  precision: 'timestamp' as const,
};
const next = { ...hour, start: hour.end, end: '2026-10-13T11:00:00Z' };
const selection = (ranges: any[] = [hour, next]): TimeSelection => ({ column: 'event_time', grain: 'hour', ranges });

it('accepts strict UTC seconds and half-open timestamp buckets across calendar boundaries', () => {
  expect(validTimeRange(hour)).toBe(true);
  expect(validTimeRange({ ...hour, start: '2024-02-29T23:59:59Z', end: '2024-03-01T00:00:00Z' })).toBe(true);
});
it.each([
  undefined,
  null,
  {},
  { ...hour, precision: undefined },
  { ...hour, precision: 'date' },
  { ...hour, column: '' },
  { ...hour, column: 1 },
  { ...hour, start: '2026-10-13' },
  { ...hour, start: '2026-10-13T09:00:00.000Z' },
  { ...hour, start: '2026-10-13T09:00:00+00:00' },
  { ...hour, start: '2026-10-13T09:00Z' },
  { ...hour, start: '2026-02-30T09:00:00Z' },
  { ...hour, start: '2026-10-13T24:00:00Z' },
  { ...hour, start: '0000-10-13T09:00:00Z' },
  { ...hour, end: hour.start },
  { ...hour, end: '2026-10-13T08:00:00Z' },
])('rejects unproven or malformed timestamp range %j', range => {
  expect(validTimeRange(range)).toBe(false);
});
it('compares column, exact bounds and precision and labels the exclusive UTC end', () => {
  expect(sameTimeRange(hour, { ...hour })).toBe(true);
  expect(sameTimeRange(hour, next)).toBe(false);
  expect(sameTimeRange(hour, { ...hour, column: 'other' })).toBe(false);
  expect(sameTimeRange(hour, { ...hour, precision: undefined })).toBe(false);
  expect(sameTimeRange(null, null)).toBe(false);
  expect(sameTimeRange(hour, undefined)).toBe(false);
  expect(timeRangeLabel(hour)).toBe('UTC 2026-10-13 09:00:00 ~ 2026-10-13 10:00:00 (종료 미포함)');
});
it('maps exact raw category values by aligned row index without parsing formatted labels', () => {
  const rows = [{ category: 0 }, { category: '0' }, { category: null }, { category: 'UTC 09:00' }];
  const metadata = selection([hour, next, null, hour]);
  expect(categoryTimeRange(rows, 'category', 0, metadata)).toEqual(hour);
  expect(categoryTimeRange(rows, 'category', '0', metadata)).toEqual(next);
  expect(categoryTimeRange(rows, 'category', null, metadata)).toBeUndefined();
  expect(categoryTimeRange(rows, 'category', 'UTC 09:00', metadata)).toEqual(hour);
  expect(categoryTimeRange(rows, 'category', '2026-10-13', metadata)).toBeUndefined();
});
it('accepts consistent duplicate categories and rejects every conflicting or invalid duplicate', () => {
  const rows = [{ category: 'bucket' }, { category: 'bucket' }];
  expect(categoryTimeRange(rows, 'category', 'bucket', selection([hour, { ...hour }]))).toEqual(hour);
  for (const ranges of [
    [hour, next],
    [hour, null],
    [null, hour],
    [hour, { ...hour, column: 'other' }],
  ]) {
    expect(categoryTimeRange(rows, 'category', 'bucket', selection(ranges))).toBeUndefined();
  }
});
it('does not enable categories from missing, mismatched or invalid metadata', () => {
  const rows = [{ category: 'bucket' }];
  for (const metadata of [
    undefined,
    selection([]),
    selection([hour, next]),
    selection([null]),
    selection([{ ...hour, end: hour.start }]),
    { ...selection([hour]), column: 'other' },
  ]) {
    expect(categoryTimeRange(rows, 'category', 'bucket', metadata)).toBeUndefined();
  }
});
it('preserves timezone identity while UTC timestamps remain absolute', () => {
  expect(validTimeRange({ ...hour, timeZone: 'Asia/Seoul' })).toBe(true);
  expect(validTimeRange({ ...hour, timeZone: 'KST' })).toBe(false);
  expect(sameTimeRange(hour, { ...hour, timeZone: 'UTC' })).toBe(true);
  expect(sameTimeRange(hour, { ...hour, timeZone: 'Asia/Seoul' })).toBe(false);
});

it('labels an absolute DST interval in its business timezone', () => {
  expect(
    timeRangeLabel({
      column: 'date',
      start: '2026-03-08T05:00:00Z',
      end: '2026-03-09T04:00:00Z',
      precision: 'timestamp',
      timeZone: 'America/New_York',
    }),
  ).toBe('America/New_York 2026-03-08 00:00:00 ~ 2026-03-09 00:00:00 (종료 미포함)');
});
