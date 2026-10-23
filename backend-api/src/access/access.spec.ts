import { ForbiddenException, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RefreshToken } from '../auth/entites/refresh_token.entity';
import { LoginService } from '../login/login.service';
import { User } from '../user/entities/user.entity';
import { runAccessCommand } from './access-cli';
import { AccessService, generateInviteCode, hashInviteCode, signupMode } from './access.service';
import { InviteCode } from './entities/invite-code.entity';
import { InviteRedemption } from './entities/invite-redemption.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

const errorCode = (error: unknown) => (error as HttpException).getResponse() as { error?: string };

describe('signupMode', () => {
  it('is open outside prod and invite in prod by default', () => {
    expect(signupMode({ NODE_ENV: 'development' } as any)).toBe('open');
    expect(signupMode({ NODE_ENV: 'test' } as any)).toBe('open');
    expect(signupMode({ NODE_ENV: 'prod' } as any)).toBe('invite');
  });

  it('honours an explicit mode in any case and fails closed on an unknown one', () => {
    expect(signupMode({ NODE_ENV: 'prod', SIGNUP_MODE: ' OPEN ' } as any)).toBe('open');
    expect(signupMode({ NODE_ENV: 'development', SIGNUP_MODE: 'invite' } as any)).toBe('invite');
    expect(signupMode({ NODE_ENV: 'prod', SIGNUP_MODE: 'everyone' } as any)).toBe('closed');
    expect(signupMode({ NODE_ENV: 'development', SIGNUP_MODE: 'typo' } as any)).toBe('closed');
  });
});

describe('invite-gated signup (real SQLite)', () => {
  let db: DataSource;
  let access: AccessService;
  let login: LoginService;
  let sample: { provisionForUser: jest.Mock };
  const previous = process.env.SIGNUP_MODE;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, RefreshToken, InviteCode, InviteRedemption, WaitlistEntry],
    }).initialize();
    access = new AccessService();
    sample = { provisionForUser: jest.fn().mockResolvedValue(undefined) };
    login = new LoginService(
      {} as any,
      db.getRepository(User),
      db.getRepository(RefreshToken),
      sample as any,
      access,
    );
  });

  afterAll(async () => {
    if (previous === undefined) delete process.env.SIGNUP_MODE;
    else process.env.SIGNUP_MODE = previous;
    await db.destroy();
  });

  beforeEach(async () => {
    process.env.SIGNUP_MODE = 'invite';
    await db.query('DELETE FROM invite_redemption');
    await db.query('DELETE FROM invite_code');
    await db.query('DELETE FROM waitlist_entry');
    await db.query('DELETE FROM user');
  });

  const dto = (n: number, inviteCode?: string) => ({
    userId: `user${n}`,
    email: `user${n}@example.test`,
    password: 'pw-for-tests',
    inviteCode,
  });
  const invite = (options = {}) => access.createInvite(db.manager, options);
  const seats = async () => (await db.getRepository(InviteCode).find()).map(i => i.usedCount);

  it('stores only a hash of the code and prefixes it for recognition', async () => {
    const created = await invite({ label: 'for alice' });
    expect(created.code.startsWith('vm-')).toBe(true);
    const row = await db.getRepository(InviteCode).findOneByOrFail({ id: created.id });
    expect(row.codeHash).toBe(hashInviteCode(created.code));
    expect(JSON.stringify(row)).not.toContain(created.code);
    expect(generateInviteCode()).not.toBe(generateInviteCode());
  });

  it('refuses a signup without a code and with an unknown code, creating no account', async () => {
    await expect(login.signup(dto(1))).rejects.toMatchObject({ status: 403 });
    await login
      .signup(dto(1))
      .catch(error => expect(errorCode(error).error).toBe('INVITE_REQUIRED'));
    await login
      .signup(dto(1, 'vm-not-a-real-code'))
      .catch(error => expect(errorCode(error).error).toBe('INVITE_INVALID'));
    expect(await db.getRepository(User).count()).toBe(0);
  });

  it('creates the account, uses one seat and records who used the code', async () => {
    const { code, id } = await invite({ maxUses: 2 });
    await login.signup(dto(1, code));
    const user = await db.getRepository(User).findOneByOrFail({ userId: 'user1' });
    expect(await seats()).toEqual([1]);
    expect(await db.getRepository(InviteRedemption).find()).toEqual([
      expect.objectContaining({ inviteCodeId: id, userId: user.id }),
    ]);
    expect(sample.provisionForUser).toHaveBeenCalledWith(user.id);
  });

  it('gives the same answer for used-up, expired, revoked and unknown codes', async () => {
    const usedUp = await invite();
    await login.signup(dto(1, usedUp.code));
    const expired = await invite({ days: 1 });
    await db
      .getRepository(InviteCode)
      .update(expired.id, { expiresAt: new Date(Date.now() - 1000) });
    const revoked = await invite();
    await db.getRepository(InviteCode).update(revoked.id, { revokedAt: new Date() });
    const outcomes = [];
    for (const [n, code] of [
      [2, usedUp.code],
      [3, expired.code],
      [4, revoked.code],
      [5, 'vm-unknown'],
    ] as const) {
      const failure = await login.signup(dto(n, code)).catch(error => error);
      outcomes.push(
        `${(failure as HttpException).getStatus()}/${errorCode(failure).error}/${
          (failure as HttpException).message
        }`,
      );
    }
    expect(new Set(outcomes).size).toBe(1);
    expect(outcomes[0].startsWith('403/INVITE_INVALID/')).toBe(true);
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('reveals nothing about existing accounts to a request without a valid code', async () => {
    const first = await invite();
    await login.signup(dto(1, first.code));
    // An existing email/userId with a bogus code must look exactly like an unknown identity with one.
    const known = await login.signup({ ...dto(1), inviteCode: 'vm-bogus' }).catch(error => error);
    const unknown = await login.signup({ ...dto(7), inviteCode: 'vm-bogus' }).catch(error => error);
    for (const failure of [known, unknown]) {
      expect(failure.getStatus()).toBe(403);
      expect(errorCode(failure).error).toBe('INVITE_INVALID');
    }
    expect(known.getResponse()).toEqual(unknown.getResponse());
  });

  it('lets exactly one of several racing signups take the last seat', async () => {
    const { code } = await invite({ maxUses: 1 });
    const results = await Promise.allSettled([1, 2, 3, 4, 5].map(n => login.signup(dto(n, code))));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await seats()).toEqual([1]);
  });

  it('does not burn a seat when the identity is already taken', async () => {
    const first = await invite();
    await login.signup(dto(1, first.code));
    const second = await invite();
    await expect(
      login.signup({ ...dto(2, second.code), email: 'user1@example.test' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await seats()).toEqual([1, 0]);
  });

  it('gives the seat back when the account insert fails after the seat was taken', async () => {
    const first = await invite();
    await login.signup(dto(1, first.code));
    const second = await invite();
    // Hide the existing account from the advisory precheck so the unique index fails inside the transaction.
    jest.spyOn(login as any, 'findIdentityConflict').mockResolvedValueOnce(null);
    await expect(
      login.signup({ ...dto(2, second.code), userId: 'user1', email: 'other@example.test' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(await seats()).toEqual([1, 0]);
    expect(await db.getRepository(InviteRedemption).count()).toBe(1);
  });

  it('closed mode refuses everyone and open mode ignores the code', async () => {
    process.env.SIGNUP_MODE = 'closed';
    const { code } = await invite();
    await login
      .signup(dto(1, code))
      .catch(error => expect(errorCode(error).error).toBe('SIGNUP_CLOSED'));
    expect(await db.getRepository(User).count()).toBe(0);
    process.env.SIGNUP_MODE = 'open';
    await login.signup(dto(2));
    await login.signup(dto(3, 'whatever'));
    expect(await db.getRepository(User).count()).toBe(2);
    expect(await seats()).toEqual([0]);
  });

  it('assertSignupAllowed is a Forbidden for the two refusal reasons', () => {
    process.env.SIGNUP_MODE = 'invite';
    expect(() => access.assertSignupAllowed('   ')).toThrow(ForbiddenException);
    process.env.SIGNUP_MODE = 'closed';
    expect(() => access.assertSignupAllowed('vm-x')).toThrow(ForbiddenException);
  });

  describe('waiting list', () => {
    it('is idempotent and normalises the address', async () => {
      await access.joinWaitlist(db.manager, ' Person@Example.TEST ');
      await access.joinWaitlist(db.manager, 'person@example.test');
      expect(await db.getRepository(WaitlistEntry).count()).toBe(1);
      expect((await db.getRepository(WaitlistEntry).find())[0]).toMatchObject({
        email: 'person@example.test',
        status: 'pending',
      });
    });

    it('rejects a malformed address with 400', async () => {
      await expect(access.joinWaitlist(db.manager, 'not-an-email')).rejects.toMatchObject({
        status: 400,
      });
    });

    it('rejects a non-string body value with 400 instead of failing with a 500', async () => {
      for (const hostile of [undefined, null, 123, ['a@b.co'], { toString: 1 }])
        await expect(access.joinWaitlist(db.manager, hostile as never)).rejects.toMatchObject({
          status: 400,
        });
    });
  });

  describe('operator CLI', () => {
    const run = async (...argv: string[]) => {
      const out: any[] = [];
      await runAccessCommand(db, argv, value => out.push(value));
      return out;
    };

    it('creates, lists and revokes invitations without ever listing a code', async () => {
      const [created] = await run(
        'invite',
        'create',
        '--label',
        'beta tester',
        '--max-uses',
        '3',
        '--days',
        '7',
      );
      expect(created.code).toMatch(/^vm-/);
      const listed = await run('invite', 'list');
      expect(listed[0]).toMatchObject({ id: created.id, label: 'beta tester', used: '0/3' });
      expect(JSON.stringify(listed)).not.toContain(created.code);
      expect(await run('invite', 'revoke', String(created.id))).toEqual([
        { id: created.id, revoked: true },
      ]);
      expect(await run('invite', 'revoke', String(created.id))).toEqual([
        { id: created.id, revoked: false },
      ]);
      await expect(login.signup(dto(1, created.code))).rejects.toMatchObject({ status: 403 });
    });

    it('approves a waiting-list entry into a one-use invitation that signs the person up', async () => {
      await access.joinWaitlist(db.manager, 'wait@example.test');
      const [entry] = await run('waitlist', 'list', '--status', 'pending');
      const [approved] = await run('waitlist', 'approve', String(entry.id));
      expect(approved).toMatchObject({ email: 'wait@example.test', status: 'approved' });
      await login.signup({
        userId: 'waiter',
        email: 'wait@example.test',
        password: 'pw',
        inviteCode: approved.code,
      });
      await expect(login.signup(dto(9, approved.code))).rejects.toMatchObject({ status: 403 });
      await expect(run('waitlist', 'approve', String(entry.id))).rejects.toThrow(
        'already approved',
      );
    });

    it('rejects an entry and refuses bad input', async () => {
      await access.joinWaitlist(db.manager, 'no@example.test');
      const [entry] = await run('waitlist', 'list');
      expect(await run('waitlist', 'reject', String(entry.id))).toEqual([
        { id: entry.id, status: 'rejected' },
      ]);
      await expect(run('waitlist', 'list', '--status', 'pendng')).rejects.toThrow('status must be');
      await expect(run('invite', 'create', '--max-uses', '0')).rejects.toThrow('positive integer');
      await expect(run('invite', 'create', '--days')).rejects.toThrow('needs a value');
      await expect(run('bogus')).rejects.toThrow('usage');
    });
  });
});
