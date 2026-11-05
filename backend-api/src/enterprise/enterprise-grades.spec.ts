import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';

/** The four grades as input, and what a change of grade leaves in the audit trail. */
describe('EnterpriseService grades', () => {
  let db: DataSource;
  let service: EnterpriseService;
  let users: Repository<User>;
  let organizations: Repository<EnterpriseOrganization>;
  let memberships: Repository<EnterpriseMembership>;
  let audits: Repository<EnterpriseAuditEvent>;
  const previous = process.env.BOOTSTRAP_ADMIN_USER_ID;

  const account = (id: number) => ({
    id,
    userId: `account-${id}`,
    email: `account-${id}@example.invalid`,
    password: `password-hash-${id}`,
    active: true,
    authVersion: 0,
  });
  const versionOf = async () => (await organizations.find())[0].version;
  const actions = async () => (await audits.find({ order: { id: 'ASC' } })).map(a => a.action);
  const update = async (target: number, role: unknown, team = '') =>
    service.update(1, target, { team, role, active: true, expectedVersion: await versionOf() });

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
    delete process.env.BOOTSTRAP_ADMIN_USER_ID;
    await db.getRepository(EnterpriseEnrollment).clear();
    await memberships.clear();
    await audits.clear();
    await organizations.clear();
    await users.clear();
    await users.save([1, 2, 3].map(account));
    await service.create(1, { name: '바닐라메타' });
    // Account 2 joined before grades existed.
    await memberships.save({
      userId: 2,
      organizationId: (await organizations.find())[0].id,
      role: 'member',
      team: '',
    });
    await audits.clear();
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.BOOTSTRAP_ADMIN_USER_ID;
    else process.env.BOOTSTRAP_ADMIN_USER_ID = previous;
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it.each(['admin', 'editor', 'contributor', 'viewer', 'member'])(
    'accepts %s as a role and stores it as given',
    async role => {
      const result = await update(2, role);
      expect(result.member.role).toBe(role);
      expect((await memberships.findOneByOrFail({ userId: 2 })).role).toBe(role);
    },
  );

  it.each([['owner'], [''], ['ADMIN'], [null], [undefined], [7]])(
    'refuses the role %p',
    async role => {
      await expect(update(2, role)).rejects.toMatchObject({ status: 400 });
      expect((await memberships.findOneByOrFail({ userId: 2 })).role).toBe('member');
      expect(await actions()).toEqual([]);
    },
  );

  it('adds an account with a new grade through its own consent code', async () => {
    const organizationId = (await organizations.find())[0].id;
    const { enrollmentCode } = await service.enrollment(3, { organizationId });
    const added = await service.add(1, {
      userId: 'account-3',
      team: 'growth',
      role: 'contributor',
      expectedVersion: await versionOf(),
      enrollmentCode,
    });
    expect(added.member.role).toBe('contributor');
    expect((await memberships.findOneByOrFail({ userId: 3 })).role).toBe('contributor');
  });

  describe('audit trail', () => {
    it('records a change of grade apart from the update', async () => {
      await update(2, 'viewer');
      expect(await actions()).toEqual(['member.updated', 'member.role_changed']);
    });

    it('records only the update when just the team changes', async () => {
      await update(2, 'member', 'platform');
      expect(await actions()).toEqual(['member.updated']);
    });

    it('does not count the legacy member becoming an editor as a change of grade', async () => {
      await update(2, 'editor');
      expect(await actions()).toEqual(['member.updated']);
    });

    it('records nothing when the update is refused', async () => {
      await expect(update(2, 'owner')).rejects.toMatchObject({ status: 400 });
      expect(await actions()).toEqual([]);
    });
  });

  describe('an administrator keeps their own grade', () => {
    it.each(['editor', 'contributor', 'viewer', 'member'])(
      'refuses to change themselves to %s',
      async role => {
        await expect(update(1, role)).rejects.toMatchObject({ status: 400 });
        expect((await memberships.findOneByOrFail({ userId: 1 })).role).toBe('admin');
      },
    );

    it('still allows an administrator to save themselves as an administrator', async () => {
      await expect(update(1, 'admin', 'core')).resolves.toMatchObject({
        member: { role: 'admin' },
      });
    });
  });
});
