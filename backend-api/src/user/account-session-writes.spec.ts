import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { LoginService } from '../login/login.service';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserMapping } from './entities/user-mapping.entity';
import { EnterpriseMembership } from '../enterprise/entities/enterprise-membership.entity';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { serializeMetadataWork } from '../common/metadata-work';
import { hashPassword } from '../utils/password.util';

const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const metadataSource = () =>
  new DataSource({
    type: 'sqlite',
    database: ':memory:',
    synchronize: true,
    entities: [User, UserMapping, EnterpriseMembership, RefreshToken],
  });

describe('UC051 account and signup metadata coordination (real SQLite)', () => {
  let db: DataSource;
  let service: UserService;

  beforeEach(async () => {
    db = await metadataSource().initialize();
    await db.getRepository(User).save({
      id: 1,
      userId: 'unitactor',
      email: 'old@example.invalid',
      password: hashPassword('unit-password'),
      active: true,
      authVersion: 0,
    });
    const auth = new AuthService(
      new JwtService(),
      db.getRepository(User),
      db.getRepository(RefreshToken),
    );
    service = new UserService(db.getRepository(User), db.getRepository(UserMapping), auth);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await db.destroy();
  });

  it('does not let a held rollback absorb an acknowledged account change', async () => {
    const users = db.getRepository(User);
    const originalTransaction = db.manager.transaction.bind(db.manager);
    const writeEntered = gate();
    const writeRelease = gate();
    const holdEntered = gate();
    const holdRelease = gate();
    (jest.spyOn(db.manager, 'transaction') as any).mockImplementation(run =>
      originalTransaction(async manager => {
        const update = manager.update.bind(manager);
        (manager as any).update = async (entity, criteria, changes) => {
          if (entity === User) {
            writeEntered.resolve();
            await writeRelease.promise;
          }
          return update(entity, criteria, changes);
        };
        return run(manager);
      }),
    );

    let updateSettled = false;
    const update = service
      .updateUserInfo('unitactor', {
        password: 'unit-password',
        email: 'new@example.invalid',
        new_password: 'next-password',
      } as any)
      .then(value => {
        updateSettled = true;
        return value;
      });
    await writeEntered.promise;

    const held = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(User, 1, { email: 'provisional@example.invalid' });
        holdEntered.resolve();
        await holdRelease.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);

    let heldEnteredEarly = false;
    const holdClaim = holdEntered.promise.then(() => {
      heldEnteredEarly = true;
    });
    let heldEarly: boolean;
    try {
      await Promise.race([holdClaim, delay(150)]);
      // Snapshot before releasing the write so the later claim cannot mutate the observation.
      heldEarly = heldEnteredEarly;
    } finally {
      writeRelease.resolve();
      await update;
      holdRelease.resolve();
      await held;
    }

    expect({ heldEarly, updateSettled }).toEqual({ heldEarly: false, updateSettled: true });
    expect((await users.findOneByOrFail({ id: 1 })).email).toBe('new@example.invalid');
  });

  it('keeps an organization member account undeletable with its external 409 response', async () => {
    await db
      .getRepository(EnterpriseMembership)
      .save({ userId: 1, organizationId: 1, role: 'admin', team: '' });

    await expect(service.deleteUser('unitactor', 'unit-password')).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('deletes a standalone account and keeps a wrong password unauthorized without a delete', async () => {
    await expect(service.deleteUser('unitactor', 'unit-password')).resolves.toBe('success');
    expect(await db.getRepository(User).count()).toBe(0);

    await db.getRepository(User).save({
      id: 2,
      userId: 'second',
      email: 'second@example.invalid',
      password: hashPassword('second-password'),
      active: true,
      authVersion: 0,
    });
    await expect(service.deleteUser('second', 'wrong-password')).resolves.toBe('Unauthorized');
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('reissues from the committed account row instead of an open rollback', async () => {
    const previous = process.env.ACCESS_SECRET;
    process.env.ACCESS_SECRET = 'unit-access-synthetic';
    const entered = gate();
    const release = gate();
    const held = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(User, 1, { active: false });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;

    let done = false;
    const reissue = service.reissuanceAccessToken('unitactor', 0).then(token => {
      done = true;
      return token;
    });
    let early: boolean;
    try {
      await delay(150);
      early = done;
    } finally {
      release.resolve();
      await held;
    }
    const token = await reissue;
    try {
      expect(early).toBe(false);
      expect(
        (await new JwtService().verify(token, { secret: 'unit-access-synthetic' })).accessKeyData,
      ).toMatchObject({ id: 1, authVersion: 0 });
    } finally {
      if (previous === undefined) delete process.env.ACCESS_SECRET;
      else process.env.ACCESS_SECRET = previous;
    }
  });

  describe('LoginService.signup', () => {
    const loginFor = (sample: any) =>
      new LoginService(
        new AuthService(new JwtService(), db.getRepository(User), db.getRepository(RefreshToken)),
        db.getRepository(User),
        db.getRepository(RefreshToken),
        sample,
      );

    it('commits the account before launching sample provisioning outside the signup lease', async () => {
      const observed: { id: number | null; reenteredLease: boolean | null } = {
        id: null,
        reenteredLease: null,
      };
      const sample = {
        provisionForUser: jest.fn(async (id: number) => {
          observed.id = id;
          // Re-enters synchronously only when the caller is still inside the signup metadata lease.
          let entered = false;
          const probe = serializeMetadataWork(db, async () => {
            entered = true;
          });
          observed.reenteredLease = entered;
          await probe;
        }),
      };

      await expect(
        loginFor(sample).signup({
          userId: 'newcomer',
          email: 'newcomer@example.invalid',
          password: 'unit-password',
        } as any),
      ).resolves.toBe('success');

      const created = await db.getRepository(User).findOneByOrFail({ userId: 'newcomer' });
      expect(observed).toEqual({ id: created.id, reenteredLease: false });
      expect(created.password.startsWith('s2:')).toBe(true);
    });

    it('keeps the signup when sample provisioning rejects', async () => {
      const sample = { provisionForUser: jest.fn().mockRejectedValue(new Error('sample boom')) };

      await expect(
        loginFor(sample).signup({
          userId: 'resilient',
          email: 'resilient@example.invalid',
          password: 'unit-password',
        } as any),
      ).resolves.toBe('success');
      await delay(0);

      expect(await db.getRepository(User).findOneBy({ userId: 'resilient' })).toBeTruthy();
    });

    it.each([
      [{ userId: 'unitactor', email: 'unique@example.invalid', password: 'unit-password' }, 409],
      [{ userId: 'unique', email: 'old@example.invalid', password: 'unit-password' }, 409],
    ])('rejects a duplicate signup %# with the existing conflict response', async (dto, status) => {
      await expect(
        loginFor({ provisionForUser: jest.fn() }).signup(dto as any),
      ).rejects.toMatchObject({ status });
      expect(await db.getRepository(User).count()).toBe(1);
    });

    it('serializes concurrent duplicate signups so exactly one account is created', async () => {
      const service = loginFor({ provisionForUser: jest.fn() });
      const dto = {
        userId: 'racer',
        email: 'racer@example.invalid',
        password: 'unit-password',
      } as any;

      const results = await Promise.allSettled([service.signup(dto), service.signup(dto)]);

      expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
      expect(await db.getRepository(User).count({ where: { userId: 'racer' } })).toBe(1);
    });
  });
});
