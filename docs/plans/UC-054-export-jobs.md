# UC054 영속 집계 CSV 작업

## 전체 목표와 이번 구현

FR023/NFR005/006/007/008: 검토한 Explore/고급 Pivot 기간·필터·비교·조건·선택 지표와 소스/지표 버전을 고정해 작업 접수→명시 실행→상태/취소/중단 복구→권한 보호 파일을 연결한다. 기존 집계 serializer/10,000행·2MiB 한도와 비교 수치를 재사용한다. 원시행·임의 SQL·익명 URL·MK AI 연동은 제외한다. 전체 FR025 비교 리포트·운영 수용은 후속이며 이번 범위로 전체16개를 축소하지 않는다.

## 영속 모델과 상태

ExportJob: 숫자 id, ownerId+UUID requestId unique, organizationId/sourceId/sourceOwnerId, digest, requestJson, basisJson, status(queued/running/ready/failed/cancelled), version, nullable attemptToken/leaseUntil, createdAt/expiresAt, nullable filename/hash/errorCode, rowCount/bytes/partCount. 유효기간은 접수 후24h다. 실행 lease는5분이며 만료 running은 읽기 응답에서 interrupted로 투영한다. GET은 상태를 바꾸거나 SQL을 실행하지 않는다. 명시 run만 현재 version의 lease를 인수하며 옛 실행 token은 결과 commit을 못 한다. pending/failed/interrupted는 current version으로 명시 재실행하고, stale 이전 요청은 현 상태만 반환한다. future version은409다.

ExportPart(jobId,part PK,text)는 CSV를 surrogate pair를 자르지 않는12,000 UTF16 단위로 나눈다. 각 부분은 UTF8 36KiB 이하로 SQLite/MySQL TEXT에 보관하고 총2MiB/최대200부분·checksum/순서/건수를 확인한다. filesystem 공개 경로는 없다. ready 전환 CAS도 현재 lease 유효성을 다시 검사하고, 만료 도중 부분 저장은 rollback해 interrupted로 유지한다. ready/부분/감사는 원자 저장하며 실패·취소에는 부분0이다. 만료 시 전달을 차단하며 물리 보관 정리/운영 quota 정책은 별도다. actor당 미만료 작업 최대100개다.

## API 계약

JWT `/bi/export-jobs`는 기존 SUCCESS envelope가 아닌 raw job 응답이다.

- POST 정확히 `{requestId,payload:{mode:'explore'|'pivot',query},measureVersions:{id:positiveVersion}}`. JSON48KiB·depth16, sourceId/소스 revision·1~6개 지표/일치 버전·includeRows 금지. 허용 필드·기간/비교·필터/정렬·고급 축의 SQL 없는 공통 검증을 접수 전에 수행하며 실제 열/schema는 실행 시 재검사한다. 현재 활성 본인/조직·요청 JWT epoch 및 source export를 생성 전에 확인한다. 현재 source owner/파일 revision과 선택 metric definition digest/version을 검증해 고정하고 아직 집계 SQL은 실행하지 않는다. 같은 요청은 현재 권한/조직/내용 확인 후 기존 작업을 반환한다. 다른 내용/조직은409다.
- GET `?beforeId=`: 본인 현재 조직의20후보 cursor 목록 `{entries:Job[],nextBeforeId}`. 현재 source export가 없으면 제목/기준 없이 숨긴다.
- GET `/:id`: 현재 본인/조직·source owner/활성/export를 확인한 상태. Job 필드 `{id,requestId,sourceId,sourceRevision,measureVersions,payload,status,version,createdAt,expiresAt,rowCount,bytes,filename,errorCode}`. payload는 허용된 집계 조건이며 SQL/비밀 연결정보가 아니다. token/hash/부분 데이터는 상태 응답에 없다.
- POST `/:id/run` body `{expectedVersion}`: queued/failed 또는 lease 만료 interrupted만 인수한다. HTTP 실행은 인수한 running 상태를 먼저 반환하고 process 내 추적 실행을 이어가므로 같은 화면에서 명시 조회/취소가 가능하다. 읽기/재요청이 실행을 자동 시작하지 않는다. running/ready/cancelled의 반복 요청은 SQL을 추가 실행하지 않는다. 현재 기준/권한을 전후 확인하며 집계 SQL은 metadata transaction/SQLite 공통 큐 밖에서 실행한다. 실행 오류는 민감정보 없는 QUERY_FAILED/BASIS_CHANGED/ACCESS_REVOKED 상태를 기록한다. guard 이후 큐 대기 중에도 요청 JWT epoch를 재검사하고 실행 중 바뀌면 완료하지 않는다. 실패 정리는 running/version/token CAS를 이긴 뒤에만 부분을 삭제한다. 실패 상태 저장 자체의 장애는 job/attempt/classification만 구조화 진단하며 원시 오류·SQL·비밀정보는 기록하지 않는다. 이때 running lease 만료 후 명시 복구한다. 현재 기준 불일치는 실패하며 새 기준은 새 작업으로 검토한다.
- POST `/:id/cancel` body `{expectedVersion}`: current version의 queued/running/failed/ready를 cancelled로 바꾸고 부분을 삭제한다. cancelled 반복은 멱등이다. 실제 SQL 강제 중단을 보장하지 않지만 늦은 결과는 저장하지 않는다.
- GET `/:id/file`: ready·미만료·현재 활성 본인/조직/source owner/활성/export를 재검사하고 integrity 확인 후 `{sourceRevision,filename,mimeType,csv,rowCount,bytes,sha256}`. 만료410/미완료409다. 완료 후 데이터/지표 변경은 고정 파일을 현재 조회로 바꾸지 않으며 UI에 과거 기준을 명시한다. 소유권/권한 회수는 전달을 차단한다.

## UI와 검증

기존 즉시 CSV는 유지하고 Explore 내보내기의 접힌 파일 작업 영역에서 현재 조건으로 접수·명시 실행/취소/다시 읽기·고정 파일 받기·이전 작업20개를 제공한다. source/조건 변경 시 현재 작업은 새 조건으로 자동 바꾸지 않는다. 응답 유실 접수는 같은 UUID/body를 고정해 확인하고, 확정 입력/권한/기준 거절은 고정을 풀어 새 조건 접수를 허용한다. 새로고침은 서버 작업 목록을 명시 조회하며 자동 접수/실행0이다. 입력/도구는 UI Kit 36/32px·wrap/min-w-0·모바일16px를 유지한다.

실제 SQLite/JWT/DuckDB: 미허용/잘못된 버전 생성0·멱등/동시 CAS/권한 회수·SQL 구간 큐 해제·cancel/옛 lease 쓰기 차단·실패 재시도/재시작·부분 rollback/integrity/만료·고정 결과/소스/지표/포함·제외/기간 비교 oracle를 확인한다. FE 명시 동작·frozen 재시도/새로고침 조회·late/오류/정렬·기존 export 회귀와 type/lint/build/core를 검증한다. 실제 Ego96 사용자 제어권/실휴대폰·MySQL 동시성/운영·사람 수용은 별도다.

감사 `export.queued/running/ready/failed/cancelled`의 resourceId는 작업 ID, version은 작업 버전이다. 작업에 고정된 source/basis와 연결해 동일 소스의 여러 출력 사건을 구별한다. 본인 완료 알림 투영은 후속이다.
