import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRY = 'retry',
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
}

export enum JobType {
  QUERY_EXECUTION = 'query_execution',
  BULK_DATA_EXPORT = 'bulk_data_export',
  DASHBOARD_GENERATION = 'dashboard_generation',
  DATA_MIGRATION = 'data_migration',
  CACHE_WARMUP = 'cache_warmup',
  REPORT_GENERATION = 'report_generation',
}

@Entity('queue_jobs')
@Index(['status', 'priority', 'scheduledAt'])
@Index(['userId', 'status'])
@Index(['jobType', 'status'])
export class QueueJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  jobType: JobType;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;

  @Column({ type: 'enum', enum: JobPriority, default: JobPriority.NORMAL })
  priority: JobPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'text' })
  jobData: string; // JSON string

  @Column({ type: 'text', nullable: true })
  result: string; // JSON string

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  errorStack: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'int', nullable: true })
  progress: number; // 0-100

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'int', nullable: true })
  executionTimeMs: number;

  @Column({ type: 'int', nullable: true })
  estimatedTimeMs: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  workerId: string; // Lambda instance ID or worker ID

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string for additional data

  @Column({ type: 'varchar', length: 100, nullable: true })
  correlationId: string; // For tracking related jobs

  @Column({ type: 'boolean', default: false })
  requiresNotification: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notificationEmail: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual properties for convenience
  get isCompleted(): boolean {
    return this.status === JobStatus.COMPLETED;
  }

  get isFailed(): boolean {
    return this.status === JobStatus.FAILED;
  }

  get isRunning(): boolean {
    return this.status === JobStatus.RUNNING;
  }

  get canRetry(): boolean {
    return (
      this.retryCount < this.maxRetries &&
      (this.status === JobStatus.FAILED || this.status === JobStatus.RETRY)
    );
  }

  get jobDataParsed(): any {
    try {
      return JSON.parse(this.jobData);
    } catch (error) {
      return {};
    }
  }

  get resultParsed(): any {
    try {
      return this.result ? JSON.parse(this.result) : null;
    } catch (error) {
      return null;
    }
  }

  get metadataParsed(): any {
    try {
      return this.metadata ? JSON.parse(this.metadata) : {};
    } catch (error) {
      return {};
    }
  }
}
