import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { setupSwagger } from './utils/swagger';

async function bootstrap() {
  const expressApp = express();
  expressApp.use(helmet({ contentSecurityPolicy: false }));
  expressApp.use(express.json({ limit: process.env.BODY_LIMIT || '1mb' }));

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: console,
    cors: {
      origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(x => x.trim()),
      preflightContinue: false,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
    },
  });
  nestApp.setGlobalPrefix('v1');
  nestApp.use(cookieParser());
  nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  nestApp.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(nestApp);
  await nestApp.listen(4000);
}

bootstrap();
