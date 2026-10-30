# 신규 보고서 공유 생성과 조직 이동 경합

2026-10-30. 기준 develop `68d96986`. [자동 회수 검증](report-transfer-revocation.md)에서 남은 신규 ReportDelivery INSERT 경합만 검증한다. 기존 관계 갱신의 경합과 취소/롤백 PASS는 재사용한다.

| ID | 신규 조건·기대 결과 | 결과 |
|---|---|---|
| RSH-N01 | 수신자 이동, 공유 선행. 관계/영수증0에서 UI 신규 POST 성공 뒤 이동이 relation v1→inactive/v2로 회수. | PASS. UI POST201과 이동201. 새 관계1건 inactive/v2·과거 share 영수증 v1 유지. 실제 복귀 뒤 reader403·회수됨 표시. |
| RSH-N02 | 수신자 이동, 이동 선행. 기다린 UI 신규 POST 거절·관계/영수증0. | PASS. 이동201 뒤 UI POST403·관계/영수증0. 결과만 조회는 완료 기록 없음 안내와 UUID 보관을 유지한다. 복귀 뒤에도 reader403. |
| RSH-N03 | 소유자 이동, 공유 선행. 관계/영수증0에서 UI 신규 POST 성공 뒤 이동이 relation v1→inactive/v2로 회수. | PASS. UI POST201과 이동201. 새 관계 inactive/v2·영수증 v1 유지. 원래 화면에서 발견한 본문 잔류는 RSH-N06으로 수정·재검증했다. |
| RSH-N04 | 소유자 이동, 이동 선행. 기다린 UI 신규 POST 거절·관계/영수증0. | PASS. 이동201 뒤 UI POST401·관계/영수증0. 실제 화면은 로그인으로 이동하고 본문이 없다. 소유자 복귀·재로그인 뒤 보고서는 열리고 공유는 없다. |
| RSH-N05 | 실제 User 잠금 대기와 UI POST/HTTP/DB 결과 연결, 재조회/수신 차단·원본·파일·과거 영수증 보존. | PASS_SELECTED_VARIANTS. 네 실행의 UI UUID·서로 다른 connection의 User PRIMARY RECORD wait·최종 DB가 일치한다. 원본13표·파일11개와 생성된 영수증2건을 보존했다. 활성 공유0·자동 원본 grant0. |
| RSH-N06 | 공유 POST 성공 뒤 공유 GET401/403. 본문을 숨기고 현재 보고서 권한을 재확인하며 UUID를 보존한다. 오래된 오류·일반 통신 실패는 불필요하게 전파하지 않는다. | FAIL→FIXED. 실제 N03에서 공유 오류 후 본문/KPI·차트 잔류를 재현했다. 관련 컴포넌트21 PASS와 실제 조직 이동 후 본문 비노출·로그인 전환을 확인했다. 아래 재검증 범위를 따른다. |

새 소유 MySQL8.4.11/Nest API4285/WEB3285/CONTROL4485를 사용한다. 이동 자체는 실제 본인 요청→대상 admin 수락→원 조직 다른 admin 확정 API로 실행한다. 공유는 실제 데스크톱 브라우저가 검색·수신자 선택·확정을 거쳐 생성한다. 네 변형은 각기 다른 보고서의 새 관계와 새 UUID를 사용한다.

## 경합 증명과 보존

Ego100의 실제 공유 확정은 네 번 모두 `expectedRelationVersion=0`이며 취소가 기본 초점이다. Tab으로 확정에 이동한 뒤 Enter로 요청한다. API가 UI 공유를 대신하지 않았다. `RSH-N01..04-browser-post.json`은 인증 헤더 없이 요청 UUID·입력·응답만 보존한다.

공유 선행 두 실행은 보고서 head를 별도 검증 connection으로 잠근다. 실제 공유가 User 잠금을 가진 채 head를 기다리고, 실제 이동이 같은 User를 기다리는 것을 확인한 뒤 장벽을 해제한다. 이동 선행 두 실행은 원 조직 행을 잠가 이동이 User를 보유하도록 한다. 실제 공유가 그 User를 기다리는 것을 관측한 뒤 해제한다. 고정 지연만으로 순서를 추정하지 않는다. 공유는 READ COMMITTED이며 이동은 기존 기본 격리와 locking current read를 사용한다.

`*-lock-proof.json`의 연결 ID와 `*-result.json`을 UI UUID에 연결했다. 전후 관계0·영수증0으로 시작했으므로 기존 활성 공유 재확인과 구별된다. 이동 실패·취소·기존 관계 경합과 과거 UUID replay PASS는 재사용했고 다시 실행하지 않았다.

`verify-final.cjs`가 `combination-baseline.json`과 `final-observation.json`을 대조했다. 대시보드·위젯·매핑·지표·Studio·소스·고정 보고서/본문/집계·저장 영수증의13표 count/hash와 업로드11파일 hash가 동일하다. 새 공유 관계2건은 모두 inactive/v2다. 새 공유 영수증2건은 당시 v1 결과와 payloadHash가 그대로다. 원본 grant·Studio 게시·대시보드 전달은 baseline0행을 유지하며 기존 활성 자료 전체의 보존으로 확대하지 않는다. 계정·소속·조직 버전과 이동 감사는 정상 변경 대상이다.

## 발견한 화면 오류와 수정

`ReportShares`는 peers/POST/outcome의 접근 실패를 부모에게 알렸지만 보호된 공유 GET 실패는 자기 오류만 표시했다. N03의 실제 POST201 뒤 공유 GET 인증 오류에서 이미 열린 본문/KPI·차트가 남았다. `RSH-N03-before-fix-ui.json`과 전 캡처에 남겼다.

`useProtectedReport`의 기존 현재 generation/scope/abort 판정 안에서 선택적 접근 실패 callback을 실행한다. `ReportShares`만 기존 부모 callback을 전달한다. 부모는 즉시 본문을 숨기고 현재 reader 권한을 다시 확인한다. 일반 네트워크 실패·오래된 응답은 부모에게 전파하지 않는다. 기존 UUID 보관과 성공한 공유 GET 뒤 영수증 확인/티켓 정리는 유지한다. 전역 인증 설정·서버 공유 로직·화면 스타일은 바꾸지 않았다.

새 두 회귀 변형은 수정 전 `2 failed | 16 skipped (18)`이었다. 실패 이유는 제목과 본문 잔류였다. 수정 후 관련 파일은21 PASS다. 공유 POST 성공 뒤 GET401/403 동안 reader 재확인이 대기하면 본문이 없고, GET403 뒤 reader200이면 복원된다. stale401/403과 일반 통신 실패, 정확한 티켓과 POST1회도 확인한다. 변경 hook의 허브 호출자 선택1 PASS/범위 밖51 SKIP와 FE type/lint/build를 확인했다. 기존 전체 E2E는 반복하지 않았다.

실제 MySQL 재검증은 소유자의 정상 이동 후 키보드로 공유 상태를 다시 읽었다. native 공유 GET401 뒤 기존 인증 갱신 처리가 로그인 화면으로 이동했으며 본문이 없었다. 이 캡처를 인페이지 만료 안내나 reader401 응답 증빙으로 바꾸어 해석하지 않는다. callback 자체의 deferred reader 조건은 컴포넌트 검사이며 실제 화면 재검증은 보호 본문 비노출을 증명한다. 결과는 `RSH-N03-ui-recheck-v2-result.json`에 구분했다.

## 화면 증빙과 범위

Ego100 데스크톱1800×849를 사용했다. 신규 공유 확정 네 번의 키보드 초점은 취소→Tab→확정이며 Enter로 실행했다. 확인한 정상·빈 관계·권한 거절·로그인 상태는 가로 넘침0px이다. 실제 캡처를 열어 버튼/입력 높이·정렬·문구 잘림을 확인했다.

대표 캡처는 `RSH-N01-new-share-revoked.png`, `RSH-N02-result-missing.png`, `RSH-N03-before-fix-expired-body.png`, `RSH-N03-after-fix-v2-expired-hidden.png`, `RSH-N04-return-no-share.png`, `RSH-N05-returned-recipient-denied.png`다. 마지막 캡처는 복귀 수신자의 실제 재로그인 열람 거절이다. API403과 함께 판단하며 캡처만으로 권한을 판정하지 않는다.

검증 도구의 추정 버튼/문구·미지원 selector와 로그인 페이지 전환 대기를 수정했다. 이미 확정한 이동/공유를 실패로 간주해 재전송하지 않았고, 현재 결과를 조회한 뒤 고유한 후속 검증으로 구분했다. 제품 실패는 RSH-N06 한 건이다.

독립 읽기 전용 최종 검토는 APPROVE이며 추가 결함0이다. 새 주석·억제 지시도0이다. 소유 CONTROL4485의 정상 관측·그룹0 확인 뒤 인증 stop200, supervisor exit0, 전용 컨테이너 부재와 임시 인증정보/빌드 복사본/실행 스크립트 제거를 확인했다. Ego100은 종료했다. 이전 실패 소유자 `22e26a713e001c3ea0a61ef7`은 조작하지 않았다. `cleanup.json`에 기록했다.

요청한 자동 회수6파일은 `68d96986`으로 drumcap이 develop에 먼저 commit/push했다. 이 문서와 후속 UI 수정·기록5파일은 다음 검토를 위한 미커밋 변경이다. 무관한 기존 변경은 반영하지 않았다.

모바일 제외, gpt-6-luna 설정 유지·AI 호출 없음, VoiceOver BLOCKED 유지. 증빙 루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-new-sharing-transfer-race-20261030`이다. 운영 migration·전체 경합/부하·실기기·전체 접근성 수용은 별도다.
