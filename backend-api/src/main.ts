import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import compression from 'compression';
import { config } from 'dotenv';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './nest-utils/all-exceptions.filter';
import { setupSwagger } from './utils/swagger';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { CloudWatchMetricsService } from './common/monitoring/cloudwatch-metrics.service';
import { BusinessMetricsService } from './common/monitoring/business-metrics.service';
import * as v8 from 'v8';

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

  const expressApp = express();

  // Express 메모리 최적화 설정
  expressApp.set('trust proxy', 1);
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

  // Global middleware
  // API 응답 압축 설정 (1KB 이상만 압축, 최적화된 압축 레벨)
  nestApp.use(compression({
    threshold: 1024, // 1KB 이상만 압축
    level: 6, // 압축 레벨 (1-9, 6은 속도와 압축률의 균형점)
    filter: (req, res) => {
      // Accept-Encoding 헤더 확인
      if (!req.headers['accept-encoding']) {
        return false;
      }
      
      // 이미 압축되었거나 압축할 필요가 없는 콘텐츠 제외
      const contentType = res.getHeader('content-type');
      if (typeof contentType === 'string') {
        // 이미지, 동영상, 이미 압축된 파일들 제외
        if (contentType.startsWith('image/') || 
            contentType.startsWith('video/') || 
            contentType.includes('compressed') ||
            contentType.includes('zip') ||
            contentType.includes('gzip')) {
          return false;
        }
      }
      
      // compression 패키지의 기본 필터 사용
      return compression.filter(req, res);
    }
  }));

  nestApp.use(
    new LoggingMiddleware(nestApp.get(CustomLoggerService)).use.bind(
      new LoggingMiddleware(nestApp.get(CustomLoggerService)),
    ),
  );

  nestApp.setGlobalPrefix('v1');
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(nestApp.get(AllExceptionsFilter));
  setupSwagger(nestApp);

  // Global interceptors for CloudWatch metrics
  const cloudWatchMetrics = nestApp.get(CloudWatchMetricsService);
  const businessMetrics = nestApp.get(BusinessMetricsService);
  // ResponseTimeInterceptor는 module providers에서 DI로 처리됨

  const logger = nestApp.get(CustomLoggerService);
  logger.log('Application starting', 'Bootstrap', {
    environment: process.env.NODE_ENV,
    port: 4000,
  });

  await nestApp.listen(4000);
  
  logger.log('Application is listening on port 4000', 'Bootstrap', {
    environment: process.env.NODE_ENV,
    port: 4000,
    url: 'http://localhost:4000',
  });
}

bootstrap();
