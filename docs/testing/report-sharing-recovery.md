# 보고서 공유의 브라우저 응답 유실 복구

2026-10-29. 기준 develop `48cc5e04`. [기존 공유 검증](report-recipient-sharing.md)의 RSH-01~06·08은 재사용한다. 이 문서는 RSH-07의 남은 브라우저 조건만 검사한다.

| ID | 조건과 기대 결과 | 결과 |
|---|---|---|
| RSH-R01 | 서버 commit 뒤 공유 POST 응답을 브라우저에서 유실시킨다. 같은 탭에서 다시 열어 결과 GET과 현재 공유를 확인한다. 자동 POST는 0이며 원 UUID 영수증/관계는 1개다. | PASS. upstream201 뒤 응답 socket을 끊었다. reload→관리 열기에서 outcome/현재 상태 GET만 실행하고 원 UUID 영수증1·티켓 해제를 확인했다. |
| RSH-R02 | 전송 전 중단된 요청을 재열기한다. 결과 missing은 취소로 보지 않는다. 명시 재시도 취소는 초점/티켓을 유지하고 POST0, 별도 확정만 원 UUID·입력으로 한 번 저장한다. | PASS. 프록시가 미전송을 기록하고 DB 영수증0을 확인했다. reload missing→명시 재시도 취소의 초점·티켓 동일/POST0, 별도 확정 뒤 원 UUID·입력 일치/영수증1을 확인했다. |
| RSH-R03 | commit 영수증 뒤 현재 공유 GET 실패 때 티켓을 유지한다. 재열기/명시 결과 조회 후 현재 GET까지 성공해야 티켓을 해제한다. 자동 재전송은 없다. | PASS. 같은 회수 요청의 영수증 확인 뒤 현재 GET503을 주입했다. 현재 관계 비노출·티켓 유지, 명시 GET200 뒤 해제를 확인했다. |
| RSH-R04 | 회수 POST의 commit 후 응답 유실과 outcome GET 실패가 함께 발생해도 원 요청을 보존한다. 이후 결과 조회·현재 상태 확인에서 회수를 되살리지 않는다. | PASS. 회수 commit 후 응답 유실→reload outcome503에도 원 UUID·회수 상태가 보존됐다. 후속 GET만으로 확인했으며 자동 POST0·회수 영수증1이다. |

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-sharing-recovery-20261029`에 둔다. 원본 권한은 자동 부여하지 않는다. 요청 UUID·입력·관계·영수증과 원본 표 count/hash를 함께 확인하며 캡처만으로 저장 판정을 하지 않는다.

재열기는 같은 탭의 route 이동 또는 reload다. 탭·브라우저를 완전히 닫은 새 세션의 티켓 복구는 지원 범위가 아니다. 모바일 제외, 제품 AI 호출 없이 gpt-6-luna 유지, VoiceOver BLOCKED 유지.

## 실제 실행과 결과

실행 기준은 `48cc5e040776ce0fa56ec1f4cf276e93a8f4832e`다. drumcap으로 허브·공유 28파일을 먼저 push하고 origin/develop 0/0을 확인했다. 이전 증빙의 product26파일 hash는 일치했다. backend 실행 JS도 모두 일치했다. 총2056개 파일 중2054개는 동일하고, 달라진 두 파일은 tsbuildinfo와 주석 삭제에 따른 sourcemap이었다. 새로운 전체 빌드·PASS 기능 재실행으로 이를 대신하지 않았다.

격리 MySQL8.4.11·Nest API4281·WEB3281·CONTROL4481·보고서 전용 검증 프록시4282·Ego97의1800×849를 사용했다. 새 합성 계정과 표준37주문 보고서는 준비용이며 기존 숫자·원본 권한·일반 공유·모바일 케이스를 다시 판정하지 않았다. 제품 AI 호출을 실행하지 않았다는 운영자 관찰은0회이며, 독립 provider 사용량 계측값으로 주장하지 않는다. gpt-6-luna 설정은 그대로다.

`fault-proxy.cjs`는 이번 reportId의 shares 경로만 자체 API로 전달한다. commit 유실은 upstream의201 body 수신이 끝난 후 브라우저 socket을 닫는다. 미전송은 자체 API로 전달하기 전에 닫는다. 현재 GET503과 outcome GET503을 별도로 주입한다. 실제 인터넷 패킷 손실/운영 장애를 재현했다고 주장하지 않는다. 브라우저 XHR의 해당 QA 경로만 이 프록시로 바꿨으며 제품 코드를 위한 test hook은 추가하지 않았다. reload 뒤 관리 화면을 열기 전에 다시 적용했다.

최초 CDP 응답 차단은 적용되지 않아 정상 공유가 한 번 발생했다. 이 요청을 준비용 영수증1개로 분리하고 응답 유실 PASS로 세지 않았다. 프록시 적용 뒤 유실된 공유·미전송 재시도·유실된 회수 각각 UUID의 영수증은1개다. 재열기/취소/결과 조회·현재 재조회 단계의 자동POST는0이다. `verify-recovery.cjs`가 전송 기록과 실제 DB 영수증을 대조해 판정했다.

공유 및 복구 뒤 원본9개 표의 count/hash가 준비 직후와 같았다. 원본 Source/dashboard grant와 기업 전달 관계를 자동 생성하지 않았다. source 읽기/Studio403 전체 행렬은 기존 결과를 재사용하며 이번에 다시 실행하지 않았다. 새 매출 계산·수신자 전체 여정을 재검증한 것으로 확대하지 않는다.

## 발견한 오류와 수정

이전 요청의 성공 안내가 새 POST 또는 결과 조회 실패와 함께 남았다. 최초 `r01-lost-response.png`에 성공 문구와 실패 문구가 함께 보인다. 새 허용 요청이 시작될 때 해당 안내를 비우는 두 호출로 고쳤다. 새 UI 구조나 API 계약을 추가하지 않았다. 반대로 같은 요청의 영수증 성공 뒤 현재 GET 실패는 두 사실을 모두 표시한다.

새 회귀2개는 수정 전 실패하고 수정 후 통과했다. 영향받는 한 파일16개 조건이 PASS이며 typecheck와 대상 lint도 PASS다. FE production build도 PASS다. 관련 없는 기존 PASS 케이스는 재실행하지 않았다.

초기 `r04-revoke-loss.json`·`notice-fix-ui.json`은 요청 보관 UI가 먼저 그려진 중간 상태를 읽었다. 최종 판정은 이번 요청의 `원래 요청을 보관했습니다.` 문구를 기다린 `notice-fix-ui-settled.json`으로 교체한다. 수정된 화면에서는 이전 성공 문구가 없고, 요청은 유지되며 결과 GET으로 복구했다. 초기 증빙은 삭제하지 않는다.

## 캡처

- [유실 후 보관 상태와 초기 안내 오류](../../../phase2-evidence/report-sharing-recovery-20261029/r01-lost-response.png)
- [재열기 결과 확인](../../../phase2-evidence/report-sharing-recovery-20261029/r01-reopened-confirmed.png)
- [미전송 재열기의 missing 안내](../../../phase2-evidence/report-sharing-recovery-20261029/r02-reopened-missing.png)
- [원 요청 재시도 취소](../../../phase2-evidence/report-sharing-recovery-20261029/r02-retry-cancelled.png)
- [원 UUID 명시 확정](../../../phase2-evidence/report-sharing-recovery-20261029/r02-original-request-confirmed.png)
- [회수 결과 조회 실패·티켓 유지](../../../phase2-evidence/report-sharing-recovery-20261029/r04-outcome-failed-ticket-retained.png)
- [영수증 성공·현재 조회 실패](../../../phase2-evidence/report-sharing-recovery-20261029/r03-receipt-confirmed-current-read-failed.png)
- [현재 조회 성공 뒤 회수 확인](../../../phase2-evidence/report-sharing-recovery-20261029/r03-final-revoked-current-confirmed.png)
- [수정 후 유실 안내](../../../phase2-evidence/report-sharing-recovery-20261029/notice-fix-lost-response-after.png)
- [최종 결과 조회 복구](../../../phase2-evidence/report-sharing-recovery-20261029/final-recovered.png)

읽기·KPI·차트와 공유 관리의 기존 토큰·정렬을 유지했다. 새 안내 오류/복구 화면을 직접 보고 가로 넘침0을 확인했다. 전체 디자인·전체 키보드·다른 테마의 새 수용을 주장하지 않는다. 같은 탭 sessionStorage가 남은 동안만 복구하며 새 탭/브라우저 세션 복원은 범위 밖이다. 실제 조직 이동과 새 공유 조합도 RSH-07의 별도 미검증 조건으로 남긴다.

## 범위 한정 리뷰와 종료

GPT-6 Astra의 정적 코드·증빙 검토는 두 안내 초기화 호출에서 새 정확성/보안 오류를 찾지 않았다. 리뷰어는 서버/브라우저를 다시 실행하지 않았다. `oldSuccessCleared` boolean을 그대로 믿던 검증에는 실제 status 문자열 비어 있음과 이번 실패 문구를 직접 검사하도록 보강했다. 원본 전후9표 manifest도 offline으로 재대조했다. 이 결과는 `evidence-review.json`이다. 모델 호출0 표기는 운영자 관찰로 한정했다.

RSH-R02는 이미 공유 중인 같은 저장본의 재공유 미전송/재시도다. 관계 버전은 유지되고 새 UUID 영수증만 정확히1개 생겼다. 첫 공유 또는 미전송 회수에서의 실제 상태 전환 변형을 실행했다고 주장하지 않는다. 회수의 상태 전환은 RSH-R04에서 active1→0·관계 버전1→2로 확인했다.

Ego97과 자체 fault proxy를 정상 종료했다. CONTROL4481 health에서 그룹0·오류0을 확인한 뒤 stop200·supervisor exit0을 받았다. 자체 MySQL 컨테이너·임시 credential·빌드 복사본·검증 실행기를 정리했다. 기존 실패 owner `22e26a713e001c3ea0a61ef7`은 건드리지 않았다. `cleanup.json`에 기록했다.
