import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { filterDocumentsPathsByTags } from './swagger-APIhelper';
import { filterDocumentsDtoPathsByTags } from './swagger/Dtohelper';
import * as fs from 'fs';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { SuccessResponseDto, PaginatedResponseDto } from '../common/dto/success-response.dto';

/**
 * Swagger 세팅
 *
 * @param {INestApplication} app
 */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('VanillaMeta API Documentation')
    .setDescription(
      'VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, ' +
      '사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 시각화를 생성하고 ' +
      '대시보드를 구축할 수 있습니다.\n\n' +
      '## 주요 기능\n' +
      '- 다중 데이터베이스 연결 지원\n' +
      '- 50개 이상의 차트 타입 제공\n' +
      '- 대시보드 생성 및 공유\n' +
      '- 실시간 데이터 시각화\n\n' +
      '## 인증\n' +
      'JWT Bearer 토큰을 사용합니다. 로그인 API를 통해 액세스 토큰을 발급받은 후 ' +
      'Authorization 헤더에 Bearer {token} 형식으로 전달하세요.'
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT 액세스 토큰을 입력하세요',
        in: 'header',
      },
      'AccessToken',
    )
    .addTag('인증', '사용자 인증 및 토큰 관리')
    .addTag('사용자', '사용자 계정 관리')
    .addTag('대시보드', '대시보드 생성, 수정, 삭제, 조회')
    .addTag('위젯', '차트 위젯 관리')
    .addTag('데이터베이스', '데이터베이스 연결 관리')
    .addTag('데이터셋', 'SQL 쿼리 데이터셋 관리')
    .addTag('차트 컴포넌트', '사용 가능한 차트 타입 조회')
    .addTag('템플릿', '대시보드 템플릿 관리')
    .addTag('공유', '대시보드 공유 기능')
    .addTag('분석', '사용자 행동 분석 및 통계')
    .addTag('모니터링', '시스템 모니터링 및 성능 분석')
    .addTag('이벤트', '시스템 이벤트 추적')
    .addTag('최적화', '캐시 및 성능 최적화')
    .addTag('배치', '배치 작업 관리')
    .addServer('http://localhost:4000/v1', '로컬 개발 서버')
    .addServer('https://dev-api.vanillameta.com/v1', '개발 서버')
    .addServer('https://api.vanillameta.com/v1', '프로덕션 서버')
    .build();

  const document = SwaggerModule.createDocument(app, options, {
    extraModels: [ErrorResponseDto, SuccessResponseDto, PaginatedResponseDto],
  });
  
  // 보안 요구사항 추가
  document.security = [{ AccessToken: [] }];
  
  // 공통 응답 스키마 추가
  if (!document.components) document.components = {};
  if (!document.components.responses) document.components.responses = {};
  
  document.components.responses = {
    UnauthorizedError: {
      description: '인증 실패',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponseDto' }
        }
      }
    },
    BadRequestError: {
      description: '잘못된 요청',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponseDto' }
        }
      }
    },
    NotFoundError: {
      description: '리소스를 찾을 수 없음',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ErrorResponseDto' }
        }
      }
    }
  };
  
  document.paths = filterDocumentsPathsByTags(document);
  // document.paths = filterDocumentsDtoPathsByTags(document);
  fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: { 
      defaultModelsExpandDepth: -1,
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true
    },
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VanillaMeta API Documentation',
    customfavIcon: '/favicon.ico'
  });
}
