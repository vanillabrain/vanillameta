import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BatchJob } from './batch-job.entity';

export enum BatchChunkStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('batch_chunks')
@Index(['batchJobId', 'status'])
@Index(['batchJobId', 'sequence'])
export class BatchChunk extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    comment: '배치 작업 ID',
  })
  batchJobId: number;

  @Column({
    type: 'int',
    comment: '청크 순서',
  })
  sequence: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: BatchChunkStatus.PENDING,
    comment: '청크 상태',
  })
  status: BatchChunkStatus;

  @Column({
    type: 'int',
    comment: '시작 오프셋',
  })
  startOffset: number;

  @Column({
    type: 'int',
    comment: '종료 오프셋',
  })
  endOffset: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '레코드 수',
  })
  recordCount: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '처리된 레코드 수',
  })
  processedCount: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '재시도 횟수',
  })
  retryCount: number;

  @Column({
    type: 'int',
    default: 3,
    comment: '최대 재시도 횟수',
  })
  maxRetries: number;

  @Column({
    type: 'text',
    nullable: true,
    comment: '청크 메타데이터',
  })
  metadata: {
    startId?: number;
    endId?: number;
    filters?: any;
    lastProcessedId?: number;
  };

  @Column({
    type: 'text',
    nullable: true,
    comment: '결과 데이터 위치',
  })
  resultPath: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: '에러 메시지',
  })
  errorMessage: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: '에러 상세',
  })
  errorDetails: any;

  @Column({
    type: 'datetime',
    nullable: true,
    comment: '시작 시간',
  })
  startedAt: Date;

  @Column({
    type: 'datetime',
    nullable: true,
    comment: '완료 시간',
  })
  completedAt: Date;

  @Column({
    type: 'datetime',
    nullable: true,
    comment: '다음 재시도 시간',
  })
  nextRetryAt: Date;

  // Relations
  @ManyToOne(() => BatchJob, job => job.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'batchJobId' })
  batchJob: BatchJob;

  // 처리 시간 계산 (밀리초)
  get processingTime(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  // 재시도 가능 여부
  get canRetry(): boolean {
    return this.status === BatchChunkStatus.FAILED && this.retryCount < this.maxRetries;
  }

  // 진행률 계산
  get progress(): number {
    if (this.recordCount === 0) return 0;
    return Math.round((this.processedCount / this.recordCount) * 100);
  }
}
