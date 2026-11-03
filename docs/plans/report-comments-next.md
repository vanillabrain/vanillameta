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
- 읽기: 각 행에 대해 `ReportSharingService.readable()` 전체를 다시 확인한다(활성, authVersion, 조직, 역할). 수신자 행은 저장된 `relationVersion`이 현재 delivery와 다르면 숨긴다. 그래서 재공유 뒤 예전 관계의 알림이 다시 보이지 않는다. 미확인 수도 같은 확인을 거친 결과로 센다.
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
- 넓히기는 작성자만 한다. 좁히기는 작성자와 소유자가 하되, 작성자·소유자 외의 사람이 댓글을 단 뒤에는 막는다. CAS 대상이다.
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

## 제품 결정 (2026-11-03 사용자 확인)

1. 알림 채널: 인앱만. 메일 발송 기반이 없다.
2. 수신자 스레드 기본 공개 범위: `private`. 다른 수신자에게 내 스레드를 보이는 것은 작성자가 명시적으로 고를 때만.
3. 소유자가 수신자 스레드를 넓히기: 불가. 공개하면 작성자 신원과 수신 사실이 드러난다.
4. AI의 `participants` 스레드 생성: 불가. 공개 범위는 사람이 정한다.
