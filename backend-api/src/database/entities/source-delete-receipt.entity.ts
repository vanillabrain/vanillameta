import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Past confirmation only; replay never recreates or deletes another source. */
@Entity('source_delete_receipt')
@Index('UQ_source_delete_request', ['actorId', 'requestId'], { unique: true })
@Index('IDX_source_delete_resource', ['sourceId'])
export class SourceDeleteReceipt {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer', nullable: true }) organizationId: number | null;
  @Column({ type: 'integer' }) sourceId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) expectedRevision: string;
  @Column({ type: 'varchar', length: 64 }) digest: string;
  @Column({ type: 'text' }) filePlan: string;
  @Column({ type: 'integer' }) managedFiles: number;
  @Column({ type: 'varchar', length: 16 }) cleanupStatus: 'pending' | 'complete' | 'retry_required';
  @Column({ type: 'integer', default: 0 }) cleanupVersion: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) cleanupAttempt: string | null;
  @Column({
    type:
      process.env.METADATA_DB_TYPE === 'postgres' ||
      (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'local')
        ? 'timestamp'
        : 'datetime',
    nullable: true,
  })
  cleanupLeaseUntil: Date | null;
  @CreateDateColumn() createdAt: Date;
}
