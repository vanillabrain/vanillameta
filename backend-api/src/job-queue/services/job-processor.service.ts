import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueJob, JobStatus, JobType } from '../entities/queue-job.entity';
import { JobResult, ResultType } from '../entities/job-result.entity';
import { JobStatusTrackerService } from './job-status-tracker.service';
import { ConnectionService } from '../../connection/connection.service';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

export interface JobProcessor {
  process(job: QueueJob): Promise<any>;
}

@Injectable()
export class JobProcessorService {
  private readonly logger = new Logger(JobProcessorService.name);

  // 작업 유형별 프로세서 등록
  private processors = new Map<JobType, JobProcessor>();

  constructor(
    @InjectRepository(QueueJob)
    private jobRepository: Repository<QueueJob>,

    @InjectRepository(JobResult)
    private jobResultRepository: Repository<JobResult>,

    private jobStatusTrackerService: JobStatusTrackerService,
    private connectionService: ConnectionService,
    private databaseService: DatabaseService,
  ) {
    this.registerProcessors();
  }

  /**
   * 작업 유형별 프로세서 등록
   */
  private registerProcessors(): void {
    this.processors.set(
      JobType.QUERY_EXECUTION,
      new QueryExecutionProcessor(this.connectionService, this.logger),
    );

    this.processors.set(
      JobType.BULK_DATA_EXPORT,
      new BulkDataExportProcessor(this.connectionService, this.logger),
    );

    this.processors.set(
      JobType.DASHBOARD_GENERATION,
      new DashboardGenerationProcessor(this.connectionService, this.logger),
    );

    this.processors.set(
      JobType.DATA_MIGRATION,
      new DataMigrationProcessor(this.connectionService, this.logger),
    );

    this.processors.set(
      JobType.CACHE_WARMUP,
      new CacheWarmupProcessor(this.connectionService, this.logger),
    );

    this.processors.set(
      JobType.REPORT_GENERATION,
      new ReportGenerationProcessor(this.connectionService, this.logger),
    );
  }

  /**
   * 작업 처리 메인 메서드
   */
  async processJob(job: QueueJob): Promise<void> {
    const startTime = Date.now();
    let workerId: string;

    try {
      // Worker ID 생성 (Lambda 환경에서는 실행 컨텍스트 ID 사용)
      workerId = this.generateWorkerId();

      // 작업 상태를 RUNNING으로 변경
      await this.updateJobStatus(job.id, JobStatus.RUNNING, {
        workerId,
        startedAt: new Date(),
      });

      // 작업 유형에 맞는 프로세서 선택
      const processor = this.processors.get(job.jobType);
      if (!processor) {
        throw new Error(`No processor found for job type: ${job.jobType}`);
      }

      this.logger.log(`Processing job: ${job.id} (${job.jobType}) with worker: ${workerId}`);

      // 진행 상황 추적 시작
      const progressTracker = this.startProgressTracking(job.id);

      // 실제 작업 실행
      const result = await processor.process(job);

      // 진행 상황 추적 종료
      clearInterval(progressTracker);

      // 결과 저장
      await this.saveJobResult(job, result);

      // 작업 완료 처리
      const executionTime = Date.now() - startTime;
      await this.updateJobStatus(job.id, JobStatus.COMPLETED, {
        completedAt: new Date(),
        executionTimeMs: executionTime,
        progress: 100,
      });

      this.logger.log(`Job completed: ${job.id} in ${executionTime}ms`);
    } catch (error) {
      // 진행 상황 추적 종료
      const executionTime = Date.now() - startTime;

      await this.handleJobError(job.id, error, {
        completedAt: new Date(),
        executionTimeMs: executionTime,
        workerId: workerId!,
      });

      this.logger.error(`Job failed: ${job.id} after ${executionTime}ms`, error);
      throw error;
    }
  }

  /**
   * 작업 상태 업데이트
   */
  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    additionalData: any = {},
  ): Promise<void> {
    await this.jobRepository.update(jobId, {
      status,
      updatedAt: new Date(),
      ...additionalData,
    });

    await this.jobStatusTrackerService.recordStatusChange(
      jobId,
      status,
      null,
      `Job ${status.toLowerCase()}`,
      additionalData,
    );
  }

  /**
   * 작업 에러 처리
   */
  private async handleJobError(jobId: string, error: any, additionalData: any = {}): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: JobStatus.FAILED,
      errorMessage: error.message,
      errorStack: error.stack,
      updatedAt: new Date(),
      ...additionalData,
    });

    await this.jobStatusTrackerService.recordStatusChange(
      jobId,
      JobStatus.FAILED,
      JobStatus.RUNNING,
      'Job execution failed',
      {
        errorMessage: error.message,
        errorType: error.constructor.name,
        ...additionalData,
      },
    );
  }

  /**
   * 작업 결과 저장
   */
  private async saveJobResult(job: QueueJob, result: any): Promise<void> {
    try {
      const jobResult = new JobResult();

      jobResult.id = uuidv4();
      jobResult.jobId = job.id;
      jobResult.resultType = this.determineResultType(job.jobType, result);
      jobResult.resultData = JSON.stringify(result);

      // 결과 타입별 특별 처리
      if (result.downloadUrl) {
        jobResult.downloadUrl = result.downloadUrl;
        jobResult.fileName = result.fileName;
        jobResult.fileSizeBytes = result.fileSizeBytes;
        jobResult.mimeType = result.mimeType;
        jobResult.expiresAt = result.expiresAt;
      }

      if (result.metadata) {
        jobResult.metadata = JSON.stringify(result.metadata);
      }

      await this.jobResultRepository.save(jobResult);

      this.logger.debug(`Job result saved: ${job.id}`);
    } catch (error) {
      this.logger.error(`Failed to save job result: ${job.id}`, error);
      // 결과 저장 실패는 작업 자체를 실패로 처리하지 않음
    }
  }

  /**
   * 결과 타입 결정
   */
  private determineResultType(jobType: JobType, result: any): ResultType {
    switch (jobType) {
      case JobType.QUERY_EXECUTION:
        return ResultType.QUERY_RESULT;
      case JobType.BULK_DATA_EXPORT:
        return ResultType.FILE_DOWNLOAD;
      case JobType.DASHBOARD_GENERATION:
        return ResultType.DASHBOARD_DATA;
      case JobType.REPORT_GENERATION:
        return ResultType.REPORT_URL;
      default:
        return ResultType.QUERY_RESULT;
    }
  }

  /**
   * 진행 상황 추적 시작
   */
  private startProgressTracking(jobId: string): NodeJS.Timeout {
    let progress = 0;

    return setInterval(async () => {
      try {
        progress = Math.min(progress + Math.random() * 10, 95); // 95%까지만

        await this.jobRepository.update(jobId, {
          progress: Math.floor(progress),
          updatedAt: new Date(),
        });
      } catch (error) {
        this.logger.error(`Failed to update progress for job: ${jobId}`, error);
      }
    }, 5000); // 5초마다 업데이트
  }

  /**
   * Worker ID 생성
   */
  private generateWorkerId(): string {
    const lambdaContext = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (lambdaContext) {
      return `lambda-${process.env.AWS_LAMBDA_LOG_STREAM_NAME || uuidv4().substring(0, 8)}`;
    }

    return `worker-${uuidv4().substring(0, 8)}`;
  }
}

// 작업 유형별 프로세서 구현

class QueryExecutionProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    if (!jobData.query || !jobData.databaseId) {
      throw new Error('Missing required parameters: query, databaseId');
    }

    this.logger.debug(`Executing query for job: ${job.id}`);

    const result = await this.connectionService.executeQuery(
      {
        id: jobData.databaseId,
        query: jobData.query,
        parameters: jobData.parameters || [],
      },
      job.userId,
    );

    return {
      queryResult: result,
      executedAt: new Date().toISOString(),
      rowCount: result.datas?.length || 0,
      metadata: {
        query: jobData.query,
        databaseId: jobData.databaseId,
        // executionTime은 ConnectionService에서 제공하지 않음
      },
    };
  }
}

class BulkDataExportProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    this.logger.debug(`Processing bulk data export for job: ${job.id}`);

    // 대용량 데이터 처리를 위한 청크 단위 처리
    const result = await this.connectionService.executeQuery(
      {
        id: jobData.databaseId,
        query: jobData.query,
        parameters: jobData.parameters || [],
      },
      job.userId,
    );

    // 실제로는 S3에 파일 업로드 후 다운로드 URL 반환
    const fileName = `export_${job.id}_${Date.now()}.xlsx`;
    const downloadUrl = `https://s3.example.com/exports/${fileName}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후

    return {
      downloadUrl,
      fileName,
      fileSizeBytes: JSON.stringify(result).length, // 임시 계산
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      expiresAt,
      rowCount: result.datas?.length || 0,
      metadata: {
        format: jobData.format || 'xlsx',
        query: jobData.query,
        exportedAt: new Date().toISOString(),
      },
    };
  }
}

class DashboardGenerationProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    this.logger.debug(`Generating dashboard for job: ${job.id}`);

    const widgets = [];

    // 대시보드의 각 위젯에 대해 데이터 조회
    for (const widgetConfig of jobData.widgets || []) {
      const widgetResult = await this.connectionService.executeQuery(
        {
          id: widgetConfig.databaseId,
          query: widgetConfig.query,
          parameters: widgetConfig.parameters || [],
        },
        job.userId,
      );

      widgets.push({
        widgetId: widgetConfig.widgetId,
        data: widgetResult.datas,
        fields: widgetResult.fields,
        chartType: widgetConfig.chartType,
      });
    }

    return {
      dashboardData: {
        dashboardId: jobData.dashboardId,
        widgets,
        generatedAt: new Date().toISOString(),
        totalWidgets: widgets.length,
      },
      metadata: {
        dashboardId: jobData.dashboardId,
        userId: job.userId,
        widgetCount: widgets.length,
      },
    };
  }
}

class DataMigrationProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    this.logger.debug(`Processing data migration for job: ${job.id}`);

    // 소스에서 데이터 조회
    const sourceData = await this.connectionService.executeQuery(
      {
        id: jobData.sourceDatabaseId,
        query: jobData.sourceQuery,
        parameters: jobData.sourceParameters || [],
      },
      job.userId,
    );

    // 대상에 데이터 삽입 (배치 처리)
    const batchSize = jobData.batchSize || 1000;
    const rows = sourceData.datas || [];
    let migratedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      // 배치 삽입 로직 (실제로는 bulk insert 쿼리 생성)
      await this.connectionService.executeQuery(
        {
          id: jobData.targetDatabaseId,
          query: jobData.targetQuery,
          parameters: batch,
        },
        job.userId,
      );

      migratedCount += batch.length;
    }

    return {
      migrationResult: {
        totalRows: rows.length,
        migratedRows: migratedCount,
        batchSize,
        completedAt: new Date().toISOString(),
      },
      metadata: {
        sourceDatabaseId: jobData.sourceDatabaseId,
        targetDatabaseId: jobData.targetDatabaseId,
        migrationTime: Date.now(),
      },
    };
  }
}

class CacheWarmupProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    this.logger.debug(`Processing cache warmup for job: ${job.id}`);

    const warmedQueries = [];

    // 지정된 쿼리들을 실행하여 캐시 워밍
    for (const queryConfig of jobData.queries || []) {
      try {
        const result = await this.connectionService.executeQuery(
          {
            id: queryConfig.databaseId,
            query: queryConfig.query,
            parameters: queryConfig.parameters || [],
          },
          job.userId,
        );

        warmedQueries.push({
          query: queryConfig.query,
          databaseId: queryConfig.databaseId,
          status: 'success',
          // executionTime은 ConnectionService에서 제공하지 않음
        });
      } catch (error) {
        warmedQueries.push({
          query: queryConfig.query,
          databaseId: queryConfig.databaseId,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return {
      warmupResult: {
        totalQueries: jobData.queries?.length || 0,
        successfulQueries: warmedQueries.filter(q => q.status === 'success').length,
        failedQueries: warmedQueries.filter(q => q.status === 'failed').length,
        queries: warmedQueries,
        completedAt: new Date().toISOString(),
      },
      metadata: {
        warmupType: jobData.warmupType || 'manual',
        userId: job.userId,
      },
    };
  }
}

class ReportGenerationProcessor implements JobProcessor {
  constructor(private connectionService: ConnectionService, private logger: Logger) {}

  async process(job: QueueJob): Promise<any> {
    const jobData = job.jobDataParsed;

    this.logger.debug(`Generating report for job: ${job.id}`);

    const reportData = [];

    // 리포트의 각 섹션에 대해 데이터 조회
    for (const section of jobData.sections || []) {
      const sectionResult = await this.connectionService.executeQuery(
        {
          id: section.databaseId,
          query: section.query,
          parameters: section.parameters || [],
        },
        job.userId,
      );

      reportData.push({
        sectionId: section.sectionId,
        title: section.title,
        data: sectionResult.datas,
        fields: sectionResult.fields,
        chartConfig: section.chartConfig,
      });
    }

    // 실제로는 PDF/Excel 파일 생성 후 S3 업로드
    const reportUrl = `https://reports.example.com/reports/${job.id}.pdf`;
    const fileName = `report_${job.id}_${Date.now()}.pdf`;

    return {
      reportUrl,
      fileName,
      reportData,
      generatedAt: new Date().toISOString(),
      metadata: {
        reportType: jobData.reportType,
        sectionCount: reportData.length,
        userId: job.userId,
      },
    };
  }
}
