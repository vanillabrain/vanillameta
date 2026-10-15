import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
@Entity('studio_publication')
@Index('IDX_studio_publication_dashboard', ['dashboardId'])
export class StudioPublication extends BaseEntity {
  @PrimaryColumn({ length: 64 }) token: string;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'integer' }) sourceId: number;
  @Column({ type: 'integer' }) version: number;
  @Column({ length: 12 }) visibility: 'private' | 'link';
  @Column() allowRemix: boolean;
  @Column({ type: 'varchar', nullable: true }) expiresAt: string | null;
  @Column({ type: 'varchar', nullable: true }) revokedAt: string | null;
  @Column({ type: 'varchar' }) asOf: string;
  @Column({ length: 64 }) dataVersion: string;
  @Column({ type: 'text' }) snapshot: string;
}
/** Separate journal: a replay must never reactivate a revoked token or create another version. */
@Entity('studio_publication_request')
@Index('IDX_studio_publication_request_actor', ['actorId', 'requestId'], { unique: true })
export class StudioPublicationRequest extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer' }) actorId: number;
  @Column({ length: 128 }) requestId: string;
  @Column({ length: 64 }) payloadHash: string;
  @Column({ type: 'text' }) result: string;
}
