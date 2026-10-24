import { productionConfigProblems } from '../config/production-guard';
import { quotaConfigProblems, quotaDefaults, quotaWindows } from './quota-config';

describe('quotaDefaults', () => {
  it('falls back to the placeholders when unset or blank', () => {
    expect(quotaDefaults({})).toEqual({ dailyCalls: 30, monthlyTokens: 500000 });
    expect(quotaDefaults({ QUOTA_DAILY_CALLS: ' ', QUOTA_MONTHLY_TOKENS: '' } as any)).toEqual({
      dailyCalls: 30,
      monthlyTokens: 500000,
    });
  });

  it('reads configured values, including 0 for no AI', () => {
    expect(quotaDefaults({ QUOTA_DAILY_CALLS: '5', QUOTA_MONTHLY_TOKENS: '0' } as any)).toEqual({
      dailyCalls: 5,
      monthlyTokens: 0,
    });
  });

  it.each(['-1', '1.5', 'ten', '1e3', '9007199254740993'])('rejects %s', value => {
    expect(() => quotaDefaults({ QUOTA_DAILY_CALLS: value } as any)).toThrow(
      'QUOTA_DAILY_CALLS must be a non-negative integer',
    );
    expect(quotaConfigProblems({ QUOTA_MONTHLY_TOKENS: value } as any)).toEqual([
      'QUOTA_MONTHLY_TOKENS must be a non-negative integer',
    ]);
  });

  it('stops a production boot on a malformed value and accepts a valid one', () => {
    const base = {
      NODE_ENV: 'prod',
      ACCESS_SECRET: 'a'.repeat(40),
      REFRESH_SECRET: 'b'.repeat(40),
      JWT_ACCESS_SECRET: 'c'.repeat(40),
      URL_ACCESS_SECRET: 'd'.repeat(40),
      CONFIG_SECRET_KEY: 'e'.repeat(40),
      CORS_ORIGIN: 'https://app.example.test',
    } as any;
    expect(productionConfigProblems({ ...base, QUOTA_DAILY_CALLS: 'many' })).toEqual([
      'QUOTA_DAILY_CALLS must be a non-negative integer',
    ]);
    expect(productionConfigProblems({ ...base, QUOTA_DAILY_CALLS: '12' })).toEqual([]);
  });
});

describe('quotaWindows', () => {
  it('uses the UTC calendar day and month whatever the instant', () => {
    const windows = quotaWindows(new Date('2026-12-31T23:59:59.999Z'));
    expect(windows.dayStart.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    expect(windows.dayEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(windows.monthStart.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(windows.monthEnd.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('puts 09:00 in Korea (00:00 UTC) on the day boundary', () => {
    expect(quotaWindows(new Date('2026-10-24T14:59:59Z')).dayStart.toISOString()).toBe(
      '2026-10-24T00:00:00.000Z',
    );
    expect(quotaWindows(new Date('2026-10-25T00:00:00Z')).dayStart.toISOString()).toBe(
      '2026-10-25T00:00:00.000Z',
    );
  });
});
