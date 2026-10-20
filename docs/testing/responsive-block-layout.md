# UC-009 실행 — 2026-10-15

기준 develop-v2 / dffdf342 위 diff. [UC](../use_cases/UC-009-responsive-block-layout.md) / [계획](../plans/UC-009.md). 전체 P1/TC-005 완료가 아니다.

## 변경과 결과

- 블록 ID별 모바일4/태블릿8/데스크톱12열 좌표를 기존 analysisDefinition JSON에 기록한다. DB migration은 추가하지 않았다.
- 편집기의 화면 폭 선택과 위치·너비·높이 입력이 공통 초안/undo에 연결된다. 기존 preset 크기 선택은 좌표가 없는 이전 응답에만 표시하여 같은 설정이 중복되지 않게 했다.
- owned DashboardAnalysis 읽기 화면은 세 좌표를 CSS grid에 적용한다. 배치 없는 이전 분석은 기존 desktop 좌표에서 도출하며 조회만으로 재저장하지 않는다.
- legacy grid의 desktop 좌표와 실제 dashboard.layout을 일치시키고 최소 너비 같은 기존 보조 속성도 유지한다. 모바일·태블릿 좌표는 내용 AI 수정 및 일반 AI 저장에서 보존한다. 클라이언트 AI draft의 배치 필드는 명시 배치 쓰기 권한으로 처리하지 않는다.
- 새 복제본은 점유 영역 아래에 기본 배치하고 원본 좌표를 보존한다. 겹침/범위/잘못된 화면 폭 입력을 거절한다. 실패는 transaction/compile 경계에서 일부 정의를 남기지 않는다.

| 케이스                      | 결과           | 증거                                                                                                                    |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| TC-009-01 세 좌표 저장·복원 | PASS API       | 새 비공개 검증 분석16에 각 폭의 다른 x/y/w/h 저장, API 재조회 일치                                                      |
| TC-009-02 범위·겹침 오류    | PASS 단위/API  | 정수/범위/unknown 폭 거절, mobile 겹침400 후 저장 정의 동일                                                             |
| TC-009-03 편집 이력·읽기    | PASS 컴포넌트  | 모바일 좌표 변경→undo, desktop 값 유지; 세 CSS grid 매핑과 신규 블록 fallback 회귀                                      |
| TC-009-04 AI/복제 보존      | PASS 실LLM/API | 실제 LLM 제목 수정의 미리보기와 저장·재조회에서 세 좌표/ID 유지; 사용자 지정 배치에서6번째 복제 후 원본5개 세 좌표 유지 |
| TC-009-05 실제 화면         | BLOCKED        | 기존 브라우저 정책 차단.390/768/1440 실제 화면·새로고침·Rill 화면 재비교·core browser E2E를 우회하지 않음               |

BE 관련3 suites **97 tests PASS**, FE 관련3 files **60 tests PASS**, FE 타입·변경 lint·BE/FE build PASS. 기존 빌드/타입 도구 경고는 남아 있다. 컴포넌트/스타일 검사로 디자인 PASS를 선언하지 않는다.

API4898는 최신 빌드, frontend3698는 기존 실행 유지. `http://127.0.0.1:3698/dashboard/16/edit-charts`는 확인할 화면 주소이며 실제 UI 관찰 증거가 아니다. 증빙 `/tmp/vm-responsive-layout/result.json`, `fixture.json`, `verify.cjs`, `duplicate.cjs`, `final-read.cjs`; 단위 로그 `/tmp/vm-responsive-tests.log`, `/tmp/vm-responsive-fe-tests.log`. 임시 증빙의 영구 보관은 보장하지 않는다. 로그인 응답과 토큰은 기록하지 않았다.

공식 Rill 소스7 fixture를 사용했으며 원본 분석15는 변경하지 않았다. 최종 빌드 재조회에서 원본5개 계산식·차트 종류도 동일함을 확인했다. 배치 변경은 계산식 변경을 요구하지 않는다. Rill 화면의 동등한 배치 편집을 확인했다고 주장하지 않는다. 익명 공유는 하지 않았다.

## 다음

포인터 drag/resize, 자연어 배치 이동, 실제 모바일·데스크톱 디자인 확인이 남는다. 공유/게시 읽기 화면의 배치 적용은 P4 계약과 함께 검증한다. 저장 지표/차원 공동 생성, 단일 입력 의도 실행, 게시 버전·재사용은 기존 P2~P5가 계속 Open이다.
