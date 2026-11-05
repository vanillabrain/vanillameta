// ESM-only packages that Jest cannot load; only route metadata is read here, nothing is called.
jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));
jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
jest.mock('@ai-sdk/openai-compatible', () => ({ createOpenAICompatible: jest.fn() }));

import {
  ROUTE_CAPABILITIES,
  ROUTE_CAPABILITY_VALUES,
  RouteCapability,
} from './auth/route-capabilities';
import {
  ORGANIZATION_OPTIONAL_CONTROLLERS,
  ORGANIZATION_OPTIONAL_HANDLERS,
} from './auth/capability-policy';
import {
  READ_VERBS,
  ScannedRoute,
  productionControllers,
  productionRoutes,
} from './test-support/route-scan';

/**
 * Every route that changes state must be classified in ROUTE_CAPABILITIES. A new write route that
 * is not in the table fails here, so it cannot reach production unclassified. A wrong
 * classification is not caught by logic, only by review: the snapshot below prints one line per
 * route, so a changed classification shows up as a diff.
 */
describe('route capability classification', () => {
  let writes: ScannedRoute[];

  beforeAll(async () => {
    writes = (await productionRoutes()).filter(route => !READ_VERBS.has(route.verb));
  });

  const key = (route: ScannedRoute) => `${route.controller}.${route.handler}`;

  it('scans a plausible number of write routes (an empty scan must not pass vacuously)', () => {
    expect(writes.length).toBeGreaterThan(200);
  });

  it('classifies every write route', () => {
    const missing = [...new Set(writes.filter(r => !(key(r) in ROUTE_CAPABILITIES)).map(key))];
    expect(missing).toEqual([]);
  });

  it('has no entry for a handler that is not a write route', () => {
    const live = new Set(writes.map(key));
    const stale = Object.keys(ROUTE_CAPABILITIES).filter(k => !live.has(k));
    expect(stale).toEqual([]);
  });

  it('uses only known capabilities', () => {
    const known = new Set<string>(ROUTE_CAPABILITY_VALUES);
    const unknown = Object.entries(ROUTE_CAPABILITIES).filter(([, cap]) => !known.has(cap));
    expect(unknown).toEqual([]);
  });

  it('marks a route public only when it has no login guard, and never the reverse', () => {
    const loginGuards = new Set([
      'JwtAuthGuard',
      'StudioPublicationGuard',
      'LegacyOperationsGuard',
    ]);
    const hasLogin = (route: ScannedRoute) => route.guards.some(g => loginGuards.has(g));
    const publicWithLogin = writes.filter(
      r => ROUTE_CAPABILITIES[key(r)] === 'public' && hasLogin(r),
    );
    const loginlessNotPublic = writes.filter(
      r =>
        !hasLogin(r) &&
        !['public', 'own-account'].includes(ROUTE_CAPABILITIES[key(r)] as RouteCapability),
    );
    expect(publicWithLogin.map(key)).toEqual([]);
    expect(loginlessNotPublic.map(key)).toEqual([]);
  });

  it('keeps operator routes behind the operator guard', () => {
    const operatorsWithoutGuard = writes.filter(
      r => ROUTE_CAPABILITIES[key(r)] === 'operator' && !r.guards.includes('LegacyOperationsGuard'),
    );
    expect(operatorsWithoutGuard.map(key)).toEqual([]);
  });

  it('names only handlers and controllers that exist, for routes that need no organization', async () => {
    const all = await productionRoutes();
    const handlers = new Set(all.map(r => `${r.controller}.${r.handler}`));
    const controllers = new Set(all.map(r => r.controller));
    expect([...ORGANIZATION_OPTIONAL_HANDLERS].filter(k => !handlers.has(k))).toEqual([]);
    expect([...ORGANIZATION_OPTIONAL_CONTROLLERS].filter(k => !controllers.has(k))).toEqual([]);
  });

  // The table is keyed by class name, so two mounted controllers with one name would share (and
  // silently inherit) each other's classification. Today two files declare a CacheController and only
  // one is mounted; this fails the day both are.
  it('mounts no two controllers that share a class name', async () => {
    const names = (await productionControllers()).map(controller => controller.name);
    expect(names.length).toBeGreaterThan(50);
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
    expect([...new Set(duplicated)]).toEqual([]);
  });

  it('prints one line per route so a changed classification is a visible diff', () => {
    const lines = writes.map(r => `${r.verb} ${r.path} -> ${ROUTE_CAPABILITIES[key(r)]}`).sort();
    expect(lines).toMatchSnapshot();
  });
});
