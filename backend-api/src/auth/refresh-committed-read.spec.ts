import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { serializeMetadataWork } from '../common/metadata-work';

const gate = () => {
  let resolve: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
};

describe('UC051 committed refresh authentication metadata', () => {
  let db: DataSource;
  let service: AuthService;
  const account = { id: 7, userId: 'unitactor', email: 'unit@example.invalid' };
  const previousSecret = process.env.REFRESH_SECRET;

  beforeEach(async () => {
    process.env.REFRESH_SECRET = 'sqlite-refresh-committed-synthetic';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, RefreshToken],
    }).initialize();
    await db.getRepository(User).save({
      ...account,
      password: 'hash',
      active: true,
      authVersion: 0,
      jwtId: 31,
    });
    service = new AuthService(
      new JwtService(),
      db.getRepository(User),
      db.getRepository(RefreshToken),
    );
  });

  afterEach(async () => {
    await db.destroy();
    if (previousSecret === undefined) delete process.env.REFRESH_SECRET;
    else process.env.REFRESH_SECRET = previousSecret;
  });

  it('waits for a held account write and authenticates the committed actor after it rolls back', async () => {
    const raw = await service.generateRefreshToken({ ...account, authVersion: 0 });
    await db.getRepository(RefreshToken).save({ id: 31, refreshToken: raw });

    const entered = gate();
    const release = gate();
    const holding = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(User, 7, { active: false, authVersion: 1 });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;

    let completed = 0;
    const refresh = service.verifyRefreshToken(raw).then(
      value => {
        completed++;
        return value;
      },
      error => {
        completed++;
        return error;
      },
    );
    let early: number;
    try {
      await Promise.race([refresh, new Promise(resolve => setTimeout(resolve, 150))]);
      early = completed;
    } finally {
      release.resolve();
      await holding;
    }

    expect(early).toBe(0);
    expect((await refresh).refreshKeyData).toMatchObject({
      id: 7,
      userId: 'unitactor',
      authVersion: 0,
      jwtId: 31,
    });
  });

  it('waits for a held session-store write and accepts the committed token after it rolls back', async () => {
    const raw = await service.generateRefreshToken({ ...account, authVersion: 0 });
    await db.getRepository(RefreshToken).save({ id: 31, refreshToken: raw });

    const entered = gate();
    const release = gate();
    const holding = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(RefreshToken, 31, { refreshToken: '' });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;

    let completed = 0;
    const refresh = service.verifyRefreshToken(raw).then(
      value => {
        completed++;
        return value;
      },
      error => {
        completed++;
        return error;
      },
    );
    let early: number;
    try {
      await Promise.race([refresh, new Promise(resolve => setTimeout(resolve, 150))]);
      early = completed;
    } finally {
      release.resolve();
      await holding;
    }

    expect(early).toBe(0);
    expect((await refresh).refreshKeyData).toMatchObject({
      id: 7,
      userId: 'unitactor',
      authVersion: 0,
      jwtId: 31,
    });
  });

  it('rejects an unverifiable token with 401 without waiting for a held metadata write', async () => {
    const entered = gate();
    const release = gate();
    const holding = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(User, 7, { authVersion: 1 });
        entered.resolve();
        await release.promise;
      }),
    ).catch(error => error);
    await entered.promise;

    let status: number;
    try {
      await expect(
        Promise.race([
          service.verifyRefreshToken('unit-not-a-signed-token'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 150)),
        ]),
      ).rejects.toMatchObject({ status: 401 });
    } finally {
      status = 401;
      release.resolve();
      await holding;
    }
    expect(status).toBe(401);
  });

  it('rejects a committed revocation of the linked session row with 401', async () => {
    const raw = await service.generateRefreshToken({ ...account, authVersion: 0 });
    await db.getRepository(RefreshToken).save({ id: 31, refreshToken: raw });
    await db.transaction(async manager => {
      await manager.update(RefreshToken, 31, { refreshToken: '' });
    });

    await expect(service.verifyRefreshToken(raw)).rejects.toMatchObject({ status: 401 });
  });
});
