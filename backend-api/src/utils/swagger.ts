import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { filterDocumentsPathsByTags } from './swagger-APIhelper';
import { filterDocumentsDtoPathsByTags } from './swagger/Dtohelper';

/**
 * Swagger 세팅
 *
 * @param {INestApplication} app
 */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('NestJS Study API Docs')
    .setDescription('NestJS Study API description')
    .setVersion('2.9.2')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'jwt_ac',
        description: 'Enter jwt token',
        in: 'header',
      },
      'AccessKey',
    )
    .addTag('유저 API')
    .addTag('url공유화 API')
    .addTag('로그인 관련 API')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  document.paths = filterDocumentsPathsByTags(document);
  // document.paths = filterDocumentsDtoPathsByTags(document);
  SwaggerModule.setup('api-docs', app, document);
}
