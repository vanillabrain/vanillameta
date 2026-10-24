import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { AiQuotaService } from './ai-quota.service';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

const DAY_ONE = new Date('2026-10-24T10:00:00.000Z');
const DAY_ONE_LATE = new Date('2026-10-24T23:59:59.000Z');
const DAY_TWO = new Date('2026-10-25T00:00:01.000Z');
const NEXT_MONTH = new Date('2026-11-01T00:00:01.000Z');

const response = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    return {
      status: (error as HttpException).getStatus(),
      body: (error as HttpException).getResponse() as any,
    };
  }
  throw new Error('expected the call to be refused');
};

describe('AiQuotaService (real SQLite)', () => {
  let db: DataSource;
  let quota: AiQuotaService;
  let a: number;
  let b: number;
  const saved = {
    QUOTA_DAILY_CALLS: process.env.QUOTA_DAILY_CALLS,
    QUOTA_MONTHLY_TOKENS: process.env.QUOTA_MONTHLY_TOKENS,
  };
  let counter = 0;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, AiUsageLedger, UserQuota],
    }).initialize();
    quota = new AiQuotaService(db);
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await db.destroy();
  });

  beforeEach(async () => {
    await db.query('DELETE FROM ai_usage_ledger');
    await db.query('DELETE FROM user_quota');
    await db.query('DELETE FROM user');
    process.env.QUOTA_DAILY_CALLS = '3';
    process.env.QUOTA_MONTHLY_TOKENS = '1000';
    counter += 1;
    const users = db.getRepository(User);
    a = (await users.save({ userId: `a${counter}`, email: `a${counter}@x.test`, password: 'x' }))
      .id;
    b = (await users.save({ userId: `b${counter}`, email: `b${counter}@x.test`, password: 'x' }))
      .id;
  });

  const take = (user: number, requestId: string, now = DAY_ONE) =>
    quota.reserve(user, 0, 'studio-creation', requestId, now);
  const rows = (user: number) =>
    db.getRepository(AiUsageLedger).find({ where: { userId: user }, order: { id: 'ASC' } });

  it('records a reservation and settles it with the tokens that were really used', async () => {
    expect(await take(a, 'r1')).toEqual({ requestId: 'r1', replayed: false });
    expect((await rows(a))[0]).toMatchObject({ status: 'reserved', feature: 'studio-creation' });
    expect(
      await quota.record(a, 'r1', {
        status: 'ok',
        inputTokens: 120,
        outputTokens: 30,
        latencyMs: 800,
        provider: 'openai',
        model: 'gpt-4o-mini',
      }),
    ).toBe(true);
    expect((await rows(a))[0]).toMatchObject({
      status: 'ok',
      inputTokens: 120,
      outputTokens: 30,
      latencyMs: 800,
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
  });

  it('refuses the call after the daily limit with 429, a reason and the next UTC midnight', async () => {
    for (const id of ['r1', 'r2', 'r3']) await take(a, id);
    const refused = await response(take(a, 'r4'));
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({
      error: 'AI_QUOTA_EXCEEDED',
      reason: 'daily_calls',
      limit: 3,
      used: 3,
      resetsAt: '2026-10-25T00:00:00.000Z',
    });
  });

  it('keeps the refusal in the ledger (it is decided inside the transaction and thrown after commit)', async () => {
    for (const id of ['r1', 'r2', 'r3']) await take(a, id);
    await response(take(a, 'r4'));
    expect((await rows(a)).map(row => [row.requestId, row.status])).toEqual([
      ['r1', 'reserved'],
      ['r2', 'reserved'],
      ['r3', 'reserved'],
      ['r4', 'quota_denied'],
    ]);
    // A refusal is not a call: it does not use a slot, so the count stays at three, not four.
    expect((await quota.summary(a, DAY_ONE)).daily.used).toBe(3);
  });

  it('counts errors and cancellations but not refusals, and gives the slots back the next UTC day', async () => {
    await take(a, 'r1');
    await quota.record(a, 'r1', { status: 'error' });
    await take(a, 'r2');
    await quota.record(a, 'r2', { status: 'cancelled' });
    await take(a, 'r3', DAY_ONE_LATE);
    await response(take(a, 'r4', DAY_ONE_LATE));
    expect((await quota.summary(a, DAY_ONE_LATE)).daily.used).toBe(3);
    // The first second of the next day: three slots again.
    await take(a, 'r5', DAY_TWO);
    expect((await quota.summary(a, DAY_TWO)).daily.used).toBe(1);
  });

  it('stops the next call once the month has used its tokens, and starts over next month', async () => {
    await take(a, 'r1');
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 400, outputTokens: 200 });
    await take(a, 'r2');
    // 600 of 1000 used, so this call was allowed; it overshoots the limit.
    await quota.record(a, 'r2', { status: 'ok', inputTokens: 300, outputTokens: 200 });
    const refused = await response(take(a, 'r3'));
    expect(refused.body).toMatchObject({
      reason: 'monthly_tokens',
      limit: 1000,
      used: 1100,
      resetsAt: '2026-11-01T00:00:00.000Z',
    });
    await take(a, 'r4', NEXT_MONTH);
  });

  it('uses a per-user override, including 0 for no AI, and falls back to the default when cleared', async () => {
    await quota.setOverride(a, { dailyCalls: 1 });
    await take(a, 'r1');
    expect((await response(take(a, 'r2'))).body.limit).toBe(1);
    // The other user keeps the environment default.
    await take(b, 'r1');
    await take(b, 'r2');
    expect(await quota.clearOverride(a)).toBe(true);
    await take(a, 'r3');
    expect(await quota.clearOverride(a)).toBe(false);

    await quota.setOverride(b, { dailyCalls: 0 });
    expect((await response(take(b, 'r9'))).body).toMatchObject({ reason: 'daily_calls', limit: 0 });
    // Setting one column keeps the other on the default.
    expect(await quota.setOverride(b, { monthlyTokens: 50 })).toMatchObject({
      dailyCalls: 0,
      monthlyTokens: 50,
    });
  });

  it('is idempotent per user and request id: a retry reuses its slot, a finished id cannot be reused', async () => {
    expect(await take(a, 'r1')).toMatchObject({ replayed: false });
    expect(await take(a, 'r1')).toMatchObject({ replayed: true });
    expect(await rows(a)).toHaveLength(1);
    await quota.record(a, 'r1', { status: 'ok' });
    await expect(take(a, 'r1')).rejects.toBeInstanceOf(ConflictException);
    // Another user may use the same id: ids are scoped to the user.
    expect(await take(b, 'r1')).toMatchObject({ replayed: false });
  });

  it('turns a refused retry into a reservation once room appears, without a second row', async () => {
    for (const id of ['r1', 'r2', 'r3']) await take(a, id);
    await response(take(a, 'r4'));
    await response(take(a, 'r4'));
    expect((await rows(a)).filter(row => row.requestId === 'r4')).toHaveLength(1);
    await quota.setOverride(a, { dailyCalls: 10 });
    expect(await take(a, 'r4')).toMatchObject({ replayed: false });
    expect((await rows(a)).find(row => row.requestId === 'r4')?.status).toBe('reserved');
  });

  it('settles only a reserved row of the same user, once', async () => {
    await take(a, 'r1');
    expect(await quota.record(b, 'r1', { status: 'ok', inputTokens: 5 })).toBe(false);
    expect((await rows(a))[0].status).toBe('reserved');
    expect(await quota.record(a, 'r1', { status: 'ok', inputTokens: 5 })).toBe(true);
    expect(await quota.record(a, 'r1', { status: 'error', inputTokens: 900 })).toBe(false);
    expect((await rows(a))[0]).toMatchObject({ status: 'ok', inputTokens: 5 });
    expect(await quota.record(a, 'missing', { status: 'ok' })).toBe(false);
  });

  it('rejects an inactive user and a stale token epoch before anything is written', async () => {
    await expect(quota.reserve(a, 7, 'f', 'r1', DAY_ONE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await db.getRepository(User).update(a, { active: false });
    await expect(quota.reserve(a, 0, 'f', 'r1', DAY_ONE)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await rows(a)).toHaveLength(0);
  });

  it('validates its inputs', async () => {
    await expect(take(a, 'has space')).rejects.toThrow(RangeError);
    await expect(take(a, 'x'.repeat(65))).rejects.toThrow(RangeError);
    await expect(quota.reserve(a, 0, '', 'r1')).rejects.toThrow(RangeError);
    await take(a, 'r1');
    await expect(quota.record(a, 'r1', { status: 'ok', inputTokens: -1 })).rejects.toThrow(
      RangeError,
    );
    await expect(quota.record(a, 'r1', { status: 'ok', outputTokens: 1.5 })).rejects.toThrow(
      RangeError,
    );
    await expect(quota.record(a, 'r1', { status: 'reserved' as never })).rejects.toThrow(
      RangeError,
    );
    await expect(quota.setOverride(a, { dailyCalls: -1 })).rejects.toThrow(RangeError);
    await expect(quota.setOverride(a, { monthlyTokens: 2_147_483_648 })).rejects.toThrow(
      'at most 2147483647',
    );
    expect((await quota.setOverride(a, { monthlyTokens: 2_147_483_647 })).monthlyTokens).toBe(
      2_147_483_647,
    );
  });

  it('keeps users apart and summarises with the limits in force', async () => {
    await take(a, 'r1');
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 100, outputTokens: 50 });
    await take(b, 'r1');
    expect(await quota.summary(a, DAY_ONE)).toEqual({
      daily: { used: 1, limit: 3, resetsAt: new Date('2026-10-25T00:00:00.000Z') },
      monthlyTokens: { used: 150, limit: 1000, resetsAt: new Date('2026-11-01T00:00:00.000Z') },
    });
    expect((await quota.summary(b, DAY_ONE)).monthlyTokens.used).toBe(0);
    expect((await quota.openReservations(b)).map(row => row.requestId)).toEqual(['r1']);
  });

  it('counts a reservation’s estimate toward the month at once and replaces it with the real tokens', async () => {
    await quota.reserve(a, 0, 'f', 'r1', DAY_ONE, { inputTokens: 300, outputTokens: 400 });
    expect((await quota.summary(a, DAY_ONE)).monthlyTokens.used).toBe(700);
    expect((await rows(a))[0]).toMatchObject({ status: 'reserved', usageEstimated: true });
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 50, outputTokens: 20 });
    expect((await quota.summary(a, DAY_ONE)).monthlyTokens.used).toBe(70);
    expect((await rows(a))[0]).toMatchObject({ status: 'ok', usageEstimated: false });
    await quota.reserve(a, 0, 'f', 'r2', DAY_ONE);
    await quota.record(a, 'r2', { status: 'ok', inputTokens: 1, usageEstimated: true });
    expect((await rows(a))[1].usageEstimated).toBe(true);
  });

  it('totals the month across users, for the server-wide ceiling', async () => {
    await take(a, 'r1');
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 100, outputTokens: 50 });
    await take(b, 'r1');
    await quota.record(b, 'r1', { status: 'error', inputTokens: 25 });
    await quota.reserve(b, 0, 'f', 'old', new Date('2026-09-30T23:00:00Z'), {
      inputTokens: 9999,
      outputTokens: 0,
    });
    expect(await quota.monthlyTokensTotal(DAY_ONE)).toBe(175);
  });

  it('settles only the calls reserved before a point in time, as errors, keeping their estimate', async () => {
    await quota.reserve(a, 0, 'f', 'orphan', new Date('2026-10-24T09:00:00Z'), {
      inputTokens: 5,
      outputTokens: 6,
    });
    await quota.reserve(a, 0, 'f', 'fresh', new Date('2026-10-24T10:30:00Z'));
    await quota.reserve(a, 0, 'f', 'done', new Date('2026-10-24T08:00:00Z'));
    await quota.record(a, 'done', { status: 'ok' });
    expect(await quota.settleOrphans(new Date('2026-10-24T10:00:00Z'))).toBe(1);
    const byId = Object.fromEntries((await rows(a)).map(row => [row.requestId, row]));
    expect(byId.orphan).toMatchObject({ status: 'error', inputTokens: 5, outputTokens: 6 });
    expect(byId.fresh.status).toBe('reserved');
    expect(byId.done.status).toBe('ok');
  });

  it('lists the heaviest users of the month with their calls today', async () => {
    await take(a, 'r1');
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 100 });
    await take(b, 'r1', new Date('2026-10-03T08:00:00.000Z'));
    await quota.record(b, 'r1', { status: 'ok', inputTokens: 300 });
    await take(b, 'r2', DAY_ONE);
    await quota.record(b, 'r2', { status: 'ok', inputTokens: 200 });
    expect(await quota.top(10, DAY_ONE)).toEqual([
      { userId: b, callsToday: 1, tokensThisMonth: 500 },
      { userId: a, callsToday: 1, tokensThisMonth: 100 },
    ]);
  });
});
