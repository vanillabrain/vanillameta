import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { BaseEntity } from '../../entities/base.entity';

@Entity('slow_query_logs')
@Index(['executionTime', 'createdAt'])
@Index(['databaseId', 'createdAt'])
@Index(['queryHash'])
export class SlowQueryLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32, comment: '쿼리 해시값 (중복 방지용)' })
  queryHash: string;

  @Column({ type: 'text', comment: '실행된 SQL 쿼리' })
  query: string;

  @Column({ type: 'text', nullable: true, comment: '쿼리 파라미터 (JSON)' })
  parameters: string;

  @Column({ type: 'int', comment: '실행 시간 (ms)' })
  executionTime: number;

  @Column({ type: 'int', nullable: true, comment: '데이터베이스 ID' })
  databaseId: number;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '데이터베이스 엔진' })
  databaseEngine: string;

  @Column({ type: 'bigint', nullable: true, comment: '검사된 행 수' })
  rowsExamined: number;

  @Column({ type: 'bigint', nullable: true, comment: '반환된 행 수' })
  rowsReturned: number;

  @Column({ type: 'boolean', default: false, comment: '인덱스 사용 여부' })
  indexUsed: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '스캔 타입' })
  scanType: string;

  @Column({ type: 'boolean', default: false, comment: '임시 테이블 사용 여부' })
  temporaryTable: boolean;

  @Column({ type: 'boolean', default: false, comment: '파일 정렬 사용 여부' })
  filesort: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, comment: '쿼리 비용' })
  cost: number;

  @Column({ type: 'text', nullable: true, comment: '경고 메시지 (JSON)' })
  warnings: string;

  @Column({ type: 'text', nullable: true, comment: '최적화 제안 (JSON)' })
  optimizationSuggestions: string;

  @Column({ type: 'json', nullable: true, comment: '실행 계획' })
  explainPlan: any;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '사용자 ID' })
  userId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '요청 경로' })
  requestPath: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: 'HTTP 메소드' })
  httpMethod: string;

  @Column({ type: 'varchar', length: 45, nullable: true, comment: '클라이언트 IP' })
  clientIp: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: 'User Agent' })
  userAgent: string;

  @Column({ type: 'varchar', length: 36, nullable: true, comment: '요청 ID (추적용)' })
  requestId: string;

  @CreateDateColumn({ comment: '감지 시간' })
  detectedAt: Date;

  @Column({ type: 'enum', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM', comment: '심각도' })
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ type: 'boolean', default: false, comment: '처리 완료 여부' })
  resolved: boolean;

  @Column({ type: 'text', nullable: true, comment: '처리 메모' })
  resolutionNotes: string;

  @Column({ type: 'datetime', nullable: true, comment: '처리 완료 시간' })
  resolvedAt: Date;
}