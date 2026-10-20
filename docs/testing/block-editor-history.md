# UC-007 실행 기록 — 2026-10-15

기준 develop-v2 / 5ef232dc 위 작업 diff. [계획](../plans/UC-007.md) / [UC-007](../use_cases/UC-007-edit-block-history.md). P1 첫 후속 단위이며 전체 P1/TC-005 통과를 뜻하지 않는다.

## 변경

- 차트·배치 편집 화면의 복제, 최대50단계 undo/redo. 제목·설정·추가·삭제·순서·크기를 복원하며 새 편집은 redo를 지운다. 복원은 미리보기를 무효화한다. 재조회·경로 전환은 이력을 초기화한다.
- 블록 설정은 기본 접힘, 이동/복제/삭제는 표시. 공통 AnalysisUiProvider 사용, 화면 전체 버튼/입력 minHeight 강제 제거. 숫자 미리보기에 기존 MetricTrend 연결.
- 기존 SQL 복제는 소유 분석의 copyOf를 서버에서 확인하고 서버 원본 SQL을 사용한다. 신규 논리 ID는 기존 저장 경계가 발급한다. 클라이언트가 새 blockId로 기존 identity 검증을 우회하지 않는다.
- 복제 저장 검증에서 기존 숫자 블록 높이2가 편집기 기본 높이3으로 바뀌는 회귀를 발견했다. 서버가 요청 크기와 불러온 편집 크기를 비교해 변경하지 않은 블록의 geometry를 보존한다. preserveSizeIds는 서버가 계산하는 내부 인자이며 클라이언트 요청값을 신뢰하지 않는다.
- 기존 SourceDetails 테스트3곳의 act 콜백은 void 반환으로 수정해 타입 검사 오류를 해결했다. 테스트 동작은 동일하다.

## 확인 결과

| 케이스                              | 상태          | 증거                                                                                           |
| ----------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| TC-007-01 복제 원본/ID/SQL 경계     | PASS 단위/API | 서버 원본 SQL 사용, 잘못된 copyOf 거절, 신규 server blockId, 원본 분석12 불변                  |
| TC-007-02 undo/redo·미리보기 무효화 | PASS 컴포넌트 | 복제/삭제 복원, 제목/크기 undo, 새 변경 후 redo 비활성, 재조회 초기화                          |
| TC-007-03 저장·재조회·충돌          | PASS API      | 분석14, 숫자 복제값634513000, 복제 추세169 points, 원본3개 ID/geometry 보존, stale revision409 |
| TC-007-04 화면·디자인·모바일        | BLOCKED       | 기존 브라우저 URL 정책 차단이 해제되지 않았다. 다른 브라우저/Playwright로 우회하지 않았다      |

- 복제본에 실제 지정 LLM으로 제목 변경 → 미리보기 → 저장 → API 재조회까지 PASS. 비대상3개 내용·전체 ID·geometry 유지 확인. 생성 컨텍스트에서 반복되는 UI 구간 선택 메타데이터를 제외해 프롬프트 크기 제한 회귀를 방지하고 정확한 시계열·coverage는 유지했다.
- BE 3 suites / **85 tests PASS**: bi-editor, dashboard-blocks, ai-dashboard.service.
- FE 2 files / **187 tests PASS**: DashboardEdit (13), SourceDetails (174).
- FE `tsc --noEmit`, 변경 BE/FE eslint, BE/FE build PASS. 빌드의 기존 CSS minifier/Vite 설정 경고는 남아 있다.
- 실제 API는 최신4898, 화면은 기존3698 유지. 검증 분석14의 편집 주소는 `http://127.0.0.1:3698/dashboard/14/edit-charts`이다. 주소 제공은 실제 화면 관찰 증거가 아니다.
- 실제 API 실행 증빙 `/tmp/vm-block-history/result.json`, fixture.json, verify.cjs, ai-copy.cjs. 최초 실패 fixture13과 성공 fixture14를 구분한다. 임시 증빙은 영구 보관을 보장하지 않는다.
- Rill 공식 source7 수치 oracle634513000 재사용. 이번에는 Rill 화면을 다시 관찰하지 않았다. Rill의 데이터 탐색과 VM 블록 undo/복제를 같은 기능으로 판정하지 않는다.
- 실제 UI/모바일390·768·1440, 브라우저 새로고침, core E2E는 이번 diff에서 미실행. 기존14일 실LLM 검증을 신규 UI 통과로 재사용하지 않는다. 익명 공유는 실행하지 않았다.

## 남은 범위

undo는 이 편집 화면의 로컬 초안에 한정한다. AI 대화/자유 위치 드래그/게시의 변경을 통합하여 되돌리는 계약과 breakpoint별 독립 배치 저장은 아직 없다. 기존 순서·크기 선택을 모바일 자유 위치 편집 완료로 선언하지 않는다. 복제본의 실제 LLM 선택 수정·저장 후 ID/배치 보존은 API로 확인했으며, 해당 화면 여정은 BLOCKED다.
