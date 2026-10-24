# M2: AI 제공자 레지스트리·게이트웨이·스트리밍

[외부 베타 계획](external-beta-launch.md)의 M2다. 목표는 운영 구성에서 Studio AI가 실제로 동작하게 하고, 모든 모델 호출이 쿼터·원장·비용 차단기를 지나게 하는 것이다. 2026-10-24 코드 조사 기준이며 같은 날 architect 검토의 차단 항목 9개를 반영해 확정했다.

## 지금 상태 (조사 결과)

- **모든 모델 호출이 `AiService.callLlm(system, user, jsonMode, abortSignal)` 한 곳으로 모인다.** Codex는 `codexSdkModel`(`generateText` 경유), 그 외는 `fetch(.../chat/completions)` 직접 호출이다. 스트리밍 없음, 토큰 사용량을 읽지 않음, 사용자 식별 없음, 쿼터·원장 호출 없음.
- **Studio 생성·실행은 `AI_PROVIDER=codex`가 아니면 거절**한다(`studio-creation.service.ts:525`, `studio-run.service.ts:121`; 거버넌스·파일 스키마 진단·commerce도 같은 조건). 운영 가드는 codex를 거부하므로 운영에서는 Studio AI가 불가능하다(화면 검증 F1).
- 타임아웃이 제각각이다: API 호출 기본 30초, Codex 기본 120초, Studio·거버넌스·파일 스키마는 175초 하드코딩.
- 프런트엔드 대화는 항상 `POST /studio/executions`(지속 실행 기록)를 쓰고 `studioRunTransport`는 응답을 기다린 뒤 한 번에 흘려보내는 가짜 스트림이며, `StudioConversation`은 2초마다 실행 목록을 폴링한다. `POST /studio/runs`는 프런트엔드·MCP 어디서도 부르지 않는다.
- `ai` 7.0.137, `@ai-sdk/provider` 4.0.26이 설치돼 있고 `@ai-sdk/anthropic`·`openai`·`openai-compatible`은 없다. nginx는 이미 `/v1/`에 `proxy_buffering off`, `proxy_read_timeout 300s`다. Caddy는 `encode zstd gzip`을 쓴다.

## 결정

### 1. 제공자 레지스트리 `backend-api/src/ai/providers/provider-registry.ts`

- `AI_PROVIDER` = `anthropic` | `openai` | `openai-compatible` | `codex`(개발 전용, 운영 가드가 거부), `AI_MODEL`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_REASONING_EFFORT`. **설정이 틀리면 실패하고 다른 모델로 대체하지 않는다.**
- **`@ai-sdk/openai`의 `openai(model)`은 Responses API를 부른다.** 지금 동작(`/chat/completions`, `temperature 0`)을 유지하려고 `openai`는 `openai.chat(model)`을 쓴다. `AI_API_BASE_URL`이 OpenAI 기본이 아니면 `@ai-sdk/openai-compatible`을 쓴다.
- **버전**: 설치된 `ai` 7.0.137을 최신 7.0.152로 올리고(백엔드·프런트엔드 모두), `@ai-sdk/anthropic` 4.0.87·`@ai-sdk/openai` 4.0.101·`@ai-sdk/openai-compatible` 3.0.77을 추가해 `@ai-sdk/provider`·`provider-utils` 복사본이 하나가 되게 한다(`npm ls`로 확인). 정확한 버전은 설치 시점에 npm에서 확인한다. 테스트의 제공자 목은 V4(`MockLanguageModelV4`), Codex 어댑터는 V3다.
- **JSON 모드**: Anthropic에는 `json_object`가 없다. 게이트웨이가 `jsonMode`일 때 모든 제공자에서 출력을 정규화한다(공백 제거, 코드 펜스 하나 제거, 파싱 확인, 실패하면 `LLM_INVALID_JSON`). `responseFormat: {type:'json'}`은 openai·openai-compatible에만 보낸다. 지금 `JSON.parse(raw)`를 직접 하는 호출 지점은 정규화된 문자열을 그대로 받는다.
- **요청 설정**: 모든 호출에 `maxOutputTokens`(JSON 4096, 텍스트 2048). `AI_REASONING_EFFORT`는 openai의 `providerOptions.openai.reasoningEffort`, openai-compatible의 `reasoning_effort`(지금과 같음)로 보내고, anthropic에서는 부팅 가드가 거부한다(조용히 무시하지 않는다).
- **사용량이 비어 오는 경우**(Codex는 `undefined`, 일부 호환 서버는 `usage` 생략): 입력 글자 수 / 4 + 출력 글자 수 / 4로 추정하고 원장에 추정치임을 표시한다. 0 토큰이 월간 쿼터와 비용 차단기를 무력하게 만들지 않게 한다.

### 2. 게이트웨이 `backend-api/src/ai/llm-gateway.service.ts`

- **쿼터 단위는 모델 호출 한 번이다.** 사용자의 한 동작이 여러 번 부르는 경우가 있다(대시보드 초안의 교정 루프 최대 2회, 의미 제안의 분류+제안, BI 편집기의 일괄 수정은 6블록에 약 13회까지). 원장의 `record`가 예약 한 줄을 한 번 정산하는 M1 계약과 비용 면에서 맞는 단위다. 이에 따라 (a) 사용량 칩 문구는 "AI 호출"이다, (b) 호출 횟수를 아는 다회 호출 동작(BI 일괄 수정, 자동 편집, 의미 제안 질문)은 첫 호출 전에 `summary`로 남은 칸이 충분한지 확인해 중간에 끊기지 않게 한다, (c) 일일 기본 30회는 이를 감안해 제품이 확정한다.
- **원장 요청 id는 게이트웨이가 호출마다 만든다**(`ai_<uuid>`). `reserve`는 64자 이하만 받는데 Studio 요청 id는 128자까지 가고, 실패한 모델 단계를 같은 실행에서 재시도하면 `REQUEST_ID_REUSED` 409를 받는다. 호출 지점은 이미 자기 단위로 멱등이므로(`studio-run`의 재생 맵, 실행 기록의 행) 원장 단위 재생이 필요하지 않다. 재시도는 새 칸을 쓴다. 따라서 `caller`에 `requestId`는 없다.
- **`reserve`는 모델 호출 직전에, 그 사이에 던질 수 있는 `await` 없이** 하고 `record`는 `finally`에서 한다. `record`가 던지면 기록하고 성공한 결과를 바꾸지 않는다.
- **상태 매핑**(타이머는 호출자의 중단과 분리한다): 사용자 중단 → `cancelled`, `AI_TIMEOUT_MS`(기본 120초, 상한 180초) 초과 → `error`이고 `LLM_TIMEOUT`을 던진다, 제공자 오류 → `error`, 호출은 성공했는데 JSON 파싱·검증에 실패 → `ok`(토큰은 썼다). `maxRetries: 0`.
- **부팅 정리**: 인스턴스가 하나이므로 부팅 시점에 남은 `reserved` 행은 모두 고아다. `onModuleInit`에서 부팅 이전의 `reserved`를 `error`로 정산한다.
- **트랜잭션 안에서 부르지 않는다**: `reserve`가 자기 트랜잭션에서 `lockSourceActor`를 잡으므로 `callLlm`은 기존 `sourceWriteTransaction` 안에서 불리면 안 된다(SQLite는 연결이 하나라 교착). 현재 호출 지점은 모두 트랜잭션 밖이고, 이를 테스트로 고정한다.
- **전역 월간 비용 차단기**: 이번 달(UTC) 전체 토큰 합이 `AI_GLOBAL_MONTHLY_TOKENS`를 넘으면 503 `AI_BUDGET_EXHAUSTED`. **`reserve` 전에** 확인해 사용자 칸이나 `quota_denied` 행을 쓰지 않는다. 합계는 `createdAt` 인덱스로 읽고 30초 캐시한다. 진행 중인 호출은 끝난다(제공자 청구는 회수할 수 없다). 초과 폭은 대략 (30초치 처리량 + 진행 중 호출 수 × 가장 큰 호출)이며 단일 인스턴스에서는 받아들인다. 선택지로 예약 행에 추정치(입력 글자 / 4 + `maxOutputTokens`)를 먼저 넣고 `record`에서 실제 값으로 바꿔 사용자·전역 초과를 모두 줄일 수 있고, M2-1에서 구현한다. `AI_GLOBAL_MONTHLY_TOKENS`는 **AI가 설정된 운영에서만** 필수다(키 없이 화면만 보는 스택이 부팅하지 못하게 하지 않는다).
- 입력 상한: 생성 요청에 크기 제한이 없으므로 `inputTokens` 추정으로 호출당 입력 상한을 둔다(초과 시 400).
- 로그에 프롬프트·응답 내용을 남기지 않는다(원장에도 없다). 오류 본문은 500자로 자른다.

### 3. `callLlm`은 게이트웨이의 어댑터가 되고 호출자 정보를 필수로 받는다

`callLlm(system, user, jsonMode, abortSignal, caller)`, `caller = { userId, epoch, feature }`. 필수 매개변수로 해서 컴파일러가 빠진 곳을 모두 찾게 한다. 암묵 컨텍스트(AsyncLocalStorage)는 쓰지 않는다. **`epoch`도 필수다**: 현재 `authVersion`을 읽어 채우면 `lockSourceActor`의 epoch 검사가 무의미해지고 M1이 "JWT의 `authVersion`을 넘긴다"고 적은 계약과 모순된다. 컨트롤러는 이미 `req.user.accessKeyData.authVersion`을 가진다.

호출 지점(모두 호출 시점의 사용자를 안다): `AiService.textToSql`·`recommendChart`·`dashboardInsight`(컨트롤러가 사용자를 넘기도록 변경), `AiDashboardService.generate`·`assistant`·`classifyBlockIntent`·`proposeBlockLayout`(`BiService.editorAi`·`SemanticProposalService.question`에서 호출), `StudioCreationService.propose`, `StudioRunService.propose`(지금 `actor?`가 선택), `StudioExecutionService`의 `create`·`retry`·`creationMessage`·`clarifyCreation`(epoch를 실행 행에 저장해 `launch`/`execute`까지 운반, 스키마 변경 필요), `CommerceService.errorHelp`·`aiDraft`, `SemanticProposalService.propose`·`question`, `GovernanceService.assistant`, `FileSchemaDiagnosisService.diagnose`. cron·MCP(JWT HTTP API 경유)·파일 새로고침 백그라운드에서 `callLlm`을 부르는 곳은 없다. 스펙 21개가 `callLlm`을 목으로 대체한다.

**오류를 삼키지 않는다**: 대부분의 호출 지점이 모든 오류를 일반 메시지로 바꾼다(`studio-creation.service.ts:602`, 거버넌스, 파일 스키마, `ai.service.ts`, `ai-dashboard.service.ts`, `studio-execution.service.ts:1379`의 `MODEL_FAILED retryable: true`). 게이트웨이의 `HttpException`(429 `AI_QUOTA_EXCEEDED`, 503 `AI_BUDGET_EXHAUSTED`, `LLM_TIMEOUT`, 설정 없음)은 모든 지점에서 다시 던진다. 실행 기록은 `errorCode: 'AI_QUOTA_EXCEEDED' | 'AI_BUDGET_EXHAUSTED'`와 `retryable: false`로 기록한다. 지점별로 테스트 하나씩 둔다. "AI가 설정되지 않음"과 일시 오류를 구분한다(F1).

### 4. Codex 전용 조건을 없앤다, 남길 것은 남긴다

- Studio 생성·실행, 파일 스키마 진단, commerce의 `AI_PROVIDER !== 'codex'` 거절을 "AI가 설정돼 있는가"로 바꾼다. 175초 하드코딩 타이머는 없애거나 `LLM_TIMEOUT`으로 매핑한다.
- **`governance.service.ts:771`은 두 조건이다. `!scope.policy.allowAi`는 그대로 남기고 `AI_PROVIDER` 쪽만 바꾼다.** 조직 관리자는 다른 처리자를 전제로 AI를 허용했을 수 있으므로 **외부 베타에서 거버넌스 도우미는 꺼 둔다**(제공자를 명시해 `allowAi`를 다시 확인하기 전까지).
- **무엇이 서버 밖으로 나가는가**(M-1 법무의 입력, 기능별): 이름·타입·고정 사실·집계만 보내는 곳은 commerce `errorHelp`(서버 문구), 거버넌스(제목·열), 파일 스키마 진단(열·타입)이다. **값이 나가는 곳**: `bi.profile`의 열별 MIN/MAX(실제 문자열 값, Studio 생성·의미 제안으로 흘러감), `recommendChart`의 원본 5행, `dashboardInsight`의 위젯당 3행, `studio-run`의 위젯당 미리보기 30행, commerce `aiDraft`의 `reasons`(고객 자유 문구일 수 있음). 원본 행을 보내는 기능은 베타에서 상한·마스킹·비활성 중 하나를 정해야 하며 이는 M2-2b에서 사용자 결정으로 올린다.
- 화면의 "Codex · gpt-6-luna 요청" 문구는 서버가 알려 주는 실제 제공자·모델로 바꾼다: `GET /ai/status`(`JwtAuthGuard`, 제공자·모델 이름만, 비밀 값 없음). commerce의 `requestedModel: CODEX_MODEL` 상수도 실제 값으로 바꾼다. commerce `aiDraft`는 중단 신호와 타임아웃이 없으므로 게이트웨이로 옮기며 해결된다.

### 5. 스트리밍은 기존 지속 실행을 스트리밍한다

- 새 `/studio/runs/stream`을 만들지 않는다. 프런트엔드가 쓰는 `POST /studio/executions`(와 `runs/:id/retry`, `creation/message`, `creation/clarify`)를 **스트리밍으로도** 응답한다: 요청에 `Accept: application/x-ndjson`이 있으면 한 줄당 한 이벤트(`persist()`로 기록된 단계 전이마다 `step`, 마지막에 오늘의 `get()` 응답과 같은 `result`, 실패는 `error`). 없으면 지금처럼 JSON. 이미 영속된 단계를 그대로 내보내므로 새 실행 모델을 만들지 않는다. `GET /studio/runs/:id`가 재접속 경로이고 취소는 `POST /studio/runs/:id/cancel`이다(이미 중단하고 기다린다). `POST /studio/proposals`(메모리 상태, 지속 아님)도 같은 방식으로 스트리밍한다.
- **전송은 NDJSON**이다. Nest의 `@Sse`는 GET 전용이고 EventSource는 POST를 못 한다. 기존 NDJSON 클라이언트(`frontend-web/src/api/datasetService.ts`)가 있으나 자체 Authorization 헤더를 쓰고 axios의 토큰 갱신 인터셉터를 우회하므로 401 갱신을 명시적으로 처리한다. 헤더를 보낸 뒤의 오류(중간의 `reserve`가 던지는 429)는 상태 코드를 바꿀 수 없으므로 `error` 이벤트를 `{status, error, message, resetsAt?}`로 정의한다. 모델 대기 중 하트비트를 보낸다.
- 연결이 끊기면 지금처럼 실행을 중단한다(`withSignal`): 이 동작을 유지하고, 중단은 원장에 `cancelled`로 남는다. 스트림 중에는 2초 폴링을 끈다.
- **Caddy**: `encode zstd gzip`이 `text/*`에 걸리므로 `application/x-ndjson`을 제외하거나 Caddy를 거친 첫 바이트 시간을 측정한다(M2-5의 스택에는 Caddy가 없으므로 별도 확인).
- 토큰 단위 부분 블록은 이번 범위가 아니다(출력이 JSON 하나라 부분 파싱의 이득이 작다). 제공자가 스트리밍을 지원하지 않는 경우(Codex)는 단계 이벤트만 나가고 모델 호출은 한 번에 끝난다.

### 6. 프런트엔드

Studio 생성과 대화가 스트림을 읽어 단계를 표시한다(약 2초 안에 첫 진행 표시), 중지 버튼, 스트림 중 폴링 끄기, 사용량 칩(`GET /me/usage`, 문구는 "AI 호출")을 Studio 머리글에 낸다. 한도에 도달하면 안내하고, 429·503 오류 이벤트는 서버 메시지를 그대로 보인다.

### M2-2a 구현에서 계획과 달라진 점

- **`epoch`는 실행 행이 아니라 메모리로 운반한다.** `StudioExecutionService`는 요청에서 `launch`/`execute`까지 epoch를 인자로 넘긴다. 부팅 시 `onModuleInit`은 실행을 재시작하지 않고, 재시도는 재시도 요청의 epoch를 쓰므로 행 컬럼이 필요 없다.
- **JSON이 아닌 답은 `LLM_INVALID_JSON`이 아니라 원문으로 돌려준다.** 호출 지점마다 교정 재시도·400 매핑이 있어 게이트웨이가 던지면 건너뛴다. 단 출력 한도에서 잘린 JSON(`finishReason: length`)은 같은 한도로 다시 잘리므로 `LLM_OUTPUT_TRUNCATED`를 던진다.
- **`AiDashboardService.generate`와 배치 편집은 게이트웨이의 거절(429·503·입력 과대)을 그대로 던진다**(`isAiRefusal`). 나머지 삼키는 호출 지점은 M2-2b에서 같은 방식으로 바꾼다.
- **일괄·자동 편집은 호출 전에 남은 칸을 확인한다**: 일괄 = 내용 블록 2회 + 배치 블록 1회, 자동 = 3회(분류 + 최대 2회).
- **게이트웨이의 자체 실패(`AI_NOT_CONFIGURED`·`LLM_TIMEOUT`·`LLM_OUTPUT_TRUNCATED`·`LLM_API_ERROR_*`)는 `ApiExceptionFilter`(유일한 전역 필터)가 500이 아닌 503·504·502로 바꾼다**(`llmFailure`). 원래 오류는 서버 로그에 남기고 `cause`로 붙인다. 답이 없는 호출 지점이 모두 같은 처리를 받는다. 호출자 `userId`·`epoch`가 정수가 아니면 게이트웨이가 `AI_CALLER_INVALID`로 거절한다(프로젝트가 `strict`가 아니라 컴파일러가 못 잡는다).
- **M2-4로 넘기는 것**: Studio 실행은 거절을 HTTP 200의 실패 단계(`errorCode`)로만 돌려주므로 `resetsAt`·`needed` 같은 본문이 화면에 닿지 않고, 한도 실패는 재설정 후에도 재시도되지 않아(새 실행 필요) "실패한 단계부터 다시" 문구가 맞지 않는다. 화면 문구를 `errorCode`별로 나누고 `GET /me/usage`를 보인다.
- 프런트엔드 `creationError`(`studioCreation.ts`)는 AI 전용 문구를 503에만 쓴다. 게이트웨이 실패가 502·504로 오므로 M2-4에서 502–504와 `data.error` 코드(`LLM_TIMEOUT`·`LLM_UNAVAILABLE`·`AI_NOT_CONFIGURED`)를 읽도록 넓힌다.
- 추론 모델은 출력 토큰으로 먼저 생각하므로 `AI_REASONING_EFFORT`가 있으면 출력 상한에 12,288을 더한다.

### M2-2b 구현: 무엇이 서버 밖으로 나가는가와 사용자가 정할 것

M2-2b는 Codex 전용 거절 6곳을 "AI가 설정돼 있는가"(`isAiConfigured`)로 바꾸고, 호출 지점의 175초 타이머를 없애 게이트웨이의 `AI_TIMEOUT_MS`로 일원화했으며, 삼키던 지점이 게이트웨이의 거절(429·503·입력 과대)을 그대로 던지게 했고(`isAiRefusal`), Studio 실행 기록에 `AI_QUOTA_EXCEEDED`·`AI_BUDGET_EXHAUSTED`·`AI_NOT_CONFIGURED` 코드를 `retryable: false`로 남기며, `GET /ai/status`를 추가했다. 거버넌스 도우미는 `GOVERNANCE_AI_ENABLED=true`일 때만 켜진다(기본 꺼짐, 카탈로그의 `capabilities.ai`도 함께 꺼진다).

| 기능 | 제공자로 나가는 것 | 값(행) 포함 |
| --- | --- | --- |
| commerce `errorHelp` | 서버가 만든 고정 사실 문구 | 아니오 |
| 거버넌스 도우미 | 질문, 허용된 블록 제목·열 이름·타입, 현재 필터 | 아니오(필터 값은 사용자가 입력한 것) |
| 파일 스키마 진단 | 질문, 열 이름·타입, 변경 관찰 요약 | 아니오 |
| `bi.profile` → Studio 생성·의미 제안 | 열 이름·타입·열별 MIN/MAX | **예**(실제 문자열 값) |
| `recommendChart` | 원본 5행 | **예** |
| `dashboardInsight` | 위젯당 3행 | **예** |
| Studio 실행(`studio-run`) | 위젯당 미리보기 30행 | **예** |
| commerce `aiDraft` | 집계와 `reasons`(고객 자유 문구일 수 있음) | **예** |

원본 행이 나가는 기능은 베타에서 (a) 상한을 낮춰 유지, (b) 값 마스킹, (c) 비활성 중 하나를 정해야 한다. 이는 코드가 아니라 사용자(제품·법무) 결정이며, M-1 약관·개인정보 문구의 입력이다. 결정 전까지 코드는 현재 동작(위 표)을 유지한다. 화면의 "Codex · gpt-6-luna" 문구 6곳은 `GET /ai/status`로 바꾸며 이는 M2-4(프런트엔드)에서 한다.

### M2-3 구현: 스트림 프로토콜 (M2-4 프런트엔드가 의존하는 사실)

요청에 `Accept: application/x-ndjson`을 보내면 `POST /studio/executions`, `runs/:id/retry`, `runs/:id/creation/message`, `runs/:id/creation/clarify`, `POST /studio/proposals`가 줄 단위 JSON으로 답한다. 헤더가 없으면 지금까지와 같은 JSON이다.

- **이벤트 순서**: `start` → (`step`·`heartbeat`)* → 정확히 하나의 `result` 또는 `error`. 약 2초 안의 첫 진행 표시는 `start`가 맡는다(하트비트가 아니다).
- **`step`**: `{type, runId, status, steps:[{stepId, status, retryable, errorCode?}]}`. 영속된 단계 전이마다 나오며 내용(프롬프트·행·SQL)은 없다. **`executions` 생성과 `runs/:id/retry`만 낸다.** `creation/message`·`creation/clarify`와 `proposals`는 영속 단계 전이가 없어 `start`·`heartbeat`·`result`만 낸다.
- **`heartbeat`**: 5초마다. 클라이언트가 읽지 않고 쌓인 줄이 16 KiB를 넘으면 건너뛴다.
- **`result`**: `{type, data}`. `data`는 JSON 경로가 돌려주는 본문과 같다.
- **`error`**: 평평한 모양 `{type, status, error, message, reason?, limit?, used?, needed?, resetsAt?, correlationId?}`. JSON 경로의 `{success:false, code, data:{error,message}}`와 모양이 다르므로 클라이언트가 둘을 정규화해야 한다. 예상 못 한 오류는 `status:500, error:'INTERNAL_ERROR'`와 고정 문구만 나간다.
- **HTTP 상태**: 스트림이 시작되면 항상 201이다. 실행 안에서 난 400·409·429는 **HTTP 201 위의 `error` 이벤트**로 온다. 스트림이 시작되기 전의 거절(JWT 401, 사용자 요청 제한 429, 본문 검증)은 평범한 JSON이다. 따라서 클라이언트는 줄을 읽기 전에 상태와 `Content-Type`을 확인해야 하며, 401 토큰 갱신도 여기에 건다.
- **재개 없음**: 연결이 끊기면 실행이 취소된다(원장 `cancelled`). `GET /studio/runs/:id`는 `cancelled`·`retryable:false`를 보이며 이어가려면 새 요청이다.
- **같은 `requestId` 재전송**: 이미 진행 중이면 곧바로 `result`가 오지만 `data.status`가 최종이 아닐 수 있다. 클라이언트는 `data.status`를 확인하고 아니면 `GET /studio/runs/:id`로 이어간다.
- **중지 버튼**: 요청을 `AbortController`로 끊으면 서버가 모델 호출을 취소한다. `POST /studio/runs/:id/cancel`은 재접속한 사용자를 위한 경로다.
- **알려진 한계**: 지표(`ResponseTimeInterceptor`·`MetricsInterceptor`)는 스트림을 "201, 몇 ms"로 센다. 실제 종료 상태와 시간은 `msg:"stream"` 로그 줄(`status`·`outcome`·`durationMs`·`disconnected`)에만 있다. 정상 종료는 info, 실패·중단(`outcome` ≠ `result`)은 **warn**이라 운영 기본 로그 레벨(warn)에서도 남는다(M2-5 실행에서 info로 두었다가 운영 설정에서 줄이 안 보이는 것을 발견해 바꿨다). 사용자당 동시에 열 수 있는 스트림 수에는 상한이 없다(요청 제한은 분당 20개의 시작만 센다): 단일 인스턴스 베타에서는 받아들이고 M2-5에서 관찰한다.

### M2-4 구현: 프런트엔드에서 하지 않은 것과 이유

- **스트림으로 읽는 것은 `POST /studio/executions` 하나다**(`frontend-web/src/api/ndjsonClient.ts`의 `postNdjson`). 영속 단계 전이(`step` 이벤트)가 있는 경로가 이것뿐이다. `creation/message`·`creation/clarify`·`proposals`는 프로토콜상 `start`·`heartbeat`·`result`만 내므로 스트림으로 읽어도 화면에 더해지는 정보가 없어 기존 axios 호출을 유지한다. `runs/:id/retry`는 `step`을 내지만 지금 화면은 재시도 중 단계를 따로 그리지 않아 axios를 유지한다(다음에 재시도 진행 표시가 필요해지면 `postNdjson`으로 바꾼다).
- **`start` 줄은 화면에 쓰지 않는다.** 보내는 즉시 "요청 처리 중" 표시가 이미 뜨고, 첫 영속 단계가 오면 단계 목록이 나온다. "첫 진행 표시 약 2초"는 서버 쪽 `start` 줄이 7 ms에 도착함(`docs/testing/external-beta-m2-llm.md`)으로 확인했고, 화면에서의 체감은 M2-5의 브라우저 실행에서 잰다.
- **프런트엔드 `ai` 패키지는 `^7.0.137` 그대로다.** 캐럿 범위가 7.0.152를 허용하고, 프런트엔드는 `ai`의 타입(`ChatTransport`)만 쓰므로 호출 동작이 달라지지 않는다. 락파일을 바꾸는 설치는 이번 단계에 넣지 않았다.
- **401 갱신**은 axios 인터셉터와 같은 잠금·에포크 검사를 쓴다(`renewAccessToken`을 공유). 서버는 만료를 `data:'accessTokenExpired'`라는 **문자열 본문**으로 보내므로 클라이언트도 인터셉터의 `responseMessage`로 읽는다(처음 구현은 `data.message`만 봐서 갱신이 동작하지 않았고, 테스트 고정값이 실제 본문 모양이 아니어서 가려졌다).

### M2-5에서 발견했고 이번 범위 밖으로 남긴 것

- **`JwtAuthGuard`는 토큰과 무관한 실패(DB 장애, 모듈에 제공자 누락)도 `401 accessTokenExpired`로 답한다**(`auth/guards/jwt-auth.guard.ts`의 두 `catch`). 클라이언트는 이 문구를 만료로 읽고 세션을 갱신하려 하므로, 인프라 장애 동안 모든 클라이언트가 갱신을 반복한다. 이번에는 접근 토큰 경로에서 예상 밖의 실패를 `warn`으로 남기게만 했고, 공유 URL 경로의 맨 `catch {}`는 그대로다. 근본 수정(예상 목록 밖의 오류는 503으로 다시 던지기)은 이 가드를 쓰는 스펙이 20개이고 엔터프라이즈 인증 경로가 걸려 있어 별도 단위로 한다.
- **쿼터는 `error`·`cancelled` 호출도 일일 한도에 센다**(M1 설계: 한 호출 = 한 단위). 제공자 장애 중에도 사용자의 한도가 줄어든다. 정책 결정이 필요하다.
- **접근 토큰 수명은 환경 변수로 바꿀 수 없다**(`auth.service.ts`에 `21600s` 하드코딩). 만료 동작 시험은 임시 비밀로 서명한 토큰으로 했다.
- 제안 저장 요청의 `sourceRevision`과 저장된 대시보드의 `sourceRevision`이 같은 소스에서 다르게 나온다(S2 관찰). 의도된 것인지 확인이 필요하다.

## 단위와 순서

| 단위 | 내용 |
| --- | --- |
| M2-1 | 레지스트리, 게이트웨이(쿼터·원장·타임아웃 분리·비용 차단기·예약 추정치·부팅 정리·JSON 정규화·사용량 추정), `callLlm` 어댑터, 의존성 추가·`ai` 업그레이드, 부팅 가드, 단위 테스트(V4 목) |
| M2-2a | `caller`·`epoch` 필수화와 모든 호출 지점·컨트롤러·스펙 수정, 실행 행에 epoch 저장 |
| M2-2b | Codex 전용 거절 제거(`allowAi` 유지, 거버넌스 도우미는 베타에서 끔), 오류 재던지기와 실행 `errorCode`, `GET /ai/status`, commerce 상수, 서버 밖으로 나가는 값 표와 결정 올리기 |
| M2-3 | 지속 실행·제안의 NDJSON 스트리밍, 취소 시 `cancelled`, 하트비트, Caddy 제외 |
| M2-4 | 프런트엔드 스트리밍·중지·사용량 칩·401 갱신 |
| M2-5 | 운영 구성 스택에서 **모의 OpenAI 호환 서버**로 생성→수정→저장→게시 전체 실행과 화면 확인(390/768/1440) |

각 단위는 독립 커밋이고 `audit`로 테스트를, `architect`로 검토를 받는다.

## 검증과 한계

- 단위 테스트는 `MockLanguageModelV4`와 SQLite·MySQL 원장으로 한다: 쿼터 경계, 거절 시 모델이 호출되지 않음, 오류·취소·타임아웃의 원장 상태, 비용 차단기가 쿼터 행을 쓰지 않음, 부팅 정리, 설정 오류, 호출 지점별 429·503 재던지기, `callLlm`이 트랜잭션 밖에서 불림.
- M2-5의 전체 실행은 **로컬 모의 서버**(응답에 `usage`를 포함)로 한다. 운영 구성의 `egress-guard.sh`는 사설 대역을 막으므로 모의 서버는 `egress` 네트워크에 둔다. 배선(쿼터 차감, 원장, 스트리밍, 취소, 화면)은 증명하지만 **실제 모델의 생성 품질은 증명하지 않는다.**
- **출시 게이트의 실제 LLM 1개 제공자 전체 실행은 사용자 입력이 필요하다**: 제공자·모델 선택, API 키(키는 채팅에 쓰지 않고 운영 VM의 `.env.prod`와 개발 머신의 추적되지 않는 설정에만 둔다), 월간 예산 숫자, 거버넌스 도우미와 원본 행 전송 기능의 베타 결정. 키가 준비되면 같은 흐름을 실제 제공자로 한 번 더 실행해 증빙한다. 그때까지 M2는 "배선 검증 완료, 실제 모델 미검증"으로 보고한다.
- 법무(M-1)는 이 단계의 범위 밖이며 사용자 입력이 필요하다: 제공자의 무보존·학습 미사용 조건 확인과 약관·개인정보 문구.
