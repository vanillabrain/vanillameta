import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import {
  EnterpriseDashboardDelivery,
  EnterpriseDeliveryReceipt,
} from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseDeliveryService } from './delivery.service';
import { EnterpriseDeliveryController } from './delivery.controller';

/** Real SQLite transaction/current actor check; policy is outside this narrow authentication test. */
describe('Direct delivery current JWT epoch boundary', () => {
  let db: DataSource, service: EnterpriseDeliveryService;
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseDashboardDelivery,
    EnterpriseDeliveryReceipt,
  ];
  const policy = { assertManagement: jest.fn(async () => undefined) };
  const access = { dashboard: jest.fn(async () => undefined) };
  const input = () => ({
    requestId: randomUUID(),
    active: false,
    recipients: [{ recipientId: 2, expectedVersion: 0 }],
  });
  const snapshot = async () =>
    JSON.stringify(await Promise.all(entities.map(e => db.manager.find(e))));
  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities,
      synchronize: true,
    }).initialize();
    service = new EnterpriseDeliveryService(db, policy as any, access as any);
  });
  beforeEach(async () => {
    for (const e of [...entities].reverse())
      await db.getRepository(e).createQueryBuilder().delete().execute();
    await db.manager.insert(User, {
      id: 1,
      userId: 'delivery-epoch-owner',
      email: 'owner@example.invalid',
      password: 'synthetic',
      active: true,
      authVersion: 7,
    });
    await db.manager.insert(EnterpriseMembership, {
      userId: 1,
      organizationId: 10,
      role: 'admin',
      team: '',
    });
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('controller forwards JWT epoch explicitly without changing the body', async () => {
    const set = jest.fn().mockResolvedValue({});
    const controller = new EnterpriseDeliveryController({ set } as any, {} as any);
    const body = input();
    await controller.set({ user: { accessKeyData: { id: 1, authVersion: 7 } } }, '20', body);
    expect(set).toHaveBeenCalledWith(20, 1, body, 7);
  });
  it('rejects stale epoch before management/receipt and leaves all rows unchanged', async () => {
    const before = await snapshot();
    await expect((service.set as any)(20, 1, input(), 6)).rejects.toMatchObject({ status: 403 });
    expect(policy.assertManagement).not.toHaveBeenCalled();
    expect(access.dashboard).not.toHaveBeenCalled();
    expect(await snapshot()).toBe(before);
  });
  it('current epoch can confirm its receipt, but an old epoch cannot read that receipt', async () => {
    const body = input();
    const initial = await (service.set as any)(20, 1, body, 7);
    expect(initial.replayed).toBe(false);
    const before = await snapshot();
    await expect((service.set as any)(20, 1, body, 7)).resolves.toEqual({
      ...initial,
      replayed: true,
    });
    await expect((service.set as any)(20, 1, body, 6)).rejects.toMatchObject({ status: 403 });
    expect(await snapshot()).toBe(before);
  });
  it('omitted internal epoch defaults to zero and cannot bypass a changed account epoch', async () => {
    const before = await snapshot();
    await expect(service.set(20, 1, input())).rejects.toMatchObject({ status: 403 });
    expect(await snapshot()).toBe(before);
  });
});
