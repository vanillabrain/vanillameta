import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export type FileRefreshStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'interrupted'
  | 'cancelled';
/** One durable receipt per actor/request. Files stay in managed storage, outside metadata JSON. */
@Entity('file_refresh')
@Index('IDX_file_refresh_actor_request', ['actorId', 'requestId'], { unique: true })
export class FileRefresh extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id: string;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) sourceId: number;
  @Column({ type: 'varchar', length: 36 }) requestId: string;
  @Column({ type: 'varchar', length: 64 }) payloadDigest: string;
  @Column({ type: 'varchar', length: 64 }) inputDigest: string;
  @Column({ type: 'varchar', length: 64 }) expectedRevision: string;
  @Column({ type: 'varchar', length: 256 }) originalname: string;
  @Column({ type: 'varchar', length: 12 }) extension: string;
  @Column({ type: 'varchar', length: 24 }) status: FileRefreshStatus;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'varchar', length: 36, nullable: true }) leaseToken: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) leaseUntil: string | null;
  @Column({ type: 'varchar', length: 64 }) storageDigest: string;
  @Column({ type: 'boolean', default: true }) inputRetained: boolean;
  @Column({ type: 'text', nullable: true }) correction: string | null;
  @Column({ type: 'text', nullable: true }) result: string | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
}
