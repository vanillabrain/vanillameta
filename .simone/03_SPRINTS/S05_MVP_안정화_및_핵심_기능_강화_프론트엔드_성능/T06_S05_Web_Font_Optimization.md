---
task_id: T06_S05
sprint_sequence_id: S05
status: open
complexity: Low
last_updated: 2025-06-14T12:00:00Z
---

# Task: Web Font Optimization

## Description
Pretendard 웹 폰트의 로딩 성능을 최적화합니다. 한글 서브셋팅을 통해 폰트 파일 크기를 줄이고, 최적화된 로딩 전략을 적용하여 텍스트 렌더링 성능을 개선합니다. FOUT/FOIT 현상을 최소화하여 사용자 경험을 향상시킵니다.

## Goal / Objectives
- Pretendard 폰트 파일 크기 70% 감소
- 폰트 로딩으로 인한 레이아웃 시프트 제거
- 중요 텍스트의 빠른 렌더링 보장
- 폰트 로딩 전략 최적화

## Acceptance Criteria
- [ ] 한글 서브셋 폰트 생성 및 적용 완료
- [ ] font-display: swap 설정으로 FOIT 방지
- [ ] 폰트 preload로 로딩 우선순위 향상
- [ ] 폰트 파일 크기 70% 이상 감소 확인
- [ ] CLS (Cumulative Layout Shift) 점수 개선

## Subtasks
- [ ] 사용 중인 한글 문자 분석 및 서브셋 범위 결정
- [ ] fonttools를 이용한 Pretendard 서브셋 생성
- [ ] WOFF2 포맷 변환 및 최적화
- [ ] @font-face 규칙 업데이트 (unicode-range 포함)
- [ ] 폰트 preload 링크 추가 (주요 weight만)
- [ ] font-display: swap 설정 적용
- [ ] 폴백 폰트 스택 최적화
- [ ] 폰트 로딩 성능 측정 및 문서화

## Technical Guidance

**Key interfaces and integration points in the codebase:**
- `frontend-web/src/assets/fonts/` - 현재 폰트 파일 위치
- `frontend-web/src/index.css` - @font-face 규칙 정의
- `frontend-web/public/index.html` - preload 태그 추가 위치
- `frontend-web/src/theme/theme.tsx` - Material-UI 폰트 설정

**Specific imports and module references:**
- 현재 사용 중인 Pretendard weight: Thin ~ Black (9개)
- woff, woff2 포맷 지원
- Material-UI theme의 typography 설정
- CSS 변수를 통한 폰트 패밀리 참조

**Existing patterns to follow:**
- 현재 woff-subset, woff2-subset 디렉토리 구조
- @font-face 선언 패턴
- font-weight 명명 규칙 (100-900)
- 폰트 파일 명명 규칙

**Error handling approach used in similar code:**
- 폰트 로드 실패 시 시스템 폰트 폴백
- 브라우저 호환성을 위한 다중 포맷 제공
- 폰트 로딩 상태 모니터링

## Implementation Notes

**Step-by-step implementation approach:**
1. 프로젝트 전체 한글 사용 문자 추출 스크립트 작성
2. KS X 1001 기준 자주 사용하는 한글 2,350자 선정
3. pyftsubset으로 서브셋 폰트 생성
4. woff2 압축 및 최적화
5. unicode-range를 포함한 @font-face 업데이트
6. Regular, Medium, Bold weight만 preload
7. font-display: swap 적용
8. 성능 측정 및 개선 효과 확인

**Key architectural decisions to respect:**
- 기존 폰트 weight 체계 유지
- Material-UI 통합 유지
- 브라우저 호환성 고려
- 점진적 개선 접근

**Testing approach based on existing test patterns:**
- 폰트 로딩 시각적 테스트
- 다양한 브라우저 호환성 테스트
- 네트워크 속도별 로딩 테스트
- Lighthouse 폰트 관련 지표 측정

**Performance considerations if relevant:**
- 초기 로딩에 필요한 weight만 preload
- 나머지 weight는 필요시 로드
- 서브셋 범위 최적화로 파일 크기 최소화
- HTTP/2 멀티플렉싱 활용

## Output Log
*(This section is populated as work progresses on the task)*