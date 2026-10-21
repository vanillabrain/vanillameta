# Resource Lazy Loading 성능 개선 효과

## 구현 개요

T03_S05에서 구현한 리소스 지연 로딩 최적화 내용을 정리합니다.

## 구현 내용

### 1. LazyImage 컴포넌트

**위치**: `src/components/LazyImage/index.tsx`

**주요 기능**:
- Intersection Observer API를 활용한 뷰포트 진입 감지
- 임계값(threshold): 0.1, 루트 마진(rootMargin): 50px
- 스켈레톤 UI 또는 블러 placeholder 표시
- 이미지 로드 실패 시 fallback 이미지 처리
- 부드러운 페이드인 애니메이션 (0.3초)

**사용 예시**:
```tsx
<LazyImage
  src="/static/images/widget-icon.svg"
  alt="위젯 아이콘"
  width="30px"
  height="30px"
  objectFit="contain"
  threshold={0.1}
  rootMargin="100px"
/>
```

### 2. LazyIcon 컴포넌트

**위치**: `src/components/LazyIcon/index.tsx`

**주요 기능**:
- SVG 아이콘의 동적 임포트 지원
- 템플릿 아이콘, 일반 아이콘, 기타 이미지 구분 처리
- Suspense와 lazy를 활용한 코드 스플리팅
- 로딩 중 스켈레톤 UI 표시

**사용 예시**:
```tsx
<LazyIcon 
  iconName="template01"
  width="100%"
  height="100%"
/>
```

### 3. 폰트 최적화

**현재 상태**:
- Pretendard 폰트에 `font-display: swap` 이미 적용
- 서브셋 폰트 사용으로 파일 크기 최적화
- woff2 포맷 우선, woff 폴백 제공

## 적용된 컴포넌트

### RecommendDashboardPopup 컴포넌트

**변경사항**:
1. **위젯 아이콘**: Avatar → LazyImage로 교체
   - 동적으로 로드되는 `/static/images/${item.icon}` 이미지들
   - 100px 루트 마진으로 미리 로딩 준비

2. **템플릿 아이콘**: 직접 import → LazyIcon으로 교체
   - 10개 템플릿 아이콘 (template01~template10)
   - 코드 스플리팅으로 필요시에만 로드

3. **체크 아이콘**: 직접 import → LazyIcon으로 교체
   - ic-check.svg를 동적 로드

## 예상 성능 개선 효과

### 초기 번들 크기 감소
- **템플릿 아이콘**: ~10개 SVG 파일을 초기 번들에서 제외
- **예상 절약**: 약 50-100KB (압축 전 기준)

### 네트워크 요청 최적화
- **동적 이미지 로딩**: 뷰포트에 진입하는 이미지만 로드
- **폰트 렌더링**: font-display: swap으로 FOUT 최소화

### Core Web Vitals 개선
- **First Contentful Paint (FCP)**: 초기 번들 크기 감소로 개선
- **Largest Contentful Paint (LCP)**: 중요한 콘텐츠 우선 로딩
- **Cumulative Layout Shift (CLS)**: 스켈레톤 UI로 레이아웃 안정성 확보

## 성능 측정 방법

### 1. Chrome DevTools 사용

```bash
# 1. 개발 서버 실행
yarn start:local

# 2. Chrome DevTools > Network 탭
# - 빌드 전후 리소스 로딩 순서 비교
# - JavaScript 번들 크기 확인
# - 이미지 로딩 시점 확인

# 3. Chrome DevTools > Lighthouse
# - Performance 점수 측정
# - Core Web Vitals 확인
```

### 2. Webpack Bundle Analyzer

```bash
# 번들 분석 실행
ANALYZE=true yarn build

# http://localhost:8888에서 번들 분석 결과 확인
# - 청크 분리 현황
# - 각 컴포넌트별 크기
```

### 3. 실제 사용자 환경 테스트

**테스트 시나리오**:
1. 대시보드 추천 팝업 열기
2. 위젯 목록 스크롤
3. 템플릿 선택 화면 전환
4. 네트워크 탭에서 리소스 로딩 확인

**확인 포인트**:
- 스크롤 시 이미지 로딩 지연 확인
- 템플릿 아이콘 동적 로딩 확인
- 스켈레톤 UI 표시 확인

## 모니터링 설정

### 1. Performance Observer 추가 (선택사항)

```typescript
// Core Web Vitals 측정
if ('PerformanceObserver' in window) {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        console.log('LCP:', entry.startTime);
      }
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });
}
```

### 2. 이미지 로딩 성능 추적

```typescript
// LazyImage 컴포넌트에서 로딩 시간 측정
const handleImageLoad = () => {
  const loadTime = performance.now() - startTime;
  console.log(`Image loaded in ${loadTime}ms`);
  setImageLoaded(true);
  onLoad?.();
};
```

## 추후 개선 방향

### 1. WebP 포맷 지원
- 브라우저 지원 감지
- WebP → PNG/JPG 폴백

### 2. 이미지 최적화
- 반응형 이미지 (srcset)
- 다양한 크기의 이미지 제공

### 3. 서비스 워커 활용
- 중요한 리소스 캐싱
- 오프라인 지원

### 4. HTTP/2 Server Push (프로덕션)
- 중요한 폰트 파일 우선 전송
- CSS 파일과 함께 전송

## 검증 체크리스트

- [x] LazyImage 컴포넌트 구현 완료
- [x] LazyIcon 컴포넌트 구현 완료  
- [x] RecommendDashboardPopup 적용 완료
- [x] 폰트 최적화 상태 확인 완료
- [ ] Lighthouse 성능 점수 측정
- [ ] 실제 사용자 환경 테스트
- [ ] 번들 크기 비교 측정

## 결론

리소스 지연 로딩 구현으로 초기 로딩 성능을 개선하고, 사용자 경험을 향상시킬 수 있을 것으로 예상됩니다. 특히 위젯이 많은 대시보드나 템플릿 선택 화면에서 성능 개선 효과가 클 것으로 기대됩니다.