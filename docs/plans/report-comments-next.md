# 보고서 댓글 다음 단계 계획

상태: 확정(2026-11-03). architect 검토를 반영했고, 아래 제품 결정 4개는 사용자가 권장값으로 확인했다.

## 목표

보고서 소유자, 공유받은 사람, Claude·Codex 같은 외부 AI가 댓글로 협업한다. 1단계([설계](../architecture/artifact-comments-collaboration.md))에서 미룬 것 중 협업 흐름을 끊는 세 가지를 채운다.

1. 새 댓글·답글·제안과 그 처리 결과를 관련된 사람이 화면을 다시 열지 않고 안다. 특히 Claude가 MCP로 남긴 댓글을 소유자가 안다.
2. 함께 검토하는 사람끼리 작성자가 고른 스레드를 서로 본다.
3. 실제 마우스 드래그로 범위를 고르는 흐름(RCOL-19)을 검증한다.

## 현재 구조에서 확인한 사실

- 보고서 댓글에는 알림·메일·실시간 갱신이 없다. 메일·Slack·웹훅 채널(`job-queue/services/job-notification.service.ts`)은 전송 호출이 주석 처리돼 있다. 조직 인앱 알림(`enterprise/notification.service.ts`)은 조직 관리 이벤트 전용이다.
- `progress.gateway`(Socket.IO)는 인증 없이 socket id room으로만 보낸다. 사용자 단위 알림에 쓰려면 인증과 권한 재확인을 새로 만들어야 한다.
- 수신자는 개인 단위다(`private_report_delivery`, 활성 50명 상한, `relationVersion`, 고정 `pinnedVersion`).
- MCP 쓰기의 행위자는 grant 사용자 본인이다. 소유자의 Claude가 단 댓글의 `createdBy`는 소유자다.
- 지금 `setThreadStatus`는 소유자와 스레드 작성자(수신자 자기 스레드)를 허용한다.

## 1단계: 인앱 알림 (먼저)

현재처럼 `private` 스레드만 있는 상태에서 만든다.

- 테이블 `artifact_comment_notification`: `id`, `recipientId`, `organizationKey`, `artifactKind`, `artifactId`, `threadId`, `event`(`thread.created`·`comment.replied`·`suggestion.created`·`suggestion.applied`·`suggestion.dismissed`·`thread.resolved`·`thread.reopened`), `actorKind`(user·ai), `actorId`, `aiClientName`, `relationVersion`(수신자 행은 delivery 값, 소유자 행은 null), `createdAt`, `readAt`.
- 수신자별 행을 저장하고 읽을 때 접근을 다시 확인한다. 읽음·미확인 수·보존 때문에 행이 필요하다.
- 받는 사람: 소유자, 스레드 작성자, 그 스레드에 이미 댓글을 단 사람 중 쓰는 시점에 그 스레드를 볼 수 있는 사람. 행위자 본인 제외는 `actorKind='user'`일 때만 한다. AI 댓글은 grant 사용자 본인에게도 알린다.
- 만드는 위치: 서비스 `perform()` 안에서만. 영수증 재생과 상태가 이미 같아 바로 끝나는 경로에서는 만들지 않는다. `suggestion.applied`는 보고서 저장 트랜잭션의 `markSuggestionsApplied` 쪽에서 만든다.
- 읽기: 각 행에 대해 `ReportSharingService.readable()` 전체를 다시 확인한다(활성, authVersion, 조직, 역할). 수신자 행은 저장된 `relationVersion`이 delivery의 `activatedRelationVersion`보다 작으면 숨긴다. `activatedRelationVersion`은 관계가 다시 읽을 수 있게 된 시점(첫 공유, 회수 뒤 재공유, 소유자·수신자 인증 초기화 뒤 재공유)의 `relationVersion`이다. 그래서 회수 뒤 재공유하면 예전 관계의 알림이 다시 보이지 않고, 활성 상태에서 새 버전만 다시 공유하면 알림이 남는다(2026-11-03 사용자 확인: 제안 반영 → 새 버전 공유 흐름에서 반영 알림이 사라지지 않게). 미확인 수도 같은 확인을 거친 결과로 센다. 미확인 수는 보고서 본문을 읽지 않는 `readableHead()`로 확인하고, 제목이 필요한 목록만 `access()`를 쓴다.
- 표시 내용: 보고서 제목은 `access()`가 돌려준 버전(수신자는 고정 버전)에서 가져온다. head 제목을 쓰지 않는다. 댓글 본문은 복사하지 않는다. 작성자 표시(사람 또는 "Claude · 클라이언트 이름")와 이벤트만 준다.
- API: `GET /comment-notifications?after=`(최신순 커서), `GET /comment-notifications/unread-count`, `POST /comment-notifications/read`(자기 행 id 목록 또는 전체, 다른 사용자 id는 무시).
- 보존: 90일, 사용자당 최신 500개. 정리는 그 사용자가 자기 알림을 읽을 때 한다. 쓰기 트랜잭션에서 다른 사용자 행을 지우지 않는다(잠금 순서 grant → head → access 유지).
- 화면: 상단 헤더 종 아이콘과 미확인 수, 목록 팝오버. 항목을 누르면 소유자는 편집 또는 읽기 화면, 수신자는 읽기 화면으로 가서 `?thread=`로 그 스레드를 선택한다. 갱신은 60초 폴링과 창 포커스 시 다시 읽기.
- 정리 경로: `deleteDashboardComments`와 handover 두 경로가 대시보드 알림 행도 지운다(대시보드 연결은 후속이어도 정리는 지금 넣는다). 보고서 삭제 경로가 생기면 같은 처리가 필요하다고 엔티티에 적는다.
- 메일은 범위 밖이다. 이벤트 모양은 나중에 outbox로 쓸 수 있게 둔다.
- 검증: Claude Code가 실제 호스트에서 MCP로 댓글 → 소유자 종 아이콘에 표시 → 눌러서 스레드로 이동.

## 2단계: 실제 드래그 선택 검증 (RCOL-19, 1단계와 병행)

- 실제 포인터 이벤트(`mouse.down` → `move` → `up`)로 본문 범위를 드래그해 댓글 버튼이 뜨고, 저장된 앵커의 quote가 드래그한 텍스트와 같은지 확인한다. Ego는 동작 사이에 페이지 가시성을 바꾸므로 한 스크립트 호출 안에서 연속 실행한다.
- 실패하면 원인을 고친다. 제품 코드 변경이 없으면 검증 기록만 남긴다.

## 3단계: 공유 스레드

- `artifact_comment_thread`에 `visibility varchar(16) NOT NULL DEFAULT 'private'`. 엔티티에도 `default: 'private'`를 선언한다(SQLite synchronize와 대시보드 insert). 대시보드 서비스는 이 열을 쓰지 않는다.
- 값은 `private`(작성자·소유자)와 `participants`(소유자와 활성 수신자). 소유자와 수신자 모두 만들 때 고른다. 소유자 스레드를 수신자에게 공개하는 것이 함께 검토하는 흐름의 중심이다.
- 넓히기는 작성자만 한다. 좁히기는 작성자와 소유자가 하되, 작성자·소유자 외의 사람이 댓글을 단 뒤에는 막는다. 별도 CAS 열 없이 목표 값 요청과 head 잠금으로 직렬화한다(아래 설계).
- 수신자는 `participants` 스레드 중 `thread.version <= pinnedVersion`인 것만 본다. 이 규칙은 `views()`와 `visibleThread()` 둘 다에 넣는다. 스레드 ID만으로 숨은 스레드에 답글·제안을 달 수 없어야 한다.
- 공개 스레드에서 다른 수신자는 답글만 단다. 수정 제안은 막는다. 해결·재개는 소유자와 스레드 작성자만 하도록 명시적으로 검사한다.
- 알림 대상에 공개 스레드의 새 스레드를 볼 수 있는 활성 수신자를 더한다.
- MCP: `vm_list_comments`는 같은 가시성 규칙을 따른다. AI는 `participants` 스레드를 만들지 않는다(`visibility` 인자 없음).

## 필수 테스트

- 수신자 B가 수신자 A의 `private` 스레드를 목록·답글·제안·상태 변경·MCP 어느 경로로도 보거나 다루지 못함.
- 고정 버전보다 새 버전의 공개 스레드를 ID로 직접 지정해도 접근 불가.
- 다른 수신자가 공개 스레드를 해결하지 못함. 공개 스레드에 다른 수신자의 제안 불가.
- 공유 회수, 재공유(`relationVersion`), authVersion 변경, 조직 이동 뒤 알림이 숨겨지고 미확인 수에서도 빠짐.
- 알림 제목이 고정 버전 기준.
- 재생·상태 무변경 경로에서 알림 0건. AI 댓글이 grant 사용자 본인에게 알림을 만듦.
- 다른 사용자의 알림 id로 read 요청 시 효과 없음.
- grant 회수 뒤 MCP 쓰기가 롤백되고 알림도 없음.
- PostgreSQL 17 migration 왕복, 기존 행 `private`, 대시보드 insert 영향 없음.
- 대시보드 삭제와 handover 시 알림 행 정리.
- 소유자가 수신자 스레드를 넓히면 403. AI가 `participants`로 만들거나 범위를 바꾸면 403.
- 좁히기 잠금: 소유자·작성자(또는 그들의 AI)만 답한 경우 허용, 다른 수신자(또는 그의 AI)가 답한 뒤 409.
- 좁힌 뒤 다른 수신자의 목록·알림·미확인 수에서 사라짐. `views(onlyThreadId)`로 숨은 스레드 ID를 줘도 빈 결과.
- B가 A의 공개 스레드에 답한 뒤 결과와 replay가 그 스레드를 돌려줌. B가 그 스레드를 해결하거나 제안하면 403.
- `thread.created`·`thread.shared` 알림은 같은 조직이고 고정 버전이 `thread.version` 이상인 수신자에게만. 재공유로 새로 보이게 된 공개 스레드는 `thread.shared` 알림.
- 관리자가 아닌 사람에게 예전 버전 인용과 앞뒤 문맥이 나가지 않음.

## 제품 결정 (2026-11-03 사용자 확인)

1. 알림 채널: 인앱만. 메일 발송 기반이 없다.
2. 수신자 스레드 기본 공개 범위: `private`. 다른 수신자에게 내 스레드를 보이는 것은 작성자가 명시적으로 고를 때만.
3. 소유자가 수신자 스레드를 넓히기: 불가. 공개하면 작성자 신원과 수신 사실이 드러난다.
4. AI의 `participants` 스레드 생성: 불가. 공개 범위는 사람이 정한다.
5. 새 스레드 기본값: 소유자·수신자 모두 `private`. 공개는 만들 때 또는 만든 뒤 직접 고른다.
6. 만든 뒤 범위 변경: 계획대로 허용. 넓히기는 작성자만, 좁히기는 작성자·소유자. 작성자·소유자 외의 사람이 댓글을 단 뒤에는 좁히기를 막는다.
7. 공개 스레드에서 수신자끼리 아이디를 그대로 보인다. 공개를 고를 때 "소유자와 공유받은 사람 모두에게 보입니다"를 안내한다.
8. AI(MCP)는 볼 수 있는 공개 스레드를 읽고 답글을 단다. 제안·해결·범위 변경은 사람 수신자와 같은 규칙으로 막는다(AI는 범위를 바꾸지 않는다).
9. 고정 버전보다 새 공개 스레드는 그 수신자에게 보이지 않는다. 관리자에게 볼 수 있는 인원을 보이고, 재공유로 새로 보이게 되면 알린다(2026-11-04).
10. 다른 사람에게 보이는 예전 버전 인용은 숨긴다(2026-11-04). 작성자 수신자가 회수된 뒤에도 그의 공개 스레드는 아이디와 함께 남고, 좁힐 수 있는 사람은 소유자뿐이다(결정 7의 범위).

## 3단계 설계 (2026-11-03)

- 열: `artifact_comment_thread.visibility varchar(16) NOT NULL DEFAULT 'private'`. migration `1793600000000`. 범위 변경 CAS는 따로 버전 열을 두지 않는다. 요청은 목표 값만 보내고, 이미 그 값이면 상태 무변경으로 끝난다(알림 없음). 쓰기는 모두 head 잠금 아래 직렬이므로 좁히기 검사와 답글이 경합하지 않는다.
- 보기 규칙 하나: `canSeeThread(thread, viewer)`에서 viewer는 `{ userId, ownerId, pinnedVersion }`(소유자는 `null`). 소유자를 먼저 판별하고, 작성자, 또는 `participants`이면서 `thread.version <= pinnedVersion`. 수신자의 `pinnedVersion`이 null이면 거부한다. `views()`(목록·쓰기 결과·replay), `visibleThread()`(답글·제안·상태·범위), 알림 생성과 알림 읽기가 모두 이 함수 하나를 쓴다. `views()`는 역할과 관계없이 보고서의 스레드(최대 500개)를 읽고 메모리에서 이 함수로 거른다. SQL에 같은 규칙을 다시 쓰지 않는다.
- 검사 순서: `visibleThread`(숨은 스레드는 404) 다음 `manages`(403). 숨은 스레드의 존재가 403으로 드러나지 않게 한다.
- 예전 본문 보호(2026-11-04 사용자 확인): 소유자·작성자가 아닌 사람에게는 스레드와 제안의 텍스트 앵커에서 `prefix`·`suffix`를 비우고, 자기 버전에서 찾지 못한(`detached`) 인용은 `quote`도 비운다. 화면은 빈 인용을 "이전 버전 본문"으로 표시한다.
- 다루기 규칙(`manages = 소유자 || 작성자`): 상태 변경, 기존 스레드에 제안, 범위 변경은 `manages`만. 아니면 403. 답글은 볼 수 있으면 누구나. 제안 닫기는 지금처럼 소유자만.
- 범위 변경 API: `POST /reports/:id/comments/:threadId/visibility` `{ requestId, visibility }`, 작업 이름 `thread.visibility`. 넓히기는 작성자(사람)만, 좁히기는 작성자·소유자(사람)만. 좁히기는 스레드에 작성자·소유자 외의 `authorId` 댓글이 있으면 409. AI 요청은 403.
- 만들기: `threadCreateRequest`와 `suggestionCreateRequest`(새 스레드)에 `visibility` 선택값, 기본 `private`. AI가 `participants`를 보내면 403.
- 알림: 새 이벤트 `thread.shared`. `thread.created`(공개로 만듦)와 `thread.shared`(넓힘)는 활성 delivery를 한 번 읽어 같은 조직, `canSeeThread`(delivery의 `pinnedVersion`), 행위자 제외(user일 때만) 순으로 거른 수신자 전원에게 보낸다. 나머지 이벤트는 소유자·작성자·참여자 중 볼 수 있는 사람이며, 제안 이벤트는 `suggestion.baseVersion`이 고정 버전보다 큰 수신자를 뺀다. 수신자 판단은 delivery를 먼저 읽고 그 `pinnedVersion`으로 한다. 좁히면 알림 읽기 쪽의 `canSeeThread`가 기존 알림과 미확인 수에서 숨긴다.
- 재공유 알림(2026-11-04 사용자 확인): 공유로 고정 버전이 올라가 열린 `participants` 스레드가 새로 보이게 되면(`이전 고정 버전 < thread.version <= 새 고정 버전`, 수신자 본인이 만든 스레드 제외) 그 수신자에게 `thread.shared`를 보낸다. 첫 공유와 회수 뒤 재공유는 이전 고정 버전을 0으로 본다. 행위자는 공유한 소유자다.
- 볼 수 있는 인원(2026-11-04 사용자 확인): `ThreadView.viewerCount`는 관리자(소유자·작성자)에게만 준다. 같은 조직의 활성 수신자 중 `pinnedVersion >= thread.version`이고 작성자가 아닌 사람 수다. 비공개 스레드에서는 "공개하면 볼 수 있는 인원"이 된다.
- 화면 응답: `ThreadView`에 `visibility`, `canManage`, `narrowLocked`, `viewerCount`를 더한다. 보고서 `insertThread`는 `visibility`를 명시해 넣고, `visibility` 열에 CHECK(`private`·`participants`)를 둔다. 화면은 이 값으로 버튼을 고른다(서버가 다시 검사한다).
- 화면: 새 댓글 작성 칸에 "공유받은 사람에게도 공개" 체크(기본 해제, 고르면 안내 문구). 스레드에 "공개" 표시와 범위 변경 버튼(`canManage`이고, 좁히기는 `narrowLocked`가 아닐 때). `canManage`가 아니면 해결·수정 제안 버튼을 숨긴다. 패널 안내 문구를 바꾼다.
- MCP: `vm_list_comments` 설명을 "자기 스레드와 공개 스레드"로 고친다. 도구 입력에 `visibility`는 넣지 않는다.
