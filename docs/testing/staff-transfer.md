# UC051 직원 검색·조직 이동 검증

2026-10-18 · Status: Draft · 기준 develop-v2/e27d7607 후속 작업. [설계](../plans/UC-051-staff-transfer.md)·[UC051](../use_cases/UC-051-manage-enterprise-access.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)의 FR016/FR017/NFR005/NFR007 선택 단위다. 전체16개 요건·TC050 수용은 Open이다.

## 구현 범위

기존 직원 목록은 현재 조직 admin의 로그인 ID/팀 부분 문자열·번호 검색과20명 cursor를 제공한다. 100자 초과/배열을 거절하고 SQL LIKE의 %, \_, !는 문자로 처리한다. 이메일/비밀번호/코드·다른 조직 검색을 제공하지 않는다.

별도 `staff-transfer` API와 접힌 화면은 본인 코드 발급/상태/철회→대상 admin 검토·member/팀 수락→원 조직 다른 admin 검토·최종 이동이다. code는64hex·15분이며 서버에는 hash만 저장한다. 관리자 review 응답은 직원번호·조직번호/버전·팀·수락 여부·만료·opaque reviewBasis다. 최종 저장은 수락 내용 digest, 당사자3명의 현재 활성/epoch/소속/역할, 양쪽 조직 version을 다시 확인한다. 다른 요청/재수락/만료/철회/epoch/버전 변경은 쓰기 없이 거절한다.

이동은 회원 소속/member/대상 팀·양쪽 조직 version·JWT epoch+1/jwtId=null·관계 회수·감사를 한 transaction으로 저장한다. 직원이 admin이더라도 본인이 자신을 이동할 수 없어 원 조직에 다른 현재 admin이 남아야 한다. 대상에서는 항상 member다. target admin 수락 감사와 양쪽 완료 감사를 보존한다. 같은 완료를 다시 요청하면409이며 소속/본인 상태 조회로 결과를 확인한다. 자동 재전송·새 이동은 없다.

## 보존과 권한

모든 조직의 해당 직원 incoming/outgoing 직접 grant를 false/version+1, 개인 delivery active/allowCopy=false/version+1, 소유자의 group grant/delivery를 회수하고 그룹 가입을 제거/group version+1한다. 과거·비활성·대상 조직의 잠재 관계도 자동 활성화하지 않는다. 다른 사람의 그룹 grant/가입은 유지한다. 원본/파일 경로·소유 ID·대시보드/독립 사본·게시 snapshot·과거 감사/영수증을 변경하지 않는다.

자료는 개인 소유를 유지한다. 현재 조직은 소유자 소속으로 판단하므로 조직 문맥은 이동하지만 새 조직에 자동 읽기/관리 권한을 부여하지 않는다. 이전 조직이 직원 소유 자료를 계속 써야 하는 업무 이관은 별도다. 게시/대시보드는 현재 원 소스 read·게시 권한에 따라 접근이 달라질 수 있으며 행 보존이 계속 열람을 보장하지 않는다.

## 테스트 구조와 실행 경계

`staff-transfer.spec.ts`는 동일 서비스/보호 Nest HTTP/실제 JwtAuthGuard·AuthService refresh 경로를 SQLite와 opt-in MySQL에서 실행한다. UI/브라우저 또는 실제 IdP/운영 서버 증거가 아니다. `node scripts/verify-semantic-mysql.cjs --staff`는 새 tmpfs MySQL8.4 컨테이너·loopback 동적 포트·0600 config·server UUID/schema/owner marker 확인 후 별도 staff schema만 사용한다. 기본 semantic 실행 경로는 유지하며 staff 실행은 DuckDB 집계를 사용하지 않는다. Docker 종료·부분 생성·credential 마스킹은 기존 runner 경계를 재사용한다.

선택 검증은 검색 격리/문자 escape, 세 당사자/만료/epoch/CAS/취소/교체, A→B→A 권한 비부활, 자료/독립 사본/게시 행 불변, access/refresh 회수, 늦은 감사 실패의 전체 rollback, 새 additive migration 반복/손상 shape 중단을 구별한다. 실제 MySQL 전용은 별도 DataSource 동시 finalize와 직접 권한/그룹 writer의 실제 performance_schema 잠금 대기를 확인한다.

## 실행 결과

실행 로그는 Git 제외 `.aiwf/evidence/UC051-staff-transfer/`에 보존한다. 초기/후속 실행은 겹치며 합산하지 않는다. 최종 실행 결과는 아래와 같다. MySQL24는 같은21개 기본 사례와 MySQL 전용3개이며 SQLite21과 더하지 않는다. BE128도 선택 신규 사례를 포함하며 누계가 아니다.

| 실행                              | 결과                                     | 로그                                                                                                                            |
| --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 첫 실제 MySQL                     | 15 PASS/3.364초                          | `mysql-initial.log`; 보강 전 역사                                                                                               |
| 잠금/검토 보강 MySQL              | 24 PASS/3.597초                          | `mysql-locks.log`; 후속과 중복                                                                                                  |
| 보존 범위 보강 최종 MySQL8.4.11   | 24 PASS/2.994초·exit0·fixture 정리 PASS  | `mysql-assets-final.log`                                                                                                        |
| 관련 BE 회귀7 suites              | 128 PASS/3 SKIP/5.61초                   | `backend-regression-final.log`; MySQL 전용3개만 SQLite에서 제외                                                                 |
| 최종 원본/지표/Studio 보존 SQLite | 21 PASS/3 SKIP/2.917초                   | `backend-assets.log`; 위128과 중복                                                                                              |
| 기본 semantic MySQL runner 회귀   | 64 PASS/11.747초·exit0·fixture 정리 PASS | `semantic-runner-regression.log`; 직원 이동 검증과 구별                                                                         |
| FE2 files                         | 31 PASS                                  | `frontend-tests.log`; API/component이며 실제 화면이 아님                                                                        |
| BE type/scoped lint/build         | exit0                                    | `backend-types.log`, `backend-lint.log`, `backend-assets-lint.log`, `backend-build.log`                                         |
| FE type/scoped lint/build         | exit0                                    | `frontend-types.log`, `frontend-lint.log`, `frontend-build.log`                                                                 |
| scoped UC051/TC050 strict         | 각각 오류0·경고0·exit0                   | `spec-uc051.log`, `spec-tc050.log`                                                                                              |
| 전체 strict                       | 기존 오류17·경고5·exit1                  | `spec-global-final.log`; 원격 통합으로 들어온 중복 FR/NFR ID·기존 coverage/status 경고, requirements.md는 이번 HEAD와 byte 동일 |

실제 임시 CSV bytes·소스/소유·저장 지표 정의·독립 대시보드/소유 연결·Studio 문서·게시 snapshot 행을 이동/왕복 전후 비교했다. 실제 SQL 집계/게시 링크 열람 UI를 새로 수행한 검사는 아니다. 두 연결 잠금 사례는 서로 다른 connection ID의 performance_schema.data_lock_waits를 확인한 뒤 이동 commit 후 오래된 권한/그룹 writer가403인 것을 검증했다. 동시 finalizer는 성공1/409 하나·epoch 증가1·완료 감사2다(별도 수락 감사1).

초기 관련 회귀는 기존 그룹의 비활성/다른 소속 구성원 보존 계약을 불필요하게 제한해1개 실패했다(`backend-regression.log`). 해당 변경은 되돌리고, 직원 이동의 가입 해제·group version 증가와 writer의 첫 snapshot 전 잠금으로 보호했다. 기존 실패를 통과로 바꾸지 않고 최종7 suites128 PASS로 구별한다. TypeScript/ts-jest 버전 및 Vite loader 경고는 기존 도구 경고이며 검사 실패와 섞지 않는다.

## 독립 검토와 수정

독립 검토에서 수락 내용이 바뀌어도 이전 review의 조직 version만으로 이동하는 문제와 migration의 nullable/type/length/default 미검사를 재현했다. 수락 digest reviewBasis·변경409/재검토 회귀와 실제 기존 테이블 shape 변형/무변경 중단 검증으로 보완했다. 후속 독립 정적 검토에서 기존 두 지적의 수정과 별도3파일 잠금 패치는 각각 APPROVE·잔여0이었다. 검토자는 MySQL을 재실행하지 않았고 위 실제 실행은 메인 실행 증거다. 단순 명세 pin은 승인·실행 증명이 아니다.

## 남은 수용

탈퇴/조직 자체 비활성·조직 소유 자산의 업무 이관·전 보호 경로/모든 writer 및 이미 전달한 데이터 회수·서버 재시작·실제 Ego/모바일/물리 휴대폰·기존 운영 데이터 migration·사람 수용은 별도다. 코드 원문을 잃은 본인은 철회/재발급할 수 있지만 다른 관리자가 secret을 재조회하지 않는다. 공유/복제 미확정 reload·출력 프로세스 재시작은 전체 완료 계획의 후속으로 남긴다.

## Ego 실제 화면 후속 — 2026-10-19

[후속 증빙](staff-transfer-ui.md)의 단일 Ego101/격리 SQLite 화면에서 검색→동의 발급/철회→양쪽 admin 검토/수락→수락 변경409·재조회/재검토→이동→재로그인/reload와390/768/1440을 확인했다. 초기 null 직렬화·구조화 오류 사유·알려진 거절 안내·검색 정렬을 보완했다. 후속 MySQL25는 같은 직원 spec의 JSON null 회귀1개를 포함하며 이전24와 합산하지 않는다. 이번 실제 UI를 MySQL 앱 브라우저/실기기/운영/전체 수용으로 승계하지 않는다.
