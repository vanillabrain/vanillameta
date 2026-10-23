// ESM-only packages that Jest cannot load; only the route metadata is read here, nothing is called.
jest.mock('ai', () => ({ generateText: jest.fn(), streamText: jest.fn(), tool: jest.fn() }));
jest.mock('@ai-sdk/provider', () => ({}));

import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

/**
 * There is no global auth guard: a controller (or a single handler) without one is open to the
 * internet. This test lists every route the production app mounts and fails when an unguarded one
 * is not on the allow-list below, so a new anonymous endpoint cannot be added by accident. The
 * allow-list itself is also checked: an entry that is no longer anonymous must be removed.
 */
const ANONYMOUS_ROUTES: Record<string, string> = {
  'GET /': 'API descriptor (no credentials are advertised in production)',
  'GET /health': 'load balancer / container health',
  'GET /ip': 'diagnostic; answers 404 when NODE_ENV=prod (app.controller.ts)',
  'POST /': 'echo test; answers 404 when NODE_ENV=prod (app.controller.ts)',
  'POST /seed': 'placeholder; answers 404 when NODE_ENV=prod (app.controller.ts)',
  'GET /api/v1/health': 'container health',
  'POST /login/signin': 'sign in',
  'POST /login/signup': 'sign up, gated by SIGNUP_MODE and invitation codes',
  'GET /access/signup-mode': 'tells the sign-up page which form to show',
  'POST /access/waitlist': 'waiting list, throttled',
  'POST /analytics/events': 'anonymous client analytics (no user id is stored)',
  'POST /v1/events/track': 'anonymous client analytics (no user id is stored)',
  'POST /v1/events/metrics': 'anonymous client metrics',
  'GET /share-url/share-dashboard/:uuid':
    'share link capability (uuid), ownership re-checked in the service',
  'GET /publications/:uuid': 'public publication link capability',
  'GET /reuse-links/:kind/:uuid': 'reuse availability for a link, reveals no data',
  'GET /studio/publications/:token':
    'public Studio publication read; StudioPublicationGuard lets it through without an Authorization header',
};

/**
 * A guard that extends JwtAuthGuard can relax it, so only the three classes below count as
 * authentication by identity. Any other subclass counts as authentication only for the routes it is
 * known to leave closed: the routes listed here are the ones it is allowed to open, and each of them
 * must also be in ANONYMOUS_ROUTES.
 *
 * JwtAuthGuard itself also accepts a share-link token (no account) on GET /database/data and
 * /v1/database/data; that path is limited to datasets of the shared dashboard in the guard and is
 * covered by the ownership checks, but it is an access path without an account.
 */
const RELAXING_GUARDS: Record<string, string[]> = {
  StudioPublicationGuard: ['GET /studio/publications/:token'],
};

// A class: only its prototype and identity are inspected.
type Ctor = abstract new (...args: never[]) => object;
let authGuards: Ctor[] = [];
let operatorGuard: Ctor;
// Identity, not inheritance: an unknown JwtAuthGuard subclass is not trusted to require a login.
const isAuthGuard = (guard: unknown, key: string) =>
  typeof guard === 'function' &&
  (authGuards.includes(guard as Ctor) || RELAXING_GUARDS[guard.name]?.includes(key) === false);

const flatten = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : [value ?? '']).map(part => part.replace(/^\/+|\/+$/g, ''));

/**
 * Walks the module graph the way Nest does: static classes, `{ module }` dynamic modules, forwardRefs
 * and async dynamic modules (a Promise in `imports`, as the background-job module uses). An import
 * entry that is none of those fails the scan instead of being skipped, so a route cannot hide behind
 * a shape this walk does not understand. The visited set is keyed by the dynamic module object so a
 * second registration of the same class with other controllers is still read.
 */
async function collectControllers(root: unknown): Promise<Ctor[]> {
  const seen = new Set<unknown>();
  const controllers = new Set<Ctor>();
  const visit = async (raw: any): Promise<void> => {
    const entry = typeof raw?.then === 'function' ? await raw : raw;
    const resolved = entry?.forwardRef ? entry.forwardRef() : entry;
    const module = resolved?.module ?? resolved;
    if (typeof module !== 'function')
      throw new Error(`Unrecognised module import: ${String(resolved)}`);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    for (const controller of Reflect.getMetadata('controllers', module) ?? [])
      controllers.add(controller);
    for (const controller of resolved?.controllers ?? []) controllers.add(controller);
    for (const imported of [
      ...(Reflect.getMetadata('imports', module) ?? []),
      ...(resolved?.imports ?? []),
    ])
      await visit(imported);
  };
  await visit(root);
  return [...controllers];
}

function routes(controllers: Ctor[]) {
  const out: Array<{ key: string; guarded: boolean; operator: boolean }> = [];
  for (const controller of controllers) {
    const classGuards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    for (const base of flatten(Reflect.getMetadata(PATH_METADATA, controller))) {
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = controller.prototype[name];
        // Only request handlers carry an HTTP method; this also skips the constructor, which holds the
        // class-level path metadata.
        if (
          typeof handler !== 'function' ||
          Reflect.getMetadata(METHOD_METADATA, handler) === undefined
        )
          continue;
        const methodGuards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
        const verb = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
        for (const sub of flatten(Reflect.getMetadata(PATH_METADATA, handler))) {
          const path = '/' + [base, sub].filter(Boolean).join('/');
          out.push({
            key: `${verb} ${path}`,
            guarded: [...classGuards, ...methodGuards].some(guard =>
              isAuthGuard(guard, `${verb} ${path}`),
            ),
            operator: [...classGuards, ...methodGuards].some(
              guard => guard === operatorGuard || guard.prototype instanceof operatorGuard,
            ),
          });
        }
      }
    }
  }
  return out;
}

describe('route inventory of the production app', () => {
  let production: Array<{ key: string; guarded: boolean; operator: boolean }>;
  const previous = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'prod';
    let appModule: unknown;
    /* eslint-disable @typescript-eslint/no-var-requires */
    jest.isolateModules(() => {
      // Loaded inside the isolated registry so the guard classes are the same objects the app uses.
      appModule = require('./app.module').AppModule;
      operatorGuard = require('./auth/guards/legacy-operations.guard').LegacyOperationsGuard;
      authGuards = [
        require('./auth/guards/jwt-auth.guard').JwtAuthGuard,
        require('./auth/guards/local-auth.guard').LocalAuthGuard,
        operatorGuard,
      ];
    });
    /* eslint-enable @typescript-eslint/no-var-requires */
    production = routes(await collectControllers(appModule));
  });
  afterAll(() => {
    process.env.NODE_ENV = previous;
  });

  it('finds the application routes (guards against an empty scan passing vacuously)', () => {
    expect(production.length).toBeGreaterThan(200);
    expect(production.filter(route => route.guarded).length).toBeGreaterThan(150);
  });

  it('reads routes behind async dynamic modules and finds the relaxed Studio publication read', () => {
    const byKey = new Map(production.map(route => [route.key, route]));
    // BackgroundJobModule imports a Promise-returned dynamic module; its controller must be scanned.
    expect(byKey.get('GET /background-jobs')?.guarded).toBe(true);
    // StudioPublicationGuard passes this one without credentials, the sibling routes stay guarded.
    expect(byKey.get('GET /studio/publications/:token')?.guarded).toBe(false);
    expect(
      [...byKey.keys()].filter(
        key => key.includes('/studio/publications') && byKey.get(key)?.guarded,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('has no unguarded route outside the anonymous allow-list', () => {
    const open = production.filter(route => !route.guarded).map(route => route.key);
    const unexpected = open.filter(key => !(key in ANONYMOUS_ROUTES));
    expect(unexpected).toEqual([]);
  });

  it('keeps the allow-list honest: every entry is a real unguarded route', () => {
    const open = new Set(production.filter(route => !route.guarded).map(route => route.key));
    const stale = Object.keys(ANONYMOUS_ROUTES).filter(key => !open.has(key));
    expect(stale).toEqual([]);
  });

  it('keeps the shared chart and template catalogs read-only for regular users', () => {
    const operatorOnly = [
      'POST /component/seed',
      'POST /component',
      'PATCH /component/:id',
      'DELETE /component/:id',
      'POST /template',
      'GET /template',
      'GET /template/:id',
      'PUT /template/:id',
      'DELETE /template/:id',
    ];
    const byKey = new Map(production.map(route => [route.key, route]));
    for (const key of operatorOnly)
      expect({ key, operator: byKey.get(key)?.operator }).toEqual({ key, operator: true });
    // The routes the product itself uses stay available to a signed-in user.
    for (const key of [
      'GET /component',
      'GET /component/:id',
      'POST /template/recommend',
      'POST /template/dashboard',
    ])
      expect({ key, operator: byKey.get(key)?.operator, guarded: byKey.get(key)?.guarded }).toEqual(
        {
          key,
          operator: false,
          guarded: true,
        },
      );
  });
});
