# UC051 동적 그룹 권한 검증

2026-10-18. FR016/017·NFR005/007/008의 선택 구현이며 전체16개/TC050 수용 완료가 아니다. [설계](../plans/UC-051-groups.md)를 따른다.

## 구현과 실제 서버 경계

조직 admin의 그룹/구성원 관리와 현재 소유 admin의 그룹별 read/edit/publish/export를 추가했다. 직접 권한과 활성 그룹의 현재 구성원 권한을 합산한다. 대시보드 소스 read는 독립 검사하며 source publish는 금지한다. 그룹/계정 비활성·소속/소유권 변경·구성원 제외는 다음 요청에서 반영한다. 팀 문자열 자동 연결과 이미 전달된 데이터 회수는 제공하지 않는다.

그룹/구성원/감사 및 정책/CAS/감사는 원자 저장한다. 생성 UUID 영수증은 현재 조직/정규화 이름 digest를 확인하고 같은 요청이면 이름·명단이 바뀐 원래 그룹의 현재 상세를 반환한다. 응답 유실 뒤 클라이언트는 이름/UUID를 유지해 명시 재확인한다. 생성 대기의 reload 저장은 후속이다. 그룹 정책 감사의 subjectId는 직원이 아닌 그룹이며 개인 알림으로 투영하지 않는다.

## 자동 검사

- 최종 선택 BE 5 suites/74개 PASS: 실제 SQLite·JWT HTTP·이름 unique/조직/admin·명단 CAS/추가 제약·rollback·직접/다중 그룹 합산·권한 목록·같은 JWT 회수·소스 독립·게시/재사용 현재 권한 소비자·migration 반복·생성 replay/이름 변경/내용·조직 불일치.
- 최종 FE 8 files/69개 PASS: 명시 조회/저장·변경 차이·409 초안 보존/명시 초기화·이탈/비활성 구성원·늦은 응답/StrictMode·생성 응답 불명확의 동일 UUID 재시도. 전체 FE 123 files/1740개는 생성 영수증 추가 전 실행이며 이후 변경은 최종 선택69개로 재검증했다.
- 양쪽 type/lint/build PASS. 로그는 Git 제외 `.aiwf/evidence/UC051-groups`에 보관한다.
- 초기 전체 BE의 권한 소비자 fixture가 그룹 엔티티를 누락해 실패했다. 두 번째 실행에서 inline fixture 한 곳의 누락을 확인해 수정했다. 제품에 metadata 부재 권한 우회는 추가하지 않았다. 최종 전체 결과는 아래 기록을 따른다.

최종 전체 BE는 161 suites/2690개 PASS·1 suite/9개 SKIP이다. 격리 headless core E2E 실행은 exit0/실패 목록0을 확인했다. 명세 strict lint는 기존 FR011/NFR002 상태 불일치 경고2개·오류0이며 경고를 숨기거나 수용 상태를 승격하지 않았다.

## UI와 비교 범위

관리 영역은 접힌 상태로 제공하고 도구32px·입력36px·모바일 입력16px/데스크톱14px·wrap/min-width:0을 코드와 컴포넌트 검사로 확인했다. 실제 Ego96은 사용자 제어 상태이며 이 단위 실제 화면/390·768·1440/실휴대폰 검증은 NOT_RUN이다. 기존 headless core 결과는 새 화면 실측을 대신하지 않는다.

고정 Rill 소스의 [권한 합산](https://github.com/rilldata/rill/blob/dd080fc7b19ea02602ece065044ca164dc60ff78/admin/permissions.go#L131)과 [직접/그룹 역할 조회](https://github.com/rilldata/rill/blob/dd080fc7b19ea02602ece065044ca164dc60ff78/admin/database/postgres/postgres.go#L1961)를 비교했다. 현재 구성원 조회와 합산 원칙을 참고한 소스 비교이며 Rill 실제 화면/동작 동등성 검증은 아니다.

## 리뷰와 잔여

Main의 구현 후 별도 검토에서 생성 응답 유실 시 중복 위험을 확인해 durable 영수증과 frozen 요청을 보강하고 재검증했다. 독립 리뷰는 NOT_RUN이며 승인으로 기록하지 않는다. 실제 MySQL 그룹 DDL/동시성·운영/사람 수용·동적 그룹 전달/받은함·그룹 알림·영속 export/파일 소비자·생성 대기 reload 복구는 남아 있다. 전체 요건은 Open을 유지한다.
