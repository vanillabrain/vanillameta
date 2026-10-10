import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { RequestLoggingInterceptor } from './nest-utils/request-logging.interceptor';
import { setupSwagger } from './utils/swagger';

async function bootstrap() {
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
  nestApp.useGlobalFilters(new HttpExceptionFilter());
  nestApp.useGlobalInterceptors(new RequestLoggingInterceptor());
  setupSwagger(nestApp);
  await nestApp.listen(parseInt(process.env.PORT) || 4000);
}

bootstrap();
