import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import cookieParser from 'cookie-parser';
import { setupSwagger } from './utils/swagger.js';

async function bootstrap() {
  const expressApp = express();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: console,
    cors: {
      origin: process.env.CORS_ORIGIN.split(',').map((x) => x.trim()),
      preflightContinue: false,
      credentials: true,
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
    },
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(cookieParser());
  setupSwagger(app);
  await app.listen(4000);
}

bootstrap();
