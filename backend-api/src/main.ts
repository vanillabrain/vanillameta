import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { setupSwagger } from './utils/swagger';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';
import * as v8 from 'v8';

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

  const expressApp = express();

  // Express 메모리 최적화 설정
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: new CustomLoggerService(),
    cors: {
      origin: process.env.CORS_ORIGIN.split(',').map(x => x.trim()),
      preflightContinue: false,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
    },
    // 메모리 효율을 위한 버퍼 크기 제한
    bodyParser: true,
  });

  // Global middleware
  nestApp.use(
    new LoggingMiddleware(nestApp.get(CustomLoggerService)).use.bind(
      new LoggingMiddleware(nestApp.get(CustomLoggerService)),
    ),
  );

  nestApp.setGlobalPrefix('v1');
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(nestApp);

  const logger = nestApp.get(CustomLoggerService);
  logger.info('Application starting', 'Bootstrap', {
    environment: process.env.NODE_ENV,
    port: 4000,
  });

  await nestApp.listen(4000);
}

bootstrap();
