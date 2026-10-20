# Dynamic Import Performance Documentation

## 개요

React.lazy()와 Suspense를 사용한 동적 임포트 구현으로 초기 번들 크기를 줄이고 필요한 시점에 리소스를 로드하도록 최적화했습니다.

## 구현 내용

### 1. 라우트 기반 코드 스플리팅

모든 페이지 컴포넌트를 동적으로 임포트하도록 변경:

```typescript
// Before
import Dashboard from '@/pages/Dashboard';

// After
const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ '@/pages/Dashboard'));
```

적용된 페이지:
- Dashboard (대시보드 메인/뷰/생성/수정)
- Widget (위젯 메인/뷰/생성/수정)
- Data (데이터소스/데이터셋)
- Login/SignUp
- Share
- Status404

### 2. 차트 모듈 동적 로딩

50개 이상의 차트 컴포넌트를 동적 임포트로 전환:

```typescript
// 차트 타입별 청크 분리
const LineChart = lazy(() => import(/* webpackChunkName: "chart-line" */ '@/widget/modules/linechart/LineChart'));
const PieChart = lazy(() => import(/* webpackChunkName: "chart-pie" */ '@/widget/modules/piechart/PieChart'));
// ... 기타 차트들
```

### 3. Error Boundary 구현

청크 로딩 실패를 처리하는 ChartErrorBoundary 컴포넌트:
- 청크 로딩 실패 감지
- 사용자 친화적 에러 메시지
- 재시도 옵션 제공

### 4. 프리로딩 전략

#### Idle Preloading
메인 번들 로드 후 유휴 시간에 자주 사용되는 컴포넌트 프리로드:
- Dashboard
- Widget
- LineChart
- PieChart

#### Intersection Observer 기반 프리로딩
링크가 뷰포트에 가까워지면 해당 라우트 컴포넌트 프리로드

## 예상 성능 개선

### 번들 크기 감소
- 초기 번들: 모든 페이지와 차트 컴포넌트 제외
- 각 라우트별 독립 청크 생성
- 차트 타입별 독립 청크 생성

### 로딩 시간 개선
- First Contentful Paint (FCP) 개선 예상
- Time to Interactive (TTI) 개선 예상
- 필요한 컴포넌트만 로드하여 메모리 사용량 감소

## 측정 방법

### 개발 환경에서 확인
1. 개발 서버 실행: `yarn start:dev`
2. Chrome DevTools Network 탭에서 청크 확인
3. 각 라우트 이동 시 해당 청크만 로드되는지 확인

### 프로덕션 빌드 분석
```bash
# 빌드 실행
yarn build

# 번들 분석 (webpack-bundle-analyzer 필요)
yarn analyze
```

### Lighthouse 성능 측정
1. 프로덕션 빌드 배포
2. Chrome DevTools > Lighthouse
3. Performance 카테고리 실행
4. 메트릭 비교:
   - First Contentful Paint
   - Largest Contentful Paint
   - Time to Interactive
   - Total Blocking Time

## 모니터링 포인트

### 네트워크 요청
- 초기 로드 시 요청되는 청크 수
- 각 라우트별 추가 청크 요청
- 차트 렌더링 시 청크 요청

### 에러 모니터링
- ChartErrorBoundary에서 캐치되는 에러
- 청크 로딩 실패율
- 재시도 성공률

## 추가 최적화 제안

1. **청크 크기 최적화**
   - webpack SplitChunksPlugin 설정 조정
   - maxSize 옵션으로 청크 크기 제한

2. **HTTP/2 Push**
   - 주요 청크를 서버 푸시로 전송
   - 라우트별 필요 청크 매핑

3. **Service Worker 캐싱**
   - 청크 파일 캐싱 전략 수립
   - 오프라인 지원 강화

4. **Bundle Splitting 세분화**
   - Vendor 청크 최적화
   - Common 청크 추출 개선