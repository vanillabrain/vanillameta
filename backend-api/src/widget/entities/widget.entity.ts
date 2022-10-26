import { Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { DatasetType } from '../../common/enum/dataset-type.enum';
import { YesNo } from '../../common/enum/yn.enum';
import { Component } from '../../component/entities/component.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';

@Entity()
export class Widget extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '위젯 ID' })
  id: number;

  @Column({ length: 300, nullable: true, comment: '위젯명' })
  title: string;

  @Column({ length: 1000, nullable: true, comment: '설명' })
  description: string;

  @Column({ comment: '컴포넌트 ID' })
  componentId: number;

  @Column({ comment: '데이터셋 구분(데이터셋, 위젯 뷰)', default: DatasetType.TABLE })
  datasetType: DatasetType;

  @Column({ comment: '데이터셋 ID' })
  datasetId: number;

  @Column({ type: 'text', comment: '위젯 속성' })
  option: string;

  @Column({ length: 1, default: YesNo.NO, comment: '삭제여부' })
  delYn: YesNo;

  @ManyToMany(type => Dashboard)
  @JoinTable({
    name: 'dashboard_widget',
    // joinColumn: {
    //     name: 'widgetId',
    //     referencedColumnName: 'id'
    // },
    inverseJoinColumn: {
      name: 'dashboardId',
      referencedColumnName: 'id',
    },
  })
  databases: Dashboard[];

  @ManyToOne(type => Component, component => component)
  component!: Component;
}
