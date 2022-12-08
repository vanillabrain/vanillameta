import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './nest-utils/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const expressApp = express();

  // const corsOptions = {
  //   origin: function (origin, callback){
  //     console.log('asdfasdfsadfasdf',origin)
  //     if(process.env.CORS_ORIGIN.indexOf(origin) !== -1){
  //       callback(null, true);
  //     } else {
  //       callback(new Error('Not Allowed Origin'))
  //     }
  //   }
  // }
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: console,

    cors: {
      origin: true,
      preflightContinue: false,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      optionsSuccessStatus: 200,
      exposedHeaders: ['Content-Disposition'],
      credentials: true
    },
  });
  // app.enableCors({
  //   origin: true,
  //   credentials: true,
  //   allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept',
  // });
  app.useGlobalFilters(new HttpExceptionFilter());

  // app.useGlobalPipes(new ValidationPipe({ transform: true }));
  // const app = await NestFactory.create(AppModule);
  await app.listen(4000);
}

bootstrap();
