import { describe, it, expect, vi } from 'vitest';
import { fetchOwnerPublication, publicationError, validatePublication } from './studioPublication';
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
    expect(publicationError({ response: { status: 403 }, message: 'sql password' })).toContain('권한');
    expect(publicationError({ response: { status: 410 }, message: 'sql password' })).toContain('만료');
    expect(publicationError({ response: { status: 410 }, message: 'sql password' })).not.toContain('sql');
  });
});
