# 오류 설명 취소·재요청 — 2026-10-13

샘플 실패와 커머스 CSV 날짜/필수 컬럼 오류 도움에 `오류 설명 취소` 버튼을 추가했다. 설명 요청의 AbortController만 중단하고 진단·기존 보고서·파일 재선택·샘플 재시도는 유지한다. 취소하면 명시 안내와 설명 버튼으로 초점을 돌려준다.

같은 requestId로 즉시 다시 요청할 수 있으므로 이전 요청 finally는 requestId 대신 controller 객체 동일성을 확인한다. 취소된 응답은 표시하지 않고, 이전 finally가 새 요청의 busy/중복 방지를 풀지 않는다.

## 선택 검증

기준 HEAD21d87990 + 현재 diff. 기존 격리 API4883/FE3683 재사용. 증빙 `/tmp/vm-import-help-evidence/`.

| 조건                                                    | 판정                   | 증빙                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 샘플·CSV 취소→초점 복귀→즉시 재요청→늦은 이전 응답 무시 | PASS                   | 관련 FE29개 통과. 두 화면에 동일 ID 재요청 경합 회귀 추가.                                                                                                                                                                                                      |
| 실제 날짜 오류 도움 취소·안내·초점·재요청 성공          | PASS_SELECTED_VARIANTS | Aside 실제 Codex 요청 중 취소 후 설명 버튼 focused, 파일 선택 유지. help-cancelled.png/txt, help-retried.png/txt. 기존 수치20994.61/4457.60/16537.01 유지 및 unverified. 최초 시도는 설명이 먼저 완료해 취소 ref가 stale됐고, 새 오류 요청에서 취소를 재현했다. |
| 제공자 실행 중 취소                                     | PASS_SELECTED_VARIANTS | 기존 callCodingAgent 경로를 gpt-6-luna로 직접 실행하고1.5초 후 abort. provider-cancel.json: LLM_REQUEST_ABORTED/1509ms. 모델 답변 생성 완료를 뜻하지 않으며 HTTP→서버→프로세스 종료 전체 관측과 구분한다.                                                       |
| 코드 검증                                               | PASS                   | FE 타입·변경 lint·production build·diff check. 기존 non-null assertion 경고1 및 Vite/CSS 경고 유지. 한정 코드 리뷰 잔여 actionable finding0.                                                                                                                    |

샘플 취소 실제 UI,390px/VoiceOver/OS 파일창, 실제 provider timeout/미지원 모델은 NOT_RUN. 이전 통과 BE/E2E는 변경 없이 재사용, 전체130개 집계 유지.

## HTTP 취소 전파 후속

같은 HEAD와 제품 diff에서 격리 API4883을 재기동하고, 저장소 밖 Node preload로 Codex spawn/close만 관측했다. 프롬프트·토큰은 기록하지 않았다. Aside FE3683의 프로젝트5에서 날짜 오류 CSV를 다시 가져와400 안전 진단을 확인했다. 실제 파일 선택에는 Aside 세션 내부의 기존 픽스처를 사용했다.

| 조건                                       | 판정                   | 증빙                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 실제 브라우저 취소 후 서버 Codex 자식 종료 | PASS_SELECTED_VARIANTS | 2026-10-13T13:48:20.480Z spawn →13:48:22.025Z close, PID8921/model gpt-6-luna/code null/signal SIGKILL/1545ms. `http-provider-trace.jsonl`, `provider-trace.cjs`, `api-traced.log`. 취소 UI 동작과 서버 close가 함께 관측됐으며 HTTP 연결 종료 이벤트 자체의 별도 패킷 기록은 없다. |
| 취소 안내·초점 복귀·동일 진단 재요청       | PASS_SELECTED_VARIANTS | `http-cancelled.png/txt`에서 설명 버튼 focused와 취소 안내. 재요청 PID9803은4914ms/code0으로 완료, `http-retried.png/txt`에서 설명과 unverified 표시. 기존 결제20994.61/환불4457.60/차감16537.01 및 파일 선택 유지.                                                                 |

증빙은 `/tmp/vm-import-help-evidence/`에 보존했다. 초기 설명은4435ms에 정상 완료해 취소 관측으로 집계하지 않았다. 요청 로그의 status201은 interceptor가 응답 확정 전에 읽은 값이므로 취소된 HTTP 응답 수신 성공으로 해석하지 않는다. 실제 프로세스 종료는 spawn/close 기록으로 판정한다. 제품 변경0, 관련 기존 단위·타입·빌드 통과는 재사용했다. 샘플·필수 컬럼 오류의 실제 HTTP 취소 변형과 전체 자손 PID 조사는 이번 범위에서 NOT_RUN이다.

## 실제 provider timeout 후속

격리 API4883/FE3683과 같은 제품 코드를 재사용했다. 저장소 밖 `timeout-trace.cjs`는 실제 callCodingAgent를 그대로 호출하면서 첫 호출의 AI_TIMEOUT_MS만1000, 이후120000으로 지정하고 오류 코드·spawn/close를 기록한다. 모델/응답을 fixture로 대체하지 않았다. 운영 기본120초 전체 대기 검증과 구분한다.

| 조건                                             | 판정                   | 증빙                                                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 실제 Codex timeout 종료·로딩 해제·수동 복구 제공 | PASS_SELECTED_VARIANTS | PID17073/gpt-6-luna/1008ms/SIGKILL, LLM_CODEX_TIMEOUT. `timeout-trace.jsonl`, `timeout-ui.png/txt`에서 실패 안내·설명 재요청·파일 다시 선택 유지.                                                                                                        |
| 동일 진단 재요청 성공                            | PASS_SELECTED_VARIANTS | PID18012/gpt-6-luna/8297ms/code0. `timeout-retry.png/txt`에 원인 설명·unverified 표시.                                                                                                                                                                   |
| 정상 CSV 수동 복구                               | PASS_SELECTED_VARIANTS | normal-orders.csv로 재선택 후 가져오기 완료. `timeout-recovered-full.txt`에 오류 도움 제거·정상 보고서, 결제20994.61/환불4457.60/차감16537.01 유지. 고객 CSV는 선택하지 않아 채널은 Unassigned로 변경됐다. 이전 채널 분포 유지 조건으로 집계하지 않는다. |

제품 변경0, 관련 기존 검사는 재사용했다. `git diff --check` 통과. 샘플·필수 컬럼 timeout UI 변형, Axios120초 timeout과 provider deadline 경합, 모바일/VoiceOver 및 미지원 모델은 NOT_RUN이다. 기존130개 집계는 유지한다.
