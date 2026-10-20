# 프론트엔드 성능 모니터링 가이드

## 개요

VanillaMeta 프론트엔드 애플리케이션은 사용자 경험을 최적화하기 위해 포괄적인 성능 모니터링 시스템을 구축했습니다. 이 문서는 성능 모니터링 시스템의 구성 요소와 사용 방법을 설명합니다.

## 모니터링 구성 요소

### 1. Core Web Vitals 추적

Web Vitals 라이브러리를 통해 다음 지표들을 자동으로 추적합니다:

- **LCP (Largest Contentful Paint)**: 가장 큰 콘텐츠가 화면에 그려지는 시간
- **FID/INP (First Input Delay/Interaction to Next Paint)**: 첫 입력 지연 시간
- **CLS (Cumulative Layout Shift)**: 누적 레이아웃 이동
- **FCP (First Contentful Paint)**: 첫 콘텐츠 페인트 시간
- **TTFB (Time to First Byte)**: 첫 바이트까지의 시간

### 2. 커스텀 성능 메트릭

#### Performance Context API

애플리케이션 전반에 걸쳐 커스텀 성능 측정을 위한 Context API를 제공합니다:

```typescript
import { usePerformance } from '@/contexts/PerformanceContext';

const MyComponent = () => {
  const { markStart, markEnd } = usePerformance();
  
  useEffect(() => {
    markStart('my-operation');
    // 비동기 작업 수행
    performOperation().then(() => {
      markEnd('my-operation');
    });
  }, []);
};
```

#### 차트 렌더링 성능

차트 컴포넌트의 렌더링 성능을 자동으로 측정합니다:

```typescript
<ChartPerformanceWrapper
  chartType="line-chart"
  widgetId={widget.id}
  dataSize={data.length}
>
  <LineChart data={data} />
</ChartPerformanceWrapper>
```

#### API 응답 시간 추적

모든 API 요청의 응답 시간을 자동으로 측정하고 기록합니다:
- 요청별 실행 시간
- 느린 API 경고 (1초 이상)
- 에러 응답 성능 추적

### 3. Performance Observer API

브라우저의 Performance Observer API를 활용하여 다음을 모니터링합니다:

- **Navigation Timing**: 페이지 로드 성능
- **Resource Timing**: 리소스 로딩 성능
- **Long Tasks**: 50ms 이상의 긴 작업
- **Layout Shifts**: 레이아웃 변경 감지

## 데이터 수집 및 전송

### 배치 처리

성능 데이터는 다음 방식으로 효율적으로 전송됩니다:
- 20개 데이터 수집 시 자동 전송
- 30초마다 주기적 전송
- 페이지 언로드 시 남은 데이터 전송

### Google Analytics 통합

프로덕션 환경에서는 Google Analytics 4로 성능 데이터를 전송합니다:

```javascript
// 환경 변수 설정
REACT_APP_GA_MEASUREMENT_ID=G-XXXXXXXXXX

// 자동으로 전송되는 이벤트
- web_vitals: Core Web Vitals 메트릭
- custom_timing: 커스텀 성능 측정
- api_performance: API 응답 시간
- long_task: 긴 작업 감지
```

## 성능 리포트 생성

### 자동 리포트 생성

```bash
# 성능 리포트 생성
yarn performance:report

# Lighthouse 실행
yarn lighthouse
```

생성되는 리포트:
- 번들 크기 분석
- Lighthouse 성능 점수
- 페이지별 성능 메트릭
- 개선 권장사항

### 리포트 위치

```
frontend-web/
└── performance-reports/
    ├── performance-summary-[timestamp].json
    ├── performance-report-[timestamp].md
    └── lighthouse-[page]-[timestamp].html
```

## 성능 임계값 및 알림

### 임계값 설정

- **LCP**: 2.5초 이하 (좋음), 4초 이하 (개선 필요)
- **FID/INP**: 100ms 이하 (좋음), 300ms 이하 (개선 필요)
- **CLS**: 0.1 이하 (좋음), 0.25 이하 (개선 필요)
- **API 응답**: 1초 이상 시 경고
- **차트 렌더링**: 1초 이상 시 경고

### 개발 환경 디버깅

개발 환경에서는 콘솔에 다음 정보가 출력됩니다:

```
🎯 Web Vitals: [메트릭 정보]
⏱️ chart-render: 250.34ms
⚡ API Performance: GET /api/data - 156.78ms
⚠️ Slow chart rendering detected: line-chart took 1234.56ms
❌ API Error Performance: POST /api/widget - 2345.67ms (Status: 500)
```

## 모범 사례

### 1. 컴포넌트 성능 측정

```typescript
// 복잡한 연산이나 렌더링을 측정
const ComplexComponent = () => {
  const { markStart, markEnd } = usePerformance();
  
  const processData = useCallback(async () => {
    markStart('complex-calculation', { dataSize: data.length });
    
    const result = await performComplexCalculation(data);
    
    markEnd('complex-calculation');
    return result;
  }, [data]);
};
```

### 2. 조건부 측정

```typescript
// 프로덕션에서만 측정
if (process.env.NODE_ENV === 'production') {
  markStart('production-only-metric');
  // ...
  markEnd('production-only-metric');
}
```

### 3. 메타데이터 추가

```typescript
// 추가 컨텍스트 정보 포함
markStart('data-fetch', {
  endpoint: '/api/data',
  filters: filterCount,
  pageSize: 100
});
```

## 트러블슈팅

### 성능 데이터가 수집되지 않을 때

1. 브라우저 개발자 도구의 Network 탭에서 Google Analytics 요청 확인
2. 콘솔에서 성능 로그 확인
3. `window.gtag` 함수 존재 여부 확인

### 느린 성능 개선

1. 성능 리포트에서 병목 지점 확인
2. 차트 데이터 크기 최적화
3. API 응답 캐싱 구현
4. 컴포넌트 메모이제이션 적용

## 향후 개선 계획

1. Real User Monitoring (RUM) 대시보드 구축
2. 성능 예산 자동화
3. CI/CD 파이프라인에 성능 테스트 통합
4. 사용자 세그먼트별 성능 분석