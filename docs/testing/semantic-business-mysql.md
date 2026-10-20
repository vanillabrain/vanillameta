# UC050 고정 업무 기준 — 로컬 Docker MySQL 검증

2026-10-18 · 기준305bc9af 이후 테스트 후속 · [설계](../plans/UC-050-semantic-mysql.md) · FR014/015/018·NFR005/006/008·TC050 E01/E04/E08/E13/E14 선택 증빙이다. 전체16개 요건/TC050, 운영 migration·실제 MySQL 웹 서버·사람 수용을 완료한 것은 아니다.

## 실행한 구조

테스트 전용 MySQL **8.4.11 metadata**와 **native DuckDB 집계**를 사용한다. 새 loopback 임의 포트·tmpfs Docker 컨테이너와 두 개의 랜덤 소유 schema를 만든다. 기존 사용자 컨테이너·DB·원천 파일은 변경하지 않는다. config0600/owner/서버 UUID·버전·DB명·marker가 맞을 때만 TypeORM 테스트 schema를 준비한다. 이 synchronize는 소유 fixture 전용이며 운영 migration 증명이 아니다. 새 제품 테이블/DDL·집계 엔진·제품 소스 변경은 없다.

같은 Studio·runtime spec을 SQLite 기본 모드와 MySQL opt-in 모드로 재사용한다. Studio의 LLM 응답·snapshot/version 연결은 기존 fixture다. 집계 SQL은 실제 native DuckDB가 실행한다. runtime suite는 실제 ConnectionService/파일 pin·현재 권한을 사용한다. 실제 Codex·화면은 [직전 별도 증빙](semantic-business-basis.md)을 따르며 이번 MySQL 실행에 승계하지 않는다.

재현은 Docker와 기존 의존성이 준비된 저장소 루트에서 `node scripts/verify-semantic-mysql.cjs`다. 이미지 mysql:8.4를 실제 서버 VERSION()으로 확인한다. 실패를 SQLite로 바꾸어 통과시키지 않는다. 환경 config는 자동 생성·정리하며 비밀번호/원문 자료를 Git에 넣지 않는다.

## 실제 검사

- 숫자 범주101/102와 금액10/20/30의 총합60·날짜별30/30·범주별40/20, 세 문자열 날짜 형식·native DATE·NULL·윤일·표본 밖 invalid·큰 DECIMAL.
- 직접 신규 지표의 used-column 기준 저장·연결 재초기화/reload·V1 역사 보존과 새 V2 생성. 새 category SUM 거절과 기존 native metric 유지.
- Studio 전체 제안·명시 최신 채택·비대상 native/defaultDateColumn·원자 저장·영수증 재확인·게시·중지·복제/대상 소스 기준 재연결·공개 SQL/미사용 업무 schema 비노출.
- 실제 SQL 뒤 계정/epoch·조직·파일 변경의 거절, prepare 후 파일/기준 변경·409와 저장본/질문 보존, 실제 이력 위조·누락 차단.
- **두 DataSource/서로 다른 connection ID:** User FOR UPDATE를 잡은 연결과 저장 연결의 실제 `performance_schema.data_lock_waits`를 관찰한다. blocker/requester ID가 다름을 확인한 뒤 epoch 변경을 commit하면 대기한 저장이401이고 산출물/영수증 수는 불변이다.
- **동시 게시:** 별도 서비스·연결에서 같은 요청 UUID/저장 revision을 게시해 같은 token/version·영수증 증가1·해당 대시보드 게시 행1을 확인한다.
- **rollback/재충돌:** 실제 Dataset/Widget/Dashboard 등 쓰기 이후 강제 rollback 시 모든 수가 불변이다. 별도 연결의 최신 제목 변경 후 prepared 저장은409이며 최신 제목을 유지한다.

DB 재연결은 실제 서버 프로세스 재시작·브라우저 새로고침과 구분한다. 예외 주입은 테스트 스코프이고 원본이나 운영 장애를 만들지 않는다.

## 결과와 로그

로컬 증거 위치는 `.aiwf/evidence/UC050-semantic-mysql/`다. 반복 배치는 합산하지 않는다.

| 실행                    | 결과                                             | 근거                                                             |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| 첫 실제 MySQL           | 2 suites61 PASS/9.574초                          | `mysql-initial.log`                                              |
| 두 연결 추가            | 2 suites64 PASS/8.975초                          | `mysql-concurrency.log`; 위61 포함                               |
| ID 대조·정리 보강 후    | 2 suites64 PASS/10.646초                         | `mysql-final.log`; 위 실행과 중복                                |
| 안정 실행               | 2 suites64 PASS/13.419초·exit0·소유 정리 PASS    | `mysql-stable.log`; 이전64에 더하지 않음                         |
| 기본 SQLite와 소유 gate | 3 suites69 PASS/3 SKIP/7.039초                   | `sqlite-final.log`; SKIP3은 MySQL 전용으로 실제 MySQL에서는 실행 |
| type/scoped lint/build  | exit0                                            | `types-final.log`, `lint-final.log`, `build-final.log`           |
| 부분 생성 정리          | 예상 exit1, 소유 컨테이너·credential 정리 PASS   | `probe-partial-create-final.log`                                 |
| 실제 SIGTERM 정리       | 예상 exit143, 소유 컨테이너·credential 정리 PASS | `interrupt-stable.log`; 검사 ready 후 Jest 시작 전 중단          |

소유 gate8개는 잘못된 host/owner/schema/port·공개 파일 mode·symlink를 연결 전에 차단하고 UUID/marker 불일치는 synchronize 전에 연결을 닫는 검증이다. 테스트 한 개의 제목만으로 전체 권한/경합 또는 운영을 검증했다고 계산하지 않는다.

## 발견·수정·검토

제품 로직의 MySQL 불일치는 이번 선택 범위에서 발견하지 않았다. 테스트의 SQLite 식별자 인용을 두 엔진에 맞추고 fixture의 MySQL 소유 gate·새 연결 검사·실제 잠금 검증을 추가했다.

독립 검토에서 runner의 SIGINT/SIGTERM·부분 Docker 생성 실패 정리, stream 청크 경계의 비밀번호 마스킹, 실제 두 연결 증거 부족을 지적했다. 신호 시 자식 종료/기한·멱등 정리, ID 미확정이면 이번 랜덤 이름/label 대조, UTF8 전체 line 버퍼 마스킹, requester/blocker connection ID 검사로 보완했다. 마스킹은 코드 검토 범위이며 비밀번호를 로그에 실제 유출해 시험하지 않았다.

중단 probe 첫 실행은 이미 destroy한 mysql2 admin에 end를 기다려 Node가 정리 전에 종료하는 문제를 재현했다. 해당 소유 ID·label·이름과 config0600 marker를 대조해 남은 이번 fixture만 정리했다. admin 종료를 중복 호출하지 않고 즉시 종료 코드를 고정하도록 수정해 실제 SIGTERM 정리까지 다시 검증했다. 초기 `probe-interrupt.log`/`probe-interrupt-initial.log` 실패 기록은 보존한다. 종료 probe에서는 mysql2의 packet 순서 warning도 출력된다. 실제 종료143·소유 컨테이너/credential 제거를 별도로 확인했으며 이 warning을 제품 SQL 실패나 누락 정리의 통과로 바꾸어 기록하지 않는다. 준비 중 없는 guard spec 경로를 실행한 테스트 설정 오류도 `sqlite-missing-guard.log`에 남기고 실제 파일 생성 후 재검증했다. 실패 로그를 통과 근거로 사용하지 않는다.

최종 독립 정적 검토는 보완한 네 항목에 APPROVE·추가 지적0이었다. 검토자가 실행을 재수행한 것은 아니며 위 실행 로그와 구분한다. 전체 strict 명세 검사는 기존 FR011/NFR002 경고2개로 exit1, 이번 UC050/TC050 범위는 각각 오류0·경고0이다.

## 원격 변경 통합 후 확인

push 직전 원격 develop-v2의 Rill 시나리오·집계/수식 변경(c13773b8)을 발견해 이번 커밋을 rebase했다. 통합 상태의 실제 MySQL은64 PASS/18.873초·소유 fixture 정리 PASS, 기본 SQLite는69 PASS/3 SKIP/13.409초다(`mysql-integrated.log`, `sqlite-integrated.log`). 백엔드 type/build도 exit0으로 다시 확인했다(`types-integrated.log`, `build-integrated.log`). 앞선 배치와 합산하지 않는다.

## 남은 항목

이번 선택 MySQL gate만 확인했다. 운영 기존 데이터/migration·모든 writer·모든 SQL/자연어 조합·실제 MySQL 앱 HTTP/브라우저·Ego/물리 휴대폰·전체 TC050/업무 수용은 NOT_RUN이다. 실제 export 프로세스 재시작·전 역할별 회수 경로·미확정 공유/복제 reload도 별도다. [16개 수용 점검](enterprise-acceptance-audit.md)과 [완료 계획](../plans/enterprise-completion.md)에 구현·검증·운영/사람 잔여를 구분했다.
