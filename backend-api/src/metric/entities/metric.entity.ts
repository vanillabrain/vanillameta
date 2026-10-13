import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { YesNo } from '../../common/enum/yn.enum';

export enum MetricAggregation {
  SUM = 'SUM',
  AVG = 'AVG',
  COUNT = 'COUNT',
  MIN = 'MIN',
  MAX = 'MAX',
  COUNT_DISTINCT = 'COUNT_DISTINCT',
}

/**
 * 시맨틱 레이어: 재사용 가능한 지표(metric) 정의
 * name으로 참조되는 집계 정의를 저장하고, evaluate 시 검증된 SQL로 평가한다.
 */
@Entity()
export class Metric extends BaseEntity {
  @PrimaryGeneratedColumn({ comment: '메트릭 ID' })
  id: number;

  @Column({ type: 'text', nullable: true, comment: 'Immutable structured definition version 1' })
  definition: string;

  @Column({ unique: true, length: 100, comment: '메트릭명' })
  name: string;

  @Column({ length: 500, nullable: true, comment: '설명' })
  description: string;

  @Column({ comment: '데이터베이스 ID' })
  databaseId: number;

  @Column({ length: 255, comment: '테이블명' })
  tableName: string;

  @Column({ length: 20, comment: '집계 함수' })
  aggregation: MetricAggregation;

  @Column({ length: 255, comment: '집계 대상 컬럼' })
  expression: string;

  @Column({ length: 255, nullable: true, comment: '그룹핑 컬럼' })
  groupBy: string;

  @Column({ type: 'text', nullable: true, comment: '필터 조건 JSON [{column,op,value}]' })
  filters: string;

  @Column({ type: 'varchar', length: 1, comment: '사용여부', default: YesNo.YES })
  useYn: string;
}
