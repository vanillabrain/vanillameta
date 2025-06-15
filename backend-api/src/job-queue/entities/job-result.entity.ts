import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { QueueJob } from './queue-job.entity';

export enum ResultType {
  QUERY_RESULT = 'query_result',
  FILE_DOWNLOAD = 'file_download',
  REPORT_URL = 'report_url',
  DASHBOARD_DATA = 'dashboard_data',
  NOTIFICATION = 'notification',
  ERROR_REPORT = 'error_report',
}

@Entity('job_results')
@Index(['jobId'])
@Index(['resultType'])
@Index(['createdAt'])
export class JobResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @OneToOne(() => QueueJob)
  @JoinColumn({ name: 'jobId' })
  job: QueueJob;

  @Column({ type: 'varchar', length: 50 })
  resultType: ResultType;

  @Column({ type: 'text', nullable: true })
  resultData: string; // JSON string

  @Column({ type: 'varchar', length: 255, nullable: true })
  downloadUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string;

  @Column({ type: 'bigint', nullable: true })
  fileSizeBytes: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  isDownloaded: boolean;

  @Column({ type: 'int', default: 0 })
  downloadCount: number;

  @Column({ type: 'text', nullable: true })
  metadata: string; // JSON string

  @CreateDateColumn()
  createdAt: Date;

  // Virtual properties
  get resultDataParsed(): any {
    try {
      return this.resultData ? JSON.parse(this.resultData) : null;
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

  get isExpired(): boolean {
    return this.expiresAt && this.expiresAt < new Date();
  }

  get isAvailableForDownload(): boolean {
    return !this.isExpired && !!this.downloadUrl;
  }
}