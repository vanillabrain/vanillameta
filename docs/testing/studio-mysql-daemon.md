# STUDIO-MYSQL04 MySQL 데몬 강제 종료·재기동

기준 develop-v2 `577cd8f6`, 2026-10-16. MYSQL03 백업/CLI 중단 결과는 재사용한다. 별도 컨테이너·볼륨·localhost3360만 종료한다. 기존3359 컨테이너/DB·SQLite·samba는 유지한다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| MYSQL04-A | 백업 복사본을 새 MySQL8.4에 준비, InnoDB/영속 설정 확인 | PASS_SELECTED |
| MYSQL04-B | 실제 미commit 쓰기 중 mysqld SIGKILL→같은 볼륨 재기동, 기존commit 보존/미commit rollback | PASS_SELECTED |
| MYSQL04-C | 토큰 DDL commit/이력 전 mysqld SIGKILL→부분 적용 보존→동일CLI 재개/이력1건 | PASS_SELECTED |
| MYSQL04-D | 실제 재기동한 앱/Studio·정확한 집계·대표 모바일 화면 | PASS_SELECTED |

DDL 문장 자체가 실행 중인 순간의 crash/호스트 전원 장애/PITR은 이번 조건에 포함하지 않는다. gpt-6-luna 설정/VoiceOver BLOCKED 유지, 모델 호출0.

## 범위와 격리

기존 Colima 프로필 안에 별도 컨테이너 `vm-studio-mysql-daemon-20261016`(ID `84412f1f9ccc...`), 볼륨 `vm-studio-daemon-data-20261016`, localhost3360을 만들었다. 기존 MySQL3359 컨테이너는 종료하지 않았다. 새 컨테이너의 PID1은 실제 `mysqld`다. 같은 mysql:8.4 이미지/실제8.4.11, 메모리768MiB·buffer pool128MiB로 제한했다. InnoDB, innodb_flush_log_at_trx_commit=1, sync_binlog=1을 실제 SQL로 확인했다.

MYSQL03에서 만든 검증용 dump를 새 `vm_daemon_app04`로, 마이그레이션 직전 dump를 별도 `vm_daemon_migrate04`로 복원했다. 초기29개 테이블/65행 지문은 기존 백업과 동일했다. 이는 이번 daemon 실험의 준비이며 기존 백업/복원 전체 케이스를 새 PASS로 중복 집계하지 않는다.

## MYSQL04-B 실제 미완료 트랜잭션 중 데몬 종료

새 DB에 실제 transaction을 열어 dashboard1 제목을 `미완료 쓰기 - 롤백 대상`으로 바꾸고 studio_run에 `daemon-uncommitted-20261016` 영수증을 insert했다. 같은 연결에서는 변경을 읽었고, 별도 연결은 읽지 못하는 것을 확인했다. commit하지 않고 정확한 신규 컨테이너에 Docker KILL 신호를 보냈다.

컨테이너는 **exited137**, 연결은 PROTOCOL_CONNECTION_LOST를 반환했다. 같은 컨테이너/볼륨을 start한 뒤 실제 SQL 준비 상태를 기다렸다. **모든29개 테이블의 행 수·전체 행 지문·열/인덱스 지문이 장애 전과 동일**했다. 미완료 제목과 영수증은 rollback됐고 이전 commit된 저장/게시/마이그레이션 기록은 보존됐다. AUTO_INCREMENT 다음 값/rollback 후 ID 공백은 이 불변 비교의 대상이 아니다.

## MYSQL04-C DDL 일부 완료 뒤 데몬 종료·재개

실제 제품 마이그레이션/compiled DataSource와 MYSQL03의 임시 QueryRunner wrapper를 사용했다. 이력 없는 이전 스키마에서 토큰 TEXT DDL이 완료된 직후만 대기시킨 뒤 **CLI뿐 아니라 새 MySQL 데몬 자체를 KILL**했다. 제품 코드/실제 SQL을 mock하지 않았다.

같은 볼륨으로 재기동한 실제 상태는 refreshToken=TEXT, createdAt/updatedAt precision0, 해당 migration 이력0이었다. 정상 CLI `migration:run --transaction none`으로 남은 DDL을 적용한 뒤 날짜 precision6/6·이력1건·기존 행 값 보존을 확인했다. 날짜 의미 값과 정밀도는 MYSQL03과 동일하게 구분했다.

임시 wrapper의 pending Promise가 있는 CLI는 DB 연결 종료 뒤 exit0으로 관측됐다. 이는 fault wrapper의 대기/이벤트 루프 종료 결과이며 마이그레이션 성공 근거로 사용하지 않았다. 종료 후 반드시 DB 부분 상태/이력0을 확인했고, **새 정상 CLI의 재개 exit0과 DB 이력1**을 최종 성공 근거로 사용했다. 이 관측을 일반 제품 CLI의 정상 성공/실패 계약으로 확대하지 않는다.

## MYSQL04-D 실제 앱 복구 화면

데몬이 복구된 vm_daemon_app04를 NODE_ENV=prod/synchronize=false API4536으로 기동했다. 별도로 복사한 기존 Rill DuckDB/원본/manifest 루트만 읽도록 복원 DB의 암호화 경로2개를 재연결했다. 원본 경로/기존 DB/파일은 변경하지 않았다. FILE_UPLOAD_DIR/키는 로컬 검증 설정이며 운영으로 복사하는 설정이 아니다.

Ego TaskSpace8에서 로그인→실제 Studio 조회200과 저장된 제목 `두 서버 동일 요청 복구`·정확한 집계 **634,513,000**을 확인했다. Rill1,391,572행의 기존 파일/정답을 재사용하며 AI 생성·새 파일 수입은 반복하지 않았다. 저장 영수증4/게시 영수증5·게시 중지 상태 유지, 미commit 영수증 부재를 실제 DB와 대조했다.

실제 캡처1440×1000/390×844의 컨트롤 정렬·줄바꿈·숫자판을 직접 살펴봤고 모바일 가로 넘침0이다. UI 코드 변경0이므로 전체 키보드/모바일/VoiceOver를 반복하지 않았다. 화면 통과와 DB 복구 증거는 별개이며, 제품 전체 접근성 PASS로 확대하지 않는다.

앱 로그인 뒤 user/refresh_token/login_history의 정상 인증·감사 쓰기와 database의 명시 경로 재연결을 제외한 **25개 테이블은 장애 전과 동일**했다. login_history 증가2건은 로그인/userinfo middleware의 정상 기록이며 데이터 손실로 처리하지 않았다. 최초 설정값의 BIGINT 문자열 비교와 복사한 helper 포트4534→4536 보완은 검증 준비 오류다. 추가 제품 오류/제품 코드 수정0, 모델 호출0이다.

## 증빙과 정리

`/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-mysql-daemon-20261016`:

- `before-crash.json`, `daemon-crash.json`, `migration-daemon-crash.json`, `final.json`
- `mysql-recovery.log`: 신규 컨테이너의 InnoDB 시작·XA crash recovery·ready 로그만 선별
- `relocation.json`, `ui.json`, `daemon-recovered-1440.png`, `daemon-recovered-390.png`
- 재현용 `crash.cjs`, `migration-crash.cjs`, 임시 cut-source/CLI 로그(설정/키/SQL dump 제외)

기존 변경 통과 결과/빌드·단위는 재사용했다. 이번에는 새 장애 실험과 실제 UI만 수행했고 전체 테스트를 다시 실행하지 않았다. 문서 diff check PASS. 추가 API4536/FE3436·Ego 탭/viewport·신규 MySQL 컨테이너는 종료하고 새 볼륨/복사본·0700/0600 설정은 보존했다. 기존3359 컨테이너는 running 상태를 확인했다. 전역 Docker context/samba·기존 SQLite/DuckDB는 변경하지 않았다.

**남은 조건:** DDL SQL 문장 자체가 실행 중인 순간의 원자 DDL crash, 호스트 전원 장애/디스크 손상, 물리·증분·PITR, 손상·부분 백업 거절, 운영 규모/RPO/RTO, 전체 다중 서버·실휴대폰·제품 수용은 NOT_RUN이다. Docker 프로세스 SIGKILL을 VM/호스트 전원 장애로 확대하지 않는다. gpt-6-luna 및 VoiceOver BLOCKED 유지. 이번 검증 기록과 이전 MYSQL03 기록은 미커밋이다.
