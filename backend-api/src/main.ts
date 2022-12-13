import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { setupSwagger } from './utils/swagger.js';

async function bootstrap() {
  const expressApp = express();
  const whiteList = ['https://vanillameta-dev.vanillabrain.com', 'http://localhost:3000', 'http://localhost:4000']
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: console,
    cors: {
      origin: function (origin, callback){
        if(whiteList.indexOf(origin) !== -1){
          callback(null, true);
        } else {
          callback(new Error('Not Allowed Origin'))
        }
      },
      preflightContinue: false,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
      credentials: true
    },
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(cookieParser());
  setupSwagger(app)
  await app.listen(4000);
}

bootstrap();
