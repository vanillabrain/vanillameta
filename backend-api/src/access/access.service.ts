import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { EntityManager } from 'typeorm';
import { InviteCode } from './entities/invite-code.entity';
import { InviteRedemption } from './entities/invite-redemption.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

export type SignupMode = 'open' | 'invite' | 'closed';
const SIGNUP_MODES: SignupMode[] = ['open', 'invite', 'closed'];

/**
 * Who may create an account. Production defaults to `invite`; every other environment stays `open`
 * unless SIGNUP_MODE says otherwise, so development and CI flows keep working. An unknown value
 * fails closed rather than silently opening signup.
 */
export function signupMode(env: NodeJS.ProcessEnv = process.env): SignupMode {
  const configured = env.SIGNUP_MODE?.trim().toLowerCase();
  if (configured)
    return SIGNUP_MODES.includes(configured as SignupMode) ? (configured as SignupMode) : 'closed';
  return env.NODE_ENV === 'prod' ? 'invite' : 'open';
}

export function isSignupMode(value: string): value is SignupMode {
  return SIGNUP_MODES.includes(value as SignupMode);
}

export const INVITE_CODE_PREFIX = 'vm-';

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

/** 128 random bits: not guessable, so a fast hash is enough and the throttle is only a second line. */
export function generateInviteCode(): string {
  return `${INVITE_CODE_PREFIX}${randomBytes(16).toString('base64url')}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AccessService {
  signupMode(): SignupMode {
    return signupMode();
  }

  /** Throws when this signup is not allowed to proceed at all (before any invitation is looked at). */
  assertSignupAllowed(inviteCode: string | undefined): void {
    const mode = this.signupMode();
    if (mode === 'closed')
      throw new ForbiddenException({
        error: 'SIGNUP_CLOSED',
        message: '지금은 가입을 받지 않습니다.',
      });
    if (mode === 'invite' && !inviteCode?.trim())
      throw new ForbiddenException({
        error: 'INVITE_REQUIRED',
        message: '초대 코드가 필요합니다.',
      });
  }

  async createInvite(
    manager: EntityManager,
    options: { label?: string; maxUses?: number; days?: number } = {},
  ): Promise<{ id: number; code: string; expiresAt: Date | null }> {
    const maxUses = options.maxUses ?? 1;
    if (!Number.isInteger(maxUses) || maxUses < 1)
      throw new RangeError('maxUses must be a positive integer');
    if (options.days !== undefined && !(options.days > 0))
      throw new RangeError('days must be positive');
    const code = generateInviteCode();
    const expiresAt = options.days ? new Date(Date.now() + options.days * 86_400_000) : null;
    const saved = await manager.getRepository(InviteCode).save({
      codeHash: hashInviteCode(code),
      label: options.label ?? null,
      maxUses,
      usedCount: 0,
      expiresAt,
      revokedAt: null,
    });
    return { id: saved.id, code, expiresAt };
  }

  /**
   * Uses one seat of the invitation. The conditional UPDATE is the whole check, so two signups racing
   * for the last seat cannot both win, on SQLite and on MySQL. Run it in the same transaction as the
   * account insert so a failed signup gives the seat back.
   */
  async redeem(manager: EntityManager, code: string): Promise<number> {
    const hash = hashInviteCode(code);
    const result = await manager
      .createQueryBuilder()
      .update(InviteCode)
      .set({ usedCount: () => 'usedCount + 1' })
      .where('codeHash = :hash', { hash })
      .andWhere('revokedAt IS NULL')
      .andWhere('usedCount < maxUses')
      .andWhere('(expiresAt IS NULL OR expiresAt > :now)', { now: new Date() })
      .execute();
    const invite =
      result.affected === 1
        ? await manager.getRepository(InviteCode).findOne({ where: { codeHash: hash } })
        : null;
    // One message for unknown, used up, expired and revoked, so a probe learns nothing about which.
    if (!invite)
      throw new ForbiddenException({
        error: 'INVITE_INVALID',
        message: '초대 코드가 올바르지 않거나 더 이상 사용할 수 없습니다.',
      });
    return invite.id;
  }

  recordRedemption(manager: EntityManager, inviteCodeId: number, userId: number) {
    return manager.getRepository(InviteRedemption).insert({ inviteCodeId, userId });
  }

  /** Public and idempotent: the same address twice, or an unknown one, looks identical to the caller. */
  async joinWaitlist(manager: EntityManager, email: string): Promise<void> {
    const normalized = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!EMAIL_PATTERN.test(normalized) || normalized.length > 255)
      throw new BadRequestException({
        error: 'EMAIL_INVALID',
        message: '이메일 형식을 확인해 주세요.',
      });
    const repository = manager.getRepository(WaitlistEntry);
    if (await repository.findOne({ where: { email: normalized } })) return;
    try {
      await repository.insert({ email: normalized, status: 'pending' });
    } catch (error) {
      // A concurrent identical request won the unique index; that is the same outcome.
      if (!(await repository.findOne({ where: { email: normalized } }))) throw error;
    }
  }
}
