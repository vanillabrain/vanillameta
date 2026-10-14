# 저장 지표 계산식 변경 검증 — 2026-10-14

[UC-003](../use_cases/UC-003-update-metric-calculation.md), [TC-003](../test_cases/TC-003-update-metric-calculation.md), [설계](../architecture/metric-calculation-update.md)를 먼저 작성·검토·pin한 뒤 구현했다. Assistant 수정 모드에서 차트/저장 지표를 선택하고 `계산식 변경`으로 집계·컬럼을 바꾼다. 미리보기 후 `지표·분석 저장`은 현재 선택 분석의 한 차트와 지표 정의를 함께 저장한다. 다른 분석은 snapshot으로 유지한다.

## Results

| Gate              | Result                 | Evidence                                                                                                                                                                                                                          |
| ----------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE targeted       | PASS                   | AI 저장/참조/Assistant·BI editor·ownership 5 suites/161 tests. 실제 SQLite/DuckDB로 preview 비변경, canonical AVG+filtered trends, 버전 경합, component 실패 rollback, 다른 위젯 유지, v1/v2 structured snapshot 링크 보존        |
| FE targeted       | PASS                   | 3 files/38 tests: 기존 실제 SDK transport + 계산식 preview/save, 두 버전 전달, 입력 변경 stale, 409 저장 실패, Drawer 폭 전환 상태 보존                                                                                           |
| Type/lint/build   | PASS                   | FE tsc, 변경 BE/FE lint, Nest/Vite build. 기존 service.spec non-null assertion 경고는 변경 범위 밖                                                                                                                                |
| Existing UI/XHR   | PASS                   | Aside3698 분석8/소스7/검증 지표17, SUM→AVG(bid_request_cnt). 미리보기455.9685018094644(표시455.97), 시간별169 points. 미리보기 후 Metric17 version1 유지 확인                                                                     |
| Save/reload       | PASS                   | 실제 지표·분석 저장→reload. Metric17 version2/AVG, 분석8 canonical AVG SQL, structured snapshot version2/link17 보존. 화면455.97와 평균 추세 유지                                                                                 |
| Preserve original | PASS                   | 공식 지표3/4 definition 및 기존 분석5 JSON byte동일                                                                                                                                                                               |
| UI design         | PASS_SELECTED_WIDTHS   | Aside 편집 dialog 두 입력32px/12px. PW390/1440: 긴 label 줄바꿈, 입력32px·버튼28px·동일 x/width, dialog 가로 overflow0. 모바일 preview 실행 후 저장은 하지 않음                                                                   |
| Rill comparison   | PASS_SELECTED_ELEMENTS | 실제 Rill0.90.5: 검증 measure uc003_requests를 SUM→AVG로 수정·Save changes→Explore→reload, 숫자455.97와 시간별 추세·OS 평균 순위. 원래3개 measure 계산식 유지. 동일1440×1080 편집 화면도 캡처해 집계/컬럼 선택의 밀도와 정렬 대조 |

원본의 SUM634513000/행1391572로 계산한 AVG455.9685018094644와 VM 실제 XHR이 일치한다. Rill은 none format의455.97로 반올림한다. Rill 데이터 시점은2026 PDT로 이동되어 VM2023 UTC 버킷의 날짜별 일치를 주장하지 않는다. Rill은 중앙 지표 정의 저장 후 연결된 뷰에서 즉시 계산하고, VM은 선택 차트의 계산식 변경 미리보기 후 지표+해당 분석을 atomic 저장한다. 전체 자동 전파·동일한 화면 배치·Rill의 별도 변경 전 preview 기능 동등성은 구현/검증했다고 주장하지 않는다.

## Execution notes

기존 API4898·프록시4899·FE3698·DB/업로드 경로를 유지했다. Aside 세션의 오래된 인증이 분석 fixture 생성 중 만료되어 저장이 login으로 이동했고, 같은 검증 계정으로 재로그인해 fixture 생성 후 변경 흐름을 진행했다. 데이터 관리 화면의 기존 조회 오류는 계산식 변경 경로와 분리하여 기록하고 기존 Explore 제작 화면에서 fixture를 만들었다. 관련 없는 데이터 관리 수정은 수행하지 않았다.

초기 BE 검사는 trend.datas 대신 points를 읽은 테스트 오류와 기존 캐시 검사의 실행 순서 영향이 있었다. 새 테스트를 독립된 후행 검사로 옮겨 고쳤다. 정의 버전2를 거부하던 이전 회귀도 양의 버전 계약에 맞게 음수/0 손상 사례로 수정했다. 동일1440 실제 캡처를 읽으면서 Drawer variant 전환 시 자식 dialog가 remount되어 편집·preview가 초기화됨을 발견했다. dialog 상태를 Drawer 밖의 같은 부모에 두어 유지했고, temporary/persistent 전환을 흉내내는 회귀와 실제390→1440에서 AVG/preview 유지 assertion으로 재검증했다. FE 테스트의 ESM MUI mock 충돌은 기존 테스트 방식과 같은 시각 컴포넌트 대체로 해결했고, 실제 디자인은 브라우저로 별도 검증했다.

일반 요청 수 생성의 SUM 보호가 변경된 저장 AVG 정의를 다시 거부하지 않도록 검증된 명시 지표 참조만 우선하게 했다. 참조 없는 요청 수 합계 검증은 유지한다. 이 후속 AI 생성 호환성은 단위 검사이며 새 실제 LLM 질문은 재실행하지 않았다. 계산식 변경 자체는 LLM 호출 없이 수행한다.

## Artifacts and limits

- `/tmp/vm-metric-update/`: be-final.log, be-snapshot.log, fe-final.log, type-final.log, lint-be.log, lint-fe.log, be-build.log, fe-build.log, preview.json, persisted.json, layout.json, dialog-390/1440.png, rill-metrics/change/average.png, rill-editor-1440.png, rill-average/reload.txt. raw API로그는 packet에 넣지 않는다.
- 기존 Aside artifacts: uc003-before/preview/reload.png, uc003-preview/responses.json, uc003-reload.txt. 생성 응답만 보관하고 인증 헤더는 포함하지 않는다.
- VM 검증 지표17·분석8과 Rill 검증 measure uc003_requests를 남겼다. 별도 모바일 계정은 기존 source21/분석7 지표를 읽어 AVG preview만 검증해 원래 저장 정의를 유지했다.
- 30초과 catalog paging, 전체 분석 자동 전파, 전체 core E2E/VoiceOver/운영 배포는 NOT_RUN. 실제 변경 UI/XHR end-to-end는 위 범위로 완료했다. UI 오류·경합의 모든 조합을 실제 화면에서 반복하지 않고 하위 SQLite/API 회귀로 확인했다.
- 독립 reviewer·stakeholder acceptance는 수행하지 않았다. 로컬 packet 상태는 awaiting_review, acceptance not_recorded다.
