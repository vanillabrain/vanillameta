import { DataSource, QueryRunner } from 'typeorm';
import {
  AddAccountIntegrity1792430000000,
  engineProblem,
} from '../migrations/1792430000000-add-account-integrity';
import { User } from '../user/entities/user.entity';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';

const LEGACY_USER =
  'CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" varchar(255) NOT NULL, "email" varchar(255) NOT NULL, "password" varchar(255) NOT NULL)';
const LEGACY_MEMBERSHIP =
  'CREATE TABLE "enterprise_membership" ("userId" integer PRIMARY KEY NOT NULL, "organizationId" integer NOT NULL, "role" varchar(16) NOT NULL, "team" varchar(100) NOT NULL DEFAULT \'\')';

const snapshot = async (runner: QueryRunner) => ({
  users: await runner.query('SELECT id, "userId", email, password FROM "user" ORDER BY id'),
  memberships: await runner.query(
    'SELECT userId, organizationId, role, team FROM enterprise_membership ORDER BY userId',
  ),
});

const capture = async (run: Promise<unknown>): Promise<Error | undefined> => {
  try {
    await run;
    return undefined;
  } catch (error) {
    return error as Error;
  }
};

/**
 * UC-051 account identity integrity. The synchronized entity baseline must reject duplicate
 * userId/email and orphan memberships at the database level before the migration slice is added.
 */
describe('UC051 account identity integrity (synchronized baseline)', () => {
  let db: DataSource;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, EnterpriseMembership],
    }).initialize();
  });

  afterAll(async () => {
    await db?.destroy();
  });

  it('rejects a duplicate userId even when the email differs', async () => {
    await db
      .getRepository(User)
      .save({ userId: 'acct-1', email: 'acct-1@example.invalid', password: 'hash' });
    await expect(
      db
        .getRepository(User)
        .save({ userId: 'acct-1', email: 'other@example.invalid', password: 'hash' }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate email even when the userId differs', async () => {
    await expect(
      db
        .getRepository(User)
        .save({ userId: 'acct-2', email: 'acct-1@example.invalid', password: 'hash' }),
    ).rejects.toThrow();
  });

  it('rejects a membership that references a missing account', async () => {
    await expect(
      db
        .getRepository(EnterpriseMembership)
        .save({ userId: 999_999, organizationId: 1, role: 'admin', team: '' }),
    ).rejects.toThrow();
  });

  it('blocks deleting an account that still holds a membership', async () => {
    const user = await db
      .getRepository(User)
      .save({ userId: 'acct-3', email: 'acct-3@example.invalid', password: 'hash' });
    await db
      .getRepository(EnterpriseMembership)
      .save({ userId: user.id, organizationId: 1, role: 'admin', team: '' });

    await expect(db.getRepository(User).delete({ id: user.id })).rejects.toThrow();
    expect(await db.getRepository(User).countBy({ id: user.id })).toBe(1);
  });
});

/**
 * UC-051 additive migration: preflight before DDL, idempotent up, data preserved, and a
 * fail-closed rollback. MySQL DDL is not transactional so the operating run is a separate,
 * reviewed maintenance window; this suite only exercises real SQLite.
 */
describe('AddAccountIntegrity1792430000000', () => {
  const migration = new AddAccountIntegrity1792430000000();
  let db: DataSource;
  let runner: QueryRunner;

  const open = async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [],
    }).initialize();
    runner = db.createQueryRunner();
  };

  const close = async () => {
    await runner?.release();
    await db?.destroy();
  };

  const inspect = async (name: string) => {
    const reader = db.createQueryRunner();
    try {
      return await reader.getTable(name);
    } finally {
      await reader.release();
    }
  };

  afterEach(async () => {
    if (db?.isInitialized) await close();
    db = undefined;
    runner = undefined;
  });

  it('adds the named unique indexes and the RESTRICT ownership key to a legacy schema idempotently', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(LEGACY_MEMBERSHIP);
    await runner.query('INSERT INTO "user" ("userId","email","password") VALUES (?,?,?)', [
      'legacy',
      'legacy@example.invalid',
      'hash',
    ]);
    await runner.query(
      'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
      [1, 1, 'admin'],
    );
    const before = await snapshot(runner);

    await migration.up(runner);
    await migration.up(runner);

    const userTable = await inspect('user');
    const membershipTable = await inspect('enterprise_membership');
    const named = (userTable?.indices ?? []).filter(index =>
      ['UQ_user_userId', 'UQ_user_email'].includes(String(index.name)),
    );
    expect(named.map(index => index.name).sort()).toEqual(['UQ_user_email', 'UQ_user_userId']);
    expect(named.every(index => index.isUnique)).toBe(true);
    expect(membershipTable?.foreignKeys).toEqual([
      expect.objectContaining({
        name: 'FK_enterprise_membership_user',
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    ]);
    expect(await snapshot(runner)).toEqual(before);

    await expect(
      runner.query('INSERT INTO "user" ("userId","email","password") VALUES (?,?,?)', [
        'legacy',
        'different@example.invalid',
        'hash',
      ]),
    ).rejects.toThrow();
    await expect(
      runner.query('INSERT INTO "user" ("userId","email","password") VALUES (?,?,?)', [
        'different',
        'legacy@example.invalid',
        'hash',
      ]),
    ).rejects.toThrow();
    await expect(
      runner.query(
        'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
        [4242, 1, 'member'],
      ),
    ).rejects.toThrow();
    await expect(runner.query('DELETE FROM "user" WHERE id = ?', [1])).rejects.toThrow();
    expect(await snapshot(runner)).toEqual(before);
  });

  it('stops before any DDL and reports counts without identifiers when legacy data is dirty', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(LEGACY_MEMBERSHIP);
    await runner.query('INSERT INTO "user" ("userId","email","password") VALUES (?,?,?)', [
      'dup',
      'dup@example.invalid',
      'hash',
    ]);
    await runner.query('INSERT INTO "user" ("userId","email","password") VALUES (?,?,?)', [
      'dup',
      'other@example.invalid',
      'hash',
    ]);
    await runner.query(
      'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
      [1, 1, 'admin'],
    );
    await runner.query(
      'INSERT INTO enterprise_membership (userId, organizationId, role) VALUES (?,?,?)',
      [4242, 1, 'member'],
    );
    const before = await snapshot(runner);

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/Account integrity preflight stopped before DDL/);
    expect(failure?.message).toMatch(/duplicateUserId=1/);
    expect(failure?.message).toMatch(/orphanMembership=1/);
    expect(failure?.message).not.toMatch(/@/);
    expect(failure?.message).not.toMatch(/4242/);

    const userTable = await inspect('user');
    const membershipTable = await inspect('enterprise_membership');
    expect(
      (userTable?.indices ?? []).filter(index => String(index.name).startsWith('UQ_user')),
    ).toEqual([]);
    expect(membershipTable?.foreignKeys).toEqual([]);
    expect(await snapshot(runner)).toEqual(before);
  });

  it('fails closed on NULL userId/email before adding any DDL', async () => {
    await open();
    await runner.query(
      'CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" varchar(255), "email" varchar(255))',
    );
    await runner.query('INSERT INTO "user" ("userId","email") VALUES (?,?)', [
      null,
      'null@example.invalid',
    ]);

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/nullUserId=1/);
    expect((await inspect('user'))?.indices).toEqual([]);
  });

  it('fails closed when an existing user table is only partially created', async () => {
    await open();
    await runner.query(
      'CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" varchar(255) NOT NULL)',
    );

    await expect(migration.up(runner)).rejects.toThrow(/missing the email column/);
    expect((await inspect('user'))?.indices).toEqual([]);
  });

  it('fails closed when the membership key type does not match user.id', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(
      'CREATE TABLE "enterprise_membership" ("userId" varchar(255) PRIMARY KEY NOT NULL, "organizationId" integer NOT NULL, "role" varchar(16) NOT NULL, "team" varchar(100) NOT NULL DEFAULT \'\')',
    );

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/idTypeMismatch=1/);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([]);
  });

  it('skips a fresh database so the synchronize baseline owns the constraints', async () => {
    const fresh = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [User, EnterpriseMembership],
    }).initialize();
    try {
      const freshRunner = fresh.createQueryRunner();
      await expect(migration.up(freshRunner)).resolves.toBeUndefined();
      expect(await freshRunner.hasTable('user')).toBe(false);
      await freshRunner.release();

      await fresh.synchronize();
      const reader = fresh.createQueryRunner();
      const userTable = await reader.getTable('user');
      const membershipTable = await reader.getTable('enterprise_membership');
      await reader.release();
      expect((userTable?.indices ?? []).map(index => index.name)).toEqual(
        expect.arrayContaining(['UQ_user_userId', 'UQ_user_email']),
      );
      expect(membershipTable?.foreignKeys).toHaveLength(1);
      expect(membershipTable?.foreignKeys[0]).toMatchObject({
        name: 'FK_enterprise_membership_user',
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      });

      await expect(
        fresh
          .getRepository(User)
          .save({ userId: 'fresh', email: 'fresh@example.invalid', password: 'hash' }),
      ).resolves.toBeDefined();
      await expect(
        fresh
          .getRepository(User)
          .save({ userId: 'fresh', email: 'other@example.invalid', password: 'hash' }),
      ).rejects.toThrow();
      await expect(
        fresh
          .getRepository(EnterpriseMembership)
          .save({ userId: 777, organizationId: 1, role: 'admin', team: '' }),
      ).rejects.toThrow();
      const user = await fresh.getRepository(User).findOneByOrFail({ userId: 'fresh' });
      await fresh
        .getRepository(EnterpriseMembership)
        .save({ userId: user.id, organizationId: 1, role: 'admin', team: '' });
      await expect(fresh.getRepository(User).delete({ id: user.id })).rejects.toThrow();
    } finally {
      await fresh.destroy();
    }
  });

  it('refuses the destructive rollback so live constraints cannot be dropped silently', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(LEGACY_MEMBERSHIP);
    await migration.up(runner);

    await expect(migration.down()).rejects.toThrow(/backup plan/);
    expect((await inspect('user'))?.indices.map(index => index.name)).toEqual(
      expect.arrayContaining(['UQ_user_userId', 'UQ_user_email']),
    );
    expect((await inspect('enterprise_membership'))?.foreignKeys).toHaveLength(1);
  });

  it('fails closed when a same-named unique index has the wrong definition', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(LEGACY_MEMBERSHIP);
    await runner.query('CREATE INDEX "UQ_user_userId" ON "user" ("userId")');

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/indexDefinitionDrift=1/);
    const existing = (await inspect('user'))?.indices.find(
      index => index.name === 'UQ_user_userId',
    );
    expect(existing?.isUnique).toBe(false);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([]);
  });

  it('fails closed when a same-named foreign key links the wrong reference or action', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(
      'CREATE TABLE "enterprise_membership" ("userId" integer PRIMARY KEY NOT NULL, "organizationId" integer NOT NULL, "role" varchar(16) NOT NULL, "team" varchar(100) NOT NULL DEFAULT \'\', CONSTRAINT "FK_enterprise_membership_user" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE)',
    );

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/foreignKeyDefinitionDrift=1/);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([
      expect.objectContaining({ name: 'FK_enterprise_membership_user', onDelete: 'CASCADE' }),
    ]);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
  });

  it('fails closed when the membership table exists without its userId column', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query('CREATE TABLE "enterprise_membership" ("rowKey" integer PRIMARY KEY)');

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/membershipUserColumnMissing=1/);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
  });

  it('fails closed when user.id is not the primary key', async () => {
    await open();
    await runner.query(
      'CREATE TABLE "user" ("rowKey" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "id" integer NOT NULL, "userId" varchar(255) NOT NULL, "email" varchar(255) NOT NULL)',
    );
    await runner.query(LEGACY_MEMBERSHIP);

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/referencedIdNotCanonicalKey=1/);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
  });

  it('fails closed when the membership userId is not the primary key', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(
      'CREATE TABLE "enterprise_membership" ("rowKey" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "userId" integer NOT NULL, "organizationId" integer NOT NULL, "role" varchar(16) NOT NULL, "team" varchar(100) NOT NULL DEFAULT \'\')',
    );

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/membershipKeyNotCanonicalKey=1/);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([]);
  });

  it('fails closed when user.id is only part of a composite primary key', async () => {
    await open();
    await runner.query(
      'CREATE TABLE "user" ("id" integer NOT NULL, "other" integer NOT NULL, "userId" varchar(255) NOT NULL, "email" varchar(255) NOT NULL, PRIMARY KEY ("id", "other"))',
    );
    await runner.query(LEGACY_MEMBERSHIP);

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/referencedIdNotCanonicalKey=1/);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([]);
  });

  it('fails closed when the membership key is a composite primary key', async () => {
    await open();
    await runner.query(LEGACY_USER);
    await runner.query(
      'CREATE TABLE "enterprise_membership" ("userId" integer NOT NULL, "organizationId" integer NOT NULL, "role" varchar(16) NOT NULL, "team" varchar(100) NOT NULL DEFAULT \'\', PRIMARY KEY ("userId", "organizationId"))',
    );

    const failure = await capture(migration.up(runner));

    expect(failure?.message).toMatch(/membershipKeyNotCanonicalKey=1/);
    expect(
      ((await inspect('user'))?.indices ?? []).filter(index =>
        String(index.name).startsWith('UQ_user'),
      ),
    ).toEqual([]);
    expect((await inspect('enterprise_membership'))?.foreignKeys).toEqual([]);
  });
});

describe('engineProblem', () => {
  it('skips SQLite and requires a known InnoDB engine on MySQL/MariaDB', () => {
    expect([
      engineProblem('sqlite', undefined, false),
      engineProblem('sqlite', 'MyISAM', true),
      engineProblem('mysql', 'InnoDB', true),
      engineProblem('mariadb', ' innodb ', true),
      engineProblem('mysql', 'MyISAM', true),
      engineProblem('mariadb', 'Aria', true),
      engineProblem('mysql', undefined, false),
      engineProblem('mariadb', '', true),
    ]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      'unsupportedEngine',
      'unsupportedEngine',
      'engineUnknown',
      'engineUnknown',
    ]);
  });
});
