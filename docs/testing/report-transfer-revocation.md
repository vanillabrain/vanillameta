# 조직 이동 완료 시 보고서 공유 자동 회수

2026-10-30. 기준 develop `fa96628e`. [조직 이동 조합](report-sharing-transfer.md)에서 남은 원 조직 밖 소유자의 공유 회수 제약을 보완하는 인수 조건이다. 고정 보고서의 조직/원본 소유권 경계는 유지하며, 성공한 이동 트랜잭션이 이동 사용자의 활성 발신·수신 공유 관계를 회수한다.

| ID | 새 입력과 기대 결과 | 결과 |
|---|---|---|
| RSH-A01 | 활성 수신·발신 보고서 공유가 모두 있는 직원의 이동 완료. 해당 관계만 active=false·relationVersion+1. | PASS. 실제 수신자id2의 수신·발신2관계가 false/version2. SQLite 및 별도 MySQL 선택 검사도 양쪽 역할/다른 조직 관계를 포함한다. |
| RSH-A02 | 여러 보고서를 공유한 소유자의 이동 완료. 모든 해당 활성 관계를 회수하고 기존 inactive/다른 사용자 관계를 보존한다. | PASS. 소유자id1의 두 보고서 발신2건·다른 보고서 수신1건을 회수. 이미 회수된 행은 반복 이동에도 version2 유지. 무관한1건은 active/version1·현재 수신자 열람200 유지. |
| RSH-A03 | 이동 취소·현재 기준 충돌·회수 뒤 transaction 실패. 공유·소속·epoch·보고서·과거 영수증은 기존 상태다. | PASS. 실제 HTTP 취소·완료409와 MySQL 감사 INSERT trigger의 후기500에서 계정/소속/조직 버전/공유/영수증 hash 불변. trigger는 해당 검증 뒤 제거했다. 캡처01. |
| RSH-A04 | 실제 복귀·과거 공유 UUID·stale CAS·완료 재시도. 공유 자동 복원과 관계 버전 이중 증가가 없다. | PASS. 두 사용자의 실제 복귀 뒤 과거 UUID는 역사만 반환한다. 새 UUID/구 관계 CAS409·완료 재시도409. reader403·회수된 관계 version2 불변. 캡처03·04. |
| RSH-A05 | 실제 MySQL에서 share-first와 transfer-first의 두 순서. 서로 다른 connection의 공통 User 잠금 대기를 관측하고 최종 활성 공유0을 확인한다. | PASS_SELECTED_VARIANTS. 공유 선행은15→19 User2 대기 뒤 공유201/이동201, 이동 선행은19→23 User1 대기 뒤 이동201/공유401. 해당 사용자의 최종 활성 공유0. 아래 실행 범위·도구 복구 기록 참조. |
| RSH-A06 | 실제 데스크톱 브라우저에서 받은 보고서 차단·복귀 후 회수됨 표시·키보드와 캡처. 원본·고정 보고서·파일·역사 보존과 새 원본 권한0. | PASS. Ego99 1800×849·캡처4장 직접 확인. 공유 관리 Enter·Tab으로 상태 다시 읽기·Enter 뒤 회수됨 유지. 넘침0px. 13표·파일23개·기존 영수증6건 보존, 새 원본 grant0. |

자동 회수는 기존 공유 영수증을 다시 쓰거나 수동 회수 UUID를 합성하지 않는다. 동일 이동의 감사와 관계 버전이 원자적으로 확정되며, 이미 회수된 행은 다시 증가하지 않는다. 활성 관계의 버전이 정수 한도를 넘으면 이동 전체를 거절한다. 실제 이동 관리 UI 전체와 기존 일반 공유·응답 유실 PASS는 반복하지 않는다.

모바일 제외, gpt-6-luna 유지·AI 호출 불필요, VoiceOver BLOCKED 유지. 증빙 루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-transfer-revocation-20261030`이다. 검증 런타임은 기존 환경과 분리된 API4284/WEB3284/CONTROL4484의 새 MySQL8.4.11이다. 운영 DB와 기존 보존 실패 런타임은 변경하지 않는다.

## 구현과 선택 검사

`reports/report-delivery-transfer.ts`는 현재 manager의 활성 transaction을 요구한다. 현재 User 잠금을 취한 `StaffTransferService.complete`가 호출한다. 활성 owner/recipient 관계의 버전1..2147483646만 회수하며, MySQL에서는 잘못된 버전을 locking current read로 검사한다. 이미 inactive인 최대 버전 행은 검사/변경 대상이 아니다. ReportSharingService의 READ COMMITTED·User 잠금·역사 영수증 반환은 변경하지 않았다. 새 API·서비스 주입·스키마·교차 조직 관리권은 추가하지 않았다.

초기 제품 코드에서 새 선택 검사4개가 실패하고3개가 통과했다. 구현 후 관련 SQLite 두 파일은42 PASS/기존 MySQL 전용3 SKIP다. 별도 소유 MySQL 스키마에서 새 회수·경계·후기 롤백8개 PASS/필터 밖24 SKIP다. 두 배치는 겹치므로 고유50개 통과로 합산하지 않는다. Node24 backend build의 타입 검사와 변경3파일 lint도 통과했다.

```sh
cd backend-api
npm test -- --runInBand --runTestsByPath src/enterprise/staff-transfer.spec.ts src/reports/report-sharing.service.spec.ts
npm run build
./node_modules/.bin/eslint src/reports/report-delivery-transfer.ts src/enterprise/staff-transfer.service.ts src/enterprise/staff-transfer.spec.ts
```

실제 MySQL 선택 검사는 기존 `semanticMetadata`의 새 소유 스키마/marker/server UUID 검증을 사용했다. 인증정보는 private 임시 파일로만 넘겼다. `mysql-current-read.cjs`는 별도 staff 스키마의 helper 전용 검사다. REPEATABLE READ의 오래된 inactive/max-1 snapshot과 다른 fixture connection이 확정한 active/max를 구분해409를 확인했다. 이 fixture SQL writer 검사를 실제 HTTP 공유 경합으로 계산하지 않는다.

## 실제 경합과 복구 범위

HTTP 전체 앱은 합성 사용자5명·보고서4개·활성 공유6건으로 준비했다. 수신자 이동은 발신·수신 관계를 함께 가진id2, 소유자 이동은 다중 보고서와 다른 소유자의 수신 관계를 가진id1이다. `performance_schema.data_lock_waits`의 RECORD/PRIMARY·moving User 번호와 양쪽 CONNECTION_ID를 기록했다. 고정 지연 시간만으로 경합 통과를 추정하지 않았다.

공유 선행은 검증 connection20이 보고서 head를 잠그고 공유 connection15를 기다리게 한 뒤, 이동 connection19가 User2를 기다리는 것을 확인했다. head 잠금을 해제하면 공유가 먼저 확정되고 이동이 그 활성 관계를 회수했다. 이 공유는 이미 활성인 같은 버전의 공유 재확인이다. 신규 관계 삽입의 선행 경합까지 증명하지 않는다.

이동 선행은 검증 connection27이 원 조직 행을 잠그고 이동 connection19를 기다리게 한 뒤, 공유 connection23이 User1을 기다리는 것을 확인했다. 해제 후 이동은201, 공유는 무효 epoch로401이며 새 공유 영수증0이었다. 해당 실행은 이미 회수된 행을 다시 바꾸지 않는 조건도 확인했다.

최초 이동 선행 실행에서는 도구가403만 예상해 실제401 거절을 실패로 판정했다. 이동은 이미 확정됐으므로 즉시 재전송하지 않았다. 현재 소속·epoch·회수된3관계를 조회/재로그인으로 조정한 뒤 원 조직으로 정상 복귀했다. 연결 ID가 저장되지 않은 관측만 새 동의 요청으로 보완했고, 거절 허용값401/403과 잠금 증빙을 commit 전에 기록하도록 도구를 수정했다. 최초 확정 결과는 `transfer-first-reconciled.json`, 최종 잠금 증빙은 `transfer-first-lock-proof.json`이다. 제품 실패로 분류하지 않았다.

원본 대조는 `combination-baseline.json`과 `combination-after.json`의13표 count/hash·파일23개 hash·고정 report pins/epochs/신원을 비교했다. 기존 공유 영수증6건은 동일하고, 공유 선행의 새 공유 영수증1건만 추가됐다. 자동 회수 영수증은 새로 만들지 않았다. 게시·원본 grant·대시보드 전달은 baseline0행으로 새 관계0만 증명한다. 이동 계정/소속·조직 버전·이동 감사는 정상 변경 대상이다.

대표 증빙은 `failed-and-cancelled.json`, `share-first.json`, `transfer-first.json`, 두 `*-return-replay.json`, `verification-result.json`, `mysql-selected.log`, `mysql-current-read.json`, `captures.json`이다. 화면 캡처는01 취소/실패 뒤 보존,02 이동 후 수신 거절,03 수신자 복귀 후 회수됨,04 소유자 복귀 후 모든 공유 회수됨이다.

이 문서의 최초 실행은 신규 관계 생성 경합까지 검증하지 않았다. [신규 공유 후속](report-new-sharing-transfer-race.md)은 별도 MySQL과 실제 UI POST로 소유자·수신자 각각 두 순서를 확인한다. 모든 역할별 경합 조합·동시 이동 두 건·부하 성능·운영 migration·실기기·전체 접근성은 별도다. 기존 일반 공유와 응답 유실 시나리오 전체를 반복하지 않았다. 원 조직 밖의 보고서 read/관리403 경계는 그대로이며, 이동 완료 시 활성 관계를 미리 회수해 복귀 후 별도 수동 회수가 필요 없도록 바꿨다.

독립 읽기 전용 최종 검토는 APPROVE/blocker0이다. 댓글 검토는 MySQL 현재 읽기 근거가 있는 새 주석1개를 유지했고 억제 지시를 추가하지 않았다. 소유 CONTROL4484의 ready/failed=false/groups0/checkErrors=[] 확인 후 인증 stop200·supervisor exit0·cleanup 이벤트·전용 컨테이너 부재를 확인했다. 두 임시 인증정보와 빌드 복사본/실행 스크립트를 제거하고 Ego99를 종료했다. 보존 중인 구버전 실패 소유자에는 조작하지 않았다. `final-review.md`·`cleanup.json`에 확정 범위를 기록했다.
