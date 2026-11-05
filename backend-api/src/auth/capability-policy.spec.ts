import { ORGANIZATION_OPTIONAL_HANDLERS, capabilityOf, deniedAccess } from './capability-policy';

type Input = Parameters<typeof deniedAccess>[0];
const ask = (
  controller: string,
  handler: string,
  method: string,
  role: unknown | undefined,
  extra: Partial<Input> = {},
) =>
  deniedAccess({
    managed: false,
    controller,
    handler,
    method,
    membership: role === undefined ? undefined : { role },
    ...extra,
  });

// Real handlers from ROUTE_CAPABILITIES, one per capability the grades treat differently.
const READ_POST = ['BiExploreController', 'query'] as const; // read
const COMMENT = ['ReportCommentsController', 'createThread'] as const; // comment
const PERSONAL = ['DashboardController', 'createView'] as const; // personal
const WRITE = ['WidgetController', 'create'] as const; // write
const SOURCE = ['DatabaseController', 'create'] as const; // source
const PUBLISH = ['PublicationController', 'publish'] as const; // publish
const EXPORT = ['ExportJobsController', 'create'] as const; // export
const MANAGE = ['EnterpriseController', 'add'] as const; // manage
const SERVICE = ['HandoverProposalController', 'accept'] as const; // service

describe('capability policy', () => {
  describe('capabilityOf', () => {
    it('treats every read verb as read, whatever the table says', () => {
      for (const method of ['GET', 'get', 'HEAD', 'OPTIONS'])
        expect(capabilityOf('EnterpriseController', 'add', method)).toBe('read');
    });
    it('reads a write verb from the table', () => {
      expect(capabilityOf(...WRITE, 'POST')).toBe('write');
      expect(capabilityOf(...MANAGE, 'POST')).toBe('manage');
      expect(capabilityOf(...READ_POST, 'POST')).toBe('read');
    });
    it('treats an unclassified write verb as manage, the strictest, never as a read or a write', () => {
      expect(capabilityOf('NoSuchController', 'nothing', 'POST')).toBe('manage');
    });
    it('leaves an unclassified write route to administrators only', () => {
      expect(ask('NoSuchController', 'nothing', 'POST', 'admin')).toBeUndefined();
      for (const role of ['editor', 'contributor', 'viewer'])
        expect(ask('NoSuchController', 'nothing', 'POST', role)).toMatchObject({
          code: 'ROLE_FORBIDDEN',
        });
    });
  });

  describe('an account that belongs to no organization', () => {
    it('is not restricted in the open mode, as before', () => {
      for (const [controller, handler] of [READ_POST, WRITE, MANAGE, PUBLISH])
        expect(ask(controller, handler, 'POST', undefined)).toBeUndefined();
      expect(ask('WidgetController', 'findAll', 'GET', undefined)).toBeUndefined();
    });

    it('is turned away from ordinary routes in the managed mode', () => {
      const managed = { managed: true };
      for (const [controller, handler] of [READ_POST, WRITE, MANAGE, PUBLISH, COMMENT, SERVICE])
        expect(ask(controller, handler, 'POST', undefined, managed)).toMatchObject({
          code: 'ORGANIZATION_REQUIRED',
        });
      expect(ask('DashboardController', 'findAll', 'GET', undefined, managed)).toMatchObject({
        code: 'ORGANIZATION_REQUIRED',
      });
    });

    it.each([
      ['its own context', 'EnterpriseController', 'context', 'GET'],
      ['its own profile', 'UserController', 'findOne', 'GET'],
      ['a public Studio publication', 'StudioPublicationController', 'read', 'GET'],
      ['deleting its own account', 'UserController', 'deleteUser', 'DELETE'],
      ['signing in', 'LoginController', 'logIn', 'POST'],
      ['a server operator route', 'CacheController', 'warmupCache', 'POST'],
      ['a governance read', 'GovernanceController', 'organizations', 'GET'],
      ['a governance write', 'GovernanceController', 'group', 'POST'],
    ])('may still use %s in the managed mode', (_name, controller, handler, method) => {
      expect(ask(controller, handler, method, undefined, { managed: true })).toBeUndefined();
    });

    it('may use any route of a guard that marks itself organization-optional', () => {
      expect(
        ask('QueryAnalyzerController', 'getStats', 'GET', undefined, {
          managed: true,
          organizationOptional: true,
        }),
      ).toBeUndefined();
    });
  });

  describe('grades', () => {
    // Order: viewer, contributor, editor, admin. true = allowed.
    const MATRIX: Array<[string, readonly [string, string], boolean[]]> = [
      ['read (a POST that only reads)', READ_POST, [true, true, true, true]],
      ['comment', COMMENT, [true, true, true, true]],
      ['personal', PERSONAL, [true, true, true, true]],
      ['write', WRITE, [false, true, true, true]],
      ['source', SOURCE, [false, true, true, true]],
      ['publish', PUBLISH, [false, false, true, true]],
      ['export', EXPORT, [false, false, true, true]],
      ['manage', MANAGE, [false, false, false, true]],
      ['service (the service decides)', SERVICE, [true, true, true, true]],
    ];
    const ROLES = ['viewer', 'contributor', 'editor', 'admin'];

    it.each(MATRIX)('%s', (_name, [controller, handler], expected) => {
      const actual = ROLES.map(role => ask(controller, handler, 'POST', role) === undefined);
      expect(actual).toEqual(expected);
    });

    it.each(MATRIX)(
      '%s behaves the same in the managed mode',
      (_name, [controller, handler], expected) => {
        const actual = ROLES.map(
          role => ask(controller, handler, 'POST', role, { managed: true }) === undefined,
        );
        expect(actual).toEqual(expected);
      },
    );

    it('explains a refusal by grade, not by organization', () => {
      expect(ask(...WRITE, 'POST', 'viewer')).toMatchObject({ code: 'ROLE_FORBIDDEN' });
    });

    it('reads the legacy member as an editor', () => {
      for (const [controller, handler] of [WRITE, PUBLISH, EXPORT])
        expect(ask(controller, handler, 'POST', 'member')).toBeUndefined();
      expect(ask(...MANAGE, 'POST', 'member')).toMatchObject({ code: 'ROLE_FORBIDDEN' });
    });

    it('lets every grade read with a GET', () => {
      for (const role of ROLES)
        expect(ask('DashboardController', 'findAll', 'GET', role)).toBeUndefined();
    });

    it.each(['owner', '', 'ADMIN', 7])(
      'lets a role it does not know do nothing, not even read: %p',
      role => {
        expect(ask('DashboardController', 'findAll', 'GET', role)).toMatchObject({
          code: 'ROLE_FORBIDDEN',
        });
        expect(ask(...WRITE, 'POST', role)).toMatchObject({ code: 'ROLE_FORBIDDEN' });
      },
    );
  });

  it('never refuses a public route', () => {
    for (const membership of [undefined, 'viewer', 'owner'])
      expect(
        ask('LoginController', 'logIn', 'POST', membership, { managed: true }),
      ).toBeUndefined();
  });

  it('lists optional handlers as Controller.handler keys', () => {
    for (const key of ORGANIZATION_OPTIONAL_HANDLERS) expect(key).toMatch(/^\w+\.\w+$/);
  });
});
