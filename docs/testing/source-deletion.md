# UC055 소스 삭제 보호와 관리 파일 정리

## 구현 범위

[계획](../plans/UC-055-source-delete.md)에 따라 기존 무조건 연쇄 삭제를 사용처 확인→기준을 고정한 원자 metadata 삭제→명시 관리 파일 정리로 바꾼다. FR024/NFR005/007/008의 구현 단위이며 전체16개 요건/TC050 수용 완료가 아니다.

고정10종 사용처는 Dataset/TableQuery/활성 Metric/현재 Dashboard 정의·Studio·Pivot·재시도 가능한 실행/두 탐색 보기/직접·그룹 권한/활성 게시/실행 또는 미만료 출력/공유 파일이다. 같은 관리 UUID 디렉터리의 **하위 경로**를 참조하는 다른 Source의 현재·과거 파일 및 커머스 자료도 삭제를 차단한다. 손상된 다른 파일 버전 metadata를 빈 참조로 처리하지 않는다. 별도 사본과 과거 이력은 자동 삭제하지 않는다.

현재 Source 소유/계정 활성/JWT epoch/조직/revision을 재검사한다. 직접·그룹 권한만으로 삭제할 수 없다. 삭제는 Database 한 행과 지속 영수증·조직 감사의 원자 처리다. 파일 계획은 암호화하며 경로/manifest/SQL/자격정보를 응답에 싣지 않는다. 새 Source가 같은 ID로 나타나도 과거 요청 재확인이 다시 삭제하지 않는다.

관리 업로드 DuckDB와 앱 생성 sample SQLite만 신원 proof에 묶어 정리한다. 외부 DB 원본/임의 외부 로컬 파일은 보존한다. 파일0개 연결은 commit 후 cached connection 종료를 시도하며 실패하면 영수증에서 명시 재시도한다. 파일이 있는 경우 자동 정리하지 않고 현재 본인의 미완료 영수증 목록에서 명시 재개한다. 파일 작업은 metadata transaction 밖이며 이미 지운 파일을 rollback한다고 약속하지 않는다. claim CAS/10분 lease와 heartbeat, 매 단계 현재 인증/조직/참조 검사, 파일별 진행 기록으로 재시도를 보호한다. 이미 시작된 파일 작업은 권한 변경과 동시에 완료될 수 있다.

## 실행 증빙

검증 결과는 다음 범위를 구별한다. 실제 화면 최종 재검증과 독립 코드 리뷰를 완료했다.

- 실제 격리 MySQL8.4.11: 최종25개 PASS(기존24+게시 회수 경합1). 두 연결의 Source→Dataset/TableQuery 잠금 대기와 양순서, 삭제/영수증/감사 rollback, 재접속 재확인, 복원 ID 보호. 소유 테스트 컨테이너·볼륨·임시 credential 정리 완료. 파일 실패 검사는 mock guard이며 실제 파일 검사를 대신하지 않는다.
- 실제 임시 DuckDB/SQLite 파일 primitive: 90개 PASS. 관리 디렉터리의 자식→manifest→빈 디렉터리 순서로 제거한다. manifest 제거 후 중단은 캡처된 같은 inode의 빈 디렉터리만 재개하며 교체 디렉터리·남은 자식은 거절한다.
- 실제 임시 업로드+SQLite metadata 통합: 4개 PASS. 두 파일 중 첫 파일 제거 후 둘째 실패→진행 기록 보존→metadata 연결/파일 worker 재초기화→남은 파일만 재시도, 독립 Source의 실제 합계3 보존. 하위 경로 공유·손상 버전 목록 차단과 처음부터 없는 디렉터리의 교체 파일 보존을 확인했다. 연결/worker 재초기화를 실제 서버 프로세스 강제 종료 검증으로 확대하지 않는다.
- 독립 리뷰에서 하위 경로 공유 누락과 손상 버전 목록 생략을 발견해 수정했다. manifest 제거 직후 중단의 복구도 보완하고 실제 worker 재시작 회귀를 확인했다.

실제 Ego96는 사용자 제어 공간으로 유지한다. 격리 headless 화면/390·768·1440 viewport, 실제 Ego/실휴대폰, 운영·모든 writer/MySQL·사람 수용은 각각 결과를 구분한다. 기존 성공 수치로 새 경로의 미실행을 통과 처리하지 않는다.

- SQLite 실제 metadata/Nest JWT 코어56 + 실제 파일 통합4 = 60 PASS. 사용처10종/Studio·Pivot·실행/게시/출력·역사 보존/영수증·pagination·lease·rollback과 실제 JWT/no-store를 확인했다. 최초 포트 제한 실패(59 PASS/1 EPERM)는 보존하고 허용된 임시 localhost 서버에서60개 재검증했다.
- 참조 writer16개 suite의 기존322 + UI Source ID 문자열 호환 회귀15 + 제한된 transaction 격리 회귀5 = 중복 제외342 PASS. 정수 전용 부모 잠금은 유지하며 기존 UI의 정규 양의 정수 문자열을 요청 경계에서 숫자로 변환했다.
- FE 삭제/API/목록 및 기존 Widget UI fixture 111 PASS, 타입/lint/build PASS. 첫 headless core는8 PASS/3 FAIL로 기록했다. 실패는 실제 Dataset ID 문자열 호환403, entry 애니메이션 중 bbox 측정, cleanup POST의 기대200/실제201이었다. 수정 후 최종 core11개는 모두 PASS다. 390/768/1440px에서 dialog 경계·문서 가로 넘침0, 버튼32±1px/글자14px를 실측했다. 390px 차단·1440px 정리 완료 캡처의 줄바꿈/건수·버튼 정렬도 직접 확인했다. 화면 설명의 metadata는 연결 정보로 다듬고 dialog72개를 다시 확인했다.
- strict 명세 lint는0 errors/기존2 warnings(FR011/NFR002 상태 차이)이며 strict exit1을 숨기거나 수용 상태를 변경하지 않는다.

최종 리뷰에서 legacy 게시 transaction이 Source 부모 잠금 전 만든 MySQL REPEATABLE READ snapshot으로 회수된 grant를 다시 읽는 경합을 확인했다. legacy 게시와 잠금 전 연결 조회가 있는 Widget create/update에만 MySQL/MariaDB READ COMMITTED를 적용한다. Studio 게시/카탈로그/조건/실행은 먼저 부모를 잠그며 SQLite 경로는 유지한다. 옵션 회귀5개와 별도로 실제 두 연결의 Source 잠금 대기→grant 회수 commit→대기하던 실제 PublicationService 게시403/게시 행0을 검증했다. 집계 준비만 stub이며 권한 정책/미리보기 ticket/게시 서비스/DB 잠금은 실제 경로다.

확장 QA 첫 실행은2 PASS/1 FAIL이었다. SOURCE04가 GET 상세의 중첩 databaseInfo를 읽지 않아 `Delete undefined`를 기다린 테스트 선택자 문제이며, 실제 삭제 거절/오동작으로 기록하지 않는다. 미지정 DELETE 거절과 기존 위젯의 명시 Dataset 정리 후 소스 삭제·유효 위젯 복구는 PASS다. 선택자를 수정한 Source04 및 최신 문구의 전체 삭제 흐름2개는 재검증 PASS다. QA 정적 타입은 PASS이며 확장 QA 파일 전체 lint의 기존 범위 밖3 errors/13 warnings는 별도 미해결이다. 제품 FE의 이번 변경 범위 lint는 PASS다.

최종 독립 리뷰의 확정 미해결 finding은0건이다. 실제 Ego96/실휴대폰·운영·모든 MySQL writer/모든 장애 조합·조직 비활성/전체16개 요건과 사람 수용은 계속 미완료다. pin/check는 내용 동기화이며 packet의 awaiting_review/acceptance not_recorded를 코드 리뷰 결과와 혼동하지 않는다.
