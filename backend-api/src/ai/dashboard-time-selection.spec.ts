import { sourceQuery } from './dashboard-draft';
import { dateRangeBounds, validateDateRange } from './dashboard-date-range';
import { previousDateRange } from './dashboard-period';
import { buildTimeSelection } from './dashboard-time-selection';
import { resolveTimeChartBucket, TimeBucket } from './dashboard-trend';
import { resolveViewDates, validatePersonalViewState } from '../dashboard/personal-view-state';

const timestamp = (start = '2024-02-29T12:30:00Z', end = '2024-02-29T13:00:00Z') => ({
  column: 'event_time',
  start,
  end,
  precision: 'timestamp' as const,
});
const schema = [
  { column_name: 'event_time', column_type: 'TIMESTAMP' },
  { column_name: 'day', column_type: 'DATE' },
  { column_name: 'label', column_type: 'VARCHAR' },
  { column_name: 'amount', column_type: 'DOUBLE' },
];
const chart = (expression: string) =>
  `SELECT ${expression} AS dimension, sum(amount) AS value FROM source GROUP BY ${expression} ORDER BY dimension LIMIT 500`;
const resolve = (sql: string) => resolveTimeChartBucket(sql, 'value', 'dimension', schema);
const range = (start: string, end: string, column = 'event_time') => ({
  column,
  start,
  end,
  precision: 'timestamp',
});

describe('strict UTC timestamp ranges and saved state', () => {
  it('binds exact timestamp boundaries and preserves the old inclusive day interval', () => {
    const query = sourceQuery(
      'SELECT sum(amount) AS value FROM source',
      schema.map(c => c.column_name),
      [],
      timestamp(),
      ['event_time', 'day'],
    );
    expect(query.bindings).toEqual(['2024-02-29T12:30:00Z', '2024-02-29T13:00:00Z']);
    expect(query.sql).toContain('>= CAST(? AS TIMESTAMPTZ)');
    expect(query.sql).toContain('< CAST(? AS TIMESTAMPTZ)');
    const days = dateRangeBounds({ column: 'day', start: '2024-02-29', end: '2024-02-29' });
    expect(days.end - days.start).toBe(86400000);
    expect(new Date(days.end).toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });
  it.each([
    { precision: 'day' },
    { precision: null },
    { precision: undefined },
    { extra: true },
    { start: '2024-02-29' },
    { start: '2024-02-29T12:30:00.000Z' },
    { start: '2024-02-29T12:30:00+00:00' },
    { start: '2024-02-29 12:30:00Z' },
    { start: '2024-02-29T12:30:60Z' },
    { start: '2024-02-29T24:00:00Z' },
    { start: '2023-02-29T12:30:00Z' },
    { start: '0000-02-29T12:30:00Z' },
    { start: '-001-02-29T12:30:00Z' },
    { end: '10000-01-01T00:00:00Z' },
    { end: '2024-02-29T12:30:00Z' },
    { end: '2024-02-29T12:29:59Z' },
    { start: "2024-02-29T12:30:00Z' OR true --" },
    { column: '' },
  ])('rejects malformed or unbounded range %j', patch => {
    expect(() => validateDateRange({ ...timestamp(), ...patch })).toThrow();
  });
  it.each(['label', 'unknown', 'event_time" OR true'])(
    'requires an actual temporal source column %s',
    column => {
      expect(() =>
        sourceQuery(
          'SELECT sum(amount) AS value FROM source',
          schema.map(c => c.column_name),
          [],
          { ...timestamp(), column },
          ['event_time', 'day'],
        ),
      ).toThrow();
    },
  );
  it.each([
    ['2024-03-01T00:00:00Z', '2024-03-01T01:00:00Z', '2024-02-29T23:00:00Z'],
    ['2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z', '2025-12-31T23:59:59Z'],
    ['0001-01-01T00:00:01Z', '0001-01-01T00:00:02Z', '0001-01-01T00:00:00Z'],
    ['9999-12-31T23:59:58Z', '9999-12-31T23:59:59Z', '9999-12-31T23:59:57Z'],
  ])('compares an equal number of UTC seconds for %s', (start, end, previousStart) => {
    expect(previousDateRange(timestamp(start, end))).toEqual(timestamp(previousStart, start));
  });
  it('rejects timestamp previous-period year underflow', () => {
    expect(() =>
      previousDateRange(timestamp('0001-01-01T00:00:00Z', '0001-01-01T00:00:01Z')),
    ).toThrow('underflow');
  });
  const state = () => ({
    version: 1,
    filters: [],
    dateRange: timestamp(),
    relativePeriod: null,
    numberNotation: 'auto',
    comparePrevious: true,
  });
  it('round-trips exact timestamp precision through saved views and absolute date resolution', () => {
    const loaded = validatePersonalViewState(JSON.parse(JSON.stringify(state())));
    expect(loaded).toEqual(state());
    expect(resolveViewDates(loaded, new Date('2027-01-01Z'))).toEqual(timestamp());
  });
  it.each([
    { precision: 'minute' },
    { precision: null },
    { start: '2024-02-30T12:30:00Z' },
    { extra: 'bad' },
  ])('rejects invalid timestamp saved view %j', patch => {
    expect(() =>
      validatePersonalViewState({ ...state(), dateRange: { ...timestamp(), ...patch } }),
    ).toThrow();
  });
});

describe('proof of the original chart bucket', () => {
  it.each([
    ['"day"', 'day', 'day', 'day'],
    ["date_trunc('hour', event_time)", 'event_time', 'hour', 'duckdb'],
    ["date_trunc('week', source.event_time)", 'event_time', 'week', 'duckdb'],
    ["strftime(event_time, '%Y-%m-%d')", 'event_time', 'day', 'day'],
    ["strftime('%Y-%m', event_time)", 'event_time', 'month', 'month'],
    ["strftime(date_trunc('week', event_time), '%Y-%m-%d')", 'event_time', 'week', 'day'],
    ["strftime(date_trunc('month', event_time), '%Y-%m')", 'event_time', 'month', 'month'],
    [
      "strftime(date_trunc('hour', event_time), '%Y-%m-%dT%H:%M:%SZ')",
      'event_time',
      'hour',
      'timestamp',
    ],
    ["strftime(event_time, '%Y-%m-%dT%H:00:00Z')", 'event_time', 'hour', 'hour'],
  ])('proves expression %s', (expr, column, grain, format) => {
    expect(resolve(chart(expr))).toEqual({ column, grain, format });
  });
  it.each([
    'event_time',
    'label',
    "strftime(event_time, '%w')",
    "strftime(event_time, '%Y-%m-%dT%H:%M:%SZ')",
    "strftime(date_trunc('hour', event_time), '%Y-%m-%d')",
    "strftime(date_trunc('week', event_time), '%Y-%m')",
    "date_trunc('year', event_time)",
    'CASE WHEN amount > 0 THEN day ELSE NULL END',
    'CAST(event_time AS DATE)',
    '"event_time"; DROP TABLE source"',
  ])('does not guess a bucket for %s', expr => expect(resolve(chart(expr))).toBeUndefined());
  it.each([
    'ORDER BY value DESC LIMIT 1',
    'ORDER BY dimension LIMIT 240',
    'LIMIT 500',
    'HAVING sum(amount)>0 ORDER BY dimension LIMIT 500',
    'ORDER BY dimension LIMIT 500; DROP TABLE source',
  ])('does not attach metadata to selection-defining or unsafe SQL %s', tail => {
    expect(
      resolve(chart("date_trunc('day', event_time)").replace('ORDER BY dimension LIMIT 500', tail)),
    ).toBeUndefined();
  });
  it('preserves exact quoted schema column identity', () => {
    const unusual = [{ column_name: 'event "time', column_type: 'TIMESTAMP' }];
    expect(
      resolveTimeChartBucket(
        chart('date_trunc(\'day\', "event ""time")'),
        'value',
        'dimension',
        unusual,
      ),
    ).toEqual({ column: 'event "time', grain: 'day', format: 'duckdb' });
  });
});

describe('UTC selection bounds and alignment', () => {
  const bucket = (
    grain: TimeBucket['grain'],
    format: TimeBucket['format'] = 'timestamp',
  ): TimeBucket => ({ column: 'event_time', grain, format });
  it.each([
    ['hour', '2024-02-29T23:00:00Z', '2024-03-01T00:00:00Z'],
    ['day', '2024-02-29T00:00:00Z', '2024-03-01T00:00:00Z'],
    ['week', '2025-12-29T00:00:00Z', '2026-01-05T00:00:00Z'],
    ['month', '2024-02-01T00:00:00Z', '2024-03-01T00:00:00Z'],
    ['month', '2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z'],
  ] as const)('uses a calendar UTC %s bucket', (grain, start, end) => {
    expect(buildTimeSelection([start], bucket(grain))?.ranges).toEqual([range(start, end)]);
  });
  it('clips a partial week without selecting unobserved days and marks an empty intersection null', () => {
    const current = timestamp('2026-01-01T12:00:00Z', '2026-01-06T06:00:00Z');
    expect(
      buildTimeSelection(
        ['2025-12-29T00:00:00Z', '2026-01-05T00:00:00Z', '2026-01-12T00:00:00Z'],
        bucket('week'),
        current,
      )?.ranges,
    ).toEqual([
      range(current.start, '2026-01-05T00:00:00Z'),
      range('2026-01-05T00:00:00Z', current.end),
      null,
    ]);
  });
  it('clips a partial leap month to inclusive legacy days only on the same column', () => {
    const current = { column: 'event_time', start: '2024-02-15', end: '2024-03-03' };
    expect(
      buildTimeSelection(['2024-02', '2024-03'], bucket('month', 'month'), current)?.ranges,
    ).toEqual([
      range('2024-02-15T00:00:00Z', '2024-03-01T00:00:00Z'),
      range('2024-03-01T00:00:00Z', '2024-03-04T00:00:00Z'),
    ]);
    expect(
      buildTimeSelection(['2024-02'], bucket('month', 'month'), { ...current, column: 'other' }),
    ).toBeUndefined();
  });
  it('keeps original order and invalid/null/missing timestamps as null without coercion', () => {
    expect(
      buildTimeSelection(
        [
          '2024-03-01T01:00:00Z',
          null,
          undefined,
          0,
          'null',
          '2024-02-30T00:00:00Z',
          '2024-03-01T00:01:00Z',
          '2024-03-01T00:00:00+09:00',
          '2024-03-01T00:00:00Z',
        ],
        bucket('hour'),
      )?.ranges,
    ).toEqual([
      range('2024-03-01T01:00:00Z', '2024-03-01T02:00:00Z'),
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      range('2024-03-01T00:00:00Z', '2024-03-01T01:00:00Z'),
    ]);
  });
  it('accepts only serialized UTC bucket starts and calendar-aligned weeks/months', () => {
    expect(
      buildTimeSelection(
        [
          '2024-02-29 12:00:00',
          '2024-02-29 12:00:00+00',
          '2024-02-29 12:00:00+09',
          '2024-02-29 12:00:00.001',
        ],
        bucket('hour', 'duckdb'),
      )?.ranges.map(Boolean),
    ).toEqual([true, true, false, false]);
    expect(buildTimeSelection(['2026-01-01T00:00:00Z'], bucket('week'))?.ranges).toEqual([null]);
    expect(buildTimeSelection(['2024-02-29T00:00:00Z'], bucket('month'))?.ranges).toEqual([null]);
    expect(buildTimeSelection(['9999-12-31T23:00:00Z'], bucket('hour'))?.ranges).toEqual([null]);
  });
  it('declines oversized metadata instead of slicing indices', () => {
    expect(buildTimeSelection(Array(240).fill(null), bucket('day'))?.ranges).toHaveLength(240);
    expect(buildTimeSelection(Array(241).fill(null), bucket('day'))).toBeUndefined();
  });
});
