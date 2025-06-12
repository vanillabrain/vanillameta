# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 시각화를 생성하고 대시보드를 구축할 수 있습니다.

## 개발 가이드라인

- 변경작업 시작 전에 항상 develop-refactor- 로 시작하는 working 브랜치를 만들고 작업
- 변경작업이 끝나고 pr 할 때는 develop-refactor 으로 할것

## 프로젝트 구조

```
vanillameta/
├── backend-api/                    # NestJS 백엔드 API (AWS Lambda)
├── frontend-web/                   # React 프론트엔드 웹 애플리케이션
├── landing-page/                   # 정적 랜딩 페이지
├── backend-api-libs-lambda-layer/  # Lambda 레이어 (의존성 관리)
├── design/                         # 디자인 리소스 및 이미지
└── docs/                          # 프로젝트 문서 및 화면 설계서
```

## 주요 명령어

### 백엔드 개발 (backend-api/)

```bash
# 의존성 설치
yarn install

# 개발 서버 실행
yarn start:local      # SQLite 사용 (로컬 개발)
yarn start:dev        # MySQL 사용 (개발 환경)
yarn start:debug      # 디버그 모드

# 테스트
yarn test             # 전체 테스트
yarn test:watch       # 감시 모드
yarn test:cov         # 커버리지 리포트
yarn test:e2e         # E2E 테스트

# 특정 모듈 테스트
yarn test --testPathPattern="auth"     # auth 모듈만 테스트
yarn test --testPathPattern="users"    # users 모듈만 테스트
yarn test --testNamePattern="AuthService"      # 특정 서비스 테스트

# 코드 품질
yarn lint            # ESLint 실행
yarn format          # Prettier 포맷팅

# 배포
yarn deploy:dev      # 개발 환경 배포
yarn deploy:prod     # 프로덕션 배포

# 데이터베이스 시드
yarn seed           # 초기 데이터 생성
```

### 프론트엔드 개발 (frontend-web/)

```bash
# 의존성 설치
yarn install

# 개발 서버 실행
yarn start:local     # 로컬 환경
yarn start:dev       # 개발 환경
yarn start           # 기본 환경

# 빌드
yarn build          # 프로덕션 빌드
yarn build:dev      # 개발 환경 빌드

# 테스트
yarn test           # Jest 테스트 실행

# 배포
yarn deploy:dev     # 개발 환경 배포
yarn deploy:prod    # 프로덕션 배포
```

## 핵심 아키텍처

### 백엔드 아키텍처

```
backend-api/src/
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

### 프론트엔드 구조

```
frontend-web/src/
├── api/            # API 서비스 레이어
├── assets/         # 정적 리소스 (폰트, 이미지, 아이콘)
├── components/     # 재사용 가능한 UI 컴포넌트
├── contexts/       # React Context (인증, 알림, 로딩, 레이아웃)
├── data/           # 정적 데이터 및 차트 옵션
├── helpers/        # 유틸리티 함수 (API, 인증, 공유)
├── hooks/          # 커스텀 React 훅
├── layouts/        # 레이아웃 컴포넌트
├── pages/          # 페이지 컴포넌트
│   ├── Dashboard/  # 대시보드 CRUD
│   ├── Data/       # 데이터소스 및 데이터셋
│   ├── Widget/     # 위젯 생성 및 편집
│   ├── Login/      # 로그인 페이지
│   └── Share/      # 공유 대시보드 뷰
├── router/         # 라우팅 설정
├── seo/            # SEO 관련 컴포넌트
├── theme/          # Material-UI 테마 설정
├── utils/          # 공통 유틸리티 함수
└── widget/         # 차트 모듈 (50+ 차트 타입)
    ├── modules/    # 차트 컴포넌트 구현
    ├── settings/   # 차트별 설정 컴포넌트
    └── wrapper/    # 공통 래퍼 컴포넌트
```

## 기술 스택

### 백엔드
- **프레임워크**: NestJS v9 + TypeScript
- **런타임**: AWS Lambda (Serverless)
- **데이터베이스 ORM**: TypeORM (메타데이터)
- **쿼리 엔진**: Knex.js (다중 DB 지원)
- **인증**: JWT + Refresh Token

### 프론트엔드
- **프레임워크**: React 18 + TypeScript
- **UI 라이브러리**: Material-UI v5
- **차트**: ECharts (50+ 차트 타입)
- **레이아웃**: React Grid Layout
- **상태 관리**: Context API
- **라우팅**: React Router v6
- **HTTP 클라이언트**: Axios
- **빌드 도구**: CRACO (Create React App Configuration Override)
- **코드 에디터**: React-Ace (SQL), CodeMirror (SQL 구문 강조)

### 지원 데이터베이스
- PostgreSQL, MySQL, MariaDB
- Oracle, SQL Server, SQLite
- BigQuery, Snowflake, CockroachDB
- Amazon Redshift

## 개발 가이드라인

### 환경 설정

백엔드 환경 변수:
- `NODE_ENV=local`: SQLite 사용 (로컬 개발)
- `NODE_ENV=dev`: MySQL 사용 (개발 환경)
- `NODE_ENV=prod`: 프로덕션 환경

프론트엔드 환경 변수:
- `.env.local`: 로컬 개발 환경
- `.env.development`: 개발 서버 환경
- `.env`: 프로덕션 환경
- `REACT_APP_API_URL`: API 서버 URL
- `REACT_APP_MODE`: 실행 모드 설정

### 모듈 추가 방법

1. `src/[module-name]/` 디렉토리 생성
2. 표준 파일 추가: `module.ts`, `controller.ts`, `service.ts`
3. DTO는 `dto/` 하위 디렉토리에 생성
4. 엔티티는 `entities/` 하위 디렉토리에 생성
5. 테스트 파일은 소스 파일과 함께 (`*.spec.ts`)
6. `app.module.ts`에 모듈 임포트

### 데이터베이스 작업

- TypeORM 엔티티로 스키마 정의
- 개발 환경에서는 `synchronize: true` 사용
- 프로덕션에서는 마이그레이션 필수
- SQLite(로컬)과 MySQL(개발) 모두에서 테스트

### 테스트 전략

- 서비스: 레포지토리 모킹하여 단위 테스트
- 컨트롤러: 통합 테스트
- `@nestjs/testing`의 `TestingModule` 사용
- 외부 의존성(DB, API) 모킹

## 주요 기능 흐름

### 위젯 생성 프로세스
1. 데이터베이스 연결 등록
2. SQL 쿼리로 데이터셋 생성
3. 차트 타입 선택 및 속성 설정
4. 대시보드에 위젯 배치

### 인증 흐름
1. 로컬 전략으로 로그인 검증
2. JWT 토큰 발급
3. 리프레시 토큰으로 토큰 갱신
4. `JwtAuthGuard`로 보호된 라우트

## 배포 정보

### AWS Lambda 설정
- **핸들러**: `src/serverless.ts`
- **런타임**: Node.js 14.x
- **타임아웃**: 10초
- **레이어**: VanillaMetaApiNodeLibs
- **API Gateway**: 바이너리 미디어 지원

### API 구조
- 기본 경로: `/v1`
- CORS 설정 가능
- Swagger 문서 제공
- 요청/응답 로깅

## 성능 최적화

- Lambda 웜업 플러그인 활성화 (프로덕션)
- 데이터베이스 연결 풀링
- 프론트엔드 코드 스플리팅
- 차트 렌더링 최적화

## 보안 고려사항

- JWT 기반 인증
- SQL 인젝션 방지 (파라미터화된 쿼리)
- CORS 설정
- 환경 변수로 민감 정보 관리

## 주요 기술 세부사항

### 모듈 구조 패턴

각 모듈은 표준 NestJS 구조를 따릅니다:
```typescript
// Controller 예시
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}

// Service와 의존성 주입
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users) private usersRepo: Repository<Users>,
    private jwtService: JwtService
  ) {}
}
```

### 데이터베이스 패턴

TypeORM 레포지토리 패턴 사용:
```typescript
// 엔티티 레포지토리 주입
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users) private usersRepository: Repository<Users>
  ) {}

  async findUser(id: string): Promise<Users> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
```

### 인증 구현

```typescript
// 보호된 라우트
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@GetUser() user: any) {
  return user;
}

// 공개 라우트
@AuthPublic()
@Post('login')
login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

### 외부 통합

- **인증**: Firebase Auth + JWT
- **이메일**: Nodemailer with Handlebars 템플릿
- **파일 저장소**: AWS S3 via multer-s3
- **알림**: 이메일 및 SMS 서비스
- **서버리스**: AWS Lambda 배포

## 일반적인 개발 작업

### 새 모듈 추가하기

1. `src/modules/[module-name]/` 디렉토리 생성
2. controller, service, module 파일 추가
3. 해당 entities와 DTOs 생성
4. `.spec.ts` 확장자로 테스트 추가
5. `app.module.ts`에 모듈 임포트

### 엔티티 작업

```typescript
// 엔티티 정의
@Entity('users')
export class Users {
  @PrimaryGeneratedColumn()
  id: number;
  
  @Column()
  email: string;
}

// 레포지토리 사용
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users) private usersRepo: Repository<Users>
  ) {}
}
```

## 프론트엔드 개발 세부사항

### API 서비스 레이어 구조

```
api/
├── authService.ts      # 인증 관련 API (로그인, 로그아웃, 토큰 갱신)
├── dashboardService.ts # 대시보드 CRUD
├── databaseService.ts  # DB 연결 관리
├── datasetService.ts   # 데이터셋 관리
├── widgetService.ts    # 위젯 CRUD
├── componentService.ts # 차트 컴포넌트 정보
├── templateService.ts  # 템플릿 관리
└── shareService.ts     # 공유 기능
```

### 상태 관리 (Context API)

```typescript
// AuthContext: 사용자 인증 상태
interface AuthContextType {
  userState: {
    userId: string | null;
    userEmail: string | null;
  };
  setUserState: (state: UserState) => void;
  logout: () => void;
}

// AlertContext: 알림/스낵바 관리
interface AlertContextType {
  showAlert: (message: string, severity: 'success' | 'error' | 'warning' | 'info') => void;
}

// LoadingContext: 로딩 상태 관리
interface LoadingContextType {
  loading: boolean;
  setLoading: (loading: boolean) => void;
}
```

### 차트 타입 (50+ 종류)

#### 기본 차트
- Line Chart, Smooth Line Chart, Step Line Chart
- Bar Chart, Column Chart, Stacked Bar/Column
- Pie Chart, Donut Chart, Rose Chart
- Area Chart, Stacked Area Chart

#### 고급 차트
- Scatter Chart, Bubble Chart
- Radar Chart, Polar Chart
- Treemap, Sunburst
- Heatmap, Calendar Heatmap
- Gauge Chart, Liquid Fill Gauge

#### 특수 차트
- Candlestick Chart (주식)
- Funnel Chart
- Sankey Diagram
- Box Plot
- Word Cloud

#### 3D 차트
- 3D Line, 3D Bar, 3D Scatter, 3D Bubble

#### 복합 차트
- Mixed Line-Bar, Mixed Line-Pie
- Dual Axis Charts

### 위젯 생성 프로세스 (3단계)

```typescript
// Step 1: 데이터셋 선택
interface DatasetSelectStep {
  selectedDataset: Dataset | null;
}

// Step 2: 차트 타입 선택
interface ChartTypeSelectStep {
  selectedComponent: ChartComponent | null;
}

// Step 3: 차트 속성 설정
interface ChartSettingsStep {
  widgetName: string;
  chartOptions: EChartsOption;
  dataMapping: DataMappingConfig;
}
```

### 빌드 및 번들링 (CRACO 설정)

```javascript
// craco.config.js
module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10
          }
        }
      }
    }
  }
};
```

### 인증 및 API 헬퍼

```typescript
// API 헬퍼 (axios 인터셉터)
// 1. 모든 요청에 JWT 토큰 자동 첨부
// 2. 401 에러 시 리프레시 토큰으로 자동 갱신
// 3. 중복 리프레시 요청 방지
// 4. 토큰 만료 시 로그인 페이지로 리다이렉트
```

### 성능 최적화 전략

- **차트 렌더링**: ECharts 인스턴스 재사용
- **데이터 페칭**: 중복 요청 방지 메커니즘
- **메모이제이션**: React.memo 활용
- **디바운싱**: 검색 및 필터링 기능

## 중요 참고사항

### 백엔드
- **서버리스**: AWS Lambda에 최적화되어 30초 타임아웃
- **타임존**: Asia/Seoul로 설정
- **바이너리 지원**: API Gateway에서 모든 콘텐츠 타입 지원
- **워밍업**: 프로덕션에서 Lambda 워밍업 플러그인 활성화
- **환경별 DB 동기화**: 개발 환경에서만 자동 동기화 활성화

### 프론트엔드
- **TypeScript**: strict 모드 비활성화 (추후 활성화 권장)
- **폰트**: Pretendard 폰트 사용 (한글 최적화)
- **테마**: Material-UI 커스텀 테마 설정
- **경로 별칭**: `@/` → `src/` 매핑
- **빌드 최적화**: vendor 번들 분리