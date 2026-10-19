# Studio Pivot 소스 복제 — 격리 MySQL 후속

2026-10-19 · [기능/선행 UI 증빙](studio-pivot-source-reuse.md) · [계획](../superpowers/plans/2026-10-19-studio-pivot-source-reuse.md). 기준 `8e1d89a7` + 테스트 회귀 변경. 제품 코드는 `1b6554f0` 이후 불변이다.

## 차단 해소와 실행 경계

기본 Docker 컨텍스트 `desktop-linux`의 서버에 접속하지 못했던 이전 BLOCKED와 구별한다. 이번에는 기존 **vanillameta-verify Colima가 실행 중**임을 확인하고 해당 소켓만 명시했다. 전역 Docker 컨텍스트·기존 VM/컨테이너·제품 API/SQLite·기존 샘플/게시 링크는 변경하지 않았다. 캐시된 mysql:8.4 이미지로 이번 소유 라벨의 임시 컨테이너를 만들었으며 실제 버전은 **8.4.11**이었다. loopback 임의 포트·CPU1/메모리768MiB 제한·임시 메모리 볼륨을 사용했다.

24자리 소유 식별자·DB namespace·0600 설정·실제 server UUID/버전/DB를 확인한 뒤에만 synchronize한다. 테스트는 새로운 빈 DB만 허용하도록 보완했다. 소유 확인된 이번 DB의 재초기화 외 다른 DB를 초기화하지 않았다. 인증값은 로그/커밋에 출력하지 않았다.

기존 `studio-reuse.mysql.spec.ts`의 실제 서비스 통합을 사용했다. MySQL은 metadata, 실제 DuckDB 워커는 파일/집계에 사용한다. 원본500/대상1000의 **각2행 경계 fixture**, 일반 차트2+집계 Pivot1이며 Rill18/36행이나 운영 대용량 검증으로 확대하지 않는다. 실제 SQL/transaction/잠금을 실행했지만 새 HTTP E2E나 제품 UI 재검증은 아니다. 직전390/768/1440 제품 UI 증거를 재사용한다. 제품 AI 호출 없이 gpt-6-luna·VoiceOver BLOCKED를 유지했다.

## 선택 MD 결과

| ID | 신규 실행 조건 | 결과/확인한 범위 |
|---|---|---|
| SPR-MYSQL-01 | 혼합 미리보기→저장→재조회/같은 영수증 | PASS_SELECTED. 미리보기 metadata 내용 불변, 대상1000·3블록, 새 dashboard/block ID·지표1개, 같은 요청/만료 ticket 영수증으로 추가 생성0, 소스 비활성 뒤 영수증 접근 거절. |
| SPR-MYSQL-02 | 지표 삽입 뒤 저장 강제 실패 | PASS_SELECTED. 실제 MySQL BEFORE INSERT trigger의 SIGNAL 오류 후 지표·대시보드·위젯·dataset·StudioState·영수증/보기 전체 내용 rollback. |
| SPR-MYSQL-03 | 대상 catalog·인증 epoch 변경 | PASS_SELECTED. 각각 별도 회귀로 저장 전 거절/자산 추가0. 운영의 모든 권한 변경 변형을 뜻하지 않는다. |
| SPR-MYSQL-04 | 별도 연결의 Source 잠금/비활성 commit과 복제 경합 | PASS_SELECTED. performance_schema.data_lock_waits에서 실제 대기 관찰→외부 commit→대기하던 복제의 현재 비활성 재검사/거절, 추가 자산0. |
| SPR-MYSQL-05 | 두 독립 DataSource가 같은 요청을 동시에 저장 | PASS_SELECTED. 두 연결에 같은 캡처 계획을 둔 후 User 잠금 barrier에서 InnoDB 대기≥2를 관찰. 해제 후 한 결과는 replayed=false, 다른 결과는 replayed=true/동일 dashboard ID. dashboard/metric/creation receipt 각각+1, 개인 보기 불변. 새 사본 재조회3블록. |
| SPR-MYSQL-06 | 공통 필터 열 연결 보존 | PASS_SELECTED. 혼합 문서의 공통 category 필터가 남긴 각 차트의 필수 연결 열에 포함됨. 실제 UI 필터 조합 전체의 신규 통과가 아니다. |

최초 실행은6개/7.17초 PASS, 새 동일 요청 경쟁 조건만 선택한 후속은1개/3.77초 PASS(나머지6개는 선택 제외 SKIP)다. **고유7개 통과이며 기존 SQLite/단계별 횟수와 합산하지 않는다.** 최초 실행의 suite 제목에 SQLite가 남아 있었지만 연결은 UUID로 확인한 실제 MySQL이다. 현재 제목을 실제 선택 backend에 맞춰 수정했다.

추가 조건의 첫 실행은 앞선 DB의 Component fixture가 남아 중복 seed로 setup 실패했다. 이는 제품 저장 경합 실패나 통과가 아니다. 새 빈 DB 확인을 추가하고, 소유자/UUID가 일치하는 이번 DB만 비운 뒤 **추가1개만** 재실행했다. 이미 통과한6개는 반복하지 않았다.

추가 실행 뒤 실제 MySQL 읽기에서도 dashboard2/metric2/StudioState2/**creation receipt1**/개인 보기1을 확인했다. 원본/사본은 각각 source1/2와 같은3종 블록을 가진다. 영수증2개나 두 복사본이 생성된 결과가 아니다.

## 변경과 증빙

제품 동작 변경0. 테스트 파일 `backend-api/src/bi/studio-reuse.integration.spec.ts`에 실제 backend 제목·빈 DB 안전 확인·두 연결 동일 저장 회귀만 추가했다. 해당 파일 non-fixing lint와 BE type이 통과했다. 제품 빌드/FE/기존 core는 소스 변경이 없으므로 직전 통과 결과를 재사용했다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-mysql-20261019/`.

- `initial-results.json`/`initial-run.log`: 실제 MySQL 최초6개.
- `writers-results.json`/`writers-run.log`: 기존 fixture setup 실패 진단, 성공 증거 아님.
- `writers-fresh-results.json`/`writers-fresh-run.log`: 빈 DB의 추가 동시 저장1개.
- `mysql-observation.json`, `summary.json`, `cleanup.json`, `type.log`, `lint.log`.
- `report.html`, [실제 결과 리포트 캡처](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-mysql-20261019/mysql-report-final-1440.png): 실제 Jest JSON으로 만든 리포트이며 **제품 UI 화면 수용 증거가 아니다**. Ego37에서 실제 렌더링/캡처·직접 확인했다.

소유 라벨을 다시 확인한 뒤 이번 컨테이너/메모리 DB와 임시 인증 파일만 정리했다. 기존 Colima 두 프로필과 전역 컨텍스트는 유지했다. 테스트 코드/MD는 로컬 작업이며 push/merge 요청을 추정하지 않는다.

## 남은 범위

이 후속은 기존의 **실제 MySQL 미실행**을 위7개 조건에 한해 해소한다. 실제 MetricDeletionService와 복제의 직접 경합·모든 metadata writer/운영 부하/마이그레이션·서로 다른 프로세스의 ticket 배포·다른 요청 ID의 저장 경합은 별도다. 같은 계획을 두 DataSource에 놓은 검증을 운영 ticket 분산 기능으로 보고하지 않는다. 실휴대폰·native 화살표만의 전체 선택·VoiceOver·Rill36행 신규 비교·전체 P5/TC005/기업16개 요건 수용은 Open이다.
