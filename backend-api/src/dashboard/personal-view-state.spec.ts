import { BadRequestException } from '@nestjs/common';
import {
  PersonalViewState,
  resolveViewDates,
  validatePersonalViewState,
} from './personal-view-state';

const legacyState = (): PersonalViewState => ({
  version: 1,
  filters: [{ column: 'channel', values: ['online', 0, false, null] }],
  dateRange: null,
  relativePeriod: null,
  numberNotation: 'compact',
});
const absolute = { column: 'day', start: '2026-01-11', end: '2026-01-12' };
const relative = { column: 'day', days: 7 as const };
const roundTrip = (state: PersonalViewState) =>
  validatePersonalViewState(JSON.parse(JSON.stringify(validatePersonalViewState(state))));

describe('personal view trend and comparison settings', () => {
  it.each(['auto', 'day', 'week', 'month'] as const)(
    'round-trips trend grain %s with comparison and absolute dates at version 1',
    trendGrain => {
      const state = { ...legacyState(), dateRange: absolute, trendGrain, comparePrevious: true };
      expect(roundTrip(state)).toEqual(state);
      expect(resolveViewDates(roundTrip(state), new Date('2027-01-01T00:00:00Z'))).toEqual(
        absolute,
      );
    },
  );

  it('round-trips comparison with relative dates and retains fresh UTC date resolution', () => {
    const state = {
      ...legacyState(),
      relativePeriod: relative,
      trendGrain: 'week' as const,
      comparePrevious: true,
    };
    const loaded = roundTrip(state);
    expect(loaded).toEqual(state);
    expect(resolveViewDates(loaded, new Date('2024-03-01T00:00:01Z'))).toEqual({
      column: 'day',
      start: '2024-02-24',
      end: '2024-03-01',
    });
    expect(loaded.relativePeriod).toEqual(relative);
    expect(loaded.dateRange).toBeNull();
  });

  it.each([{}, { dateRange: absolute }, { relativePeriod: relative }])(
    'keeps legacy version and exact return shape for old views %j',
    period => {
      const state = { ...legacyState(), ...period };
      const loaded = roundTrip(state);
      expect(loaded).toEqual(state);
      expect(Object.keys(loaded)).toEqual(Object.keys(state));
      expect(loaded).not.toHaveProperty('trendGrain');
      expect(loaded).not.toHaveProperty('comparePrevious');
      expect(loaded.version).toBe(1);
      expect(loaded).not.toBe(state);
    },
  );

  it.each([
    { trendGrain: 'month' as const },
    { comparePrevious: false },
    { comparePrevious: true, dateRange: absolute },
  ])('accepts independently optional fields without adding omitted defaults %j', patch => {
    const state = { ...legacyState(), ...patch };
    const loaded = roundTrip(state);
    expect(loaded).toEqual(state);
    expect(Object.keys(loaded)).toEqual(Object.keys(state));
  });

  it('accepts an explicit false comparison with no period', () => {
    const state = { ...legacyState(), trendGrain: 'auto' as const, comparePrevious: false };
    expect(roundTrip(state)).toEqual(state);
    expect(resolveViewDates(roundTrip(state))).toBeNull();
  });

  it.each([undefined, null, false, true, 0, 1, '', 'year', 'DAY', 'day ', [], {}, ['week']])(
    'rejects invalid trend grain %j even when explicitly present and falsey',
    trendGrain => {
      expect(() => validatePersonalViewState({ ...legacyState(), trendGrain })).toThrow(
        BadRequestException,
      );
    },
  );

  it.each([undefined, null, 0, 1, '', 'true', 'false', [], {}, [false]])(
    'rejects non-boolean comparison %j even when explicitly present and falsey',
    comparePrevious => {
      expect(() =>
        validatePersonalViewState({ ...legacyState(), dateRange: absolute, comparePrevious }),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    {},
    { dateRange: undefined },
    { dateRange: false },
    { dateRange: { ...absolute, start: '2026-02-30' } },
    { dateRange: { ...absolute, start: '2026-01-13' } },
    { relativePeriod: undefined },
    { relativePeriod: false },
    { relativePeriod: { column: 'day', days: 0 } },
    { relativePeriod: { column: 'day', days: '7' } },
    { dateRange: absolute, relativePeriod: relative },
  ])('requires a valid unambiguous period when comparison is true %j', period => {
    expect(() =>
      validatePersonalViewState({ ...legacyState(), ...period, comparePrevious: true }),
    ).toThrow(BadRequestException);
  });

  it.each([undefined, null, false, 0, ''])('rejects unknown keys with value %j', unknown => {
    expect(() =>
      validatePersonalViewState({ ...legacyState(), trendGrain: 'day', unknown }),
    ).toThrow(BadRequestException);
  });
  it('round-trips timezone in absolute and relative periods', () => {
    const absoluteState = { ...legacyState(), dateRange: { ...absolute, timeZone: 'Asia/Seoul' } };
    expect(roundTrip(absoluteState)).toEqual(absoluteState);
    const relativeState = {
      ...legacyState(),
      relativePeriod: { ...relative, timeZone: 'Asia/Seoul' },
    };
    expect(roundTrip(relativeState)).toEqual(relativeState);
    expect(resolveViewDates(relativeState, new Date('2026-01-01T16:00:00Z'))).toEqual({
      column: 'day',
      start: '2025-12-27',
      end: '2026-01-02',
      timeZone: 'Asia/Seoul',
    });
  });
  it.each(['KST', 'Asia/Unknown', null, 9, ''])('rejects invalid saved timezone %p', timeZone => {
    expect(() =>
      validatePersonalViewState({ ...legacyState(), dateRange: { ...absolute, timeZone } }),
    ).toThrow();
    expect(() =>
      validatePersonalViewState({ ...legacyState(), relativePeriod: { ...relative, timeZone } }),
    ).toThrow();
  });
});
