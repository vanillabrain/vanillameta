# 2026-10-14 develop-v2 통합

- 작업 브랜치: `codex/self-service-next-20261014`, 검증 수정 커밋 `7bc1220d`.
- 통합 대상: `origin/develop-v2`의 `90dbfd71`.
- 변경: 큰 정수 추세 원값 보존, 저장 보기 삭제 실패 후 초점 복귀, 탐색 필터/차원 행 디자인, 모바일 파일 복원 버튼과 선택 검증 기록.
- 최신 develop-v2의 블록 ID·배치 보존/선택 AI 수정·지표 계산식 갱신을 함께 유지한다.

## 저장 보기 계약

두 브랜치가 같은 파일명에 서로 다른 저장 보기 API를 구현했다. 기존 데이터를 임의 변환하거나 한쪽 API를 제거하지 않는다.

- `/bi/explore/:sourceId/views`는 기존 PersonalView 기반 정의 revision과 대시보드 Pivot 연결 계약을 유지한다.
- `/bi/explore/views/{list,create,load,remove}`는 ExploreView 기반 source/measure revision·버전별 Pivot 상태 계약을 유지한다. 별도 `VersionedExploreViewService`와 validator로 이름을 구분한다.
- 서로 다른 스키마를 같은 validator에 통과시키거나 기존 저장 데이터를 새 형식으로 조용히 덮어쓰지 않는다.

## 검증

- Node 24에서 루트 `npm test`: backend 80 suites / 1,361 tests, frontend 53 files / 822 tests PASS.
- 루트 `npm run build`: backend Nest / frontend Vite PASS.
- frontend `tsc --noEmit` PASS. 충돌 해결 범위 ESLint: 오류 0, 기존 경고 backend 6 / frontend 5.
- 실제 headed Chromium 격리 E2E: 탐색·고급 Pivot 조건 저장 → 새로고침 → 복원 → CSV 다운로드 → 삭제 1 PASS (13초).
- 기본/명시적 차원 정렬의 응답 계약을 통일하고, 안전한 수 범위를 넘는 부동소수점 증감은 정렬에서도 미계산으로 취급한다. 정확한 큰 정수 SQL 정렬과 원값 보존 검사를 함께 통과했다.
- 기존 Pivot과 고급 Pivot의 저장/내보내기 형식을 분리해 잘못된 형식으로 저장되지 않도록 유지했다.
- 증빙 로그: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/develop-v2-merge-20261014/` (`root-test-final.log`, `root-build-final.log`, lint/typecheck logs, `e2e/playwright-001.log`).

기존 통과 케이스 전체 UI 재실행과 신규 화면 캡처는 이번 Git 통합 범위에서 수행하지 않았다. gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다. 실제 AI 제공자 재호출은 미실행이며, AI 관련 단위 검사는 포함했다. 과거 화면 통과 기록은 당시 커밋 기준이며 이번 통합의 전체 UI 인증으로 확대하지 않는다.
