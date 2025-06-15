import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BatchChunk } from './batch-chunk.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { Widget } from '../../widget/entities/widget.entity';

export enum BatchJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum BatchJobType {
  DATASET_QUERY = 'dataset_query',
  WIDGET_DATA = 'widget_data',
  EXPORT_DATA = 'export_data',
}

@Entity('batch_jobs')
@Index(['status', 'createdAt'])
@Index(['datasetId', 'status'])
@Index(['widgetId', 'status'])
export class BatchJob extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: BatchJobType,
    comment: '배치 작업 유형',
  })
  type: BatchJobType;

  @Column({
    type: 'enum',
    enum: BatchJobStatus,
    default: BatchJobStatus.PENDING,
    comment: '배치 작업 상태',
  })
  status: BatchJobStatus;

  @Column({
    type: 'int',
    default: 0,
    comment: '전체 레코드 수',
  })
  totalRecords: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '처리된 레코드 수',
  })
  processedRecords: number;

  @Column({
    type: 'int',
    default: 1000,
    comment: '청크 크기',
  })
  chunkSize: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '전체 청크 수',
  })
  totalChunks: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '완료된 청크 수',
  })
  completedChunks: number;

  @Column({
    type: 'int',
    default: 0,
    comment: '실패한 청크 수',
  })
  failedChunks: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '작업 메타데이터',
  })
  metadata: Record<string, any>;

  @Column({
    type: 'json',
    nullable: true,
    comment: '작업 설정',
  })
  config: {
    query?: string;
    databaseId?: number;
    filters?: any;
    options?: any;
  };

  @Column({
    type: 'text',
    nullable: true,
    comment: '에러 메시지',
  })
  errorMessage: string;

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
    nullable: true,
    comment: '데이터셋 ID',
  })
  datasetId: number;

  @Column({
    nullable: true,
    comment: '위젯 ID',
  })
  widgetId: number;

  @Column({
    comment: '생성자 ID',
  })
  createdBy: string;

  // Relations
  @ManyToOne(() => Dataset, { nullable: true })
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  @ManyToOne(() => Widget, { nullable: true })
  @JoinColumn({ name: 'widgetId' })
  widget: Widget;

  @OneToMany(() => BatchChunk, chunk => chunk.batchJob, {
    cascade: true,
  })
  chunks: BatchChunk[];

  // 진행률 계산
  get progress(): number {
    if (this.totalRecords === 0) return 0;
    return Math.round((this.processedRecords / this.totalRecords) * 100);
  }

  // 예상 남은 시간 계산
  get estimatedTimeRemaining(): number | null {
    if (!this.startedAt || this.processedRecords === 0) return null;

    const elapsedMs = Date.now() - this.startedAt.getTime();
    const recordsPerMs = this.processedRecords / elapsedMs;
    const remainingRecords = this.totalRecords - this.processedRecords;

    return Math.round(remainingRecords / recordsPerMs);
  }
}
