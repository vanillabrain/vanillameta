import { DataSource, QueryRunner } from 'typeorm';
import { AddEnterpriseMembership1792400000000 } from '../migrations/1792400000000-add-enterprise-membership';
import { User } from '../user/entities/user.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';

/**
 * UC-051 migration: additive-only for SQLite/MySQL, idempotent, and fail-closed on rollback.
 * A legacy `user` table is created by hand so the epoch-0 compatibility defaults are real.
 */
describe('AddEnterpriseMembership1792400000000', () => {
  let db: DataSource;
  let runner: QueryRunner;

  const legacyUser = (userId: string) =>
    runner.query('INSERT INTO "user" ("userId") VALUES (?)', [userId]);

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [User, EnterpriseOrganization, EnterpriseMembership, EnterpriseAuditEvent],
    }).initialize();
    runner = db.createQueryRunner();
  });

  afterAll(async () => {
    await runner?.release();
    await db?.destroy();
  });

  it('survives an empty database so the synchronize baseline owns the user defaults', async () => {
    const fresh = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [
        User,
        EnterpriseOrganization,
        EnterpriseMembership,
        EnterpriseAuditEvent,
        EnterpriseEnrollment,
      ],
    }).initialize();
    const freshRunner = fresh.createQueryRunner();
    try {
      await expect(
        new AddEnterpriseMembership1792400000000().up(freshRunner),
      ).resolves.toBeUndefined();

      expect(await freshRunner.hasTable('user')).toBe(false);
      expect(await freshRunner.hasTable('enterprise_organization')).toBe(true);
      expect(await freshRunner.hasTable('enterprise_membership')).toBe(true);
      expect(await freshRunner.hasTable('enterprise_audit_event')).toBe(true);
      expect(await freshRunner.hasTable('enterprise_enrollment')).toBe(true);

      await fresh.synchronize();

      expect(await freshRunner.hasTable('user')).toBe(true);
      const saved = await fresh.manager.save(User, {
        userId: 'fresh-account',
        email: 'fresh@example.invalid',
        password: 'fresh-hash',
      });
      expect(saved.active).toBe(true);
      expect(saved.authVersion).toBe(0);
      await expect(fresh.manager.findOneByOrFail(User, { id: saved.id })).resolves.toMatchObject({
        active: true,
        authVersion: 0,
      });
      const [row] = await freshRunner.query(
        'SELECT "active","authVersion" FROM "user" WHERE "userId" = ?',
        ['fresh-account'],
      );
      expect(Number(row.active)).toBe(1);
      expect(Number(row.authVersion)).toBe(0);
    } finally {
      await freshRunner.release();
      await fresh.destroy();
    }
  });

  it('adds the enterprise schema idempotently and preserves legacy account defaults', async () => {
    await runner.query(
      'CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" varchar(255) NOT NULL)',
    );
    await legacyUser('legacy-account');
    const migration = new AddEnterpriseMembership1792400000000();

    await migration.up(runner);
    await migration.up(runner);

    expect(await runner.hasColumn('user', 'active')).toBe(true);
    expect(await runner.hasColumn('user', 'authVersion')).toBe(true);
    expect(await runner.hasTable('enterprise_organization')).toBe(true);
    expect(await runner.hasTable('enterprise_membership')).toBe(true);
    expect(await runner.hasTable('enterprise_audit_event')).toBe(true);
    expect(await runner.hasTable('enterprise_enrollment')).toBe(true);

    const [legacy] = await runner.query(
      'SELECT "userId","active","authVersion" FROM "user" WHERE "userId" = ?',
      ['legacy-account'],
    );
    expect(legacy.userId).toBe('legacy-account');
    expect(Number(legacy.active)).toBe(1);
    expect(Number(legacy.authVersion)).toBe(0);

    await legacyUser('new-account');
    const [fresh] = await runner.query(
      'SELECT "active","authVersion" FROM "user" WHERE "userId" = ?',
      ['new-account'],
    );
    expect(Number(fresh.active)).toBe(1);
    expect(Number(fresh.authVersion)).toBe(0);

    const members = await runner.query(
      'SELECT "userId","active","authVersion" FROM "user" ORDER BY "id" ASC',
    );
    expect(members).toHaveLength(2);
    expect(members.map((row: { userId: string }) => row.userId)).toEqual([
      'legacy-account',
      'new-account',
    ]);
  });

  it('creates the organization, membership and audit tables with their defaults', async () => {
    await runner.query("INSERT INTO enterprise_organization (name) VALUES ('Acme')");
    const [organization] = await runner.query(
      'SELECT id, name, version FROM enterprise_organization ORDER BY id ASC',
    );
    expect(organization.name).toBe('Acme');
    expect(Number(organization.version)).toBe(1);

    await runner.query(
      'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
      [1, organization.id, 'admin'],
    );
    const [membership] = await runner.query(
      'SELECT userId, organizationId, role, team FROM enterprise_membership',
    );
    expect(Number(membership.userId)).toBe(1);
    expect(Number(membership.organizationId)).toBe(organization.id);
    expect(membership.role).toBe('admin');
    expect(membership.team).toBe('');

    await expect(
      runner.query(
        'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
        [1, 999, 'member'],
      ),
    ).rejects.toThrow();

    await runner.query(
      'INSERT INTO enterprise_audit_event (organizationId, actorId, action, resourceId, version) VALUES (?,?,?,?,?)',
      [organization.id, 1, 'organization.created', organization.id, 1],
    );
    await runner.query(
      'INSERT INTO enterprise_enrollment (userId, organizationId, codeHash, expiresAt) VALUES (?,?,?,?)',
      [2, organization.id, 'b'.repeat(64), new Date(Date.now() + 900_000).toISOString()],
    );
    await expect(
      runner.query(
        'INSERT INTO enterprise_enrollment (userId, organizationId, codeHash, expiresAt) VALUES (?,?,?,?)',
        [2, organization.id, 'c'.repeat(64), new Date(Date.now() + 900_000).toISOString()],
      ),
    ).rejects.toThrow();
    await expect(
      runner.query(
        'INSERT INTO enterprise_enrollment (userId, codeHash, expiresAt) VALUES (?,?,?)',
        [3, 'd'.repeat(64), new Date(Date.now() + 900_000).toISOString()],
      ),
    ).rejects.toThrow();
    const [enrollment] = await runner.query(
      'SELECT userId, organizationId, codeHash, expiresAt FROM enterprise_enrollment ORDER BY userId ASC',
    );
    expect(Number(enrollment.userId)).toBe(2);
    expect(Number(enrollment.organizationId)).toBe(organization.id);
    expect(enrollment.codeHash).toBe('b'.repeat(64));
    expect(enrollment.expiresAt).toBeTruthy();

    const [audit] = await runner.query(
      'SELECT organizationId, actorId, action, resourceId, version, createdAt FROM enterprise_audit_event',
    );
    expect(audit).toMatchObject({
      organizationId: organization.id,
      actorId: 1,
      action: 'organization.created',
      resourceId: organization.id,
      version: 1,
    });
    expect(audit.createdAt).toBeTruthy();
  });

  it('refuses the destructive rollback so the schema cannot be dropped silently', async () => {
    await expect(new AddEnterpriseMembership1792400000000().down()).rejects.toThrow(/backup plan/);

    expect(await runner.hasTable('enterprise_organization')).toBe(true);
    expect(await runner.hasTable('enterprise_membership')).toBe(true);
    expect(await runner.hasTable('enterprise_audit_event')).toBe(true);
    expect(await runner.hasColumn('user', 'active')).toBe(true);
  });
});
