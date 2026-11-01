# 문서형 아티팩트: 텍스트·이미지 블록, AI 본문 제안, 저장 버전

2026-10-31. 기준 브랜치 `develop`. 이번 작업은 비공개 보고서를 문서형 아티팩트로 확장한 첫 구현 단위다.

## 데이터 형태

- 보고서 페이로드에 `blocks` 배열을 추가했다. 기존 `body`는 검색·호환을 위해 남기고, TEXT 블록의 텍스트를 줄바꿈 두 번으로 이어 붙인 투영으로 서버가 다시 계산한다.
- TEXT 블록은 최대 20,000자, IMAGE 블록은 PNG·JPEG·WebP data URL, 장당 512KiB, 전체 1.5MiB, 최대 40블록이다.
- 이미지는 보고서 버전과 함께 고정되므로 별도 파일 권한 경로가 없다. 공유받은 사람은 보고서 버전이 허용하는 범위에서만 본다.
- 저장 버전은 기존 `private_report_revision`과 `private_report_chunk`를 그대로 사용한다.

## API

- `POST /v1/reports/:id/save`가 선택적 `blocks`를 받는다. 블록이 있으면 `body`는 블록에서 계산한 값으로 저장한다.
- `GET /v1/reports/:id?version=N`이 과거 버전을 소유자에게 돌려준다. 범위를 벗어난 버전은 404다.
- `GET /v1/reports/:id/versions`가 버전·revision·바이트·현재 여부를 최신순으로 준다.
- `POST /v1/reports/:id/suggest`가 저장된 고정 수치만 근거로 본문 초안을 만든다. 초안은 저장되지 않는다.
- AI 호출은 `REPORT_BODY_AI` 공급자로 분리했다. 런타임에는 `LlmGateway`를 지연 로드하고, 단위 테스트는 대역을 주입한다.

## 화면

- 편집기: 기존 본문 입력은 첫 TEXT 블록이 된다. 이미지 추가, 설명, 전체·절반 너비, 위·아래 이동, 삭제를 제공한다.
- AI 본문 제안: `제안 받기` → 결과 확인 → `본문에 적용` 또는 `닫기`, 적용 뒤 `되돌리기`가 이전 본문과 이미지를 복원한다. 저장은 사용자가 명시적으로 누를 때만 일어난다.
- 저장 버전: 펼칠 때만 목록을 불러오고, 과거 버전을 열면 편집기에 채운다. 저장하면 다음 버전으로 추가되고 과거 버전은 남는다.
- 읽기 화면: 본문 아래에 이미지 블록을 순서대로, 절반 너비는 50%로 보여 준다. 640px 이하에서는 전체 너비로 전환한다.

## VERIFIED

| Check | Result | Evidence |
| --- | --- | --- |
| 블록 저장·본문 투영·재열기 | 실제 SQLite에서 TEXT 2개와 IMAGE 1개를 저장하고 `body`가 `첫 문단\n\n둘째 문단`으로 계산되며 재열기에서 동일 블록이 반환됨 | `src/reports/reports.service.spec.ts` |
| 과거 버전 | 두 번 저장 후 `versions`가 `[2, 1]`을 주고 `get(id, actor, 1)`이 첫 본문을 반환, 범위 밖 3은 404 | 같은 파일 |
| AI 제안 경계 | 주입한 AI 대역이 호출되고 프롬프트에 KPI 제목이 포함되며 제안이 trim되어 반환됨 | 같은 파일 |
| 클라이언트 블록·AI·버전 | 이미지 블록이 TEXT와 함께 커맨드에 실리고, AI 제안은 명시 클릭 전에는 본문을 바꾸지 않으며, 되돌리기가 복원하고, 과거 버전 열기가 저장을 만들지 않음 | `src/pages/Reports/ReportEditor.test.tsx` |
| 읽기 스키마 | `documentBlocks`를 허용하고 이미지 렌더링 경로를 추가 | `reportSharingApi.ts`, `ReportReader.tsx` |
| 백엔드 회귀 | 6 suites 34 PASS, typecheck·lint·production build PASS | `npx jest --runInBand src/reports src/common/user-entity-identity.spec.ts` |
| 프론트 회귀 | 4 files 50 PASS, typecheck·lint·production build PASS | `npx vitest run src/pages/Reports` |

## BLOCKED

- 실제 브라우저 390/768/1440 확인과 HTTP 왕복. 이 세션의 샌드박스가 `listen`에 EPERM을 반환했고(`0.0.0.0:4000`, `127.0.0.1:3000`), 서버 기동 승인 심사가 제한 시간을 넘겨 실행되지 않았다. 이전 턴에서 쓴 스크린샷 증빙을 이 변경의 증거로 재사용하지 않는다.
- 실제 gpt-6-luna 호출. 공급자 경계와 대역 주입까지만 확인했고, 실제 모델 응답은 서버 기동 후 재확인이 필요하다.
- VoiceOver 발화. 기존 차단 상태를 유지한다.

## 다음 확인

1. `npm run start:local`과 `npm run dev`를 띄울 수 있는 환경에서 보고서를 만들고 이미지 블록을 저장한 뒤 새로고침으로 재열기.
2. `제안 받기`가 실제 모델로 응답하는지, 적용·되돌리기 뒤 저장이 r2로 남고 r1이 남는지.
3. 390/768/1440에서 이미지 절반 너비와 본문 줄바꿈, 키보드로 이미지 추가·이동·삭제에 접근 가능한지.

## 실제 브라우저 후속 · 2026-11-01

기준 `develop` `1287d3d3`. 기존 완료 조건을 재실행하지 않고, 위 BLOCKED 항목 중 실제 브라우저로 확인 가능한 범위와 이미지 저장 경계를 검증했다.

| ID | 수행과 관측 | 판정 |
| --- | --- | --- |
| RPTB-01 | 기존 r1을 편집해 TEXT 1개와 PNG IMAGE 1개를 절반 너비로 r2 저장했다. 저장 201 뒤 reload에서 본문과 이미지가 그대로 복원됐다. | PASS |
| RPTB-02 | 과거 버전 목록에서 r2·r1을 확인하고 r1을 열었다. r1은 기존 본문만 있고 이미지는 0개였으며, r2의 revision은 `90274e90…07b3`로 남았다. | PASS |
| RPTB-03 | 보고서 읽기 화면은 390·768·1440에서 넘침 0이다. 절반 이미지는 1440에서 341px/682px, 태블릿과 모바일에서는 한 열 전체 폭으로 표시됐다. | PASS |
| RPTB-04 | 본문 → Tab에서 `이미지 추가` 버튼으로 초점이 이동하고 Enter로 실제 파일 선택창이 열렸다. | PASS |
| RPTB-05 | `/v1/ai/status`는 provider codex, model gpt-6-luna를 보고했다. 실제 `제안 받기`는 201이며 gpt-6-luna가 계약 수치 5954.96과 기존 본문을 근거로 한국어 문단 3개를 생성했다. AI 원장도 provider codex/model gpt-6-luna, status ok, input 79/output 35 tokens다. | PASS |
| RPTB-06 | 실제 제안은 적용 전 본문을 바꾸지 않았다. `본문에 적용`에서 문단이 추가되고 이미지가 유지됐으며, `되돌리기`에서 원문과 이미지가 함께 복원됐다. 적용·되돌리기 사이 서버 저장 요청은 0회였다. | PASS |

발견해 수정한 오류:

- 미확정 보고서 요청 보관 한도가 128KiB라 109,698-byte 이미지의 data URL이 저장 전에 거부됐다. [reportPending.ts](/Users/moonklabs/workspace-vanilla/vanillameta/frontend-web/src/pages/Reports/reportPending.ts)의 한도를 유효한 이미지 명령을 수용하는 3MiB로 올리고 회귀 테스트를 추가했다.
- 서버의 기본 JSON 본문 한도 100KiB가 이미지 보고서를 413으로 거부했다. [main.ts](/Users/moonklabs/workspace-vanilla/vanillameta/backend-api/src/main.ts)에서 `/v1/reports`만 3MiB로 파싱하고 다른 API는 100KiB 기본값을 유지한다.
- 숨김 파일 입력을 label로 감싼 구조는 Tab 초점을 받을 수 없었다. 이미지 추가를 키보드 버튼으로 바꾸고 파일 입력을 연결했다.
- 5xx의 영문 `Internal server error`를 그대로 보여 주던 안내를 한국어 재시도 안내로 바꾸고 초안 보존을 명시했다.
- Codex CLI가 `AI_CODEX_BASE_URL`을 설정해도 기본 openai 제공자로 요청해 gpt-6-luna를 찾지 못했다. 연결 설정이 있을 때 `model_provider=opencodex`와 Responses API 호환 공급자 정의를 전달하도록 수정했다.

검증:

- backend reports·coding-agent 6 suites, 55 PASS
- frontend Reports 4 files, 56 PASS
- backend/frontend typecheck와 production build PASS
- `AI_PROVIDER=codex`, `AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1`, 기존 OpenCodex catalog를 사용했으며 모델은 `gpt-6-luna`로 유지했다.
- VoiceOver는 기존 차단 상태를 유지했다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-blocks-20261101/` — `blocks-roundtrip.json`, `responsive-keyboard.json`, `keyboard-image-add.json`, `ai-live-roundtrip.json`, `ai-live-suggestion-1440.png`, `ai-live-applied-1440.png`, `ai-live-undone-1440.png`와 대표 390/768/1440 캡처. 이전 429 오류·대역 증빙은 수정 전 이력으로 보존한다.

