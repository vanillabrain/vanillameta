# 보고서 지정 수신자 공유 검증

2026-10-29. 기준 develop `dd3a7b16` 이후 작업 트리. [계획](../plans/report-recipient-sharing.md). 기존 [U1 저장 검증](private-sales-report.md)의 영향 밖 PASS는 재사용했다. 후속 커밋은 신규 허브·공유 구현과 이 기록을 함께 반영한다.

## 인수 결과

| ID | 새 인수 조건 | 결과와 실제 범위 |
|---|---|---|
| RSH-01 | 허브 목록·그리드에서 본인/받은 보고서를 구분하고 읽기 화면으로 연다. | PASS. Ego95 소유자 목록·그리드 전환과 수신자 목록→읽기. 보고서 항목에 대시보드 삭제·보관·Studio 동작이 없다. 그리드 포인터 전환 및 긴 제목 배치를 수정 후 확인했다. |
| RSH-02 | 수신자는 지정된 저장 버전의 본문·KPI·차트만 읽는다. | PASS. 실제 API r1 값 16,537.01 USD와 주별 추세·채널 5개를 확인했다. Ego95 수신자는 r2 본문·동일 KPI·차트와 편집 비노출을 확인했다. 엄격 응답의 재귀 필드 검사에서 원본 id·SQL·경로·전체 정의·private hash가 없다. |
| RSH-03 | 일반 직원 소유자가 같은 조직의 활성 직원을 선택한다. | PASS. 소유자는 member, 별도 admin이 조직 설정을 담당했다. 실제 직원 검색·선택·별도 확정과 본인/다른 조직/비활성 수신자 403을 확인했다. 검색은 id·userId·team만 투영한다. |
| RSH-04 | 공유가 원본 권한을 자동 부여하지 않는다. | PASS. 공유 후에도 수신자의 Source GET·Studio GET·소유자 private 보고서 GET·보고서 저장/공유 쓰기는 403이다. 일반 공유/회수/보고서 저장·거절 배치 후 원본 9개 표의 count/hash가 기준과 동일했다. |
| RSH-05 | 회수 후 목록·직접 GET·열린 화면 접근을 차단한다. 과거 UUID가 관계를 되살리지 않는다. | PASS. API 회수 후 목록 제외·reader 403, 과거 공유 replay 후 revoked 유지. Ego95 실제 다른 탭 전환 중 회수→복귀 후 본문 DOM 없음·canvas 0과 오류 안내. 소유자 UI의 별도 회수 확정 후 수신자 GET 403도 확인했다. |
| RSH-06 | 새 편집은 받은 고정 버전을 바꾸지 않고, 명시 최신본 공유만 변경한다. | PASS. 실제 API에서 r2 본문 저장 뒤 r1 수신자 응답 전체가 동일했다. stale head 409, 최신본 재공유 후 r2로 변경했다. UI 최신본 공유의 명시 확인도 실행했다. 새 수치로 교체한 별도 변형은 실행하지 않았다. |
| RSH-07 | 중복·stale·응답 실패·현재 epoch/조직·소스 상태와 과거 기록을 구분한다. | PARTIAL. 실제 API의 같은 UUID/변경 입력·관계 CAS·고정 epoch 및 소스/대시보드 비활성·MySQL 경합을 확인했다. 단위 테스트의 보관 티켓/결과 조회/지연 응답·계정 전환과 검색/POST/outcome 403 비노출은 PASS다. 실제 브라우저 응답 유실→reload→동일 UUID 복구는 [후속 RSH-R01~04](report-sharing-recovery.md)에서 PASS다. [실제 조직 이동 후속](report-sharing-transfer.md)의 소유자·수신자 이동/복귀 차단·비부활·원 조직의 명시 회수는 PASS다. 소유자가 원 조직 밖에 머무를 때의 관리·회수는403인 운영 제약으로 남는다. |
| RSH-08 | 데스크톱 키보드·정렬·긴 이름·입력창을 확인하고 캡처한다. | PASS, 선택 범위. Ego95 1800×849에서 검색 입력·Enter·별도 확인의 취소 기본 초점·Tab→확정·Escape 복귀를 확인했다. 새 주요 버튼 40px·검색 16px·가로 넘침 0. 기존 차트 데이터 보기 버튼은 32px이다. 보관 요청 재시도의 Escape는 단위 테스트만 확인했다. 전체 키보드/VoiceOver 수용으로 확대하지 않는다. |

## 실행 환경과 독립 검증

- 격리 MySQL 8.4.11, 전체 Nest HTTP, native DuckDB. API 4280·WEB 3280·CONTROL 4480과 전용 runtime 포인터를 사용했다. 신규 migration은 같은 자체 DB에 두 번 UP해 기존 보고서 저장소를 보존하고 두 전달/영수증 표를 확인했다. 운영 migration은 아니다.
- 실제 API 선택 배치 31 HTTP는 `api-results.json`이다. 별도 epoch/활성 상태 배치 26 HTTP는 `epoch-lifecycle.json`이다. 두 배치를 전체 시나리오 완료 수로 합산하지 않는다.
- `mysql-lock-conflict.json`은 실제 두 connection에서 Membership→User와 보고서 User→Membership 순서의 경합을 유도했다. 보고서 요청은 409, 다음 reader GET은 200이었다. 이 한 경계가 다른 모든 writer의 교착 방지를 증명하지 않는다.
- 선택 BE 5 suites/30 tests가 PASS다. FE 4 files의 고유 조건 75개를 확인했다. 그리드 썸네일 추가 뒤 링크 이름 회귀 1개가 생겨 같은 파일의 3개 조건을 수정 후 다시 PASS로 확인했다. 나머지 72개 조건은 마지막 영향 배치의 PASS를 재사용한다. 부모의 FE typecheck·대상 lint·production build도 PASS다. 로그를 증빙 폴더에 보존했다. 이전 28/41/51/72/87 등 겹친 배치를 합산하지 않는다. 잘못 시작한 루트 전체 테스트 명령은 즉시 중단했으며 결과로 사용하지 않았다.
- 제품 모델 호출은 0회다. gpt-6-luna 설정을 유지했다. 모바일은 제외하고 VoiceOver BLOCKED를 유지했다.

## 발견과 재검증

1. 고정 authVersion이 없는 요청을 DB 현재 epoch로 승격할 수 있는 경계를 차단했다. 새 서비스 진입과 잠금 후 현재 epoch를 검사한다. 누락 epoch 단위 테스트와 실제 계정 비활성→재활성 뒤 old token 401/fresh token reader 403을 구분해 검증했다.
2. 같은 세션의 재조회가 허브/공유 입력을 remount하고 로딩 안내가 도구 위치를 밀었다. 보호 경계와 일반 제어기를 분리하고 안내/공유 관리의 위치를 정리했다. 실제 포인터 입력·직원 검색·그리드 전환을 재검증했다. 보호 내용은 숨기고 실패/계정 변경 때 제거한다.
3. 그리드에 목록용 flex 행이 적용돼 제목 폭이 약 24.7px로 줄었다. 그리드만 세로 카드·중립 썸네일·전체 폭 링크로 고쳤다. 최종 링크 폭 328.7px/카드 폭 378.7px, 제목 2줄, 가로 넘침 0이다.
4. 취소 시 원래 버튼이 아직 disabled여서 초점이 body로 빠졌다. 렌더 후 초점을 복구한다. 실제 최신본 공유 Escape는 원래 BUTTON으로 돌아왔다. 보관 티켓 재시도의 별도 trigger도 같은 방식으로 보완하고 단위 테스트했다.
5. 공유 action의 403이 오류 문구만 바꾸던 경로를 독립 리뷰에서 찾았다. peers/POST/outcome의 세 단위 테스트를 먼저 실패시킨 뒤 현재 reader/공유를 무효화하도록 고쳤다. 실제 소스를 잠시 비활성화한 직원 검색에서도 본문·제목이 사라지고 현재 관리 조회는 회수용 비활성 상태를 표시했다. fixture는 finally로 복구했다. 401/404 분기도 구현했으나 해당 action의 실제 브라우저 변형은 실행하지 않았다.

## 보존과 한계

원본 9표 불변 증명은 일반 공유/편집/회수 배치 직후의 결과다. 뒤의 비활성 fixture는 소스/대시보드 상태를 자체 DB에서 직접 바꾸고 복구했으므로 해당 후속까지 hash 불변으로 주장하지 않는다. 계정 비활성/재활성은 실제 admin HTTP를 사용했다. 소스·대시보드 비활성은 전체 제품 lifecycle UI 검증이 아니다.

고정 epoch는 계정 비활성·조직 이동/탈퇴에 따른 회수와 연결된다. 현재 제품의 일반 로그인/로그아웃·비밀번호 변경이 모두 epoch를 증가시키는 것은 아니다. source/dashboard의 현재 소유 신원을 검사하지만, 다른 소유자에게 갔다가 되돌아온 모든 과거 custody 이력을 영구 차단하지는 않는다. 이 기능은 익명 게시·외부 링크 만료·이메일 발송·수신자 편집/복제·이력 선택 UI를 추가하지 않는다. 운영·전체 경합·실기기·전체 접근성 수용은 별도다.

## 증빙

루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/report-sharing-20261029`이다.

- [수신자 읽기 화면](../../../phase2-evidence/report-sharing-20261029/recipient-reader.png)
- [최종 본문·KPI·차트 전체 화면](../../../phase2-evidence/report-sharing-20261029/owner-reader-final-full.png)
- [최종 허브 그리드](../../../phase2-evidence/report-sharing-20261029/hub-grid-design-after.png)
- [공유 확정 키보드](../../../phase2-evidence/report-sharing-20261029/share-confirm-keyboard.png)·[소유자 공유 상태](../../../phase2-evidence/report-sharing-20261029/owner-shared.png)
- [열린 수신자 화면 회수](../../../phase2-evidence/report-sharing-20261029/recipient-revoked.png)·[소유자 UI 회수](../../../phase2-evidence/report-sharing-20261029/owner-revoked.png)
- [action 권한 재검사](../../../phase2-evidence/report-sharing-20261029/owner-permission-rechecked.png)

초기 `keyboard-consent.json`·`ui-revoke-result.json`의 Escape 초점 실패는 보존한다. 수정 후 `keyboard-cancel-fixed.json`과 새 단위 테스트가 이를 대체한다. 초기 그리드 실패 캡처도 성공으로 재분류하지 않는다.

## 종료

Ego95는 `finish({keep:[]})`로 종료했다. 이번 CONTROL 4480의 정상 health에서 추적 그룹 0·오류 0을 확인하고 `/stop` 200과 supervisor exit 0을 받았다. 자체 MySQL 컨테이너·runtime 임시 인증정보·별도 테스트 credential 파일·두 빌드 복사본·임시 실행기를 정리했다. `cleanup.json`에 기록했다. 기존 실패 owner `22e26a713e001c3ea0a61ef7`은 건드리지 않았다.
