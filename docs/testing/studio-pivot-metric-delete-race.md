# Studio Pivot 복제와 실제 지표 삭제 경합

2026-10-19 · 기준 `011daf81` + 선택 회귀 · [선행 MySQL 증빙](studio-pivot-source-reuse-mysql.md).

## 범위와 사전 기대

이번 두 조건만 신규 실행한다. 기존7개 MySQL/SQLite·제품 UI 결과는 반복하지 않는다. 실제 MetricDeletionService와 DashboardReuseService, 독립 MySQL DataSource, 실제 DuckDB 워커를 사용한다. 원본2행500/대상2행1000의 경계 fixture이며 운영/Rill 대용량·HTTP/UI 수용을 뜻하지 않는다. gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다.

| ID | 신규 조건 | 기대 | 상태 |
|---|---|---|---|
| SPR-DELETE-01 | 사용하지 않는 대상 지표의 실제 삭제를 commit 직전 멈추고 기존 미리보기로 복제 실행 | 실제 User 잠금 대기→삭제 commit→복제409·추가 자산0·삭제 영수증1·원본 불변 | PASS_SELECTED |
| SPR-DELETE-02 | 혼합 복제의 실제 쓰기 완료/commit 전 멈추고 새 지표 삭제 실행 | 실제 User 잠금 대기→복제 commit→삭제409·새 Studio 참조1/활성 지표·삭제 영수증0·사본 Pivot1000/원본 불변 | PASS_SELECTED |

02의 삭제 요청 revision/ID는 미commit 트랜잭션 안에서 테스트가 읽어 구성한다. 공개 impact API가 미commit 지표를 노출한다고 가정하지 않는다. 이는 서버 경계의 결정적 경합 검증이며 사용자 UI 흐름 재현이 아니다. 실제 삭제 결과나 잠금 SQL은 대체하지 않는다. 01은 공개 impact 서비스의 삭제 가능/기준 응답으로 요청을 구성한다. 같은 소유자7의 공통 User 잠금이 먼저 작동하므로 Source 잠금 대기라고 잘못 보고하지 않는다.

소유 라벨/0600 설정·UUID·DB namespace·새 빈 DB 확인을 적용한다. loopback 임의 포트/CPU1/768MiB/임시 메모리 DB만 사용하고 종료 시 이번 컨테이너·인증 파일만 정리한다. 기존 Colima·전역 Docker context·제품 서버와 데이터는 유지한다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-metric-delete-race-20261019/`.

## 결과와 변경

최종 선택 실행은 **2 PASS / 4.944초**, 기존7개는 선택 제외 SKIP다. 초기 실행도 두 조건은 통과했으나, 테스트 gate의 실패 제한 타이머가 성공 후 남아 Jest 종료 경고가 발생했다. finally에서 타이머를 해제하도록 수정하고 이번 소유 DB만 UUID 확인 후 비운 뒤 같은 두 조건만 재검증했다. 최종 실행에는 종료 경고가 없다. 단계별2+2를4개 통과로 합산하지 않는다. ts-jest의 기존 TypeScript5.9 지원 범위 경고는 남으며 이번 타입/실행은 통과했다.

- 01: 실제 MetricDeletionService가 대상 미사용 지표를 비활성화하고 영수증1개를 commit했다. 기다리던 복제는 변경된 catalog를 재검사해409이며 지표 외 대시보드/위젯/dataset/배치/Studio/생성 영수증/개인 보기 내용 불변, 지표 추가0이다. 기존 지표 가운데 해당1개만 의도대로 비활성화됐다.
- 02: 실제 mixed 복제 transaction의 commit 전 새 지표를 대상으로 독립 DataSource의 삭제 서비스가 대기했다. commit 후 현재 사용처 검사로409(사용처가 남음), 새 지표 Y·Studio 참조1·삭제 영수증 추가0이다. 저장 사본을 다시 읽고 prepare하여 Pivot1000을 확인했다. 원본 문서도 불변이다. 미commit 정보는 테스트 내부에서만 읽었다.
- 두 순서 모두 `performance_schema.data_lock_waits`와 `data_locks`를 join해 **이번 DB의 user 테이블 대기**를 관찰한 뒤 gate를 해제했다. 임의 sleep만으로 경합을 통과 처리하지 않는다.

제품 코드 변경0. `backend-api/src/bi/studio-reuse.integration.spec.ts`에 삭제 서비스가 읽는4개 entity와 실제 경합 회귀2개·bounded gate/타이머 정리를 추가했다. BE type와 해당 파일 non-fixing lint PASS다. 제품 build/FE/UI/core는 관련 제품 diff가 없어 선행 증빙을 재사용했다.

최종 실제 DB 관찰은 dashboard3/metric4(원본 지표2·의도 삭제된 대상 지표1·활성 복사본 지표1)/StudioState3/creation receipt1/개인 보기2/**metric delete receipt1**이다. 두 beforeEach 원본과 성공 복제1개이며 실패 복제의 부분 자산이 남은 결과가 아니다.

## 증빙과 종료

- `results.json`, `run.log`: 최종 선택2개. `initial-results.json`/`initial-run.log`는 타이머 정리 전 기록이다.
- `identity.json`, `mysql-observation.json`, `summary.json`, `manifest.json`, `type.log`, `lint.log`, `cleanup.json`.
- `report.html`과 [실제 결과 리포트 캡처](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-metric-delete-race-20261019/report-1440.png)는 실제 Jest JSON 기반이며 **제품 UI 수용 증거가 아니다**.

Ego38에서1440×1060 리포트를 캡처하고 직접 열어 확인했다. 이번 소유 라벨 확인 후 컨테이너/메모리 DB·0600 인증 파일만 제거했다. 기존 Colima 프로필·전역 Docker context·제품 서버/소스/게시 링크는 유지한다. 최종 정리 결과는 cleanup.json을 따른다.

## 남은 조건

이번 두 순서의 서버 경계 경합만 PASS_SELECTED다. 공개 impact→사용자 확인→삭제의 실제 UI 경합, 서로 다른 요청 ID/actor의 복제 경합, 다른 모든 writer·운영 부하/마이그레이션·프로세스 간 ticket 분산은 별도다. 실휴대폰·VoiceOver·전체 P5/TC005/기업16개 수용으로 확대하지 않는다. 다음 우선 조건은 **같은 미리보기에서 서로 다른 requestId로 동시 복제**할 때 성공/거절·원자성과 각 영수증을 확인하는 것이다. 같은 requestId의 재시도는 이미 통과했으므로 반복하지 않는다.


## 서로 다른 요청 번호 후속

[다음 선택 증빙](studio-pivot-distinct-requests.md)에서 같은 소유자/target의 서로 다른 requestId 동시 복제1개를 검증했다. 한 요청 commit 뒤 다른 요청409/부분 자산0·명시 재미리보기/별도 저장을 확인했다. 위 다음 우선 조건의 해당 범위는 해소됐으며 실제 UI/다른 actor·target/운영 수용은 별도다.
