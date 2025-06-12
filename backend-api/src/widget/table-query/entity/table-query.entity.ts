import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity()
export class TableQuery extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '테이블 쿼리 ID' })
  id: number;

  @Column({ comment: '데이터베이스 ID' })
  databaseId: number;

  @Column({ type: 'text', comment: '조회 sql' })
  query: string;
}
