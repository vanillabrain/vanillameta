# TC050 역할별 HTTP 권한·회수 검증

2026-10-19 · Draft / PASS_SELECTED. [설계](../plans/TC-050-access-matrix.md)·[UC051](../use_cases/UC-051-manage-enterprise-access.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md).

develop-v2/f82c7d5f + 이번 문서/검증 스크립트 기준이다. 실제 격리 Docker MySQL8.4.11·전체 Nest HTTP·native DuckDB로 현재 조직 역할과 자원 action을 대조했다. UI/실LLM은 실행하지 않았다. 기존 통과와 합산하지 않으며 전체16개·운영/사람 수용은 Open이다.

## 실행 환경과 결과

`scripts/qa-enterprise-mysql.cjs`의 새 빈 DB/69 tables·development synchronize를 사용했다. 운영 migration 검증이 아니다. 실행 전 소유 표식·Docker label/loopback port·server UUID·실제 API listener PID/부모 supervisor·API의 DB/파일 환경을 확인한 뒤만 fixture를 썼다. 환경/credential 자체를 로그에 출력하지 않았다. 최종 runtime은 새 소유 컨테이너이며 앞의 준비 실패/선택 성공에 쓴 DB와 구분한다. macOS Node22.23.1에서 실행했고 lsof/ps 기반 신원 검사는 이 실행 환경용이다.

합성 계정9개는 소유 admin, 비소유 admin, reader/editor/publisher/exporter 조합 member, 무권한 member, 소유 member, 다른 조직 admin이다. 익명과 비활성/이전 epoch 요청도 별도로 확인했다. reader 등은 영속 조직 role이 아니다. 원본 CSV는100/200/300, 수신자 본인 CSV는200/400/600이다. 명시 저장 지표를 연결한 대시보드 fixture를 기존 HTTP로 생성했으며 AI 생성 성공으로 집계하지 않는다. 비공개 게시만 사용해 익명 공개 링크는 만들지 않았다.

최종 새 DB 실행은 **HTTP 요청299건**(200=82,201=106,401=15,403=96), 고정 상태 거절111건, 의미 검증12개를 통과했다. 요청 수는 독립 테스트 케이스 수나 요건 완료율이 아니다. 모든 거절에서 dashboard/widget/dataset/metric/studio_state/studio_run/export_job/enterprise_resource_grant/enterprise_dashboard_delivery/database/user_mapping/dashboard_widget/export_part의 **13개 테이블 전체 행 수·정렬 내용 hash**가 요청 전후 같았다. 로그인 이력·알림·감사 등 나머지 테이블의 불변을 주장하지 않는다.

| 설계            | 실제 확인한 내용                                                                                                                                          | 판정/경계                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| M01             | 비소유 admin·무권한 member·타 조직·익명의 profile/지표/대시보드/Studio/access·관리 조회, query/Pivot 거절; 허용 목록 제외                                 | PASS_SELECTED. 인증401과 자원403 구분, 관리 POST도 비소유 admin 거절                                                        |
| M02             | read/edit/publish/export 조합별 상세/query/Pivot·권한 투영; editor의 지표 생성과 preview/save; publisher 비공개 게시; exporter CSV                        | PASS_SELECTED. 동일 유효 본문과 허용 성공을 대조. 연결정보/임의 SQL·재배포·읽기 소스로 신규 소유 분석 만들기는 거절         |
| M02 소유 member | 본인 상세/preview/save/비공개 게시 허용, 권한 관리 거절                                                                                                   | PASS_SELECTED. 허용 저장 이후 문서를 보존 기준으로 사용                                                                     |
| M03             | dashboard read/source read를 각각 회수하고 반대 권한만 남긴 조회                                                                                          | PASS_SELECTED. 대시보드 권한이 source 권한으로 전파되지 않음                                                                |
| M04             | 직접+그룹 read → 직접 회수/그룹 유지 → 그룹 제외·비활성·마지막 그룹 grant 회수                                                                            | PASS_SELECTED. 같은 JWT로 유지/403을 각각 확인                                                                              |
| M05             | 직접/그룹 전달 read와 수정/게시/복제 동의의 분리, source read 회수 시 받은 목록 제외·상세 거절, 전달 최종 회수                                            | PASS_SELECTED. allowCopy=false의 remix-reference 거절 포함                                                                  |
| M06             | 실제 CSV ready/sha256, 본인 queued 작업 취소, 타 actor/admin/타 조직 get/file/run/cancel 거절, source export 회수 후 목록/get/create/run/cancel/file 차단 | PASS_SELECTED. source read 유지 상태의 export 회수와 read까지 회수를 구분. 재부여 뒤 같은 CSV bytes 확인                    |
| M07             | 비활성 뒤 기존 JWT401, 재활성해도 옛 JWT401, 새 로그인 후 현재 source read만 허용/dashboard 거절                                                          | PASS_SELECTED. guard 통과 후 진행 중 commit 경합과 구분                                                                     |
| M08             | 실제 받은 분석 → 본인 소스로 복제 미리보기1200/저장 → 원본 전달·source 회수 → 독립 사본 조회/문서 보존, 원본과 별도 본인 분석 불변                        | PASS_SELECTED. 원본에는 별도 명시 editor 저장을 허용했으며 그 이후 기준을 보존. 전체 감사 필드/파일 시스템 전수 검사는 아님 |

## 발견·보완·재현

이번 권한 행렬에서 확인한 제품 결함은 없고 **제품 코드 변경0**이다. 검증 스크립트를 추가했다. 첫 준비에서는 임의 SQL 요청의 id 필드, componentType 조회 alias/중복 seed, group delivery의 entry.version 응답, macOS 임시 경로 별칭을 잘못 가정해 실패했다. 실패를 삭제하지 않고 fixture를 수정했다. 명시 지표 연결이 없는 임의 SQL 대시보드는 복제 미지원으로 거절되어, 정책을 완화하지 않고 지원되는 저장 지표 연결 fixture로 바꿨다.

보강 전260건/후속292건 통과는 별도 준비 실행이다. 최종 스크립트는 새 빈 DB에서299건으로 재현했으며 합산하지 않는다. role/policy·source 접근 회귀2 suites75개와 JWT/group auth2 suites38개도 이번에 실행해 통과했다. UI/제품 TS 변경이 없어 전체 FE/BE build·실LLM/Ego를 반복하지 않았다. 새 CJS 구문·Prettier·diff 확인 및 독립 code-reviewer 검토를 수행했다.

재현: 기존 실행기가 새 소유 runtime ready를 만든 뒤 `node scripts/qa-enterprise-access-matrix.cjs [runtime.json 경로]`를 실행한다. 스크립트는 arbitrary URL을 받지 않고 runtime/DB/HTTP listener 신원 불일치 시 fixture 쓰기 전에 실패한다. 스크립트는 runtime을 삭제하지 않으며 담당자가 인증된 control stop으로 자신이 만든 runtime만 종료한다. 최종 실행 후 소유 컨테이너/프로세스·임시 DB/config/credential 제거, 영속 volume0을 확인했다.

Git 제외 `.aiwf/evidence/TC050-access-matrix/`에 첫 실패·최종299건의 route/status, 환경 신원·13표 거절 보존, remix/CSV, 검사·리뷰·정리를 보존한다. 계정 비밀번호/JWT/DB credential은 public commit에 포함하지 않는다.

## 남은 경계

- Enterprise dashboard export는 권한 투영만 검사했다. 실제 CSV/영속 파일은 source export 경로다. Enterprise dashboard export를 소비하는 파일 경로는 현재 연결 공백이며, 별도 BI governance export 성공으로 대체하지 않는다.
- inventory의 모든 endpoint·action 조합은 전수 실행이 아니다. legacy URL-share/구 BI 게시, 별도 BI governance 조직 모델, 모든 Studio run/retry/cancel·복구 영수증, 이동/탈퇴 변형·잠금 대기 중 epoch 경합은 별도다.
- 알림 장애·전체 감사 필드/보존 정책·모든 writer/자연 만료·운영 migration/부하·실휴대폰·고객 업무/사람 수용과 전체 TC050/16개 요건은 Open이다. 이미 검증한 다음 요청 회수 동작은 미구현 잔여로 되돌리지 않는다.

## 경로 inventory — 코드 대조, HTTP 결과와 별도

URL은 `/v1` 기준이다. `JwtAuthGuard`가 현재 User active/authVersion을 검사한 뒤 자원 정책을 적용한다. 익명/인증 무효는401, 인증된 자원 권한 거절은403이다. 잘못된 입력400이나 CAS409를 권한 차단 성공으로 대신 세지 않는다.

| 경로 종류                                                                                  | 현재 계약/근거                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /database`, `/database/:id`, `/database/info/:id`; `POST /database/execute`           | SourceOwnershipGuard·SourceAccess의 owner 경계. `/database`는 소유 목록이며 grant read 목록이 아님. 연결 비밀/임의 SQL은 edit grant로 열리지 않음 |
| `GET /bi/sources`, `/bi/sources/:id/profile`, `/bi/metrics?sourceId=…`                     | BiService·SourceAccess의 현재 read. 허용 목록과 상세 거절을 구분                                                                                  |
| `POST /bi/explore/{catalog,query,values,pivot}`                                            | BiExploreService의 source read, 계산 전후 현재 기준 검사                                                                                          |
| `POST /bi/explore/export`                                                                  | source export와 read. dashboard export 권한을 대신 증명하지 않음                                                                                  |
| `GET /dashboard`, `/dashboard/:id`, `/ai/dashboard-analysis/:id`, `/studio/dashboards/:id` | dashboard read와 모든 연결 source read. 목록에서 제외되거나 상세403                                                                               |
| `POST /ai/dashboard-preview`, `/studio/dashboards/:id/preview`; 기존-ID 저장               | dashboard edit와 source read. 신규 소유 분석 생성·소스 교체는 별도 owner 경계                                                                     |
| `/bi/dashboards/:id/publication` 계열                                                      | dashboard publish와 source read. status/preview도 read 전용에게 링크를 노출하지 않음                                                              |
| `/studio/dashboards/:id/publications`, `/studio/publications/:token` 계열                  | publish 관리와 private/public read 구분. 인증 헤더가 잘못됐을 때 익명 fallback 금지                                                               |
| `/bi/export-jobs`, `/:id`, `/:id/{run,cancel,file}`                                        | ExportJobsService의 본인 작업·현재 조직/epoch·source export. admin도 타인 작업을 대신 열람하지 않음                                               |
| `/enterprise/resources/:kind/:id/{access,policies,group-policies}`                         | access는 현재 합산 read 필요. 관리 두 경로는 같은 조직의 자원 소유 admin만                                                                        |
| `/enterprise/deliveries/dashboard/{received,:id,:id/groups}`                               | 관리와 현재 받은 자료를 구분. delivery read는 원 source read·복제 동의를 대신하지 않음                                                            |
| `/studio/received/…`                                                                       | 현재 delivery/allowCopy·원 기준, 새 source는 수신자 소유. 저장 결과 확인은 본인 독립 사본 기준                                                    |
| `/enterprise/members`, `/enterprise/groups`                                                | 현재 조직 admin 관리·본인 동의/버전. 계정 비활성/epoch 변경 뒤 옛 JWT는401                                                                        |

근거 모듈은 `ownership/source-access.service.ts`, `enterprise/resource-policy.service.ts`, `bi/export-jobs.service.ts`, `bi/publication.service.ts`, `dashboard-studio/studio-publication.service.ts`다. 이 표는 독립 읽기 검토 결과이며 표의 모든 endpoint가 이번 HTTP 실행을 통과했다는 뜻이 아니다.

기존 `/bi/organizations/...` governance는 별도 BiOrganizationMember/Policy 모델이다. EnterpriseMembership의 회수를 같은 ID의 governance 회수로 해석하지 않는다. 두 조직 모델 통합·legacy URL-share·모든 run/retry/cancel·guard 통과 뒤 잠금 대기 중 epoch 변경·이동/탈퇴 전 변형은 별도 실행 범위다. 현재의 다음 요청 검사와 진행 중 요청의 commit 경합을 구분한다.
