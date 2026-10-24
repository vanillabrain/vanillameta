import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { lockSourceActor, sourceWriteTransaction } from '../database/source-write-lock';
import { AiCallStatus, AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';
import { QuotaLimits, QuotaWindows, quotaDefaults, quotaWindows } from './quota-config';

/** Calls that took a slot. A `reserved` row left by a crashed process still counts: the slot was used. */
const COUNTED: AiCallStatus[] = ['reserved', 'ok', 'error', 'cancelled'];
const REQUEST_ID = /^[-a-zA-Z0-9_]{1,64}$/;
const FEATURE = /^[a-zA-Z0-9_.-]{1,64}$/;

export interface Reservation {
  requestId: string;
  /** True when this request id already held a reservation (a retry), so no second slot was taken. */
  replayed: boolean;
}

export interface Settlement {
  status: Extract<AiCallStatus, 'ok' | 'error' | 'cancelled'>;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
}

export interface UsageSummary {
  daily: { used: number; limit: number; resetsAt: Date };
  monthlyTokens: { used: number; limit: number; resetsAt: Date };
}

type Denial = {
  reason: 'daily_calls' | 'monthly_tokens';
  limit: number;
  used: number;
  resetsAt: Date;
};

const nonNegativeInteger = (value: unknown, name: string): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new RangeError(`${name} must be a non-negative integer`);
  return value as number;
};

/**
 * Per-user AI quota and ledger. Only the LLM gateway may call `reserve` and `record`, so there is no
 * route around the limits. Nothing calls them yet; the gateway arrives with the provider registry.
 */
@Injectable()
export class AiQuotaService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async limitsFor(manager: EntityManager, userId: number): Promise<QuotaLimits> {
    const defaults = quotaDefaults();
    const override = await manager.getRepository(UserQuota).findOne({ where: { userId } });
    return {
      dailyCalls: override?.dailyCalls ?? defaults.dailyCalls,
      monthlyTokens: override?.monthlyTokens ?? defaults.monthlyTokens,
    };
  }

  private async usage(manager: EntityManager, userId: number, windows: QuotaWindows) {
    const ledger = manager.getRepository(AiUsageLedger);
    const calls = await ledger
      .createQueryBuilder('l')
      .where('l.userId = :userId', { userId })
      .andWhere('l.status IN (:...counted)', { counted: COUNTED })
      .andWhere('l.createdAt >= :from AND l.createdAt < :to', {
        from: windows.dayStart,
        to: windows.dayEnd,
      })
      .getCount();
    const tokens = await ledger
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.inputTokens + l.outputTokens), 0)', 'total')
      .where('l.userId = :userId', { userId })
      .andWhere('l.status IN (:...counted)', { counted: COUNTED })
      .andWhere('l.createdAt >= :from AND l.createdAt < :to', {
        from: windows.monthStart,
        to: windows.monthEnd,
      })
      .getRawOne<{ total: string | number }>();
    return { calls, tokens: Number(tokens?.total ?? 0) };
  }

  private denial(
    limits: QuotaLimits,
    used: { calls: number; tokens: number },
    windows: QuotaWindows,
  ) {
    if (used.calls >= limits.dailyCalls)
      return {
        reason: 'daily_calls',
        limit: limits.dailyCalls,
        used: used.calls,
        resetsAt: windows.dayEnd,
      } as Denial;
    // The tokens of a call are known only after it finishes, so this stops the next call once the
    // month's total has reached the limit; calls already in flight can still push it past.
    if (used.tokens >= limits.monthlyTokens)
      return {
        reason: 'monthly_tokens',
        limit: limits.monthlyTokens,
        used: used.tokens,
        resetsAt: windows.monthEnd,
      } as Denial;
    return null;
  }

  /**
   * Takes one call slot, or refuses with 429 `AI_QUOTA_EXCEEDED`. The user row is locked first, inside a
   * READ COMMITTED transaction, so the count below sees every row the previous holder committed: under
   * MySQL's default REPEATABLE READ a plain read taken before the lock would not, and two calls could
   * both pass the last slot. The refusal is decided inside and thrown after the commit, otherwise the
   * `quota_denied` row would roll back with it.
   *
   * `epoch` is the user's `authVersion` from the verified token, as for every write that locks an actor.
   */
  async reserve(
    userId: number,
    epoch: number,
    feature: string,
    requestId: string,
    now: Date = new Date(),
  ): Promise<Reservation> {
    if (!REQUEST_ID.test(requestId))
      throw new RangeError('requestId must be 1-64 URL-safe characters');
    if (!FEATURE.test(feature)) throw new RangeError('feature must be 1-64 characters');
    const decision = await sourceWriteTransaction(this.db, async manager => {
      await lockSourceActor(manager, userId, epoch);
      const ledger = manager.getRepository(AiUsageLedger);
      const existing = await ledger.findOne({ where: { userId, requestId } });
      if (existing && ['reserved', 'ok', 'error', 'cancelled'].includes(existing.status)) {
        if (existing.status !== 'reserved')
          throw new ConflictException({
            error: 'REQUEST_ID_REUSED',
            message: 'This request id already finished.',
          });
        return { replayed: true, denial: null as Denial | null };
      }
      const windows = quotaWindows(now);
      const denial = this.denial(
        await this.limitsFor(manager, userId),
        await this.usage(manager, userId, windows),
        windows,
      );
      if (denial) {
        // A retry of an earlier refusal keeps its single row.
        if (!existing)
          await ledger.insert({
            userId,
            feature,
            requestId,
            status: 'quota_denied',
            createdAt: now,
          });
        return { replayed: false, denial };
      }
      if (existing)
        await ledger.update(existing.id, { status: 'reserved', feature, createdAt: now });
      else await ledger.insert({ userId, feature, requestId, status: 'reserved', createdAt: now });
      return { replayed: false, denial: null as Denial | null };
    });
    if (decision.denial)
      throw new HttpException(
        {
          error: 'AI_QUOTA_EXCEEDED',
          message:
            decision.denial.reason === 'daily_calls'
              ? '오늘 사용할 수 있는 AI 요청 수를 모두 사용했습니다.'
              : '이번 달 AI 사용량을 모두 사용했습니다.',
          reason: decision.denial.reason,
          limit: decision.denial.limit,
          used: decision.denial.used,
          resetsAt: decision.denial.resetsAt.toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    return { requestId, replayed: decision.replayed };
  }

  /**
   * Settles a reservation with what the call really used. Only a `reserved` row of this user changes,
   * so a second call with the same id, or another user's id, is a no-op. Returns whether a row changed.
   */
  async record(userId: number, requestId: string, settlement: Settlement): Promise<boolean> {
    if (!['ok', 'error', 'cancelled'].includes(settlement.status))
      throw new RangeError('status must be ok, error or cancelled');
    const result = await this.db
      .getRepository(AiUsageLedger)
      .createQueryBuilder()
      .update(AiUsageLedger)
      .set({
        status: settlement.status,
        inputTokens: nonNegativeInteger(settlement.inputTokens, 'inputTokens'),
        outputTokens: nonNegativeInteger(settlement.outputTokens, 'outputTokens'),
        latencyMs:
          settlement.latencyMs === undefined
            ? null
            : nonNegativeInteger(settlement.latencyMs, 'latencyMs'),
        provider: (settlement.provider ?? '').slice(0, 32),
        model: (settlement.model ?? '').slice(0, 128),
      })
      .where('userId = :userId AND requestId = :requestId AND status = :reserved', {
        userId,
        requestId,
        reserved: 'reserved',
      })
      .execute();
    return result.affected === 1;
  }

  async summary(userId: number, now: Date = new Date()): Promise<UsageSummary> {
    const windows = quotaWindows(now);
    const limits = await this.limitsFor(this.db.manager, userId);
    const used = await this.usage(this.db.manager, userId, windows);
    return {
      daily: { used: used.calls, limit: limits.dailyCalls, resetsAt: windows.dayEnd },
      monthlyTokens: { used: used.tokens, limit: limits.monthlyTokens, resetsAt: windows.monthEnd },
    };
  }

  /** Rows still `reserved`, for the operator: a crashed call leaves one behind with no tokens recorded. */
  openReservations(userId: number): Promise<AiUsageLedger[]> {
    return this.db
      .getRepository(AiUsageLedger)
      .find({ where: { userId, status: 'reserved' }, order: { id: 'ASC' } });
  }

  /** Heaviest users of the current month, with today's calls, for the operator. */
  async top(limit = 20, now: Date = new Date()) {
    const windows = quotaWindows(now);
    const rows = await this.db
      .getRepository(AiUsageLedger)
      .createQueryBuilder('l')
      .select('l.userId', 'userId')
      .addSelect('SUM(CASE WHEN l.createdAt >= :dayStart THEN 1 ELSE 0 END)', 'callsToday')
      .addSelect('COALESCE(SUM(l.inputTokens + l.outputTokens), 0)', 'tokensThisMonth')
      .where('l.status IN (:...counted)', { counted: COUNTED })
      .andWhere('l.createdAt >= :monthStart AND l.createdAt < :monthEnd', windows)
      .setParameter('dayStart', windows.dayStart)
      .groupBy('l.userId')
      .orderBy('tokensThisMonth', 'DESC')
      .addOrderBy('callsToday', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map(row => ({
      userId: Number(row.userId),
      callsToday: Number(row.callsToday),
      tokensThisMonth: Number(row.tokensThisMonth),
    }));
  }

  // Overrides ---------------------------------------------------------------------------------------

  async setOverride(
    userId: number,
    values: { dailyCalls?: number; monthlyTokens?: number },
  ): Promise<UserQuota> {
    const repository = this.db.getRepository(UserQuota);
    const current =
      (await repository.findOne({ where: { userId } })) ?? repository.create({ userId });
    if (values.dailyCalls !== undefined)
      current.dailyCalls = nonNegativeInteger(values.dailyCalls, 'dailyCalls');
    if (values.monthlyTokens !== undefined)
      current.monthlyTokens = nonNegativeInteger(values.monthlyTokens, 'monthlyTokens');
    current.dailyCalls ??= null;
    current.monthlyTokens ??= null;
    return repository.save(current);
  }

  async clearOverride(userId: number): Promise<boolean> {
    const result = await this.db.getRepository(UserQuota).delete({ userId });
    return (result.affected ?? 0) > 0;
  }
}
