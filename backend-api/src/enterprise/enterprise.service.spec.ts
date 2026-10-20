import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';

/** The single message every unusable enrollment code must produce, whatever went wrong. */
const UNUSABLE_ENROLLMENT = '직원 계정과 조직 연결 코드를 확인해 주세요.';
/** The separate message for a code that is not even shaped like a code. */
const MALFORMED_ENROLLMENT = '직원이 발급한 조직 연결 코드를 확인해 주세요.';

/**
 * UC-051 first unit: organization/membership lifecycle on a real SQLite DataSource with
 * synchronize enabled, so every claim is proven against real transactions and CAS updates.
 */
describe('EnterpriseService organization and membership lifecycle', () => {
  let db: DataSource;
  let service: EnterpriseService;
  let users: Repository<User>;
  let organizations: Repository<EnterpriseOrganization>;
  let memberships: Repository<EnterpriseMembership>;
  let audits: Repository<EnterpriseAuditEvent>;
  let enrollments: Repository<EnterpriseEnrollment>;

  const account = (id: number) => ({
    id,
    userId: `account-${id}`,
    email: `account-${id}@example.invalid`,
    password: `password-hash-${id}`,
    active: true,
    authVersion: 0,
  });

  const seedAccounts = (...ids: number[]) => users.save(ids.map(account));

  const state = async () => ({
    organizations: await organizations.count(),
    memberships: await memberships.count(),
    audits: await audits.count(),
  });

  const versionOf = async (id: number) => (await organizations.findOneByOrFail({ id })).version;

  /** The account owner issues their own consent code, bound to one concrete organization. */
  const enroll = async (targetId: number, organizationId?: number) =>
    (
      await service.enrollment(targetId, {
        organizationId: organizationId ?? (await firstOrganizationId()),
      })
    ).enrollmentCode;

  /** "First organization" default keeps callers able to target the intended org explicitly. */
  const firstOrganizationId = async () => {
    const [first] = await organizations.find({ order: { id: 'ASC' }, take: 1 });
    if (!first) throw new Error('no organization has been created');
    return first.id;
  };

  const organizationOf = async (userId: number) =>
    (await memberships.findOneByOrFail({ userId })).organizationId;

  /** An admin exchanges another account's consent code, bound to that admin's own org. */
  const invite = async (
    actor: number,
    targetId: number,
    role: 'admin' | 'member',
    expectedVersion: number,
    team = '',
  ) =>
    service.add(actor, {
      userId: `account-${targetId}`,
      team,
      role,
      expectedVersion,
      enrollmentCode: await enroll(targetId, await organizationOf(actor)),
    });

  const messageOf = (error: unknown) => String((error as { message?: string })?.message);

  it('rejects a future expected version before claiming a newer database revision', async () => {
    const manager = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const scoped = jest.spyOn(service as any, 'scope').mockResolvedValue({
      organization: { id: 1, version: 1 },
    });
    try {
      await expect((service as any).claim(manager, 1, 2)).rejects.toMatchObject({ status: 409 });
      expect(manager.update).not.toHaveBeenCalled();
    } finally {
      scoped.mockRestore();
    }
  });

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
    enrollments = db.getRepository(EnterpriseEnrollment);
  });

  beforeEach(async () => {
    await enrollments.clear();
    await memberships.clear();
    await audits.clear();
    await organizations.clear();
    await users.clear();
    await seedAccounts(1, 2, 3, 4);
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it('returns an empty context for an unaffiliated account and writes nothing', async () => {
    const before = await state();
    await expect(service.context(1)).resolves.toEqual({ organization: null, membership: null });
    expect(await state()).toEqual(before);
    expect(before).toEqual({ organizations: 0, memberships: 0, audits: 0 });
  });

  it('creates an isolated organization with the creator as admin and one audit event', async () => {
    const created = await service.create(1, { name: '  Acme  ' });
    const organizationId = created.organization.id;

    expect(created.organization).toMatchObject({ name: 'Acme', version: 1 });
    expect(created.membership).toEqual({ userId: 1, role: 'admin', team: '' });
    expect(await organizations.count()).toBe(1);
    expect(await memberships.count()).toBe(1);
    expect(await audits.find()).toEqual([
      expect.objectContaining({
        organizationId,
        actorId: 1,
        action: 'organization.created',
        resourceId: organizationId,
        version: 1,
      }),
    ]);

    await expect(service.context(1)).resolves.toEqual({
      organization: { id: organizationId, name: 'Acme', version: 1 },
      membership: { userId: 1, role: 'admin', team: '' },
    });
    await expect(service.context(2)).resolves.toEqual({ organization: null, membership: null });
  });

  it('rejects a second organization for an account that already belongs to one', async () => {
    const first = await service.create(1, { name: 'Acme' });
    const before = await state();

    await expect(service.create(1, { name: 'Second' })).rejects.toMatchObject({ status: 409 });

    expect(await state()).toEqual(before);
    expect(await organizations.find()).toHaveLength(1);
    expect(await organizations.findOneByOrFail({ id: first.organization.id })).toMatchObject({
      name: 'Acme',
      version: 1,
    });
  });

  it('issues a hashed code bound to the named organization for an unassigned account', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    const before = await state();
    const organizationBefore = await organizations.findOneByOrFail({ id: organizationId });

    const issued = await service.enrollment(2, { organizationId });

    expect(issued.enrollmentCode).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.organization).toEqual({ id: organizationId, name: 'Acme' });
    const stored = await enrollments.findOneByOrFail({ userId: 2 });
    expect(stored.organizationId).toBe(organizationId);
    expect(stored.codeHash).toBe(createHash('sha256').update(issued.enrollmentCode).digest('hex'));
    expect(stored.codeHash).not.toBe(issued.enrollmentCode);
    expect(JSON.stringify(stored)).not.toContain(issued.enrollmentCode);
    expect(stored.expiresAt.getTime()).toBe(new Date(issued.expiresAt).getTime());
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(stored.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000 + 2000);
    expect(await state()).toEqual(before);
    expect(await organizations.findOneByOrFail({ id: organizationId })).toEqual(organizationBefore);
  });

  it('requires a real organization and an unassigned active owner before issuing a code', async () => {
    await service.create(1, { name: 'Acme' });
    await users.update(3, { active: false });
    const failed: string[] = [];
    const attempt = async (run: () => Promise<unknown>) => {
      try {
        await run();
        failed.push('resolved instead of rejecting');
      } catch (error) {
        failed.push(messageOf(error));
      }
    };

    await attempt(() => service.enrollment(2, {}));
    await attempt(() => service.enrollment(2, { organizationId: 0 }));
    await attempt(() => service.enrollment(2, { organizationId: '1' }));
    await attempt(() => service.enrollment(2, { organizationId: 9999 }));
    await attempt(() => service.enrollment(2, { organizationId: 1, extra: 1 }));
    await attempt(() => service.enrollment(1, { organizationId: 1 }));
    await attempt(() => service.enrollment(3, { organizationId: 1 }));
    await attempt(() => service.enrollment(999, { organizationId: 1 }));

    expect(failed).toEqual([
      '변경 항목을 확인해 주세요.',
      '잘못된 계정 ID입니다.',
      '잘못된 계정 ID입니다.',
      '참여할 조직 번호를 확인해 주세요.',
      '변경 항목을 확인해 주세요.',
      '이미 조직에 소속돼 있습니다.',
      '활성 계정만 사용할 수 있습니다.',
      '활성 계정만 사용할 수 있습니다.',
    ]);
    expect(await enrollments.count()).toBe(0);
  });

  it('revokes a pending code for the account owner and stays idempotent', async () => {
    await service.create(1, { name: 'Acme' });
    const code = await enroll(2);
    expect(await enrollments.findOneBy({ userId: 2 })).not.toBeNull();

    await expect(service.revokeEnrollment(2)).resolves.toEqual({ revoked: true });
    expect(await enrollments.findOneBy({ userId: 2 })).toBeNull();
    await expect(service.revokeEnrollment(2)).resolves.toEqual({ revoked: true });

    await expect(
      service.add(1, {
        userId: 'account-2',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: code,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });
    await users.update(2, { active: false });
    await expect(service.revokeEnrollment(2)).rejects.toMatchObject({ status: 403 });
    await expect(service.revokeEnrollment(999)).rejects.toMatchObject({ status: 403 });
  });

  it('denies a plain member the member list and every mutation without writing', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    await invite(1, 2, 'member', created.organization.version, 'sales');
    const version = await versionOf(organizationId);
    const before = await state();

    for (const attempt of [
      () => service.members(2),
      () => invite(2, 3, 'member', version),
      () =>
        service.update(2, 1, { team: '', role: 'member', active: true, expectedVersion: version }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ status: 403 });
    }

    expect(await state()).toEqual(before);
    expect(await memberships.findOneBy({ userId: 3 })).toBeNull();
    expect(await versionOf(organizationId)).toBe(version);
  });

  it('denies deactivated and unknown actors before any read or write', async () => {
    await service.create(1, { name: 'Acme' });
    await users.update(1, { active: false });
    const before = await state();

    await expect(service.context(1)).rejects.toMatchObject({ status: 403 });
    await expect(service.context(999)).rejects.toMatchObject({ status: 403 });
    await expect(service.members(1)).rejects.toMatchObject({ status: 403 });
    await expect(service.create(1, { name: 'Other' })).rejects.toMatchObject({ status: 403 });

    expect(await state()).toEqual(before);
  });

  it('forbids an admin from mutating a member of another organization', async () => {
    const alpha = await service.create(1, { name: 'Alpha' });
    await service.create(3, { name: 'Beta' });
    await invite(3, 2, 'member', 1);
    const beta = await organizations.findOneByOrFail({ name: 'Beta' });
    const betaMemberBefore = await memberships.findOneByOrFail({ userId: 2 });
    const before = await state();

    await expect(
      service.update(1, 2, { team: 'hijack', role: 'admin', active: false, expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 403 });

    expect(await memberships.findOneByOrFail({ userId: 2 })).toEqual(betaMemberBefore);
    expect(betaMemberBefore).toMatchObject({ organizationId: beta.id, team: '', role: 'member' });
    expect(await users.findOneByOrFail({ id: 2 })).toMatchObject({ active: true, authVersion: 0 });
    expect(await versionOf(alpha.organization.id)).toBe(1);
    expect(await state()).toEqual(before);
  });

  it('rejects a code that belongs to another organization without leaking affiliation', async () => {
    const alpha = await service.create(1, { name: 'Alpha' });
    const beta = await service.create(3, { name: 'Beta' });
    await seedAccounts(5);
    const betaCode = await enroll(5, beta.organization.id);
    const before = await state();

    await expect(
      service.add(1, {
        userId: 'account-5',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: betaCode,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });

    expect(await versionOf(alpha.organization.id)).toBe(1);
    expect(await memberships.findOneBy({ userId: 5 })).toBeNull();
    expect(await state()).toEqual(before);
    expect(await enrollments.findOneByOrFail({ userId: 5 })).toMatchObject({
      organizationId: beta.organization.id,
    });
  });

  it('rejects a code issued to a different account than the one being attached', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const code = await enroll(2);
    const before = await state();

    await expect(
      service.add(1, {
        userId: 'account-4',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: code,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });

    expect(await memberships.findOneBy({ userId: 2 })).toBeNull();
    expect(await memberships.findOneBy({ userId: 4 })).toBeNull();
    expect(await versionOf(created.organization.id)).toBe(1);
    expect(await state()).toEqual(before);
  });

  it('rejects a login name that matches more than one account', async () => {
    const created = await service.create(1, { name: 'Acme' });
    await seedAccounts(9);
    const code = await enroll(2);
    const before = await state();
    // Simulate a pre-migration lookup result without removing any current identity constraints.
    const legacyRows = [
      await users.findOneByOrFail({ id: 2 }),
      { ...(await users.findOneByOrFail({ id: 9 })), userId: 'account-2' },
    ];
    const lookup = jest.fn(async (entity, options) => {
      expect(entity).toBe(User);
      expect(options).toEqual({ where: { userId: 'account-2' }, take: 2 });
      return legacyRows;
    });
    const transaction = db.transaction.bind(db);
    const injected = jest.spyOn(db, 'transaction').mockImplementationOnce((async run =>
      transaction(async manager => {
        const find = jest.spyOn(manager, 'find').mockImplementation(lookup);
        try {
          return await run(manager);
        } finally {
          find.mockRestore();
        }
      })) as any);
    try {
      await expect(
        service.add(1, {
          userId: 'account-2',
          team: '',
          role: 'member',
          expectedVersion: 1,
          enrollmentCode: code,
        }),
      ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });

      expect(lookup).toHaveBeenCalledTimes(1);
      expect(await state()).toEqual(before);
      expect(await memberships.findOneBy({ userId: 2 })).toBeNull();
      expect(await memberships.findOneBy({ userId: 9 })).toBeNull();
      expect(await versionOf(created.organization.id)).toBe(1);
      expect(await enrollments.findOneBy({ userId: 2 })).not.toBeNull();
      // The real database still rejects duplicate login names after the simulated legacy lookup.
      await expect(users.update(9, { userId: 'account-2' })).rejects.toMatchObject({
        driverError: { code: 'SQLITE_CONSTRAINT' },
      });
      expect((await users.findOneByOrFail({ id: 9 })).userId).toBe('account-9');
    } finally {
      injected.mockRestore();
    }
  });

  it('answers every unusable code with one identical error and no cross-org oracle', async () => {
    const alpha = await service.create(1, { name: 'Alpha' });
    const beta = await service.create(4, { name: 'Beta' });
    await seedAccounts(5, 6, 7, 8);
    const body = (userId: string, expectedVersion: number, enrollmentCode: string) => ({
      userId,
      team: '',
      role: 'member' as const,
      expectedVersion,
      enrollmentCode,
    });
    const labels: string[] = [];
    const messages: string[] = [];
    /** Executed in order: every denial must leave the organization version untouched. */
    const expectUniform = async (label: string, run: () => Promise<unknown>) => {
      labels.push(label);
      await run().then(
        () => messages.push('resolved'),
        error => messages.push(messageOf(error)),
      );
    };

    const unknownCode = await enroll(8, alpha.organization.id);
    await expectUniform('unknown account', () =>
      service.add(1, body('missing-account', 1, unknownCode)),
    );

    const recipientCode = await enroll(8, alpha.organization.id);
    await expectUniform('recipient mismatch', () =>
      service.add(1, body('account-7', 1, recipientCode)),
    );

    const foreignCode = await enroll(5, beta.organization.id);
    await expectUniform('code for another organization', () =>
      service.add(1, body('account-5', 1, foreignCode)),
    );

    const expiredCode = await enroll(6, alpha.organization.id);
    await enrollments.update({ userId: 6 }, { expiresAt: new Date(Date.now() - 60_000) });
    await expectUniform('expired code', () => service.add(1, body('account-6', 1, expiredCode)));

    const inactiveCode = await enroll(3, alpha.organization.id);
    await users.update(3, { active: false });
    await expectUniform('deactivated owner', () =>
      service.add(1, body('account-3', 1, inactiveCode)),
    );

    // Only this consent is valid, and reusing its code afterwards is the sixth mode.
    const goodCode = await enroll(7, alpha.organization.id);
    await expect(service.add(1, body('account-7', 1, goodCode))).resolves.toMatchObject({
      organizationVersion: 2,
    });
    await expectUniform('consumed code', () => service.add(1, body('account-5', 2, goodCode)));

    expect(labels).toEqual([
      'unknown account',
      'recipient mismatch',
      'code for another organization',
      'expired code',
      'deactivated owner',
      'consumed code',
    ]);
    expect(messages).toEqual(Array(6).fill(UNUSABLE_ENROLLMENT));

    expect(await versionOf(alpha.organization.id)).toBe(2);
    expect(await versionOf(beta.organization.id)).toBe(1);
    expect(await memberships.find({ order: { userId: 'ASC' } })).toMatchObject([
      { userId: 1, organizationId: alpha.organization.id, role: 'admin' },
      { userId: 4, organizationId: beta.organization.id, role: 'admin' },
      { userId: 7, organizationId: alpha.organization.id, role: 'member' },
    ]);
    expect(await enrollments.findOneByOrFail({ userId: 5 })).toMatchObject({
      organizationId: beta.organization.id,
    });
    expect(await enrollments.findOneBy({ userId: 6 })).not.toBeNull();
  });

  it('rejects a consent code when the account already holds a membership row', async () => {
    const alpha = await service.create(1, { name: 'Alpha' });
    const beta = await service.create(3, { name: 'Beta' });
    const code = await enroll(2, alpha.organization.id);
    // Defensive branch: the membership appears after consent (race or direct write).
    await memberships.insert({
      userId: 2,
      organizationId: beta.organization.id,
      role: 'member',
      team: '',
    });
    const before = await state();

    await expect(
      service.add(1, {
        userId: 'account-2',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: code,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });

    expect(await versionOf(alpha.organization.id)).toBe(1);
    expect(await versionOf(beta.organization.id)).toBe(1);
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({
      organizationId: beta.organization.id,
      role: 'member',
    });
    expect(await state()).toEqual(before);
    expect(await enrollments.findOneBy({ userId: 2 })).not.toBeNull();
  });

  it('denies a missing, unknown, foreign or expired code and rolls back the claim', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    const code = await enroll(2);
    const foreignCode = await enroll(3);
    const before = await state();

    await expect(
      service.add(1, { userId: 'account-2', team: '', role: 'member', expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.add(1, {
        userId: 'account-2',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: 'a'.repeat(64),
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });
    await expect(
      service.add(1, {
        userId: 'account-2',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: foreignCode,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });
    await enrollments.update({ userId: 2 }, { expiresAt: new Date(Date.now() - 60_000) });
    await expect(
      service.add(1, {
        userId: 'account-2',
        team: '',
        role: 'member',
        expectedVersion: 1,
        enrollmentCode: code,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });

    expect(await versionOf(organizationId)).toBe(1);
    expect(await memberships.findOneBy({ userId: 2 })).toBeNull();
    expect(await memberships.findOneBy({ userId: 3 })).toBeNull();
    expect(await state()).toEqual(before);
    expect((await enrollments.findOneBy({ userId: 2 }))?.expiresAt.getTime()).toBeLessThan(
      Date.now(),
    );
    expect(await enrollments.findOneBy({ userId: 3 })).not.toBeNull();
  });

  it('consumes the enrollment code on success and refuses reuse', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    const code = await enroll(2);

    const added = await service.add(1, {
      userId: 'account-2',
      team: 'sales',
      role: 'member',
      expectedVersion: 1,
      enrollmentCode: code,
    });
    expect(added).toEqual({
      organizationVersion: 2,
      member: { id: 2, userId: 'account-2', team: 'sales', role: 'member', active: true },
    });
    expect(await enrollments.findOneBy({ userId: 2 })).toBeNull();

    await expect(
      service.add(1, {
        userId: 'account-3',
        team: '',
        role: 'member',
        expectedVersion: 2,
        enrollmentCode: code,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });
    expect(await memberships.findOneBy({ userId: 3 })).toBeNull();
    expect(await versionOf(organizationId)).toBe(2);

    const first = await enroll(3);
    const second = await enroll(3);
    expect(second).not.toBe(first);
    await expect(
      service.add(1, {
        userId: 'account-3',
        team: '',
        role: 'member',
        expectedVersion: 2,
        enrollmentCode: first,
      }),
    ).rejects.toMatchObject({ status: 400, message: UNUSABLE_ENROLLMENT });
    await expect(
      service.add(1, {
        userId: 'account-3',
        team: '',
        role: 'member',
        expectedVersion: 2,
        enrollmentCode: second,
      }),
    ).resolves.toEqual({
      organizationVersion: 3,
      member: { id: 3, userId: 'account-3', team: '', role: 'member', active: true },
    });
    expect(await enrollments.findOneBy({ userId: 3 })).toBeNull();
    expect(await versionOf(organizationId)).toBe(3);
  });

  it('scopes the member list to the admin own organization', async () => {
    await service.create(1, { name: 'Alpha' });
    const beta = await service.create(3, { name: 'Beta' });
    await invite(3, 2, 'member', 1, 'sales');

    const alpha = await service.members(1);
    expect(alpha.organizationVersion).toBe(1);
    expect(alpha.entries.map(entry => entry.userId)).toEqual(['account-1']);
    expect(alpha.nextAfterId).toBeNull();

    const betaList = await service.members(3);
    expect(betaList.organizationVersion).toBe(2);
    expect(betaList.entries.map(entry => entry.userId)).toEqual(['account-2', 'account-3']);
    expect(betaList.entries.map(entry => entry.id)).toEqual([2, 3]);
    expect(betaList.nextAfterId).toBeNull();
    expect(await versionOf(beta.organization.id)).toBe(2);
  });

  it('blocks self demotion and self deactivation before any write', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const before = await state();

    await expect(
      service.update(1, 1, { team: '', role: 'member', active: true, expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.update(1, 1, { team: '', role: 'admin', active: false, expectedVersion: 1 }),
    ).rejects.toMatchObject({ status: 400 });

    expect(await state()).toEqual(before);
    expect(await versionOf(created.organization.id)).toBe(1);
    expect(await memberships.findOneByOrFail({ userId: 1 })).toMatchObject({ role: 'admin' });
    expect(await users.findOneByOrFail({ id: 1 })).toMatchObject({ active: true, authVersion: 0 });
  });

  it('rejects a stale organization version and rolls back version, membership and audit', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    await invite(1, 2, 'admin', 1);
    expect(await versionOf(organizationId)).toBe(2);

    const winner = await service.update(1, 2, {
      team: 'ops',
      role: 'admin',
      active: true,
      expectedVersion: 2,
    });
    expect(winner.organizationVersion).toBe(3);
    const afterWinner = await state();

    await expect(
      service.update(2, 1, { team: 'ops', role: 'member', active: false, expectedVersion: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(invite(1, 3, 'member', 2, 'ops')).rejects.toMatchObject({ status: 409 });

    expect(await versionOf(organizationId)).toBe(3);
    expect(await memberships.findOneByOrFail({ userId: 1 })).toMatchObject({
      team: '',
      role: 'admin',
    });
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({
      team: 'ops',
      role: 'admin',
    });
    expect(await memberships.findOneBy({ userId: 3 })).toBeNull();
    expect(await users.findOneByOrFail({ id: 1 })).toMatchObject({ active: true, authVersion: 0 });
    expect(await state()).toEqual(afterWinner);
  });

  it('lets only one admin revoke the other at the same organization version', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    await invite(1, 2, 'admin', 1);

    const winner = await service.update(1, 2, {
      team: '',
      role: 'member',
      active: true,
      expectedVersion: 2,
    });
    expect(winner.organizationVersion).toBe(3);

    await expect(
      service.update(2, 1, { team: '', role: 'member', active: true, expectedVersion: 2 }),
    ).rejects.toMatchObject({ status: 403 });

    expect(await versionOf(organizationId)).toBe(3);
    expect(await memberships.findOneByOrFail({ userId: 1 })).toMatchObject({ role: 'admin' });
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({ role: 'member' });
    expect(await audits.find({ where: { action: 'member.updated' } })).toHaveLength(1);
  });

  it('settles two overlapping admin claims as exactly one winner and one 409 loser', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    await invite(1, 2, 'admin', 1);
    await invite(1, 3, 'member', 2);

    const settled = await Promise.allSettled([
      service.update(1, 3, { team: 'alpha', role: 'member', active: true, expectedVersion: 3 }),
      service.update(2, 3, { team: 'beta', role: 'member', active: true, expectedVersion: 3 }),
    ]);

    const fulfilled = settled.filter(result => result.status === 'fulfilled');
    const rejected = settled.filter(
      result => result.status === 'rejected',
    ) as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      status: 409,
      message: '다른 변경이 먼저 반영됐습니다. 최신 목록을 확인해 주세요.',
    });

    const winner = fulfilled[0] as PromiseFulfilledResult<{
      organizationVersion: number;
      member: { team: string };
    }>;
    expect(winner.value.organizationVersion).toBe(4);
    expect(['alpha', 'beta']).toContain(winner.value.member.team);
    expect(await versionOf(organizationId)).toBe(4);
    expect(await audits.find({ where: { action: 'member.updated' } })).toHaveLength(1);
    expect(await memberships.findOneByOrFail({ userId: 3 })).toMatchObject({
      team: winner.value.member.team,
      role: 'member',
    });
    expect(await memberships.findOneByOrFail({ userId: 1 })).toMatchObject({ role: 'admin' });
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({ role: 'admin' });

    // The rejected claim must not poison the queue: the next valid write still lands.
    await expect(
      service.update(2, 3, {
        team: 'recovered',
        role: 'member',
        active: true,
        expectedVersion: 4,
      }),
    ).resolves.toEqual({
      organizationVersion: 5,
      member: { id: 3, userId: 'account-3', team: 'recovered', role: 'member', active: true },
    });
    expect(await versionOf(organizationId)).toBe(5);
    expect(await memberships.findOneByOrFail({ userId: 3 })).toMatchObject({
      team: 'recovered',
      role: 'member',
    });
    expect(await audits.find({ where: { action: 'member.updated' } })).toHaveLength(2);
  });

  it('updates role and team and revokes tokens with an authVersion bump when activity changes', async () => {
    await service.create(1, { name: 'Acme' });
    await invite(1, 2, 'member', 1, 'sales');
    await users.update(2, { jwtId: 77 });

    const deactivated = await service.update(1, 2, {
      team: 'ops',
      role: 'admin',
      active: false,
      expectedVersion: 2,
    });
    expect(deactivated).toEqual({
      organizationVersion: 3,
      member: { id: 2, userId: 'account-2', team: 'ops', role: 'admin', active: false },
    });
    expect(await users.findOneByOrFail({ id: 2 })).toMatchObject({
      active: false,
      authVersion: 1,
      jwtId: null,
    });
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({
      team: 'ops',
      role: 'admin',
    });

    const reactivated = await service.update(1, 2, {
      team: 'ops',
      role: 'admin',
      active: true,
      expectedVersion: 3,
    });
    expect(reactivated.organizationVersion).toBe(4);
    expect(await users.findOneByOrFail({ id: 2 })).toMatchObject({
      active: true,
      authVersion: 2,
      jwtId: null,
    });
  });

  it('keeps authVersion and tokens when only role or team changes', async () => {
    await service.create(1, { name: 'Acme' });
    await invite(1, 2, 'member', 1);
    await users.update(2, { jwtId: 55 });

    await service.update(1, 2, { team: 'ops', role: 'admin', active: true, expectedVersion: 2 });

    expect(await users.findOneByOrFail({ id: 2 })).toMatchObject({
      active: true,
      authVersion: 0,
      jwtId: 55,
    });
    expect(await memberships.findOneByOrFail({ userId: 2 })).toMatchObject({
      team: 'ops',
      role: 'admin',
    });
  });

  it('stores only actor, action, resource and version in the audit trail', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    await invite(1, 2, 'member', 1, 'sales');
    await service.update(1, 2, {
      team: 'sales',
      role: 'member',
      active: false,
      expectedVersion: 2,
    });

    const rows = await audits.find({ order: { id: 'ASC' } });
    expect(rows.map(row => [row.actorId, row.action, row.resourceId, row.version])).toEqual([
      [1, 'organization.created', organizationId, 1],
      [1, 'member.added', 2, 2],
      [1, 'member.updated', 2, 3],
    ]);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        'action',
        'actorId',
        'createdAt',
        'id',
        'organizationId',
        'resourceId',
        'subjectId',
        'version',
      ]);
      expect(row.createdAt).toBeInstanceOf(Date);
      expect(row.organizationId).toBe(organizationId);
    }
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('password-hash');
    expect(serialized).not.toContain('@example.invalid');
    expect(serialized).not.toContain('jwtId');
    expect(serialized).not.toContain('authVersion');
    expect(serialized).not.toContain('codeHash');
  });

  it('never returns account secrets or other organization details in errors', async () => {
    await service.create(1, { name: 'Alpha' });
    const beta = await service.create(3, { name: 'Beta' });
    const code = await enroll(2, beta.organization.id);
    const messages: string[] = [];

    for (const attempt of [
      () => service.update(1, 3, { team: '', role: 'member', active: true, expectedVersion: 1 }),
      () =>
        service.add(1, {
          userId: 'missing-account',
          team: '',
          role: 'member',
          expectedVersion: 1,
          enrollmentCode: code,
        }),
      () => service.members(2),
      () => service.create(1, { name: 'Third' }),
    ]) {
      await attempt().then(
        () => {
          throw new Error('expected the request to be rejected');
        },
        error => messages.push(messageOf(error)),
      );
    }

    expect(messages).toHaveLength(4);
    for (const message of messages) {
      expect(message).not.toContain('@example.invalid');
      expect(message).not.toContain('password-hash');
      expect(message).not.toContain('Beta');
      expect(message).not.toContain('jwtId');
      expect(message).not.toContain(code);
    }
  });

  it('rejects malformed bodies and identifiers without writing', async () => {
    const created = await service.create(1, { name: 'Acme' });
    const organizationId = created.organization.id;
    const code = await enroll(3);
    const validMembership = {
      userId: 'account-3',
      team: '',
      role: 'member',
      expectedVersion: 2,
      enrollmentCode: code,
    };
    await invite(1, 2, 'member', 1);
    const before = await state();

    const cases: Array<[string, () => Promise<unknown>]> = [
      ['non-object create body', () => service.create(3, 'acme')],
      ['array create body', () => service.create(3, ['acme'])],
      ['missing name', () => service.create(3, {})],
      ['blank name', () => service.create(3, { name: '   ' })],
      ['unknown create key', () => service.create(3, { name: 'Acme', extra: 1 })],
      ['oversized name', () => service.create(3, { name: 'x'.repeat(101) })],
      [
        'missing add field',
        () => service.add(1, { userId: 'account-3', team: '', role: 'member' }),
      ],
      [
        'missing enrollment code',
        () => service.add(1, { userId: 'account-3', team: '', role: 'member', expectedVersion: 2 }),
      ],
      [
        'numeric enrollment code',
        () => service.add(1, { ...validMembership, enrollmentCode: 123 }),
      ],
      [
        'short enrollment code',
        () => service.add(1, { ...validMembership, enrollmentCode: 'abc' }),
      ],
      [
        'uppercase enrollment code',
        () => service.add(1, { ...validMembership, enrollmentCode: 'A'.repeat(64) }),
      ],
      ['unknown add key', () => service.add(1, { ...validMembership, extra: 1 })],
      ['blank target account', () => service.add(1, { ...validMembership, userId: '  ' })],
      ['numeric target account', () => service.add(1, { ...validMembership, userId: 3 })],
      ['oversized team', () => service.add(1, { ...validMembership, team: 'x'.repeat(101) })],
      ['invalid role', () => service.add(1, { ...validMembership, role: 'owner' })],
      ['zero version', () => service.add(1, { ...validMembership, expectedVersion: 0 })],
      ['fractional version', () => service.add(1, { ...validMembership, expectedVersion: 1.5 })],
      [
        'overflow version',
        () => service.add(1, { ...validMembership, expectedVersion: 2147483647 }),
      ],
      ['string version', () => service.add(1, { ...validMembership, expectedVersion: '2' })],
      [
        'missing active',
        () => service.update(1, 2, { team: '', role: 'member', expectedVersion: 2 }),
      ],
      [
        'non-boolean active',
        () =>
          service.update(1, 2, { team: '', role: 'member', active: 'true', expectedVersion: 2 }),
      ],
      [
        'unknown update key',
        () =>
          service.update(1, 2, {
            team: '',
            role: 'member',
            active: true,
            expectedVersion: 2,
            password: 'x',
          }),
      ],
      [
        'zero target id',
        () => service.update(1, 0, { team: '', role: 'member', active: true, expectedVersion: 2 }),
      ],
      [
        'fractional target id',
        () =>
          service.update(1, 2.5, { team: '', role: 'member', active: true, expectedVersion: 2 }),
      ],
      [
        'string target id',
        () =>
          service.update(1, 'account-2', {
            team: '',
            role: 'member',
            active: true,
            expectedVersion: 2,
          }),
      ],
    ];

    const unexpected: string[] = [];
    for (const [label, attempt] of cases) {
      try {
        await attempt();
        unexpected.push(`${label}: resolved instead of rejecting`);
      } catch (error) {
        if ((error as { status?: number })?.status !== 400)
          unexpected.push(`${label}: status ${(error as { status?: number })?.status}`);
      }
    }
    expect(unexpected).toEqual([]);

    expect(await state()).toEqual(before);
    expect(await versionOf(organizationId)).toBe(2);
    expect(await memberships.findOneBy({ userId: 3 })).toBeNull();
    expect(await enrollments.findOneBy({ userId: 3 })).not.toBeNull();

    const malformed: string[] = [];
    for (const attempt of [
      () =>
        service.add(1, {
          userId: 'account-3',
          team: '',
          role: 'member',
          expectedVersion: 2,
          enrollmentCode: 'abc',
        }),
      () =>
        service.add(1, {
          userId: 'account-3',
          team: '',
          role: 'member',
          expectedVersion: 2,
          enrollmentCode: 42,
        }),
    ]) {
      await attempt().then(
        () => malformed.push('resolved'),
        error => malformed.push(messageOf(error)),
      );
    }
    expect(malformed).toEqual([MALFORMED_ENROLLMENT, MALFORMED_ENROLLMENT]);
  });

  it('rejects invalid pagination cursors', async () => {
    await service.create(1, { name: 'Acme' });

    for (const cursor of ['abc', '0', '1.5', '-1', ' 2', 0, -3, 1.5])
      await expect(service.members(1, cursor)).rejects.toMatchObject({ status: 400 });

    await expect(service.members(1, '2')).resolves.toMatchObject({
      entries: [],
      nextAfterId: null,
    });
  });

  it('pages 20 members at a time in id order without leaking account fields', async () => {
    await seedAccounts(...Array.from({ length: 19 }, (_, index) => index + 5));
    const created = await service.create(1, { name: 'Alpha' });
    let version = 1;
    for (let id = 2; id <= 22; id++) {
      await invite(1, id, 'member', version, id % 2 ? 'ops' : 'sales');
      version++;
    }

    const first = await service.members(1);
    expect(first.organizationVersion).toBe(22);
    expect(first.entries.map(entry => entry.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(first.nextAfterId).toBe(20);

    const second = await service.members(1, first.nextAfterId);
    expect(second.entries.map(entry => entry.id)).toEqual([21, 22]);
    expect(second.nextAfterId).toBeNull();
    expect(second.organizationVersion).toBe(22);
    expect(await versionOf(created.organization.id)).toBe(22);

    for (const entry of [...first.entries, ...second.entries]) {
      expect(Object.keys(entry).sort()).toEqual(['active', 'id', 'role', 'team', 'userId']);
      expect(entry.userId).toBe(`account-${entry.id}`);
      expect(entry.active).toBe(true);
      expect(entry.role).toBe(entry.id === 1 ? 'admin' : 'member');
      expect(entry.team).toBe(entry.id === 1 ? '' : entry.id % 2 ? 'ops' : 'sales');
    }

    const other = await service.create(23, { name: 'Beta' });
    const otherList = await service.members(23);
    expect(otherList.organizationVersion).toBe(other.organization.version);
    expect(otherList.entries.map(entry => entry.id)).toEqual([23]);
    expect(otherList.nextAfterId).toBeNull();
  });
});
