import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { setupSwagger } from './utils/swagger';

async function bootstrap() {
  const expressApp = express();

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: console,
    cors: {
      origin: process.env.CORS_ORIGIN.split(',').map(x => x.trim()),
      preflightContinue: false,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
    },
  });
  nestApp.setGlobalPrefix('v1');
  nestApp.use(cookieParser());
  nestApp.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(nestApp);
  await nestApp.listen(4000);
}

bootstrap();
