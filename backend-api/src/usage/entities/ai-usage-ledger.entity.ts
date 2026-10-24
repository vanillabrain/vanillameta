import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type AiCallStatus = 'reserved' | 'ok' | 'error' | 'cancelled' | 'quota_denied';

/**
 * One row per AI call a user asked for. A `reserved` row is written before the provider is called and
 * settled afterwards, so the daily count and the monthly token sum are read from the same table that
 * records what was spent. `userId` has no foreign key: usage history must outlive the account row.
 */
@Entity('ai_usage_ledger')
@Index('UQ_ai_usage_ledger_user_request', ['userId', 'requestId'], { unique: true })
@Index('IDX_ai_usage_ledger_user_created', ['userId', 'createdAt'])
@Index('IDX_ai_usage_ledger_created', ['createdAt'])
export class AiUsageLedger {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 64 })
  feature: string;

  @Column({ type: 'varchar', length: 32, default: '' })
  provider: string;

  @Column({ type: 'varchar', length: 128, default: '' })
  model: string;

  @Column({ type: 'integer', default: 0 })
  inputTokens: number;

  @Column({ type: 'integer', default: 0 })
  outputTokens: number;

  @Column({ type: 'varchar', length: 16 })
  status: AiCallStatus;

  @Column({ type: 'integer', nullable: true })
  latencyMs: number | null;

  @Column({ type: 'varchar', length: 64 })
  requestId: string;

  @CreateDateColumn()
  createdAt: Date;
}
