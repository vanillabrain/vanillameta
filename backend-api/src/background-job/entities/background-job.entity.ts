import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../user/entities/user.entity';
import { Dataset } from '../../dataset/entities/dataset.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { JobResult } from './job-result.entity';

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum JobType {
  QUERY_EXECUTION = 'query_execution',
  REPORT_GENERATION = 'report_generation',
  DATA_EXPORT = 'data_export',
}

@Entity('background_jobs')
@Index('idx_background_job_status', ['status'])
@Index('idx_background_job_user', ['userId'])
@Index('idx_background_job_created', ['createdAt'])
export class BackgroundJob extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: JobType,
    default: JobType.QUERY_EXECUTION,
  })
  jobType: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json' })
  metadata: {
    datasetId?: string;
    widgetId?: string;
    query?: string;
    databaseId?: string;
    parameters?: any;
    [key: string]: any;
  };

  @Column({ type: 'int', default: 0 })
  progress: number; // 0-100 진행률

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  attemptCount: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'bigint', nullable: true })
  processingTimeMs: number;

  // Bull Queue Job ID
  @Column({ type: 'varchar', length: 100, nullable: true })
  queueJobId: string;

  // 사용자 관계
  @Column({ type: 'varchar', length: 100 })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // 데이터셋 관계 (옵션)
  @ManyToOne(() => Dataset, { nullable: true })
  @JoinColumn({ name: 'datasetId' })
  dataset: Dataset;

  // 위젯 관계 (옵션)
  @ManyToOne(() => Widget, { nullable: true })
  @JoinColumn({ name: 'widgetId' })
  widget: Widget;

  // 작업 결과와의 관계
  @OneToOne(() => JobResult, jobResult => jobResult.backgroundJob, { nullable: true })
  jobResult: JobResult;
}
