# 조직 이동과 고정 보고서 공유

2026-10-30. 기준 develop `66fc4867`. [기존 공유](report-recipient-sharing.md)의 RSH-07 남은 조직 이동 조합이다. [직원 이동 계약](../plans/UC-051-staff-transfer.md)의 본인 요청→대상 admin 수락→원 조직 다른 admin 확정을 실제 전체 Nest/MySQL에서 실행했다. Membership·epoch 직접 변경으로 대체하지 않았다.

| ID | 기대 결과와 선택 범위 | 결과 |
|---|---|---|
| RSH-T01 | 수신자 A→B 뒤 구 token 거절, 새 로그인으로 받은 보고서 목록/직접 read 차단. 소유자는 관계를 사용 중단으로 확인한다. | PASS. 구 token401·새 token403·받은 목록0. 수신자 신원은 원 조직 공유 관리에서 숨김, 관계는 suspended다. 실제 재로그인 뒤 본문 비노출 캡처01. |
| RSH-T02 | 수신자가 A로 돌아와도 원 epoch에 고정된 공유가 자동 부활하지 않는다. 과거 영수증과 현재 권한을 구별하고, 원 조직 소유자의 명시 회수는 동작한다. | PASS. epoch0→1→2. 원 UUID 재요청201 뒤 관계/epoch 불변·reader403. 화면에서 사용 중단 확인→취소 기본 초점→Tab 확정→Enter 회수. active=false·relationVersion2. 캡처02·03. |
| RSH-T03 | 소유자 A→B 뒤 원 조직 수신자와 B의 직원·admin에게 자동 권한이 생기지 않는다. 소유자의 원 조직 고정 보고서 read/관리/회수 거절과 원본 소유권 보존을 구별한다. | 접근 차단 PASS / 조직 밖 회수 기능 제한. 원 조직 수신자·B 수신자·B admin reader403, source/Studio403. 소유자는 본인 source/Studio200이나 고정 보고서 read·shares·revoke403. 실제 화면에서도 본문·관계 비노출. 캡처04·04b. |
| RSH-T04 | 소유자가 A로 돌아와도 원 epoch의 공유는 자동 부활하지 않는다. 소유자 현재 관리·명시 회수 결과를 확인한다. | PASS. owner epoch0→1→2 뒤 본인 reader200·수신자 reader403. 과거 공유 UUID 재요청은 epoch를 갱신하지 않는다. 화면에서 suspended→키보드 명시 회수→active=false·relationVersion2. 캡처05·06. |
| RSH-T05 | 이동/회수 뒤 원본 소스·대시보드·문서·고정 보고서·과거 영수증/파일 보존과 원본 grant 자동 부여0을 대조한다. | PASS. 13개 테이블 count/hash·파일11개 hash 불변. 과거 공유 영수증2건 보존·명시 회수 영수증2건만 추가. 두 관계 모두 회수됨. |

읽기 차단과 저장 관계의 active=false는 다르다. 현재 설계는 보고서의 고정 원 조직과 grant 당시 양쪽 epoch를 확인한다. 소유자가 다른 조직으로 이동해도 보고서 조직을 자동 변경하지 않는다. 이동 직후 control 보고서의 관계는 active=true로 남았으나 양쪽 조직의 reader는403이었다. 원 조직 복귀 후에도 공유 당시 epoch가 달라 재사용할 수 없었다.

**남은 운영 제약:** 소유자가 원 조직 밖에 있는 동안 보고서 관리와 명시 회수도403이다. 정보 유출은 관찰하지 않았지만, 다른 조직에서 회수까지 마칠 수 있는 기능은 없다. 안전한 후속 후보는 실제 이동 트랜잭션에서 보고서 공유 관계까지 명시 회수하는 방식이다. 현재 원 조직 경계를 완화하거나 새 조직의 관리자에게 보고서 관리권을 부여하지 않았다. 이를 전체 회수 UX 완료로 처리하지 않는다.

이번 이동은 합성 계정의 실제 보호 API로 수행했다. 브라우저는 이동 전후 보고서 접근·허브·공유 관리 영향을 검증했고, 이동 관리 화면 전체를 새로 검증한 것은 아니다. 모바일 제외, gpt-6-luna 설정 유지, VoiceOver BLOCKED 유지. 제품 AI 호출0·제품 코드 변경0이다. 기존 일반 공유·응답 유실 PASS는 재사용하고 반복하지 않았다.

## 실행과 증빙

전용 MySQL8.4.11/native DuckDB·Nest API4283/WEB3283/CONTROL4483, Ego98 실제1800×849에서 실행했다. 소유자id1·수신자id2·대조 수신자id5와 A admin3/B admin4의 합성 계정만 사용했다. 비밀값은 캡처·기록에 넣지 않았다.

실제 이동5회는 수신자 A→B→A→B, 소유자 A→B→A다. 마지막 수신자 이동은 양쪽이 같은 새 조직에 있어도 고정 원 조직의 보고서가 열리지 않는 별도 조건이다. 각 이동의 구 token401/새 epoch+1을 확인했다. 정상 허용된 다른 보고서의 대조 읽기1회는 소유자 이동 영향 분리를 위한 것이다. 기존 전체 테스트를 재실행하지 않았다.

보존 대상은 dashboard·dashboard_widget·user_mapping·metric·studio_state·studio_publication·enterprise_resource_grant·enterprise_dashboard_delivery·database·private_report·private_report_revision·private_report_chunk·private_report_request다. 이동 관련 계정·소속·감사는 정상 변경 대상으로 보존 hash에서 제외했다. 공유 관계·영수증은 별도 비교했다.

publication·resource grant·dashboard delivery는 baseline에서 각각0행이었다. 해당 비교는 새 게시/원본 권한/대시보드 전달이 생기지 않았음을 확인하며, 이미 활성인 별도 관계의 보존까지 증명하지 않는다.

- `case-lib.cjs`: 실제 이동 API 순서와 구 token 차단, 새로운 로그인/epoch 확인. 실행 상태의 private fixture를 재사용하므로 이동을 무조건 반복하지 않는다.
- `recipient-out-access.json`, `recipient-return-access.json`, `owner-out-access.json`, `owner-return-access.json`: 단계별 현재 권한·관계와 과거 영수증 구분.
- `combination-baseline.json`, `owner-out-observed.json`, `combination-after.json`, `verification-result.json`: 보존 및 확정 회수의 최종 비교.
- `requests.jsonl`: 비밀 없는 actor/method/path/status 관측. API 확인과 브라우저 관측을 합산 완료율로 쓰지 않는다.
- `browser-observations.json`, `captures.json`: 부모의 실제 로그인·Tab/Enter 실행과 캡처 시각 확인 기록. 별도 검토자는 JSON/API 증빙만 읽었으며 화면 조작을 재검증하지 않았다.
- 캡처 `01-recipient-moved-denied.png`, `02-recipient-return-suspended.png`, `03-recipient-return-revoked.png`, `04-owner-moved-reader-denied.png`, `04b-owner-moved-management-denied.png`, `05-owner-return-suspended.png`, `06-owner-return-revoked.png`.

초기 검증 도구의 잘못된 테이블명과 `/read` API 경로404는 제품 실패로 분류하지 않았다. 실제 API는 `/reader`다. 일부 브라우저 대기는 추정 문구로 시간 초과됐으나, 같은 쓰기를 반복하지 않고 현재 API·실제 화면을 조회해 이미 확정된 회수를 확인했다. 권한 재조회로 DOM이 교체되는 오류 화면은 고정 탐색 버튼에서 Tab으로 접근했다.

운영 DB·운영 마이그레이션·이동 도중 저장/공유 경합·다른 소유권 인계/탈퇴·실기기·전체 접근성/기업 수용은 이번 검증 범위가 아니다.

읽기 전용 독립 검토는 blocker0이었다. 종료 전 소유 자식 관측 ready=true/failed=false/groups0/checkErrors=[]를 확인하고, 인증된 CONTROL4483 stop200→supervisor exit0·cleanup 이벤트→전용 컨테이너 부재를 확인했다. 임시 인증정보·빌드 복사본·실행 스크립트를 제거하고 Ego98을 종료했다. 기존 실패 소유자 `22e26a713e001c3ea0a61ef7`에는 조작하지 않았다. `cleanup.json`·`final-review.md`에 범위를 기록했다.

증빙 루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-sharing-transfer-20261030`이다.
