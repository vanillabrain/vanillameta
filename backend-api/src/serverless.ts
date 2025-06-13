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
import compression from 'compression';
import { ValidationPipe } from '@nestjs/common';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';

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
    expressApp.use(compression({
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
    }));
    
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

    nestApp.setGlobalPrefix('v1');
    nestApp.use(cookieParser());
    nestApp.use(eventContext());
    // nestApp.useGlobalPipes(new ValidationPipe({ transform: true }));

    const logger = nestApp.get(CustomLoggerService);
    logger.info('Lambda function initialized', 'ServerlessBootstrap', {
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

  // 웜업 요청 감지 및 처리 (T02_S04)
  if (event.source === 'serverless-plugin-warmup') {
    console.log('WarmUp - Lambda 함수 웜업 요청 처리됨', {
      requestId: context.awsRequestId,
      functionName: context.functionName,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });

    // 웜업 요청에 대한 즉시 응답 (실제 비즈니스 로직 실행 안함)
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Lambda function warmed up successfully',
        requestId: context.awsRequestId,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // 콘텍스트 정보 로깅 (첫 요청 시만)
  if (!cachedServer) {
    console.log('Lambda context:', {
      functionName: context.functionName,
      memoryLimitInMB: context.memoryLimitInMB,
      requestId: context.awsRequestId,
      isWarmStart: !!cachedServer,
    });
  }

  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
