import { HttpException } from '@nestjs/common';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { User } from '../user/entities/user.entity';
import { hashPassword } from '../utils/password.util';
import { LoginService } from './login.service';
import { AccessService } from '../access/access.service';

const SECRET_PARAMETER = 'synthetic-secret-parameter';
const CONFLICT_EMAIL = 'conflict email';
const CONFLICT_USER_ID = 'conflict userId';

/** Row used once to prove the synchronized schema enforces the identity unique indices. */
const USER_ID_PROBE = {
  userId: 'schema-probe',
  email: 'schema-probe@example.invalid',
  password: 'synthetic-probe-hash',
};

/** mysql2 / MySQL 8 shape for a lost uniqueness race on INSERT inside the signup metadata scope. */
const mysqlDuplicateEntry = () =>
  new QueryFailedError(
    'INSERT INTO `user`(`userId`, `email`, `password`, `jwtId`) VALUES (?, ?, ?, ?)',
    [SECRET_PARAMETER, SECRET_PARAMETER, SECRET_PARAMETER, null],
    Object.assign(new Error(`Duplicate entry '${SECRET_PARAMETER}' for key 'user.IDX_identity'`), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    }),
  );

/** sqlite3 shape for a constraint failure; UNIQUE and FOREIGN KEY share the SQLITE_CONSTRAINT code. */
const sqliteConstraint = (message: string) =>
  new QueryFailedError(
    'insert into "user" ("userId", "email") values (?, ?)',
    [SECRET_PARAMETER, SECRET_PARAMETER],
    Object.assign(new Error(`SQLITE_CONSTRAINT: ${message}`), { code: 'SQLITE_CONSTRAINT' }),
  );

describe('LoginService.signup identity conflicts (real SQLite constraints)', () => {
  let db: DataSource;
  let users: Repository<User>;
  let sample: { provisionForUser: jest.Mock };

  const loginFor = () =>
    new LoginService(
      {} as any,
      users,
      db.getRepository(RefreshToken),
      sample as any,
      new AccessService(),
    );

  const seed = (props: Partial<User>) =>
    users.insert({
      userId: 'seeded',
      email: 'seeded@example.invalid',
      password: hashPassword('unit-password'),
      ...props,
    });

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, RefreshToken],
    }).initialize();
    // The identity uniqueness comes from the User entity indices, never from this spec's own DDL:
    // prove the synchronized schema really rejects duplicates instead of trusting the metadata.
    await db.getRepository(User).insert(USER_ID_PROBE);
    await expect(db.getRepository(User).insert(USER_ID_PROBE)).rejects.toThrow(
      /UNIQUE constraint failed/,
    );
  });

  afterAll(async () => {
    await db?.destroy();
  });

  beforeEach(async () => {
    users = db.getRepository(User);
    sample = { provisionForUser: jest.fn() };
    await users.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a duplicate email found by the precheck with the existing conflict response', async () => {
    await seed({ userId: 'owner', email: 'taken@example.invalid' });

    await expect(
      loginFor().signup({
        userId: 'newcomer',
        email: 'taken@example.invalid',
        password: 'unit-password',
      } as any),
    ).rejects.toMatchObject({ status: 409, message: CONFLICT_EMAIL });

    expect(await users.count()).toBe(1);
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });

  it('rejects a duplicate userId found by the precheck with the existing conflict response', async () => {
    await seed({ userId: 'taken', email: 'owner@example.invalid' });

    await expect(
      loginFor().signup({
        userId: 'taken',
        email: 'newcomer@example.invalid',
        password: 'unit-password',
      } as any),
    ).rejects.toMatchObject({ status: 409, message: CONFLICT_USER_ID });

    expect(await users.count()).toBe(1);
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });

  /**
   * Lets the competing signup commit strictly after both prechecks read "no row", so the only
   * defense left is the unique index firing on our own insert.
   */
  const commitCompetingSignupAfterPrechecks = (winner: Partial<User>) => {
    const realFindOne = users.findOne.bind(users);
    let calls = 0;
    jest.spyOn(users, 'findOne').mockImplementation(async (options: any) => {
      calls += 1;
      if (calls <= 2) {
        if (calls === 2) await seed(winner);
        return null;
      }
      return realFindOne(options);
    });
  };

  it.each([
    [
      'email',
      { userId: 'winner', email: 'racer@example.invalid' },
      { userId: 'racer', email: 'racer@example.invalid' },
      CONFLICT_EMAIL,
    ],
    [
      'userId',
      { userId: 'racer', email: 'winner@example.invalid' },
      { userId: 'racer', email: 'racer@example.invalid' },
      CONFLICT_USER_ID,
    ],
  ])(
    'maps a lost %s race at insert to the existing conflict response',
    async (field, winner, dto, message) => {
      commitCompetingSignupAfterPrechecks(winner as Partial<User>);

      await expect(loginFor().signup(dto as any)).rejects.toMatchObject({ status: 409, message });

      // The competing signup is the only persisted row: the losing insert wrote nothing.
      expect(await users.count()).toBe(1);
      expect(await users.count({ where: { [field]: (dto as any)[field] } as any })).toBe(1);
      expect(sample.provisionForUser).not.toHaveBeenCalled();
    },
  );

  it('keeps the connection usable for the next signup after a lost race', async () => {
    commitCompetingSignupAfterPrechecks({ userId: 'racer', email: 'winner@example.invalid' });

    await expect(
      loginFor().signup({
        userId: 'racer',
        email: 'x@example.invalid',
        password: 'unit-password',
      } as any),
    ).rejects.toMatchObject({ status: 409 });

    jest.restoreAllMocks();
    await expect(
      loginFor().signup({
        userId: 'survivor',
        email: 'survivor@example.invalid',
        password: 'unit-password',
      } as any),
    ).resolves.toBe('success');
    expect(await users.count({ where: { userId: 'survivor' } })).toBe(1);
    expect(sample.provisionForUser).toHaveBeenCalledTimes(1);
  });

  it('propagates a non-unique SQLite constraint instead of reporting an identity conflict', async () => {
    const foreignKey = sqliteConstraint('FOREIGN KEY constraint failed');
    jest.spyOn(users, 'save').mockImplementation(async () => {
      throw foreignKey;
    });

    await expect(
      loginFor().signup({
        userId: 'orphan',
        email: 'orphan@example.invalid',
        password: 'unit-password',
      } as any),
    ).rejects.toBe(foreignKey);
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });
});

describe('LoginService.signup identity conflicts (MySQL duplicate-entry race)', () => {
  const dto = { userId: 'racer', email: 'racer@example.invalid', password: 'unit-password' };
  const sampleFor = () => ({ provisionForUser: jest.fn() });

  const racingRepository = (winner: { email?: string; userId?: string }) => {
    let racing = true;
    return {
      findOne: jest.fn(async ({ where }: any) => {
        if (racing) return null;
        if (winner.email && where.email === winner.email) return { id: 7, email: winner.email };
        if (winner.userId && where.userId === winner.userId)
          return { id: 7, userId: winner.userId };
        return null;
      }),
      save: jest.fn(async () => {
        racing = false;
        throw mysqlDuplicateEntry();
      }),
      manager: { connection: { options: { type: 'mysql' } } },
    };
  };

  const serviceFor = (repository: any, sample: any) =>
    new LoginService({} as any, repository, {} as any, sample, new AccessService());

  it('maps an email duplicate-entry failure to the email conflict without leaking SQL or parameters', async () => {
    const repository = racingRepository({ email: dto.email });
    const sample = sampleFor();

    const error = await serviceFor(repository, sample)
      .signup(dto as any)
      .catch(thrown => thrown);

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(409);
    expect(error.message).toBe(CONFLICT_EMAIL);
    const body = JSON.stringify(error.getResponse());
    expect(body).toContain(CONFLICT_EMAIL);
    expect(body).not.toContain(SECRET_PARAMETER);
    expect(body).not.toContain('INSERT INTO');
    expect(body).not.toContain('Duplicate entry');
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });

  it('maps a userId duplicate-entry failure to the userId conflict', async () => {
    const repository = racingRepository({ userId: dto.userId });
    const sample = sampleFor();

    await expect(serviceFor(repository, sample).signup(dto as any)).rejects.toMatchObject({
      status: 409,
      message: CONFLICT_USER_ID,
    });
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });

  it('keeps the email-first precedence when both identities lost the race', async () => {
    const repository = racingRepository({ email: dto.email, userId: dto.userId });

    await expect(serviceFor(repository, sampleFor()).signup(dto as any)).rejects.toMatchObject({
      status: 409,
      message: CONFLICT_EMAIL,
    });
  });

  it('propagates an unrelated MySQL failure without a reread', async () => {
    const deadlock = Object.assign(new Error('Deadlock found when trying to get lock'), {
      code: 'ER_LOCK_DEADLOCK',
      errno: 1213,
    });
    const repository = racingRepository({ userId: dto.userId });
    repository.save.mockImplementation(async () => {
      throw deadlock;
    });

    await expect(serviceFor(repository, sampleFor()).signup(dto as any)).rejects.toBe(deadlock);
    expect(repository.findOne).toHaveBeenCalledTimes(2);
  });

  it('propagates a unique violation that no identity field explains', async () => {
    const repository = racingRepository({});
    const sample = sampleFor();

    await expect(serviceFor(repository, sample).signup(dto as any)).rejects.toBeInstanceOf(
      QueryFailedError,
    );
    expect(repository.findOne).toHaveBeenCalledTimes(4);
    expect(sample.provisionForUser).not.toHaveBeenCalled();
  });

  it('launches exactly one sample provisioning for the successful signup', async () => {
    const sample = sampleFor();
    const repository = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async () => ({ id: 11 })),
      manager: { connection: { options: { type: 'mysql' } } },
    };

    await expect(serviceFor(repository, sample).signup(dto as any)).resolves.toBe('success');
    expect(sample.provisionForUser).toHaveBeenCalledTimes(1);
    expect(sample.provisionForUser).toHaveBeenCalledWith(11);
  });
});
