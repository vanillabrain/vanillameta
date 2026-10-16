# STUDIO-MYSQL02 운영 마이그레이션·두 서버 쓰기 경합

2026-10-16. 기존 MYSQL01 통과 결과는 재사용한다. 선택 검증: 운영 모드 `synchronize=false`, 기존 메타데이터 복사본과 별도 MySQL 스키마, 독립 Node 두 개. 운영 서버에는 접근하지 않는다.

| 조건 | 입력과 기대 결과 | 상태 |
|---|---|---|
| MYSQL02-A | 기존 날짜·토큰·저장 문서 유지, 명시 마이그레이션으로 TEXT/날짜 정밀도 변경, 재실행 추가 변경0 | PASS_SELECTED |
| MYSQL02-B | 같은 revision 서로 다른 저장: 성공1/409 1, 승자 정의/배치 보존 | PASS_SELECTED |
| MYSQL02-C | 두 서버 동시 비공개 게시: 활성 링크1, 같은 token의 연속 version, 영수증별1건 | 수정 후 PASS_SELECTED |
| MYSQL02-D | 두 서버 같은 requestId: 동일 결과/추가 쓰기0, 다른 본문409 | PASS_SELECTED |
| MYSQL02-E | 재기동·실제 화면에서 승자 제목/정확한 Rill 집계 조회 | PASS_SELECTED |

기능·트랜잭션/영수증 증거와 UI 증거는 구분한다. 공개 링크는 만들지 않는다. 기존 MySQL01 앱·SQLite·DuckDB 파일과 Colima samba는 유지한다. gpt-6-luna 설정 유지/모델 호출0, VoiceOver BLOCKED.

## 기준·최초 실패·최소 수정

이전 MYSQL01의 날짜/토큰 수정·검증은 `953111c2`로 커밋했다. 원격의 UC033/034 변경을 보존해 `73636cbf`로 병합하고 develop-v2에 drumcap push했다. 병합 후 BE build/FE type PASS. 이번 검증에서 모델 요청은 만들지 않았다.

- **마이그레이션 최초 FAIL:** 기존 마이그레이션18개가 성공해도 기존 refreshToken=varchar255, 날짜 precision0은 그대로였다. 긴 토큰 insert가 ER_DATA_TOO_LONG을 반환했다. 엔티티 synchronize에 의존하지 않는 `FixMysqlAuthColumns1792130000000`을 추가했다. TEXT 변환은 열 삭제/재생성을 피하는 MySQL MODIFY를 사용하고 기존 날짜는 precision6/정확한 기본값으로 바꾼다. `down`은 토큰 축소/데이터 손실을 막기 위해 백업 검토를 요구하며 거절한다.
- CLI의 NODE_ENV=dev 강제 지정을 제거하고 CLI DataSource의 synchronize를 항상 false로 바꿨다. 실제 앱의 local/dev synchronize 정책과 운영(prod) false는 바꾸지 않았다. 운영 앱은 자동 마이그레이션을 하지 않으므로 배포 전 별도 CLI 단계가 필요하다.
- **다중 서버 최초 FAIL:** 동일 MySQL/읽기 전용 DuckDB를 쓰는 별도 Node 두 개에 동시 저장을 보내면201/409로 보호됐으나, 동시 게시 두 요청이 서로 다른 token의 version1을 각각 만들었다. 프로세스별 큐만으로 최초 게시의 부재 행을 보호하지 못했다.
- Studio 저장/게시 snapshot 트랜잭션이 MySQL/MariaDB에서는 기존 dashboard 행을 `pessimistic_write`로 먼저 잠그도록 했다. SQLite의 큐/기존 CAS는 유지한다. 게시 실행기의 token/version 기준 확인을 snapshot의 같은 DB 잠금 안으로 옮기고, 집계 도중 다른 서버에서 완료된 동일 requestId 영수증도 그 안에서 다시 읽는다. HTTP 계약·의존성은 변경하지 않았다. 기존 잘못 생성된 게시본을 자동 병합하는 데이터 수리는 추가하지 않았다.

준비 오류는 제품 오류와 구분한다. 신규 스키마 권한은 처음부터 광범위하게 주지 않고 전용 컨테이너의 root로 정확한 검증 스키마에만 부여했다. dev 복사본의 암호화 설정이 prod의 기본 환경 파일과 달라 발생한 복호화 실패는 같은 로컬 CONFIG_SECRET_KEY를 명시해 해결했다(키 출력/추적0). 최초 단일 열 테스트 fixture의 TypeORM ALTER 실패·임시 경로/module 오류도 별도 준비 오류다. 토큰 보존 최종 회귀는 실제 id 열이 있는 형태와 새 복사본에서 확인했다.

## 최종 증거

- **MYSQL02-A PASS_SELECTED:** 전용 MySQL8.4.11/127.0.0.1:3359의 새 `vm_studio_upgrade_verify`에 기존 테스트 앱28개 테이블을 복사했다. 날짜 precision0/기존 토큰으로 시작해 **NODE_ENV=prod/synchronize=false**의 실제 ts-node/TypeORM CLI로 기존18+신규1=19개 마이그레이션을 실행했다. 재실행은 `No migrations are pending`. 기존 User 날짜 값·legacy 토큰·Studio 문서/revision은 완전히 동일하며 TEXT/precision6·400자 저장을 확인했다. 별도 테스트 스키마에서는 up 두 번의 데이터 보존과 down 거절을 실제 MySQL 회귀로 확인했다. 신규 스키마는 실제 고객 DB가 아니며, 전체 빈 DB를 구축하는 초기 마이그레이션 검증도 아니다.
- **MYSQL02-B PASS_SELECTED:** `vm_studio_prod_verify`의 API4532/4533은 별도 PID/Node 프로세스, 같은 마이그레이션 DB와 기존 Rill DuckDB 파일을 읽기 전용으로 공유했다. 같은 revision의 서로 다른 제목 저장은201/409, 최종 승자 제목 보존. 수정 전/후 기록을 분리했다. 이 재실행은 신규 행 잠금 변경의 회귀다.
- **MYSQL02-C PASS_SELECTED:** 수정 전 동시 private 게시 token2개/version1 각각을 증빙한 후 이번 테스트 행만 중지했다. 수정 후 같은 조건은 **같은 token/버전1,2**, 활성 게시본1개였다. 수동 게시의 서로 다른 requestId 두 요청은 차례대로 재게시가 허용되는 기존 계약이다. 실행기의 오래된 게시 기준은 별도 회귀에서409로 거절된다.
- **MYSQL02-D PASS_SELECTED:** 두 서버에 같은 저장 requestId를 동시에 보내201/201/동일 결과, 같은 게시 requestId도201/201/동일 token/version3이었다. 실제 MySQL의 각 영수증은1건이며, 동일 게시 ID의 다른 본문은409. snapshot 수치 **634,513,000**, 블록 ID/비대상 정의/모든 폭 배치는 원본과 동일했다. 정확성은 PNG가 아니라 DB와 고정 Rill oracle로 대조했다.
- **MYSQL02-E PASS_SELECTED:** API 두 개를 실제 TERM/같은 DB로 재시작한 후 Ego TaskSpace6에서 로그인→Studio 저장본 제목 `두 서버 동일 요청 복구`/정확한 숫자→게시 패널의 **버전3·비공개**를 확인했다. 게시 패널의 닫기 포커스/Escape 복귀·390px 가로 넘침0,1440px 게시 패널 정렬/줄바꿈을 캡처로 직접 확인했다. UI 코드는 변경하지 않았으며 기존 모바일/키보드 전체 케이스는 반복하지 않았다. 전체 접근성·실휴대폰 PASS로 확대하지 않는다.

선택 검사: SQLite 관련 **102 PASS**(Studio 저장·게시·실행기·신규 마이그레이션), 신규 게시 경계 회귀만 실제 MySQL **2 PASS/15 SKIP**, 마이그레이션 실제 MySQL **1 PASS**. 마이그레이션 회귀 파일을 CLI의 migration glob 밖인 `src/auth/mysql-auth-migration.spec.ts`로 옮긴 뒤 해당 SQLite1 PASS. 최종 BE build/변경6파일 lint/diff check PASS. 통과한 MYSQL01 인증/일반 UI 전체는 반복하지 않았다.

## 운영 적용 경계와 재현

실제 운영에는 실행하지 않았다. 운영 담당자가 백업/복구 사본을 확보하고 쓰기를 중지한 유지보수 단계에서, 기존 DB 환경변수를 주입해 다음과 같이 명시적으로 실행하는 경로를 검증했다. 검증 환경의 주소·계정·키를 운영에 복사하지 않는다.

```sh
cd backend-api
NODE_ENV=prod npm run migration:run -- --transaction none
```

MySQL DDL은 implicit commit이므로 전체19개가 하나의 rollback 가능한 트랜잭션이라고 주장하지 않는다. `down` 대신 검증된 백업 복원이 필요한 변경이 있으며, 이번에는 실제 백업 복원·장애 중간 종료를 검증하지 않았다. 검증한 CLI는 위 스크립트와 동일한 ts-node 인자 경로이며 배포된 compiled DataSource도 기존 복사본에서 실행했다.

이번 결과는 **같은 대시보드의 Studio 저장/게시와 영수증 경합**에 한정한다. 다중 서버의 게시 중지/소스 교체/레거시 쓰기 전체 조합, 실행 중 작업 소유권/장애 인계, 부하·deadlock/timeout·실제 다중 호스트 파일 공유·운영 MySQL 버전/기존 고객 스키마 차이·백업 복원·실휴대폰·전체 제품 수용은 미검증이다. MariaDB 조건문은 호환 경계를 유지하는 코드이며 실제 MariaDB 검증은 하지 않았다.

## 증빙·정리

저장소 밖 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-mysql-prod-20261016`:

- `migration-before.json`, `before-upgrade.json`, `before-upgrade-dates.json`, `upgrade-final.json`, `upgrade-final.log`, `upgrade-replay.log`
- `race-initial.json`, `race-fixed.json`, `idempotency.json`, `race-db-final.json`, 선택 단위/MySQL/build/lint 로그
- `private-version3-1440.png`, `restarted-result-390.png`, `ui-layout.json`, `cleanup.json`

최초 실패의 비공개 게시본2개와 마지막 비공개 게시본은 이번 테스트 ID만 중지했다. 마지막 중지201·익명410, 새 공개 링크0. 임시 Ego 탭/viewport·이번 API4532/4533/FE3432/실패한 준비 프로세스는 종료했고 이번 임시 access token 파일은 삭제했다. 전용 Colima/MySQL·검증 스키마와 기존 MYSQL01 앱/서버는 보존했다. 기존 SQLite·DuckDB 원본 파일·전역 Docker context·samba는 변경하지 않았다. **gpt-6-luna 설정/VoiceOver BLOCKED 유지.**
