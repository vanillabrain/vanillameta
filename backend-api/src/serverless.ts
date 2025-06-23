// lambda.ts
import { Handler, Context } from 'aws-lambda';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';
import { eventContext } from 'aws-serverless-express/middleware';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

import express from 'express';
import cookieParser from 'cookie-parser';
const compression = require('compression');
import { ValidationPipe } from '@nestjs/common';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { CompressionLoggingMiddleware } from './middleware/compression-logging.middleware';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { BusinessMetricsService } from './common/monitoring/business-metrics.service';
import { WarmupMetricsService } from './common/monitoring/warmup-metrics.service';

// NOTE: If you get ERR_CONTENT_DECODING_FAILED in your browser, this is likely
// due to a compressed response (e.g. gzip) which has not been handled correctly
// by aws-serverless-express and/or API Gateway. Add the necessary MIME types to
// binaryMimeTypes below
const binaryMimeTypes: string[] = ['application/octet-stream', 'image/png', 'image/jpeg'];

let cachedServer: Server;

async function bootstrapServer(): Promise<Server> {
  // some legacy browsers (IE11, various SmartTVs) choke on 204
  if (!cachedServer) {
    const expressApp = express();

    // API 응답 압축 설정 (T03_S04)
    expressApp.use(
      compression({
        filter: (req, res) => {
          // 이미 압축된 응답은 건너뛰기
          if (res.headersSent) return false;

          // Content-Type 기반 필터링 - JSON, 텍스트, XML만 압축
          const contentType = res.getHeader('content-type');
          if (typeof contentType === 'string') {
            return /json|text|xml|javascript|css/.test(contentType);
          }

          // 기본 compression 필터 사용
          return compression.filter(req, res);
        },
        threshold: 1024, // 1KB 이상만 압축
        level: 6, // 압축 레벨 (1-9, 6이 성능과 압축률의 균형점)
        memLevel: 8, // 메모리 레벨 (1-9, Lambda 환경에서 적절한 수준)
      }),
    );

    const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
      logger: new CustomLoggerService(),
      cors: {
        origin: process.env.CORS_ORIGIN.split(',').map(x => x.trim()),
        preflightContinue: false,
        credentials: true,
        optionsSuccessStatus: 200,
        exposedHeaders: ['Content-Disposition'],
      },
    });

    // Global middleware
    nestApp.use(
      new LoggingMiddleware(nestApp.get(CustomLoggerService)).use.bind(
        new LoggingMiddleware(nestApp.get(CustomLoggerService)),
      ),
    );

    // Compression logging middleware (T03_S04)
    nestApp.use(
      new CompressionLoggingMiddleware(nestApp.get(CustomLoggerService)).use.bind(
        new CompressionLoggingMiddleware(nestApp.get(CustomLoggerService)),
      ),
    );

    nestApp.setGlobalPrefix('v1');
    nestApp.use(cookieParser());
    nestApp.use(eventContext());
    // nestApp.useGlobalPipes(new ValidationPipe({ transform: true }));

    // Global interceptors for CloudWatch metrics
    const businessMetrics = nestApp.get(BusinessMetricsService);
    nestApp.useGlobalInterceptors(new ResponseTimeInterceptor(businessMetrics));

    const logger = nestApp.get(CustomLoggerService);
    logger.log('Lambda function initialized', 'ServerlessBootstrap', {
      environment: process.env.NODE_ENV,
      dbConnectionLimit: process.env.DB_CONNECTION_LIMIT || '5',
      knexPoolMax: process.env.KNEX_POOL_MAX || '3',
    });

    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

export const handler: Handler = async (event: any, context: Context) => {
  // Lambda 컨테이너 재사용을 위한 설정
  // 연결이 있는 동안 Lambda 컨테이너를 활성 상태로 유지
  context.callbackWaitsForEmptyEventLoop = false;

  const startTime = Date.now();

  // 웜업 요청 감지 및 처리 (T02_S04)
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda 함수 웜업 요청 처리됨', {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });

    try {
      // 웜업 서버 초기화 (실제 애플리케이션 로딩 확인)
      const server = await bootstrapServer();
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 웜업 성공 메트릭 기록
      const nestApp = (server as any)?._events?.request?.app;
      if (nestApp) {
        try {
          const warmupMetrics = nestApp.get(WarmupMetricsService);
          await warmupMetrics.recordWarmupSuccess(context.awsRequestId, duration);
        } catch (error) {
          console.warn('웜업 메트릭 기록 실패:', error.message);
        }
      }

      // 웜업 요청에 대한 즉시 응답 (실제 비즈니스 로직 실행 안함)
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Lambda function warmed up successfully',
          requestId: context.awsRequestId,
          timestamp: new Date().toISOString(),
          duration,
        }),
      };
    } catch (error) {
      console.error('웜업 요청 처리 중 오류 발생:', error);
      
      // 웜업 실패 메트릭 기록 시도
      try {
        const server = await bootstrapServer();
        const nestApp = (server as any)?._events?.request?.app;
        if (nestApp) {
          const warmupMetrics = nestApp.get(WarmupMetricsService);
          await warmupMetrics.recordWarmupFailure(context.awsRequestId, error.message);
        }
      } catch (metricError) {
        console.warn('웜업 실패 메트릭 기록 실패:', metricError.message);
      }

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Warmup failed',
          requestId: context.awsRequestId,
          error: error.message,
          timestamp: new Date().toISOString(),
        }),
      };
    }
  }

  // 콜드/웜 스타트 감지 및 메트릭 기록
  const isWarmStart = !!cachedServer;
  
  console.log('Lambda context:', {
    functionName: context.functionName,
    memoryLimitInMB: context.memoryLimitInMB,
    requestId: context.awsRequestId,
    isWarmStart,
    environment: process.env.NODE_ENV,
  });

  try {
    const serverStartTime = Date.now();
    cachedServer = await bootstrapServer();
    const serverEndTime = Date.now();
    const serverInitDuration = serverEndTime - serverStartTime;

    // 메트릭 기록
    try {
      const nestApp = (cachedServer as any)?._events?.request?.app;
      if (nestApp) {
        const warmupMetrics = nestApp.get(WarmupMetricsService);
        
        if (isWarmStart) {
          await warmupMetrics.recordWarmStart(context.functionName, serverInitDuration);
        } else {
          await warmupMetrics.recordColdStart(context.functionName, serverInitDuration);
        }

        // 메모리 사용량 기록
        const memoryLimit = parseInt(context.memoryLimitInMB);
        const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB 단위
        await warmupMetrics.recordMemoryUsage(context.functionName, memoryUsed, memoryLimit);
      }
    } catch (error) {
      console.warn('시작 메트릭 기록 실패:', error.message);
    }

    return proxy(cachedServer, event, context, 'PROMISE').promise;
  } catch (error) {
    console.error('서버 초기화 실패:', error);
    throw error;
  }
};
