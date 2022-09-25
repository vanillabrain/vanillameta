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
    await nestApp.init();
    cachedServer = createServer(expressApp, undefined, binaryMimeTypes);
  }
  return cachedServer;
}

export const handler: Handler = async (event: any, context: Context) => {
  //  아래 파일 업로드 시 안되는 문제 때문에 추가.
  // if (
  //   event.body &&
  //   event.headers['Content-Type'] &&
  //   event.headers['Content-Type'].includes('multipart/form-data')
  // ) {
  //   // before => typeof event.body === string
  //   console.log('file Upoad 해야 한다.~~~~~~~~~~~~~~~~~~~~ : ', event.body);
  //   event.body = Buffer.from(event.body, 'binary') as unknown as string;
  //   // after => typeof event.body === <Buffer ...>
  // }

  cachedServer = await bootstrapServer();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
