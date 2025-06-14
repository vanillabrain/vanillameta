---
task_id: T03_S05
sprint_sequence_id: S05
status: open
complexity: Low
last_updated: 2025-06-14T12:00:00Z
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
- [ ] 모든 이미지에 lazy loading 적용
- [ ] 웹 폰트 preload 및 font-display 설정
- [ ] 아이콘 최적화 전략 구현
- [ ] Network 탭에서 리소스 로딩 순서 최적화 확인
- [ ] Core Web Vitals 개선 확인

## Subtasks
- [ ] react-intersection-observer 활용한 이미지 컴포넌트 구현
- [ ] 기존 이미지 사용 부분을 LazyImage 컴포넌트로 교체
- [ ] Pretendard 폰트 preload 설정 추가
- [ ] font-display: swap 적용으로 FOUT 최소화
- [ ] SVG 아이콘 최적화 (SVGR 또는 sprite)
- [ ] 템플릿 이미지 지연 로딩 적용
- [ ] placeholder 및 blur 효과 구현
- [ ] 리소스 로딩 성능 측정 및 최적화

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
*(This section is populated as work progresses on the task)*