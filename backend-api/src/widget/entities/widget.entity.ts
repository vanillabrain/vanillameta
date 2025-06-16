import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn, Index, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';
import { Component } from '../../component/entities/component.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';

@Entity()
@Index('IDX_WIDGET_COMPONENT_ID', ['componentId'])
@Index('IDX_WIDGET_DATASET_TYPE_ID', ['datasetType', 'datasetId'])
@Index('IDX_WIDGET_UPDATED_AT', ['updatedAt'])
export class Widget extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '위젯 ID' })
  id: number;

  @Column({ length: 300, nullable: true, comment: '위젯명' })
  title: string;

  @Column({ length: 1000, nullable: true, comment: '설명' })
  description: string;

  @Column({ comment: '컴포넌트 ID' })
  componentId: number;

  @Column({ length: 255, comment: '데이터셋 구분(데이터셋, 위젯 뷰)', default: DatasetType.TABLE })
  datasetType: DatasetType;

  @Column({ comment: '데이터셋 ID' })
  datasetId: number;

  @Column({ type: 'text', comment: '위젯 속성' })
  option: string;

  @Column({ length: 1, default: YesNo.NO, comment: '삭제여부' })
  delYn: string;

  @ManyToOne(() => Component)
  @JoinColumn({ name: 'componentId' })
  component: Component;

  @ManyToOne(() => Dataset, { nullable: true })
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  @OneToMany(() => DashboardWidget, dashboardWidget => dashboardWidget.widget)
  dashboardWidgets: DashboardWidget[];
}
