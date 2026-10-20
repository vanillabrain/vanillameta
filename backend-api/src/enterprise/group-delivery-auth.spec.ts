import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseDeliveryReceipt } from './entities/enterprise-dashboard-delivery.entity';
import { EnterpriseGroupDeliveryService } from './group-delivery.service';
import { EnterpriseDeliveryController } from './delivery.controller';
import { EnterpriseGroup } from './entities/enterprise-group.entity';
import { EnterpriseGroupDelivery } from './entities/enterprise-group-delivery.entity';

/** Real SQLite transaction/current actor check; policy is outside this narrow authentication test. */
describe('Group delivery current JWT epoch boundary', () => {
  let db: DataSource, service: EnterpriseGroupDeliveryService;
  const entities = [
    User,
    EnterpriseMembership,
    EnterpriseAuditEvent,
    EnterpriseGroup,
    EnterpriseGroupDelivery,
    EnterpriseDeliveryReceipt,
  ];
  const policy = { assertManagement: jest.fn(async () => undefined) };
  const access = { dashboard: jest.fn(async () => undefined) };
  const input = () => ({
    requestId: randomUUID(),
    groupId: 3,
    expectedGroupVersion: 1,
    expectedVersion: 0,
    active: false,
    allowCopy: false,
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
    service = new EnterpriseGroupDeliveryService(db, policy as any, access as any);
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
    await db.manager.insert(EnterpriseGroup, {
      id: 3,
      organizationId: 10,
      name: 'Synthetic group',
      nameKey: 'synthetic group',
      active: true,
      version: 1,
    });
    jest.clearAllMocks();
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  it('controller forwards JWT epoch explicitly without changing the body', async () => {
    const set = jest.fn().mockResolvedValue({});
    const controller = new EnterpriseDeliveryController({} as any, { set } as any);
    const body = input();
    await controller.groupSet({ user: { accessKeyData: { id: 1, authVersion: 7 } } }, '20', body);
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
