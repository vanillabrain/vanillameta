import { productionConfigProblems } from '../config/production-guard';
import {
  PUBLICATION_MAX_DAYS,
  defaultPublicationExpiry,
  latestPublicationExpiry,
  publicationConfigProblems,
  publicationDefaultDays,
} from './studio-publication-expiry';

describe('publication expiry policy', () => {
  it('defaults to the 30-day ceiling and may be shortened, never lengthened', () => {
    expect(PUBLICATION_MAX_DAYS).toBe(30);
    expect(publicationDefaultDays({})).toBe(30);
    expect(publicationDefaultDays({ PUBLICATION_DEFAULT_DAYS: ' 7 ' } as any)).toBe(7);
    for (const value of ['0', '31', '-1', '1.5', 'week'])
      expect(() => publicationDefaultDays({ PUBLICATION_DEFAULT_DAYS: value } as any)).toThrow(
        'PUBLICATION_DEFAULT_DAYS must be an integer from 1 to 30',
      );
  });

  it('computes the default and the latest accepted expiry from the given instant', () => {
    const now = Date.UTC(2026, 9, 24, 12);
    expect(defaultPublicationExpiry(now).toISOString()).toBe('2026-11-23T12:00:00.000Z');
    // 30 days plus an hour of grace for a browser-filled value that arrives late.
    expect(new Date(latestPublicationExpiry(now)).toISOString()).toBe('2026-11-23T13:00:00.000Z');
  });

  it('stops a production boot on a malformed value', () => {
    expect(publicationConfigProblems({ PUBLICATION_DEFAULT_DAYS: '99' } as any)).toHaveLength(1);
    const base = {
      NODE_ENV: 'prod',
      ACCESS_SECRET: 'a'.repeat(40),
      REFRESH_SECRET: 'b'.repeat(40),
      JWT_ACCESS_SECRET: 'c'.repeat(40),
      URL_ACCESS_SECRET: 'd'.repeat(40),
      CONFIG_SECRET_KEY: 'e'.repeat(40),
      CORS_ORIGIN: 'https://app.example.test',
    } as any;
    expect(productionConfigProblems({ ...base, PUBLICATION_DEFAULT_DAYS: '99' })).toEqual([
      'PUBLICATION_DEFAULT_DAYS must be an integer from 1 to 30',
    ]);
    expect(productionConfigProblems({ ...base, PUBLICATION_DEFAULT_DAYS: '14' })).toEqual([]);
  });
});
