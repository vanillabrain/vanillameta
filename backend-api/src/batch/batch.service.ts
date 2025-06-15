import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { BatchJob, BatchJobStatus, BatchJobType } from './entities/batch-job.entity';
import { BatchChunk, BatchChunkStatus } from './entities/batch-chunk.entity';
import { CreateBatchJobDto } from './dto/create-batch-job.dto';
import { DatasetService } from '../dataset/dataset.service';
import { WidgetService } from '../widget/widget.service';
import { ConnectionService } from '../connection/connection.service';
import { CustomLoggerService as LoggerService } from '../common/logger/logger.service';
import { Knex } from 'knex';

@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(BatchJob)
    private batchJobRepository: Repository<BatchJob>,
    @InjectRepository(BatchChunk)
    private batchChunkRepository: Repository<BatchChunk>,
    private datasetService: DatasetService,
    private widgetService: WidgetService,
    private connectionService: ConnectionService,
    private logger: LoggerService,
    private dataSource: DataSource,
  ) {}

  /**
   * 배치 작업 생성
   */
  async createBatchJob(createBatchJobDto: CreateBatchJobDto, userId: string): Promise<BatchJob> {
    const { type, chunkSize = 1000, datasetId, widgetId, config, metadata } = createBatchJobDto;

    // 유효성 검증
    if (type === BatchJobType.DATASET_QUERY && !datasetId) {
      throw new BadRequestException('datasetId is required for DATASET_QUERY type');
    }
    if (type === BatchJobType.WIDGET_DATA && !widgetId) {
      throw new BadRequestException('widgetId is required for WIDGET_DATA type');
    }

    // 배치 작업 생성
    const batchJob = this.batchJobRepository.create({
      type,
      chunkSize,
      datasetId,
      widgetId,
      config,
      metadata,
      createdBy: userId,
      status: BatchJobStatus.PENDING,
    });

    await this.batchJobRepository.save(batchJob);

    // 비동기로 청크 생성 및 처리 시작
    this.initializeBatchJob(batchJob).catch(error => {
      this.logger.error(`Failed to initialize batch job ${batchJob.id}`, error);
    });

    return batchJob;
  }

  /**
   * 배치 작업 초기화 및 청크 생성
   */
  private async initializeBatchJob(batchJob: BatchJob): Promise<void> {
    try {
      // 전체 레코드 수 조회
      const totalRecords = await this.getTotalRecordCount(batchJob);

      if (totalRecords === 0) {
        await this.updateBatchJobStatus(batchJob.id, BatchJobStatus.COMPLETED, {
          totalRecords: 0,
          completedAt: new Date(),
        });
        return;
      }

      // 청크 생성
      const totalChunks = Math.ceil(totalRecords / batchJob.chunkSize);
      const chunks: Partial<BatchChunk>[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const startOffset = i * batchJob.chunkSize;
        const endOffset = Math.min((i + 1) * batchJob.chunkSize, totalRecords);

        chunks.push({
          batchJobId: batchJob.id,
          sequence: i,
          startOffset,
          endOffset,
          recordCount: endOffset - startOffset,
          status: BatchChunkStatus.PENDING,
          metadata: {},
        });
      }

      // 청크 저장
      await this.batchChunkRepository.save(chunks);

      // 배치 작업 상태 업데이트
      await this.updateBatchJobStatus(batchJob.id, BatchJobStatus.PROCESSING, {
        totalRecords,
        totalChunks,
        startedAt: new Date(),
      });

      // 청크 처리 시작
      this.processBatchChunks(batchJob.id).catch(error => {
        this.logger.error(`Failed to process batch chunks for job ${batchJob.id}`, error);
      });
    } catch (error) {
      await this.updateBatchJobStatus(batchJob.id, BatchJobStatus.FAILED, {
        errorMessage: error.message,
        completedAt: new Date(),
      });
      throw error;
    }
  }

  /**
   * 전체 레코드 수 조회
   */
  private async getTotalRecordCount(batchJob: BatchJob): Promise<number> {
    try {
      if (batchJob.type === BatchJobType.DATASET_QUERY) {
        const dataset = await this.datasetService.findOne(batchJob.datasetId);
        const knex = await this.connectionService.getKnex(dataset.databaseId);

        // COUNT 쿼리 실행
        const countQuery = this.buildCountQuery(knex, dataset.query);
        const result = await countQuery;

        return result[0]?.count || 0;
      }

      // 다른 타입의 경우 구현 필요
      return 0;
    } catch (error) {
      this.logger.error('Failed to get total record count', error);
      throw error;
    }
  }

  /**
   * COUNT 쿼리 생성
   */
  private buildCountQuery(knex: Knex, originalQuery: string): Knex.Raw {
    // 간단한 구현 - 실제로는 더 복잡한 쿼리 파싱 필요
    return knex.raw(`SELECT COUNT(*) as count FROM (${originalQuery}) as subquery`);
  }

  /**
   * 배치 청크 처리
   */
  private async processBatchChunks(batchJobId: number): Promise<void> {
    const CONCURRENT_CHUNKS = 3; // 동시 처리 청크 수

    while (true) {
      // 대기 중인 청크 조회
      const pendingChunks = await this.batchChunkRepository.find({
        where: {
          batchJobId,
          status: In([BatchChunkStatus.PENDING, BatchChunkStatus.RETRYING]),
        },
        order: { sequence: 'ASC' },
        take: CONCURRENT_CHUNKS,
      });

      if (pendingChunks.length === 0) {
        // 모든 청크 처리 완료 확인
        await this.checkBatchJobCompletion(batchJobId);
        break;
      }

      // 병렬 처리
      await Promise.all(pendingChunks.map(chunk => this.processChunk(chunk)));
    }
  }

  /**
   * 개별 청크 처리
   */
  private async processChunk(chunk: BatchChunk): Promise<void> {
    try {
      // 청크 상태를 처리 중으로 변경
      await this.updateChunkStatus(chunk.id, BatchChunkStatus.PROCESSING, {
        startedAt: new Date(),
      });

      const batchJob = await this.batchJobRepository.findOne({
        where: { id: chunk.batchJobId },
        relations: ['dataset'],
      });

      if (!batchJob) {
        throw new Error('Batch job not found');
      }

      // 실제 데이터 처리
      const processedCount = await this.processChunkData(batchJob, chunk);

      // 청크 완료 처리
      await this.updateChunkStatus(chunk.id, BatchChunkStatus.COMPLETED, {
        processedCount,
        completedAt: new Date(),
      });

      // 배치 작업 진행 상황 업데이트
      await this.updateBatchJobProgress(batchJob.id, processedCount);
    } catch (error) {
      await this.handleChunkError(chunk, error);
    }
  }

  /**
   * 청크 데이터 처리
   */
  private async processChunkData(batchJob: BatchJob, chunk: BatchChunk): Promise<number> {
    if (batchJob.type === BatchJobType.DATASET_QUERY) {
      const dataset = await this.datasetService.findOne(batchJob.datasetId);
      const knex = await this.connectionService.getKnex(dataset.databaseId);

      // LIMIT/OFFSET을 사용한 청크 쿼리
      const chunkQuery = this.buildChunkQuery(
        knex,
        dataset.query,
        chunk.startOffset,
        chunk.endOffset - chunk.startOffset,
      );

      const results = await chunkQuery;

      // 여기서 실제 데이터 처리 로직 구현
      // 예: 파일 저장, 변환, 집계 등

      return results.length;
    }

    return 0;
  }

  /**
   * 청크 쿼리 생성
   */
  private buildChunkQuery(
    knex: Knex,
    originalQuery: string,
    offset: number,
    limit: number,
  ): Knex.Raw {
    // 간단한 구현 - 실제로는 더 복잡한 쿼리 파싱 필요
    return knex.raw(`${originalQuery} LIMIT ${limit} OFFSET ${offset}`);
  }

  /**
   * 청크 에러 처리
   */
  private async handleChunkError(chunk: BatchChunk, error: any): Promise<void> {
    const canRetry = chunk.retryCount < chunk.maxRetries;

    if (canRetry) {
      // 재시도 스케줄링 (exponential backoff)
      const delayMs = Math.pow(2, chunk.retryCount) * 1000;
      const nextRetryAt = new Date(Date.now() + delayMs);

      await this.updateChunkStatus(chunk.id, BatchChunkStatus.RETRYING, {
        retryCount: chunk.retryCount + 1,
        errorMessage: error.message,
        errorDetails: error,
        nextRetryAt,
      });
    } else {
      await this.updateChunkStatus(chunk.id, BatchChunkStatus.FAILED, {
        errorMessage: error.message,
        errorDetails: error,
        completedAt: new Date(),
      });
    }
  }

  /**
   * 배치 작업 진행 상황 업데이트
   */
  private async updateBatchJobProgress(batchJobId: number, processedCount: number): Promise<void> {
    await this.dataSource.transaction(async manager => {
      // 처리된 레코드 수 증가
      await manager.increment(BatchJob, { id: batchJobId }, 'processedRecords', processedCount);

      // 완료된 청크 수 계산
      const completedChunks = await manager.count(BatchChunk, {
        where: {
          batchJobId,
          status: BatchChunkStatus.COMPLETED,
        },
      });

      const failedChunks = await manager.count(BatchChunk, {
        where: {
          batchJobId,
          status: BatchChunkStatus.FAILED,
        },
      });

      await manager.update(BatchJob, batchJobId, {
        completedChunks,
        failedChunks,
      });
    });
  }

  /**
   * 배치 작업 완료 확인
   */
  private async checkBatchJobCompletion(batchJobId: number): Promise<void> {
    const batchJob = await this.batchJobRepository.findOne({
      where: { id: batchJobId },
    });

    if (!batchJob) return;

    const remainingChunks = await this.batchChunkRepository.count({
      where: {
        batchJobId,
        status: In([
          BatchChunkStatus.PENDING,
          BatchChunkStatus.PROCESSING,
          BatchChunkStatus.RETRYING,
        ]),
      },
    });

    if (remainingChunks === 0) {
      const status = batchJob.failedChunks > 0 ? BatchJobStatus.FAILED : BatchJobStatus.COMPLETED;

      await this.updateBatchJobStatus(batchJobId, status, {
        completedAt: new Date(),
      });
    }
  }

  /**
   * 배치 작업 조회
   */
  async findOne(id: number): Promise<BatchJob> {
    const batchJob = await this.batchJobRepository.findOne({
      where: { id },
      relations: ['chunks'],
    });

    if (!batchJob) {
      throw new NotFoundException(`Batch job ${id} not found`);
    }

    return batchJob;
  }

  /**
   * 배치 작업 목록 조회
   */
  async findAll(userId: string): Promise<BatchJob[]> {
    return this.batchJobRepository.find({
      where: { createdBy: userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * 배치 작업 재시작
   */
  async restartBatchJob(id: number, userId: string): Promise<BatchJob> {
    const batchJob = await this.findOne(id);

    if (batchJob.createdBy !== userId) {
      throw new BadRequestException('Unauthorized to restart this batch job');
    }

    if (![BatchJobStatus.FAILED, BatchJobStatus.CANCELLED].includes(batchJob.status)) {
      throw new BadRequestException('Only failed or cancelled jobs can be restarted');
    }

    // 실패한 청크들을 대기 상태로 변경
    await this.batchChunkRepository.update(
      {
        batchJobId: id,
        status: BatchChunkStatus.FAILED,
      },
      {
        status: BatchChunkStatus.PENDING,
        retryCount: 0,
        errorMessage: null,
        errorDetails: null,
      },
    );

    // 배치 작업 상태 업데이트
    await this.updateBatchJobStatus(id, BatchJobStatus.PROCESSING, {
      errorMessage: null,
      startedAt: new Date(),
    });

    // 처리 재시작
    this.processBatchChunks(id).catch(error => {
      this.logger.error(`Failed to restart batch job ${id}`, error);
    });

    return this.findOne(id);
  }

  /**
   * 배치 작업 취소
   */
  async cancelBatchJob(id: number, userId: string): Promise<BatchJob> {
    const batchJob = await this.findOne(id);

    if (batchJob.createdBy !== userId) {
      throw new BadRequestException('Unauthorized to cancel this batch job');
    }

    if (batchJob.status !== BatchJobStatus.PROCESSING) {
      throw new BadRequestException('Only processing jobs can be cancelled');
    }

    // 대기 중인 청크들을 취소 상태로 변경
    await this.batchChunkRepository.update(
      {
        batchJobId: id,
        status: In([BatchChunkStatus.PENDING, BatchChunkStatus.RETRYING]),
      },
      {
        status: BatchChunkStatus.FAILED,
        errorMessage: 'Cancelled by user',
      },
    );

    await this.updateBatchJobStatus(id, BatchJobStatus.CANCELLED, {
      completedAt: new Date(),
    });

    return this.findOne(id);
  }

  /**
   * 배치 작업 상태 업데이트
   */
  private async updateBatchJobStatus(
    id: number,
    status: BatchJobStatus,
    updates: Partial<BatchJob> = {},
  ): Promise<void> {
    await this.batchJobRepository.update(id, {
      status,
      ...updates,
    });
  }

  /**
   * 청크 상태 업데이트
   */
  private async updateChunkStatus(
    id: number,
    status: BatchChunkStatus,
    updates: Partial<BatchChunk> = {},
  ): Promise<void> {
    await this.batchChunkRepository.update(id, {
      status,
      ...updates,
    });
  }
}
