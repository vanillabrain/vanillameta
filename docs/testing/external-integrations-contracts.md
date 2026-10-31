# 외부 연동 계약: Google 문서 요약, Microsoft 문서, Sheets 데이터

2026-10-31. 기준 브랜치 `develop`. 이번 단위는 4번 외부 연동의 계약 계층이다. 라우트·DB 승격·화면 연결은 아래 BLOCKED 범위다.

## 구현

- `document-summary.ts`: AI 요약은 `confirmAiCost === true`일 때만 실행한다. 동의가 없으면 `SummaryConsentRequired`(code `SUMMARY_CONSENT_REQUIRED`)를 던지고 모델을 한 번도 호출하지 않는다. 프롬프트는 제목·본문 24,000자·"5문장 이내"·"문서에 없는 내용 금지"를 담고, 결과는 4,000자로 자른다.
- `microsoft-docs.provider.ts`: Graph `Files.Read.All offline_access` 범위, PKCE authorization URL, code 교환, `/me/drive/items/{id}` metadata, `/content` 본문. 텍스트(`text/plain`, `text/markdown`)만 허용하고 Word(docx)는 "Word 변환 미지원"으로 거절한다. 본문 2MiB 상한.
- `google-sheets.provider.ts`: `spreadsheets.readonly`, PKCE, `values` API를 `UNFORMATTED_VALUE`로 읽어 100,000셀 상한을 적용하고 `toCsv`로 CSV로 만든다. 인용부호·줄바꿈·쉼표는 RFC4180 방식으로 escape한다.
- 두 provider 모두 config가 없으면 `configured() === false`이고 authorization URL에서 503으로 닫힌다. 실제 호출은 주입한 fetch로만 일어난다.

## VERIFIED

| Check | Result | Evidence |
| --- | --- | --- |
| 요약 비용 동의 | `confirmAiCost: false`면 예외·모델 호출 0회, true면 trim된 요약과 제목/5문장 프롬프트 | `src/documents/external-integrations.spec.ts` |
| Microsoft 설정·PKCE | 설정 없으면 fail-closed, 있으면 `code_challenge_method=S256`·scope·code_verifier·grant_type 확인 | 같은 파일 |
| Microsoft 문서 종류 | docx는 거절, text/plain은 id/name/mime/lastModified 반환 | 같은 파일 |
| Sheets 값·CSV | `UNFORMATTED_VALUE` URL, `"a,b"`·줄바꿈 escaping, 100,001셀 거절 | 같은 파일 |
| 정적 검사 | eslint와 tsc 통과, 7 테스트 PASS | 명령 출력 |

## BLOCKED

- Google 문서 요약의 실제 엔드포인트·저장·화면. `POST /v1/documents/:id/summary` 라우트, 버전별 요약 저장, 상세 화면의 동의 버튼은 아직 없다. AI 공급자 배선도 서버 기동 후 확인해야 한다.
- Microsoft·Sheets의 실제 OAuth 승인. `MS_DOCS_CLIENT_ID/SECRET/REDIRECT_URI`, `GOOGLE_SHEETS_CLIENT_ID/SECRET/REDIRECT_URI`가 필요하고, 각각 `/documents/microsoft/callback`, `/documents/sheets/callback` 등록이 선행돼야 한다.
- Sheets를 DuckDB 파일 소스로 등록하는 경로. CSV 변환 계약만 있고 기존 업로드·워커·source 등록에 연결하지 않았다.
- Word(docx) 본문 변환. Graph는 텍스트를 직접 주지 않으므로 변환 서비스 선택이 필요하다.
- 실제 Microsoft/Graph·Sheets 왕복과 토큰 갱신.

## 활성화 순서

1. 두 OAuth 클라이언트를 만들고 redirect URI를 등록한 뒤 위 환경변수를 설정한다.
2. 요약 라우트를 `LlmGateway` 지연 공급자로 연결하고, 버전별 요약 저장과 화면 동의 버튼을 붙인다.
3. Sheets CSV를 기존 파일 업로드 경로로 넘겨 DuckDB 소스를 만든다.
4. 실제 승인·요약·소스 생성·권한 회수를 HTTP와 화면으로 확인한다.


## 후속 구현: Google 요약 라우트·버전 저장·화면 동의 (2026-10-31)

- `POST /v1/documents/:id/summary`를 추가했다. `confirmAiCost: true`가 아니면 400 `SUMMARY_CONSENT_REQUIRED`로 끝나고 모델을 호출하지 않는다.
- 요약은 `document_summary(documentId, version)`에 `sourceSha256`·`generatedAt`과 함께 저장한다. 같은 버전·같은 sha면 `cached: true`로 재호출하지 않는다.
- AI는 `DOCUMENT_SUMMARY_AI` 공급자로 지연 로드하고 `feature: 'document-summary'`로 호출한다.
- 상세 화면에 AI 요약 섹션, 비용 동의 체크박스, 동의 전 비활성 버튼, 버전·생성 시각이 있는 결과 카드를 추가했다.
- 엔티티는 동기화 대상이다. 기존에 배포된 PostgreSQL에는 `document_summary`가 없으므로 운영 반영 전 migration 검토가 필요하다.

VERIFIED: backend 문서 3 suites 51 PASS, frontend Documents·documentService 44 PASS, 양쪽 tsc·eslint PASS.
BLOCKED: 실제 모델 호출과 브라우저 390/768/1440, 운영 DB migration 적용.


## 운영 migration: document_summary (2026-10-31 후속)

- `1793520000000-add-document-summary.ts`를 `migrations/postgres/`에 추가했다. `document_summary`가 없을 때만 만들고, PK는 `(documentId, version)`, `summary`는 text다.
- `app.module.ts`의 PostgreSQL migration 목록에 등록했고 `data-source.ts`의 타임스탬프 로더로도 자동 포함된다.
- 계약 테스트는 엔티티와 같은 컬럼 순서·PK·text 타입을 확인하고, 이미 테이블이 있으면 아무것도 만들지 않는지 검사한다.
- down은 백업 검토 없는 롤백을 막기 위해 예외를 던진다.

VERIFIED: `document-summary-migration.spec.ts`와 메타데이터 스키마 계약 PASS(2 suites, 3 tests, 7 skipped는 기존 live-PG 전용).
BLOCKED: 실제 PostgreSQL에 적용하는 실행과 백업·롤백 리허설.


## 서비스 수준 요약 테스트 (2026-10-31 후속)

- 동의 없는 요약은 서비스에서 `호출 비용` 오류로 끝나고 AI 호출과 DB 행이 모두 0인지 확인했다.
- 저장된 버전이 없으면 409를 던지고, 새로고침으로 버전을 만든 뒤 요약하면 `document_summary`에 1행이 생기며 `cached: false`, 같은 버전 재요청은 `cached: true`로 AI 호출 1회를 유지한다.
- 저장된 sha가 원본과 같은지, 범위 밖 버전 요청은 거부되는지 확인했다. 실제 SQLite 하네스에서 돌린다.

VERIFIED: documents.service.spec.ts 26 PASS.


## 연동 설정 상태 엔드포인트 (2026-10-31 후속)

- `GET /v1/documents/integrations`가 `{ googleDocs, microsoft, sheets }`를 반환한다. 네트워크 호출 없이 각 provider의 `configured()`만 읽는다.
- 인증은 기존 `JwtAuthGuard`를 그대로 쓰고, 응답은 `no-store`다.
- 계약 테스트는 세 provider를 대역으로 주입해 true/false 매핑을 확인한다.

VERIFIED: `documents.integrations.spec.ts` PASS, tsc PASS.
BLOCKED: 이 값을 보여 줄 화면 배지와, 실제 OAuth 클라이언트 등록.

