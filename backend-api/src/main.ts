import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { setupSwagger } from './utils/swagger';
import { CustomLoggerService } from './common/logger/logger.service';
import { LoggingMiddleware } from './middleware/logging.middleware';

async function bootstrap() {
  const expressApp = express();

  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: new CustomLoggerService(),
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(x => x.trim()) : ['http://localhost:3000'],
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
  nestApp.useGlobalFilters(new HttpExceptionFilter());
  setupSwagger(nestApp);

  const logger = nestApp.get(CustomLoggerService);
  logger.log('Application starting', 'Bootstrap', {
    environment: process.env.NODE_ENV,
    port: 4000,
  });

  await nestApp.listen(4000);
}

bootstrap();
