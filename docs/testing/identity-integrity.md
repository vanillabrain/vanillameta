# UC051 계정 유일성·소속 무결성의 실제 MySQL 검증

2026-10-18 · develop-v2 · 기준a130ad35 · [설계](../plans/UC-051-identity-integrity.md). FR016/017·NFR005/008·TC050 E02/E03 기반 후속이며 전체16개 목표는 진행 중이다.

## 실제 엔진·재현

사용자 로컬 Docker Desktop Unix 소켓을 확인하고 공식 mysql:8.4 이미지의 격리 컨테이너 하나를 생성했다. localhost 임시 포트·랜덤 자격증명·전용 DB/서버 UUID를 사용하며 검증 스펙은 명시 설정과 DB명/호스트/UUID가 일치할 때만 fixture schema를 초기화한다. 실제 엔진은 MySQL8.4.11이다. 기존 컨테이너/개인·운영 DB는 접근하지 않는다. 자격증명/실제 임시 경로는 공개 커밋에 포함하지 않는다.

편입이 계정 조회 후 멈춘 동안 삭제가 먼저 끝나면 초기 서비스는 편입200을 반환했다(최초 도구 관찰). 스키마 담당의 entity FK가 들어간 재실행에서는 DB가 소속 고아를 막았지만 서비스는 상태 없는 driver error를 노출했다. 구조화 RED 로그는 후자의 joinStatus undefined/기대400을 기록하며, 초기 관찰과 이를 다른 실행으로 구분한다. 수정 후 계정 잠금·재조회로400 거절하고 소속0·조직 version1/감사1을 유지한다. 반대 순서에서는 편입의 계정 lock 동안 삭제가 완료되지 않고 편입 후409로 거절한다.

추가로 실제 MySQL legacy password rehash를 저장 직전 보류하고 관리자가 비활성/epoch1을 commit했다. 기존 전체 User 저장은 active true/epoch0을 복원하고 로그인을 승인해 RED였다. 이제 id/이전 password/active/epoch의 부분 CAS로 password만 갱신하며 늦은 쓰기는 로그인 거절·비활성/epoch1 보존이다.

## 구현 경계

명명된 User.userId/email unique와 Membership.userId→User.id RESTRICT FK를 신규 모델/기존 migration에 연결한다. 중복/NULL/고아·타입/PK·같은 이름의 다른 index/FK·MySQL engine을 사전 검사하고 식별값 없이 종류/개수로 중단한다. 기존 데이터를 자동 삭제·병합하지 않으며 down은 검토된 백업 없이는 거절한다. MySQL DDL의 implicit commit을 원자 rollback으로 표시하지 않는다. writer 중지·백업·사전 진단이 운영 적용의 별도 단계다.

가입의 insert-time unique 충돌은 실패 후 현재 identity 열을 다시 읽어 기존 email/userId409로 반환한다. 실패 signup은 샘플을 만들지 않고 무관한 DB 오류를 unique로 숨기지 않는다. 프로필은 잠근 현재 계정의 비밀번호를 검증하고 email/password만 transaction으로 변경한다. 소속 계정 삭제와 조직 생성/편입은 같은 대상 User lock을 사용하고 FK·lock 경합은409/기존 거절로 연결한다. API/화면 형태를 바꾸지 않는다.

## 증빙·미실행

Git 제외 `.aiwf/evidence/UC051-identity-integrity/`에 실제 엔진/RED/수정·명령별 로그를 보존한다. MySQL gated 스펙을 설정 없이 실행한 skip은 실제 실행으로 집계하지 않는다. 최종 검사/리뷰와 컨테이너 정리 결과는 아래에 구분한다.

실제 Ego/390·768·1440은 기존 사용자 제어권 반환 전 BLOCKED이며 다른 브라우저로 우회하지 않는다. 새 제품 UI는 없다. 물리 휴대폰·운영 데이터 진단/실제 migration 적용·모든 부하/경합·사람 수용과 전체 TC050은 미실행이다. 운영 제약 적용 전후의 백업/복구와 실제 기존 데이터 수용은 합성 로컬 시험이 대신하지 않는다.

## 재실행 조건

`backend-api/src/enterprise/identity-mysql.spec.ts`는 설정이 없으면 skip한다. 실제 실행은 `VM_QA_MYSQL_CONFIG`가 가리키는 Git 외부0600 JSON 파일을 사용한다. 파일의 필드는 host(127.0.0.1), 임시 port, 전용 username/password, `vm_identity_`와8~32자리 hex로 된 database, 해당 컨테이너에서 조회한 serverUuid다. 스펙은 접속 후 UUID/DB명을 재확인하고 그 fixture schema만 초기화하므로 개인/운영 DB 설정을 사용하지 않는다. 자격증명 파일은 출력·커밋하지 않는다.

```sh
VM_QA_MYSQL_CONFIG=/private/tmp/vm-identity-client.json npm --prefix backend-api test -- --runInBand src/enterprise/identity-mysql.spec.ts
```

## 최종 검사

기본 BE148 suites/2425 tests PASS, MySQL opt-in1 suite/9 tests는 기본 실행에서 skip했다. 그 뒤 FK 명명 일치·미래 버전 거절을 추가했고 최종 선택6 suites/109 tests PASS로 확인했다. 여기에는 실제 MySQL9개·Schema SQLite19개·가입 unique12개와 계정/조직 회귀가 포함된다. 최종 BE type/lint/build exit0이다. 전체 기본 배치를 마지막 두 보완 뒤 재실행한 것으로 표시하지 않는다.

신규 baseline의 FK도 `FK_enterprise_membership_user`로 명명하고 sync 조회 테스트에서 이름/참조 열/RESTRICT를 검사했다. 독립 코드 검토의 fixture unique index 유실 지적은 finally 복원으로 수정했다. 최종 두 수정의 추가 코드 리뷰 요청은 외부 모델 provider 비활성 오류로 종료되어 Main 직접 대조와 선택 검사로 확인했으며 독립 재검토 PASS로 표시하지 않는다.

별도 구조 검토에서 미래 expectedVersion이 권한 조회 후 비활성 commit 버전과 맞아버리는 정적 반례를 찾았다. scope v1/요청v2/쓰기 성공 모의 회귀는 실제 RED였으며, 조회 버전 불일치를 UPDATE 전409로 거절해 GREEN이다. 구조 검토자는 해당 guard의 반례 차단을 재확인했다. 실제 두 MySQL 연결의 이 미래 버전 순서는 별도 실행하지 않았다.

생성한 격리 컨테이너의 정확한 ID/label/name과 로컬 소켓을 재확인한 뒤 그 컨테이너/소유 volume만 제거하고 부재를 확인했다. 소유한 임시 credential 두 파일과 빈 디렉터리도 삭제했다. 기존 컨테이너/캐시 이미지는 유지했다.

AIWF strict는0 errors/기존 상태 불일치2 warnings(FR011/NFR002)로 exit1이며 상태를 임의 승격하지 않았다. 실제 UI/사람 수용을 자동 테스트나 구조 검토로 대체하지 않는다.

최종 빌드의 격리 Chromium 핵심8개 PASS(24.7초)는 로그인/로그아웃·CSV 집계/저장·Explore/Pivot 복원·위젯/대시보드·공유/임베드·보호 경로다. 새 기업 관리 UI나 AI 질문 전체 여정을 검증한 결과로 확대하지 않는다.
