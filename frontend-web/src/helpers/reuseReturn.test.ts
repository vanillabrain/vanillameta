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

it('preserves the exact consent ticket after login', () => {
  const path = '/ai-connections/approve/' + 'a'.repeat(64);
  expect(reuseReturn('?returnTo=' + encodeURIComponent(path))).toBe(path);
});
it.each([
  '/ai-connections',
  '/ai-connections/approve/' + 'a'.repeat(63),
  '/ai-connections/approve/' + 'A'.repeat(64),
  '/ai-connections/approve/' + 'a'.repeat(64) + '?next=https://evil.test',
  '/ai-connections/approve/' + 'a'.repeat(64) + '/..',
  '//evil.test/ai-connections/approve/' + 'a'.repeat(64),
])('rejects nonexact consent return %s', path => {
  expect(reuseReturn('?returnTo=' + encodeURIComponent(path))).toBe('/dashboard');
});

it('rejects a consent path with a final newline', () => {
  expect(reuseReturn('?returnTo=' + encodeURIComponent('/ai-connections/approve/' + 'a'.repeat(64) + '\n'))).toBe(
    '/dashboard',
  );
});
