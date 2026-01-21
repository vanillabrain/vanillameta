import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * AWS X-Ray 통합 서비스
 * 
 * API 요청에 대한 분산 추적을 제공하고 성능 분석을 위한 트레이스를 생성합니다.
 */
@Injectable()
export class XRayIntegrationService implements OnModuleInit {
  private readonly logger = new Logger(XRayIntegrationService.name);
  private isEnabled = false;
  private xray: any; // aws-xray-sdk-core 타입 (동적 로딩)

  constructor(
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      // Lambda 환경에서만 X-Ray 활성화
      const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      const nodeEnv = this.configService.get<string>('NODE_ENV');
      
      if (isLambda && nodeEnv !== 'local') {
        // 동적으로 X-Ray SDK 로딩 시도
        try {
          this.xray = require('aws-xray-sdk-core');
          this.isEnabled = true;
          this.logger.log('X-Ray integration enabled in Lambda environment');
        } catch (error) {
          this.logger.warn('aws-xray-sdk-core not found, X-Ray tracing disabled');
        }
      } else {
        this.logger.log('X-Ray integration disabled (not in Lambda environment)');
      }
    } catch (error) {
      this.logger.error('Failed to initialize X-Ray integration', error);
    }
  }

  /**
   * 현재 서브세그먼트 가져오기
   */
  getCurrentSubsegment(): any {
    if (!this.isEnabled) return null;
    
    try {
      return this.xray.getSegment()?.addNewSubsegment('VanillaMeta-API');
    } catch (error) {
      this.logger.warn('Failed to get current subsegment', error);
      return null;
    }
  }

  /**
   * API 호출 트레이스 시작
   */
  startApiTrace(operationName: string, metadata?: Record<string, any>): any {
    if (!this.isEnabled) return null;

    try {
      const subsegment = this.getCurrentSubsegment();
      if (subsegment) {
        subsegment.addAnnotation('operation', operationName);
        
        if (metadata) {
          Object.entries(metadata).forEach(([key, value]) => {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              subsegment.addAnnotation(key, value);
            } else {
              subsegment.addMetadata(key, value);
            }
          });
        }
      }
      return subsegment;
    } catch (error) {
      this.logger.warn('Failed to start API trace', error);
      return null;
    }
  }

  /**
   * 데이터베이스 쿼리 트레이스
   */
  traceDbQuery(query: string, database: string, duration?: number): void {
    if (!this.isEnabled) return;

    try {
      const subsegment = this.getCurrentSubsegment();
      if (subsegment) {
        const dbSegment = subsegment.addNewSubsegment('database');
        dbSegment.addAnnotation('query_type', this.extractQueryType(query));
        dbSegment.addAnnotation('database', database);
        dbSegment.addMetadata('sql', query);
        
        if (duration !== undefined) {
          dbSegment.addAnnotation('duration_ms', duration);
        }
        
        dbSegment.close();
      }
    } catch (error) {
      this.logger.warn('Failed to trace database query', error);
    }
  }

  /**
   * HTTP 클라이언트 호출 트레이스
   */
  traceHttpCall(url: string, method: string, statusCode?: number, duration?: number): void {
    if (!this.isEnabled) return;

    try {
      const subsegment = this.getCurrentSubsegment();
      if (subsegment) {
        const httpSegment = subsegment.addNewSubsegment('http_request');
        httpSegment.addAnnotation('url', url);
        httpSegment.addAnnotation('method', method);
        
        if (statusCode !== undefined) {
          httpSegment.addAnnotation('status_code', statusCode);
        }
        
        if (duration !== undefined) {
          httpSegment.addAnnotation('duration_ms', duration);
        }
        
        httpSegment.close();
      }
    } catch (error) {
      this.logger.warn('Failed to trace HTTP call', error);
    }
  }

  /**
   * 커스텀 서브세그먼트 생성
   */
  createSubsegment(name: string, annotations?: Record<string, any>): any {
    if (!this.isEnabled) return null;

    try {
      const subsegment = this.getCurrentSubsegment();
      if (subsegment) {
        const customSegment = subsegment.addNewSubsegment(name);
        
        if (annotations) {
          Object.entries(annotations).forEach(([key, value]) => {
            customSegment.addAnnotation(key, value);
          });
        }
        
        return customSegment;
      }
    } catch (error) {
      this.logger.warn('Failed to create subsegment', error);
    }
    
    return null;
  }

  /**
   * 에러 기록
   */
  recordError(error: Error, subsegment?: any): void {
    if (!this.isEnabled) return;

    try {
      const segment = subsegment || this.getCurrentSubsegment();
      if (segment) {
        segment.addError(error);
        segment.addAnnotation('error', true);
        segment.addAnnotation('error_message', error.message);
      }
    } catch (traceError) {
      this.logger.warn('Failed to record error in X-Ray', traceError);
    }
  }

  /**
   * 트레이스 완료
   */
  closeTrace(subsegment: any, success = true): void {
    if (!this.isEnabled || !subsegment) return;

    try {
      subsegment.addAnnotation('success', success);
      subsegment.close();
    } catch (error) {
      this.logger.warn('Failed to close trace', error);
    }
  }

  /**
   * SQL 쿼리 타입 추출
   */
  private extractQueryType(query: string): string {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.startsWith('select')) return 'SELECT';
    if (trimmed.startsWith('insert')) return 'INSERT';
    if (trimmed.startsWith('update')) return 'UPDATE';
    if (trimmed.startsWith('delete')) return 'DELETE';
    if (trimmed.startsWith('create')) return 'CREATE';
    if (trimmed.startsWith('drop')) return 'DROP';
    if (trimmed.startsWith('alter')) return 'ALTER';
    return 'OTHER';
  }

  /**
   * X-Ray 활성화 상태 반환
   */
  isXRayEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * 샘플링 규칙 설정 정보 반환
   */
  getSamplingRules(): Record<string, any> {
    return {
      version: 2,
      default: {
        fixed_target: 1,
        rate: 0.1, // 10% 샘플링
      },
      rules: [
        {
          description: 'Health checks',
          service_name: '*',
          http_method: 'GET',
          url_path: '/health',
          fixed_target: 0,
          rate: 0.0, // Health check는 트레이스하지 않음
        },
        {
          description: 'Critical APIs',
          service_name: '*',
          http_method: '*',
          url_path: '/api/critical/*',
          fixed_target: 2,
          rate: 0.5, // 중요한 API는 50% 샘플링
        },
        {
          description: 'Authentication',
          service_name: '*',
          http_method: 'POST',
          url_path: '/auth/*',
          fixed_target: 1,
          rate: 0.3, // 인증 API는 30% 샘플링
        },
      ],
    };
  }
}