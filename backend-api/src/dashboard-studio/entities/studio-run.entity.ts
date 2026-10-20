import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Studio save idempotency journal. One row per actor/request pair, so a replayed save returns the
 * stored result instead of writing twice. Payload hashes only; no credentials or raw rows.
 */
@Entity('studio_run')
@Index('IDX_studio_run_actor_request', ['actorId', 'requestId'], { unique: true })
export class StudioRun extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 128 }) requestId: string;
  @Column({ length: 64 }) payloadHash: string;
  @Column({ type: 'text', nullable: true }) result: string | null;
}
