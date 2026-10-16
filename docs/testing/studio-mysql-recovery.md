# STUDIO-MYSQL03 백업·복원과 중단 마이그레이션 복구

기준: develop-v2 `577cd8f6`, 2026-10-16. MYSQL01/02의 정상 저장·게시·경합 전체는 반복하지 않는다. 전용 로컬 MySQL8.4.11의 닫힌 테스트 앱 복사본만 사용한다. 운영 DB/기존 업로드 파일·samba는 변경하지 않는다.

| 조건 | 입력·기대 결과 | 상태 |
|---|---|---|
| MYSQL03-A | 쓰기 중지된 메타데이터 SQL dump + DuckDB/원본/manifest 백업, 원본 지문 불변 | PASS_SELECTED |
| MYSQL03-B | 새 DB/새 파일 루트로 복원, 전 테이블 행·영수증·게시 상태·파일 해시 보존, 원본 참조0 | PASS_SELECTED |
| MYSQL03-C | 토큰 DDL 직후 migration 프로세스 강제 종료, 부분 적용/이력 없음 확인→동일 CLI 재개 | PASS_SELECTED |
| MYSQL03-D | createdAt DDL 직후 강제 종료→데이터 보존·동일 CLI 재개 | PASS_SELECTED |
| MYSQL03-E | 모든 DDL 완료/이력 insert 전 강제 종료→재개 시 이력1건·기존 값 보존 | PASS_SELECTED |
| MYSQL03-F | 복원된 서버 실제 Studio/390px·1440px 화면·정확한 집계/저장 결과 조회 | PASS_SELECTED |
| MYSQL03-G | 부분 DDL commit/강제 종료 후 사전 백업으로 모든 행·스키마·인덱스 복귀 | PASS_SELECTED |

DDL 각각의 완료 후 중단과 MySQL 데몬/호스트 자체의 DDL 도중 crash는 구분한다. 비밀번호/토큰/SQL dump/암호화 키는 증빙에 출력하거나 추적하지 않는다. gpt-6-luna 설정 유지·모델 호출0, VoiceOver BLOCKED.

## 환경·백업 계약

API4532/4533이 중지된 기존 로컬 `vm_studio_prod_verify`를 백업 원본으로 사용했다. 원본의 29개 테이블/65개 행을 전후 비교했고 전역 Docker context·samba·기존 MySQL01 앱·SQLite DB/업로드 파일은 변경하지 않았다. 이번 실험 전용 스키마는 `vm_recovery_restore03`, `vm_recovery_cut03a/b/c`, `vm_recovery_rollback03`이다. 원격 DB/운영 서버에는 접속하지 않았다.

MySQL 공식 [mysqldump 지침](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html)에 맞춰 쓰기/DDL이 없는 유지보수 상태에서 `--single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --hex-blob`로 SQL dump를 만들었다. dump가 비어 있지 않고 명령 종료0인지 확인했다. 단일 트랜잭션 dump를 실행했다고 DuckDB/동시 DDL까지 자동으로 일관성이 보장된다고 해석하지 않는다. 이 검증은 관련 쓰기 서버가 중지된 파일럿 방식이다.

백업 세트는 메타데이터 SQL **78,691바이트**와 업로드 디렉터리의 DuckDB/Parquet/import.json **3개·85,427,551바이트**다. 파일별 SHA-256/크기를 기록하고 복사 전후 원본과 백업/복원본을 비교했다. SQL dump는 인증 세션/해시를 포함하므로 `/private/tmp/vm-mysql-recovery-20261016/backup`(상위700/덤프600)에만 두고 저장소/화면 증빙에 복사하지 않았다. CONFIG_SECRET_KEY 등은 기존 로컬 검증 설정을 재사용했으며 키를 출력하지 않았다. 키 유실/별도 키 관리 시스템 복구를 시험한 것은 아니다.

## 선택 검증 결과

### MYSQL03-A/B: 백업·새 DB 복원

별도 빈 스키마에 실제 `mysql` 클라이언트로 SQL dump를 복원했다. 모든 테이블의 정렬한 전체 행 지문·행 수·열/기본값/인덱스 지문이 원본과 동일했다. 전체 지문은 원본 전/복원 직후/원본 최종 모두 `398417f6c42ed97800bdb4dc79c691fa6f21071a51ac7036208e6f288495817a`다. 데이터 비교 결과를 샘플 행 확인만으로 대신하지 않았다.

이후에만 별도 파일 루트 `restored/uploads`로 재연결했다. 복원 DB의 암호화된 DuckDB config 내부 경로2개만 기존 helper로 재암호화했고, 기존 updatedAt 값을 명시 보존했다. 새 루트의 실제 파일 SHA-256은 백업 manifest와 전부 동일하며 원본 경로 참조는0이다. 이 경로 변경은 원본 DB/백업 dump를 바꾸지 않는다. 경로 기반 sourceRevision은 새 값이 되므로 **기존 초안의 이전 sourceRevision까지 유지하는 복구는 주장하지 않는다**. 현재 파일로 재조회/재미리보기가 필요한 경계다.

복원 API4534를 NODE_ENV=prod/synchronize=false, FE3434를 복원 API에만 연결했다. 기존 저장 requestId/본문 hash가 백업 원장과 일치함을 먼저 확인한 뒤 실제 API로 재전송해 저장 영수증을 재사용했다. 게시 requestId도 기존 version3/중지 상태를 반환하고 익명 읽기는410을 유지했다. 저장 영수증4/게시 영수증5를 보존했고 보호 대상10개 테이블의 전후 지문은 동일했다. 추가 메타데이터 쓰기0이다. 로그인에 따른 user/refresh_token 갱신은 이 불변 주장에 포함하지 않는다.

### MYSQL03-C/D/E: 실제 CLI 중단·전진 재개

각각 독립 복사본을 기존 varchar255/날짜 precision0/해당 신규 이력 없음 상태로 준비했다. 실제 제품 `FixMysqlAuthColumns1792130000000`과 compiled DataSource를 사용하고, 임시 DataSource wrapper에서 실제 QueryRunner.query가 **DDL 완료를 반환한 직후만** 대기시켰다. 프로세스 PID/정확한 DB/중단 지점을 marker로 검증한 다음 해당 CLI 자식만 SIGKILL했다. 제품 코드에 fault hook을 추가하거나 DDL을 mock하지 않았다.

| 중단 지점 | 강제 종료 직후 실제 DB | 재개 결과 |
|---|---|---|
| token DDL 완료 | TEXT, createdAt0/updatedAt0, 해당 migration 이력0 | TEXT/6/6·이력1 |
| createdAt DDL 완료 | TEXT, createdAt6/updatedAt0, 이력0 | TEXT/6/6·이력1 |
| updatedAt DDL 완료/이력 insert 전 | TEXT, createdAt6/updatedAt6, 이력0 | TEXT/6/6·이력1 |

세 경우 모두 정상 CLI `migration:run --transaction none`으로 재개했다. 중단 직후 모든 행의 의미 값이 보존됐고, 재개 후에도 migration 이력 외의 행은 보존됐다. 다시 실행해 전체 지문 불변/추가 이력0을 확인했다. `[TypeORM up 완료 뒤 이력 기록](https://github.com/typeorm/typeorm/blob/master/packages/typeorm/src/migration/MigrationExecutor.ts)` 경계와 실제 관측을 대조했다.

COUNT가 문자열로 반환된 첫 비교 실패, 날짜 precision0의 `...:00`과 precision6의 `...:00.000000` 표시 차이, 로컬 파일 해시 helper의 Buffer 처리 보완은 검증 도구 준비/비교 오류로 구분했다. 날짜 열만 소수부 뒤0을 정규화해 의미 값을 비교하고, 스키마 정밀도는 별도로0/6을 단정했다. 임의 텍스트/실제 시각 변경을 무시하는 비교는 하지 않았다. 파일 해시는 최종 Python streaming SHA-256으로 백업 바이트와 재대조했다. **이번 실행에서 추가 제품 오류/제품 코드 수정0**이다.

### MYSQL03-G: 전진 재개 대신 사전 백업 복원

독립 `vm_recovery_rollback03`를 이전 스키마로 준비하고 **마이그레이션 직전 새 dump**를 만들었다. 토큰 DDL commit 뒤 실제 CLI를 SIGKILL해 부분 적용을 확인한 후, 해당 전용 스키마에만 사전 SQL dump를 다시 넣었다. 29개 테이블의 데이터·스키마·인덱스 지문이 사전 상태와 완전히 일치했다. 제품 `down`을 실행하지 않았다. 이전 스키마로 되돌린 DB에 최신 앱을 자동 개방하지 않으며 유지보수 중 이전 앱/스키마 계약을 확인하거나 다시 전진 마이그레이션해야 한다.

### MYSQL03-F: 실제 복원·재개 화면

Ego TaskSpace7에서 복원 DB의 로그인→Studio 저장본을 실제 읽었다. 제목 `두 서버 동일 요청 복구`, 기존 블록 ID/배치와 정확한 집계 **634,513,000**을 확인했다. 원본은 Rill1,391,572행이며 이번에는 재수입하거나 AI 생성을 반복하지 않았다.

복원 화면1440×1000/390×844를 캡처하고 직접 확인했다. 이후 **실제 중단 후 재개한 cut03c DB**로 이번 API만 교체해 같은 복원 파일 루트에서 reload/GET200·정확한 값/제목·390px 가로 넘침0을 확인했다. 재개 DB의 보호 대상9개 테이블은 중단 전과 동일하며 migration 행은 의도대로 새로 기록됐다. 기존 모바일/키보드 전체 통과 케이스는 반복하지 않았고, 캡처 범위의 줄바꿈/컨트롤/숫자판만 확인했다. UI 코드 변경0이며 시각 결과와 DB/파일 정확성은 별개 근거다.

## 증빙·정리·제한

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-mysql-recovery-20261016`.

- `source-before.json`, `source-after-backup.json`, `source-final.json`, `restored-before-relocation.json`: 전 테이블 지문
- `backup-manifest.json`, `restored-files.json`, `relocation.json`, `relocation-resumed.json`
- `cut-token.json`, `cut-createdAt.json`, `cut-updatedAt.json`, `rollback-from-backup.json`
- `restored-receipts.json`, `protected-before-app.json`, `final-result.json`, `resumed-ui.json`
- `restored-studio-1440.png`, `restored-studio-390.png`, `resumed-studio-390.png`
- 재현용 임시 검증 helper/CLI 중단 로그(실제 SQL dump/키/로그인 설정 제외)

최종 보호 확인: 원본29개 테이블/65행 지문 불변, 원본/백업/복원3파일 해시 일치, 세 강제 종료 후 복구·이력1건, 사전 백업 복귀, 복원 영수증 추가쓰기0. 신규 게시/AI 호출0. 기존 빌드·단위 결과는 재사용했고 제품 코드 변경이 없어 전체 테스트/빌드를 반복하지 않았다. 문서 diff/증빙 링크 확인만 추가한다.

추가 FE3434/API4534·Ego 탭/viewport를 종료하고 나머지 기존 서버와 전용 MySQL은 유지했다. 검증 DB와0700/0600 백업 파일은 로컬에 보존한다. 이 SQL dump는 시험 계정 자료이며 운영 백업 저장소가 아니다.

**남은 범위:** DDL 실행 도중 MySQL 데몬/호스트 자체 crash·물리/증분/PITR 복구·손상/부분 백업 거절·원격 저장소/키 유실·운영 데이터 규모/RPO/RTO·복원 후 모든 기능·진행 중 AI 초안의 경로 변경 handoff·실휴대폰/전체 접근성은 NOT_RUN이다. 마이그레이션 프로세스 종료를 MySQL 서버 자체 crash 복구로 확대하지 않는다. gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다. 이번 기록은 미커밋이다.


## 데몬 종료 후속 — 2026-10-16

[MYSQL04](studio-mysql-daemon.md)에서 별도 컨테이너의 실제 mysqld SIGKILL→미commit rollback/기존commit 보존과 DDL 일부 완료 후 데몬 재시작/마이그레이션 재개를 확인했다. DDL SQL 문장이 실행 중인 순간/호스트 자체 crash·PITR은 여전히 미검증이다.
