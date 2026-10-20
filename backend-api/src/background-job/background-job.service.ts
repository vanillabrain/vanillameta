import {
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BackgroundJob, JobStatus } from './entities/background-job.entity';
import { JobResult, ResultStorageType } from './entities/job-result.entity';
import { CreateBackgroundJobDto } from './dto/create-background-job.dto';
import {
  BackgroundJobResponseDto,
  BackgroundJobListResponseDto,
} from './dto/background-job-response.dto';
import { JobResultResponseDto } from './dto/job-result-response.dto';
import { CustomLoggerService as LoggerService } from '../common/logger/logger.service';
import { SourceAccessService } from '../ownership/source-access.service';
import { LegacyJobActor, assertLegacyActor, assertLegacySource } from './legacy-job-access';
import * as lzString from 'lz-string';

@Injectable()
export class BackgroundJobService {
  constructor(
    @InjectRepository(BackgroundJob)
    private backgroundJobRepository: Repository<BackgroundJob>,
    @InjectRepository(JobResult)
    private jobResultRepository: Repository<JobResult>,
    @Optional()
    @InjectQueue('query-execution')
    private queryQueue: Queue,
    private logger: LoggerService,
    private db: DataSource,
    private access: SourceAccessService,
  ) {}

  async createJob(
    actor: LegacyJobActor,
    createJobDto: CreateBackgroundJobDto,
  ): Promise<BackgroundJobResponseDto> {
    await assertLegacyActor(this.db, actor);
    await assertLegacySource(this.access, 'database', createJobDto.databaseId, actor);
    for (const kind of ['dataset', 'widget'] as const) {
      const id = createJobDto[`${kind}Id`];
      if (id) {
        await assertLegacySource(this.access, kind, id, actor);
        if ((await this.access.sourceId(kind, id)) !== Number(createJobDto.databaseId))
          throw new NotFoundException('Source mismatch');
      }
    }
    if (!this.queryQueue)
      throw new ServiceUnavailableException('Background jobs require configured Redis');
    // 백그라운드 작업 엔티티 생성
    const backgroundJob = new BackgroundJob();
    backgroundJob.userId = actor.userId;
    backgroundJob.jobType = createJobDto.jobType;
    backgroundJob.title = createJobDto.title;
    backgroundJob.description = createJobDto.description;
    backgroundJob.status = JobStatus.PENDING;
    backgroundJob.metadata = JSON.stringify({
      ...createJobDto.metadata,
      actor,
      datasetId: createJobDto.datasetId,
      widgetId: createJobDto.widgetId,
      databaseId: createJobDto.databaseId,
      query: createJobDto.query,
    });

    const savedJob = await this.backgroundJobRepository.save(backgroundJob);

    // Bull 큐에 작업 추가
    await assertLegacyActor(this.db, actor);
    await assertLegacySource(this.access, 'database', createJobDto.databaseId, actor);
    const queueJob = await this.queryQueue.add({
      backgroundJobId: savedJob.id,
      userId: actor.userId,
      query: createJobDto.query,
      databaseId: createJobDto.databaseId,
      datasetId: createJobDto.datasetId,
      parameters: createJobDto.metadata?.parameters,
    });

    // Queue Job ID 저장
    savedJob.queueJobId = String(queueJob.id);
    await this.backgroundJobRepository.save(savedJob);

    this.logger.log(`Created background job ${savedJob.id} for user ${actor.userId}`);

    return this.toResponseDto(savedJob);
  }

  async getJobById(jobId: string, actor: LegacyJobActor): Promise<BackgroundJobResponseDto> {
    await assertLegacyActor(this.db, actor);
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId: actor.userId },
      relations: ['jobResult'],
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    await this.assertJob(job, actor);
    return this.toResponseDto(job);
  }

  async getJobsByUser(
    actor: LegacyJobActor,
    page = 1,
    pageSize = 20,
  ): Promise<BackgroundJobListResponseDto> {
    await assertLegacyActor(this.db, actor);
    const [items, total] = await this.backgroundJobRepository.findAndCount({
      where: { userId: actor.userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['jobResult'],
    });

    for (const job of items) await this.assertJob(job, actor);
    return {
      items: items.map(job => this.toResponseDto(job)),
      total,
      page,
      pageSize,
    };
  }

  async getJobResult(jobId: string, actor: LegacyJobActor): Promise<JobResultResponseDto> {
    await assertLegacyActor(this.db, actor);
    // 작업 확인
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId: actor.userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    await this.assertJob(job, actor);
    if (job.status !== JobStatus.COMPLETED) throw new NotFoundException('Result unavailable');
    // 결과 조회
    const result = await this.jobResultRepository.findOne({
      where: { backgroundJobId: jobId },
    });

    if (!result || (result.expiresAt && result.expiresAt.getTime() <= Date.now())) {
      throw new NotFoundException(`Result for job ${jobId} not found`);
    }

    const current = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId: actor.userId },
    });
    if (!current || current.status !== JobStatus.COMPLETED)
      throw new NotFoundException('Result unavailable');
    await this.assertJob(current, actor);
    return this.toResultResponseDto(result);
  }

  async getJobResultData(jobId: string, actor: LegacyJobActor): Promise<any> {
    const result = await this.getJobResult(jobId, actor);

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

  async cancelJob(jobId: string, actor: LegacyJobActor): Promise<void> {
    await assertLegacyActor(this.db, actor);
    const job = await this.backgroundJobRepository.findOne({
      where: { id: jobId, userId: actor.userId },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    await this.assertJob(job, actor);
    if (job.status !== JobStatus.PENDING && job.status !== JobStatus.PROCESSING) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    // Persist cancellation first: active Bull jobs are locked and cannot be removed.
    await this.assertJob(job, actor);
    job.status = JobStatus.CANCELLED;
    job.completedAt = new Date();
    await this.backgroundJobRepository.save(job);
    if (job.queueJobId && this.queryQueue) {
      try {
        const queued = await this.queryQueue.getJob(job.queueJobId);
        if (queued) await queued.remove();
      } catch {
        this.logger.warn(`Queue removal deferred for cancelled job ${jobId}`);
      }
    }

    this.logger.log(`Cancelled job ${jobId}`);
  }

  async assertJob(job: BackgroundJob, actor: LegacyJobActor): Promise<void> {
    await assertLegacyActor(this.db, actor);
    if (job.userId !== actor.userId) throw new NotFoundException('Job not found');
    const metadata = JSON.parse(job.metadata);
    const admitted = metadata.actor as LegacyJobActor;
    await assertLegacyActor(this.db, admitted);
    if (
      admitted.id !== actor.id ||
      admitted.userId !== actor.userId ||
      admitted.authVersion !== actor.authVersion
    )
      throw new NotFoundException('Job not found');
    await assertLegacySource(this.access, 'database', metadata.databaseId, actor);
    for (const kind of ['dataset', 'widget'] as const) {
      if (metadata[`${kind}Id`]) {
        await assertLegacySource(this.access, kind, metadata[`${kind}Id`], actor);
        if (
          (await this.access.sourceId(kind, metadata[`${kind}Id`])) !== Number(metadata.databaseId)
        )
          throw new NotFoundException('Source mismatch');
      }
    }
    await assertLegacyActor(this.db, actor);
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
      resultData: result.storageType === ResultStorageType.DATABASE ? result.resultData : undefined,
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
