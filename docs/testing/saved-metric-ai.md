# 저장 지표 AI 재사용 — 2026-10-14

[UC-002](../use_cases/UC-002-reuse-saved-metric.md)·[TC-002](../test_cases/TC-002-saved-metric-analysis.md)·[설계](../architecture/saved-metric-ai.md)를 먼저 작성·lint/pin하고 구현했다. 현재 재사용 가능한 기존 Metric.definition을 활용하며 신규 엔티티/DB migration·UI 메뉴·live reference registry를 만들지 않았다.

## Changes

- BiService의 구조화 필드 검증·계산식 컴파일을 metric-expression으로 추출해 제작/AI가 공유한다. SUM·비율·가중 평균 등의 기존 의미를 유지한다.
- AI 생성 전 소스 소유권을 확인하고 해당 소스 활성 정의 최대30개만 제공한다. schema/source/version/컬럼 오류와 손상 JSON은 제외한다. 라벨은 프롬프트 데이터로 취급한다.
- AI가 반환한 위젯의 metricId가 현재 catalog에 있으면 서버 계산식으로 value alias의 투영식만 교체한다. 기존 WHERE·분류·정렬·LIMIT는 유지한다. 다른 소스·잘못된 ID는 기존 재생성/실패 흐름으로 처리한다.
- 결과 reusedMetricIds는 생성 단계 증거다. 저장 정의는 기존 canonical SQL snapshot이며 원본 지표는 변경하지 않는다. 참조 없는 새 SQL은 기존 검증을 유지한다.

## Results

| Gate                 | Result                   | Evidence                                                                                                                                                               |
| -------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 구조 문서 검사       | PASS                     | AIWF strict no-baseline. 초기 공통 C-001/002 상태 drift는 UC-002 진행 상태로 조정 후 최종 Tested/Verified 동기화                                                       |
| BE 회귀              | PASS                     | 5 suites /137 tests: 새 참조 검사18개와 기존 AI97·제작/편집 회귀. AVG를 SUM으로 대체, WHERE/quoted category/ASC 보존, 비율·가중 계산, 외부/NULL 소유자 차단·손상 제외  |
| BE 빌드              | PASS                     | npm run build                                                                                                                                                          |
| 변경 production lint | PASS                     | 0 errors/warnings. 기존 service.spec의 non-null assertion4경고는 그대로이며 새 warning은 제거                                                                          |
| 실제 UI/XHR          | PASS_SELECTED_VARIANTS   | 기존3698 분석5 Assistant 수정. 자연어로 저장 Total Requests/Avg Bid Floor 재사용 요청. 실제 지정 gpt-6-luna, 응답 reusedMetricIds=[3,4]·KPI634,513,000/$5.57·숫자+추세 |
| 저장/reload          | PASS                     | 같은 분석5 저장→브라우저 reload, 수치/추세 유지. 메타데이터 저장 SQL의 SUM("bid_request_cnt")와 비율 canonical CAST 식 확인                                            |
| 정의 보존            | PASS                     | Metric3/4 원래 definition 텍스트 전후 byte동일                                                                                                                         |
| Rill 비교·디자인     | REUSED_SELECTED_VARIANTS | 이전 UC-001 같은 소스/뷰포트 Rill635M/$5.57 비교와 모바일 크기 증거를 재사용. 이번 실제1727 화면의 숫자/추세·접힌 설정 확인. FE 변경0                                  |

첫 실제 요청은 기존 요청 수 검사에서 quoted SUM을 거부해 생성 결과 검증 실패였다. 실패 화면을 보존하고 인용/비인용 SUM 검사 회귀를 추가했다. 같은 요청의 재시도에서 성공했다. 기존 API4898만 최종 빌드로 재시작했으며 원래 인증·DB·uploads·프록시4899·FE3698 유지.

## Limits

이번 실제 응답에서 OS막대는 참조ID 없이 기존 합계식을 유지했다. 그룹 차트의 명시 참조는 단위에서 검증했으나 UI에서 모든 차트에 ID가 자동 전달된다고 주장하지 않는다. 참조 없는 결과에는 서버 대체가 적용되지 않는다. 다음 보강은 재사용 여부를 보여주는 간단한 표시와 선택 지표의 확실한 참조 전달이다.

30개 초과 지표 페이지·live reference/지표 변경 전파·자동 자연어 이름 매칭 완전 보장·전체BE/E2E·이번 신규 모바일/VoiceOver·운영 배포는 NOT_RUN. 다른 계정/소스 차단은 새 단위 변형으로 확인했고 실제 계정 공격 E2E는 재실행하지 않았다. schema 검사와 preview 등 기존 하위 검증을 재사용하며 별도 DB/의존성을 추가하지 않았다.

## Artifacts

- `/tmp/vm-saved-metrics/`: unit-final.log, build-final.log, lint-final.log(기존4경고 포함), lint-production.log, definitions-before.txt, persisted.json, api-result.log. raw API로그는 packet에 넣지 않는다.
- Aside `/Users/drumcap/.aside/u/0/sessions/2026-10-14_ElRAuMzDbgj1MolF/artifacts/`: saved-metric-first-failure.png, saved-metric-preview.png, metric-reuse-response.json(인증 없는 생성 응답), metric-reuse-reloaded.txt/png.
- `.aiwf/` pin/check/packet은 로컬에 보관하며 awaiting_review / acceptance not_recorded를 유지한다. 문서·코드는 Git에 저장한다.

## Explicit selection — follow-up

AIWF 설계·BR-004·TC 회귀를 먼저 추가하고 구현했다. Assistant에서 수정 모드/단일 차트 선택일 때만 저장 지표 입력을 표시한다. 목록은 생성과 같은 authorized/valid/30개 catalog이며 선택하지 않으면 기존 SQL 생성 흐름이다. server-confirmed metricReferences는 미리보기 해당 차트 위에 표시하고 SQL snapshot으로 저장한다. 재사용 표시는 생성 단계 증거이며 새로고침 후 live 연결 배지를 만들지 않는다.

| Gate                        | Result                 | Evidence                                                                                                                                                                                                  |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE targeted                 | PASS                   | 4 suites/130 tests. 누락·상충 참조 강제, 타 위젯/title 보존, 잘못된 대상/지표/복수 출력 거부, indexed provenance, catalog source ownership 포함                                                           |
| FE targeted                 | PASS                   | 2 files/34 tests. 실제 SDK transport, 선택 ID 전달, 재사용 표시, 선택 변경 stale 차단, catalog 실패 안내와 기존 질문 유지                                                                                 |
| Type/lint/build             | PASS                   | FE tsc, 변경 BE/FE eslint, Nest/Vite build                                                                                                                                                                |
| Existing environment UI/XHR | PASS                   | 분석5에서 device_os별 차트→Total Requests→질문→미리보기. metricReferences=[{widgetIndex:2,metricId:3,label:Total Requests}], canonical SUM("bid_request_cnt"), 28개 범주 합계634513000                    |
| Save/reload                 | PASS                   | 실제 변경 적용→reload; 두 KPI634513000/$5.57 및 두 시계열 유지. 저장 SQL snapshot 확인. 앞 두 위젯/title 동일 및 Metric3/4 definition byte동일                                                            |
| UI design                   | PASS_SELECTED_WIDTHS   | Aside1727·Playwright390/1440. 선택 입력 높이32px·폰트12px, 같은 x/width. 좁은 화면 긴 지표 이름, footer 질문 입력/버튼, 패널 수평 overflow 없음                                                           |
| Rill comparison             | PASS_SELECTED_ELEMENTS | 실제1727 화면 캡처: Rill635M/$5.57 숫자+추세와 Total Requests 기준 OS 순위. VM634513000/$5.57 및 OS별 합계 일치. Rill은 막대가 있는 순위표, VM은 세로 막대이며 픽셀 동등성/AI 수정 동등성은 주장하지 않음 |

최초 실제 catalog GET은 새 route의 권한 가드 분기 누락으로 거부됐다. 실패 캡처 후 가드에 source 권한 검사를 추가하고 같은 계정에서 목록·선택을 재검증했다. 최초1440 크기 검사는 Drawer 전환 애니메이션 중 offscreen 좌표를 읽어 실패했고, 전환 완료 조건을 기다려 재검증했다. 390에서는 처음부터 정렬·overflow 검사가 통과했다. 제품 CSS 변경으로 검사 결과를 우회하지 않았다.

모바일 검증은 별도 demoverify 계정의 분석7/source21을 사용하고 재사용할 저장 SUM(amount) 지표 테스트 fixture를 추가했다. 모바일에서는 선택/입력·레이아웃만 검증했고 LLM 저장 흐름은 데스크톱 분석5에서 확인했다. 기존 사용자 로그인·DB·업로드 경로를 유지했다.

### Follow-up limits and artifacts

제목 변경은 명시 선택 모드에서 거부하며 기존 자연어 모드로 수정한다. 저장 참조의 live propagation/원래 지표 자동 변경·30초과 paging·전체 E2E·VoiceOver·운영 배포는 NOT_RUN. 초기 자동 참조의 OS ID 누락 문제는 이번 명시 선택으로 해결했지만 자동 자연어 이름 매칭 완전 보장으로 확대하지 않는다.

- `/tmp/vm-explicit-metrics/`: be-complete.log, fe-tests.log, type.log, lint-be.log, build-final.log, fe-build.log, responses.json, persisted.json, definitions-before.json, mobile-layout.json, controls-390/1440.png, rill.png/txt. API 원본 로그는 비공개이며 packet에 넣지 않는다.
- 기존 Aside artifacts: explicit-catalog-failure.png, explicit-metric-responses.json, explicit-metric-preview.png, explicit-metric-reload.txt/png.
- 기능 PASS와 지정 폭 디자인 PASS를 분리했다. packet은 awaiting_review/acceptance not_recorded를 유지한다.
