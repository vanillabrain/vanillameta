import { ExecutionContext, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { EnterpriseMembership } from '../../enterprise/entities/enterprise-membership.entity';
import { EnterpriseOrganization } from '../../enterprise/entities/enterprise-organization.entity';
import { User } from '../../user/entities/user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * The guard turns a request away when the account's grade does not allow what the route does, or,
 * in the managed mode, when the account belongs to no organization. Real SQLite, real tokens.
 */
describe('JwtAuthGuard grade and organization checks', () => {
  let db: DataSource;
  let jwt: JwtService;
  let guard: JwtAuthGuard;
  const previous = {
    secret: process.env.ACCESS_SECRET,
    bootstrap: process.env.BOOTSTRAP_ADMIN_USER_ID,
  };

  const account = (id: number) => ({
    id,
    userId: `account-${id}`,
    email: `account-${id}@example.invalid`,
    password: `password-hash-${id}`,
    active: true,
    authVersion: 0,
  });
  const tokenOf = (id: number) =>
    jwt.sign(
      {
        accessKeyData: {
          id,
          userId: `account-${id}`,
          email: `account-${id}@example.invalid`,
          authVersion: 0,
        },
      },
      { secret: process.env.ACCESS_SECRET },
    );
  // A class and a method that carry the names Nest reports for a real controller handler.
  const named = (controller: string, handler: string) => ({
    cls: ({ [controller]: class {} } as Record<string, new () => object>)[controller],
    fn: ({ [handler]: () => undefined } as Record<string, () => void>)[handler],
  });
  const contextFor = (id: number, controller: string, handler: string, method: string) => {
    const { cls, fn } = named(controller, handler);
    const request = { headers: { authorization: `Bearer ${tokenOf(id)}` }, method, path: '/x' };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
        getClass: () => cls,
        getHandler: () => fn,
      } as unknown as ExecutionContext,
    };
  };
  const call = (id: number, controller: string, handler: string, method = 'POST', using = guard) =>
    using.canActivate(contextFor(id, controller, handler, method).context);
  const refusal = async (promise: Promise<boolean>) => {
    try {
      await promise;
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      return {
        status: (error as HttpException).getStatus(),
        body: (error as HttpException).getResponse() as any,
      };
    }
    return undefined;
  };
  const setRole = async (userId: number, role: string | null) => {
    const repo = db.getRepository(EnterpriseMembership);
    if (role === null) await repo.delete({ userId });
    else await repo.save({ userId, organizationId: 1, role: role as any, team: '' });
  };

  beforeAll(async () => {
    process.env.ACCESS_SECRET = 'unit-test-access-secret-for-the-guard-spec';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, EnterpriseOrganization, EnterpriseMembership],
    }).initialize();
    jwt = new JwtService({});
    guard = new JwtAuthGuard(jwt, db);
  });

  beforeEach(async () => {
    delete process.env.BOOTSTRAP_ADMIN_USER_ID;
    await db.getRepository(EnterpriseMembership).clear();
    await db.getRepository(EnterpriseOrganization).clear();
    await db.getRepository(User).clear();
    await db.getRepository(User).save([1, 2, 3, 4, 5].map(account));
    await db.getRepository(EnterpriseOrganization).save({ name: '바닐라메타', version: 1 });
  });

  afterAll(async () => {
    await db?.destroy();
    for (const [name, value] of [
      ['ACCESS_SECRET', previous.secret],
      ['BOOTSTRAP_ADMIN_USER_ID', previous.bootstrap],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  describe('in the open mode', () => {
    it('lets an account with no organization do everything it could before', async () => {
      await expect(call(1, 'WidgetController', 'create')).resolves.toBe(true);
      await expect(call(1, 'EnterpriseController', 'add')).resolves.toBe(true);
      await expect(call(1, 'WidgetController', 'findAll', 'GET')).resolves.toBe(true);
    });

    it('lets a legacy member work like an editor', async () => {
      await setRole(2, 'member');
      await expect(call(2, 'WidgetController', 'create')).resolves.toBe(true);
      await expect(call(2, 'PublicationController', 'publish')).resolves.toBe(true);
      expect((await refusal(call(2, 'EnterpriseController', 'add')))?.body.code).toBe(
        'ROLE_FORBIDDEN',
      );
    });
  });

  describe('grades', () => {
    beforeEach(async () => {
      await setRole(1, 'admin');
      await setRole(2, 'editor');
      await setRole(3, 'contributor');
      await setRole(4, 'viewer');
    });

    it('lets a viewer read and comment but not change anything', async () => {
      await expect(call(4, 'WidgetController', 'findAll', 'GET')).resolves.toBe(true);
      await expect(call(4, 'BiExploreController', 'query')).resolves.toBe(true);
      await expect(call(4, 'ReportCommentsController', 'createThread')).resolves.toBe(true);
      const refused = await refusal(call(4, 'WidgetController', 'create'));
      expect(refused?.status).toBe(403);
      expect(refused?.body.code).toBe('ROLE_FORBIDDEN');
    });

    it('lets a contributor draft but not publish or export', async () => {
      await expect(call(3, 'WidgetController', 'create')).resolves.toBe(true);
      await expect(call(3, 'DatabaseController', 'create')).resolves.toBe(true);
      expect((await refusal(call(3, 'PublicationController', 'publish')))?.status).toBe(403);
      expect((await refusal(call(3, 'ExportJobsController', 'create')))?.status).toBe(403);
    });

    it('lets an editor publish and export but not manage members', async () => {
      await expect(call(2, 'PublicationController', 'publish')).resolves.toBe(true);
      await expect(call(2, 'ExportJobsController', 'create')).resolves.toBe(true);
      expect((await refusal(call(2, 'EnterpriseController', 'add')))?.status).toBe(403);
    });

    it('lets an admin do all of it', async () => {
      for (const [controller, handler] of [
        ['WidgetController', 'create'],
        ['PublicationController', 'publish'],
        ['EnterpriseController', 'add'],
      ])
        await expect(call(1, controller, handler)).resolves.toBe(true);
    });

    it('applies a change of grade to the very next request', async () => {
      await expect(call(2, 'WidgetController', 'create')).resolves.toBe(true);
      await setRole(2, 'viewer');
      expect((await refusal(call(2, 'WidgetController', 'create')))?.body.code).toBe(
        'ROLE_FORBIDDEN',
      );
      await setRole(2, 'editor');
      await expect(call(2, 'WidgetController', 'create')).resolves.toBe(true);
    });

    it('refuses everything, even reads, for a role it does not know', async () => {
      await setRole(5, 'owner');
      expect((await refusal(call(5, 'WidgetController', 'findAll', 'GET')))?.body.code).toBe(
        'ROLE_FORBIDDEN',
      );
    });
  });

  describe('in the managed mode', () => {
    beforeEach(async () => {
      process.env.BOOTSTRAP_ADMIN_USER_ID = 'account-1';
      await setRole(2, 'editor');
    });

    it('turns an account with no organization away from ordinary routes', async () => {
      for (const [controller, handler, method] of [
        ['WidgetController', 'create', 'POST'],
        ['WidgetController', 'findAll', 'GET'],
        ['ReportCommentsController', 'createThread', 'POST'],
      ]) {
        const refused = await refusal(call(3, controller, handler, method));
        expect(refused?.status).toBe(403);
        expect(refused?.body.code).toBe('ORGANIZATION_REQUIRED');
      }
    });

    it('still serves that account its context, profile and own account routes', async () => {
      await expect(call(3, 'EnterpriseController', 'context', 'GET')).resolves.toBe(true);
      await expect(call(3, 'UserController', 'findOne', 'GET')).resolves.toBe(true);
      await expect(call(3, 'UserController', 'deleteUser', 'DELETE')).resolves.toBe(true);
    });

    it('lets the bootstrap account create the organization although it belongs to none yet', async () => {
      await expect(call(1, 'EnterpriseController', 'create')).resolves.toBe(true);
    });

    it('serves a member as in the open mode', async () => {
      await expect(call(2, 'WidgetController', 'create')).resolves.toBe(true);
    });

    it('lets a guard that marks itself organization-optional serve an account with no organization', async () => {
      class OperatorGuard extends JwtAuthGuard {
        protected readonly organizationOptional: boolean = true;
      }
      await expect(
        call(3, 'CacheController', 'getCacheStats', 'GET', new OperatorGuard(jwt, db)),
      ).resolves.toBe(true);
      expect((await refusal(call(3, 'CacheController', 'getCacheStats', 'GET')))?.status).toBe(403);
    });
  });

  it('leaves a context with no controller or handler alone, since it is not an app route', async () => {
    const request = {
      headers: { authorization: `Bearer ${tokenOf(4)}` },
      method: 'POST',
      path: '/x',
    };
    await setRole(4, 'viewer');
    const bare = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(bare)).resolves.toBe(true);
  });

  it('still refuses a token that is not valid, before any grade is looked at', async () => {
    const { request, context } = contextFor(4, 'WidgetController', 'create', 'POST');
    request.headers.authorization = 'Bearer not-a-token';
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 401 });
  });
});
