import { describe, expect, it } from 'vitest';
import { publicStaticResource, shellNavigation } from './serviceWorkerPolicy';
const origin = 'https://app.example.invalid';
describe('offline shell authorization boundary', () => {
  it.each(['/v1/studio/dashboards/1', '/api/private/image.png', '/uploads/user.png', '/private/data.svg'])(
    'never caches protected response %s',
    path => {
      expect(publicStaticResource(new URL(path, origin), origin)).toBe(false);
    },
  );
  it('caches same-origin build assets while leaving external resources network-only', () => {
    expect(publicStaticResource(new URL('/assets/chart-abc.js', origin), origin)).toBe(true);
    expect(publicStaticResource(new URL('https://other.example.invalid/assets/chart.js'), origin)).toBe(false);
  });
  it('uses offline HTML only for application navigation, not protected data endpoints', () => {
    expect(shellNavigation(new URL('/dashboard/1', origin), origin)).toBe(true);
    for (const path of ['/v1/export/1', '/api/private', '/uploads/private', '/assets/chart.js'])
      expect(shellNavigation(new URL(path, origin), origin)).toBe(false);
  });
});
