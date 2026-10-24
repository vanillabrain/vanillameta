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
| 실제 프로세스 시간 측정(컴파일된 `serveRun`, `curl -N`) | 요청 후 **7 ms**에 `start`, 1초 간격 하트비트, 실행이 풀린 시점(2.0 s)에 `result` |
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

실행하지 않은 것: 브라우저 실행(아래 M2-5). 단위·컴포넌트 테스트는 `fetch`·`useChat`을 가짜로 대체하므로 실제 네트워크에서의 첫 진행 표시 시간, 중지 시 서버 원장 `cancelled`, 모바일 백그라운드, 레이아웃(390/768/1440)은 증명하지 않는다.

## 아직 실행하지 않은 것 (M2 전체)

- **M2-5**: 운영 구성 스택에서 모의 OpenAI 호환 서버로 생성→수정→저장→게시 전체 실행과 390/768/1440 화면 확인.
- **실제 LLM 제공자 1개로 끝까지 실행**: 제공자·모델·API 키·월간 예산이 필요하다(사용자 입력). 그때까지 M2는 "배선 검증 완료, 실제 모델 미검증"이다.
