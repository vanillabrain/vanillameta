# 조직 공통 분류와 변수 연결 — 선택 검증

2026-10-18 · UC050 · FR014/015·NFR005/007/008 · TC050 E01/E02/E03/E12/E13. [계획](../plans/UC-050-classifications.md)의 구현·선택 실행 기록이다. 기준 6a2c9996 이후 작업 트리를 대상으로 하며 registry, catalog, FE의 최종 통합 상태를 구분한다. 전체 FR015/TC050·추가16개 요건의 수용 완료가 아니다.

## 계약과 보존

- 현재 활성 구성원은 본인 조직 분류 목록을 읽으며 현재 admin만 생성·이름/활성을 변경한다. 사전 admin은 소스 read/edit를 자동으로 얻지 않는다. 응답에는 소스·열·사용처·nameKey·계정 비밀을 넣지 않는다.
- 이름은 NFKC→trim 후 UTF-16 길이1~80이며 원문/정규화 이름의 제어문자·단독 surrogate를 거절한다. 정규화 이름의 lowercase UTF8 SHA256 hex64가 조직별 unique key다. 비활성 이름도 예약하며 재활성화는 같은 ID를 유지한다.
- GET `/enterprise/classifications?afterId`는 raw `{actorId,organizationId,canManage,entries,nextAfterId}`이며 id순20개+cursor다. POST collection은 `{expectedActorId,expectedOrganizationId,requestId,name}`, 응답은 raw `{actorId,organizationId,entry,replayed}`다. POST `/:id`는 `{expectedActorId,expectedOrganizationId,expectedVersion,name,active}`, 응답은 raw `{actorId,organizationId,entry}`다. entry는 `{id,name,active,version}`이고 응답은 no-store다. authVersion은 본문이 아닌 검증된 JWT actor에서만 받는다.
- User→membership→분류 순으로 잠그고 queue/transaction 진입 후 현재 활성·epoch·조직·admin을 확인한다. 새 분류/생성 영수증/감사는 원자 저장한다. 같은 UUID/canonical 본문/조직은 최초 생성 결과를 재확인하며, 다른 본문/조직은409다. CAS는 미래/낡은 버전을 쓰기 전에 거절하고 무변경은 행·감사 추가0이다.
- 생성 영수증의 entry는 **사건 당시 snapshot**이다. 이후 이름/활성/버전이 바뀌어도 과거 결과이며 현재 분류 상태·새 연결 허용 증명이 아니다. 손상 JSON·추가 필드·다른 actor/org·잘못된 ID/이름/active/version은409이며 비공개 내용을 반환하지 않는다. 현재 상태는 목록을 명시적으로 다시 읽는다.
- `BusinessVariable.classificationRef?: {organizationId,id,version} | null`은 catalog metadata의 역사적 연결이다. 기존 bound ref의 생략은 연결/이름 보존이며 문자열만 바꾸면 거절한다. ref 없는 legacy/해제된 열은 ref 생략 시 제공한 자유 문자열 편집을 허용하고 문자열도 생략하면 보존한다.
- **명시 `classificationRef:null`은 해제 상태로 저장·preview draft·조회/이력에 그대로 남긴다. 생략으로 바꾸지 않는다.** bound ref 해제는 기존 이름을 보존하고 diff에 드러내며, 다음 별도 편집에서 자유 문자열을 바꿀 수 있다. 같은 ref 보존은 현재 사전 재조회를 강제하지 않는다.
- 신규/변경/명시 최신 채택만 현재 소스 edit·조직·활성 분류·정확 버전을 검사하고 서버가 이름을 채운다. 사전 이름/활성·소속 변경은 과거 catalog 이름/ref를 자동 갱신하지 않는다. source/file/schema/catalog CAS와 분류의 최종 잠금 재검사를 유지한다. ref는 ConditionSemantics·SQL·저장 분석·게시·출력 숫자를 바꾸지 않는다.

## 생성 결과 불명확과 reload 계약

분류 생성의 미확정 요청은 UUID/본문을 고정한다. `classificationCreate` 복구는 최소 요청만 탭 sessionStorage에 현재 로그인 세대/actor/조직 scope로24시간·8KiB 보관한다. 정상 토큰 갱신은 같은 scope를 유지하고 새 로그인/다른 actor·조직의 요청은 복구하지 않는다. reload 후 현재 목록/조직/권한을 먼저 확인하고 **명시 동일 요청 확인만** 제공하며 자동 POST하지 않는다. 확정 성공/명시 폐기 때 기록을 지우고 저장소 오류는 다른 초안·질문을 지우지 않는다. 기본 응답 유실→reload→동일 요청 확인은 아래 ui-second에서 확인했다. FE helper의 저장소 read/delete 실패 처리는 수정했고 FE8 suites/102 PASS·types/lint/build를 확인했다. 그 뒤 core-final15 PASS와 마지막 receipt/pagination 보강의 영향13 PASS·types/lint/build, 수정 후 ui-stable2 PASS·Jason 최종 FE APPROVE0를 확인했다. 과거 영수증을 페이지 밖 현재 목록에 삽입하지 않으며 최신 상태는 cursor를 유지한 명시 load-more로 확인한다.

## 확인된 실행

| 배치                                              | 실제 결과                                                   | 범위 / 증빙                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry SQLite/unit + 실제 JWT HTTP              | 2 suites / 47 tests PASS                                    | 이름 equality·20개 cursor·actor/org/역할·epoch queue·멱등 생성/손상 영수증·CAS·감사 rollback·소스 edit 분리. `.aiwf/evidence/UC050-classifications/registry-tests.log` |
| Registry 타입 / scoped lint                       | 각각 exit0, 빈 로그                                         | `registry-types.log`, `registry-lint.log`; 정확 명령은 같은 디렉터리 `registry-commands.txt`                                                                           |
| 격리 실제 MySQL8.4.11 + native DuckDB 최종 재평가 | 15/15 PASS / 8.924초 / exit0                                | `mysql/012cc0ef4aaf8413895de8ec.log`·`public-read-rerun-final.json`; read-guard 반영 후 현재8개 source hash 실행 중 불변·owned CLEANUP PASS                            |
| Catalog read/JWT 보강 후 선택 검사                | 5 suites / 135 PASS / 14.818초 / exit0                      | `catalog-tests.log`·`catalog-README.md`; 이전119/120은 중복으로 합산하지 않음                                                                                          |
| Catalog 타입 / scoped lint / 격리 build           | 각각 exit0, 빈 로그                                         | `catalog-{types,lint,build}.log`; shared dist build 아님                                                                                                               |
| BE 독립 최종 검토                                 | Bernoulli APPROVE / 0 findings                              | read/JWT guard finding 해소; FE 승인은 별도                                                                                                                            |
| 새 분류 실제 UI ui-second                         | 1 PASS / 9.7초 / exit0                                      | `ui-second/playwright-001.log`; commit 후503·reload·동일 UUID/body 확인·entry1·두 source 연결/보존/채택/해제                                                           |
| Source/조직 화면390/768/1440                      | Main 열람·overflow0·controls36px                            | ui-second 화면/측정 JSON; 입력은900px 미만16px, desktop14px의 기존 토큰 유지                                                                                           |
| FE helper read/delete 실패 처리 후 선택 검사      | 8 suites / 102 PASS·types/lint/build PASS                   | `fe-final-{tests,types,lint,build}.log`·`fe-README.md`                                                                                                                 |
| Main 최종 BE 통합                                 | 10 suites / 293 PASS·global types/lint/build PASS           | `backend-integration.log`·`backend-{types,lint,build}-final.log`; registry47/catalog135/condition regression111 포함                                                   |
| core-final 실제 UI/회귀                           | 15 PASS / 51.0초 / exit0                                    | `core-final/playwright-001.log`; 해제 후 자유 문자열 편집/reload·controls viewport capture 확장. 마지막 receipt/pagination 보강 전 실행                                |
| 마지막 FE receipt/pagination 보강                 | 영향 Classifications 1 file / 13 PASS·types/lint/build PASS | `fe-receipt-{tests,types,lint,build}.log`; 기존102와 중복·새3개 포함, 합산 금지                                                                                        |
| 수정 후 최종 실제 UI ui-stable                    | 2 PASS / 13.4초 / exit0                                     | `ui-stable/playwright-001.log`; 확장 전체 흐름과 별도 off-page 역사 영수증/현재 목록 회귀                                                                              |
| FE 독립 최종 재검토                               | Jason APPROVE / 0 findings                                  | receipt/pagination/storage findings 해소                                                                                                                               |
| 초기 controls 시각 열람                           | 약7px 정렬 문제 발견 후 수정                                | 유형/날짜 custom label+NativeSelect를 분류와 같은 TextField select로 통일                                                                                              |
| 시각 수정 후 실제 UI 재검증                       | 2 PASS / 13.1초; 영향 FE suite23 PASS·types/lint/build PASS | `ui-alignment/playwright-001.log`, `fe-alignment-README.md`; 768px top702/702/702, 1440px top710/710/710·차이0px                                                       |

BE 최종293은 registry47+catalog135+condition regression111을 포함하므로 이전47/135를 다시 더하지 않는다. FE102와 마지막 영향13은10개 중복·새3개를 포함하므로102+13으로 합산하지 않으며, 새 전체 FE 배치가 실행된 것으로도 표현하지 않는다. core-final15 뒤 마지막 receipt/pagination 보강이 있었고 그 수정 후 우선 UI 증거는 ui-stable2다. 이전 ui-second1/다른 UI 배치와 더하지 않는다. MySQL15도 별도 실행 범위로 기록한다. MySQL 최종15는 read-guard 이전15와 같은 선택의 재실행이므로 이전15를 더하지 않는다. MySQL 최초14 PASS/1 FAIL은 native DECIMAL 문자열 정답 기대값 수정 뒤 같은 선택15개를 새 fixture로 전부 재실행한 결과로 대체한다. 두 단계 결과를 더하지 않는다. 이 기록의 실행 당시 결과를 이후 다른 lane 변경의 최종 통과로 추정하지 않는다.

실제 ui-second는 서버 commit 후503 응답으로 바꾼 생성 요청을 reload한 뒤 자동 POST0을 확인하고, 명시 재확인 요청의 UUID와 전체 본문 동일·같은 생성 entry·목록의 동일 이름 entry1을 대조했다. 두 source에 같은 분류를 저장/reload하고 rename 뒤 과거 이름 유지→한 소스만 명시 최신 채택→비활성 분류의 기존 연결 보존→명시 null 해제/reload를 확인했다. Source/조직 화면의390/768/1440 측정과 Main 열람에서 overflow0·controls36px를 확인했다. 최초 UI 실패는768px 입력을14px로 기대한 테스트 가정이었다. 기존900px breakpoint의 입력16px/desktop14px 계약으로 기대값만 수정한 ui-second가 통과했으며 UI 제품 토큰을 바꾸거나 최초 실패를 숨기지 않는다. helper 실패 처리 수정·FE102 뒤 core-final15 PASS/51.0초를 확인했다. 그 이후 마지막 receipt/pagination 보강을 완료해 영향13 PASS·types/lint/build와 아래 ui-stable2 PASS, Jason 최종 APPROVE0로 대체 확인했다.

마지막 수정 후 **ui-stable2 PASS/13.4초**의 첫 시나리오는 전체 연결/rename 보존/최신 채택/비활성/명시 해제에 더해 해제 후 자유 label 편집·reload와390/768/1440 controls capture를 확인했다. 별도 시나리오는20개 seed로 생성 entry를 첫 페이지 밖에 두고 commit503 뒤 서버 rename/비활성 version2→reload→같은 요청 replay version1을 확인했다. 역사 version1 영수증은 현재 목록에 삽입하지 않으며 명시 load-more가 현재 version2/inactive를 읽고 목록은21개 고유 ID를 유지한다. 생성 영수증과 현재 분류 상태를 분리한 실제 DOM/API 검증이다. Main은 최종6개 capture에서768/1440 업무 유형/날짜와 분류 입력 상단의 약7px 차이를 발견했다. 기존 전체 폭/높이 측정 통과가 이 행 정렬을 검증한 것은 아니다. 동일 TextField select로 통일한 후 ui-alignment2 PASS/13.1초로 전체 흐름과 과거 영수증 경계를 재검증했다. Source390/768/1440 overflow0·높이36px를 유지하며, 768/1440 세 필드 top 차이는 각각0px다. Main은 수정한 Source768/1440 controls capture를 다시 열람해 정렬을 확인했다.

MySQL 검증은 실제 두 DataSource·InnoDB 대기를 관찰했다. 분류 CAS 경쟁과 User epoch 변경 뒤 대기 요청 거절, 서버 audit/receipt insert 실패의 전체 rollback, migration 반복/unique equality/재연결 영수증을 확인했다. 실제 SourceCatalogService의 두 DuckDB 소스가 같은 분류ID를 연결하고, 사전 rename 뒤 과거 이름 유지→명시 최신 채택→선택 소스의 새 버전 저장을 확인했다. 전체 날짜 검증·원래 집계 정답 보존, 비활성 신규 연결 차단/기존 ref 보존·null 해제/후속 자유 문자열, catalog 저장의 분류 잠금 대기 후 stale409·이력 append0도 포함한다. 경쟁의 peer 쪽은 직접 DB 변경이며 양쪽 모두 공개 API를 호출한 검증으로 확대하지 않는다.

MySQL runner의 초기/이전 실행과 read-guard 후 최종 재실행은 본인 소유로 표식한 격리 container/volume과 임시 credential/native fixture만 정리했으며 **CLEANUP PASS**다. 기존 사용자 자산·운영 DB 정리를 뜻하지 않는다. 공개 문서에 credential·원본 파일 경로·고객 식별값을 기록하지 않는다.

## 최종 결과와 수용 경계

BE10 suites/293 PASS·global types/lint/build PASS, FE helper 수정 후8 suites/102 PASS·types/lint/build PASS, 현재 read-guard 기준 MySQL15 PASS/8.924초·8개 source hash 실행 중 불변·owned CLEANUP PASS와 Bernoulli BE APPROVE0를 확인했다. core-final15 PASS/51.0초 이후 마지막 FE receipt/pagination 보강의 영향13 PASS·types/lint/build와 최종 수정 후 ui-stable2 PASS/13.4초, Jason FE APPROVE0를 확인했다. Bernoulli BE도 APPROVE0다. 위 자동 검사/리뷰는 해당 실행 시점의 증거로 유지한다. 시각 검토에서 발견한 약7px 차이는 동일 TextField select로 통일했다. 영향 FE23 PASS·types/lint/build 및 수정 후 ui-alignment2 PASS/13.1초를 확인했다. 768px의 세 필드는 top702px, 1440px는 top710px로 각각 차이0px이며 높이36px/overflow0이다. Main은 수정 후 대표 controls capture를 다시 열람했다. 기존102·영향13·영향23은 겹치므로 합산하지 않는다.

**Ego96 제어권 인수, 물리 휴대폰, 운영 migration/운영 검증, 사람 수용은 미실행**이다. 새 semantic 지표/차원 생성의 전체 업무 의미 적용과 전체 FR015/16개 요건 수용은 계속 열린다. 과거 조건 의미 단위의 core-stable14 PASS는 그 단위의 회귀이며 이번 core-final15 결과로 합산하지 않는다.
