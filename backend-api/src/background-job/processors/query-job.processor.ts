import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackgroundJob, JobStatus } from '../entities/background-job.entity';
import { JobResult, ResultStorageType } from '../entities/job-result.entity';
import { DatasetService } from '../../dataset/dataset.service';
import { DatabaseService } from '../../database/database.service';
import { ConnectionService } from '../../connection/connection.service';
import { CustomLoggerService as LoggerService } from '../../common/logger/logger.service';
import * as lzString from 'lz-string';
import { v4 as uuidv4 } from 'uuid';

const MAX_DB_RESULT_SIZE = 1024 * 1024; // 1MB

interface QueryJobData {
  backgroundJobId: string;
  userId: string;
  query: string;
  databaseId: string;
  datasetId?: string;
  parameters?: any;
}

@Processor('query-execution')
@Injectable()
export class QueryJobProcessor {
  constructor(
    @InjectRepository(BackgroundJob)
    private backgroundJobRepository: Repository<BackgroundJob>,
    @InjectRepository(JobResult)
    private jobResultRepository: Repository<JobResult>,
    private datasetService: DatasetService,
    private databaseService: DatabaseService,
    private connectionService: ConnectionService,
    private logger: LoggerService,
  ) {}

  @Process()
  async handleQueryExecution(job: Job<QueryJobData>) {
    const { backgroundJobId, userId, query, databaseId, parameters } = job.data;
    const startTime = Date.now();

    try {
      // 작업 상태를 처리 중으로 업데이트
      await this.updateJobStatus(backgroundJobId, JobStatus.PROCESSING, {
        startedAt: new Date(),
        progress: 10,
      });

      // 진행률 업데이트 헬퍼
      const updateProgress = async (progress: number) => {
        await this.updateJobStatus(backgroundJobId, JobStatus.PROCESSING, { progress });
        await job.progress(progress);
      };

      // 1. 데이터베이스 연결 확인
      await updateProgress(20);
      const database = await this.databaseService.findOne(Number(databaseId));
      if (!database) {
        throw new Error(`Database not found: ${databaseId}`);
      }

      // 2. 쿼리 실행
      await updateProgress(30);
      this.logger.log(`Executing query for job ${backgroundJobId}`);

      const queryResult = await this.connectionService.executeQuery({
        id: Number(databaseId),
        query,
      });

      await updateProgress(70);

      // 3. 결과 처리 및 저장
      const processedResult = await this.processAndStoreResult(backgroundJobId, queryResult, job);

      await updateProgress(90);

      // 4. 작업 완료 처리
      const processingTimeMs = Date.now() - startTime;
      await this.updateJobStatus(backgroundJobId, JobStatus.COMPLETED, {
        completedAt: new Date(),
        processingTimeMs,
        progress: 100,
      });

      this.logger.log(`Job ${backgroundJobId} completed successfully in ${processingTimeMs}ms`);

      return {
        success: true,
        resultId: processedResult.id,
        rowCount: processedResult.rowCount,
        processingTimeMs,
      };
    } catch (error) {
      this.logger.error(`Job ${backgroundJobId} failed`, error.stack);

      // 작업 실패 처리
      await this.updateJobStatus(backgroundJobId, JobStatus.FAILED, {
        errorMessage: error.message,
        attemptCount: job.attemptsMade,
        completedAt: new Date(),
        processingTimeMs: Date.now() - startTime,
      });

      throw error; // Bull이 재시도할 수 있도록 에러를 다시 던짐
    }
  }

  private async updateJobStatus(jobId: string, status: JobStatus, updates: Partial<BackgroundJob>) {
    await this.backgroundJobRepository.update(jobId, {
      status,
      ...updates,
      updatedAt: new Date(),
    });
  }

  private async processAndStoreResult(
    backgroundJobId: string,
    queryResult: any,
    job: Job,
  ): Promise<JobResult> {
    const resultString = JSON.stringify(queryResult);
    const resultSizeBytes = Buffer.byteLength(resultString, 'utf8');

    const jobResult = new JobResult();
    jobResult.backgroundJobId = backgroundJobId;
    jobResult.rowCount = Array.isArray(queryResult.datas) ? queryResult.datas.length : 0;
    jobResult.resultSizeBytes = resultSizeBytes;
    jobResult.resultMetadata = JSON.stringify({
      columns: queryResult.fields || [],
      executionTime: queryResult.executionTime,
    });

    // 결과 크기에 따라 저장 전략 결정
    if (resultSizeBytes <= MAX_DB_RESULT_SIZE) {
      // 작은 결과는 DB에 직접 저장
      jobResult.storageType = ResultStorageType.DATABASE;
      jobResult.resultData = JSON.stringify(queryResult);
      jobResult.isCompressed = false;

      await job.progress(80);
    } else {
      // 큰 결과는 압축하여 저장하거나 S3 사용
      const compressed = lzString.compressToUTF16(resultString);
      const compressedSize = Buffer.byteLength(compressed, 'utf16le');

      if (compressedSize <= MAX_DB_RESULT_SIZE) {
        // 압축 후 DB에 저장
        jobResult.storageType = ResultStorageType.DATABASE;
        jobResult.resultData = compressed;
        jobResult.isCompressed = true;
        jobResult.compressionType = 'lz-string';
        jobResult.resultSizeBytes = compressedSize;

        await job.progress(85);
      } else {
        // S3에 저장 (추후 구현)
        // 현재는 Redis에 임시 저장
        jobResult.storageType = ResultStorageType.REDIS;
        jobResult.storageLocation = `job-result:${backgroundJobId}`;
        jobResult.isCompressed = false;

        // Redis 저장 로직은 추후 구현
        this.logger.warn(`Large result for job ${backgroundJobId} needs external storage`);

        await job.progress(85);
      }
    }

    // 만료 시간 설정 (7일)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    jobResult.expiresAt = expiresAt;

    return await this.jobResultRepository.save(jobResult);
  }
}
