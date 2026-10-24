# 외부 베타 M2 — LLM 게이트웨이·스트리밍 검증 증빙

계획: `docs/plans/external-beta-m2-llm.md`. 이 문서는 **무엇을 실행했고 무엇을 실행하지 않았는지**를 단위별로 남긴다. 실행하지 않은 항목은 통과로 쓰지 않는다. 모든 테스트는 `audit` 서브에이전트가 격리된 worktree에서 실행했다.

## 실행 환경(재현에 필요한 사실)

- 권위 있는 실행기는 **Node 26.12.1**(Homebrew)이다. 프로젝트 `engines`는 Node 24를 요구하지만 이 머신에는 없고, 기본 `node`(22.23.1)에서는 DuckDB를 쓰는 모든 스펙이 기준 커밋에서도 실패한다. 백엔드: `node node_modules/jest/bin/jest.js --config package.json`.
- 의존성은 `npm ci --legacy-peer-deps`(스크립트 포함)로 설치한다. `npm ci`는 추적 중인 `backend-api/yarn.lock`을 다시 쓰므로 커밋 전에 되돌린다.
- 빌드는 Node 26에서 `--require ./scripts/typescript-api-compat.cjs ./node_modules/@nestjs/cli/bin/nest.js build`로 성공한다.

## M2-1 ~ M2-2b (제공자 레지스트리, 게이트웨이, 모든 호출 지점의 이전, Codex 전용 거절 제거)

| 항목 | 결과 |
| --- | --- |
| 기준 커밋 | `8d1c8e6f`(M2-2a/2b의 `audit`가 마지막으로 통과한 커밋) |
| tsc · nest build · eslint | 통과(eslint 경고만) |
| 전체 jest(Node 26) | 335 스위트 통과·13 건너뜀, 5,804 테스트 통과·188 건너뜀, 실패 0 |
| MySQL 8.4 스펙(`ai-quota.mysql.spec.ts`, `access.mysql.spec.ts`) | 6/6 통과(마이그레이션 두 개 적용 후 모양 일치 포함) |
| 변형(mutation) 검사 | 7개 모두 이름 있는 스펙이 잡음(`bi.service` 일괄 사전 확인 `targets.length` 되돌림, `main.ts` 필터 등록, 소유권 가드 `status`, 거버넌스 `aiBlockingCode`, `llmFailure` 타임아웃, 게이트웨이 호출자 검사, Studio 실행 `blocked`) |
| 실제 HTTP로 504 본문 확인 | 소켓 수준 스펙(`ndjson-stream.http.spec.ts`, 아래)으로 대체 |

## M2-3 (NDJSON 스트리밍)

| 항목 | 결과 |
| --- | --- |
| 기준 커밋 | `83afe8d6` |
| tsc · nest build · eslint | 통과(경고 12, 모두 `no-non-null-assertion`) |
| 전체 jest(Node 26) | 338 스위트 통과·13 건너뜀, **5,852 테스트 통과**·188 건너뜀, 실패 0 |
| 반복 실행(10회×5개 스펙, 50회) | 전부 통과(`ndjson-stream.spec` 30/30, `ndjson-stream.http.spec` 6/6, `studio-execution.service.spec` 82/82, `studio-execution.controller.spec` 11/11, `studio-creation.controller.spec` 3/3). 깜빡임 없음 |
| 변형 검사(a)–(j) 10개 | **전부 이름 있는 테스트가 잡음**: 연결 종료 시 중단 배선 제거, `start`를 결과 뒤로 이동, 구독자 예외 격리 제거, `create`의 구독 키 변경, 오류 본문 허용 목록 제거, JSON 경로 모양 변경, 게시 키에서 사용자 제거(다른 사용자 이벤트 격리), 하트비트 역압 제거, 연결 종료 후 예외의 취소 처리 제거, 구독 해제 예외 시 스트림이 열려 있음 |
| 실제 프로세스 시간 측정(컴파일된 `serveRun`, `curl -N`) | 요청 후 **7 ms**에 `start`, 하트비트(이 측정은 `heartbeatMs`를 1초로 지정했다. **서버 기본값은 5초**이며 M2-5에서 실제 값을 잰다), 실행이 풀린 시점(2.0 s)에 `result` |
| Caddy 통과 측정(2.8.4, 2.11.7, 저장소의 `encode zstd gzip` + `flush_interval -1`) | NDJSON은 **압축되지 않고 버퍼링되지 않음**: `start` +10~45 ms, 하트비트 1초 간격(±0.06 s), `result` 4.0 s. 같은 설정에서 12 KB JSON은 zstd로 압축(507 B)되어 `encode` 블록이 활성임을 확인. `Cache-Control: no-transform` 유무와 무관. 측정하지 않은 것: `no-transform`이 있는 압축 가능 유형의 스트림 |

알려진 한계(`docs/plans/external-beta-m2-llm.md`의 M2-3 절): 지표 인터셉터는 스트림을 "201, 몇 ms"로 센다(실제 종료는 `msg:"stream"` 로그 줄에만 있음). 사용자당 동시에 열 수 있는 스트림 수에는 상한이 없다.

## M2-4 (프런트엔드: 스트림 소비, 모델 이름, 사용량 칩, 거절 문구)

| 항목 | 결과 |
| --- | --- |
| 기준 커밋 | `882de76c`(전체 실행), `db954a11`(마지막 테스트 보강). 비교 기준은 프런트엔드가 바뀌기 전의 `04dd516b` |
| tsc · eslint · `vite build` | 통과(eslint 경고 19, 모두 `no-non-null-assertion`). 빌드 경고는 이번 변경과 무관한 동적 import 하나 |
| 전체 vitest(Node 26) | **3회 모두 통과, 3,414 테스트**. 기준 `04dd516b`은 3,338 테스트 |
| 반복 실행(10회×11개 파일, 110회) | 전부 통과: `StudioConversationCreation`, `studioAiErrors`, `ndjsonClient`, `AiUsageChip`, `StudioConversation.activity`, `StudioEditor`, `FileSchemaDiagnosis`, `DashboardLifecycle`, `StudioCreate`, `GovernedDashboard`, `usageService` |
| 변형 검사 | 21개 중 20개를 이름 있는 테스트가 잡았고, 살아남은 1개(스트림 유휴 감시 타이머를 읽을 때마다 다시 거는 줄 삭제)는 3.6초 동안 하트비트가 계속 오는 테스트를 추가해(`db954a11`) 잡혔음을 확인(메시지: `The server stopped sending`) |
| 감사가 찾은 실제 회귀 | 구현 중 두 번: 새 `/ai/status`·`/me/usage` 읽기가 이미 정해진 응답 순서와 호출 횟수를 쓰던 기존 스펙 7개를 깨뜨림(`92f52e09`와 이후 커밋에서 해당 스펙이 두 읽기를 스텁), 그리고 검토에서 발견: 서버가 만료 토큰을 문자열 본문으로 보내는데 클라이언트가 `data.message`만 봐서 조용한 토큰 갱신이 실제 서버에서는 동작하지 않았음(테스트 고정값이 실제 본문 모양이 아니어서 가려짐) — 수정 후 실제 본문 모양으로 테스트 |
| 기준선에서도 나타나는 깜빡임 | `DashboardLifecycle.test.tsx › rejects future pending storage without replay`가 기준 `04dd516b`의 전체 실행 3회 중 1회, 변경 후 전체 실행 중 1회 실패(단독 10/10 통과). 이번 변경과 무관한 기존 깜빡임 |

실행하지 않은 것: 브라우저 실행(M2-5에서 실행, 아래). 단위·컴포넌트 테스트는 `fetch`·`useChat`을 가짜로 대체하므로 실제 네트워크에서의 첫 진행 표시 시간, 중지 시 서버 원장 `cancelled`, 모바일 백그라운드, 레이아웃(390/768/1440)은 증명하지 않는다.

## M2-5 (운영 구성 스택 + 모의 OpenAI 호환 제공자 전체 실행)

모의 제공자(`backend-api/scripts/mock-openai-provider.mjs`)는 **고정된 시험 도구**다(`/__control`·`/__calls`는 인증이 없고 어떤 이미지에도 들어 있지 않다). 이 실행은 쿼터 차감, 원장, 스트리밍, 취소, 화면의 **배선**을 증명한다. **실제 모델의 생성 품질은 증명하지 않는다.**

### 무엇을 실행했나

| 항목 | 내용 |
| --- | --- |
| 환경 | Colima 프로필 `vm-m0-build`(aarch64, 4 CPU, 8 GiB, 디스크 20 GiB), 컴포즈 프로젝트 `vm-m25`. 서비스: mysql 8.4, migrate(일회성), api, web(nginx, `proxy_buffering off`), mock. **Caddy는 없다.** |
| 프록시 | `TRUST_PROXY_HOPS=2`(운영 설정)이지만 이 스택의 프록시는 하나(nginx)뿐이라 클라이언트가 보낸 `X-Forwarded-For`를 신뢰한다. 운영과 다른 점이다. `web`은 `internal` 네트워크만으로는 Docker가 포트를 게시하지 않아 비내부 네트워크 `edge`에도 붙였다 |
| 송신 차단 | `deploy/egress-guard.sh apply` 적용 후 api에서 확인: 모의 서버 200, 공개 https 200, `10.255.255.1`·`169.254.169.254` 시간 초과, mysql 도달. 확인 후 해제(`status`: not applied). 모의 서버는 사설 대역이라 `egress` 네트워크의 172.29.40.50:4310에 둔다 |
| 이미지 | **`Dockerfile.prod`로 만든 것은 api 기반 이미지 `verify`(커밋 `65d9d5f0`) 하나뿐이다.** api `verify2`는 그 위에 호스트에서 빌드한 `dist`(Node 26, `nest build`)를 얹은 층이라 이전 `dist`의 삭제된 파일이 남을 수 있다. web은 VM 안 빌드가 디스크 부족(ENOSPC)으로 실패해, 호스트에서 `vite build`(`REACT_APP_API_URL=/v1`) 후 `Dockerfile.prod` 마지막 단계와 같은 nginx 이미지에 담았다(`COPY build`만 다름) |
| 실행한 커밋 | api: `65d9d5f0`(1단계) → `52bb0d78`(1b·2단계, 버그 수정 `f0dfb520` 포함) → 이후 변경 없음. web: `verify`=`65d9d5f0` 프런트엔드, `verify2`=`99c4971c`, `verify3`=`f214b678`. **이 스택의 api는 `305696f1`·`cd51c740`(Codex 검사 대소문자, 실패 코드 로그)과 이후 Studio 생성·실행의 실패 코드 로그 변경 이전 코드다.** 이후 변경은 단위 테스트로만 확인했다 |
| 환경 변수(이름만) | `AI_PROVIDER=openai`(모의 서버 `AI_API_BASE_URL`), `AI_MODEL=mock-model`, `AI_GLOBAL_MONTHLY_TOKENS=5000000`, `AI_TIMEOUT_MS=8000`, `QUOTA_DAILY_CALLS=30`(**시나리오마다 사용자별 일일·월간 한도를 `access-cli quota set`으로 바꿨다**: 18, 52, 60, 200, 300 등. 아래 수치의 한도는 그 시점 값이다), `USER_THROTTLE_AI_PER_MIN=20`(제한 시험에서는 3), `SIGNUP_MODE=invite`. `LOG_LEVEL`은 기본(warn) |
| 사용자 | 초대 코드로 가입한 일회용 사용자 A·B, 각자 CSV(6행) 업로드. 브라우저는 A만 사용 |

모의 서버 모드: **실행함** — normal, delay(3·4·5·6·8 s), stall-silent, http-error, bad-json, truncated, no-usage. **실행하지 않음** — `slow-then-ok`.

### HTTP·NDJSON 시나리오 S1–S15 (api `65d9d5f0`, 버그 수정 뒤 `52bb0d78`에서 재확인)

| # | 확인한 것 | 결과 |
| --- | --- | --- |
| S1 | 제안: 일반 JSON vs `Accept: application/x-ndjson` | 통과(모양만 비교). 일반 201 123 ms, 스트림 `start` 4 ms·`result` 72 ms |
| S2 | 제안 저장 후 대시보드 읽기 | 통과. 제안의 `sourceRevision`과 대시보드 읽기의 값이 다르다(의도 확인 필요, 아래 범위 밖 목록) |
| S3 | 실행 요청(지연 3 s) | 통과. 첫 줄 3~5 ms, `result` 3.3 s, 원장 `ok` 1,318 입력·20 출력(실사용량). nginx가 버퍼링하지 않음 |
| S3b | 하트비트(지연 11 s, 시간 제한 8 s) | 통과. **하트비트 5,008 ms에 한 번**(서버 기본 5초), 8.2 s에 시간 제한으로 실패 |
| S4 | 수정 요청 | 통과(324~353 ms), `updateBlock` 제목 패치 |
| S5 | 중지(지연 6 s, 1.5 s에 클라이언트 중단) | 통과. 원장 `cancelled`가 1.76 s에 기록(한 번의 조회 값 1,764 ms), 모의 서버 `aborted:true`, 실행 `RUN_CANCELLED`·재시도 불가 |
| S6 | 시간 제한(stall-silent, 8 s) | 실행: 통과(MODEL_FAILED, 재시도 가능). 제안: **처음에는 503(계획은 504)** → 버그 2, 수정 뒤 504 `LLM_TIMEOUT` |
| S7 | http-error / bad-json / truncated | 원장: http-error `error`, bad-json·truncated `ok`(설계: SDK가 거절한 JSON도 호출 자체는 성공으로 기록). 제안 응답: **처음에는 모두 일반 503** → 수정 뒤 http-error 502 `LLM_UNAVAILABLE`, truncated 502 `LLM_OUTPUT_TRUNCATED`, bad-json은 일반 503 |
| S8 | `usage` 없는 응답 | 통과. 원장 `ok` 1,318/20, `usageEstimated` 표시 |
| S9 | 일일 한도 | 통과. 429 `AI_QUOTA_EXCEEDED`(`daily_calls`, 18/18, 초기화 시각), 원장 `quota_denied` 3행(토큰 0), 모의 서버 호출 0. 실행 쪽은 HTTP 201 + 단계 오류 `retryable:false` |
| S10 | 월간 한도(`--monthly 0`) | 통과. `monthly_tokens`, 문구에 "내일" 약속 없음, 모의 서버 호출 0 |
| S11 | 전역 예산(`AI_GLOBAL_MONTHLY_TOKENS=1`) | 통과. 503 `AI_BUDGET_EXHAUSTED`, 원장 행·쿼터 변화 없음 |
| S12 | 사용자 제한(분당 3) | 통과. 1~3번 201, 4번째 429 `RATE_LIMITED`(4 ms, `retryAfterSeconds` 60) |
| S13 | AI 미설정(빈 키) | 통과. api 정상 기동, `/ai/status` `configured:false`, 제안 503 `AI_NOT_CONFIGURED`, 실행 `retryable:false` |
| S14 | 인증 | 통과(`/me/usage` 제외, 버그 1). 토큰 없음·위조 만료 토큰 401(본문 `data:"accessTokenExpired"`), 갱신 쿠키로 `POST /user/get-access-token` 201, 갱신 토큰 동작(첫 시도는 401 `"Unathorization"`이었다 — 제품에 이미 있는 철자 오류. 오래된 쿠키 때문으로 **추정**하며 확인하지 않았다. 다시 로그인해 쿠키를 받은 재실행이 201이다). 접근 토큰 수명이 코드에 고정(21,600 s)이라 5초 토큰은 같은 비밀 키로 위조해 시험했다 |
| S15 | 동시 스트림 10개(지연 4 s) | 통과(표본 1회). 모두 201 성공 4.6~5.4 s, 모의 서버 호출 10. `docker stats` +2 s: CPU 0.02 %, 147 MiB / 4 GiB, 프로세스 13. **최대치는 재지 않았다** |

### 발견해서 고친 버그 3개(`f0dfb520`, 재확인 `52bb0d78`)

1. **관찰**: `GET /me/usage`가 모든 토큰에서 401 `accessTokenExpired`(`/ai/status`는 같은 토큰으로 200). **원인**: `UsageModule`이 `JwtService`를 제공하지 않아 가드가 `TypeError`를 던졌고, 가드가 모든 검증 실패를 "만료"로 뭉갰다(클라이언트는 유효한 세션을 끝없이 갱신하려 든다). **수정**: 모듈이 `JwtModule`을 가져오고, 토큰이 아닌 실패는 가드가 warn으로 남기며, `module-wiring.spec.ts`에 가드의 의존성 배선 검사를 추가. **재확인**: A·B 모두 200, 사용량이 `quota show`와 같음(19, 14), 토큰 없음·만료 401, "access token check failed unexpectedly" 0건. 가드 자체(모든 실패→401)는 근본 수정이 아니라 범위 밖 목록에 있다.
2. **관찰**: 제안 경로가 모든 모델 오류를 일반 503으로 바꿨다(시간 제한 503, 잘림·제공자 오류의 코드 소실). **수정**: `llmFailure`로 매핑. **재확인**: 504/502/502, bad-json은 일반 503.
3. **관찰**: 스트림 종료 기록(`msg:"stream"`)이 운영 기본 로그 수준(warn)에서는 보이지 않았다. **수정**: 실패·취소는 WARN, 정상은 INFO. **재확인**: 기본 수준에서 S5 취소가 499 `cancelled`로 보이고 정상 스트림은 줄을 남기지 않음.

### 브라우저 B1–B13 (사용자 A, ego-browser, web `verify`, api `52bb0d78`)

| # | 결과 |
| --- | --- |
| B1 | 통과. 생성 화면 모델 표시 "OpenAI 호환 · mock-model 요청", 칩 "AI 호출 51/200"([캡처](images/external-beta-m2-llm/m25-create-1440.png)와 맞춘 값. 처음 보고서의 31은 캡처와 맞지 않아 쓰지 않는다). 390·768·1440에서 가로 넘침 없음 |
| B2 | 통과(진행 표시 시각은 **재지 못함**). 생성(지연 5 s) → 미리보기 → 저장(대시보드 5). 생성 중 `/studio/runs` 요청 0 |
| B3 | 통과(첫 단계 시각 **재지 못함**: 표본 추출 실패). 편집·질문 실행 6.4 s, 스트림 중 폴링 0, 칩 33→36. 블록을 고르지 않은 질문은 안내 문구를 주지만 실행 카드는 "완료"로 남는다(UX 관찰) |
| B4 | 통과. 1.5 s 중지 → "중지됨", 붉은 경고·재시도 버튼 없음, 원장 `cancelled`, 모의 서버 `aborted:true` |
| B5 | 통과. 만료 토큰: 401 한 번 → 갱신 201 → 재시도 200, 원장 행 정확히 한 개 추가 |
| B6 | (a)(b) 통과: 실행 카드 "실패"·재설정 시각 약속 없음·재시도 버튼 없음, 칩 "AI 호출 52/52 · 오늘 한도 도달"([캡처](images/external-beta-m2-llm/m25-daily-limit-chip-1440.png)와 맞춘 값. 시험 중 사용자별 한도를 CLI로 현재 사용량에 맞춰 바꿨다), 생성 화면 문구. **(c) 대화 창의 생성 메시지 경로는 차단됨(경로를 찾지 못함)** |
| B7 | 통과. 칩 "… · 이달 한도 도달", 생성 화면 월간 문구, `quota_denied` 기록 |
| B8 | 통과. 전역 예산 문구, 원장 행 없음, 입력창 잠기지 않음 |
| B9 | 통과. "AI가 아직 연결되지 않았습니다", 칩 없음, 생성 화면에 미설정 문구 |
| B10 | 통과(편집 화면만). 4번째에 "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." — 생성 화면은 아래 G5 |
| B11 | 통과(문장은 계획서와 다름). 편집 stall: 카드 "실패"+"AI 제안 다시 시도"; 생성 stall "AI 응답이 늦어 중단했습니다…"(504), http-error "AI 서비스에 연결하지 못했습니다…"(502) |
| B12 | 부분. 390에서 넘침 없음. **전송·중지 버튼이 36 px**로 설계 메모의 44 px 미만이었다 → `99c4971c`에서 AI 패널 버튼 44 px로 수정, 아래 G4에서 재측정 |
| B13 | 통과. 로그아웃 후 공개 링크는 `GET /studio/publications/<token>` 200 하나만 호출(`/ai/status`·`/me/usage` 0), "게시된 대시보드 · 읽기 전용" |

### 추가 측정 G1–G5 (web `verify2`→`verify3`)

| # | 결과 |
| --- | --- |
| G1 | 중지 통과: 보내고 중지 버튼이 뜨기까지 777/800/1,022 ms(요청 시작과 같은 시각이라 자동화 도구 지연으로 읽는다). **단계 라벨 타임라인은 재지 못함**(표본 배열이 3회 모두 비었다) |
| G2 | 통과. 중지 뒤 칩 59→60, 재시도 버튼 없음, 중립 문구 |
| G3 | 부분. 유휴 90 s에 폴링 1회(60 s 주기와 일치). 추가 호출은 도구가 일으킨 `visibilitychange`·blur/focus 직후였고 앱 결함으로 보지 않는다. **원인을 완전히 가르지는 못했다** |
| G4 | 390에서 `전송` 58×44, `실행 중지` 86×44, `중지` 58×44, 넘침 없음. **"AI 열기"는 처음 36 px → `55f2cfd3`의 CSS로 수정, `verify3`에서 95×44 확인.** "다시 시도" 버튼의 높이는 **재지 못함**(실패 카드가 있는 390 화면이 필요) |
| G5 | **처음 실패·원인 미확정**: 생성 화면 4번째 클릭이 "처리하지 못했습니다. 연결 상태와 파일 형식을 확인…"(파일 형식 안내)을 보였다. 그 실행의 제한 설정이 실제로는 분당 20이었고(`env.throttle`이 기본 설정과 같았다) api 로그에 429가 한 건도 없어서, **서버가 429를 보낸 상황을 브라우저에서 본 것이 아니다.** 4번째 클릭이 api에 닿지 않았는데 일반 문구가 나온 이유는 **밝히지 못했다.** 코드를 읽어 얻은 사실만 있다: `creationError`에 429 분기가 없고 `aiRefusalMessage`가 `RATE_LIMITED`를 몰랐다. 이를 고친 것이 `55f2cfd3`(테스트 보강 `f214b678`). **재확인**(web `verify3`=`f214b678`, api 분당 3, 서비스 워커 캐시를 지운 뒤 번들 `index-BYbgzRd_.js` 확인): 1~3번 "계산 결과가 준비됐습니다…", **4번 "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."**, "파일 형식" 없음, "429" 문구 없음. 즉 진짜 429 아래서 수정 후 문구는 확인했고, **수정 전에 진짜 429가 일반 문구로 보였다는 것은 브라우저에서 관찰하지 않았다.** 이 재확인의 화면 캡처는 경고가 보이는 영역 밖이라 저장소에 넣지 않았다 |
| G7 | **768 스트리밍·중지**(web `verify3`=`f214b678`, 지연 6 s): 가로 넘침 없음(768/768), 보내고 **159 ms**에 중지 버튼, 160 ms에 단계 목록("데이터 확인 실행 중 · AI 제안 대기 · 계산 검증 대기 · 초안 준비 대기"), 262 ms에 "데이터 확인 완료·AI 제안 실행 중". 중지 뒤 카드 "요청 20 · 중지됨"·단계 "중지됨", 재시도 버튼 없음(실행 중 캡처의 카드 라벨은 "요청 10"이고 중지 뒤는 "요청 20"인데, 같은 실행에서 라벨이 바뀐 이유는 조사하지 않았다). 이것이 브라우저에서 잰 **첫 진행 표시(0.2~0.3 s)**다. 모의 서버는 로컬이라 실제 모델의 첫 토큰 지연은 반영하지 않는다. 캡처: [스트리밍](images/external-beta-m2-llm/m25-streaming-768.png)·[중지됨](images/external-beta-m2-llm/m25-stopped-768.png) |

화면 캡처(`docs/testing/images/external-beta-m2-llm/`):
[스트리밍 1440](images/external-beta-m2-llm/m25-streaming-1440.png)(G1) · [스트리밍 390](images/external-beta-m2-llm/m25-streaming-390.png)(G4) · [스트리밍 768](images/external-beta-m2-llm/m25-streaming-768.png)(G7) · [중지됨 1440](images/external-beta-m2-llm/m25-stopped-1440.png)(G2) · [중지됨 768](images/external-beta-m2-llm/m25-stopped-768.png)(G7) · [실패 카드](images/external-beta-m2-llm/m25-failed-1440.png)(B11) · [일일 한도 거절 390](images/external-beta-m2-llm/m25-quota-refusal-390.png)(B6) · [월간 한도 칩](images/external-beta-m2-llm/m25-monthly-limit-chip-1440.png)(B7) · [완료 390](images/external-beta-m2-llm/m25-completed-390.png)(B12) · [게시된 대시보드](images/external-beta-m2-llm/m25-published-1440.png)(B13).

**증빙의 종류**: S1–S15는 스크립트가 쓴 JSON·로그가 남아 있다. **G5·G7의 출력은 저장하지 않았고**(스크립트는 `console.log`만 한다) 세션 기록에만 있다. G7은 위 두 캡처가 있고 G5는 캡처도 없다. B4·B5·B8–B11·B13과 G2·G3도 **대화형 세션에서 관찰한 값이며 보존된 산출물이 없다**(위 캡처 외). B5의 401→201→200 순서는 api 로그에 남아 있지 않다. 이 표의 숫자는 그 한계 안에서 읽어야 한다.

### 원장 요약(시나리오별)

정상 호출은 `ok`(실사용량 또는 `usageEstimated`), 시간 제한·http-error는 `error`, 중지는 `cancelled`(입력 토큰만), 쿼터 거절은 `quota_denied`(토큰 0), **전역 예산 거절과 미설정은 행을 쓰지 않는다.** bad-json·truncated는 `ok`로 남는다(호출은 성공, 출력이 쓸 수 없음). S10·S12·S13의 행 수는 결과 파일에 기록하지 않았다.

### 측정에서 나온 사실

- **서비스 워커**: 새 빌드가 배포돼도 열린 탭은 이전 번들을 계속 쓴다. 두 번 다시 불러와도 새 워커는 `waiting`이었고, 탭을 닫고 새로 열거나 원본의 서비스 워커·캐시 저장소를 지운 뒤에야 새 번들이 떴다(모델 표시가 "Codex · gpt-6-luna"로 남아 있던 것이 이 때문). "새 버전이 있습니다" 안내는 범위 밖.
- **api 재생성**: 변형(예산·키 없음·제한) 시험마다 api를 다시 만들어 메모리의 제안이 사라지고 컨테이너 로그도 사라졌다. S1~S10 컨테이너 로그는 남아 있지 않고, 위 결과는 시나리오 스크립트가 기록한 JSON에서 가져왔다.
- **초안 세션 잠금**: 갱신 경로 밖에서 토큰을 바꾸면 편집기가 "Draft session token changed"로 잠겼다. 시험 도구가 만든 상황으로 보이며 실제 발생 경로는 확인하지 못했다.

### 이 문서의 테스트 수(`audit` 에이전트가 격리 worktree에서 실행, Node 26.12.1)

| 항목 | 결과 |
| --- | --- |
| 백엔드 jest(커밋 `3d995bea`) | 339 스위트 통과·13 건너뜀, **5,889 테스트 통과**·188 건너뜀(총 6,077), 실패 0(`studio-remix` 깜빡임 미발생). `tsc` 통과, `eslint --quiet` 오류 0. 모델 실패 로그와 관련한 세 스펙(`studio-run`·`studio-creation`·`studio-execution`)은 5회 모두 219/219 |
| 프런트엔드 vitest(커밋 `f214b678`, 이후 프런트엔드 변경 없음) | 215 파일, **3,418 테스트 통과**, 실패 0. `tsc`·eslint 오류 0 |
| 프런트엔드 반복 | `studioAiErrors` 10회 20/20, `StudioCreate`+`StudioConversation.activity`+`studioConversation` 10회 80/80 |
| 프런트엔드 변형 검사 | 429 분기 제거 → 3개 실패, `SERVER_WORDED`에서 `RATE_LIMITED` 제거 → 2개 실패(둘 다 이름 있는 테스트) |
| 백엔드 변형 검사(`3d995bea`) | M1 생성 서비스의 로그 삭제 → 5개 실패, M2 `studio-run`의 `propose` 로그 삭제 → 3개 실패, M3 `createProposal` 단계에 로그를 다시 넣어 이중 기록 → 1개 실패("leaves the creation step to the creation service…"), M4 일반 503에 `cause` 추가 → 1개 실패. 변형 없이는 모두 통과 |
| 이 문서의 숫자 출처 | 위 개수는 `audit`가 보고한 값이며 실행 로그는 저장소 밖(`/private/tmp/claude-501/`)에 있다 |

모델 실패 로그 변경의 경위: 처음 `151fcd46`은 실행 서비스에서 로그를 남겨, `createProposal` 단계에서는 이중 기록이고 `proposeSemantics` 단계에서는 `studio-run`이 이미 모든 오류를 일반 503으로 감싼 뒤라 코드가 아닌 래퍼 클래스 이름이 남았다(감사에서 테스트 1개 실패, 검토에서 이중 기록 지적). `23530447`에서 로그를 코드가 아직 남아 있는 곳(생성 서비스, `studio-run`의 `propose`)으로 옮기고 알 수 없는 오류에는 `cause`를 붙이지 않게 했다(오류 보고 도구가 `cause`를 따라간다). `3d995bea`는 `execute`의 로그를 지웠다. 모델 실패는 그 줄에 닿지 않았지만(`propose`가 이미 기록하고 HTTP 예외로 바꿔 던진다) 두 번째 미리보기의 비모델 실패는 닿았으므로, 그 경우가 로그 없이 사용자에게 "AI 연결 또는 응답을 확인하지 못했습니다"로만 나가게 됐다. `87174f62`가 이를 고쳐 로그에 "Studio run failed after the model answered: <코드>"로 남긴다.

### 실행하지 않은 것(통과로 쓰지 않는다)

- **실제 모델**, **Anthropic·OpenAI 공식 어댑터**(실제 요청 0건), 추론(reasoning) 강도 옵션. 이 실행의 SDK 경로는 openai-compatible 하나다.
- **Caddy를 지나는 경로**(NDJSON은 위 M2-3 표의 Caddy 측정, 이 스택에는 없음), amd64(전부 aarch64), 모바일 백그라운드(뷰포트 에뮬레이션으로 시험 불가), Node 24에서의 단위 테스트(Node 26만).
- 모의 모드 `slow-then-ok`, 스트림 동시 수의 **최대치**(S15는 단일 표본).
- **B6(c)**: 대화 창의 생성 메시지 경로에서의 거절 문구, 390에서의 **단계 라벨 타임라인**(768에서는 G7로 잼), "다시 시도" 버튼의 390 높이, 붉은 경고 색의 눈으로 확인.
- **768에서의 생성·거절·실패 화면**: 768은 B1(생성 화면 배치, 이전 빌드)과 G7(편집기 스트리밍·중지)만 실행했다.
- 이 스택의 api는 `305696f1`·`cd51c740`과, 그 뒤 "모델 실패의 코드를 로그에 남긴다"(`studio-creation`·`studio-run`) 변경 이전 코드다(위 표). 그 변경은 단위 테스트로만 확인했다.
- 새 버전 안내, 사용자당 동시 스트림·제안 상한, 쿼터가 `error`·`cancelled`를 세는 정책, `JwtAuthGuard`의 인프라 실패→401 근본 수정, 접근 토큰 수명 설정화는 계획서의 "M2-5에서 발견했고 이번 범위 밖으로 남긴 것"에 있다.

## 아직 실행하지 않은 것 (M2 전체)

- **실제 LLM 제공자 1개로 끝까지 실행**: 제공자·모델·API 키·월간 예산이 필요하다(사용자 입력). 그때까지 M2는 "배선 검증 완료, 실제 모델 미검증"이다.
