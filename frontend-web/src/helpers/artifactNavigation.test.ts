import { describe, expect, it } from 'vitest';
import { artifactListNavigation } from './artifactNavigation';

const source =
  '?artifactQuery=9월&artifactKind=analysis&artifactSort=title&artifactDisplay=grid&artifactView=archived&aiSourceId=32';
describe('artifact list navigation', () => {
  it.each(['/dashboard/', '/dashboard//', '/Dashboard'])(
    'preserves context for the supported list pathname %s',
    pathname => {
      const list = artifactListNavigation({ pathname, search: source });
      const studio = new URL(list.link('/dashboard/45/studio'), 'https://vm.test');
      expect(artifactListNavigation(studio).listHref).toContain('artifactView=archived');
      expect(list.listHref).toBe(artifactListNavigation({ pathname: '/dashboard', search: source }).listHref);
    },
  );
  it('carries list context through detail and Studio without unrelated workflow parameters', () => {
    const list = artifactListNavigation({ pathname: '/dashboard', search: source });
    const detail = new URL(list.link('/dashboard/45'), 'https://vm.test');
    const loaded = artifactListNavigation(detail);
    const studio = new URL(loaded.link('/dashboard/45/studio?mode=editor'), detail.origin);
    expect(artifactListNavigation(studio).listHref).toBe(list.listHref);
    expect(list.listHref).toContain('artifactView=archived');
    expect(list.listHref).not.toContain('aiSourceId');
    expect(studio.searchParams.get('mode')).toBe('editor');
  });
  it('carries the AI artifact type through the viewer and back to the filtered hub', () => {
    const hub = artifactListNavigation({
      pathname: '/dashboard',
      search: '?artifactQuery=brief&artifactKind=ai&artifactDisplay=grid',
    });
    const viewer = new URL(hub.link('/ai-artifacts/33333333-3333-4333-8333-333333333333'), 'https://vm.test');
    const back = artifactListNavigation(viewer).listHref;
    expect(back).toBe('/dashboard?artifactQuery=brief&artifactKind=ai&artifactDisplay=grid');
  });
  it.each([
    'https://outside.test',
    '//outside.test',
    '/dashboard?aiSourceId=32',
    '{bad',
    JSON.stringify({
      version: 1,
      query: '',
      kind: 'all',
      sort: 'recent',
      display: 'grid',
      view: 'active',
      path: '//outside.test',
    }),
    JSON.stringify({ version: 1, query: 'x'.repeat(201), kind: 'all', sort: 'recent', display: 'grid', view: 'active' }),
    JSON.stringify({ version: 2, query: '', kind: 'all', sort: 'recent', display: 'grid', view: 'active' }),
  ])('falls back to the fixed list for invalid context %s', value => {
    expect(
      artifactListNavigation({ pathname: '/dashboard/1/studio', search: '?artifactReturn=' + encodeURIComponent(value) })
        .listHref,
    ).toBe('/dashboard');
  });
  it('rejects duplicate contexts and preserves unchanged legacy links by default', () => {
    const nav = artifactListNavigation({ pathname: '/dashboard', search: '' });
    expect(nav.link('45')).toBe('45');
    expect(
      artifactListNavigation({ pathname: '/dashboard/45', search: '?artifactReturn={}&artifactReturn={}' }).listHref,
    ).toBe('/dashboard');
    expect(
      artifactListNavigation({ pathname: '/dashboard', search: '?artifactDisplay=grid&artifactDisplay=list' }).listHref,
    ).toBe('/dashboard');
  });
});
