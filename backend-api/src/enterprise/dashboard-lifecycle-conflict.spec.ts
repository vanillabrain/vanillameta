import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource, QueryFailedError } from 'typeorm';
import { DashboardLifecycleService } from './dashboard-lifecycle.service';
import { DashboardLifecycleReceipt } from './entities/dashboard-lifecycle-receipt.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { DashboardShare } from '../dashboard/entities/dashboard_share.entity';
import { DashboardPublication } from '../dashboard/entities/dashboard-publication.entity';
import { StudioPublication } from '../dashboard-studio/entities/studio-publication.entity';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseResourceGrant } from './entities/enterprise-resource-grant.entity';
import { EnterpriseGroupGrant } from './entities/enterprise-group.entity';
import { EnterpriseDashboardDelivery } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';
import { HttpExceptionFilter } from '../nest-utils/http-exception.filter';

const RETRY = 'DASHBOARD_LIFECYCLE_RETRY_REQUIRED';
const STALE = 'DASHBOARD_LIFECYCLE_STALE';
describe('Dashboard lifecycle definitive versus retryable conflicts', () => {
  let db: DataSource, service: DashboardLifecycleService;
  beforeEach(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        Dashboard,
        DashboardShare,
        DashboardPublication,
        StudioPublication,
        User,
        UserMapping,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseResourceGrant,
        EnterpriseGroupGrant,
        EnterpriseDashboardDelivery,
        EnterpriseGroupDelivery,
        DashboardLifecycleReceipt,
      ],
    }).initialize();
    await db.manager.insert(User, {
      id: 7,
      userId: 'conflict-owner',
      email: 'conflict-owner@example.invalid',
      password: 'synthetic',
    });
    await db.manager.insert(EnterpriseMembership, { userId: 7, organizationId: 1, role: 'admin' });
    await db.manager.insert(Dashboard, { id: 1, title: 'Conflict parent' });
    await db.manager.insert(UserMapping, { dashboardId: 1, userInfoId: 7 });
    service = new DashboardLifecycleService(db);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
  });
  const body = async () => {
    const current = (await service.read(1, 7, 0)).data;
    return {
      requestId: randomUUID(),
      expectedActorId: 7,
      expectedOrganizationId: 1,
      expectedVersion: current.version,
      expectedRevision: current.revision,
      active: false,
      acknowledgedImpact: true as const,
    };
  };
  const formatted = (error: ConflictException, code: string) => {
    const response = error.getResponse();
    expect(response).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      code,
      message: expect.any(String),
    });
    expect(JSON.stringify(response)).not.toMatch(/SELECT|UPDATE|synthetic-driver/);
    const json = jest.fn(),
      status = jest.fn(() => ({ json }));
    new HttpExceptionFilter().catch(error, {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as any);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ success: false, code: 409, data: response });
    expect(json.mock.calls[0][0].data.code).toBe(code);
  };
  const noWrites = async () => {
    expect(await db.manager.findOneBy(Dashboard, { id: 1 })).toMatchObject({
      assetActive: true,
      assetVersion: 0,
    });
    expect(await db.manager.count(DashboardLifecycleReceipt)).toBe(0);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(0);
  };
  it.each(['SQLITE_BUSY', 'SQLITE_LOCKED', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])(
    '%s after the actual receipt query returns a coded retry and allows the exact UUID to succeed',
    async code => {
      const payload = await body();
      const failure = new QueryFailedError(
        'SELECT receipt',
        [],
        Object.assign(new Error('synthetic-driver'), { code }),
      );
      const transaction = db.transaction.bind(db);
      const spy = jest.spyOn(db, 'transaction').mockImplementationOnce((async (run: any) =>
        transaction(async manager => {
          const read = manager.findOneBy.bind(manager);
          jest.spyOn(manager, 'findOneBy').mockImplementation((async (entity: any, where: any) => {
            const result = await read(entity, where);
            if (entity === DashboardLifecycleReceipt) throw failure;
            return result;
          }) as any);
          return run(manager);
        })) as any);
      let caught: any;
      try {
        await service.set(1, 7, payload, 0);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ConflictException);
      formatted(caught, RETRY);
      spy.mockRestore();
      await noWrites();
      const result = await service.set(1, 7, payload, 0);
      expect(result.data).toMatchObject({
        requestId: payload.requestId,
        active: false,
        version: 1,
        replayed: false,
      });
      expect((await service.set(1, 7, payload, 0)).data).toMatchObject({
        receiptId: result.data.receiptId,
        replayed: true,
      });
      expect(await db.manager.count(DashboardLifecycleReceipt)).toBe(1);
      expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
    },
  );
  it('rolls back a real state update before an injected timeout and preserves the same UUID retry', async () => {
    const payload = await body();
    const failure = new QueryFailedError(
      'UPDATE dashboard',
      [],
      Object.assign(new Error('synthetic-driver'), { code: 'ER_LOCK_WAIT_TIMEOUT' }),
    );
    const transaction = db.transaction.bind(db);
    const spy = jest.spyOn(db, 'transaction').mockImplementationOnce((async (run: any) =>
      transaction(async manager => {
        const update = manager.update.bind(manager);
        jest.spyOn(manager, 'update').mockImplementation((async (...args: any[]) => {
          const result = await (update as any)(...args);
          if (args[0] === Dashboard) throw failure;
          return result;
        }) as any);
        return run(manager);
      })) as any);
    let caught: any;
    try {
      await service.set(1, 7, payload, 0);
    } catch (error) {
      caught = error;
    }
    formatted(caught, RETRY);
    spy.mockRestore();
    await noWrites();
    expect((await service.set(1, 7, payload, 0)).data.version).toBe(1);
  });
  it.each(['actor', 'organization', 'version', 'revision'])(
    'returns definitive STALE for changed %s basis with no writes',
    async kind => {
      const payload = await body();
      if (kind === 'actor') payload.expectedActorId = 8;
      if (kind === 'organization') payload.expectedOrganizationId = 2;
      if (kind === 'version') payload.expectedVersion = 1;
      if (kind === 'revision') payload.expectedRevision = '0'.repeat(64);
      let caught: any;
      try {
        await service.set(1, 7, payload, 0);
      } catch (error) {
        caught = error;
      }
      formatted(caught, STALE);
      await noWrites();
    },
  );
  it('returns definitive STALE for a reused UUID with a different body without overwriting history', async () => {
    const payload = await body();
    await service.set(1, 7, payload, 0);
    let caught: any;
    try {
      await service.set(1, 7, { ...payload, active: true }, 0);
    } catch (error) {
      caught = error;
    }
    formatted(caught, STALE);
    expect(await db.manager.count(DashboardLifecycleReceipt)).toBe(1);
    expect(await db.manager.count(EnterpriseAuditEvent)).toBe(1);
    expect((await db.manager.findOneBy(Dashboard, { id: 1 })).assetVersion).toBe(1);
  });
});
