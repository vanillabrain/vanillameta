import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Personal saved exploration view for a managed DuckDB source. It keeps its own table so the
 * dashboard personal_view schema and contract stay untouched.
 */
@Entity('explore_view')
@Index('IDX_explore_view_owner', ['sourceId', 'userId'])
export class ExploreView extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column() sourceId: number;
  @Column() userId: number;
  @Column({ length: 80 }) name: string;
  @Column({ length: 128 }) sourceRevision: string;
  /** Server-derived { [measureId]: definitionVersion } snapshot captured at save time. */
  @Column({ type: 'text' }) measureVersions: string;
  @Column({ type: 'text' }) state: string;
}
