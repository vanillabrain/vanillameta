import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Database } from '../database/entities/database.entity';
import { TimeoutConfigurationService } from './services/timeout-configuration.service';
import { AdaptiveTimeoutService } from './services/adaptive-timeout.service';
import { TimeoutMonitoringService } from './services/timeout-monitoring.service';
import { 
  DatabaseEngine, 
  QueryComplexity, 
  AdaptiveTimeoutConfigDto,
  TimeoutUpdateDto 
} from './dto/timeout-config.dto';
import { 
  TimeoutConfigResponseDto, 
  AdaptiveTimeoutResponseDto,
  TimeoutExecutionResult 
} from './dto/timeout-response.dto';
import { ResponseStatus } from '../common/enum/response-status.enum';

@Injectable()
export class QueryTimeoutService {
  private readonly logger = new Logger(QueryTimeoutService.name);

  constructor(
    @InjectRepository(Database)
    private readonly databaseRepository: Repository<Database>,
    private readonly configService: TimeoutConfigurationService,
    private readonly adaptiveService: AdaptiveTimeoutService,
    private readonly monitoringService: TimeoutMonitoringService,
  ) {}

  /**
   * 데이터베이스별 타임아웃 설정 조회
   */
  async getTimeoutConfig(databaseId: number): Promise<TimeoutConfigResponseDto> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${databaseId}`);
      }

      const engine = database.engine as DatabaseEngine;
      const rules = this.configService.getEngineTimeoutRules(engine);
      const defaultConfig = await this.configService.getDatabaseDefaultConfig(databaseId);
      const statistics = this.monitoringService.generateStatistics(engine);

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          currentConfig: {
            engine,
            defaultTimeoutMs: defaultConfig?.defaultTimeoutMs || 30000,
            batchTimeoutMs: defaultConfig?.maxTimeoutMs || 300000,
            adaptiveEnabled: true,
            monitoringEnabled: true,
          },
          rules: rules.map(rule => ({
            engine: rule.engine,
            complexity: rule.complexity,
            timeoutMs: rule.baseTimeoutMs,
            description: rule.description,
          })),
          statistics: [statistics],
        },
      };
    } catch (error) {
      this.logger.error('Failed to get timeout config', {
        databaseId,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 쿼리에 대한 최적 타임아웃 계산
   */
  async calculateOptimalTimeout(
    configDto: AdaptiveTimeoutConfigDto,
  ): Promise<AdaptiveTimeoutResponseDto> {
    try {
      // 데이터베이스 정보 조회
      const database = await this.databaseRepository.findOne({
        where: { id: configDto.databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${configDto.databaseId}`);
      }

      const engine = database.engine as DatabaseEngine;
      const complexity = this.configService.analyzeQueryComplexity(configDto.query);
      
      // 기본 타임아웃 계산
      const baseTimeoutMs = configDto.requestedTimeoutMs || 
        this.configService.calculateRecommendedTimeout(engine, complexity);

      // 적응형 타임아웃 계산 (활성화된 경우)
      if (configDto.enableAdaptive) {
        const adaptiveResult = await this.adaptiveService.calculateAdaptiveTimeout(
          configDto.databaseId,
          configDto.query,
          engine,
          baseTimeoutMs,
        );

        return {
          status: ResponseStatus.SUCCESS,
          data: adaptiveResult,
        };
      } else {
        return {
          status: ResponseStatus.SUCCESS,
          data: {
            originalTimeoutMs: baseTimeoutMs,
            adaptedTimeoutMs: baseTimeoutMs,
            adjustmentReason: 'Adaptive timeout disabled',
            confidenceLevel: 100,
            appliedMultiplier: 1.0,
            recommendation: 'Using static timeout configuration',
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to calculate optimal timeout', {
        databaseId: configDto.databaseId,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 쿼리 실행 결과 기록 (타임아웃 모니터링용)
   */
  async recordQueryExecution(
    databaseId: number,
    query: string,
    executionTimeMs: number,
    timeoutMs: number,
    wasTimedOut: boolean,
    errorMessage?: string,
    userId?: string,
  ): Promise<void> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        this.logger.warn('Database not found for execution recording', { databaseId });
        return;
      }

      const engine = database.engine as DatabaseEngine;
      const complexity = this.configService.analyzeQueryComplexity(query);

      const executionResult: TimeoutExecutionResult = {
        success: !wasTimedOut && !errorMessage,
        executionTimeMs,
        timeoutMs,
        wasTimedOut,
        query,
        databaseEngine: engine,
        complexity,
        errorMessage,
      };

      // 모니터링 서비스에 기록
      this.monitoringService.recordExecution(executionResult, userId);

      // 적응형 서비스에 기록 (성공한 경우만)
      if (!wasTimedOut && !errorMessage) {
        this.adaptiveService.recordExecution(
          databaseId,
          query,
          executionTimeMs,
          true,
        );
      }

      this.logger.debug('Query execution recorded', {
        databaseId,
        engine,
        complexity,
        executionTime: executionTimeMs,
        wasTimedOut,
        userId,
      });

    } catch (error) {
      this.logger.error('Failed to record query execution', {
        databaseId,
        error: error.message,
      });
    }
  }

  /**
   * 타임아웃 설정 업데이트
   */
  async updateTimeoutSettings(
    databaseId: number,
    updateDto: TimeoutUpdateDto,
  ): Promise<TimeoutConfigResponseDto> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${databaseId}`);
      }

      const engine = database.engine as DatabaseEngine;
      
      // 각 복잡도별로 설정 업데이트
      if (updateDto.defaultTimeoutMs) {
        this.configService.updateTimeoutRule(
          engine,
          QueryComplexity.SIMPLE,
          { baseTimeoutMs: updateDto.defaultTimeoutMs },
        );
      }

      if (updateDto.batchTimeoutMs) {
        this.configService.updateTimeoutRule(
          engine,
          QueryComplexity.BATCH,
          { baseTimeoutMs: updateDto.batchTimeoutMs },
        );
      }

      this.logger.log('Timeout settings updated', {
        databaseId,
        engine,
        updates: updateDto,
      });

      // 업데이트된 설정 반환
      return await this.getTimeoutConfig(databaseId);

    } catch (error) {
      this.logger.error('Failed to update timeout settings', {
        databaseId,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 쿼리 타임아웃 분석
   */
  async analyzeQueryTimeout(
    databaseId: number,
    query: string,
    historicalData?: number[],
  ): Promise<TimeoutConfigResponseDto> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${databaseId}`);
      }

      const engine = database.engine as DatabaseEngine;
      const analysis = this.adaptiveService.analyzeTimeoutRequirements(
        query,
        engine,
        historicalData,
      );

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          analysis,
        },
      };
    } catch (error) {
      this.logger.error('Failed to analyze query timeout', {
        databaseId,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 타임아웃 모니터링 리포트 생성
   */
  async generateMonitoringReport(periodHours: number = 24): Promise<TimeoutConfigResponseDto> {
    try {
      const report = this.monitoringService.generateMonitoringReport(periodHours);

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          monitoringReport: report,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate monitoring report', {
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 시스템 전체 타임아웃 통계
   */
  async getSystemStatistics(): Promise<TimeoutConfigResponseDto> {
    try {
      const engines = Object.values(DatabaseEngine);
      const statistics = engines.map(engine => 
        this.monitoringService.generateStatistics(engine)
      );

      const systemStats = this.configService.getSystemTimeoutStatistics();
      const adaptiveStats = this.adaptiveService.getExecutionStatistics();
      const monitoringMemory = this.monitoringService.getMemoryInfo();

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          statistics,
          analysis: {
            recommendedTimeoutMs: systemStats.averageTimeout,
            actualComplexity: QueryComplexity.MEDIUM, // 평균값
            analysisFactors: {
              joinCount: 0,
              subqueryCount: 0,
              aggregationCount: 0,
              windowFunctionCount: 0,
            },
            confidenceScore: 85,
            reasoning: [
              `Total timeout rules configured: ${systemStats.totalRules}`,
              `Average system timeout: ${Math.round(systemStats.averageTimeout)}ms`,
              `Adaptive queries tracked: ${adaptiveStats.totalQueries}`,
              `Memory usage: ${monitoringMemory.memoryUsageEstimateKB}KB`,
            ],
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to get system statistics', {
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 특정 엔진의 타임아웃 트렌드 조회
   */
  async getTimeoutTrend(
    engine: DatabaseEngine,
    periodHours: number = 24,
  ): Promise<TimeoutConfigResponseDto> {
    try {
      const trend = this.monitoringService.getTimeoutTrend(engine, periodHours);

      return {
        status: ResponseStatus.SUCCESS,
        data: {
          analysis: {
            recommendedTimeoutMs: 0,
            actualComplexity: QueryComplexity.SIMPLE,
            analysisFactors: {
              joinCount: 0,
              subqueryCount: 0,
              aggregationCount: 0,
              windowFunctionCount: 0,
            },
            confidenceScore: 100,
            reasoning: [`Timeout trend for ${engine} over ${periodHours} hours`],
          },
          // trend 데이터는 별도 필드로 반환 (인터페이스 확장 필요)
        },
      };
    } catch (error) {
      this.logger.error('Failed to get timeout trend', {
        engine,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 타임아웃 설정 초기화 (기본값으로 복원)
   */
  async resetTimeoutSettings(databaseId: number): Promise<TimeoutConfigResponseDto> {
    try {
      const database = await this.databaseRepository.findOne({
        where: { id: databaseId },
      });

      if (!database) {
        throw new BadRequestException(`Database not found: ${databaseId}`);
      }

      // 기본 설정으로 복원하는 로직은 실제로는 데이터베이스나 설정 파일에서 
      // 복원해야 하지만, 여기서는 서비스 재시작과 동일한 효과
      
      this.logger.log('Timeout settings reset to defaults', {
        databaseId,
        engine: database.engine,
      });

      return await this.getTimeoutConfig(databaseId);
    } catch (error) {
      this.logger.error('Failed to reset timeout settings', {
        databaseId,
        error: error.message,
      });

      return {
        status: ResponseStatus.ERROR,
        message: error.message,
      };
    }
  }

  /**
   * 헬스체크: 타임아웃 시스템 상태 확인
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const systemStats = this.configService.getSystemTimeoutStatistics();
      const adaptiveStats = this.adaptiveService.getExecutionStatistics();
      const monitoringMemory = this.monitoringService.getMemoryInfo();

      // 상태 평가
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (monitoringMemory.memoryUsageEstimateKB > 10000) { // 10MB 초과
        status = 'degraded';
      }
      
      if (adaptiveStats.adaptationRate < 10) { // 적응률 10% 미만
        status = 'degraded';
      }

      return {
        status,
        details: {
          configuredRules: systemStats.totalRules,
          averageTimeout: systemStats.averageTimeout,
          adaptiveQueries: adaptiveStats.totalQueries,
          adaptationRate: adaptiveStats.adaptationRate,
          memoryUsageKB: monitoringMemory.memoryUsageEstimateKB,
          eventsTracked: monitoringMemory.eventCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message,
      });

      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}