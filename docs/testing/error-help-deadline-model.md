# 오류 도움 제한시간 경합·미지원 모델 — 2026-10-13

기준: HEAD21d87990과 현재 diff, 격리 API4883/FE3683. 증빙 `/tmp/vm-import-help-evidence/race-model-results.json`, `race-model-trace.jsonl`, `race-model-check.cjs`, `race-model.cjs`.

## 방법과 판정

샘플 UI의 Axios 제한은60000ms, CSV UI는120000ms이며 Codex 기본 deadline은120000ms다. 설치된 Axios의 실제 Node HTTP adapter로 해당 제한을 실행했다. 저장소 밖 preload는 실제 Codex 프로세스 그룹을 spawn50ms 후 SIGSTOP해 응답 지연을 재현했다. 이후 제품의 timeout/HTTP disconnect가 SIGKILL하는지를 관측했다. 브라우저 XHR adapter의 실제 화면 관측과 구분한다.

| 조건                               | 판정                   | 실행 결과                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 샘플 클라이언트60초 → 서버120초    | PASS_SELECTED_VARIANTS | Axios ECONNABORTED/60005ms, 자식59994ms/SIGKILL/LLM_REQUEST_ABORTED. 같은 진단500ms 후 재요청201/4073ms/unverified.                                                                                                                                                                                |
| CSV 클라이언트·서버120초 경합      | PASS_SELECTED_VARIANTS | Axios ECONNABORTED/120004ms, 자식120012ms/SIGKILL/LLM_REQUEST_ABORTED. 같은 진단500ms 후 재요청201/3663ms/unverified. 이 실행의 승자는 HTTP abort이며 모든 스케줄링 순서를 증명하지 않는다.                                                                                                        |
| 실제 CLI 미지원 모델 거부          | PASS_SELECTED_VARIANTS | 검증 preload에서 spawn 인자만 vanillameta-verification-unsupported-model로 교체. 제품 요청 모델은 gpt-6-luna 유지. CLI2215ms/code1, stderr 모델 거부 패턴 확인, adapter LLM_CODEX_EXIT_ERROR, API503 고정 안전 안내. 자동 모델 대체 호출 없음. 프롬프트·stderr 원문·토큰은 증빙에 기록하지 않았다. |
| 모델 거부 후 명시 재요청·수동 복구 | PASS_SELECTED_VARIANTS | spawn 인자 복원 후 같은 requestId 재요청201/3559ms, 실제 gpt-6-luna/code0. 샘플 실패 주입 해제 후 샘플 재시도·report200, 결제20994.61/환불4457.60/차감16537.01.                                                                                                                                    |
| 화면 회귀                          | PASS_UNIT_ONLY         | 샘플·CSV 테스트에 ECONNABORTED/503 입력, 고정 안내·민감 상세 미노출·복구 버튼 유지·재요청/샘플 재시도 검증. FE24개 통과. 실제 Aside 화면 검증은 BLOCKED.                                                                                                                                           |
| deadline/abort 양쪽 순서           | PASS_UNIT_ONLY         | coding-agent.spec.ts에 abort 우선/timeout 우선2조건 추가. 종료 전 다른 신호가 와도 kill1회, close 후 재요청 성공. 변경 후BE22개 통과. 사전 관련 BE40개 통과.                                                                                                                                       |

FE 타입·변경 lint(기존 non-null assertion 경고1), BE 변경 lint, diff check 통과. 테스트만 변경했으므로 제품 build는 기존 증빙을 재사용한다.

## 실제 화면과 잔여

기존 Aside REPL은 session not found. 새 REPL/host list는 daemon auth challenge fetch failed를 반환했다. 설치된 Aside.app을 open으로 재실행한 뒤에도 같은 연결 오류가 지속됐다. 실행 여부를 단정하지 않으며 이번 실제 화면·XHR timeout 검증은 BLOCKED다. DOM 단위/Node Axios API 결과를 실제 Aside UI PASS로 확대하지 않는다.

검증 후 preload 없이 API를 재기동해 기본 제한시간·gpt-6-luna를 복원했다. 샘플 읽기 실패 플래그 제거, 전역 모델/로그인 설정 변경 없음. 미지원 모델의 CSV UI 변형·로그인 오류·모바일/VoiceOver·HTTP abort 후 전체 자손 PID 관측은 미실행이다. 기존130개 집계 유지.

## 2026-10-14 Aside 실제 화면/XHR 후속

기준 HEAD `21d87990` + 현재 미커밋 diff, 격리 FE `http://127.0.0.1:3683` / API `4883`. `vanillameta-verify`와 `aside-browser` 기준으로 기존 REPL 연결을 복구·재사용했다. 샌드박스 CLI의 daemon auth challenge 실패는 Aside 미실행 증거가 아니며, 권한 있는 로컬 연결에서는 도구 목록과 실제 화면 조작이 정상 동작했다.

증빙: `/tmp/vm-import-help-evidence/xhr-ui/`의 PNG·화면 snapshot·`xhr-results.json`, 같은 상위 폴더의 `xhr-race-trace.jsonl`과 `xhr-race.cjs`. XHR 관찰은 제품 Axios 제한을 변경하지 않은 브라우저에서 수행했고, Codex 지연/모델 거부는 기존 검증 preload로만 주입했다.

| 실제 화면 조건               | 판정                   | 결과                                                                                                                                                                                                                        |
| ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 샘플 XHR 60초 / 서버 120초   | PASS_SELECTED_VARIANTS | timeout 60002ms/status0, 자식59980ms/SIGKILL/LLM_REQUEST_ABORTED. 안전 안내·재요청·샘플 재시도·파일 연결 버튼 유지.                                                                                                         |
| 샘플 모델 거부 / 명시 재요청 | PASS_SELECTED_VARIANTS | XHR503/4211ms, CLI code1/모델 거부 확인. 같은 진단 재요청201/4189ms, 실제 gpt-6-luna/code0, 설명 unverified 표시. 자동 대체 호출 없음.                                                                                      |
| CSV XHR·서버 120초 경합      | PASS_SELECTED_VARIANTS | XHR timeout120002ms(완료 기록120003ms)/status0, 자식120001ms/SIGKILL/LLM_REQUEST_ABORTED. 안전 안내·초점·파일 선택 유지. 같은 진단 재요청201/4318ms/code0. 이번 승자는 HTTP abort이며 모든 스케줄링 순서를 입증하지 않는다. |
| CSV 모델 거부 / 명시 재요청  | PASS_SELECTED_VARIANTS | 새 날짜 오류 진단에서 XHR503/4165ms, CLI code1/모델 거부 확인. 같은 진단 재요청201/5024ms, 실제 gpt-6-luna/code0·unverified 설명.                                                                                           |
| CSV 수동 복구 / 저장 재조회  | PASS_SELECTED_VARIANTS | 정상 주문 CSV로 재선택·고객 CSV 추가 후37/40/8행 검증 통과. 보고서 결제20994.61/환불4457.60/차감16537.01, 새로고침 후 동일 수치 유지.                                                                                       |

제품 코드 변경0. 관련 단위·타입·lint/build는 이전 결과를 재사용하고 문서 diff check만 새로 수행했다. 기존130개 집계는 유지한다. 주입 해제 후 실제 Aside 샘플 열기도 정상 보고서와 동일37주문·금액으로 복구됐다(`xhr-ui/sample-restored.png`, `.txt`). 검증 preload·sample 읽기 실패 플래그를 해제하고 기본120초/gpt-6-luna API를 재기동했다. 복원 중 누락된 격리 CORS/JWT 설정 때문에 조회·로그인이 잠시 실패했고, 테스트 설정 복원 후 재로그인을 확인했다. 전역 모델/로그인 설정과 사용자 Aside 세션 데이터는 변경하지 않았다.

필수 컬럼 누락의120초/모델 거부 변형·로그인 provider 오류·모바일/VoiceOver·전체 자손 PID 관측은 NOT_RUN이다. 이전 BLOCKED 기록은 당시 이력으로 보존하며 이번 샘플/날짜 CSV 실제 화면/XHR 조건은 해소됐다.

## 2026-10-14 필수 컬럼 누락 실제 화면/XHR 후속

HEAD `21d87990` + 동일 제품 diff, 격리 FE3683/API4883. 기존 정상 프로젝트8에 주문 CSV 필수 헤더가 전부 없는 테스트 파일과 정상 결제·환불 CSV를 교체 가져오기 했다. `IMPORT_MISSING_COLUMNS` 안내·기존 보고서 유지 상태에서 실제 Aside XHR를 관찰했다. 증빙 `/tmp/vm-import-help-evidence/missing-xhr-ui/`: `missing-xhr.json`, `provider-trace.json`, PNG/snapshot, `baseline.json`/`after.json`. 요청 관찰에는 requestId·status·시간만 저장하며 인증·CSV 행·provider stderr 원문은 저장하지 않았다.

| 조건                                 | 판정                   | 결과                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 클라이언트/서버120초 경합            | PASS_SELECTED_VARIANTS | 실제 XHR timeout120003ms/status0. Codex 자식119987ms/SIGKILL, adapter LLM_REQUEST_ABORTED. 안전 실패 안내·설명 버튼 초점·파일 선택·이전 보고서 유지. 이번 승자는 HTTP abort이며 모든 순서를 증명하지 않는다.                            |
| 제한 종료 후 같은 진단 재요청        | PASS_SELECTED_VARIANTS | 같은 requestId로XHR201/5662ms, 실제 gpt-6-luna/code0. 필수 컬럼 설명·unverified 표시.                                                                                                                                                   |
| 새 누락 진단의 실제 미지원 모델 거부 | PASS_SELECTED_VARIANTS | 검증 preload의 spawn 모델만 미지원 값으로 교체. 제품 요청 모델gpt-6-luna 유지. XHR503/2151ms, CLI2132ms/code1/모델 거부 패턴 확인, adapter LLM_CODEX_EXIT_ERROR. 안전 안내·복구 버튼 유지, 모델 상세 미노출·자동 대체 호출 없음.        |
| 거부 후 같은 진단 명시 재요청        | PASS_SELECTED_VARIANTS | spawn 모델 주입 해제 후 같은 requestId XHR201/3562ms, 실제 gpt-6-luna/code0·unverified 설명.                                                                                                                                            |
| 보고서 보존·정상 파일 수동 복구      | PASS_SELECTED_VARIANTS | 두 누락 import 거부 후 프로젝트8의currentVersion1·publishedDigest·summaryJson이baseline과 동일. 정상 주문·고객CSV 재선택 후 최신run28/noop: 동일 데이터라 중복 게시 없음. 새로고침 뒤37주문·결제20994.61/환불4457.60/차감16537.01 유지. |

이번 제품 코드 변경0. 기존 관련 단위/타입/lint/build 결과 재사용, 문서 diff check 수행. 검증용API를 preload 없이 기존CORS/JWT/DB 설정 그대로 재기동해 기본120초·gpt-6-luna를 복원했다. 사용자 Aside 세션은 보존했다. 기존130개 집계 유지. 필수 컬럼 누락의 위120초/미지원 모델 조건은 해소됐으며 모바일/VoiceOver·provider 로그인 오류·전체 자손PID·추가 경합 스케줄은 NOT_RUN이다.
