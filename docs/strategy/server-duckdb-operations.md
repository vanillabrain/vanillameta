# 서버 DuckDB 최소 운영 구조

Nest/TypeORM 메타데이터 DB는 유지한다. 새 파일만 네이티브 DuckDB로 저장하며 기존 SQLite 파일 소스는 계속 읽는다. 업로드 원본을 디스크에 스트리밍하고 UUID별 `source.*`, `data.duckdb`, `import.json`을 생성한다. TypeORM connectionConfig는 기존 암호화 방식을 유지한다. 분석 SQL/테이블 탐색/메트릭 평가/AI 스키마 조회는 같은 DuckDBService를 통한다.

별도 Redis·큐 데몬 없이 Nest가 lazy worker_thread 1개와 길이 제한 큐를 소유한다. 워커에서 import/조회/삭제를 직렬화한다. 배포 MVP는 **상시 실행 Node 서버 1개와 영속 볼륨**이다. ephemeral/serverless 디스크나 여러 API replica가 같은 파일을 쓰는 운영은 지원 범위 밖이다. Worker thread의 memory_limit은 DuckDB 버퍼 한도이며 프로세스 RSS 전체 상한은 아니다.

| 설정 | 기본 | 의미 |
| --- | --- | --- |
| FILE_UPLOAD_DIR | uploads | 원본/분석 파일 영속 볼륨 |
| FILE_UPLOAD_MAX_BYTES | 512 MiB | multipart 파일 크기 |
| FILE_IMPORT_TIMEOUT_MS | 300000 | 대기 포함 import timeout |
| QUERY_TIMEOUT_MS | 60000 | 대기 포함 query timeout |
| ANALYSIS_MAX_QUEUE | 16 | 대기 작업 상한 |
| ANALYSIS_MEMORY_LIMIT | 512MB | DuckDB 메모리 버퍼 |
| ANALYSIS_THREADS | 2 | DuckDB 실행 스레드 |
| ANALYSIS_TEMP_LIMIT | 2GB | spill 제한 |
| ANALYSIS_MAX_STORAGE_BYTES | 2 GiB | 파일별 원본+DB+WAL+spill 합산, 250ms 점검 |
| ANALYSIS_MAX_RESULT_ROWS | 10000 | API 결과 행 상한 |
| ANALYSIS_MAX_RESULT_BYTES | 8 MiB | API 결과 직렬화 상한 |

소스는 CSV/JSON 배열/Parquet. 컬럼명은 안전한 식별자로 치환하며 중복 구분, nested JSON은 JSON 문자열로 저장한다. SELECT/WITH/SHOW/DESCRIBE/EXPLAIN만 허용, 조회 인스턴스는 READ_ONLY+external access off, 여러 SQL 문장과 외부 파일/확장 접근 차단. LIMIT 없는 큰 결과는 명확한 오류로 거절한다. 전체 데이터는 삭제/축약하지 않고 SQL 집계로 조회한다.

API 요청이 끝날 때까지 import를 기다리는 동기 endpoint와 워커 실행 방식이다. 작업 상태 polling·durable queue·주기 API 수집은 이번 MVP에 추가하지 않았다. 서버가 죽으면 진행 중 요청은 실패하며 사용자가 업로드를 재시도한다. timeout은 워커를 종료하고 다음 요청용으로 다시 생성한다.

운영: metadata DB와 FILE_UPLOAD_DIR을 함께 백업하고 CONFIG_SECRET_KEY를 지속 보관한다. 기존 SQLite→DuckDB 일괄 마이그레이션은 하지 않는다. 종료/배포 전 쓰기를 중단하고 완료된 데이터만 백업한다. 저장 volume 사용량을 모니터링한다. 파일별 quota는 잠깐의 초과를 허용하며 전역 quota가 아니다. 강제 종료로 남는 incoming/importing 원본 및 metadata 등록 직전 ready orphan은 자동 정리되지 않으므로 manifest/databaseId와 메타데이터를 대조한 수동 복구가 필요하다. 임의로 ready 디렉터리를 자동 삭제하지 않는다.

현 구조는 단일 서버 파일럿용이다. datasource 권한은 기존 프로젝트 전역 소스 모델을 따른다. 상용 멀티테넌트 전에는 소스 owner/tenant 권한, 글로벌 디스크 제한, durable job/orphan 복구를 우선 추가해야 한다. 웹 API 수집 커넥터·대규모 동시 사용자·운영 부하·crash 일관성은 미검증이다.

검증 명세: [server-duckdb.md](../testing/server-duckdb.md). 광고 입찰 Rill 샘플 검증이며 주문·환불 도메인 정합성 검증을 대체하지 않는다.

## 단일 파일 버전 교체 MVP

관리된 uploaded_data 소스는 동일 이름/타입의 CSV/JSON/Parquet 전체 교체와 보관 버전 복원을 제공한다. 현재 포함 최대5개, 동일 원본 hash·형식은 재수입/수정 없이 no-op. 보관 파일은 자동 GC하지 않고 source 삭제 시 함께 삭제한다. 최대5개 이후 추가 교체는 차단되므로 장기 운영 전에 안전한 보존 정리·진행 중 참조/백업 정책을 마련한다. 파일당 한도는 기존 설정이며 버전/소스 전체의 글로벌 디스크 quota는 미구현이다. 메타데이터 DB의 encrypted config 포인터/이력과 upload 전체를 같은 백업에 포함한다. 별도 메타 테이블/마이그레이션/수집 서버는 없다.

실패/스키마 변경/CAS 충돌은 활성 데이터를 보존하고 후보만 제거한다. 교체 진행 중 대시보드 조회는 시작한 파일에 고정하며 이후 조회는 새 활성 파일을 사용한다. 서버 crash 시 등록 전 후보가 남을 수 있어 자동 orphan 복구를 주장하지 않는다. Commerce bundle, 컬럼 자동 매핑/타입 강제 변환, 증분 갱신은 이 경로를 사용하지 않는다. 실제 조건/증빙은 [file-versions.md](../testing/file-versions.md)를 따른다.

## 2026-10-14 단일 서버 Pivot 동시 요청 측정

Rill1391572행·4개필터·4/8/16/24개 HTTP동시요청 선택검증.16까지 전부성공(p95 1.653초),24는17성공/7개의큐busy503 및후속복구확인. 실제브라우저 과부하 안내/재시도복구 확인. API peakRSS표본302.5MiB. 단일로컬서버/같은사용자/짧은burst 결과이며 운영사용자한도·SLA·지속부하·다중tenant/multi-replica보장이아니다. 상세 PIVOT-09: [explore-pivot.md](../testing/explore-pivot.md), 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-load-20261014/RESULTS.md`.

## 복원 전 백업 검사

보존 주기·별도 보관·키 복구는 [최소 운영 절차](backup-retention-recovery.md)를 따른다. 실제 외부 반출·자동 삭제/스케줄러는 아직 설정하지 않았다.

쓰기/수입을 중지한 동일 시점의 메타데이터 SQL과 FILE_UPLOAD_DIR 전체를 한 세트로 보관한다. CONFIG_SECRET_KEY는 별도 비밀 보관소에 유지하며 증빙/manifest에 넣지 않는다. 검사 명령은 DB에 연결하지 않고 아래 세트의 누락·잘림·SHA-256 불일치를 거절한다. SQLite 백업을 MySQL SQL로 변환하는 도구는 아니다.

```text
backup/
  metadata.sql
  uploads/<UUID>/data.duckdb
  uploads/<UUID>/source.parquet
  uploads/<UUID>/import.json
```

신뢰할 수 있는 별도 manifest JSON은 `dump: {bytes: 양의 정수, sha256: 소문자64자리}`, `files: {"UUID/파일명": {bytes: 0이상 정수, sha256: 소문자64자리}}` 형식이다. `files`는 uploads 하위 전체 파일을 나열한다(보관 버전 파일도 포함). 기존 MYSQL03의 database/증빙 메타 필드는 검증 기준으로 쓰지 않는다. manifest는 별도 경로나 백업 루트에 둘 수 있다. 해시는 백업 완료 시 작성하고 신뢰 가능한 별도 위치에 보관한다. 손상된 내용으로 manifest를 다시 만들면 원래 백업과의 정합성을 증명하지 못한다.

업로드 파일이 없는 정상 인스턴스는 `files: {}`로 기록한다. metadata.sql은 여전히 비어 있지 않아야 한다. 검사 명령의 manifest 크기 한도는 **1MiB(1,048,576bytes) 이하**다. 초과하면 정상 해시 여부와 무관하게 복원 전에 거절된다. 대규모 세트에서 초과하면 파일 목록을 임의로 빼지 말고 한도/분할 세트의 복구 계약을 별도 검토한다.

```sh
# BACKUP_DIR, BACKUP_MANIFEST와 복원 전용 MySQL 설정/빈 대상 DB를 먼저 지정한다.
# MySQL 설정 파일에는 별도로 관리하는 자격증명을 사용한다.
python3 scripts/verify-backup.py --backup "$BACKUP_DIR" --manifest "$BACKUP_MANIFEST" &&
  mysql --defaults-extra-file="$MYSQL_RESTORE_CONFIG" "$RESTORE_DATABASE" < "$BACKUP_DIR/metadata.sql"
```

검사 성공(exit0)일 때만 MySQL 클라이언트가 실행된다. 실패(exit1) 시 자동 복원/파일 삭제/재생성하지 않는다. 검사/복원 중 세트는 쓰기 중지된 비공개 디렉터리로 유지한다. `검사 && cat dump | mysql`은 shell 우선순위 때문에 검사 실패에도 mysql 프로세스를 시작할 수 있으므로 위 직접 stdin 방식을 사용한다.

이 명령은 복원 허가/DB 선택·SQL 의미 검증·운영 스키마 호환성·검사 후 파일 교체 방지·악의적인 manifest 재작성 탐지를 제공하지 않는다. DB와 파일의 업무 시점 일치는 백업 작성 절차가 보장해야 한다. 정상 해시만으로 그 시점 일치까지 증명하지 않는다. 복원 후 별도 FILE_UPLOAD_DIR/암호화 키·저장 경로를 확인하고 정답 집계와 영수증을 조회한다. 경로가 달라지면 sourceRevision이 바뀔 수 있다. 로컬 선택 증빙: [MYSQL03](../testing/studio-mysql-recovery.md), [MYSQL05](../testing/studio-mysql-backup-validation.md).
