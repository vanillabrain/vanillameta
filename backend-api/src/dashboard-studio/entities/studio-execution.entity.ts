import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/** Durable stage journal. No prompt, preview rows, SQL, model answer or provider error history. */
@Entity('studio_execution')
@Index('IDX_studio_execution_actor_request', ['actorId', 'requestId'], { unique: true })
export class StudioExecution extends BaseEntity {
  @PrimaryColumn({ length: 36 }) runId: string;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ length: 128 }) requestId: string;
  @Column({ length: 64 }) payloadHash: string;
  @Column({ length: 24 }) status: string;
  @Column({ type: 'text' }) state: string;
}
