import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
export type ExportJobStatus = 'queued' | 'running' | 'ready' | 'failed' | 'cancelled';
@Entity('export_job')
@Index('UQ_export_job_request', ['ownerId', 'requestId'], { unique: true })
@Index('IDX_export_job_owner', ['ownerId', 'organizationId', 'id'])
export class ExportJob {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) ownerId: number;
  @Column({ type: 'integer' }) organizationId: number;
  @Column({ type: 'integer' }) sourceId: number;
  @Column({ type: 'integer' }) sourceOwnerId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) digest: string;
  @Column({ type: 'text' }) requestJson: string;
  @Column({ type: 'text' }) basisJson: string;
  @Column({ type: 'varchar', length: 16 }) status: ExportJobStatus;
  @Column({ type: 'integer' }) version: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) attemptToken: string | null;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  leaseUntil: Date | null;
  @CreateDateColumn() createdAt: Date;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
  })
  expiresAt: Date;
  @Column({ type: 'varchar', length: 100, nullable: true }) filename: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) hash: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) errorCode: string | null;
  @Column({ type: 'integer', default: 0 }) rowCount: number;
  @Column({ type: 'integer', default: 0 }) bytes: number;
  @Column({ type: 'integer', default: 0 }) partCount: number;
}
@Entity('export_part')
export class ExportPart {
  @PrimaryColumn({ type: 'integer' }) jobId: number;
  @PrimaryColumn({ type: 'integer' }) part: number;
  @Column({ type: 'text' }) data: string;
}
