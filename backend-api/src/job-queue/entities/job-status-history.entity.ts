import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QueueJob, JobStatus } from './queue-job.entity';

@Entity('job_status_history')
@Index(['jobId', 'createdAt'])
@Index(['status'])
@Index(['createdAt'])
export class JobStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => QueueJob)
  @JoinColumn({ name: 'jobId' })
  job: QueueJob;

  @Column({ type: 'enum', enum: JobStatus })
  status: JobStatus;

  @Column({ type: 'enum', enum: JobStatus, nullable: true })
  previousStatus: JobStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string

  @Column({ type: 'varchar', length: 50, nullable: true })
  changedBy: string; // Worker ID or system component

  @Column({ type: 'int', nullable: true })
  progress: number; // 0-100

  @Column({ type: 'int', nullable: true })
  executionTimeMs: number; // Time spent in this status

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string

  @CreateDateColumn()
  createdAt: Date;

  // Virtual properties
  get detailsParsed(): any {
    try {
      return this.details ? JSON.parse(this.details) : {};
    } catch (error) {
      return {};
    }
  }

  get metadataParsed(): any {
    try {
      return this.metadata ? JSON.parse(this.metadata) : {};
    } catch (error) {
      return {};
    }
  }

  get isErrorStatus(): boolean {
    return this.status === JobStatus.FAILED || this.status === JobStatus.RETRY;
  }

  get isProgressUpdate(): boolean {
    return this.progress !== null && this.progress !== undefined;
  }
}