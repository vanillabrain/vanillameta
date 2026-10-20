# UC051 계정 유일성·조직 소속 무결성과 MySQL 경합

FR016/017·NFR005/008·TC050 E02/E03 후속. 기준a130ad35이며 전체16개 목표를 유지한다. Signup의 userId/email 중복 거절과 조직 소속 계정 삭제409를 실제 DB 제약과 공통 잠금으로 지킨다.

## 스키마·기존 데이터

User.userId/email에 명명된 unique index, enterprise_membership.userId→user.id에 RESTRICT FK를 추가한다. 신규 sync 모델과 기존 DB용 additive migration의 정의를 일치시킨다. up은 기존 중복/NULL/소속 고아·참조 컬럼 호환을 모든 DDL 전에 검사한다. 비정상 데이터가 있으면 식별값 없이 종류/개수만 알리고 중단하며 사용자/소속을 자동 삭제·합치거나 바꾸지 않는다. idempotent up과 데이터 보존을 검증하고 down은 검토된 백업 계획 없이 거절한다.

MySQL DDL은 암시 commit될 수 있으므로 운영에서는 writer 중지·백업/진단 후 적용한다. 이 작업은 운영 DB에 마이그레이션을 실행하지 않는다. 깨끗한 신규 baseline에서 테이블이 아직 없으면 기존 sync 생성 순서를 유지하고, 기존 컬럼이 불완전한 사용자 테이블을 성공 적용으로 가장하지 않는다.

## mutation 경계

MySQL 가입 경쟁의 unique 충돌은 기존 userId/email409로 매핑하고 성공한 가입1개만 샘플로 연결한다. 프로필 이메일 중복도409로 거절하며 다른 계정/기존 비밀번호·이메일을 변경하지 않는다.

계정 삭제는 비밀번호 검증 후 transaction에서 현재 User 행을 잠그고 credential/active를 재확인한 뒤 membership을 검사하고 삭제한다. 조직 생성/편입도 같은 대상 User 행을 잠그며 삭제와 같은 계정의 논리 참조 경쟁을 직렬화한다. 조인 후 삭제는409, 삭제 후 조인은 거절하고 membership 고아0·실패한 CAS/동의코드/감사 rollback을 유지한다. MySQL row lock과 SQLite 공통 큐를 사용하며 FK는 누락된 호출자에도 마지막 방어선이다. 실패 constraint/deadlock은 상태 변화 없이409/기존 거절로 연결한다.

## 검증·종료

실제 SQLite에서 제약 없는 duplicate/orphan 허용을 RED로 재현하고 schema sync/migration up2회·기존 데이터/실패 전 DDL0·DB 제약/409를 확인한다. 격리 로컬 Docker MySQL8.4에서 실제 migration·동시 가입(같은 ID/다른 email 및 다른 ID/같은 email)·편입/삭제 양순서와 held row lock을 검증한다. 생성한 컨테이너만 ID/label로 확인해 정리하고 기존 컨테이너/개인 DB는 건드리지 않는다. credential은 Git 제외 임시 파일에 두며 로그/응답/커밋에 쓰지 않는다. 기존 SQLite/권한/토큰·Studio 회귀/type/lint/build/core·독립 검토·문서/strict/pin/check/packet·비공개 검사 후 commit/push한다. Ego/모바일·실휴대폰·운영·전체 TC050은 별도다.

Legacy password rehash도 전체 User 저장 대신 password/active/epoch 조건의 부분 CAS로 갱신한다. 비활성/epoch 변경이 먼저 commit되면 로그인은 거절하고 비대상 계정 상태를 복원하지 않는다. 실제 MySQL의 해시 저장 gate→관리자 비활성→늦은 완료를 RED/수정으로 확인한다.

현재 계정 transaction의 직접 비밀번호 재검증이 이전 내부 checkAccess 별칭을 대체해 미사용 별칭과 테스트 stub을 제거한다. 저장소 호출자/타입 검사로 참조0을 확인한다. Enrollment 만료 코드 등 다른 자산의 고아/FK·정리는 이 membership 무결성 보장과 구분한다.

조직 CAS는 권한을 확인하며 읽은 현재 버전과 요청 expectedVersion이 같을 때만 UPDATE를 시도한다. 미래 버전 요청이 중간 비활성 commit의 버전과 우연히 일치해 낡은 권한으로 쓰는 경로를 차단한다. 읽은 버전이 같아도 이후 경쟁은 UPDATE의 기존 version CAS가 거절한다.
