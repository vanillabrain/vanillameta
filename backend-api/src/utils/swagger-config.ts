import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { filterDocumentsPathsByTags } from './swagger-APIhelper';
import * as fs from 'fs';

/**
 * VanillaMeta API Swagger 설정
 * 
 * @param {INestApplication} app
 */
export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('VanillaMeta API Documentation')
    .setDescription(`
      VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 
      사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 시각화를 생성하고 
      대시보드를 구축할 수 있습니다.

      ## 주요 기능
      - 다중 데이터베이스 지원 (PostgreSQL, MySQL, Oracle, BigQuery 등)
      - 50+ 차트 타입 지원
      - 실시간 데이터 스트리밍
      - 대시보드 공유 및 협업

      ## 인증
      모든 API는 JWT 토큰 기반 인증을 사용합니다. 
      로그인 API를 통해 액세스 토큰을 발급받은 후, 
      Authorization 헤더에 'Bearer {token}' 형식으로 포함하여 요청하세요.

      ## 응답 형식
      모든 API는 다음과 같은 표준 응답 형식을 따릅니다:
      - 성공: { "status": "SUCCESS", "data": {...} }
      - 에러: { "status": "ERROR", "message": "에러 메시지" }

      ## Rate Limiting
      - 인증된 사용자: 분당 600 요청
      - 익명 사용자: 분당 60 요청
    `)
    .setVersion('1.0.0')
    .setContact(
      'VanillaMeta Support',
      'https://vanillameta.com',
      'support@vanillameta.com'
    )
    .setLicense('Commercial', 'https://vanillameta.com/license')
    .addServer(
      process.env.API_URL || 'http://localhost:3005',
      process.env.NODE_ENV === 'prod' ? 'Production' : 'Development'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT 액세스 토큰을 입력하세요',
        in: 'header',
      },
      'JWT-auth',
    )
    // API 그룹 태그 정의
    .addTag('인증', '사용자 인증 및 토큰 관리')
    .addTag('사용자', '사용자 계정 관리')
    .addTag('대시보드', '대시보드 생성, 조회, 수정, 삭제')
    .addTag('위젯', '차트 위젯 관리')
    .addTag('데이터', '데이터베이스 연결 및 데이터셋 관리')
    .addTag('템플릿', '대시보드 템플릿 관리')
    .addTag('컴포넌트', '차트 컴포넌트 정보')
    .addTag('공유', '대시보드 공유 기능')
    .addTag('분석', '사용자 행동 분석 및 메트릭')
    .addTag('모니터링', '시스템 모니터링 및 성능 메트릭')
    .addTag('배치', '배치 작업 및 백그라운드 처리')
    .addTag('시스템', '시스템 상태 및 헬스체크')
    .build();

  const document = SwaggerModule.createDocument(app, options);
  
  // 필터링 적용 (필요한 경우)
  if (process.env.SWAGGER_FILTER_TAGS === 'true') {
    document.paths = filterDocumentsPathsByTags(document);
  }
  
  // OpenAPI 스펙 파일로 저장 (CI/CD에서 활용)
  if (process.env.NODE_ENV !== 'prod') {
    fs.writeFileSync('./swagger-spec.json', JSON.stringify(document, null, 2));
  }
  
  // Swagger UI 설정
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      defaultModelsExpandDepth: -1, // 모델 섹션 기본 숨김
      persistAuthorization: true, // 인증 정보 유지
      tagsSorter: 'alpha', // 태그 알파벳 순 정렬
      operationsSorter: 'alpha', // 작업 알파벳 순 정렬
      docExpansion: 'none', // 기본적으로 모두 접기
      filter: true, // 검색 필터 활성화
      showRequestDuration: true, // 요청 시간 표시
      tryItOutEnabled: process.env.NODE_ENV !== 'prod', // 프로덕션에서는 시도 기능 비활성화
    },
    customSiteTitle: 'VanillaMeta API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { 
        background-color: #1976d2; 
      }
      .swagger-ui .topbar .download-url-wrapper { 
        display: none; 
      }
      .swagger-ui .info .title { 
        color: #1976d2; 
      }
      .swagger-ui .btn.authorize { 
        background-color: #1976d2; 
        border-color: #1976d2; 
      }
      .swagger-ui .btn.authorize:hover { 
        background-color: #1565c0; 
        border-color: #1565c0; 
      }
      .swagger-ui select { 
        padding: 5px; 
      }
    `,
  });

  // Swagger JSON 엔드포인트
  app.getHttpAdapter().get('/api-docs-json', (req, res) => {
    res.json(document);
  });

  console.log(`📚 Swagger API Documentation is available at: ${process.env.API_URL || 'http://localhost:3005'}/api-docs`);
}