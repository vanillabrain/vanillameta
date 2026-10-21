# VanillaMeta Architecture

## 프로젝트 개요

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 스타트업부터 대기업까지 다양한 규모의 기업이 데이터를 시각화하고 분석할 수 있도록 지원합니다.

### 핵심 가치
- **코드 없는 차트 생성**: 비기술직 사용자도 쉽게 데이터 시각화 가능
- **다양한 데이터베이스 지원**: 기업의 기존 데이터 인프라와 원활한 통합
- **맞춤형 대시보드**: 기업별 요구사항에 맞는 대시보드 구성
- **엔터프라이즈급 확장성**: AWS Lambda 기반으로 자동 확장 가능

## 시스템 아키텍처

### 전체 구조
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  - 대시보드 UI                                          │
│  - 차트 위젯 (ECharts)                                 │
│  - SQL 편집기                                           │
└─────────────────────────────────────────────────────────┘
                            │
                    AWS API Gateway
                            │
┌─────────────────────────────────────────────────────────┐
│              Backend API (NestJS + Lambda)               │
│  - RESTful API                                          │
│  - 인증/인가 (JWT)                                      │
│  - 비즈니스 로직                                        │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────────────┐                     ┌───────────────────┐
│  Primary DB   │                     │ Customer DBs      │
│   (MySQL)     │                     │ - PostgreSQL      │
│               │                     │ - Oracle          │
│ - 사용자 정보 │                     │ - SQL Server      │
│ - 대시보드    │                     │ - BigQuery        │
│ - 위젯 설정   │                     │ - Snowflake       │
└───────────────┘                     └───────────────────┘
```

### 주요 컴포넌트

#### Frontend (React 18)
- **UI Framework**: Material-UI v5
- **차트 라이브러리**: ECharts (50+ 차트 타입 지원)
- **상태 관리**: Context API
- **라우팅**: React Router v6
- **레이아웃**: React Grid Layout (드래그 앤 드롭 대시보드)

#### Backend API (NestJS)
- **런타임**: AWS Lambda (Serverless)
- **프레임워크**: NestJS v9 (모듈화된 구조)
- **ORM**: TypeORM (메타데이터 저장)
- **Query Engine**: Knex.js (다중 DB 쿼리 실행)
- **인증**: JWT + Refresh Token

## 핵심 모듈 구조

### Backend 모듈
```
src/
├── auth/           # JWT 인증 및 리프레시 토큰
├── common/         # 공통 엔티티, 열거형, 변환기
├── component/      # 차트 컴포넌트 관리
├── connection/     # 데이터베이스 연결 서비스 (Knex)
├── dashboard/      # 대시보드 생성 및 관리
├── database/       # DB 연결 및 쿼리 실행
├── dataset/        # 위젯용 SQL 쿼리 데이터셋
├── login/          # 사용자 로그인 서비스
├── share-url/      # 대시보드 공유 기능
├── template/       # 대시보드 템플릿
├── user/           # 사용자 관리
└── widget/         # 차트 위젯
```

### Frontend 구조
```
src/
├── components/     # 재사용 가능한 UI 컴포넌트
├── pages/          # 페이지 컴포넌트
│   ├── Dashboard/  # 대시보드 CRUD
│   ├── Data/       # 데이터소스 및 데이터셋 관리
│   └── Widget/     # 위젯 생성 및 편집
├── widget/         # 차트 모듈
│   ├── modules/    # 차트 타입별 구현
│   └── settings/   # 차트 설정 컴포넌트
└── api/           # API 서비스 레이어
```

## 데이터 흐름

### 위젯 생성 프로세스
1. **데이터베이스 연결**: 고객 DB 정보 등록
2. **데이터셋 생성**: SQL 쿼리 작성 및 저장
3. **위젯 구성**: 차트 타입 선택 및 속성 설정
4. **대시보드 배치**: 드래그 앤 드롭으로 위젯 배치

### 쿼리 실행 흐름
```
사용자 요청 → API Gateway → Lambda → Connection Service 
→ Knex Query Builder → Customer DB → 결과 반환
```

## 보안 고려사항

### 인증/인가
- JWT 기반 stateless 인증
- Refresh Token으로 토큰 갱신
- Role 기반 접근 제어 (준비 중)

### 데이터베이스 보안
- 고객 DB 연결 정보 암호화 저장
- 읽기 전용 권한 권장
- SQL Injection 방지 (파라미터화된 쿼리)

### API 보안
- CORS 설정
- Rate Limiting (API Gateway)
- Request/Response 로깅

## 확장성 및 성능

### 서버리스 아키텍처
- **자동 확장**: Lambda의 동시 실행 제한 내에서 자동 확장
- **콜드 스타트 최소화**: Warmup 플러그인 사용
- **비용 효율성**: 사용한 만큼만 과금

### 데이터베이스 최적화
- **연결 풀링**: 데이터베이스별 최적화된 연결 관리
- **쿼리 캐싱**: 자주 사용되는 쿼리 결과 캐싱 (계획)
- **인덱싱**: 메타데이터 테이블 적절한 인덱싱

## 기술 스택 요약

### Frontend
- React 18 + TypeScript
- Material-UI v5
- ECharts
- React Grid Layout
- Axios

### Backend
- NestJS v9 + TypeScript
- AWS Lambda + API Gateway
- TypeORM + Knex.js
- JWT Authentication
- MySQL (메타데이터)

### Infrastructure
- AWS Lambda
- AWS API Gateway
- AWS RDS (MySQL)
- Serverless Framework

## 상세 데이터 모델

### 핵심 엔티티 관계도
```
┌─────────────┐     1:N     ┌──────────────┐     1:N     ┌────────────┐
│    Users    │─────────────│  Dashboard   │─────────────│   Widget   │
└─────────────┘             └──────────────┘             └────────────┘
       │                           │                            │
       │ 1:N                       │ 1:N                        │ N:1
       │                           │                            │
┌─────────────┐             ┌──────────────┐             ┌────────────┐
│  Database   │             │  ShareUrl    │             │  Dataset   │
└─────────────┘             └──────────────┘             └────────────┘
                                                                │
                                                                │ N:1
                                                                │
                                                         ┌────────────┐
                                                         │  Database  │
                                                         └────────────┘
```

### 주요 엔티티 상세

#### Users
```typescript
@Entity('users')
export class Users extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'simple-array', nullable: true })
  roles: string[];

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Dashboard, dashboard => dashboard.user)
  dashboards: Dashboard[];

  @OneToMany(() => Database, database => database.user)
  databases: Database[];
}
```

#### Dashboard
```typescript
@Entity('dashboard')
export class Dashboard extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', default: {} })
  layout: {
    widgets: Array<{
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
  };

  @Column({ default: false })
  isPublic: boolean;

  @ManyToOne(() => Users, user => user.dashboards)
  user: Users;

  @OneToMany(() => Widget, widget => widget.dashboard)
  widgets: Widget[];

  @OneToMany(() => ShareUrl, shareUrl => shareUrl.dashboard)
  shareUrls: ShareUrl[];
}
```

#### Widget
```typescript
@Entity('widget')
export class Widget extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // line, bar, pie, etc.

  @Column({ type: 'json' })
  options: EChartsOption;

  @Column({ type: 'json', nullable: true })
  dataMapping: {
    xAxis?: string[];
    yAxis?: string[];
    series?: string[];
  };

  @ManyToOne(() => Dashboard, dashboard => dashboard.widgets)
  dashboard: Dashboard;

  @ManyToOne(() => Dataset, dataset => dataset.widgets)
  dataset: Dataset;

  @Column({ type: 'text', nullable: true })
  checksum: string; // 데이터 무결성 검증용
}
```

#### Dataset
```typescript
@Entity('dataset')
export class Dataset extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  sqlQuery: string;

  @Column({ type: 'json', nullable: true })
  parameters: Array<{
    name: string;
    type: 'string' | 'number' | 'date';
    defaultValue?: any;
  }>;

  @ManyToOne(() => Database, database => database.datasets)
  database: Database;

  @OneToMany(() => Widget, widget => widget.dataset)
  widgets: Widget[];

  @Column({ type: 'timestamp', nullable: true })
  lastExecutedAt: Date;

  @Column({ type: 'json', nullable: true })
  cachedSchema: {
    fields: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  };
}
```

#### Database
```typescript
@Entity('database')
export class Database extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // mysql, postgresql, oracle, etc.

  @Column({ transformer: new EncryptionTransformer() })
  host: string;

  @Column()
  port: number;

  @Column({ transformer: new EncryptionTransformer() })
  username: string;

  @Column({ transformer: new EncryptionTransformer(), select: false })
  password: string;

  @Column()
  database: string;

  @Column({ type: 'json', nullable: true })
  sslConfig: {
    enabled: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };

  @ManyToOne(() => Users, user => user.databases)
  user: Users;

  @OneToMany(() => Dataset, dataset => dataset.database)
  datasets: Dataset[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastConnectedAt: Date;
}
```

## 에러 처리 전략

### 계층별 에러 처리

#### 1. 컨트롤러 레벨
```typescript
@Controller('dashboard')
export class DashboardController {
  @Post()
  @UseFilters(HttpExceptionFilter)
  async create(@Body() createDto: CreateDashboardDto) {
    try {
      return await this.dashboardService.create(createDto);
    } catch (error) {
      if (error instanceof BusinessException) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Failed to create dashboard');
    }
  }
}
```

#### 2. 서비스 레벨
```typescript
@Injectable()
export class DashboardService {
  async create(dto: CreateDashboardDto) {
    // 비즈니스 로직 검증
    if (await this.isDuplicateName(dto.name)) {
      throw new BusinessException(
        'DASHBOARD_NAME_DUPLICATE',
        '이미 존재하는 대시보드 이름입니다'
      );
    }

    try {
      return await this.dashboardRepository.save(dto);
    } catch (error) {
      // 데이터베이스 에러 처리
      if (error.code === 'ER_DUP_ENTRY') {
        throw new BusinessException(
          'DATABASE_CONSTRAINT_VIOLATION',
          '데이터베이스 제약조건 위반'
        );
      }
      throw error;
    }
  }
}
```

#### 3. 글로벌 예외 필터
```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = exceptionResponse['message'] || exception.message;
      code = exceptionResponse['error'] || 'HTTP_ERROR';
    } else if (exception instanceof BusinessException) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
      code = exception.code;
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database query failed';
      code = 'DATABASE_ERROR';
    }

    // 에러 로깅
    this.logger.error({
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      error: {
        code,
        message,
        stack: exception instanceof Error ? exception.stack : undefined
      },
      user: request.user?.id,
      requestId: request.headers['x-request-id']
    });

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: {
        code,
        message
      }
    });
  }
}
```

### 비즈니스 예외 정의
```typescript
export class BusinessException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

// 사용 예시
throw new BusinessException(
  'QUERY_TIMEOUT',
  '쿼리 실행 시간이 초과되었습니다',
  { timeout: 30000, actual: 35000 }
);
```

## 로깅 및 모니터링 전략

### 로깅 아키텍처

#### 1. 구조화된 로깅
```typescript
@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        }),
        new CloudWatchTransport({
          logGroupName: `/aws/lambda/${process.env.SERVICE_NAME}`,
          logStreamName: new Date().toISOString().split('T')[0]
        })
      ]
    });
  }

  log(level: string, message: string, meta?: any) {
    this.logger.log(level, message, {
      ...meta,
      service: process.env.SERVICE_NAME,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  }
}
```

#### 2. 요청 추적
```typescript
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req['requestId'] = requestId;

    const startTime = Date.now();
    
    // 요청 로깅
    this.logger.info('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // 응답 로깅
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      this.logger.info('Request completed', {
        requestId,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length')
      });

      // 느린 요청 경고
      if (duration > 1000) {
        this.logger.warn('Slow request detected', {
          requestId,
          duration,
          url: req.url
        });
      }
    });

    next();
  }
}
```

### 모니터링 메트릭

#### 1. 비즈니스 메트릭
```typescript
@Injectable()
export class MetricsService {
  private metrics = {
    dashboardsCreated: new Counter({
      name: 'dashboards_created_total',
      help: 'Total number of dashboards created'
    }),
    widgetsCreated: new Counter({
      name: 'widgets_created_total',
      help: 'Total number of widgets created',
      labelNames: ['type']
    }),
    queryExecutionTime: new Histogram({
      name: 'query_execution_duration_seconds',
      help: 'Query execution time in seconds',
      labelNames: ['database_type', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    }),
    activeUsers: new Gauge({
      name: 'active_users',
      help: 'Number of active users'
    })
  };

  recordDashboardCreation() {
    this.metrics.dashboardsCreated.inc();
  }

  recordQueryExecution(databaseType: string, duration: number, success: boolean) {
    this.metrics.queryExecutionTime.observe(
      { database_type: databaseType, status: success ? 'success' : 'failure' },
      duration / 1000
    );
  }
}
```

#### 2. CloudWatch 대시보드
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["VanillaMeta", "APIRequests", {"stat": "Sum"}],
          [".", "APIErrors", {"stat": "Sum"}],
          [".", "APILatency", {"stat": "Average"}]
        ],
        "period": 300,
        "stat": "Average",
        "region": "ap-northeast-2",
        "title": "API Performance"
      }
    },
    {
      "type": "log",
      "properties": {
        "query": "SOURCE '/aws/lambda/vanillameta-api'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20",
        "region": "ap-northeast-2",
        "title": "Recent Errors"
      }
    }
  ]
}
```

### 알람 설정

#### 1. 성능 알람
```yaml
HighErrorRateAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: VanillaMeta-High-Error-Rate
    MetricName: 4XXError
    Namespace: AWS/ApiGateway
    Dimensions:
      - Name: ApiName
        Value: !Ref ApiGatewayRestApi
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 2
    Threshold: 10
    ComparisonOperator: GreaterThanThreshold
```

#### 2. 사용자 정의 알람
```typescript
async checkDatabaseConnectivity() {
  for (const db of await this.databaseService.findAll()) {
    try {
      await this.connectionService.testConnection(db);
      this.metricsService.recordDatabaseHealth(db.id, 'healthy');
    } catch (error) {
      this.metricsService.recordDatabaseHealth(db.id, 'unhealthy');
      await this.alertService.sendAlert({
        type: 'DATABASE_CONNECTION_FAILURE',
        severity: 'HIGH',
        database: db.name,
        error: error.message
      });
    }
  }
}
```

## 향후 개선 계획

### 단기 계획
- [ ] Role 기반 접근 제어 구현
- [ ] 실시간 데이터 업데이트 (WebSocket)
- [ ] 쿼리 결과 캐싱
- [ ] 다국어 지원
- [ ] 상세 감사 로그
- [ ] 자동화된 성능 테스트

### 장기 계획
- [ ] 머신러닝 기반 인사이트 제공
- [ ] 데이터 파이프라인 통합
- [ ] 모바일 앱 지원
- [ ] On-premise 버전 제공
- [ ] 분산 추적 시스템 구축
- [ ] 자동 장애 복구 시스템