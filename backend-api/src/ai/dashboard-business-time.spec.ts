import {
  businessDate,
  dateRangeBounds,
  isoSecond,
  resolveBusinessDateRange,
  validateBusinessTimeZone,
  validateDateRange,
} from './dashboard-date-range';
import { previousDateRange } from './dashboard-period';
import { resolveViewDates, PersonalViewState } from '../dashboard/personal-view-state';
const day = (start: string, end = start) => ({ column: 'event_time', start, end });
const bounds = (start: string, zone: string, end = start) => {
  const range = dateRangeBounds(day(start, end), zone);
  return [isoSecond(range.start), isoSecond(range.end)];
};
describe('business calendar boundaries (internal contract)', () => {
  it.each([
    ['UTC', '2026-01-01', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'],
    ['Asia/Seoul', '2026-01-01', '2025-12-31T15:00:00Z', '2026-01-01T15:00:00Z'],
    ['Asia/Kathmandu', '2026-01-01', '2025-12-31T18:15:00Z', '2026-01-01T18:15:00Z'],
    ['America/New_York', '2026-03-08', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
    ['America/New_York', '2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['Australia/Lord_Howe', '2026-10-04', '2026-10-03T13:30:00Z', '2026-10-04T13:00:00Z'],
    ['America/Sao_Paulo', '2018-11-04', '2018-11-04T03:00:00Z', '2018-11-05T02:00:00Z'],
    ['America/Havana', '2026-11-01', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['Pacific/Apia', '2011-12-29', '2011-12-29T10:00:00Z', '2011-12-30T10:00:00Z'],
    ['Asia/Seoul', '2024-02-29', '2024-02-28T15:00:00Z', '2024-02-29T15:00:00Z'],
  ])('%s %s uses civil boundaries', (zone, date, start, end) => {
    expect(bounds(date, zone)).toEqual([start, end]);
  });
  it('converts multi-day inclusive ranges to half-open instants', () => {
    expect(bounds('2026-03-07', 'America/New_York', '2026-03-09')).toEqual([
      '2026-03-07T05:00:00Z',
      '2026-03-10T04:00:00Z',
    ]);
  });
  it('preserves timestamp selections as absolute instants', () => {
    const range = {
      ...day('2026-03-08T06:00:00Z', '2026-03-08T08:00:00Z'),
      precision: 'timestamp' as const,
    };
    expect(resolveBusinessDateRange(range, 'America/New_York')).toEqual(range);
    expect(dateRangeBounds(range, 'Asia/Seoul')).toEqual(dateRangeBounds(range));
  });
  it.each([
    '',
    'KST',
    '+09:00',
    'UTC+9',
    'Asia/Unknown',
    ' Asia/Seoul',
    'Asia/Seoul ',
    "Asia/Seoul'; DROP",
    null,
    9,
    {},
  ])('rejects timezone %p', value => {
    expect(() => validateBusinessTimeZone(value)).toThrow('timezone');
    expect(() => dateRangeBounds(day('2026-01-01'), value as string)).toThrow('timezone');
  });
  it('accepts explicit regions while preserving the range whitelist', () => {
    expect(validateDateRange({ ...day('2026-01-01'), timeZone: 'Asia/Seoul' }).timeZone).toBe(
      'Asia/Seoul',
    );
    expect(() => validateDateRange({ ...day('2026-01-01'), timezone: 'Asia/Seoul' })).toThrow();
  });

  it.each(['2011-12-30', '2026-02-29', '2026-04-31', '0000-01-01', '10000-01-01'])(
    'rejects nonexistent date %s',
    date => {
      expect(() => bounds(date, 'Pacific/Apia')).toThrow();
    },
  );
  it('rejects boundaries outside supported UTC years', () => {
    expect(() => bounds('0001-01-01', 'Asia/Seoul')).toThrow('overflow');
    expect(() => bounds('9999-12-31', 'Asia/Seoul')).toThrow('overflow');
  });
  it('retains legacy UTC defaults', () => {
    const range = day('2024-02-28', '2024-03-01');
    expect(dateRangeBounds(range)).toEqual(dateRangeBounds(range, 'UTC'));
    expect(resolveBusinessDateRange(range)).toEqual({
      column: 'event_time',
      start: '2024-02-28T00:00:00Z',
      end: '2024-03-02T00:00:00Z',
      precision: 'timestamp',
    });
  });
  it('compares calendar day counts instead of elapsed hours across DST', () => {
    const current = day('2026-03-08');
    const previous = previousDateRange(current, 'America/New_York');
    expect(previous).toEqual(day('2026-03-07'));
    const a = dateRangeBounds(current, 'America/New_York');
    const b = dateRangeBounds(previous, 'America/New_York');
    expect(a.end - a.start).toBe(23 * 3600000);
    expect(b.end - b.start).toBe(24 * 3600000);
    expect(b.end).toBe(a.start);
  });
  it('compares timestamp periods by elapsed seconds across DST', () => {
    const current = resolveBusinessDateRange(day('2026-03-08'), 'America/New_York');
    expect(previousDateRange(current, 'America/New_York')).toMatchObject({
      start: '2026-03-07T06:00:00Z',
      end: '2026-03-08T05:00:00Z',
      precision: 'timestamp',
    });
  });
  it('resolves relative dates in the supplied calendar', () => {
    const now = new Date('2026-01-01T16:00:00Z');
    expect(businessDate(now, 'Asia/Seoul')).toBe('2026-01-02');
    const state: PersonalViewState = {
      version: 1,
      filters: [],
      dateRange: null,
      relativePeriod: { column: 'event_time', days: 7 },
      numberNotation: 'auto',
    };
    expect(resolveViewDates(state, now, 'Asia/Seoul')).toEqual(day('2025-12-27', '2026-01-02'));
    expect(resolveViewDates(state, now)).toEqual(day('2025-12-26', '2026-01-01'));
  });
  it('ignores host timezone', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      const a = bounds('2026-01-01', 'Asia/Seoul');
      process.env.TZ = 'Asia/Tokyo';
      expect(bounds('2026-01-01', 'Asia/Seoul')).toEqual(a);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
