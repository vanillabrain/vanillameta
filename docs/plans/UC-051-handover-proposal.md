# UC051 자료 선택과 인계 의향 수락

Status: Draft

## 목표·단계

FR016/FR017/NFR005/NFR007·TC050 E02/E03, [영향 확인 후속](UC-051-departure-impact.md)이다. 개인 소유 자료를 자동 이관하지 않고 소유자가 고른 source/dashboard의 제목·번호를 같은 조직 직원에게 명시 공개해 인계 의향을 확인한다. 이번 ‘수락’은 자료 내용 열람권/소유권 이전/퇴사 완료/실행 승인으로 사용하지 않는다. 실제 이전은 소스·지표·대시보드 전체 의존성과 파일 보관 주체를 고정하는 별도 최종 설계·실행이 필요하다.

## 자료와 접근

활성·현재 로그인 계정, 현재 조직 소속이 전제다. 일반 구성원도 본인 자료만 선택한다. admin이라는 이유로 타인 자료를 제안하지 못한다. 수신자는 다른 활성 계정으로 같은 조직이어야 한다. 제목·번호를 수신자에게 보여준다는 명시 동의를 UI에서 확인한다.

- source 후보: Database.ownerId=본인 및 catalogActive=true. 지표 자체를 개별 이관하지 않는다.
- dashboard 후보: Dashboard 존재·assetActive=true·delYn=N·전체 UserMapping이 정확히1행이며 본인. 같은 본인의 중복 mapping도 제외한다.
- 후보 GET은 유형별20개와 nextAfterId이며 본인 자료의 kind/id/title만 반환한다. 선택은 최대20개/중복 금지/빈 목록 금지다. 선택되지 않은 자료는 포함하지 않는다.
- title은 source.name/dashboard.title을 최대300자로 제한하며 HTML 실행 없이 텍스트로 표시한다. 내용·SQL·열·파일명/경로·게시 링크·연결 설정·현재 수신자 목록은 반환하지 않는다.

## 저장·수락 계약

새 enterprise_handover_proposal의 UUID requestId PK·organizationId·ownerId/recipientId·발급 당시 양쪽 authVersion·organizationVersion·version·status(pending/accepted/cancelled)·expiresAt(24h)·acceptedAt·고정 manifestJson·내부 payloadHash·별도 무작위 reviewBasis와 생성/수락/철회의 정확한 audit ID 연결을 저장한다. 동일 당사자의 여러 UUID도 감사 사건을 구분한다. manifest는 kind/id/title와 내부 metadata fingerprint만 포함한다. 내부 hash나 원본 내용은 응답하지 않는다. audit는 명시 create/accept/cancel마다 같은 transaction에 기록하며 replay는 추가 쓰기0이다. 의향 행과 과거 감사만 추가/변경하고 자산/소속/권한/게시/출력/파일은 변경하지 않는다.

- `GET /enterprise/handover/candidates?kind=source|dashboard&afterId=`: 본인 후보 명시 조회. 응답은 entries(kind/id/title)와 nextAfterId다.
- `POST /enterprise/handover`: 정확히 requestId/recipientId/assets 본문이며 각 asset은 소유자가 확인한 kind/id/title이다. 저장 시 현재 제목과 정확히 일치하지 않으면 공개/쓰기 없이409다. 직원 번호를 명시 입력하고 같은 조직/본인 소유/활성/선택 수를 검증해24h 요청을 저장한다. 같은 UUID·같은 입력은 현재 신원/당사자·조직을 확인한 후 현재 상태를 반환한다. 이미 저장된 요청의 회복 조회는 자료 변경/만료를 새 저장 실패와 혼동하지 않으며 제목 공개는 detailsAvailable 규칙을 따른다. 다른 입력·다른 owner면409, 자동 새 UUID 재전송은 하지 않는다.
- `GET /enterprise/handover/:id`: 현재 같은 조직의 활성 소유자/지정 수신자만 조회한다. 존재하지 않는 올바른 UUID는404, 존재하지만 당사자가 아니면403이다. 일반 admin·다른 직원·타 조직에는403이다. 과거 manifest와 status/만료 상태이며 현재 자료 접근권/실행 가능 기준이 아니다. 응답은 requestId/organizationId/ownerId/recipientId/version/status/expiresAt/acceptedAt/reviewBasis/assets(kind/id/title), expired(boolean), detailsAvailable(boolean)다. 철회·만료 또는 어느 한쪽 발급 epoch/조직/활성 불일치 시 detailsAvailable=false와 assets=[]로 제목 재공개를 중단한다. 현재 같은 조직의 활성 참여자에게 상태 메타정보만 제공한다. 상태 조회 권한과 자료 제목 공개 자격을 구분한다.
- `POST /enterprise/handover/:id/accept`: 지정 수신자가 읽은 expectedVersion/reviewBasis로 명시 수락한다. 현재 양쪽 활성/epoch/소속·발급 조직 버전·선택 소유/활성·metadata fingerprint를 검사해 다르면409/권한 오류다. 확정된 수락의 동일 재시도(expectedVersion=1/reviewBasis 일치·acceptedAt 있음)는 현재 당사자 신원/조직 확인 후 pending의 만료/metadata 검사보다 먼저 현재 status/version을 반환한다. 이후 cancelled여도 재활성화하지 않는다. acceptedAt은 과거 의향 기록이며 뒤에 바뀐 자료를 다시 승인했다고 표현하지 않는다.
- `POST /enterprise/handover/:id/cancel`: 소유자만 현재 expectedVersion/reviewBasis로 철회한다. accepted도 철회 가능하며 원본·독립 사본·접근권은 바꾸지 않는다. 동일 철회 재시도는 과거 결과 확인만 한다. pending 만료 뒤에도 본인 철회는 가능하며 만료/소속 변경 요청의 수락은 불가다.

source fingerprint는 source metadata와 연결된 Metric 전체 행(고정 ID순), dashboard는 Dashboard/전체 UserMapping/StudioState를 정규 직렬화한 내부 hash다. source 원본 파일 bytes·외부 DB·다른 자료 유형·전역 사용처를 검사하지 않는다. 자료 변경은 다음 검토에서 새 UUID 제안을 요구한다. 이 hash를 실제 인계의 실행 ticket으로 승계하지 않는다.

SQLite 공통 metadata transaction, MySQL 쓰기는 READ COMMITTED에서 정렬 User/Membership 잠금→의향 행/조직 잠금→정렬 Dashboard 부모→정렬 Source 부모→Metric 순서의 기존 writer 경계와 CAS를 따른다. fingerprint는 부모 잠금 후 읽으며 오래된 반복 읽기 snapshot으로 최종 검사를 대신하지 않는다. 공통 잠금에 참여하지 않는 raw writer까지 보장하지 않는다. 조회는 동일 snapshot 및 종료 후 현재 actor/소속/조직 재검사로 읽기 기준을 보호한다. metadata snapshot은 동시 원본 파일 변경을 동결하지 않는다. 미확정 쓰기는 같은 UUID를 명시 조회하며 자동 재전송하지 않는다.

## 화면·복구

조직 화면의 접힌 ‘업무 자료 인계’는 구성원도 사용한다. 유형 후보 명시 불러오기→체크 선택→수신자 번호→제목/번호 공개 동의→요청 저장→요청 번호 복사/안내다. UUID는 수신자가 기존 채널로 받아 명시 조회한다. 외부 메시지 발송/익명 게시/자동 grant/자동 알림은 없다. 수신자는 고정 목록 검토→확인란→수락, 소유자는 명시 철회와 상태 조회가 가능하다. close·scope/선택 변경은 오래된 결과/확인을 해제하고 늦은 응답을 버린다. 쓰기 응답 유실·5xx·성공 응답 미확정은 선택/같은 UUID와 전체 입력을 유지해 상태 확인부터 한다.404 뒤에만 같은 UUID/같은 입력 저장을 명시 재시도한다. 생성의 명시4xx 거절은 입력을 보존하고 후보 재조회/다시 선택·새 명시 요청을 허용하되 자동 재전송/UUID 생성은 하지 않는다. 수락·철회의 명시4xx 거절은 같은 UUID·입력을 유지하되 이전 검토/동의를 해제하고 명시 GET 재검토 전 재전송을 차단한다. 브라우저 reload 후 복구는 요청 번호로 명시 조회하며 sessionStorage 영구 초안은 이번 범위가 아니다.

기본36px/도구32px, 모바일16px·큰 화면14px 입력과 반응형 행/정렬·가로 넘침을 확인한다. 기본 화면에는 선택·수신자·명시 버튼만 두고 상세 한계는 접는다.

## 검증·종료

보호 HTTP/SQLite/MySQL의 소유·현재 epoch·다른 조직/직원 차단·중복/비활성/변경409·원자 audit rollback·같은 UUID/replay·동시 수락/철회·자료/관계 불변, FE 명시 요청·오래된 응답·실패 초안/UUID 보존을 확인한다. 독립 검토와 type/lint/build·Ego 선택→생성→다른 계정 검토/수락→reload·390/768/1440을 수행한다. 현재 브랜치에 commit/push하며 운영 migration/실휴대폰·실제 이전/탈퇴 확정·전체16개 요건/TC050 사람 수용은 분리한다.
