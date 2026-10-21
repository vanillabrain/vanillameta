import { safeRouteTemplate, UNMATCHED_ROUTE } from './safe-route-template';

describe('safeRouteTemplate', () => {
  const capability = 'private-capability-value';
  it('uses only the registered route, excluding query strings and resolved router mounts', () => {
    const request = {
      route: { path: '/dashboard/:shareId' },
      baseUrl: `/tenant/${capability}`,
      path: `/dashboard/${capability}`,
      originalUrl: `/dashboard/${capability}?token=${capability}`,
      url: `/${capability}?token=${capability}`,
    };
    expect(safeRouteTemplate(request)).toBe('/dashboard/:shareId');
  });
  it.each([
    undefined,
    null,
    {},
    { route: {} },
    { route: { path: '' } },
    { route: { path: /secret/ } },
    { route: { path: ['/a', '/b'] } },
    { route: { path: '/secret\nheader' } },
    { route: { path: 'relative' } },
  ])('uses a fixed unmatched label for unavailable or unsupported templates: %s', request => {
    expect(safeRouteTemplate(request)).toBe(UNMATCHED_ROUTE);
  });
  it('never falls back to a raw path for unmatched requests', () => {
    const request = {
      path: `/share/${capability}`,
      originalUrl: `/?token=${capability}`,
      baseUrl: capability,
    };
    expect(safeRouteTemplate(request as any)).toBe(UNMATCHED_ROUTE);
  });
  it('does not retain accidental query or fragment text in template metadata', () => {
    expect(safeRouteTemplate({ route: { path: `/share/:id?token=${capability}` } })).toBe(
      '/share/:id',
    );
    expect(safeRouteTemplate({ route: { path: `/share/:id#${capability}` } })).toBe('/share/:id');
  });
});
