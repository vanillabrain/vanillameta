import { Optional } from '@nestjs/common';
import { Column, Entity, PrimaryGeneratedColumn, Index, OneToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { YesNo } from '../../common/enum/yn.enum';
import { DashboardShare } from './dashboard_share.entity';
import { DashboardWidget } from '../dashboard-widget/entities/dashboard-widget.entity';

@Entity()
@Index('IDX_DASHBOARD_UPDATED_AT', ['updatedAt'])
@Index('IDX_DASHBOARD_UPDATED_AT_TITLE', ['updatedAt', 'title'])
export class Dashboard extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '대시보드 ID' })
  id: number;

  @Column({ length: 300, comment: '대시보드명' })
  title: string;

  @Optional()
  @Column({ nullable: true, comment: '템플릿 ID' })
  templateId: number;

  @Column({ type: 'text', nullable: true, comment: '레이아웃 정보' })
  layout: string;

  @Optional()
  @Column({ comment: '순서', nullable: true })
  seq: number;

  @Optional()
  @Column({ comment: '공유Id', nullable: true })
  shareId: number;

  @Optional()
  @Column({ length: 1, default: YesNo.NO, comment: '삭제여부' })
  delYn: string;

  @OneToOne(() => DashboardShare)
  @JoinColumn({ name: 'shareId' })
  dashboardShare: DashboardShare;

  @OneToMany(() => DashboardWidget, dashboardWidget => dashboardWidget.dashboard)
  dashboardWidgets: DashboardWidget[];
}
