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

  // 콘텍스트 정보 로깅 (첫 요청 시만)
  if (!cachedServer) {
    console.log('Lambda context:', {
      functionName: context.functionName,
      memoryLimitInMB: context.memoryLimitInMB,
      requestId: context.awsRequestId,
    });
  }

  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
