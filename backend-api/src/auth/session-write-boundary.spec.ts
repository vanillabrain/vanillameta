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
describe('UC051 atomic persisted session writes', () => {
  let db: DataSource, service: AuthService;
  const previous = process.env.REFRESH_SECRET;
  const actor = { id: 1, userId: 'actor', email: 'actor@example.invalid', authVersion: 0 };
  beforeEach(async () => {
    process.env.REFRESH_SECRET = 'session-write-synthetic';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, RefreshToken],
    }).initialize();
    await db.getRepository(User).save({ ...actor, password: 'synthetic', active: true, jwtId: 31 });
    await db.getRepository(RefreshToken).save({ id: 31, refreshToken: 'previous-session' });
    service = new AuthService(
      new JwtService(),
      db.getRepository(User),
      db.getRepository(RefreshToken),
    );
  });
  afterEach(async () => {
    await db.destroy();
    if (previous === undefined) delete process.env.REFRESH_SECRET;
    else process.env.REFRESH_SECRET = previous;
  });
  it.each([true, false])(
    'rolls back the token row when account linkage fails (existing=%s)',
    async existing => {
      if (!existing) {
        await db.getRepository(User).update(1, { jwtId: null });
        await db.getRepository(RefreshToken).clear();
      }
      const token = await service.generateRefreshToken(actor);
      await db.query(
        "CREATE TRIGGER fail_link BEFORE UPDATE OF jwtId ON user BEGIN SELECT RAISE(ABORT, 'synthetic link failure'); END",
      );
      await expect(service.setRefreshKey(token, existing ? 31 : null, 1)).rejects.toThrow();
      const sessions = await db.getRepository(RefreshToken).find();
      expect(sessions.map(row => row.refreshToken)).toEqual(existing ? ['previous-session'] : []);
      expect((await db.getRepository(User).findOneByOrFail({ id: 1 })).jwtId).toBe(
        existing ? 31 : null,
      );
    },
  );
  it('uses the current account linkage instead of mutating a different supplied session row', async () => {
    await db.getRepository(RefreshToken).save({ id: 99, refreshToken: 'other-session' });
    const token = await service.generateRefreshToken(actor);
    await service.setRefreshKey(token, 99, 1);
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 99 })).refreshToken).toBe(
      'other-session',
    );
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 31 })).refreshToken).toBe(
      token,
    );
    expect((await db.getRepository(User).findOneByOrFail({ id: 1 })).jwtId).toBe(31);
  });
  it.each([
    { active: false, authVersion: 0 },
    { active: true, authVersion: 1 },
  ])('rejects an inactive or changed epoch before writing: %j', async change => {
    const token = await service.generateRefreshToken(actor);
    await db.getRepository(User).update(1, change);
    await expect(service.setRefreshKey(token, 31, 1)).rejects.toMatchObject({ status: 401 });
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 31 })).refreshToken).toBe(
      'previous-session',
    );
  });
  it.each(['invalid-signature', 'different-actor'])(
    'rejects %s before changing any session linkage',
    async mode => {
      const token =
        mode === 'invalid-signature'
          ? 'not-a-signed-token'
          : await service.generateRefreshToken({ ...actor, id: 2 });
      await expect(service.setRefreshKey(token, 31, 1)).rejects.toMatchObject({ status: 401 });
      expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 31 })).refreshToken).toBe(
        'previous-session',
      );
      expect((await db.getRepository(User).findOneByOrFail({ id: 1 })).jwtId).toBe(31);
      expect(await db.getRepository(RefreshToken).count()).toBe(1);
    },
  );
  it('keeps one linked row across concurrent first logins and revokes the replaced credential', async () => {
    await db.getRepository(User).update(1, { jwtId: null });
    await db.getRepository(RefreshToken).clear();
    const tokens = await Promise.all([
      service.generateRefreshToken(actor),
      service.generateRefreshToken(actor),
    ]);
    const saved = await Promise.all(tokens.map(token => service.setRefreshKey(token, null, 1)));
    expect(saved[0].id).toBe(saved[1].id);
    const rows = await db.getRepository(RefreshToken).find();
    expect(rows).toHaveLength(1);
    expect((await db.getRepository(User).findOneByOrFail({ id: 1 })).jwtId).toBe(rows[0].id);
    const current = rows[0].refreshToken;
    expect((await service.verifyRefreshToken(current)).refreshKeyData.id).toBe(1);
    await expect(
      service.verifyRefreshToken(tokens.find(token => token !== current)),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('preserves a newer login when an earlier verified logout arrives late', async () => {
    const earlier = await service.generateRefreshToken(actor);
    await service.setRefreshKey(earlier, 31, 1);
    const newer = await service.generateRefreshToken(actor);
    await service.setRefreshKey(newer, 31, 1);
    await service.deleteRefreshToken.call(service, 31, earlier);
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 31 })).refreshToken).toBe(
      newer,
    );
    expect((await service.verifyRefreshToken(newer)).refreshKeyData.id).toBe(1);
  });
  it('persists logout only after an unrelated transaction rolls back', async () => {
    const entered = gate(),
      release = gate();
    const held = serializeMetadataWork(db, () =>
      db.transaction(async manager => {
        await manager.update(User, 1, { email: 'provisional@example.invalid' });
        entered.resolve();
        await release.promise;
        throw new Error('expected rollback');
      }),
    ).catch(error => error);
    await entered.promise;
    let completed = false;
    const logout = service.deleteRefreshToken.call(service, 31, 'previous-session').then(() => {
      completed = true;
    });
    let early: boolean;
    try {
      await Promise.race([logout, new Promise(resolve => setTimeout(resolve, 150))]);
      early = completed;
    } finally {
      release.resolve();
      await held;
    }
    await logout;
    expect(early).toBe(false);
    expect((await db.getRepository(RefreshToken).findOneByOrFail({ id: 31 })).refreshToken).toBe(
      '',
    );
  });
});
