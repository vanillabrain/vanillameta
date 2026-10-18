# UC-054 영속 집계 export 작업

## 구현 범위

[설계 계약](../plans/UC-054-export-jobs.md)의 구현 slice다. FR023의 영속 집계 작업과 NFR005/006/007/008 경계 일부를 구현한다. 기존 CSV serializer의 집계 결과를 사용하며 원시행·임의 SQL·공개 URL을 제공하지 않는다. FR025 전체 비교 리포트 수용과 FR014~025/NFR005~008의 전체 목표는 계속 열린다.

`export_job`은 actor/조직/소스 및 소유자, UUID 요청 ID와 canonical request digest, 고정 request/basis JSON, 상태/version, attempt token/lease, 만료 시각, 안전 오류 코드와 결과 metadata를 저장한다. `(ownerId, requestId)`가 unique이고 actor당 미만료 작업은 100개까지다. `export_part`는 결과 CSV 조각을 작업 ID와 순서로 저장한다. 조각은 surrogate pair를 나누지 않게 12,000 UTF-16 단위로 나누며 각 TEXT 값은 UTF-8 36 KiB 이하이다. 전체는 10,000행·2 MiB·200조각 제한, 접수 후 24시간 만료, 실행 lease 5분이다. 파일 공개 경로는 만들지 않는다.

POST는 JWT actor의 활성 계정, 현재 조직, 현재 소스 export 권한/소유자를 확인하고 소스 revision과 각 선택 지표의 version/digest를 고정한다. 허용 형식은 Explore/Pivot 집계이고 지표는 1~6개, request JSON은 48 KiB 이하이며 `includeRows` 원시행은 거절한다. 동일 UUID와 동일 조직·내용은 기존 작업을 반환하고 UUID 재사용 내용/조직이 다르면 409다. 접수 자체는 집계 SQL을 실행하지 않는다.

명시 run은 현재 version을 CAS로 인수해 running 상태와 attempt token/lease를 저장한 뒤 raw job 상태를 HTTP에 먼저 반환한다. 실제 집계는 백그라운드에서 진행한다. 집계 SQL은 metadata transaction과 SQLite 공통 작업 queue 밖에서 실행해 긴 쿼리가 metadata 쓰기를 막지 않게 한다. 실행 전후에 현재 기준·권한·auth epoch를 확인한다. 인증 epoch가 달라지거나 권한이 회수되면 완료하지 않는다. cancel/lease 교체 후 늦게 끝난 worker는 token/version 조건을 통과하지 못한다. GET과 목록 조회는 SQL 또는 실행을 유발하지 않는다. stale 요청은 현재 상태만 돌려주고 미래 version은 409다. 재시도/lease 복구 사례는 새 `ExportJobsService` 인스턴스를 만들어 같은 live SQLite connection의 저장 상태를 다시 읽는 경계다. 이는 실제 서버 프로세스 재시작이나 실제 UI/browser reload 검증이 아니다.

성공 시 파일 조각, checksum, 완료 상태와 감사 이벤트를 한 transaction에서 저장한다. 최종 ready CAS도 lease 만료를 검사한다. 실제 부분 insert 후 clock을 만료 이후로 넘겨 전체 rollback·interrupted/부분0/ready 감사0과 명시 재실행을 확인했다. 실패 시 정리 역시 현재 status/version/attempt token CAS가 성공한 뒤에만 기존 조각을 삭제한다. CAS에서 진 이전 worker는 새 worker의 파일을 지우지 않는다. 실패/취소에는 조각이 남지 않는다. 외부 오류 문구나 SQL/저장 세부는 응답하지 않으며 QUERY_FAILED, BASIS_CHANGED, ACCESS_REVOKED 같은 분류만 기록한다. 파일 GET은 본인/현재 조직, 소스 소유자와 export 권한, active/auth epoch, 만료, 조각 수·순서·크기·checksum을 매번 확인한다.

## 화면과 API 경계

Explore의 `ExploreExport`가 접힌 `ExportJobs` 영역을 제공하며 기존 즉시 CSV는 그대로 유지된다. `ExportJobs`는 접수, 명시 실행/취소, 상태 다시 읽기, 이전 작업 cursor 조회와 고정 파일 다운로드를 연결한다. 현재 조건이 바뀌어도 선택 작업과 모호한 접수 요청은 바뀌지 않는다. 접수 응답이 불명확하면 동일 UUID/body를 보존해 재확인한다. 새로고침은 서버 작업을 명시 조회하며 자동 접수·실행·polling은 하지 않는다. 실행/취소 응답이 불명확하면 상태를 다시 읽기 전 mutation을 막는다. API client는 raw 응답과 조건/버전 일치, 파일 형식·크기를 확인한다.

## 검증 근거와 상태

최종 `backend-final.log`는 6 suites/236개 PASS다. 실제 SQLite·DuckDB·JWT를 포함한 export-jobs 17개, SQL 없는 공통 접수 검증 104개, 기존 Explore/Pivot/CSV/조건 회귀 115개다. 잘못된 요청의 작업·감사·집계 호출0과 auth epoch 변경 후 거절은 실제 SQLite를 쓰는 service 직접 호출로 확인했다. 별도의 valid-JWT HTTP lifecycle 사례는 무인증 거절→접수→running 응답→상태·파일 조회와 동일 UUID 재확인을 확인한다. service 검사를 route별 HTTP 검사로 확대하지 않는다.

최종 `frontend-final.log`는 Explore 14 suites/278개 PASS다. 확정400/403/409/410/422 거절 후 현재 조건/새 UUID 접수, 불명확 응답의 기존 UUID/body 보존, 상태 조회/취소/다운로드와 기존 즉시 CSV 회귀를 포함한다. 양쪽 type/scoped lint/build 및 격리 headless core 8개 PASS다. core 결과는 실제 Ego96 또는 새 export UI 실측이 아니다. strict 명세 lint는 오류0·기존 FR011/NFR002 상태 경고2개이며 상태/경고를 숨겨 수용으로 처리하지 않았다.

| 구분           | 현재 근거                                                                                                           | 상태/범위                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Backend        | 실제 SQLite·DuckDB·JWT가 포함된 export-jobs 및 기존 CSV/condition 실행                                              | 6 suites/236 PASS (17 + 104 + 115)                                      |
| 권한 입력      | 실제 SQLite service-level malformed create 무쓰기; 직접 service auth epoch 검사; 별도 valid-JWT lifecycle HTTP 사례 | 선택 사례 PASS; auth epoch route별 HTTP 검증이나 전체 E02/E03 수용 아님 |
| Frontend       | `ExportJobs.test.tsx`와 기존 Explore export suite                                                                   | 14 suites/278 PASS                                                      |
| 실제 Ego/UI    | Ego96 사용자 제어, 새 UI 및 390/768/1440 실제 화면                                                                  | NOT_RUN                                                                 |
| 엔진/운영/수용 | MySQL 동시성, 운영, 물리 휴대폰, 사람 수용                                                                          | NOT_RUN                                                                 |
| Core isolated  | `core/playwright-001.log`                                                                                           | 8 PASS; actual Ego/new export UI 아님                                   |

소스에 있는 주요 backend 사례는 권한 거절 전 무쓰기, 동일 접수/경합 CAS, 기준 변경, 긴 SQL 중 queue 해제, 취소·lease 만료·새 service 인스턴스의 persisted-state 복구·stale 결과 fencing, 실패/부분 저장 rollback 후 재시도, 최신 결과를 보호하는 CAS 우선 정리, 저장 실패 시 sanitized 진단, auth epoch 재검사, 만료/무결성/권한 재검사, 단일 valid-JWT HTTP lifecycle route 흐름 및 읽기 재요청 무실행이다. FE 사례는 명시 동작, 모호한 접수 고정, 조건 변경 중 작업 보존, 목록 cursor, 늦은 응답 무시, 실행 응답 유실 후 fresh version 사용, 조건/버전 불일치 거절과 고정 파일 확인을 포함한다. 위 사례 목록 자체를 추가 검증 결과로 계산하지 않는다.

## 독립 검토

별도 native code-reviewer(Sol)는 오래된 실패 정리의 CAS 순서, SQL 없는 접수 검증, 백그라운드 저장 장애 진단과 최종 lease 경계를 검토했다. 각 보완 후 남은 lease 지적을 재검토해 추가 지적0/해당 수정 승인으로 보고했다. reviewer의 runtime 재실행은 없으며 위 최종236/278/core8 결과는 Main의 실행 확인이다. 검토는 운영·사람 수용을 대체하지 않는다.

## 전체 목표 추적

[UC-054](../use_cases/UC-054-export-comparable-analysis.md)와 [TC-050](../test_cases/TC-050-enterprise-analysis.md)의 E09/E10 및 비교 정답 E14에 연결한다. 선택된 BE 검증은 FR023 구현 slice의 근거이며 TC050의 E01~E14 전체 통과가 아니다. FR025 전체 비교 리포트/파일 업무 여정, 전체 FR014~025/NFR005~008 목표와 승인/수용 상태는 그대로 유지한다. 기업·고객 식별 정보, 원본 사례, 내부 출처 경로는 이 문서에 기록하지 않는다.

감사 `export.queued/running/ready/failed/cancelled`의 resourceId는 작업 ID, version은 작업 버전이다. 작업에 고정된 source/basis와 연결해 동일 소스의 여러 출력 사건을 구별한다. 본인 완료 알림 투영은 후속이다.
