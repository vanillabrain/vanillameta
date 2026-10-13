import { comparisonValues, previousDateRange, validatePeriodOptions } from './dashboard-period';

describe('dashboard period options', () => {
  it('defaults options independently of trend visibility', () => {
    expect(validatePeriodOptions({ includeTrends: false })).toEqual({
      trendGrain: 'auto',
      comparePrevious: false,
    });
    expect(validatePeriodOptions(undefined)).toEqual({
      trendGrain: 'auto',
      comparePrevious: false,
    });
    expect(validatePeriodOptions({ trendGrain: 'week', comparePrevious: true })).toEqual({
      trendGrain: 'week',
      comparePrevious: true,
    });
  });
  it.each(['hour', 'year', '', null, 1, true])(
    'rejects grain %p even without trends',
    trendGrain => {
      expect(() => validatePeriodOptions({ trendGrain, includeTrends: false })).toThrow('grain');
    },
  );
  it.each(['true', 1, 0, null, []])('rejects nonboolean comparison %p', comparePrevious => {
    expect(() => validatePeriodOptions({ comparePrevious })).toThrow('option');
  });
});

describe('previous inclusive UTC period', () => {
  it.each([
    ['2026-01-01', '2026-01-03', '2025-12-29', '2025-12-31'],
    ['2024-03-01', '2024-03-02', '2024-02-28', '2024-02-29'],
    ['2026-03-08', '2026-03-08', '2026-03-07', '2026-03-07'],
    ['0001-01-02', '0001-01-02', '0001-01-01', '0001-01-01'],
    ['9999-12-31', '9999-12-31', '9999-12-30', '9999-12-30'],
  ])('moves %s through %s directly before it', (start, end, previousStart, previousEnd) => {
    const result = previousDateRange({ column: 'event date', start, end });
    expect(result).toEqual({ column: 'event date', start: previousStart, end: previousEnd });
    expect(Date.parse(end) - Date.parse(start)).toBe(
      Date.parse(result.end) - Date.parse(result.start),
    );
  });
  it.each([
    ['2026-02-29', '2026-03-01'],
    ['2026-04-31', '2026-05-01'],
    ['2026-1-01', '2026-01-02'],
    ['2026-01-01T00:00:00Z', '2026-01-02'],
    ['2026-01-02', '2026-01-01'],
    ['0000-12-31', '0001-01-01'],
    ['-001-01-01', '0001-01-01'],
    ['10000-01-01', '10000-01-02'],
    ['0001-01-01', '0001-01-01'],
    ['0001-01-02', '0001-01-03'],
    ['0001-01-01', '9999-12-31'],
  ])('rejects invalid or underflowing range %s through %s', (start, end) => {
    expect(() => previousDateRange({ column: 'day', start, end })).toThrow();
  });
});

describe('previous period comparison', () => {
  it.each([
    '9007199254740991.1',
    '-9007199254740991.1',
    '9.0071992547409911e15',
    '9007199254740990.9',
  ])('rejects a boundary decimal string before rounded arithmetic: %s', current => {
    expect(comparisonValues(current, '9007199254740991')).toMatchObject({
      delta: null,
      percentChange: null,
      unavailable: '정확한 비교 범위를 초과합니다.',
    });
    expect(comparisonValues('9007199254740991', current)).toMatchObject({
      previousValue: null,
      delta: null,
      percentChange: null,
      unavailable: '정확한 비교 범위를 초과합니다.',
    });
  });
  it.each([
    [30, 20, { previousValue: 20, delta: 10, percentChange: 50 }],
    ['30.0', '20', { previousValue: 20, delta: 10, percentChange: 50 }],
    [0, 20, { previousValue: 20, delta: -20, percentChange: -100 }],
    [-5, -10, { previousValue: -10, delta: 5, percentChange: 50 }],
    [-15, -10, { previousValue: -10, delta: -5, percentChange: -50 }],
    [20, 0, { previousValue: 0, delta: 20, percentChange: null }],
    [0, 0, { previousValue: 0, delta: 0, percentChange: null }],
    [null, 0, { previousValue: 0, delta: null, percentChange: null }],
    [20, null, { previousValue: null, delta: null, percentChange: null }],
    [Infinity, 20, { previousValue: 20, delta: null, percentChange: null }],
    [20, NaN, { previousValue: null, delta: null, percentChange: null }],
    [20, '', { previousValue: null, delta: null, percentChange: null }],
    [20, false, { previousValue: null, delta: null, percentChange: null }],
    [20, 'Infinity', { previousValue: null, delta: null, percentChange: null }],
    [
      Number.MAX_VALUE,
      -Number.MAX_VALUE,
      {
        previousValue: null,
        delta: null,
        percentChange: null,
        unavailable: '정확한 비교 범위를 초과합니다.',
      },
    ],
    [1, 1e-320, { previousValue: 1e-320, delta: 1, percentChange: null }],
  ])(
    'compares current %p and previous %p without nonfinite output',
    (current, previous, expected) => {
      expect(comparisonValues(current, previous)).toEqual(expected);
    },
  );
  it.each([
    ['9007199254740993', '9007199254740992', null],
    ['9007199254740993', '20', 20],
    [20, 9007199254740992, null],
    [9007199254740992, 20, 20],
    ['-9007199254740993', '-9007199254740992', null],
    ['9007199254740993.0', '20', 20],
    ['900719925474099300e-2', '20', 20],
    ['9.007199254740993e15', '20', 20],
    ['9007199254740992.1', '20', 20],
    ['9007199254740992.5', '20', 20],
    ['90071992547409925e-1', '20', 20],
    ['9.0071992547409925e15', '20', 20],
    ['20', '9007199254740992.1', null],
    [Number.MAX_SAFE_INTEGER, -2, -2],
    [-Number.MAX_SAFE_INTEGER, 2, 2],
    [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER],
  ])(
    'marks unsafe inputs or delta for current %p / previous %p unavailable',
    (current, previous, previousValue) => {
      expect(comparisonValues(current, previous)).toEqual({
        previousValue,
        delta: null,
        percentChange: null,
        unavailable: '정확한 비교 범위를 초과합니다.',
      });
    },
  );
  it.each([
    ['12.75', '10.5'],
    ['2.675', '1.25'],
    ['2.5e1', '20'],
    ['20', '19.5'],
    [-12.75, -10.5],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1],
  ])('does not reject fractional or safe integer current %p / previous %p', (current, previous) => {
    const result = comparisonValues(current, previous);
    expect(result).not.toHaveProperty('unavailable');
    expect(result.previousValue).toBe(Number(previous));
    expect(result.delta).toBe(Number(current) - Number(previous));
    expect(result.percentChange).toBe(
      ((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100,
    );
  });
});
