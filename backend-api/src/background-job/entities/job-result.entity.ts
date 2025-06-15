import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BackgroundJob } from './background-job.entity';

export enum ResultStorageType {
  DATABASE = 'database',
  S3 = 's3',
  REDIS = 'redis',
}

@Entity('job_results')
@Index('idx_job_result_job_id', ['backgroundJobId'])
export class JobResult extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  backgroundJobId: string;

  @OneToOne(() => BackgroundJob, job => job.jobResult)
  @JoinColumn({ name: 'backgroundJobId' })
  backgroundJob: BackgroundJob;

  @Column({
    type: 'enum',
    enum: ResultStorageType,
    default: ResultStorageType.DATABASE,
  })
  storageType: ResultStorageType;

  // 작은 결과는 직접 저장 (1MB 이하)
  @Column({ type: 'json', nullable: true })
  resultData: any;

  // 큰 결과는 외부 저장소 참조
  @Column({ type: 'varchar', length: 500, nullable: true })
  storageLocation: string; // S3 URL 또는 Redis 키

  @Column({ type: 'bigint', default: 0 })
  resultSizeBytes: number;

  @Column({ type: 'int', default: 0 })
  rowCount: number;

  @Column({ type: 'json', nullable: true })
  resultMetadata: {
    columns?: Array<{
      name: string;
      type: string;
    }>;
    executionTime?: number;
    [key: string]: any;
  };

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  expiresAt: Date; // 결과 만료 시간 (기본 7일)

  @Column({ type: 'boolean', default: false })
  isCompressed: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  compressionType: string; // gzip, lz-string 등
}
