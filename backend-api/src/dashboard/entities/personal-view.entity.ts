import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('personal_view')
@Index('IDX_personal_view_owner', ['dashboardId', 'userId'])
@Index('IDX_personal_view_source_owner', ['sourceId', 'userId'])
export class PersonalView extends BaseEntity {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'integer', nullable: true }) dashboardId: number | null;
  @Column({ type: 'integer', nullable: true }) sourceId: number | null;
  @Column() userId: number;
  @Column({ length: 80 }) name: string;
  @Column({ length: 64 }) revision: string;
  @Column({ type: 'text' }) state: string;
}
