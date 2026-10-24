# M2: AI 제공자 레지스트리·게이트웨이·스트리밍

[외부 베타 계획](external-beta-launch.md)의 M2다. 목표는 운영 구성에서 Studio AI가 실제로 동작하게 하고, 모든 모델 호출이 쿼터·원장·비용 차단기를 지나게 하는 것이다. 2026-10-24 코드 조사 기준이다.

## 지금 상태 (조사 결과)

- **모든 모델 호출이 `AiService.callLlm(system, user, jsonMode, abortSignal)` 한 곳으로 모인다.** Codex는 `codexSdkModel`(`generateText` 경유), 그 외는 `fetch(.../chat/completions)` 직접 호출이다. 스트리밍 없음, 토큰 사용량을 읽지 않음, 사용자 식별 없음, 쿼터·원장 호출 없음(`AiQuotaService`는 아무도 부르지 않는다).
- **Studio 생성·실행은 `AI_PROVIDER=codex`가 아니면 거절**한다(`studio-creation.service.ts:525`, `studio-run.service.ts:121`; 거버넌스·파일 스키마 진단·commerce도 같은 조건). 운영 가드는 `AI_PROVIDER=codex`를 거부하므로 운영에서는 Studio AI가 불가능하다. 화면 검증에서 확인한 출시 차단 항목이다.
- 타임아웃이 제각각이다: API 호출 기본 30초, Codex 기본 120초, Studio·거버넌스·파일 스키마는 175초 하드코딩(`AI_TIMEOUT_MS`와 무관).
- 프런트엔드 `studioRunTransport`는 `POST`가 끝나길 기다린 뒤 전체 답을 한 번에 흘려보내는 가짜 스트림이고, `StudioConversation`은 2초마다 실행 목록을 폴링한다.
- `ai` 7.0.137은 설치돼 있고(백엔드·프런트엔드), `@ai-sdk/anthropic`·`@ai-sdk/openai`·`@ai-sdk/openai-compatible`은 없다. nginx 운영 설정은 이미 `/v1/`에 `proxy_buffering off`, `proxy_read_timeout 300s`다.

## 결정

1. **제공자 레지스트리** `backend-api/src/ai/providers/provider-registry.ts`. `AI_PROVIDER` = `anthropic` | `openai` | `openai-compatible` | `codex`(개발 전용, 운영 가드가 거부), `AI_MODEL`, `AI_API_KEY`, `AI_API_BASE_URL`. 패키지 `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/openai-compatible`을 백엔드에 추가한다. **설정이 틀리면 실패하고 다른 모델로 대체하지 않는다**(기존 규칙). 기존 운영 기본(`AI_PROVIDER=openai` + `AI_API_BASE_URL`)은 계속 동작한다(`openai`는 기본 URL, 다른 URL이면 `openai-compatible`로 안내하는 부팅 오류가 아니라 그대로 그 URL을 쓴다).
2. **게이트웨이** `backend-api/src/ai/llm-gateway.service.ts`. 모든 호출이 한 곳에서 다음을 한다.
   - `AiQuotaService.reserve(userId, epoch, feature, requestId)`를 모델 호출 **전에** 부른다(429 `AI_QUOTA_EXCEEDED`). 호출 뒤 `record`로 실제 토큰·지연·제공자·모델을 적는다. 오류는 `error`, 취소는 `cancelled`로 남긴다(원장에 항상 한 줄).
   - `AI_TIMEOUT_MS`(기본 120초, 상한 180초)와 호출자가 넘긴 `abortSignal`을 합친다. `maxRetries: 0`.
   - **전역 월간 비용 차단기**: 이번 달 전체 토큰 합이 `AI_GLOBAL_MONTHLY_TOKENS`를 넘으면 모든 호출을 503 `AI_BUDGET_EXHAUSTED`로 막는다(사용자별 쿼터만으로는 전체 비용이 묶이지 않는다). 값이 없으면 부팅 가드가 운영에서 거부한다. 합계는 `ai_usage_ledger`의 `createdAt` 인덱스로 읽고 30초간 캐시한다.
   - `generate()`(전체 응답)와 `stream()`(`streamText`). 제공자가 스트리밍을 지원하지 않으면(Codex) `stream()`은 `generate()`로 한 번에 낸다.
3. **`callLlm`은 게이트웨이의 어댑터가 되고 호출자 정보를 필수로 받는다**: `callLlm(system, user, jsonMode, abortSignal, caller)`, `caller = { userId, epoch?, feature, requestId? }`. 필수로 해서 컴파일러가 빠진 호출 지점을 모두 찾게 한다. 암묵 컨텍스트(AsyncLocalStorage)는 쓰지 않는다: 컨텍스트가 끊기면 운영에서 기능이 사라지고, 호출 지점은 이미 사용자를 알고 있다(`textToSql`·`recommendChart`만 컨트롤러가 사용자를 넘기도록 바꾼다). `epoch`가 없으면 게이트웨이가 현재 `authVersion`을 읽어 쓴다. 요청은 이미 `JwtAuthGuard`가 검증했으므로 같은 검사를 다시 하는 것이 아니라 잠금에 필요한 값을 채우는 것이다.
4. **Codex 전용 조건을 모두 없앤다**: Studio 생성·실행, 거버넌스, 파일 스키마 진단, commerce의 `AI_PROVIDER !== 'codex'` 거절을 "AI가 설정돼 있는가"(`isConfigured`)로 바꾼다. 화면의 "Codex · gpt-6-luna 요청" 문구는 서버가 알려 주는 실제 제공자·모델로 바꾼다(`GET /ai/status` 같은 읽기 전용, 비밀 값 없음).
5. **스트리밍(SSE)**: `POST /studio/proposals/stream`, `POST /studio/runs/stream`. 이벤트는 `step`(스키마 읽기, 초안, SQL 검증, 미리보기), 최종 `result`(현재 JSON 응답과 같은 모양), `error`. 연결이 끊기면 abort하고 원장에 `cancelled`를 남긴다. 토큰 단위 부분 블록은 이번 범위가 아니다(모델 출력이 JSON 하나라 부분 파싱의 이득이 작다). 비스트림 엔드포인트는 MCP·테스트용으로 유지한다.
6. **프런트엔드**: Studio 생성과 대화가 스트림을 읽어 단계를 표시하고(약 2초 안에 첫 진행 표시), 중지 버튼, 실행 목록 2초 폴링을 스트림 중에는 끈다. 사용량 칩(`GET /me/usage`)을 Studio 머리글에 낸다.

## 단위와 순서

| 단위 | 내용 |
| --- | --- |
| M2-1 | 레지스트리, 게이트웨이(쿼터·원장·타임아웃·비용 차단기), `callLlm` 어댑터, 의존성 추가, 부팅 가드, 단위 테스트(`MockLanguageModelV3`) |
| M2-2 | 모든 호출 지점에 `caller` 전달, Codex 전용 거절 제거, 실제 제공자·모델 표시 |
| M2-3 | SSE 엔드포인트 2개, 취소 시 `cancelled` 기록 |
| M2-4 | 프런트엔드 스트리밍·중지·사용량 칩 |
| M2-5 | 운영 구성 스택에서 **모의 OpenAI 호환 서버**로 생성→수정→저장→게시 전체 실행과 화면 확인(390/768/1440) |

각 단위는 독립 커밋이고 `audit`로 테스트를, `architect`로 검토를 받는다.

## 검증과 한계

- 단위 테스트는 `MockLanguageModelV3`와 SQLite·MySQL 원장으로 한다. 쿼터 경계, 거절 시 모델이 호출되지 않음, 오류·취소의 원장 기록, 비용 차단기, 타임아웃, 설정 오류.
- M2-5의 전체 실행은 **로컬 모의 서버**로 한다. 이는 배선(쿼터 차감, 원장, 스트리밍, 취소, 화면)을 증명하지만 **실제 모델의 생성 품질은 증명하지 않는다.**
- **출시 게이트의 실제 LLM 1개 제공자 전체 실행은 사용자 입력이 필요하다**: 제공자와 모델 선택, API 키(키는 채팅에 쓰지 않고 운영 VM의 `.env.prod`와 개발 머신의 추적되지 않는 설정에만 둔다), 월간 예산 숫자. 키가 준비되면 같은 흐름을 실제 제공자로 한 번 더 실행해 증빙한다. 그때까지 M2는 "배선 검증 완료, 실제 모델 미검증"으로 보고한다.
- 법무(M-1): 프롬프트·스키마·표본 행이 제공자로 전송되므로 제공자의 무보존·학습 미사용 조건 확인과 약관·개인정보 문구가 출시 전에 필요하다(이 단계의 범위 밖, 사용자 입력 필요).
