import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BackgroundJob, JobStatus, JobType } from './entities/background-job.entity';
import { JobResult, ResultStorageType } from './entities/job-result.entity';
import { CreateBackgroundJobDto } from './dto/create-background-job.dto';
import {
  BackgroundJobResponseDto,
  BackgroundJobListResponseDto,
} from './dto/background-job-response.dto';
import { JobResultResponseDto } from './dto/job-result-response.dto';
import { CustomLoggerService as LoggerService } from '../common/logger/logger.service';
import * as lzString from 'lz-string';

@Injectable()
export class BackgroundJobService {
  constructor(
    @InjectRepository(BackgroundJob)
    private backgroundJobRepository: Repository<BackgroundJob>,
    @InjectRepository(JobResult)
    private jobResultRepository: Repository<JobResult>,
    @InjectQueue('query-execution')
    private queryQueue: Queue,
    private logger: LoggerService,
  ) {}

  async createJob(
    userId: string,
    createJobDto: CreateBackgroundJobDto,
  ): Promise<BackgroundJobResponseDto> {
    // 백그라운드 작업 엔티티 생성
    const backgroundJob = new BackgroundJob();
    backgroundJob.userId = userId;
    backgroundJob.jobType = createJobDto.jobType;
    backgroundJob.title = createJobDto.title;
    backgroundJob.description = createJobDto.description;
    backgroundJob.status = JobStatus.PENDING;
    backgroundJob.metadata = JSON.stringify({
      datasetId: createJobDto.datasetId,
      widgetId: createJobDto.widgetId,
      databaseId: createJobDto.databaseId,
      query: createJobDto.query,
      ...createJobDto.metadata,
    });

    const savedJob = await this.backgroundJobRepository.save(backgroundJob);

    // Bull 큐에 작업 추가
    const queueJob = await this.queryQueue.add({
      backgroundJobId: savedJob.id,
      userId,
      query: createJobDto.query,
      databaseId: createJobDto.databaseId,
      datasetId: createJobDto.datasetId,
      parameters: createJobDto.metadata?.parameters,
    });

    // Queue Job ID 저장
    savedJob.queueJobId = String(queueJob.id);
    await this.backgroundJobRepository.save(savedJob);

    this.logger.log(`Created background job ${savedJob.id} for user ${userId}`);

    return this.toResponseDto(savedJob);
  }

  async getJobById(jobId: string, userId: string): Promise<BackgroundJobResponseDto> {
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId },
      relations: ['jobResult'],
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    return this.toResponseDto(job);
  }

  async getJobsByUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<BackgroundJobListResponseDto> {
    const [items, total] = await this.backgroundJobRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['jobResult'],
    });

    return {
      items: items.map(job => this.toResponseDto(job)),
      total,
      page,
      pageSize,
    };
  }

  async getJobResult(jobId: string, userId: string): Promise<JobResultResponseDto> {
    // 작업 확인
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // 결과 조회
    const result = await this.jobResultRepository.findOne({
      where: { backgroundJobId: jobId },
    });

    if (!result) {
      throw new NotFoundException(`Result for job ${jobId} not found`);
    }

    return this.toResultResponseDto(result);
  }

  async getJobResultData(jobId: string, userId: string): Promise<any> {
    const result = await this.getJobResult(jobId, userId);

    // 저장 타입에 따라 데이터 반환
    if (result.storageType === ResultStorageType.DATABASE) {
      if (result.isCompressed && result.compressionType === 'lz-string') {
        // 압축된 데이터 해제
        const decompressed = lzString.decompressFromUTF16(result.resultData);
        return JSON.parse(decompressed);
      }
      return result.resultData;
    } else if (result.storageType === ResultStorageType.REDIS) {
      // Redis에서 데이터 조회 (추후 구현)
      throw new Error('Redis storage not implemented yet');
    } else if (result.storageType === ResultStorageType.S3) {
      // S3 다운로드 URL 반환 (추후 구현)
      throw new Error('S3 storage not implemented yet');
    }

    throw new Error(`Unknown storage type: ${result.storageType}`);
  }

  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.PROCESSING) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    // Bull 큐에서 작업 취소
    if (job.queueJobId) {
      const queueJob = await this.queryQueue.getJob(job.queueJobId);
      if (queueJob) {
        await queueJob.remove();
      }
    }

    // 상태 업데이트
    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    await this.backgroundJobRepository.save(job);

    this.logger.log(`Cancelled job ${jobId}`);
  }

  async cleanupExpiredResults(): Promise<number> {
    // 만료된 결과 정리 (스케줄러에서 호출)
    const expiredResults = await this.jobResultRepository
      .createQueryBuilder('result')
      .where('result.expiresAt < :now', { now: new Date() })
      .getMany();

    for (const result of expiredResults) {
      // 외부 저장소 정리 (S3, Redis)
      if (result.storageType === ResultStorageType.REDIS) {
        // Redis 키 삭제 (추후 구현)
      } else if (result.storageType === ResultStorageType.S3) {
        // S3 객체 삭제 (추후 구현)
      }

      await this.jobResultRepository.remove(result);
    }

    this.logger.log(`Cleaned up ${expiredResults.length} expired job results`);
    return expiredResults.length;
  }

  private toResponseDto(job: BackgroundJob): BackgroundJobResponseDto {
    return {
      id: job.id,
      jobType: job.jobType,
      status: job.status,
      title: job.title,
      description: job.description,
      progress: job.progress,
      errorMessage: job.errorMessage,
      attemptCount: job.attemptCount,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      processingTimeMs: job.processingTimeMs ? Number(job.processingTimeMs) : undefined,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      hasResult: !!job.jobResult,
      resultSizeBytes: job.jobResult?.resultSizeBytes
        ? Number(job.jobResult.resultSizeBytes)
        : undefined,
      rowCount: job.jobResult?.rowCount,
    };
  }

  private toResultResponseDto(result: JobResult): JobResultResponseDto {
    return {
      id: result.id,
      backgroundJobId: result.backgroundJobId,
      storageType: result.storageType,
      resultData:
        result.storageType === ResultStorageType.DATABASE && !result.isCompressed
          ? result.resultData
          : undefined,
      storageLocation: result.storageLocation,
      downloadUrl:
        result.storageType === ResultStorageType.S3
          ? this.generateDownloadUrl(result.storageLocation)
          : undefined,
      resultSizeBytes: Number(result.resultSizeBytes),
      rowCount: result.rowCount,
      resultMetadata: result.resultMetadata ? JSON.parse(result.resultMetadata) : null,
      expiresAt: result.expiresAt,
      isCompressed: result.isCompressed,
      compressionType: result.compressionType,
      createdAt: result.createdAt,
    };
  }

  private generateDownloadUrl(s3Location: string): string {
    // S3 pre-signed URL 생성 (추후 구현)
    return `https://download.example.com/${s3Location}`;
  }
}
