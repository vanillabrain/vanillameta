import { DataSource } from 'typeorm';
import { runAccessCommand } from '../access/access-cli';
import { InviteCode } from '../access/entities/invite-code.entity';
import { InviteRedemption } from '../access/entities/invite-redemption.entity';
import { WaitlistEntry } from '../access/entities/waitlist-entry.entity';
import { User } from '../user/entities/user.entity';
import { AiQuotaService } from './ai-quota.service';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

describe('access-cli quota commands (real SQLite)', () => {
  let db: DataSource;
  let user: number;
  const saved = process.env.QUOTA_DAILY_CALLS;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, AiUsageLedger, UserQuota, InviteCode, InviteRedemption, WaitlistEntry],
    }).initialize();
    user = (
      await db.getRepository(User).save({ userId: 'cli', email: 'cli@x.test', password: 'x' })
    ).id;
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.QUOTA_DAILY_CALLS;
    else process.env.QUOTA_DAILY_CALLS = saved;
    await db.destroy();
  });
  beforeEach(async () => {
    process.env.QUOTA_DAILY_CALLS = '30';
    await db.query('DELETE FROM ai_usage_ledger');
    await db.query('DELETE FROM user_quota');
  });

  const run = async (...argv: string[]) => {
    const out: unknown[] = [];
    await runAccessCommand(db, argv, value => out.push(value));
    return out;
  };

  it('sets, shows and clears an override', async () => {
    expect(await run('quota', 'set', String(user), '--daily', '0', '--monthly', '2000')).toEqual([
      { userId: user, dailyCalls: 0, monthlyTokens: 2000 },
    ]);
    const [shown] = (await run('quota', 'show', String(user))) as any[];
    expect(shown).toMatchObject({
      userId: user,
      daily: { used: 0, limit: 0 },
      monthlyTokens: { used: 0, limit: 2000 },
      openReservations: [],
    });
    expect(await run('quota', 'clear', String(user))).toEqual([{ userId: user, cleared: true }]);
    expect(((await run('quota', 'show', String(user))) as any[])[0].daily.limit).toBe(30);
    expect(await run('quota', 'clear', String(user))).toEqual([{ userId: user, cleared: false }]);
  });

  it('shows a call that never settled, which is what a crash leaves behind', async () => {
    await new AiQuotaService(db).reserve(user, 0, 'studio-creation', 'stuck-1');
    const [shown] = (await run('quota', 'show', String(user))) as any[];
    expect(shown.daily.used).toBe(1);
    expect(shown.openReservations).toMatchObject([
      { requestId: 'stuck-1', feature: 'studio-creation' },
    ]);
  });

  it('lists the heaviest users', async () => {
    const quota = new AiQuotaService(db);
    await quota.reserve(user, 0, 'f', 'r1');
    await quota.record(user, 'r1', { status: 'ok', inputTokens: 40 });
    expect(await run('quota', 'top')).toEqual([
      { userId: user, callsToday: 1, tokensThisMonth: 40 },
    ]);
  });

  it('refuses a missing or malformed argument', async () => {
    await expect(run('quota', 'show')).rejects.toThrow('needs a userId');
    await expect(run('quota', 'show', 'abc')).rejects.toThrow('userId must be a positive integer');
    await expect(run('quota', 'set', String(user))).rejects.toThrow('--daily and/or --monthly');
    await expect(run('quota', 'set', String(user), '--daily', '-1')).rejects.toThrow(
      'daily must be a non-negative integer',
    );
    await expect(run('quota', 'bogus', String(user))).rejects.toThrow('usage:');
  });
});
