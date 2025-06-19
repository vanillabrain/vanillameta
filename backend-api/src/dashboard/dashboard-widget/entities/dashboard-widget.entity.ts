import { Column, Entity, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity()
@Index('IDX_DASHBOARD_WIDGET_DASHBOARD_ID', ['dashboardId'])
export class DashboardWidget extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @Column()
  widgetId: number;
}
