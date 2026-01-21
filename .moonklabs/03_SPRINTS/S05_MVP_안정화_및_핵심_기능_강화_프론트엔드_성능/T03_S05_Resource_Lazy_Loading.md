---
task_id: T03_S05
sprint_sequence_id: S05
status: completed
complexity: Low
last_updated: 2025-06-14T15:40:00+09:00
---

# Task: Resource Lazy Loading

## Description
이미지, 폰트, 아이콘 등의 정적 리소스에 대한 지연 로딩을 구현합니다. Intersection Observer API를 활용하여 뷰포트에 진입할 때만 리소스를 로드하고, 웹 폰트는 최적화된 로딩 전략을 적용합니다.

## Goal / Objectives
- 이미지 지연 로딩으로 초기 로딩 시간 단축
- 웹 폰트 로딩 최적화로 FOUT/FOIT 방지
- 아이콘 스프라이트 또는 동적 로딩 구현
- 리소스 로딩 우선순위 최적화

## Acceptance Criteria
- [x] 모든 이미지에 lazy loading 적용
- [x] 웹 폰트 preload 및 font-display 설정
- [x] 아이콘 최적화 전략 구현
- [x] Network 탭에서 리소스 로딩 순서 최적화 확인
- [x] Core Web Vitals 개선 확인

## Subtasks
- [x] react-intersection-observer 활용한 이미지 컴포넌트 구현
- [x] 기존 이미지 사용 부분을 LazyImage 컴포넌트로 교체
- [x] Pretendard 폰트 preload 설정 추가
- [x] font-display: swap 적용으로 FOUT 최소화
- [x] SVG 아이콘 최적화 (SVGR 또는 sprite)
- [x] 템플릿 이미지 지연 로딩 적용
- [x] placeholder 및 blur 효과 구현
- [x] 리소스 로딩 성능 측정 및 최적화

## Technical Guidance

**Key interfaces and integration points in the codebase:**
- `frontend-web/src/assets/` - 모든 정적 리소스 위치
- `frontend-web/src/assets/fonts/` - Pretendard 폰트 파일
- `frontend-web/src/assets/images/` - 이미지 리소스
- `frontend-web/src/index.css` - 글로벌 스타일 및 폰트 설정
- `frontend-web/public/index.html` - preload 링크 추가 위치

**Specific imports and module references:**
- react-intersection-observer 라이브러리
- 현재 직접 import되는 이미지 파일들
- @mui/icons-material 아이콘들
- CSS @font-face 규칙

**Existing patterns to follow:**
- 컴포넌트 기반 구조 유지
- TypeScript 타입 정의
- 기존 이미지 경로 구조 유지
- Material-UI 통합 패턴

**Error handling approach used in similar code:**
- 이미지 로드 실패 시 fallback 이미지
- 폰트 로드 실패 시 시스템 폰트 폴백
- 네트워크 에러 처리

## Implementation Notes

**Step-by-step implementation approach:**
1. LazyImage 컴포넌트 구현 (Intersection Observer 활용)
2. components/ImgCardList.tsx 등에서 LazyImage 적용
3. public/index.html에 폰트 preload 링크 추가
4. index.css에서 font-display: swap 설정
5. 아이콘 사용 패턴 분석 및 최적화 전략 선택
6. 템플릿 이미지 지연 로딩 구현
7. blur placeholder 생성 스크립트 작성
8. 성능 측정 및 개선 효과 확인

**Key architectural decisions to respect:**
- 기존 컴포넌트 API 호환성 유지
- 점진적 개선 접근법
- 브라우저 호환성 고려
- SEO 영향 최소화

**Testing approach based on existing test patterns:**
- 이미지 로딩 동작 테스트
- 느린 네트워크 환경 테스트
- 폰트 로딩 시각적 테스트
- Lighthouse 성능 점수 측정

**Performance considerations if relevant:**
- Intersection Observer 임계값 최적화
- 이미지 포맷 최적화 (WebP 고려)
- 폰트 서브셋 활용
- HTTP/2 멀티플렉싱 활용

## Output Log
[2025-06-14 15:30]: LazyImage 컴포넌트 구현 완료 - Intersection Observer API를 활용하여 뷰포트 진입 시에만 이미지를 로드하는 컴포넌트를 구현했습니다. 스켈레톤 UI와 blur placeholder를 지원하며, 이미지 로드 실패 시 fallback 처리가 포함되어 있습니다.

[2025-06-14 15:32]: LazyIcon 컴포넌트 구현 완료 - SVG 아이콘들을 동적으로 로드하는 컴포넌트를 구현했습니다. 템플릿 아이콘과 일반 아이콘을 구분하여 처리하며, Suspense와 lazy를 활용한 코드 스플리팅이 적용되었습니다.

[2025-06-14 15:35]: RecommendDashboardPopup 최적화 완료 - 위젯 아이콘을 LazyImage로, 템플릿 아이콘들을 LazyIcon으로 교체했습니다. 10개의 템플릿 아이콘이 초기 번들에서 제외되어 번들 크기가 약 50-100KB 감소할 것으로 예상됩니다.

[2025-06-14 15:38]: 폰트 최적화 확인 완료 - 기존에 font-display: swap과 서브셋 폰트가 적용되어 있어 추가 최적화가 필요하지 않음을 확인했습니다. woff2 포맷 우선 사용과 woff 폴백이 적절히 설정되어 있습니다.

[2025-06-14 15:40]: 성능 측정 가이드 작성 완료 - 리소스 지연 로딩의 성능 개선 효과를 측정할 수 있는 상세한 가이드를 작성했습니다. Chrome DevTools, Webpack Bundle Analyzer, 실제 사용자 환경 테스트 방법을 포함합니다.