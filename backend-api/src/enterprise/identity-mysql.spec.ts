import { createHash } from 'crypto';
import * as fs from 'fs';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/entities/user.entity';
import { UserMapping } from '../user/entities/user-mapping.entity';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';
import { LoginService } from '../login/login.service';
import { EnterpriseService } from './enterprise.service';
import { EnterpriseMembership } from './entities/enterprise-membership.entity';
import { EnterpriseOrganization } from './entities/enterprise-organization.entity';
import { EnterpriseEnrollment } from './entities/enterprise-enrollment.entity';
import { EnterpriseAuditEvent } from './entities/enterprise-audit-event.entity';
import { hashPassword } from '../utils/password.util';
import { AddAccountIntegrity1792430000000 } from '../migrations/1792430000000-add-account-integrity';
const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
// Only an explicitly configured, isolated local test database can run destructive fixture setup.
const suite = process.env.VM_QA_MYSQL_CONFIG ? describe : describe.skip;
suite('UC051 isolated local MySQL identity integrity', () => {
  jest.setTimeout(15000);
  let db: DataSource,
    users: UserService,
    enterprise: EnterpriseService,
    login: LoginService,
    auth: AuthService;
  beforeAll(async () => {
    const config = JSON.parse(fs.readFileSync(process.env.VM_QA_MYSQL_CONFIG, 'utf8'));
    if (
      config.host !== '127.0.0.1' ||
      !/^vm_identity_[a-f0-9]{8,32}$/.test(config.database) ||
      !config.serverUuid
    )
      throw new Error('An owned local MySQL fixture configuration is required.');
    db = await new DataSource({
      type: 'mysql',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      timezone: 'Z',
      logging: false,
      entities: [
        User,
        UserMapping,
        RefreshToken,
        EnterpriseMembership,
        EnterpriseOrganization,
        EnterpriseEnrollment,
        EnterpriseAuditEvent,
      ],
      extra: { connectionLimit: 8 },
    }).initialize();
    const [server] = await db.query('SELECT @@server_uuid AS uuid, DATABASE() AS db');
    if (server.uuid !== config.serverUuid || server.db !== config.database)
      throw new Error('Unexpected MySQL fixture identity.');
    auth = new AuthService(
      new JwtService(),
      db.getRepository(User),
      db.getRepository(RefreshToken),
    );
    users = new UserService(db.getRepository(User), db.getRepository(UserMapping), auth);
    enterprise = new EnterpriseService(db);
    login = new LoginService(auth, db.getRepository(User), db.getRepository(RefreshToken), {
      provisionForUser: async () => undefined,
    } as any);
  });
  beforeEach(async () => {
    await db.synchronize(true);
    await db.getRepository(User).save(
      [1, 2].map(id => ({
        id,
        userId: 'actor-' + id,
        email: 'actor-' + id + '@example.invalid',
        password: hashPassword('unit-password'),
        active: true,
        authVersion: 0,
      })),
    );
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  const setup = async () => {
    const organization = (await enterprise.create(1, { name: 'Synthetic organization' }))
      .organization;
    const enrollment = await enterprise.enrollment(2, { organizationId: organization.id });
    return {
      userId: 'actor-2',
      role: 'member',
      team: 'Operations',
      expectedVersion: organization.version,
      enrollmentCode: enrollment.enrollmentCode,
    };
  };
  it.each([
    {
      field: 'userId',
      dtos: [
        { userId: 'racer', email: 'race-a@example.invalid' },
        { userId: 'racer', email: 'race-b@example.invalid' },
      ],
    },
    {
      field: 'email',
      dtos: [
        { userId: 'racer-a', email: 'race@example.invalid' },
        { userId: 'racer-b', email: 'race@example.invalid' },
      ],
    },
  ])('creates one account and returns409 for concurrent duplicate $field', async test => {
    const results = await Promise.allSettled(
      test.dtos.map(dto => login.signup({ ...dto, password: 'unit-password' })),
    );
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason.status).toBe(409);
    expect(rejected.reason.message).toBe('conflict ' + test.field);
    expect(await db.getRepository(User).count()).toBe(3);
  });
  it('preserves both accounts and credentials when a profile email collides', async () => {
    const before = await db.getRepository(User).find({ order: { id: 'ASC' } });
    await expect(
      users.updateUserInfo('actor-1', {
        password: 'unit-password',
        new_password: 'changed-password',
        email: 'actor-2@example.invalid',
      }),
    ).rejects.toMatchObject({ status: 409 });
    const after = await db.getRepository(User).find({ order: { id: 'ASC' } });
    expect(
      after.map(user => ({
        id: user.id,
        email: user.email,
        password: user.password,
        active: user.active,
        epoch: user.authVersion,
      })),
    ).toEqual(
      before.map(user => ({
        id: user.id,
        email: user.email,
        password: user.password,
        active: user.active,
        epoch: user.authVersion,
      })),
    );
  });
  it('holds the target account lock until enrollment commits and then denies deletion with409', async () => {
    const body = await setup(),
      locked = gate(),
      resume = gate();
    const original = db.transaction.bind(db);
    (jest.spyOn(db, 'transaction') as any).mockImplementation(run =>
      original(async manager => {
        const findOne = manager.findOne.bind(manager);
        (manager as any).findOne = async (entity, options) => {
          const result = await findOne(entity, options);
          if (
            entity === User &&
            options?.where?.id === 2 &&
            options.lock?.mode === 'pessimistic_write'
          ) {
            locked.resolve();
            await resume.promise;
          }
          return result;
        };
        return run(manager);
      }),
    );
    const joining = enterprise.add(1, body);
    const joined = joining.catch(error => error);
    await locked.promise;
    let completed = false;
    const deleting = users.deleteUser('actor-2', 'unit-password').then(
      value => {
        completed = true;
        return value;
      },
      error => {
        completed = true;
        return error.status;
      },
    );
    let early: boolean;
    try {
      await new Promise(resolve => setTimeout(resolve, 200));
      early = completed;
    } finally {
      resume.resolve();
      await joined;
    }
    expect(early).toBe(false);
    expect(await deleting).toBe(409);
    expect((await joining).member.id).toBe(2);
    expect(await db.getRepository(User).count({ where: { id: 2 } })).toBe(1);
    expect(await db.getRepository(EnterpriseMembership).count({ where: { userId: 2 } })).toBe(1);
  });
  it('does not undo employee revocation when an older login rehash finishes late', async () => {
    const body = await setup();
    await enterprise.add(1, body);
    const repository = db.getRepository(User);
    await repository.update(2, {
      password: createHash('sha512').update('unit-password').digest('hex'),
    });
    const entered = gate(),
      resume = gate();
    const originalSave = repository.save.bind(repository),
      originalUpdate = repository.update.bind(repository);
    (jest.spyOn(repository, 'save') as any).mockImplementation(async row => {
      entered.resolve();
      await resume.promise;
      return originalSave(row);
    });
    (jest.spyOn(repository, 'update') as any).mockImplementation(async (criteria, changes) => {
      if (changes.password) {
        entered.resolve();
        await resume.promise;
      }
      return originalUpdate(criteria, changes);
    });
    const signing = auth.validateUser('actor-2', 'unit-password');
    await entered.promise;
    try {
      await enterprise.update(1, 2, {
        team: 'Operations',
        role: 'member',
        active: false,
        expectedVersion: 2,
      });
    } finally {
      resume.resolve();
    }
    const result = await signing;
    const current = await repository.findOneByOrFail({ id: 2 });
    expect({
      accepted: result !== null,
      active: current.active,
      epoch: current.authVersion,
      jwtId: current.jwtId,
    }).toEqual({ accepted: false, active: false, epoch: 1, jwtId: null });
  });
  const legacyConstraints = async () => {
    const runner = db.createQueryRunner();
    const membership = await runner.getTable('enterprise_membership');
    for (const fk of membership.foreignKeys.filter(key => key.referencedTableName === 'user'))
      await runner.dropForeignKey(membership, fk);
    const user = await runner.getTable('user');
    for (const index of user.indices.filter(
      index => index.name === 'UQ_user_userId' || index.name === 'UQ_user_email',
    ))
      await runner.dropIndex(user, index);
    return runner;
  };
  const integrityMigration = () => {
    return new AddAccountIntegrity1792430000000();
  };
  it('upgrades legacy MySQL constraints twice without changing accounts and rejects raw violations', async () => {
    const runner = await legacyConstraints();
    try {
      const migration = integrityMigration();
      await migration.up(runner);
      await migration.up(runner);
      const table = await runner.getTable('user');
      expect(
        table.indices
          .filter(index => ['UQ_user_userId', 'UQ_user_email'].includes(index.name))
          .map(index => index.name)
          .sort(),
      ).toEqual(['UQ_user_email', 'UQ_user_userId']);
      expect(
        (await runner.getTable('enterprise_membership')).foreignKeys.filter(
          key => key.referencedTableName === 'user',
        ),
      ).toHaveLength(1);
      await expect(
        db
          .getRepository(User)
          .insert({ userId: 'actor-1', email: 'duplicate@example.invalid', password: 'synthetic' }),
      ).rejects.toMatchObject({ driverError: { code: 'ER_DUP_ENTRY' } });
      await expect(
        db
          .getRepository(EnterpriseMembership)
          .insert({ userId: 999, organizationId: 1, role: 'member', team: '' }),
      ).rejects.toMatchObject({ driverError: { code: 'ER_NO_REFERENCED_ROW_2' } });
      await enterprise.create(1, { name: 'Synthetic organization' });
      await expect(db.getRepository(User).delete(1)).rejects.toMatchObject({
        driverError: { code: 'ER_ROW_IS_REFERENCED_2' },
      });
      expect(await db.getRepository(User).count()).toBe(2);
    } finally {
      await runner.release();
    }
  });
  it.each(['duplicate', 'orphan'])(
    'refuses legacy %s data before adding constraints or changing data',
    async mode => {
      const runner = await legacyConstraints();
      try {
        if (mode === 'duplicate')
          await db
            .getRepository(User)
            .insert({ userId: 'actor-1', email: 'legacy@example.invalid', password: 'synthetic' });
        else
          await db
            .getRepository(EnterpriseMembership)
            .insert({ userId: 999, organizationId: 1, role: 'member', team: '' });
        const counts = {
          users: await db.getRepository(User).count(),
          members: await db.getRepository(EnterpriseMembership).count(),
        };
        await expect(integrityMigration().up(runner)).rejects.toThrow();
        expect(
          (await runner.getTable('user')).indices.filter(index =>
            ['UQ_user_userId', 'UQ_user_email'].includes(index.name),
          ),
        ).toHaveLength(0);
        expect((await runner.getTable('enterprise_membership')).foreignKeys).toHaveLength(0);
        expect({
          users: await db.getRepository(User).count(),
          members: await db.getRepository(EnterpriseMembership).count(),
        }).toEqual(counts);
      } finally {
        await runner.release();
      }
    },
  );
  it('returns a recoverable rejection when deletion wins after the enrollment target was read', async () => {
    const body = await setup(),
      read = gate(),
      resume = gate();
    const original = db.transaction.bind(db);
    (jest.spyOn(db, 'transaction') as any).mockImplementation(run =>
      original(async manager => {
        const find = manager.find.bind(manager);
        (manager as any).find = async (entity, options) => {
          const result = await find(entity, options);
          if (entity === User && options?.where?.userId === 'actor-2') {
            read.resolve();
            await resume.promise;
          }
          return result;
        };
        return run(manager);
      }),
    );
    const joining = enterprise.add(1, body).then(
      () => 200,
      error => error.status,
    );
    await read.promise;
    let removed: string;
    try {
      removed = await users.deleteUser('actor-2', 'unit-password');
    } finally {
      resume.resolve();
    }
    const status = await joining;
    expect({
      removed,
      joinStatus: status,
      memberships: await db.getRepository(EnterpriseMembership).count({ where: { userId: 2 } }),
      organizationVersion: (
        await db.getRepository(EnterpriseOrganization).findOneByOrFail({ id: 1 })
      ).version,
      audits: await db.getRepository(EnterpriseAuditEvent).count(),
    }).toEqual({
      removed: 'success',
      joinStatus: 400,
      memberships: 0,
      organizationVersion: 1,
      audits: 1,
    });
  });
});
