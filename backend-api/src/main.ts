import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { RequestMethod } from '@nestjs/common';
import express from 'express';
import { config } from 'dotenv';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './nest-utils/api-exception.filter';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { RequestLoggingInterceptor } from './nest-utils/request-logging.interceptor';
import { setupSwagger } from './utils/swagger';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { CloudWatchMetricsService } from './common/monitoring/cloudwatch-metrics.service';
import { BusinessMetricsService } from './common/monitoring/business-metrics.service';
import * as v8 from 'v8';
import { existsSync } from 'fs';
import { DataSource } from 'typeorm';
import { assertProductionConfig, parseTrustProxyHops } from './config/production-guard';
import { User } from './user/entities/user.entity';
import { assertMetadataDatabaseVersion } from './database/assert-metadata-database';

// 환경 변수 로드
config({ path: '.env.local' });

// 메모리 최적화 설정
function configureMemoryOptimization() {
  // V8 힙 크기 설정 (Lambda 3GB 환경 기준)
  const maxOldSpaceSize = 2560; // 2.5GB (여유분 확보)

  // V8 옵션 설정
  v8.setFlagsFromString('--max-old-space-size=' + maxOldSpaceSize);
  v8.setFlagsFromString('--optimize-for-size'); // 메모리 최적화
  v8.setFlagsFromString('--gc-interval=100'); // GC 주기 설정

  // 메모리 정보 로깅
  const heapStats = v8.getHeapStatistics();
  console.log('Memory configuration:', {
    heapSizeLimit: (heapStats.heap_size_limit / 1024 / 1024).toFixed(2) + ' MB',
    totalAvailableSize: (heapStats.total_available_size / 1024 / 1024).toFixed(2) + ' MB',
    maxOldSpaceSize: maxOldSpaceSize + ' MB',
  });
}

async function bootstrap() {
  // 메모리 최적화 설정 적용
  configureMemoryOptimization();
  // 환경변수 검사: 안전하지 않은 운영 설정이면 DB 연결 전에 중단한다. (guest 계정 검사는 DB 연결 후 아래에서 한다.)
  const localEnvFileExists = existsSync('.env.local');
  assertProductionConfig(process.env, { localEnvFileExists });
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nestjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
  }

  const expressApp = express();
  expressApp.use(helmet({ contentSecurityPolicy: false }));

  // Express 메모리 최적화 설정. 신뢰할 프록시 홉 수는 배포 구성(Caddy→nginx→API 등)에 맞춘다.
  expressApp.set('trust proxy', parseTrustProxyHops(process.env.TRUST_PROXY_HOPS));
  expressApp.disable('x-powered-by');

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: new CustomLoggerService(),
    cors: {
      origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(x => x.trim())
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:4000'],
      preflightContinue: false,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
    },
    // 메모리 효율을 위한 버퍼 크기 제한
    bodyParser: true,
  });
  await assertMetadataDatabaseVersion(nestApp.get(DataSource));

  // Global middleware
  nestApp.use(
    new LoggingMiddleware(nestApp.get(CustomLoggerService)).use.bind(
      new LoggingMiddleware(nestApp.get(CustomLoggerService)),
    ),
  );

  if (process.env.NODE_ENV === 'prod') {
    // 시드된 데모 계정이 남아 있으면 운영 부팅을 거부한다.
    const guestUserExists = await nestApp
      .get(DataSource)
      .getRepository(User)
      .exists({ where: { userId: 'guest' } });
    assertProductionConfig(process.env, { localEnvFileExists, guestUserExists });
  }

  nestApp.setGlobalPrefix('v1', {
    exclude: [
      { path: '.well-known/oauth-authorization-server/v1/mcp-oauth', method: RequestMethod.GET },
      { path: '.well-known/oauth-protected-resource/v1/mcp', method: RequestMethod.GET },
    ],
  });
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(
    new ApiExceptionFilter(nestApp.get(HttpAdapterHost).httpAdapter, new HttpExceptionFilter()),
  );
  nestApp.useGlobalInterceptors(new RequestLoggingInterceptor());
  // 운영에서는 API 문서를 명시적으로 켠 경우에만 노출한다.
  if (process.env.NODE_ENV !== 'prod' || process.env.SWAGGER_ENABLED === 'true')
    setupSwagger(nestApp);
  await nestApp.listen(parseInt(process.env.PORT) || 4000, process.env.HOST);
}

bootstrap();
