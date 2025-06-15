import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JobQueueService } from './job-queue.service';
import { JobStatusTrackerService } from './services/job-status-tracker.service';
import { JobRetryService } from './services/job-retry.service';
import { JobPriorityService } from './services/job-priority.service';
import { JobQueueMonitoringService } from './services/job-queue-monitoring.service';
import { JobResourceManagerService } from './services/job-resource-manager.service';
import { CreateJobDto } from './dto/create-job.dto';
import { JobQueryDto, JobListResponseDto } from './dto/job-query.dto';
import { UpdateJobStatusDto, JobStatusResponseDto } from './dto/job-status.dto';
import { ResponseStatus } from '../common/enum/response-status.enum';

@ApiTags('Job Queue')
@Controller('v1/jobs')
@UseGuards(JwtAuthGuard)
export class JobQueueController {
  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly jobStatusTrackerService: JobStatusTrackerService,
    private readonly jobRetryService: JobRetryService,
    private readonly jobPriorityService: JobPriorityService,
    private readonly jobQueueMonitoringService: JobQueueMonitoringService,
    private readonly jobResourceManagerService: JobResourceManagerService,
  ) {}

  /**
   * 새 작업 생성
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '새 작업 생성', description: '새로운 백그라운드 작업을 큐에 추가합니다.' })
  @ApiResponse({ status: 201, description: '작업이 성공적으로 생성됨' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  async createJob(
    @Body() createJobDto: CreateJobDto,
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: {
      jobId: string;
      status: string;
      estimatedWaitTime?: number;
    };
  }> {
    try {
      const job = await this.jobQueueService.createJob(createJobDto, user.userId);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업이 성공적으로 생성되었습니다.',
        data: {
          jobId: job.id,
          status: job.status,
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `작업 생성 실패: ${error.message}`,
        data: {
          jobId: '',
          status: 'failed',
        },
      };
    }
  }

  /**
   * 작업 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '작업 목록 조회', description: '사용자의 작업 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '작업 목록 조회 성공', type: JobListResponseDto })
  async getJobs(
    @Query() queryDto: JobQueryDto,
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: JobListResponseDto;
  }> {
    try {
      const result = await this.jobQueueService.getJobs(queryDto, user.userId);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업 목록 조회 성공',
        data: result,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `작업 목록 조회 실패: ${error.message}`,
        data: {
          jobs: [],
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasPrevious: false,
          hasNext: false,
        },
      };
    }
  }

  /**
   * 특정 작업 조회
   */
  @Get(':jobId')
  @ApiOperation({ summary: '작업 상세 조회', description: '특정 작업의 상세 정보를 조회합니다.' })
  @ApiParam({ name: 'jobId', description: '작업 ID' })
  @ApiResponse({ status: 200, description: '작업 조회 성공' })
  @ApiResponse({ status: 404, description: '작업을 찾을 수 없음' })
  async getJob(
    @Param('jobId') jobId: string,
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data?: any;
  }> {
    try {
      const job = await this.jobQueueService.getJob(jobId, user.userId);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업 조회 성공',
        data: job,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `작업 조회 실패: ${error.message}`,
      };
    }
  }

  /**
   * 작업 상태 업데이트
   */
  @Put(':jobId/status')
  @ApiOperation({ summary: '작업 상태 업데이트', description: '작업의 상태를 업데이트합니다.' })
  @ApiParam({ name: 'jobId', description: '작업 ID' })
  @ApiResponse({ status: 200, description: '상태 업데이트 성공', type: JobStatusResponseDto })
  async updateJobStatus(
    @Param('jobId') jobId: string,
    @Body() updateStatusDto: UpdateJobStatusDto,
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data?: JobStatusResponseDto;
  }> {
    try {
      const result = await this.jobQueueService.updateJobStatus(
        jobId,
        updateStatusDto,
        user.userId
      );
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업 상태가 업데이트되었습니다.',
        data: result,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `상태 업데이트 실패: ${error.message}`,
      };
    }
  }

  /**
   * 작업 취소
   */
  @Put(':jobId/cancel')
  @ApiOperation({ summary: '작업 취소', description: '실행 중이거나 대기 중인 작업을 취소합니다.' })
  @ApiParam({ name: 'jobId', description: '작업 ID' })
  @ApiResponse({ status: 200, description: '작업 취소 성공' })
  async cancelJob(
    @Param('jobId') jobId: string,
    @Body() body: { reason?: string },
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
  }> {
    try {
      await this.jobQueueService.cancelJob(jobId, body.reason, user.userId);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업이 취소되었습니다.',
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `작업 취소 실패: ${error.message}`,
      };
    }
  }

  /**
   * 작업 재시도
   */
  @Post(':jobId/retry')
  @ApiOperation({ summary: '작업 재시도', description: '실패한 작업을 다시 시도합니다.' })
  @ApiParam({ name: 'jobId', description: '작업 ID' })
  @ApiResponse({ status: 200, description: '재시도 성공' })
  async retryJob(
    @Param('jobId') jobId: string,
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
  }> {
    try {
      await this.jobQueueService.retryJob(jobId, user.userId);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업 재시도가 예약되었습니다.',
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `재시도 실패: ${error.message}`,
      };
    }
  }

  /**
   * 작업 상태 히스토리 조회
   */
  @Get(':jobId/history')
  @ApiOperation({ summary: '작업 상태 히스토리', description: '작업의 상태 변경 히스토리를 조회합니다.' })
  @ApiParam({ name: 'jobId', description: '작업 ID' })
  @ApiQuery({ name: 'limit', required: false, description: '조회할 항목 수' })
  async getJobStatusHistory(
    @Param('jobId') jobId: string,
    @Query('limit') limit?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data?: any[];
  }> {
    try {
      const history = await this.jobStatusTrackerService.getJobStatusHistory(
        jobId,
        limit || 50
      );
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '상태 히스토리 조회 성공',
        data: history,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `히스토리 조회 실패: ${error.message}`,
      };
    }
  }

  /**
   * 벌크 작업 재시도
   */
  @Post('bulk/retry')
  @ApiOperation({ summary: '벌크 재시도', description: '여러 작업을 한 번에 재시도합니다.' })
  @ApiResponse({ status: 200, description: '벌크 재시도 완료' })
  async bulkRetryJobs(
    @Body() body: { jobIds: string[]; reason?: string },
    @GetUser() user: any,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: {
      successful: string[];
      failed: Array<{ jobId: string; error: string }>;
    };
  }> {
    try {
      const result = await this.jobRetryService.bulkRetry(body.jobIds, body.reason);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: `벌크 재시도 완료: ${result.successful.length}개 성공, ${result.failed.length}개 실패`,
        data: result,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `벌크 재시도 실패: ${error.message}`,
        data: {
          successful: [],
          failed: [],
        },
      };
    }
  }

  /**
   * 큐 모니터링 대시보드
   */
  @Get('monitoring/dashboard')
  @ApiOperation({ summary: '모니터링 대시보드', description: '작업 큐의 전체 모니터링 정보를 조회합니다.' })
  @ApiResponse({ status: 200, description: '대시보드 데이터 조회 성공' })
  async getMonitoringDashboard(): Promise<{
    status: ResponseStatus;
    message: string;
    data: {
      queueHealth: any;
      performanceMetrics: any;
      realtimeMetrics: any;
      resourceUsage: any;
    };
  }> {
    try {
      const [queueHealth, performanceMetrics, realtimeMetrics, resourceUsage] = await Promise.all([
        this.jobQueueMonitoringService.getQueueHealth(),
        this.jobQueueMonitoringService.getPerformanceMetrics(24),
        this.jobQueueMonitoringService.getRealtimeMetrics(),
        this.jobResourceManagerService.getResourceUsage(),
      ]);

      return {
        status: ResponseStatus.SUCCESS,
        message: '모니터링 대시보드 조회 성공',
        data: {
          queueHealth,
          performanceMetrics,
          realtimeMetrics,
          resourceUsage,
        },
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `대시보드 조회 실패: ${error.message}`,
        data: {
          queueHealth: null,
          performanceMetrics: null,
          realtimeMetrics: null,
          resourceUsage: null,
        },
      };
    }
  }

  /**
   * 큐 건강도 조회
   */
  @Get('monitoring/health')
  @ApiOperation({ summary: '큐 건강도 조회', description: '작업 큐의 건강도를 조회합니다.' })
  @ApiResponse({ status: 200, description: '건강도 조회 성공' })
  async getQueueHealth(): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const health = await this.jobQueueMonitoringService.getQueueHealth();
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '큐 건강도 조회 성공',
        data: health,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `건강도 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 성능 메트릭 조회
   */
  @Get('monitoring/performance')
  @ApiOperation({ summary: '성능 메트릭 조회', description: '작업 큐의 성능 메트릭을 조회합니다.' })
  @ApiQuery({ name: 'hours', required: false, description: '조회 시간 범위 (시간)' })
  @ApiResponse({ status: 200, description: '성능 메트릭 조회 성공' })
  async getPerformanceMetrics(
    @Query('hours') hours?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const metrics = await this.jobQueueMonitoringService.getPerformanceMetrics(
        hours || 24
      );
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '성능 메트릭 조회 성공',
        data: metrics,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `성능 메트릭 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 작업 유형별 메트릭 조회
   */
  @Get('monitoring/job-types')
  @ApiOperation({ summary: '작업 유형별 메트릭', description: '작업 유형별 성능 메트릭을 조회합니다.' })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수' })
  @ApiResponse({ status: 200, description: '작업 유형별 메트릭 조회 성공' })
  async getJobTypeMetrics(
    @Query('days') days?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const metrics = await this.jobQueueMonitoringService.getJobTypeMetrics(
        days || 7
      );
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '작업 유형별 메트릭 조회 성공',
        data: metrics,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `작업 유형별 메트릭 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 재시도 통계 조회
   */
  @Get('monitoring/retry-stats')
  @ApiOperation({ summary: '재시도 통계', description: '작업 재시도 관련 통계를 조회합니다.' })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수' })
  @ApiResponse({ status: 200, description: '재시도 통계 조회 성공' })
  async getRetryStatistics(
    @Query('days') days?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const stats = await this.jobRetryService.getRetryStatistics(days || 7);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '재시도 통계 조회 성공',
        data: stats,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `재시도 통계 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 우선순위 통계 조회
   */
  @Get('monitoring/priority-stats')
  @ApiOperation({ summary: '우선순위 통계', description: '작업 우선순위 관련 통계를 조회합니다.' })
  @ApiQuery({ name: 'days', required: false, description: '조회 일수' })
  @ApiResponse({ status: 200, description: '우선순위 통계 조회 성공' })
  async getPriorityStatistics(
    @Query('days') days?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const stats = await this.jobPriorityService.getPriorityStatistics(days || 7);
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '우선순위 통계 조회 성공',
        data: stats,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `우선순위 통계 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 리소스 사용률 조회
   */
  @Get('monitoring/resources')
  @ApiOperation({ summary: '리소스 사용률', description: '시스템 리소스 사용률을 조회합니다.' })
  @ApiResponse({ status: 200, description: '리소스 사용률 조회 성공' })
  async getResourceUsage(): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const usage = this.jobResourceManagerService.getResourceUsage();
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '리소스 사용률 조회 성공',
        data: usage,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `리소스 사용률 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 최적화 제안 조회
   */
  @Get('monitoring/optimization')
  @ApiOperation({ summary: '최적화 제안', description: '시스템 최적화 제안사항을 조회합니다.' })
  @ApiResponse({ status: 200, description: '최적화 제안 조회 성공' })
  async getOptimizationRecommendations(): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const recommendations = this.jobResourceManagerService.getOptimizationRecommendations();
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '최적화 제안 조회 성공',
        data: recommendations,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `최적화 제안 조회 실패: ${error.message}`,
        data: null,
      };
    }
  }

  /**
   * 장시간 실행 작업 조회
   */
  @Get('monitoring/long-running')
  @ApiOperation({ summary: '장시간 실행 작업', description: '장시간 실행되고 있는 작업들을 조회합니다.' })
  @ApiQuery({ name: 'thresholdMinutes', required: false, description: '임계값 (분)' })
  @ApiResponse({ status: 200, description: '장시간 실행 작업 조회 성공' })
  async getLongRunningJobs(
    @Query('thresholdMinutes') thresholdMinutes?: number,
  ): Promise<{
    status: ResponseStatus;
    message: string;
    data: any[];
  }> {
    try {
      const jobs = await this.jobQueueMonitoringService.getLongRunningJobs(
        thresholdMinutes || 30
      );
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '장시간 실행 작업 조회 성공',
        data: jobs,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `장시간 실행 작업 조회 실패: ${error.message}`,
        data: [],
      };
    }
  }

  /**
   * 전체 우선순위 재계산
   */
  @Post('admin/recalculate-priorities')
  @ApiOperation({ summary: '우선순위 재계산', description: '모든 대기 중인 작업의 우선순위를 재계산합니다.' })
  @ApiResponse({ status: 200, description: '우선순위 재계산 완료' })
  async recalculatePriorities(): Promise<{
    status: ResponseStatus;
    message: string;
    data: any;
  }> {
    try {
      const result = await this.jobPriorityService.recalculateAllPriorities();
      
      return {
        status: ResponseStatus.SUCCESS,
        message: '우선순위 재계산이 완료되었습니다.',
        data: result,
      };
    } catch (error) {
      return {
        status: ResponseStatus.ERROR,
        message: `우선순위 재계산 실패: ${error.message}`,
        data: null,
      };
    }
  }
}