import { Column, Entity, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Dashboard } from '../../entities/dashboard.entity';
import { Widget } from '../../../widget/entities/widget.entity';

@Entity()
export class DashboardWidget extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dashboardId: number;

  @Column()
  widgetId: number;

  @ManyToOne(() => Dashboard, dashboard => dashboard.dashboardWidgets)
  @JoinColumn({ name: 'dashboardId' })
  dashboard: Dashboard;

  @ManyToOne(() => Widget)
  @JoinColumn({ name: 'widgetId' })
  widget: Widget;
}
