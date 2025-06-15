import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueryTimeoutService } from './query-timeout.service';
import {
  AdaptiveTimeoutConfigDto,
  TimeoutUpdateDto,
  DatabaseEngine,
} from './dto/timeout-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('api/v1/timeout')
@UseGuards(JwtAuthGuard)
export class QueryTimeoutController {
  constructor(private readonly timeoutService: QueryTimeoutService) {}

  /**
   * 데이터베이스별 타임아웃 설정 조회
   * @param databaseId 데이터베이스 ID
   */
  @Get('config/:databaseId')
  async getTimeoutConfig(@Param('databaseId') databaseId: number) {
    return await this.timeoutService.getTimeoutConfig(Number(databaseId));
  }

  /**
   * 쿼리에 대한 최적 타임아웃 계산
   * @param configDto 적응형 타임아웃 설정
   */
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateOptimalTimeout(@Body() configDto: AdaptiveTimeoutConfigDto) {
    return await this.timeoutService.calculateOptimalTimeout(configDto);
  }

  /**
   * 쿼리 실행 결과 기록 (타임아웃 모니터링용)
   * @param body 실행 결과 데이터
   * @param user 사용자 정보
   */
  @Post('record')
  @HttpCode(HttpStatus.OK)
  async recordQueryExecution(
    @Body()
    body: {
      databaseId: number;
      query: string;
      executionTimeMs: number;
      timeoutMs: number;
      wasTimedOut: boolean;
      errorMessage?: string;
    },
    @GetUser() user?: any,
  ) {
    await this.timeoutService.recordQueryExecution(
      body.databaseId,
      body.query,
      body.executionTimeMs,
      body.timeoutMs,
      body.wasTimedOut,
      body.errorMessage,
      user?.userId,
    );

    return {
      status: 'SUCCESS',
      message: 'Execution recorded successfully',
    };
  }

  /**
   * 타임아웃 설정 업데이트
   * @param databaseId 데이터베이스 ID
   * @param updateDto 업데이트할 설정
   */
  @Put('config/:databaseId')
  async updateTimeoutSettings(
    @Param('databaseId') databaseId: number,
    @Body() updateDto: TimeoutUpdateDto,
  ) {
    return await this.timeoutService.updateTimeoutSettings(Number(databaseId), updateDto);
  }

  /**
   * 쿼리 타임아웃 분석
   * @param databaseId 데이터베이스 ID
   * @param body 분석 요청 데이터
   */
  @Post('analyze/:databaseId')
  @HttpCode(HttpStatus.OK)
  async analyzeQueryTimeout(
    @Param('databaseId') databaseId: number,
    @Body()
    body: {
      query: string;
      historicalData?: number[];
    },
  ) {
    return await this.timeoutService.analyzeQueryTimeout(
      Number(databaseId),
      body.query,
      body.historicalData,
    );
  }

  /**
   * 타임아웃 모니터링 리포트 생성
   * @param periodHours 리포트 기간 (시간)
   */
  @Get('monitoring/report')
  async generateMonitoringReport(@Query('periodHours') periodHours = 24) {
    return await this.timeoutService.generateMonitoringReport(Number(periodHours));
  }

  /**
   * 시스템 전체 타임아웃 통계
   */
  @Get('statistics')
  async getSystemStatistics() {
    return await this.timeoutService.getSystemStatistics();
  }

  /**
   * 특정 엔진의 타임아웃 트렌드 조회
   * @param engine 데이터베이스 엔진
   * @param periodHours 조회 기간 (시간)
   */
  @Get('trend/:engine')
  async getTimeoutTrend(
    @Param('engine') engine: DatabaseEngine,
    @Query('periodHours') periodHours = 24,
  ) {
    return await this.timeoutService.getTimeoutTrend(engine, Number(periodHours));
  }

  /**
   * 타임아웃 설정 초기화 (기본값으로 복원)
   * @param databaseId 데이터베이스 ID
   */
  @Post('config/:databaseId/reset')
  @HttpCode(HttpStatus.OK)
  async resetTimeoutSettings(@Param('databaseId') databaseId: number) {
    return await this.timeoutService.resetTimeoutSettings(Number(databaseId));
  }

  /**
   * 헬스체크: 타임아웃 시스템 상태 확인
   */
  @Get('health')
  async healthCheck() {
    return await this.timeoutService.healthCheck();
  }

  /**
   * 타임아웃 설정 테스트 (개발용)
   */
  @Post('test')
  @HttpCode(HttpStatus.OK)
  async testTimeoutConfiguration(
    @Body() testDto: { databaseId: number; query: string; simulatedExecutionTime: number },
  ) {
    // 시뮬레이션을 위한 테스트 엔드포인트
    const optimalConfig: AdaptiveTimeoutConfigDto = {
      databaseId: testDto.databaseId,
      query: testDto.query,
      enableAdaptive: true,
    };

    const timeoutResult = await this.timeoutService.calculateOptimalTimeout(optimalConfig);

    // 시뮬레이션된 실행 기록
    const wasTimedOut =
      testDto.simulatedExecutionTime > (timeoutResult.data?.adaptedTimeoutMs || 30000);

    await this.timeoutService.recordQueryExecution(
      testDto.databaseId,
      testDto.query,
      testDto.simulatedExecutionTime,
      timeoutResult.data?.adaptedTimeoutMs || 30000,
      wasTimedOut,
      wasTimedOut ? 'Simulated timeout' : undefined,
      'test_user',
    );

    return {
      status: 'SUCCESS',
      message: 'Timeout configuration test completed',
      data: {
        calculatedTimeout: timeoutResult.data?.adaptedTimeoutMs,
        simulatedExecutionTime: testDto.simulatedExecutionTime,
        wouldTimeout: wasTimedOut,
        timeoutResult: timeoutResult.data,
      },
    };
  }
}
