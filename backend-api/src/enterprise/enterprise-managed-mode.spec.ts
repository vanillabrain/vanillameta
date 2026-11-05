import { DataSource, Repository } from 'typeorm';
import CreateInitialData from '../database/seeds/create-initial-data';
import { User } from '../user/entities/user.entity';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { BOOTSTRAP_ORGANIZATION_NAME } from './organization-mode';

/**
 * The managed mode (BOOTSTRAP_ADMIN_USER_ID set) on a real SQLite DataSource: who may create the
 * one organization, what the context tells the client, and what the seed creates. The open mode
 * must answer exactly as before.
 */
describe('EnterpriseService in the managed mode', () => {
  let db: DataSource;
  let service: EnterpriseService;
  let users: Repository<User>;
  let organizations: Repository<EnterpriseOrganization>;
  let memberships: Repository<EnterpriseMembership>;
  let audits: Repository<EnterpriseAuditEvent>;
  const previous = process.env.BOOTSTRAP_ADMIN_USER_ID;

  // Account 1 is the bootstrap administrator; the others are ordinary accounts.
  const login = (id: number) => (id === 1 ? 'bootstrap-admin' : `account-${id}`);
  const account = (id: number) => ({
    id,
    userId: login(id),
    email: `account-${id}@example.invalid`,
    password: `password-hash-${id}`,
    active: true,
    authVersion: 0,
  });
  const state = async () => ({
    organizations: await organizations.count(),
    memberships: await memberships.count(),
    audits: await audits.count(),
  });
  const seed = () =>
    (new CreateInitialData() as any).seedBootstrapOrganization(db) as Promise<void>;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseEnrollment,
      ],
    }).initialize();
    service = new EnterpriseService(db);
    users = db.getRepository(User);
    organizations = db.getRepository(EnterpriseOrganization);
    memberships = db.getRepository(EnterpriseMembership);
    audits = db.getRepository(EnterpriseAuditEvent);
  });

  beforeEach(async () => {
    process.env.BOOTSTRAP_ADMIN_USER_ID = 'bootstrap-admin';
    await db.getRepository(EnterpriseEnrollment).clear();
    await memberships.clear();
    await audits.clear();
    await organizations.clear();
    await users.clear();
    await users.save([1, 2, 3].map(account));
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.BOOTSTRAP_ADMIN_USER_ID;
    else process.env.BOOTSTRAP_ADMIN_USER_ID = previous;
  });

  afterAll(async () => {
    await db?.destroy();
  });

  describe('creating the organization', () => {
    it('lets the bootstrap account create it and become its administrator', async () => {
      const created = await service.create(1, { name: '바닐라메타' });
      expect(created.membership).toMatchObject({ userId: 1, role: 'admin' });
      expect(await state()).toEqual({ organizations: 1, memberships: 1, audits: 1 });
      expect((await audits.find())[0].action).toBe('organization.created');
    });

    it('refuses any other account and writes nothing', async () => {
      const before = await state();
      await expect(service.create(2, { name: '다른 조직' })).rejects.toMatchObject({ status: 403 });
      expect(await state()).toEqual(before);
    });

    it('refuses a second organization even from the bootstrap account', async () => {
      await service.create(1, { name: '첫 조직' });
      const before = await state();
      await expect(service.create(1, { name: '둘째 조직' })).rejects.toMatchObject({ status: 403 });
      expect(await state()).toEqual(before);
    });

    it('stays open to any account when the mode is off', async () => {
      delete process.env.BOOTSTRAP_ADMIN_USER_ID;
      await expect(service.create(2, { name: '열린 조직' })).resolves.toMatchObject({
        membership: { userId: 2, role: 'admin' },
      });
      await expect(service.create(3, { name: '또 다른 조직' })).resolves.toMatchObject({
        membership: { userId: 3, role: 'admin' },
      });
    });
  });

  describe('context', () => {
    it('tells the bootstrap account it may create the organization', async () => {
      await expect(service.context(1)).resolves.toEqual({
        organization: null,
        membership: null,
        mode: 'managed',
        canCreateOrganization: true,
      });
    });

    it('tells other accounts they may not', async () => {
      await expect(service.context(2)).resolves.toEqual({
        organization: null,
        membership: null,
        mode: 'managed',
        canCreateOrganization: false,
      });
    });

    it('tells everyone they may not once the organization exists', async () => {
      await service.create(1, { name: '바닐라메타' });
      await expect(service.context(1)).resolves.toMatchObject({
        mode: 'managed',
        canCreateOrganization: false,
        membership: { role: 'admin' },
      });
      await expect(service.context(2)).resolves.toMatchObject({
        mode: 'managed',
        canCreateOrganization: false,
        organization: null,
      });
    });

    it('names the one organization to an account waiting to be added, and none before it exists', async () => {
      await expect(service.context(2)).resolves.not.toHaveProperty('joinOrganizationId');
      await service.create(1, { name: '바닐라메타' });
      const [organization] = await organizations.find();
      await expect(service.context(2)).resolves.toMatchObject({
        joinOrganizationId: organization.id,
      });
      // A member already belongs to it, so there is nothing to join.
      await expect(service.context(1)).resolves.not.toHaveProperty('joinOrganizationId');
    });

    it('names nothing when there is more than one organization', async () => {
      await organizations.save([
        { name: 'a', version: 1 },
        { name: 'b', version: 1 },
      ]);
      await expect(service.context(2)).resolves.not.toHaveProperty('joinOrganizationId');
    });

    it('answers exactly as before when the mode is off', async () => {
      delete process.env.BOOTSTRAP_ADMIN_USER_ID;
      await expect(service.context(1)).resolves.toEqual({ organization: null, membership: null });
      await service.create(1, { name: '바닐라메타' });
      const context = await service.context(1);
      expect(Object.keys(context).sort()).toEqual(['membership', 'organization']);
    });
  });

  describe('seeding the organization', () => {
    it('creates the organization and its administrator for the bootstrap account', async () => {
      await seed();
      const [organization] = await organizations.find();
      expect(organization.name).toBe(BOOTSTRAP_ORGANIZATION_NAME);
      expect(await memberships.findOneByOrFail({ userId: 1 })).toMatchObject({
        organizationId: organization.id,
        role: 'admin',
      });
      expect((await audits.find())[0]).toMatchObject({
        action: 'organization.created',
        actorId: 1,
      });
    });

    it('changes nothing when run again', async () => {
      await seed();
      const after = await state();
      await seed();
      expect(await state()).toEqual(after);
    });

    it('does nothing when the mode is off', async () => {
      delete process.env.BOOTSTRAP_ADMIN_USER_ID;
      await seed();
      expect(await state()).toEqual({ organizations: 0, memberships: 0, audits: 0 });
    });

    it('does nothing when the account does not exist', async () => {
      process.env.BOOTSTRAP_ADMIN_USER_ID = 'nobody-here';
      await seed();
      expect(await state()).toEqual({ organizations: 0, memberships: 0, audits: 0 });
    });

    it('does not add a second organization when one already exists', async () => {
      await organizations.save({ name: '이미 있는 조직', version: 1 });
      await seed();
      expect(await state()).toEqual({ organizations: 1, memberships: 0, audits: 0 });
    });
  });
});
