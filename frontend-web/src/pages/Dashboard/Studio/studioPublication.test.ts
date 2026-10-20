import { describe, it, expect, vi } from 'vitest';
import { fetchOwnerPublication, fetchPublished, publicationError, validatePublication } from './studioPublication';
import { get } from '@/helpers/apiHelper';
vi.mock('@/helpers/apiHelper', () => ({ get: vi.fn(), post: vi.fn() }));
const metadata = {
  token: 'a'.repeat(64),
  version: 1,
  visibility: 'private',
  allowRemix: false,
  expiresAt: null,
  asOf: '2026-10-15T00:00:00Z',
};
describe('publication boundary', () => {
  it('accepts the empty 200 body before the first publication', async () => {
    vi.mocked(get).mockResolvedValueOnce({ data: '' } as any);
    expect(await fetchOwnerPublication(8)).toBeNull();
  });
  it('rejects unsafe tokens, unknown scopes and invalid versions', () => {
    expect(validatePublication(metadata)).toEqual(metadata);
    for (const patch of [
      { token: '../script' },
      { visibility: 'everyone' },
      { version: 0 },
      { asOf: 'bad' },
      { expiresAt: 'bad' },
    ])
      expect(() => validatePublication({ ...metadata, ...patch })).toThrow();
  });
  it('shows data-free permission and expiry guidance without server diagnostics', () => {
    const denied = publicationError({ response: { status: 403 }, message: 'sql password' });
    expect(denied).toContain('권한');
    expect(denied).toContain('연결 데이터');
    expect(denied).not.toContain('소유자로 로그인해야');
    expect(denied).not.toContain('sql');
    expect(publicationError({ response: { status: 410 }, message: 'sql password' })).toContain('만료');
    expect(publicationError({ response: { status: 410 }, message: 'sql password' })).not.toContain('sql');
  });
  const token = 'a'.repeat(64);
  const published = (filters?: unknown, dateRange?: unknown) => ({
    ...metadata,
    token,
    snapshot: {
      title: 'Auction',
      periodLabel: '전체 기간',
      blocks: [],
      layouts: { lg: [], md: [], xs: [] },
      ...(filters === undefined ? {} : { filters }),
      ...(dateRange === undefined ? {} : { dateRange }),
    },
  });
  it('keeps the published common scope as the same typed list the document uses', async () => {
    const filters = [{ column: 'device_type', values: ['Mobile/Tablet', 1, '1', true, null] }];
    vi.mocked(get).mockResolvedValueOnce({ data: published(filters) } as any);
    expect((await fetchPublished(token)).snapshot.filters).toEqual(filters);
    // An older payload without a scope means "no filters" instead of an unknown one.
    vi.mocked(get).mockResolvedValueOnce({ data: published() } as any);
    expect((await fetchPublished(token)).snapshot.filters).toEqual([]);
  });
  it('rejects a malformed published scope instead of rendering a whole-scope snapshot', async () => {
    for (const filters of [
      [{ column: 'device_type', values: [] }],
      [{ column: 'device_type', values: ['x', 'x'] }],
      [
        { column: 'a', values: [1] },
        { column: 'a', values: [2] },
      ],
      [{ column: 'device_type', values: [{ nested: 1 }] }],
      { column: 'device_type', values: ['Mobile/Tablet'] },
    ]) {
      vi.mocked(get).mockResolvedValueOnce({ data: published(filters) } as any);
      await expect(fetchPublished(token)).rejects.toThrow(/공통 범위/);
    }
  });
  it('keeps the published period and rejects a malformed one with the same protocol rules', async () => {
    const dateRange = { column: 'created_at', start: '2024-01-01', end: '2024-01-31' };
    vi.mocked(get).mockResolvedValueOnce({ data: published(undefined, dateRange) } as any);
    expect((await fetchPublished(token)).snapshot.dateRange).toEqual(dateRange);
    vi.mocked(get).mockResolvedValueOnce({ data: published() } as any);
    expect((await fetchPublished(token)).snapshot.dateRange).toBeUndefined();
    for (const malformed of [
      { column: 'created_at', start: '2024-02-31', end: '2024-03-05' },
      { column: 'created_at', start: '2024-01-01', end: '9999-12-31' },
      { column: 'created_at', start: '2024-01-01' },
    ]) {
      vi.mocked(get).mockResolvedValueOnce({ data: published(undefined, malformed) } as any);
      await expect(fetchPublished(token)).rejects.toThrow(/공통 범위/);
    }
  });
});
