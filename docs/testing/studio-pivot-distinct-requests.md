# Studio Pivot 복제 — 서로 다른 요청의 동시 저장

2026-10-19 · 기준 `d124824c` + 선택 회귀 · [선행 MySQL](studio-pivot-source-reuse-mysql.md) · [지표 삭제 경합](studio-pivot-metric-delete-race.md).

## 신규 MD 조건

| ID | 입력/실행 | 기대 | 상태 |
|---|---|---|---|
| SPR-REQUEST-01 | 같은 캡처 미리보기·같은 소유자·독립 두 DataSource·서로 다른 requestId로 동시 복제 | 실제 이번 DB User 대기2개 관찰→해제→1개 저장/1개409·실패 요청 영수증/부분 자산0. 기존 원본·지표·개인 보기 불변. 묵은 ticket 재시도는 쓰기0. 명시 재미리보기는 읽기만 수행하고 실패했던 requestId로 새 기준 저장 시 별도 사본/지표/영수증1개. 각 준비 시점 Pivot1000 | PASS_SELECTED |

혼합 저장은 새 대상 지표를 만들어 catalog를 변경하므로 첫 commit 뒤 다른 요청은 과거 기준을 자동 수락하지 않는다. 같은 requestId의 영수증 재시도와 구별한다. 두 서비스에 동일한 캡처 계획을 놓아 transaction 경계를 검증하며 운영 프로세스의 ticket 배포를 구현했다고 주장하지 않는다. 후속 재미리보기/저장은 테스트의 명시 호출이며 제품 UI 클릭이나 자동 재시도가 아니다.

기존9개 MySQL 조건·제품 UI/SQLite는 반복하지 않는다. 실제 MySQL8.4.x/DuckDB와 각2행의 원본500/대상1000을 사용한다. Rill 대용량이나 운영 부하 수용이 아니다. 소유 라벨·0600 설정·UUID·새 빈 DB·loopback·CPU1/768MiB/임시 메모리 DB 경계를 적용한다. 이번 자원만 정리하며 제품 서버·데이터·기존 Colima·전역 Docker context는 변경하지 않는다. gpt-6-luna/VoiceOver BLOCKED 유지·LLM 호출 없음이다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-distinct-requests-20261019/`.


## 실행 결과

신규1개 **PASS / 4.277초**이며 기존9개는 선택 제외 SKIP다. 최초에도1개 통과했지만 대기 행은 InnoDB의 여러 blocking edge로 중복될 수 있어, `COUNT(DISTINCT REQUESTING_ENGINE_TRANSACTION_ID)`로 관찰을 강화하고 이번 소유/UUID DB만 초기화한 뒤 변경한1개만 재실행했다. 최종 실제 **User 대기 트랜잭션2개**를 확인했다. 두 실행을 고유2개로 합산하지 않는다.

1. 첫 동시 실행은 저장1개/replayed=false, 다른 요청409다. 실패 요청 영수증0이며 성공 요청 영수증은 실제 생성 dashboard ID를 가리킨다.
2. 성공분만 Metric1/Dashboard1/Widget2/Dataset2/DashboardWidget2/StudioState1/생성 영수증1이 증가한다. 기존 자산 내용과 PersonalView는 불변이다. 저장 사본의 Pivot 준비 결과1000을 확인했다.
3. 거절된 같은 ticket/requestId 재시도는409/metadata 내용 불변이다.
4. 명시 새 미리보기는 쓰기0이며 새로운 ticket을 반환한다. 영수증이 없었던 실패 requestId로 새 ticket을 저장하면 별도 비공개 사본/지표/블록 ID와 해당 요청 영수증1개가 생성된다. 이 사본의 준비 결과1000과 원본 문서 불변을 확인했다.

두1000은 각각 준비한 시점의 결과다. 후속 저장은 다시 대상 catalog를 바꾸므로 이전 사본이 그 뒤에도 재미리보기 없이 실행된다고 주장하지 않는다. 서버 서비스의 명시 호출 결과이며 모바일/키보드 UI를 수행한 증거는 아니다.

최종 MySQL 직접 관찰은 dashboard3(원본1+사본2)/metric3(원본1+신규2)/widget8/dataset8/StudioState3/**creation receipt2**/PersonalView1/삭제 영수증0이다. widget/dataset의 원본 fixture 기존4개를 신규 복제 찌꺼기로 세지 않는다. 실패 후 부분 저장은 별도 전후 내용·증가량 단언으로 배제했다.

제품 코드 변경0. `backend-api/src/bi/studio-reuse.integration.spec.ts`에 신규 경합/명시 복구 회귀1개만 추가했다. 최종 BE type·해당 파일 non-fixing lint PASS다. 기존 ts-jest/TypeScript5.9 지원 범위 경고는 남지만 실행/타입은 통과했다. 제품 build/FE/UI/기존 core는 제품 diff가 없어 기존 결과를 재사용했다.

## 증빙

- `results.json`/`run.log`: 최종1개, `initial-results.json`/`initial-run.log`: DISTINCT 단언 보강 전 기록.
- `identity.json`, `mysql-observation.json`, `summary.json`, `manifest.json`, `type.log`, `lint.log`, `cleanup.json`.
- `report.html`, [리포트 캡처](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-distinct-requests-20261019/report-1440.png): 실제 Jest 결과를 렌더링한 보고서이며 **제품 UI 수용 증거가 아니다**.

Ego39에서1440×1060 리포트를 캡처하고 직접 열어 확인했다. 이번 컨테이너·메모리 DB·0600 인증 파일만 소유 확인 후 정리했다. 전역 Docker context/기존 Colima/제품 서버·소스·게시 링크는 변경하지 않는다. cleanup.json에 실제 정리 상태를 기록한다.

## 잔여 범위

같은 소유자·같은 target·서로 다른 requestId의 서버 경계 한 조건만 통과했다. 실제 사용자 화면에서 새 기준 재검토/동시 클릭, 다른 actor/다른 target/모든 writer·운영 부하·프로세스 간 ticket 배포·실휴대폰/VoiceOver와 전체 P5/TC005/기업16개 수용은 별도다. 이를 끝없는 합성 장애 조합으로 확대하지 않고 다음 제품 작업은 남은 실제 사용자 여정/업무 파일럿을 우선 선택한다.
