# UC051 자원별 권한 검증

2026-10-18 · develop-v2 · [설계](../plans/UC-051-resource-access.md). FR017·NFR005/007과 TC050 E02/E03의 구현/선택 검증을 기록한다. 전체16개 요건 완료나 사람 수용 판정은 아니다.

## 구현 기준

권한은 source/dashboard·recipient별 별도 행이며 UserMapping/Database.ownerId에 수신자를 덧붙이지 않는다. 동일 조직의 활성 자원 소유 admin만 열람/편집/게시/export를 변경한다. 실제 actor/subject/resource/version 감사와 CAS·회수 tombstone을 원자 저장한다. 소유권/조직 변경 후 과거 grant는 무효이며 새 권한 관리 주체는 logical version0부터 부여한다. 비활성 대상의 권한 회수는 가능하지만 양수 권한 부여는 거절한다.

기존 SourceAccess의 기본 owner-only 의미는 유지한다. 명시한 read/edit/publish/export만 grant 경로로 처리하며 데이터/산출물 권한은 독립이다. 대시보드에는 연결 소스의 별도 read도 필요하다. 삭제·임의 SQL·연결정보·복제/새 산출물·권한 재배포는 자동 허용하지 않는다. 특히 수신자가 읽기 소스로 새 소유 대시보드를 만들어 게시/export 제한을 우회하지 못하게 기존 생성의 소스 소유권 경계를 보존한다. 기존 대시보드의 소스 교체도 소유권 계약을 유지한다.

조직 화면에는 접힌 자원 권한 패널이 있다. 명시 자원/직원/변경 차이·동의 뒤 저장하고409/통신 실패 시 초안 유지,403은 목록·정책·제어를 제거한다. Explore의 업무 설명·지표 저장/export, Studio의 직접 편집·저장·게시/복제 제어는 현재 권한을 반영한다. 클라이언트 컨트롤은 서버 검사를 대신하지 않으며 이미 표시된 데이터를 사람이 복사하는 것을 막는 기능은 아니다.

## 실행 증거

Git 제외 `.aiwf/evidence/UC051-resource-access/`에 명령별 로그를 기록한다. 아래 통과 범위 밖의 경로·환경은 승계하지 않는다.

- 정책/소유권/실제 DuckDB 통합64개 선택 검사: 실제 SQLite의 역할/조직/활성/소유자 변경·독립권한·최소응답·CAS/중첩 transaction 큐·회수/감사. MySQL 동시성은 미실행이다.
- 실제127.0.0.1 임시 HTTP: 조직/토큰 회수 여정과 자원 목록→read 부여→수신자 권한 응답/타 조직403→수신자 재배포403→낡은버전409→회수→다음 조회403·actor/subject 감사 PASS. 메모리DB/합성 계정만 사용했다.
- 기존 소유권/조직/개인 보기/Pivot 회귀133개 PASS.
- Explore UI 기존84개 및 권한 제어41개 선택 범위 PASS. Studio 응답 권한 파싱·열람 전용 편집 차단·게시 독립 제어 포함65개 PASS.
- 실제 SQLite 정책과 DuckDB9행의 독립 정답 SUM(amount)=311·region A=120을 수신자 조회로 확인했다. read만으로 export/지표/업무 설명 쓰기·새 소유 대시보드 생성은 거절하고 명시 export 이후 다운로드 및 회수 뒤 거절을 확인했다. 실제 DuckDB의 수신자 Studio get→전체 preview→save→reload에서 독립 정답 SUM(amount)=500·원본 소유자/actor별 영수증을 확인했다. 명시 게시→공개 read→publish 회수/read 유지 후 공개403, edit 회수 후 같은 저장 영수증 replay403·source read 회수 후GET403도 확인했다(Studio20개 + 추가 마이그레이션5개 PASS). 기존 UUID 게시도 실제 게시자/원 소스를 저장하고 권한 회수 후 공개 조회·재사용을 거절한다. 게시 상태는 publish 전용이며 일반 열람의 상세/목록 응답은 익명 공유 정보를 제거한다. 구형 편집은 연결된 위젯만 허용하고 동일 transaction manager로 저장한다(추가 회귀4개 PASS).

- 최종 전체 BE134 suites/2,311 tests·FE112 files/1,588 tests PASS. 양쪽 빌드·FE type/lint 및 변경 BE lint 오류0(기존 경고2개) PASS. 격리 핵심 Chromium E2E8개 PASS는 기존 여정의 회귀이며 새 권한 UI 실측이 아니다.
- 최종 목록 shareId 제거 뒤 해당 실제 SQLite 회귀4개와 BE 빌드를 재실행했다. 전체 검사와 이 마지막 작은 변경의 추가 확인을 구분한다.
- AIWF strict는 오류0/기존 상태 드리프트 경고2개(FR011/NFR002)로 exit1이다. 승인 상태를 바꿔 경고를 숨기지 않았다.

## 미실행·잔여

- 실제 Ego/390·768·1440 UI 크기·정렬은 사용자 제어권 경계로 BLOCKED. 단위/type/lint/build로 디자인 PASS를 대체하지 않는다.
- 운영MySQL·실휴대폰·사람 수용·모든 동시성/오류 경로는 미검증이다. 조직/권한 쓰기는 같은 SQLite 큐를 공유하지만 모든 다른 모듈의 동시 transaction까지 일괄 검증한 것은 아니다.
- 별도 그룹·수신자 전달/알림·영속 export/파일 만료·자산 보관·추가 요건 전체 수용은 이후 단계다.

대시보드 export grant는 정책 저장/검사 기반이며 영속 출력 작업·파일 전달 소비자는 UC054/FR023에서 연결한다. 구형 metric SQL 변경 API는 소유자 전용이며 이 단위의 source edit는 업무 설명/지표 생성과 현재 Studio 편집에만 연결했다. 이 경계를 전체 FR017/TC050 완료로 확대하지 않는다.
