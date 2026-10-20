import { describe, it, expect } from 'vitest';
import { reuseReturn } from './reuseReturn';
describe('reuse login return', () => {
  it('preserves only the internal reuse destination', () =>
    expect(reuseReturn('?returnTo=%2Freuse%2Fshare%2F11111111-1111-4111-8111-111111111111')).toBe(
      '/reuse/share/11111111-1111-4111-8111-111111111111',
    ));
  it.each([
    '?returnTo=https://evil.test',
    '?returnTo=//evil.test',
    '?returnTo=/reuse/share/../dashboard',
    '?returnTo=/dashboard',
    '?returnTo=/reuse/share/11111111-1111-4111-8111-111111111111&returnTo=bad',
  ])('rejects unsafe or ambiguous %s', s => expect(reuseReturn(s)).toBe('/dashboard'));
});
