# M1 나머지: 쿼터·원장·사용자별 제한·공개 링크 통제

[외부 베타 계획](external-beta-launch.md)의 M1에서 초대 가입과 데이터 격리 증명을 뺀 나머지다. 쿼터를 **실제로 거는 곳**(LLM 호출 지점)은 M2의 `llm-gateway`이고, 이 단계는 그 게이트웨이가 부를 부품과 사용자에게 보이는 제한을 만든다. 코드 위치는 2026-10-24 조사 기준이며, architect 검토(같은 날)에서 나온 차단 항목을 반영해 확정했다.

## 단위와 순서

| 단위 | 내용 | 코드 위치 |
| --- | --- | --- |
| A | AI 사용량 원장과 사용자별 쿼터, 운영자 CLI | 새 `backend-api/src/usage/`, `access-cli` |
| B | Studio 공개 링크 기본 만료와 상한 | `dashboard-studio/studio-publication.service.ts`, `StudioPublish` 화면 |
| C | 사용자별 요청 제한(AI·업로드 경로) | 새 `common/throttle/`, 해당 컨트롤러 |
| D | 업로드 개수·총 용량 상한(별도 검토) | `database.service.ts`, `file-refresh.service.ts`, `duckdb.service.ts` |
| E | `GET /me/usage` | 새 `usage` 컨트롤러. 머리글 칩은 M2와 함께 |

각 단위는 독립 커밋이고 `audit`로 테스트를 돌린 뒤 `architect`가 검토한다. D는 크기가 커서 구현 전에 한 번 더 검토한다.

## A. 원장과 쿼터

- **테이블** (마이그레이션 `1792700100000-add-ai-usage.ts`, `hasTable` 가드). 엔티티와 열·인덱스 이름이 같아야 한다(prod는 `synchronize`를 쓰지 않고, 빈 DB는 엔티티로, 기존 DB는 마이그레이션으로 만들어지므로 둘이 다르면 스키마가 갈라진다).
  - `ai_usage_ledger`: `id`(**integer** 자동 증가. mysql2의 bigint는 문자열로 오고 SQLite 자동 증가는 INTEGER 기본 키만 된다), `userId`, `feature`(64), `provider`(32), `model`(128), `inputTokens`·`outputTokens`(int, 기본 0), `status`(16: `reserved`·`ok`·`error`·`cancelled`·`quota_denied`), `latencyMs`(nullable), `requestId`(64), `createdAt`(datetime(6)). 인덱스: `UQ_ai_usage_ledger_user_request (userId, requestId)` 유일, `IDX_ai_usage_ledger_user_created (userId, createdAt)`, `IDX_ai_usage_ledger_created (createdAt)`(M2의 전역 비용 차단기가 시간 범위 합계를 낸다).
  - `user_quota`: `userId`(기본 키), `dailyCalls`·`monthlyTokens`(nullable), `updatedAt`. 행이 없거나 열이 null이면 환경변수 기본값.
  - `createdAt`은 앱이 `Date`로 직접 넣는다. MySQL의 `CURRENT_TIMESTAMP`는 세션 시간대를 따르므로 서비스는 이 기본값을 쓰지 않는다. 주의: mysql2는 `Date`를 프로세스의 지역 시간으로 직렬화하므로 디스크에 저장되는 값은 UTC가 아니라 API 프로세스의 지역 시각이다(비교 경계도 같은 방식이라 일관된다). 운영 컨테이너는 `TZ`가 없어 UTC지만, `access-cli`는 API와 같은 시간대(예: `docker compose exec`)에서 돌려야 하고 서머타임 지역에서는 연 1시간이 모호하다. 이 단계의 창 계산은 SQLite와 한 개 시간대의 MySQL에서 검증한다.
  - `app.module.ts`의 수동 마이그레이션 목록(로컬 `migrationsRun`용)에는 넣지 않는다. 기존 `AddInviteAccess`도 빠져 있어 같은 방식으로 맞춘다(로컬은 `synchronize`로 테이블이 생긴다).
- **환경변수**: `QUOTA_DAILY_CALLS`(기본 30), `QUOTA_MONTHLY_TOKENS`(기본 500000). 0은 "AI 사용 불가", 무제한은 지원하지 않는다(큰 수를 쓴다). 숫자가 아니거나 음수면 부팅 가드가 거부한다. 기본값은 제품 판단이 필요해 "확정 전"이다.
- **창은 UTC 달력 날짜·월**이다. 한국 시간 기준으로는 09:00에 일일 사용량이 초기화된다. 이는 제품 선택으로 기록하고 `summary`가 `resetsAt`을 돌려줘 화면이 시각을 보이게 한다.
- **`AiQuotaService`**
  - `reserve(userId, epoch, feature, requestId)`: **`sourceWriteTransaction`(MySQL에서 READ COMMITTED) 안에서 `lockSourceActor(manager, userId, epoch)`를 첫 문장으로** 실행한다. InnoDB REPEATABLE READ는 첫 비잠금 읽기에서 스냅샷을 잡으므로, 잠금 전에 `user_quota`나 중복 `requestId`를 읽으면 앞선 잠금 보유자가 커밋한 행이 보이지 않아 한도를 넘는다. 잠금 뒤에 같은 `(userId, requestId)` 행을 찾아 있으면 그 예약을 돌려주고(멱등, ER_DUP_ENTRY를 500으로 내지 않는다), 없으면 오늘 호출 수(`reserved`·`ok`·`error`·`cancelled`)와 이번 달 토큰 합을 센다. 한도 이상이면 `quota_denied` 행을 넣는다. **트랜잭션은 거부 결정을 값으로 돌려주고 429 `AI_QUOTA_EXCEEDED`(남은 양, 재설정 시각)는 커밋 뒤에 던진다.** 안에서 던지면 롤백으로 `quota_denied` 행이 사라진다. 아니면 `reserved` 행을 넣는다. M2는 JWT의 `authVersion`(epoch)을 넘겨야 한다.
  - `record(userId, requestId, {status, inputTokens, outputTokens, latencyMs, provider, model})`: `UPDATE … WHERE userId=? AND requestId=? AND status='reserved'`. 두 번 불려도 한 번만 반영된다. 사용자 없이 `requestId`만으로 갱신하지 않는다.
  - `summary(userId)`: 한도, 사용량, 재설정 시각.
  - **월간 토큰 초과는 한 번의 호출만큼이 아니다.** 진행 중인 `reserved` 행의 토큰은 0이라 실제 초과 폭은 (동시에 진행 중인 호출 수) × (가장 큰 호출)이고 사용자별 제한(분당 10회)까지 커질 수 있다. 베타에서는 이를 받아들이고, M2 게이트웨이가 `maxOutputTokens`를 예약 추정치로 넣고 `record`에서 실제 값으로 정산하는 방식을 선택지로 남긴다.
  - 비정상 종료로 남은 `reserved` 행은 호출 수에 센다(슬롯을 쓴 것으로 본다). 그 호출의 토큰은 기록되지 않고 제공자는 청구했을 수 있다. 운영자는 `quota show`로 볼 수 있다.
- **운영자 CLI**(`access-cli`): `quota show <userId>`(한도·사용량·남은 `reserved` 행), `quota set <userId> [--daily N] [--monthly N]`, `quota clear <userId>`, `quota top`(오늘·이번 달 사용량 상위 사용자).
- **호출 연결 없음**: 이 단계는 서비스를 어디에도 호출하지 않는다. M2의 `llm-gateway`만 호출해 우회 경로를 막는다.

## B. 공개 링크 기본 만료

- **기본 30일, 상한 30일**로 기존 BI 게시(`bi/publication.service.ts` `PUBLICATION_MAX_EXPIRY_MS`)와 맞춘다. 두 공개 링크의 정책을 같게 하라는 [외부 베타 계획](external-beta-launch.md)의 요구를 따른다. 환경변수 `PUBLICATION_DEFAULT_DAYS`(기본 30)로 기본만 바꿀 수 있고 상한은 30일 고정이다. "만료 없음"은 없어진다.
- **기본값은 `expiresAt`을 대입하는 지점(약 L229)에서만 적용**하고 상한 검증은 `validate()`(L64-86)에서 한다. 본문을 바꾸면 `payloadHash = studioDigest({dashboardId, ...body})`(L131)가 날짜마다 달라져, 같은 `requestId`로 다음 날 재시도하면 충돌하고 `studio-execution.service.ts`의 저널 재시도(`visibility:'link'`, `expiresAt` 없음)가 깨진다.
- 재게시는 `...old`를 펼치므로 지금 만료 없는 링크를 재게시하면 30일 만료가 생긴다. 화면 문구에 이를 알린다. 기존에 게시된 만료 없는 링크는 재게시 전까지 바꾸지 않는다.
- `StudioPublish` 화면은 만료 입력을 채우지 않고 비워 두면 서버가 기본 기간을 적용한다고 안내한다("비워 두면 자동 만료되지 않습니다" 문구를 바꿈). 서버 기본은 `PUBLICATION_DEFAULT_DAYS`로 줄일 수 있어 화면 문구는 "기본 기간(최대 30일)"으로 쓴다. 30일 상한은 `private` 게시에도 적용한다(기본 만료만 링크 공개에 한정).
- 갱신해야 하는 테스트(모두 `expiresAt`을 참조): `studio-publication.service.spec.ts`, `studio-execution.service.spec.ts`, `studio-remix.service.spec.ts`, `dashboard-resource-access.spec.ts`, `studio-legacy-conditions.spec.ts`, `studio-business-basis.spec.ts`, `studio-publication-migration.spec.ts`, 프런트 게시 화면 테스트.
- 기존 스냅샷 크기 상한(2MiB)과 회수는 그대로이고 기본 만료·상한 테스트를 추가한다.

## C. 사용자별 요청 제한

- 직접 만든 가드를 쓰는 이유: `@Throttle(limit, ttl)`은 `THROTTLER_LIMIT`·`THROTTLER_TTL` 메타데이터를 쓰는데 전역 IP 가드도 같은 값을 읽는다. 재사용하면 로그인·대기자 등록처럼 이미 IP 제한을 덮어쓰는 라우트와 충돌하거나, 새 라우트의 IP 제한까지 사용자 한도로 조여진다(공용 NAT). 서브클래스를 `JwtAuthGuard` 뒤에 두면 순서는 맞출 수 있지만 메타데이터 충돌은 남는다. v4 저장소는 호출마다 `setTimeout`을 만들고 키를 지우지 않아 작은 고정 창 맵이 더 가볍다.
- `UserThrottleGuard`와 `@UserThrottle(limit, ttlSeconds)`는 **다른 메타데이터 키**를 쓴다. 키는 `클래스.핸들러:userId`. 사용자 id는 `req.user.accessKeyData.id`이고 양의 안전한 정수가 아니면(공유 링크 토큰은 계정이 없다) 요청을 거부한다. 지난 창은 호출 때 지연 정리한다.
- 가드 순서: 메서드 가드가 클래스 가드보다 뒤다. 핸들러마다 `@UseGuards(JwtAuthGuard, UserThrottleGuard)`를 함께 쓰거나 둘 다 클래스에 둔다. 컨트롤러가 `JwtAuthGuard`를 메서드에 두면 `@UserThrottle`을 클래스에 둘 수 없다.
- 적용: **모델을 실제로 부르는 핸들러**(`callLlm`에 닿는 것)와 업로드 핸들러에만 핸들러 단위로 붙인다. 컨트롤러 전체에 붙이면 UI가 반복 호출하는 조회가 걸린다(예: Studio 실행 목록은 실행 중 2초마다 폴링되어 분당 30회이고, `ai/dashboard-view`는 대시보드의 필터·기간을 바꿀 때마다 호출된다). 대상은 `ai`(대시보드 초안·도우미·text-to-sql·차트 추천·인사이트), Studio(제안, 실행, 실행 재시도, 생성 메시지·확인), 의미 제안(제안·질문), 파일 스키마 진단, commerce AI 3종, BI 편집기 AI, 거버넌스 도우미, 업로드(`database/upload`, 파일 교체, 파일 새로고침 시작, commerce 가져오기 2종)다. 기본값은 AI 라우트당 분당 **20**(계획의 10을 올렸다: 한도 초과의 실제 방어선은 일일 쿼터이고, 이 제한은 폭주 방지이며 정상적인 연속 사용을 막지 않아야 한다), 업로드 분당 5, 환경변수 `USER_THROTTLE_AI_PER_MIN`·`USER_THROTTLE_UPLOAD_PER_MIN`로 바꾼다. 숫자는 확정 전이다. Nest는 가드를 인터셉터보다 먼저 실행하므로 429를 받은 업로드는 multer가 파일을 쓰기 전에 거절된다.
- 기존 IP 제한은 그대로 둔다.
- `route-inventory.spec.ts`는 인증 가드만 확인하므로 제한 적용 여부는 증명하지 않는다. 별도 테스트로 대상 라우트가 `UserThrottleGuard` 메타데이터를 가졌는지 확인한다.

## D. 업로드 상한 (구현 전 별도 검토)

- 환경변수 `UPLOAD_MAX_SOURCES_PER_USER`(기본 20), `UPLOAD_MAX_BYTES_PER_USER`(기본 1GiB). 단일 파일 상한(`FILE_UPLOAD_MAX_BYTES`, 기본 512MiB)은 그대로다.
- **바이트는 DB에 없다.** 합산 대상은 세 가지다.
  1. 소유한 DuckDB 소스의 `fileVersions` 디렉터리(SQL에서 `engine='duckdb'`로 먼저 걸러 다른 소스의 자격증명은 복호화하지 않는다).
  2. **삭제 수신증 중 정리가 대기 중인 것**(`cleanupStatus='pending'`·`retry_required`의 `filePlan`). 삭제하면 `Database` 행이 지워지고 파일은 별도 정리 단계까지 디스크에 남으므로, 행만 합산하면 그 파일은 센 것이 아니라 빠진 것이다.
  3. **새로고침 준비 파일**(`uploads/refresh-input/<uuid>`, 사용자당 최대 3×512MiB). `FileRefreshService.start`에서 복사 전에 검사한다. 백그라운드 `run()` 안에서는 늦다.
- `DuckDBService.directoryBytes`는 `private`이므로 공개한다.
- 검사 위치: 임포트 전(저렴한 확인, 임시 파일 삭제)과 `lockSourceActor` 뒤 트랜잭션 안(동시 업로드 경합). 안쪽 검사는 **`sourceWriteTransaction`(READ COMMITTED)** 아래에서, **방금 임포트해 디스크에는 있고 DB에는 아직 없는 디렉터리의 바이트를 더해** 한다. 현재 `uploadFile`은 일반 `metadataTransaction`(REPEATABLE READ)이다. 사용자 행 잠금을 잡은 채 디렉터리를 도는 것은 소스가 수십 개 수준에서는 허용한다.
- 대상: `uploadFile`, `replaceFile`, 파일 새로고침 시작. **commerce 가져오기는 제외한다.** 그 원본 파일은 `Database` 행이 아니라(`commerce-studio.service.ts`) 합산할 수 없으므로 사용자별 요청 제한으로만 다룬다.
- 응답: **403 `UPLOAD_QUOTA_EXCEEDED`**(기존 `ForbiddenException({error})` 관례). 저장 공간은 시간이 지나도 풀리지 않아 `Retry-After`가 있는 429는 맞지 않고, 413은 요청 한 건의 크기 문제다. 429는 시간이 지나면 풀리는 AI 쿼터에만 쓴다.

## E. 사용량 조회

- `GET /me/usage`(`JwtAuthGuard`): `{ daily: {used, limit, resetsAt}, monthlyTokens: {used, limit} }`. `me` 경로 충돌 없음(조사 확인).
- Studio 머리글 칩(`StudioShell.tsx`, `StudioCreate.tsx`)은 **M2와 함께** 낸다. 호출하는 곳이 없는 지금은 "N/30"이 항상 0이라 오해를 부른다.

## 운영자 가시성

사용자별 사용량은 `quota top`으로 본다. 사용자당 게시물 수는 제한이 없고(작은 위험) 이 단계에서 다루지 않는다.

## 검증과 완료 기준

- 단위 테스트: 일자·월 경계, override, 0 한도, `record` 중복, 거부 행이 커밋 뒤에 남는지, 같은 `requestId` 재예약, 기본 만료·상한, 사용자별 제한의 창 경계와 지연 정리, 업로드 개수·바이트 한도와 정리.
- **MySQL 통합 테스트**(`access.mysql.spec.ts`와 같은 옵트인): 동시 `reserve`가 한도를 넘지 않는지. 잠금 전에 일반 읽기를 넣으면 이 테스트가 깨지는지(변형 확인).
- 변형 확인: 잠금 제거, 창 경계 변경, 기본 만료 제거, 사용자 키 제거 등이 해당 테스트를 깨는지.
- 격리 프로브에 `GET /me/usage`가 본인 것만 돌려주는지 추가.
- 쿼터를 실제 호출에 거는 것은 M2에서 한다. 이 단계의 증빙은 "서비스가 한도를 지킨다"까지이고 "AI 호출이 막힌다"가 아니다. 증빙은 `docs/testing/external-beta-m1-quota.md`에 남긴다.
