import { Column, Entity, JoinTable, ManyToMany, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity()
export class Dataset extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '데이터셋 ID' })
  id: number;

  @Column({ comment: '데이터셋명', nullable: true })
  title: string;

  @Column({ comment: '데이터베이스 ID' })
  databaseId: number;

  @Column({ type: 'text', comment: '조회 sql' })
  query: string;

  // @OneToMany(
  //     (type) => Widget,
  //     (widget) => widget.datasetId
  // )
  // widgets!: Widget
}
