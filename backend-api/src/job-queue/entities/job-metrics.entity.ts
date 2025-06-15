import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { JobType, JobStatus, JobPriority } from './queue-job.entity';

@Entity('job_metrics')
@Index(['jobType', 'status', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['metricDate'])
export class JobMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  metricDate: Date;

  @Column({ type: 'varchar', length: 50 })
  jobType: JobType;

  @Column({ type: 'enum', enum: JobStatus })
  status: JobStatus;

  @Column({ type: 'enum', enum: JobPriority })
  priority: JobPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  jobCount: number;

  @Column({ type: 'bigint', default: 0 })
  totalExecutionTimeMs: number;

  @Column({ type: 'bigint', default: 0 })
  avgExecutionTimeMs: number;

  @Column({ type: 'bigint', default: 0 })
  minExecutionTimeMs: number;

  @Column({ type: 'bigint', default: 0 })
  maxExecutionTimeMs: number;

  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 0 })
  cancelledCount: number;

  @Column({ type: 'float', default: 0 })
  successRate: number; // 0-100

  @Column({ type: 'bigint', default: 0 })
  totalWaitTimeMs: number; // Time from creation to start

  @Column({ type: 'bigint', default: 0 })
  avgWaitTimeMs: number;

  @Column({ type: 'int', default: 0 })
  queueLengthPeak: number; // Maximum queue length for the day

  @Column({ type: 'float', default: 0 })
  avgQueueLength: number;

  @Column({ type: 'int', default: 0 })
  memoryUsagePeakMB: number;

  @Column({ type: 'float', default: 0 })
  avgMemoryUsageMB: number;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'text', nullable: true })
  commonErrors: string; // JSON string with error frequencies

  @Column({ type: 'text', nullable: true })
  performanceMetrics: string; // JSON string with additional metrics

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Virtual properties
  get commonErrorsParsed(): any {
    try {
      return this.commonErrors ? JSON.parse(this.commonErrors) : {};
    } catch (error) {
      return {};
    }
  }

  get performanceMetricsParsed(): any {
    try {
      return this.performanceMetrics ? JSON.parse(this.performanceMetrics) : {};
    } catch (error) {
      return {};
    }
  }

  get avgExecutionTimeSeconds(): number {
    return Math.round(this.avgExecutionTimeMs / 1000);
  }

  get avgWaitTimeSeconds(): number {
    return Math.round(this.avgWaitTimeMs / 1000);
  }

  get isHealthy(): boolean {
    return this.successRate >= 90 && this.avgExecutionTimeMs < 300000; // 5 minutes
  }

  get performanceGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (this.successRate >= 98 && this.avgExecutionTimeMs < 30000) return 'A';
    if (this.successRate >= 95 && this.avgExecutionTimeMs < 60000) return 'B';
    if (this.successRate >= 90 && this.avgExecutionTimeMs < 180000) return 'C';
    if (this.successRate >= 80 && this.avgExecutionTimeMs < 300000) return 'D';
    return 'F';
  }
}