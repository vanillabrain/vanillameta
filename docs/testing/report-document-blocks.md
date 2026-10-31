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

