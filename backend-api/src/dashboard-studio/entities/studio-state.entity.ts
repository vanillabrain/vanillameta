import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * One Studio version document per dashboard. The document carries block and layout definitions
 * only; raw SQL, result rows and credentials stay outside this history record.
 */
@Entity('studio_state')
export class StudioState extends BaseEntity {
  @PrimaryColumn({ type: 'integer' }) dashboardId: number;
  @Column({ type: 'text' }) document: string;
  /** Revision of the legacy dashboard snapshot this Studio document was saved from. */
  @Column({ length: 64 }) legacyRevision: string;
}
