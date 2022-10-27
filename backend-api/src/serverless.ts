// lambda.ts
import { Handler, Context } from 'aws-lambda';
import { Server } from 'http';
import { createServer, proxy } from 'aws-serverless-express';
import { eventContext } from 'aws-serverless-express/middleware';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

import express from 'express';
// import { logger } from './core/middleware/logger.middleware';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';

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
      logger: console,
    });
    nestApp.setGlobalPrefix('v1');
    nestApp.use(cookieParser());
    nestApp.use(eventContext());
    nestApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

export const handler: Handler = async (event: any, context: Context) => {
  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
