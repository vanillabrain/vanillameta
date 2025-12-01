# VanillaMeta AI-First MVP 개편 계획

> 작성일: 2025-11-29
> 버전: 1.0

## 개요

VanillaMeta를 자연어 기반 데이터 분석 플랫폼으로 개편하는 3개월 MVP 계획

### 핵심 제약사항
| 항목 | 내용 |
|-----|-----|
| 개발 리소스 | 파트타임 1명 (풀타임 전환 가능) |
| 출시 기한 | 3개월 이내 |
| LLM 비용 | ~$500/월 |
| 비즈니스 모델 | Freemium (AI 쿼리 횟수 기반 차별화) |

### MVP 기능 우선순위
1. 자연어 → SQL 생성 (NL2SQL) ⭐ 핵심
2. AI 인사이트 생성
3. 자동 차트 생성 (기본 5종)
4. 데이터베이스 연결 관리 (기존 기능 활용)

### UI 전략
- AI 모드 + 클래식 모드 병행 (고급 사용자 대응)

---

## 1. Freemium 티어 설계

### Free 티어
| 기능 | 제한 |
|-----|-----|
| AI 쿼리 (NL2SQL) | 월 50회 |
| 데이터베이스 연결 | 1개 |
| 대시보드 | 3개 |
| 차트 타입 | 기본 5종 (Line, Bar, Pie, Table, Number) |
| AI 인사이트 | 월 10회 |
| 데이터 행 제한 | 1,000행 |

### Premium 티어 (월 $29~49 예상)
| 기능 | 제한 |
|-----|-----|
| AI 쿼리 (NL2SQL) | 무제한 |
| 데이터베이스 연결 | 무제한 |
| 대시보드 | 무제한 |
| 차트 타입 | 전체 50+ |
| AI 인사이트 | 무제한 |
| 데이터 행 제한 | 100,000행 |
| 대시보드 공유 | ✅ |
| 우선 지원 | ✅ |

### 사용량 추적 테이블
```sql
-- 사용량 추적 테이블
CREATE TABLE usage_tracking (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  feature_type VARCHAR(50), -- 'nl2sql', 'insight', 'chart'
  used_at TIMESTAMP DEFAULT NOW(),
  tokens_used INTEGER,
  cost_usd DECIMAL(10,6)
);

-- 사용자 티어 테이블
CREATE TABLE user_tier (
  user_id INTEGER PRIMARY KEY,
  tier VARCHAR(20) DEFAULT 'free', -- 'free', 'premium'
  monthly_nl2sql_limit INTEGER DEFAULT 50,
  monthly_nl2sql_used INTEGER DEFAULT 0,
  monthly_insight_limit INTEGER DEFAULT 10,
  monthly_insight_used INTEGER DEFAULT 0,
  reset_date DATE
);
```

---

## 2. 기술 아키텍처

### 2.1 LLM 전략 (비용 최소화)

| 기능 | 모델 | 예상 비용/1000회 |
|-----|-----|----------------|
| NL2SQL | Claude 3 Haiku | ~$0.25 |
| 인사이트 | GPT-3.5 Turbo | ~$0.50 |
| 차트 추천 | Rule-based (LLM 미사용) | $0 |

**월 예상 비용** (Free 사용자 1000명 기준):
- NL2SQL: 50회 × 1000명 × $0.00025 = $12.50
- 인사이트: 10회 × 1000명 × $0.0005 = $5.00
- **총: ~$20/월** (충분한 여유)

### 2.2 백엔드 모듈 구조

```
backend-api/src/
├── ai/                          # 신규 AI 모듈
│   ├── ai.module.ts
│   ├── ai.controller.ts         # /api/ai/* 엔드포인트
│   ├── services/
│   │   ├── llm.service.ts       # LLM API 통합 (Claude/OpenAI)
│   │   ├── nl2sql.service.ts    # 자연어 → SQL 변환
│   │   ├── insight.service.ts   # AI 인사이트 생성
│   │   └── chart-recommender.service.ts  # 차트 타입 추천
│   ├── dto/
│   │   ├── nl2sql.dto.ts
│   │   └── insight.dto.ts
│   └── guards/
│       └── usage-limit.guard.ts # Freemium 사용량 체크
├── usage/                       # 신규 사용량 추적 모듈
│   ├── usage.module.ts
│   ├── usage.service.ts
│   └── entities/
│       ├── usage-tracking.entity.ts
│       └── user-tier.entity.ts
└── (기존 모듈들 유지)
```

### 2.3 주요 API 엔드포인트

```typescript
// AI 컨트롤러 - /api/ai/*
@Controller('api/ai')
export class AiController {

  // 1. 자연어 → SQL 변환
  @Post('nl2sql')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  async generateSQL(@Body() dto: Nl2SqlDto): Promise<Nl2SqlResponseDto>
  // 입력: { databaseId, query: "지난 달 매출 상위 10개" }
  // 출력: { sql, confidence, preview, isValid }

  // 2. SQL 실행 + 차트 자동 생성
  @Post('query-and-visualize')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  async queryAndVisualize(@Body() dto: QueryVisualizeDto): Promise<VisualizationDto>
  // 입력: { databaseId, naturalLanguageQuery }
  // 출력: { data, recommendedChart, chartOption, insights }

  // 3. AI 인사이트 생성
  @Post('insights')
  @UseGuards(JwtAuthGuard, UsageLimitGuard)
  async generateInsights(@Body() dto: InsightDto): Promise<InsightResponseDto>
  // 입력: { datasetId } 또는 { data: [...] }
  // 출력: { insights: [{ type, content, importance }] }

  // 4. 사용량 조회
  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(): Promise<UsageDto>
  // 출력: { nl2sqlUsed, nl2sqlLimit, insightsUsed, insightsLimit, resetDate }
}
```

---

## 3. NL2SQL 구현 상세

### 3.1 프롬프트 템플릿

```typescript
// nl2sql.service.ts
const NL2SQL_PROMPT = `당신은 SQL 전문가입니다. 사용자의 자연어 질문을 SQL로 변환하세요.

데이터베이스: {engine} (mysql, postgresql, etc.)
테이블 스키마:
{schema}

규칙:
1. SELECT 문만 생성 (INSERT, UPDATE, DELETE 금지)
2. LIMIT 100 자동 추가 (사용자가 명시하지 않은 경우)
3. 날짜 함수는 데이터베이스 엔진에 맞게 사용
4. 존재하지 않는 테이블/컬럼 사용 금지

사용자 질문: {query}

JSON 형식으로 응답:
{
  "sql": "생성된 SQL",
  "explanation": "쿼리 설명 (한국어)",
  "confidence": 0.0~1.0
}`;
```

### 3.2 스키마 컨텍스트 생성

```typescript
// schema-context.service.ts
async buildSchemaContext(databaseId: number): Promise<string> {
  // 기존 DatabaseService.findOne() 활용
  const database = await this.databaseService.findOne(databaseId);
  const tables = database.tables;

  // 토큰 절약을 위해 간결한 형식
  return tables.map(t =>
    `${t.name}: ${t.columns.map(c => `${c.name}(${c.type})`).join(', ')}`
  ).join('\n');
}
```

### 3.3 SQL 검증

```typescript
// sql-validator.service.ts
async validate(sql: string, engine: string): Promise<ValidationResult> {
  // 1. 위험 키워드 체크
  const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'TRUNCATE', 'ALTER'];
  if (dangerous.some(kw => sql.toUpperCase().includes(kw))) {
    return { valid: false, error: 'SELECT 문만 허용됩니다' };
  }

  // 2. 문법 검증 (간단한 파싱)
  if (!sql.trim().toUpperCase().startsWith('SELECT')) {
    return { valid: false, error: 'SELECT로 시작해야 합니다' };
  }

  // 3. EXPLAIN으로 실행 가능 여부 체크 (선택적)
  return { valid: true };
}
```

---

## 4. 차트 자동 추천 (Rule-based)

LLM 비용 절약을 위해 규칙 기반으로 구현:

```typescript
// chart-recommender.service.ts
interface DataProfile {
  columns: Column[];
  rowCount: number;
  hasTimeSeries: boolean;
  categoricalColumns: string[];
  numericalColumns: string[];
}

interface ChartRecommendation {
  type: 'line' | 'bar' | 'pie' | 'table' | 'number';
  reason: string;
}

recommendChart(dataProfile: DataProfile): ChartRecommendation {
  const { columns, rowCount, hasTimeSeries, categoricalColumns, numericalColumns } = dataProfile;

  // 시계열 데이터 → Line Chart
  if (hasTimeSeries && numericalColumns.length >= 1) {
    return { type: 'line', reason: '시계열 데이터에 적합' };
  }

  // 1개 카테고리 + 1개 숫자 (10개 이하) → Pie Chart
  if (categoricalColumns.length === 1 && numericalColumns.length === 1 && rowCount <= 10) {
    return { type: 'pie', reason: '비율 비교에 적합' };
  }

  // 1개 카테고리 + 1개 숫자 (10개 초과) → Bar Chart
  if (categoricalColumns.length === 1 && numericalColumns.length === 1) {
    return { type: 'bar', reason: '카테고리별 비교에 적합' };
  }

  // 숫자 1개만 → Number Board
  if (columns.length === 1 && numericalColumns.length === 1 && rowCount === 1) {
    return { type: 'number', reason: '단일 지표 표시' };
  }

  // 기본값 → Table
  return { type: 'table', reason: '데이터 상세 보기' };
}
```

---

## 5. AI 인사이트 생성

```typescript
// insight.service.ts
const INSIGHT_PROMPT = `데이터 분석 결과를 바탕으로 비즈니스 인사이트를 생성하세요.

데이터 요약:
- 행 수: {rowCount}
- 컬럼: {columns}
- 통계: {statistics}

샘플 데이터 (상위 10행):
{sampleData}

3가지 인사이트를 JSON으로 응답:
[
  { "type": "trend", "content": "인사이트 내용", "importance": "high" },
  { "type": "anomaly", "content": "...", "importance": "medium" },
  { "type": "recommendation", "content": "...", "importance": "low" }
]`;

async generateInsights(data: any[]): Promise<Insight[]> {
  const statistics = this.calculateStatistics(data);
  const prompt = this.buildPrompt(data, statistics);

  const response = await this.llmService.chat(prompt, 'gpt-3.5-turbo');
  return JSON.parse(response);
}
```

---

## 6. 프론트엔드 구현

### 6.1 신규 컴포넌트 구조

```
frontend-web/src/
├── pages/
│   └── AI/                      # 신규 AI 페이지
│       ├── AIQuery.tsx          # 메인 자연어 쿼리 페이지
│       └── AIQuery.module.css
├── components/
│   └── ai/                      # 신규 AI 컴포넌트
│       ├── NLQueryInput.tsx     # 자연어 입력창
│       ├── SQLPreview.tsx       # 생성된 SQL 미리보기
│       ├── ChartPreview.tsx     # 자동 생성 차트 미리보기
│       ├── InsightCard.tsx      # 인사이트 카드
│       ├── UsageIndicator.tsx   # 사용량 표시
│       └── ModeToggle.tsx       # AI/클래식 모드 전환
└── api/
    └── aiService.ts             # AI API 호출
```

### 6.2 메인 AI 쿼리 페이지

```tsx
// pages/AI/AIQuery.tsx
const AIQuery = () => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { usage } = useUsage(); // 사용량 훅

  const handleSubmit = async () => {
    if (usage.nl2sqlUsed >= usage.nl2sqlLimit) {
      alert('월간 사용량을 초과했습니다. Premium으로 업그레이드하세요.');
      return;
    }

    setLoading(true);
    const response = await aiService.queryAndVisualize({
      databaseId: selectedDb,
      naturalLanguageQuery: query
    });
    setResult(response);
    setLoading(false);
  };

  return (
    <Box>
      {/* 사용량 표시 */}
      <UsageIndicator used={usage.nl2sqlUsed} limit={usage.nl2sqlLimit} />

      {/* 데이터베이스 선택 */}
      <DatabaseSelector value={selectedDb} onChange={setSelectedDb} />

      {/* 자연어 입력 */}
      <NLQueryInput
        value={query}
        onChange={setQuery}
        onSubmit={handleSubmit}
        placeholder="예: 지난 달 카테고리별 매출 합계를 보여줘"
        loading={loading}
      />

      {/* 결과 영역 */}
      {result && (
        <>
          <SQLPreview sql={result.sql} confidence={result.confidence} />
          <ChartPreview
            data={result.data}
            chartType={result.recommendedChart}
            chartOption={result.chartOption}
          />
          <InsightCard insights={result.insights} />

          {/* 액션 버튼 */}
          <Button onClick={() => saveAsWidget(result)}>위젯으로 저장</Button>
          <Button onClick={() => addToDashboard(result)}>대시보드에 추가</Button>
        </>
      )}
    </Box>
  );
};
```

### 6.3 모드 전환 (AI ↔ 클래식)

```tsx
// components/ai/ModeToggle.tsx
const ModeToggle = () => {
  const { mode, setMode } = useAppContext();

  return (
    <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => setMode(v)}>
      <ToggleButton value="ai">
        <AutoAwesome /> AI 모드
      </ToggleButton>
      <ToggleButton value="classic">
        <Code /> 클래식 모드
      </ToggleButton>
    </ToggleButtonGroup>
  );
};
```

### 6.4 사이드바 메뉴 추가

```tsx
// 기존 사이드바에 AI 메뉴 추가
const menuItems = [
  { path: '/ai/query', icon: <AutoAwesome />, label: 'AI 쿼리', isNew: true },
  // ... 기존 메뉴
];
```

---

## 7. 3개월 개발 로드맵

### Month 1: 핵심 백엔드 (주 40시간 기준)

| 주차 | 작업 | 산출물 |
|-----|-----|--------|
| W1 | AI 모듈 기본 구조, LLM 서비스 | `ai.module.ts`, `llm.service.ts` |
| W2 | NL2SQL 서비스, 스키마 컨텍스트 | `nl2sql.service.ts` |
| W3 | SQL 검증, 쿼리 실행 연동 | `sql-validator.service.ts` |
| W4 | 차트 추천, 사용량 추적 | `chart-recommender.service.ts`, `usage.module.ts` |

### Month 2: 프론트엔드 + 인사이트

| 주차 | 작업 | 산출물 |
|-----|-----|--------|
| W5 | AI 쿼리 페이지 기본 UI | `AIQuery.tsx`, 컴포넌트들 |
| W6 | 차트 미리보기, 위젯 저장 연동 | `ChartPreview.tsx` |
| W7 | AI 인사이트 서비스 | `insight.service.ts` |
| W8 | 인사이트 UI, 사용량 UI | `InsightCard.tsx`, `UsageIndicator.tsx` |

### Month 3: 통합 + 출시 준비

| 주차 | 작업 | 산출물 |
|-----|-----|--------|
| W9 | 모드 전환, 클래식 UI 연동 | `ModeToggle.tsx` |
| W10 | Freemium 가드, 결제 연동 준비 | `usage-limit.guard.ts` |
| W11 | 테스트, 버그 수정 | 테스트 코드 |
| W12 | 배포, 문서화 | README, 사용자 가이드 |

---

## 8. 수정할 기존 파일

### 백엔드

| 파일 | 변경 내용 |
|-----|----------|
| `app.module.ts` | AiModule, UsageModule import 추가 |
| `database.service.ts` | 스키마 정보 반환 메서드 추가 |
| `widget.service.ts` | AI 생성 위젯 저장 메서드 추가 |

### 프론트엔드

| 파일 | 변경 내용 |
|-----|----------|
| `App.tsx` | `/ai/*` 라우트 추가 |
| `Sidebar.tsx` (또는 해당 메뉴 컴포넌트) | AI 쿼리 메뉴 추가 |
| `api/index.ts` | aiService export 추가 |

---

## 9. 환경 변수

```env
# .env.dev / .env 추가
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
AI_DEFAULT_MODEL=claude-3-haiku-20240307
AI_INSIGHT_MODEL=gpt-3.5-turbo
AI_MONTHLY_FREE_LIMIT=50
AI_INSIGHT_FREE_LIMIT=10
```

---

## 10. 성공 지표

| 지표 | 목표 |
|-----|-----|
| MVP 출시 | 3개월 내 |
| NL2SQL 정확도 | 80%+ |
| Free → Premium 전환율 | 5%+ |
| 월간 활성 사용자 (MAU) | 100명+ (출시 3개월 후) |
| LLM 비용 | $500/월 이하 |

---

## 11. 리스크 및 대응

| 리스크 | 대응 방안 |
|-------|----------|
| NL2SQL 정확도 낮음 | Few-shot 예제 추가, 프롬프트 튜닝 |
| LLM 비용 초과 | 캐싱 적극 활용, 토큰 최적화 |
| 3개월 내 미완성 | 인사이트 기능 후순위로 연기 |
| 사용자 피드백 반영 어려움 | MVP 출시 후 피드백 루프 구축 |

---

## 12. 구현 시작 파일 순서

### 백엔드 (우선순위 순)

1. **`backend-api/src/ai/ai.module.ts`** - AI 모듈 정의
2. **`backend-api/src/ai/services/llm.service.ts`** - LLM 통합 서비스
3. **`backend-api/src/ai/services/nl2sql.service.ts`** - NL2SQL 핵심 로직
4. **`backend-api/src/ai/services/chart-recommender.service.ts`** - 차트 추천
5. **`backend-api/src/ai/ai.controller.ts`** - API 엔드포인트
6. **`backend-api/src/ai/dto/*.ts`** - DTO 정의
7. **`backend-api/src/usage/usage.module.ts`** - 사용량 추적 모듈
8. **`backend-api/src/ai/guards/usage-limit.guard.ts`** - Freemium 가드

### 프론트엔드 (우선순위 순)

1. **`frontend-web/src/api/aiService.ts`** - AI API 서비스
2. **`frontend-web/src/pages/AI/AIQuery.tsx`** - 메인 UI 페이지
3. **`frontend-web/src/components/ai/NLQueryInput.tsx`** - 입력 컴포넌트
4. **`frontend-web/src/components/ai/SQLPreview.tsx`** - SQL 미리보기
5. **`frontend-web/src/components/ai/ChartPreview.tsx`** - 차트 미리보기
6. **`frontend-web/src/components/ai/InsightCard.tsx`** - 인사이트 카드
7. **`frontend-web/src/components/ai/UsageIndicator.tsx`** - 사용량 표시

---

## 13. DTO 정의

### NL2SQL DTO

```typescript
// dto/nl2sql.dto.ts
export class Nl2SqlDto {
  @IsNumber()
  databaseId: number;

  @IsString()
  @MinLength(3)
  query: string; // 자연어 질문
}

export class Nl2SqlResponseDto {
  sql: string;
  explanation: string;
  confidence: number;
  isValid: boolean;
  preview?: any[]; // 실행 결과 미리보기 (10행)
}
```

### Query & Visualize DTO

```typescript
// dto/query-visualize.dto.ts
export class QueryVisualizeDto {
  @IsNumber()
  databaseId: number;

  @IsString()
  naturalLanguageQuery: string;
}

export class VisualizationDto {
  sql: string;
  data: any[];
  recommendedChart: 'line' | 'bar' | 'pie' | 'table' | 'number';
  chartOption: any; // ECharts option
  insights?: Insight[];
}
```

### Insight DTO

```typescript
// dto/insight.dto.ts
export class InsightDto {
  @IsOptional()
  @IsNumber()
  datasetId?: number;

  @IsOptional()
  @IsArray()
  data?: any[];
}

export class Insight {
  type: 'trend' | 'anomaly' | 'recommendation' | 'summary';
  content: string;
  importance: 'high' | 'medium' | 'low';
}

export class InsightResponseDto {
  insights: Insight[];
}
```

### Usage DTO

```typescript
// dto/usage.dto.ts
export class UsageDto {
  nl2sqlUsed: number;
  nl2sqlLimit: number;
  insightsUsed: number;
  insightsLimit: number;
  tier: 'free' | 'premium';
  resetDate: Date;
}
```

---

## 14. 참고: 기존 코드 활용 포인트

### ConnectionService 재사용
- 파일: `backend-api/src/connection/connection.service.ts`
- 용도: SQL 쿼리 실행 (`executeQuery` 메서드)

### DatabaseService 재사용
- 파일: `backend-api/src/database/database.service.ts`
- 용도: 테이블 스키마 조회 (`findOne` 메서드의 테이블 정보)

### WidgetService 확장
- 파일: `backend-api/src/widget/widget.service.ts`
- 용도: AI 생성 위젯 저장 메서드 추가

### 차트 모듈 재사용
- 파일: `frontend-web/src/widget/modules/`
- 용도: LineChart, BarChart, PieChart 등 기존 컴포넌트 활용

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|-----|------|----------|
| 1.0 | 2025-11-29 | 초기 계획 작성 |
