# UC051 소스·지표·갱신 인증의 메타데이터 경계

FR014/017·NFR005/008·TC050 E01/E02/E03 후속이며 기준 ffe0bfa0다. 앞 단위의 공통 큐를 일반 소스/지표 저장 및 refresh 인증 조회에 연결한다. 전체16개 요건 완료나 모든 raw CRUD 조정이 아니다.

## 계약

DatabaseService create/uploadFile의 metadata save, update/remove의 metadata 읽기·쓰기, switchFile CAS를 같은 DataSource 큐에 연결한다. 파일 import/digest/manifest/물리 삭제·외부 SQL은 가능한 한 범위 밖에 두고 등록 후 부가 작업 실패의 기존 보존 정책을 유지한다. fileState/findDB의 기본 행은 확정 상태로 읽으며 실제 파일 조회는 밖에서 수행한다. 파일 교체는 기존 암호화 config CAS가 최종 판단하며 가져온 파일을 성공 등록 후 지우지 않는다. 기존 source remove의 다중 삭제는 이 단위에서 새 transaction 원자성으로 확대하지 않는다.

MetricService create/update/remove의 read-modify-write는 한 큐 범위에서 실행하고 목록/단일 정의 조회도 확정 상태로 읽는다. evaluate는 정의를 먼저 읽은 뒤 큐를 해제하고 데이터 SQL을 수행한다. 기존 구조화 definition 변경 금지·soft delete/revive·필터 검증·API 응답은 유지한다. 소유권/활성 검사와 권한 확대를 변경하지 않는다.

AuthService verifyRefreshToken은 JWT 검증과 actor 형식 확인 후 User/RefreshToken 두 조회를 같은 범위에서 실행한다. active/authVersion/jwtId/저장 token 일치와 기존401 의미는 유지한다. 세션 회전·로그아웃·계정 쓰기의 다중 statement 원자성은 별도 후속이다.

## 검증·종료

제품 수정 전 실제 SQLite held transaction→동시 일반 소스/지표 저장 성공 유실과 refresh의 미커밋 비활성 오판을 재현한다. 공통 큐 후 저장이 rollback 뒤 독립 commit하고 refresh가 확정 토큰만 읽는지 확인한다. 메타데이터 이후 긴 SQL/import가 다른 메타데이터 작업을 잡지 않는 경계도 검사한다. 기존 소스 파일 교체/복구/실패 cleanup·지표/refresh·DuckDB/Studio/권한 회귀와 type/lint/build·기존 core 회귀를 실행한다. 독립 검토/문서·strict/pin/check/packet·비공개 자료 검사 후 develop-v2에 commit/push한다. 새 UI/schema/의존성은 없으며 Ego 제어권/모바일·MySQL·운영·전체 수용은 미실행으로 유지한다.

## 검토 후속

findData의 dataset/table-query·findTypeList와 ConnectionService config 조회는 별도다. 확정 source config를 snapshot에 pin하고 SQL 전 lease를 해제하는 후속을 추적한다. source/지표 정의 확정만으로 전체 실행 sourceRevision 고정을 주장하지 않는다. 실제 동시 restore의 성공1/409 한 건과 두 파일 보존은 제품 코드 변경 없는 추가 회귀로 확인했다.
