import { Column, Entity,   PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity()
export class DashboardWidget extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @Column()
  widgetId: number;
}
