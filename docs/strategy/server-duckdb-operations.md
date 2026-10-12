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
