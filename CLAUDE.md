# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

VanillaMeta는 기업용 비즈니스 인텔리전스(BI) 웹 애플리케이션으로, 사용자가 코드 작성 없이 다양한 데이터베이스에 연결하여 시각화를 생성하고 대시보드를 구축할 수 있습니다.

### 주요 기능

- 🎨 코딩 없는 차트 제작: 직관적인 UI로 차트 위젯 생성
- 📊 50+ 차트 타입 지원: Apache ECharts 기반 다양한 시각화 옵션
- 📱 반응형 대시보드: 드래그 앤 드롭으로 레이아웃 편집
- 🔗 다중 데이터베이스 지원: PostgreSQL, MySQL, Oracle, Snowflake 등 10개 이상의 SQL 데이터베이스 연결
- ⚡ 고성능 SQL 편집기: 실시간 쿼리 실행 및 데이터 미리보기
- 🎯 템플릿 시스템: 사전 정의된 대시보드 템플릿 제공
- 🔒 보안 인증: JWT 기반 사용자 인증 및 권한 관리

## 개발 가이드라인

### 브랜치 전략

- 변경작업 시작 전에 항상 `develop-refactor-` 로 시작하는 working 브랜치를 만들고 작업
- 변경작업이 끝나고 PR 할 때는 `develop-refactor` 브랜치로 할것
- develop 브랜치에 직접 커밋하지 말것 (Git hooks로 보호됨)

### 빌드 & 테스트 체크리스트

- Backend 개발 TODO 완료시 마지막 단계는 항상 아래의 프로세스가 추가로 있어야 한다
  1. `yarn build:dev` 를 실행하고 발생하는 오류를 모두 수정
  2. `yarn start:local` 을 실행하고 발생하는 오류를 모두 수정
- develop 브랜치 커밋 전 다음 순서대로 항상 수행하고 커밋할것
  1. backend 의 `yarn build:dev` 를 실행하고 오류 수정
  2. backend 의 `yarn start:local` 을 실행하고 오류수정

## 프로젝트 구조

```
vanillameta/
├── backend-api/                    # NestJS 백엔드 API (AWS Lambda)
│   ├── src/
│   │   ├── {domain}/              # 도메인 모듈 (analytics, auth, dashboard 등)
│   │   ├── common/                # 공통 유틸리티, 데코레이터, 인터셉터
│   │   └── types/                 # 글로벌 타입 정의
│   └── tsconfig.json             # target: ES2017, module: commonjs
├── frontend-web/                   # React 프론트엔드 웹 애플리케이션
│   ├── src/
│   │   ├── components/           # 재사용 가능한 UI 컴포넌트
│   │   ├── pages/               # 라우트 레벨 컴포넌트
│   │   ├── widget/              # 차트 및 대시보드 위젯
│   │   ├── hooks/               # 커스텀 React hooks
│   │   └── utils/               # 유틸리티 함수
│   └── tsconfig.json            # target: ES2020, module: ESNext
├── landing-page/                   # 정적 랜딩 페이지
├── backend-api-libs-lambda-layer/  # Lambda 레이어 (의존성 관리)
├── design/                         # 디자인 리소스 및 이미지
└── docs/                          # 프로젝트 문서 및 화면 설계서
```

## 코딩 표준

### 네이밍 컨벤션

- **파일명**: camelCase (예: `userService.ts`, `dashboardController.ts`)
- **클래스/React 컴포넌트**: PascalCase (예: `UserService`, `DashboardWidget`)
- **변수/함수**: camelCase (예: `getUserData`, `chartOptions`)
- **상수**: UPPER_SNAKE_CASE (예: `MAX_RETRY_COUNT`, `API_BASE_URL`)
- **React Props Interface**: `I{ComponentName}Props` 패턴
- **Custom Hooks**: `use` 접두사 (예: `useChartData`)

### TypeScript 설정

- Backend: `target: ES2017`, `module: commonjs`
- Frontend: `target: ES2020`, `module: ESNext`
- Frontend path alias: `@/*` 사용

### Prettier 설정

- Backend: `printWidth: 100`
- Frontend: `printWidth: 125`
- 공통: `singleQuote: true`, `tabWidth: 2`, `trailingComma: all`

## 아키텍처 패턴

### NestJS 백엔드 패턴

#### 모듈 구조

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [Controller],
  providers: [Service],
  exports: [Service], // 다른 모듈에서 사용 시
})
export class ModuleName {}
```

#### 컨트롤러 패턴

```typescript
@Controller("route")
@UseGuards(JwtAuthGuard)
export class NameController {
  constructor(private readonly service: NameService) {}

  @Get()
  @ApiOperation({ summary: "API 설명" })
  async getMethod(@Query() query: QueryDto) {
    return this.service.getMethod(query);
  }
}
```

#### 서비스 패턴

```typescript
@Injectable()
export class NameService {
  private readonly logger = new Logger(NameService.name);

  constructor(
    @InjectRepository(Entity)
    private repository: Repository<Entity>
  ) {}

  async getMethod(query: QueryDto): Promise<Response> {
    try {
      this.logger.debug("작업 설명");
      return await this.repository.find(query);
    } catch (error) {
      this.logger.error("에러 메시지", error);
      throw new InternalServerErrorException("작업 실패");
    }
  }
}
```

### React 프론트엔드 패턴

#### 컴포넌트 구조

```typescript
interface IComponentNameProps {
  data: DataType;
  onAction?: (param: ParamType) => void;
}

const ComponentName: React.FC<IComponentNameProps> = ({ data, onAction }) => {
  // Hook 사용
  const theme = useTheme();

  // Effect 처리
  useEffect(() => {
    // 초기화 로직
    return () => {
      // 클린업
    };
  }, [data]);

  return <Component />;
};

export default React.memo(ComponentName);
```

#### Custom Hook 패턴

```typescript
export const useCustomHook = (param: ParamType) => {
  const [state, setState] = useState<StateType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 비동기 작업
  }, [param]);

  return { state, loading, error, refetch: () => {} };
};
```

## UI/UX 가이드라인

### Material-UI 표준

- **우선순위**: sx prop > styled() components > theme overrides > CSS classes
- **테마 색상**:
  - Primary: `#0f5ab2`
  - Secondary: `#f50057`
- **컴포넌트 기본값**: 모든 폼 컴포넌트와 버튼은 `size="small"`

### Styling 패턴

```typescript
// sx prop 사용 (권장)
<Box sx={{
  display: 'flex',
  alignItems: 'center',
  padding: { xs: '16px', sm: '24px' },
  backgroundColor: 'primary.light'
}}>

// styled() 컴포넌트 (재사용 시)
const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  '&:hover': {
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
  },
}));
```

### 폰트 시스템 (Pretendard)

- 우선순위: 400 (Regular) > 500 (Medium) > 600 (SemiBold) > 700 (Bold)
- font-display: swap 사용 (FOIT 방지)
- 폴백: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

### 차트 디자인 원칙

- 최대 5-7개 색상 사용
- 일관된 색상 팔레트 유지
- Y축은 항상 0부터 시작
- 축 제목과 라벨 필수 포함
- 접근성 고려한 색상 대비

## 데이터베이스 패턴

### 다중 데이터베이스 연결

```typescript
// Knex.js 기반 연결 패턴
const connection = knex({
  client: "mysql2", // 또는 'pg', 'oracledb' 등
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: { min: 2, max: 10 },
});
```

### 쿼리 보안

- **항상 사용**: 파라미터화된 쿼리
- **절대 금지**: 문자열 연결로 쿼리 생성
- **필수 검증**: 테이블명, 컬럼명 입력값

### 트랜잭션 패턴

```typescript
async executeInTransaction<T>(
  connection: any,
  operation: (trx: any) => Promise<T>,
): Promise<T> {
  const trx = await connection.transaction();
  try {
    const result = await operation(trx);
    await trx.commit();
    return result;
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}
```

## 성능 최적화

### 프론트엔드

- React.memo로 expensive 컴포넌트 최적화
- 적절한 로딩 상태 구현
- 라우트 lazy loading 사용
- 코드 스플리팅으로 번들 크기 최적화

### 백엔드

- 데이터베이스 인덱싱 구현
- 연결 풀링 사용
- 자주 접근하는 데이터 캐싱
- 대용량 데이터셋 페이지네이션

## 보안 가이드라인

### 인증 & 권한

- JWT 기반 인증 사용
- JwtAuthGuard로 엔드포인트 보호
- 민감한 데이터는 환경 변수로 관리

### 입력 검증

- class-validator로 DTO 검증
- 파일 업로드 크기 및 타입 제한
- SQL 인젝션 방지 (파라미터화된 쿼리)

## 테스팅 전략

### 백엔드 테스트

```typescript
describe("ServiceName", () => {
  let service: ServiceName;
  let repository: Repository<Entity>;

  beforeEach(async () => {
    // 테스트 모듈 설정
  });

  it("should perform expected behavior", async () => {
    // Arrange, Act, Assert 패턴
  });
});
```

### 프론트엔드 테스트

```typescript
describe("ComponentName", () => {
  it("should render correctly", async () => {
    render(<ComponentName />);
    await waitFor(() => {
      expect(screen.getByText("Expected")).toBeInTheDocument();
    });
  });
});
```

## 코드 리뷰 체크리스트

1. **아키텍처**: 도메인 주도 설계를 따르는가?
2. **네이밍**: 네이밍 컨벤션이 일관되게 적용되었는가?
3. **테스팅**: 적절한 단위/통합 테스트가 있는가?
4. **성능**: 명백한 성능 이슈가 있는가?
5. **보안**: 민감한 데이터가 적절히 처리되는가?
6. **문서화**: 코드가 자체 문서화되거나 적절히 주석처리되었는가?

## 환경 설정

### 로컬 개발 환경

- Node.js 16+
- Redis Server (캐싱 및 세션 관리)
- Docker Compose (권장)

### 환경 변수

- `NODE_ENV`: development | production
- `DATABASE_*`: 데이터베이스 연결 정보
- `JWT_SECRET`: JWT 토큰 시크릿
- `REDIS_*`: Redis 연결 정보

---

**중요**: 이 가이드라인은 코드 품질, 일관성, 팀 생산성을 유지하기 위해 존재합니다.
의심스러운 경우, 기존 코드베이스의 패턴을 참조하고 최소 놀람의 원칙을 따르세요.
