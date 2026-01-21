# T05_S06: API 문서 자동화

## 태스크 개요
- **ID**: T05_S06
- **제목**: Swagger/OpenAPI 기반 API 문서 자동화 시스템 구축
- **우선순위**: High
- **예상 소요 시간**: 2일
- **담당**: 백엔드 개발자

## 목표
NestJS 애플리케이션의 API를 자동으로 문서화하고, 개발자들이 쉽게 API를 테스트하고 통합할 수 있는 인터랙티브한 문서 시스템을 구축합니다.

## 구현 범위

### 1. API 문서 구성 요소
```yaml
APIDocumentation:
  Overview:
    - API 소개 및 개요
    - 인증 방법
    - 요청/응답 형식
    - 에러 처리
    - Rate Limiting
    - 버전 관리
  
  Endpoints:
    Authentication:
      - POST /auth/signup
      - POST /auth/login
      - POST /auth/refresh
      - POST /auth/logout
    
    DataSources:
      - GET /datasources
      - POST /datasources
      - GET /datasources/:id
      - PUT /datasources/:id
      - DELETE /datasources/:id
      - POST /datasources/:id/test
    
    Dashboards:
      - GET /dashboards
      - POST /dashboards
      - GET /dashboards/:id
      - PUT /dashboards/:id
      - DELETE /dashboards/:id
      - POST /dashboards/:id/share
    
    Charts:
      - GET /charts
      - POST /charts
      - GET /charts/:id
      - PUT /charts/:id
      - DELETE /charts/:id
      - POST /charts/:id/data
    
    Queries:
      - POST /queries/execute
      - GET /queries/saved
      - POST /queries/save
      - GET /queries/:id
      - DELETE /queries/:id
```

### 2. Swagger 설정 및 구성
```typescript
// backend-api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('VanillaMeta API')
    .setDescription('VanillaMeta 비즈니스 인텔리전스 플랫폼 API 문서')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'JWT 토큰을 입력하세요',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', '인증 관련 API')
    .addTag('datasources', '데이터소스 관리')
    .addTag('dashboards', '대시보드 관리')
    .addTag('charts', '차트 관리')
    .addTag('queries', '쿼리 실행 및 관리')
    .addServer('https://api.vanillameta.com', '프로덕션 서버')
    .addServer('https://staging-api.vanillameta.com', '스테이징 서버')
    .addServer('http://localhost:3000', '로컬 개발 서버')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [], // 추가 모델들
    deepScanRoutes: true,
  });

  // Swagger UI 옵션
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'VanillaMeta API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin-bottom: 50px }
      .swagger-ui .scheme-container { background: #f5f5f5; padding: 15px; }
    `,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tryItOutEnabled: true,
      requestInterceptor: (req) => {
        // 요청 인터셉터 (예: 자동 인증 토큰 추가)
        if (localStorage.getItem('access_token')) {
          req.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        }
        return req;
      },
    },
  });

  // ReDoc 대체 문서
  SwaggerModule.setup('api-reference', app, document, {
    customSiteTitle: 'VanillaMeta API Reference',
    customCss: '.redoc-wrap { padding: 20px; }',
    useGlobalPrefix: true,
  });

  app.useGlobalPipes(new ValidationPipe());
  await app.listen(3000);
}
bootstrap();
```

### 3. API 데코레이터 및 DTO 문서화
```typescript
// backend-api/src/modules/datasource/datasource.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiExtraModels,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { DataSourceService } from './datasource.service';

@ApiTags('datasources')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('datasources')
export class DataSourceController {
  constructor(private readonly dataSourceService: DataSourceService) {}

  @Get()
  @ApiOperation({ 
    summary: '데이터소스 목록 조회',
    description: '사용자가 접근 가능한 모든 데이터소스 목록을 조회합니다.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '페이지 번호 (기본값: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '페이지당 항목 수 (기본값: 20, 최대: 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: '검색어 (이름, 설명에서 검색)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['mysql', 'postgresql', 'mongodb', 'mssql'],
    description: '데이터베이스 타입별 필터링',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '데이터소스 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath('DataSource') },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 100 },
            totalPages: { type: 'number', example: 5 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '인증 실패',
  })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    return this.dataSourceService.findAll({ page, limit, search, type });
  }

  @Post()
  @ApiOperation({
    summary: '새 데이터소스 생성',
    description: '새로운 데이터소스 연결을 생성합니다. 연결 테스트가 자동으로 수행됩니다.',
  })
  @ApiBody({
    type: CreateDataSourceDto,
    description: '데이터소스 생성 정보',
    examples: {
      mysql: {
        value: {
          name: 'Production MySQL',
          type: 'mysql',
          host: 'mysql.example.com',
          port: 3306,
          database: 'myapp',
          username: 'readonly_user',
          password: 'securepassword',
          ssl: true,
          description: '프로덕션 MySQL 데이터베이스',
        },
        summary: 'MySQL 연결 예시',
      },
      postgresql: {
        value: {
          name: 'Analytics PostgreSQL',
          type: 'postgresql',
          host: 'postgres.example.com',
          port: 5432,
          database: 'analytics',
          username: 'analyst',
          password: 'securepassword',
          ssl: true,
          sslMode: 'require',
        },
        summary: 'PostgreSQL 연결 예시',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '데이터소스 생성 성공',
    type: 'DataSource',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 요청 (연결 실패 등)',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Connection failed: Access denied' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async create(@Body() createDataSourceDto: CreateDataSourceDto) {
    return this.dataSourceService.create(createDataSourceDto);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: '데이터소스 연결 테스트',
    description: '지정된 데이터소스의 연결 상태를 테스트합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: '데이터소스 ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '연결 테스트 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Connection successful' },
        details: {
          type: 'object',
          properties: {
            version: { type: 'string', example: '8.0.23' },
            tables: { type: 'number', example: 42 },
            responseTime: { type: 'number', example: 123 },
          },
        },
      },
    },
  })
  async testConnection(@Param('id') id: string) {
    return this.dataSourceService.testConnection(id);
  }
}

// DTO 문서화
// backend-api/src/modules/datasource/dto/create-datasource.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsEnum, IsOptional, Min, Max } from 'class-validator';

export enum DataSourceType {
  MYSQL = 'mysql',
  POSTGRESQL = 'postgresql',
  MONGODB = 'mongodb',
  MSSQL = 'mssql',
}

export class CreateDataSourceDto {
  @ApiProperty({
    description: '데이터소스 이름',
    example: 'Production Database',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '데이터베이스 타입',
    enum: DataSourceType,
    example: DataSourceType.MYSQL,
  })
  @IsEnum(DataSourceType)
  type: DataSourceType;

  @ApiProperty({
    description: '데이터베이스 호스트 주소',
    example: 'db.example.com',
  })
  @IsString()
  host: string;

  @ApiProperty({
    description: '데이터베이스 포트',
    example: 3306,
    minimum: 1,
    maximum: 65535,
  })
  @IsNumber()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({
    description: '데이터베이스 이름',
    example: 'myapp_production',
  })
  @IsString()
  database: string;

  @ApiProperty({
    description: '데이터베이스 사용자명',
    example: 'readonly_user',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: '데이터베이스 비밀번호',
    example: 'SecurePassword123!',
    writeOnly: true,
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({
    description: 'SSL 연결 사용 여부',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  ssl?: boolean;

  @ApiPropertyOptional({
    description: '데이터소스 설명',
    example: '프로덕션 환경의 주요 데이터베이스입니다.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: '추가 연결 옵션',
    example: {
      connectTimeout: 10000,
      timezone: '+09:00',
    },
  })
  @IsOptional()
  options?: Record<string, any>;
}
```

### 4. API 문서 커스터마이징
```typescript
// backend-api/src/swagger/swagger-customization.ts
import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

export class SwaggerCustomization {
  static async generateStaticDocs(app: INestApplication, document: any) {
    // JSON 형식으로 저장
    const outputPath = path.join(process.cwd(), 'docs', 'api');
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // OpenAPI 스펙 저장
    fs.writeFileSync(
      path.join(outputPath, 'openapi.json'),
      JSON.stringify(document, null, 2)
    );

    // Postman Collection 생성
    const postmanCollection = this.convertToPostmanCollection(document);
    fs.writeFileSync(
      path.join(outputPath, 'postman-collection.json'),
      JSON.stringify(postmanCollection, null, 2)
    );

    // Markdown 문서 생성
    const markdownDocs = this.generateMarkdownDocs(document);
    fs.writeFileSync(
      path.join(outputPath, 'api-reference.md'),
      markdownDocs
    );
  }

  private static convertToPostmanCollection(openApiDoc: any) {
    return {
      info: {
        name: openApiDoc.info.title,
        description: openApiDoc.info.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: this.generatePostmanItems(openApiDoc),
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{access_token}}',
            type: 'string',
          },
        ],
      },
      variable: [
        {
          key: 'baseUrl',
          value: openApiDoc.servers[0].url,
          type: 'string',
        },
        {
          key: 'access_token',
          value: '',
          type: 'string',
        },
      ],
    };
  }

  private static generatePostmanItems(openApiDoc: any) {
    const items = [];
    const tags = {};

    // 태그별로 그룹화
    Object.entries(openApiDoc.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        const tag = operation.tags?.[0] || 'default';
        if (!tags[tag]) {
          tags[tag] = {
            name: tag,
            item: [],
          };
        }

        tags[tag].item.push({
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(Boolean),
            },
            description: operation.description,
          },
          response: [],
        });
      });
    });

    return Object.values(tags);
  }

  private static generateMarkdownDocs(openApiDoc: any): string {
    let markdown = `# ${openApiDoc.info.title}\n\n`;
    markdown += `${openApiDoc.info.description}\n\n`;
    markdown += `**Version:** ${openApiDoc.info.version}\n\n`;

    // 서버 정보
    markdown += '## Servers\n\n';
    openApiDoc.servers.forEach((server: any) => {
      markdown += `- ${server.description || server.url}: \`${server.url}\`\n`;
    });
    markdown += '\n';

    // 인증 정보
    markdown += '## Authentication\n\n';
    markdown += 'This API uses JWT Bearer authentication. Include the token in the Authorization header:\n\n';
    markdown += '```\nAuthorization: Bearer <your-token>\n```\n\n';

    // 엔드포인트 문서
    markdown += '## Endpoints\n\n';
    
    Object.entries(openApiDoc.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        markdown += `### ${operation.summary || `${method.toUpperCase()} ${path}`}\n\n`;
        markdown += `\`${method.toUpperCase()} ${path}\`\n\n`;
        
        if (operation.description) {
          markdown += `${operation.description}\n\n`;
        }

        // 파라미터
        if (operation.parameters?.length > 0) {
          markdown += '**Parameters:**\n\n';
          markdown += '| Name | In | Type | Required | Description |\n';
          markdown += '|------|-----|------|----------|-------------|\n';
          operation.parameters.forEach((param: any) => {
            markdown += `| ${param.name} | ${param.in} | ${param.schema?.type || 'string'} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
          });
          markdown += '\n';
        }

        // 요청 바디
        if (operation.requestBody) {
          markdown += '**Request Body:**\n\n';
          markdown += '```json\n';
          const schema = operation.requestBody.content?.['application/json']?.schema;
          if (schema) {
            markdown += JSON.stringify(this.generateExampleFromSchema(schema), null, 2);
          }
          markdown += '\n```\n\n';
        }

        // 응답
        markdown += '**Responses:**\n\n';
        Object.entries(operation.responses).forEach(([status, response]: [string, any]) => {
          markdown += `- **${status}**: ${response.description}\n`;
        });
        markdown += '\n---\n\n';
      });
    });

    return markdown;
  }

  private static generateExampleFromSchema(schema: any): any {
    if (schema.example) return schema.example;
    if (schema.type === 'object' && schema.properties) {
      const example = {};
      Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
        example[key] = prop.example || this.getDefaultExample(prop.type);
      });
      return example;
    }
    return this.getDefaultExample(schema.type);
  }

  private static getDefaultExample(type: string): any {
    const examples = {
      string: 'string',
      number: 0,
      integer: 0,
      boolean: true,
      array: [],
      object: {},
    };
    return examples[type] || null;
  }
}
```

### 5. API 테스트 자동화
```typescript
// backend-api/src/swagger/api-test-generator.ts
export class ApiTestGenerator {
  static generateE2ETests(document: any): string {
    let testCode = `import { Test } from '@nestjs/testing';\n`;
    testCode += `import * as request from 'supertest';\n`;
    testCode += `import { AppModule } from '../src/app.module';\n\n`;

    Object.entries(document.paths).forEach(([path, methods]: [string, any]) => {
      Object.entries(methods).forEach(([method, operation]: [string, any]) => {
        const testName = `${method.toUpperCase()} ${path}`;
        testCode += this.generateTestCase(path, method, operation);
      });
    });

    return testCode;
  }

  private static generateTestCase(path: string, method: string, operation: any): string {
    return `
describe('${operation.summary || `${method.toUpperCase()} ${path}`}', () => {
  it('should return ${operation.responses['200']?.description || 'success'}', async () => {
    const response = await request(app.getHttpServer())
      .${method}('${path}')
      .set('Authorization', 'Bearer ' + accessToken)
      .expect(200);

    expect(response.body).toBeDefined();
    // Add more specific assertions based on the response schema
  });
});
`;
  }
}
```

### 6. API 버전 관리
```typescript
// backend-api/src/common/decorators/api-version.decorator.ts
import { Controller, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

export function ApiVersion(version: string | typeof VERSION_NEUTRAL) {
  return function (target: any) {
    Controller({ version })(target);
    ApiTags(`v${version}`)(target);
  };
}

// 사용 예시
@ApiVersion('1')
@Controller('users')
export class UsersV1Controller {
  // v1 API 구현
}

@ApiVersion('2')
@Controller('users')
export class UsersV2Controller {
  // v2 API 구현 (Breaking changes)
}
```

## 검증 항목

### 문서 완성도
- [ ] 모든 API 엔드포인트 문서화
- [ ] 요청/응답 예제 포함
- [ ] 에러 응답 문서화
- [ ] 인증 방법 명확히 설명

### 기능성
- [ ] Swagger UI에서 API 테스트 가능
- [ ] Postman Collection 정상 동작
- [ ] API 버전별 문서 분리
- [ ] 검색 기능 작동

### 자동화
- [ ] 코드 변경시 문서 자동 업데이트
- [ ] CI/CD 파이프라인 통합
- [ ] 정적 문서 자동 생성

## 산출물
1. Swagger/OpenAPI 스펙 파일
2. 인터랙티브 API 문서 (Swagger UI)
3. Postman Collection
4. Markdown 형식 API 레퍼런스
5. API 테스트 코드 템플릿

## 배포
1. API 문서 URL: https://api.vanillameta.com/api-docs
2. ReDoc URL: https://api.vanillameta.com/api-reference
3. 다운로드 가능한 스펙 파일 제공

## 참고 자료
- [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction)
- [Swagger/OpenAPI Specification](https://swagger.io/specification/)
- [ReDoc](https://github.com/Redocly/redoc)