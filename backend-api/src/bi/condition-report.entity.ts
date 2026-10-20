import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
@Entity('bi_condition_report')
@Index('IDX_bi_report_due', ['active', 'nextAt'])
export class ConditionReport {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'varchar', length: 100 }) blockId: string;
  @Column({ type: 'varchar', length: 64 }) viewRevision: string;
  @Column({ type: 'varchar', length: 64 }) payloadDigest: string;
  @Column({ type: 'varchar', length: 2 }) operator: 'gt' | 'lt';
  @Column({ type: 'varchar', length: 64 }) threshold: string;
  @Column({ type: 'integer' }) intervalSeconds: number;
  @Column({ type: 'varchar', length: 32 }) nextAt: string;
  @Column({ type: 'varchar', length: 36, nullable: true }) leaseToken: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) leaseUntil: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'integer', default: 1 }) version: number;
  @CreateDateColumn() createdAt: Date;
}
export type ReportOutcome = 'matched' | 'not_matched' | 'failed' | 'stale' | 'denied';
@Entity('bi_condition_report_occurrence')
@Index('UQ_bi_report_occurrence', ['reportId', 'scheduledAt'], { unique: true })
export class ConditionReportOccurrence {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'varchar', length: 36 }) reportId: string;
  @Column({ type: 'varchar', length: 32 }) scheduledAt: string;
  @Column({ type: 'varchar', length: 12 }) outcome: ReportOutcome;
  /** Encrypted exact numeric result only. No original rows or generated prose. */
  @Column({ type: 'text', nullable: true }) result: string | null;
  @CreateDateColumn() createdAt: Date;
}
