import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { filterDocumentsPathsByTags } from './swagger-APIhelper';
import { filterDocumentsDtoPathsByTags } from './swagger/Dtohelper';
import * as fs from 'fs';

/**
 * Swagger 세팅
 *
 * @param {INestApplication} app
 */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('NestJS Study API Docs')
    .setDescription('NestJS Study API description')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter jwt token',
        in: 'header',
      },
      'AccessKey',
    )
    .addTag('유저 API')
    .addTag('url공유화 API')
    .addTag('로그인 관련 API')
    .addTag('dashboard')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  document.paths = filterDocumentsPathsByTags(document);
  // document.paths = filterDocumentsDtoPathsByTags(document);
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document));
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { defaultModelsExpandDepth: -1 },
  });
}
