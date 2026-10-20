# TC050 — 역할별 HTTP 권한 행렬과 회수

2026-10-19 · Draft. FR017·NFR005 및 NFR007/008, UC051 BR-051-12, TC050 E02/E03/E09의 선택 검증이다. 전체16개·TC050 전체 업무 수용은 Open이다.

## 목표와 범위

실제 Nest HTTP/MySQL에서 현재 역할·자원 권한·연결 소스 권한을 구분하고, 회수 후 같은 토큰의 다음 보호 요청이 차단되는지 확인한다. [대표 통합 여정](TC-050-integrated-mysql.md)을 반복하는 대신 미확인 역할과 소비자 경로를 추가한다. UI 변경·실LLM·운영 배포·기업자료는 범위 밖이다.

## 정책 기준

- 영속 조직 역할은 admin/member다. reader/editor/publisher/exporter는 별도 조직 역할이 아니라 자원별 허용 조합이다. 같은 조직의 비소유 admin도 타인의 자료를 자동 열람·관리하지 않는다.
- 활성 소유자는 기존 권한을 유지한다. 권한 부여/회수는 동일 조직의 활성 자원 소유 admin만 가능하다. 일반 소유 member의 재배포 정책을 이번 검증에서 확대하지 않는다.
- read가 선행이고 edit/publish/export는 독립이다. source publish는 미지원이다. dashboard 권한과 모든 연결 source read는 별도로 필요하다. source edit/export가 dashboard edit/export로 자동 전파되지 않는다.
- 직접·동적 그룹 grant는 현재 유효 권한의 합집합이다. 한 경로를 회수해도 다른 경로가 남으면 그 권한은 유지한다. 전달 관계는 read만 제공하며 원본 소스 권한을 대신하지 않는다.
- 익명·잘못된/이전 epoch 토큰·비활성 계정은 인증 단계에서 거절한다. 인증된 무권한·타 조직은403이다. 목록은 보호 자원을 제외하며, 정상200의 빈 목록을 상세 허용으로 해석하지 않는다.
- 회수 후 다음 요청에서 읽기·변경·접수·실행·완료 파일을 재검사한다. 과거 영수증이나 ready 상태가 현재 권한을 대신하지 않는다. 거절은 새 저장/작업/파일 전달0이며 원본과 독립 사본·기존 파일 bytes를 삭제하지 않는다.
- 직접 SQL fixture는 새 소유 테스트 DB의 준비·관측에만 허용한다. 권한 부여/회수와 접근 판정은 실제 HTTP를 사용한다. 대시보드 fixture를 AI 생성 성공으로 보고하지 않는다.

## 행렬과 종료 조건

아래 dashboard 기대표는 연결 source read가 별도로 허용된 활성 동일 조직 계정 기준이다. `export 값`은 현재 권한 투영이며 실제 파일 소비자의 실행 결과와 구분한다. `허용`은 유효한 요청·저장 버전 등 기존 선행 조건을 만족했을 때다.

| 계정/권한 조합           | 상세 읽기 | 편집 preview/save | 게시 관리 | export 값 | grant/delivery 관리 |
| ------------------------ | --------- | ----------------- | --------- | --------- | ------------------- |
| 소유 admin               | 허용      | 허용              | 허용      | true      | 허용                |
| 소유 member              | 허용      | 허용              | 허용      | true      | 거절                |
| 비소유 admin, grant 없음 | 거절      | 거절              | 거절      | 접근 거절 | 거절                |
| member, read만           | 허용      | 거절              | 거절      | false     | 거절                |
| member, read/edit        | 허용      | 허용              | 거절      | false     | 거절                |
| member, read/publish     | 허용      | 거절              | 허용      | false     | 거절                |
| member, read/export      | 허용      | 거절              | 거절      | true      | 거절                |
| member, delivery만       | 허용      | 거절              | 거절      | false     | 거절                |

source read를 회수하면 위 비소유자의 dashboard 읽기/편집/게시도 거절한다. source export는 source read/export의 별도 조합으로 실제 CSV·영속 작업을 확인한다. 타 조직·무권한·비활성·이전 epoch는 별도 행으로 검증한다.

| ID  | 역할/전이                                                    | 확인할 HTTP 경로와 판정                                                                                                                                        |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M01 | 소유 admin·비소유 admin·동일 조직 무권한 member·타 조직·익명 | source/dashboard 목록·상세·프로파일·catalog/query·Studio GET·관리 조회. 목록 제외와 상세403/인증 거절을 구분                                                   |
| M02 | reader/editor/publisher/exporter                             | source read/edit/export 및 dashboard read/edit/publish/export의 독립 조합. 올바른 본문으로 허용/거절을 구별하고 잘못된 payload400을 권한 차단 근거로 쓰지 않음 |
| M03 | dashboard 허용/source 미허용 및 그 반대                      | 연결 소스 별도 read·읽기 전용 새 소유 분석/임의 SQL/권한 재배포 거절                                                                                           |
| M04 | 직접+그룹 중첩·직접 회수·그룹 구성원 제외/비활성/권한 회수   | 합집합 유지→마지막 허용 회수 후 같은 토큰403, 관리/원본 보존                                                                                                   |
| M05 | 직접/그룹 전달 및 회수                                       | 받은 목록/상세의 현재 접근, 전달 read와 edit/publish/export 차단·source read 회수 후 차단                                                                      |
| M06 | export 생성/실행/상태/ready 파일                             | 다른 actor/타 조직·export 회수·source read 회수 후 새 작업/실행/파일 전달0. 기존 파일 bytes 보존                                                               |
| M07 | 계정 비활성·재활성/epoch 변경                                | 기존 토큰 거절, 재로그인 후 현재 권한만 복원. 탈퇴/조직 이동의 기존 검증은 이번 실행으로 승계하지 않음                                                         |
| M08 | 원본/독립 사본/감사 보존                                     | 거절 전후 정의·소유 mapping·파일/확정 작업·감사 범위를 대조. 유효한 관측 시각 변화는 내용 변경과 구별                                                          |

각 경로의 실제 실행 결과·상태·미실행을 [증빙](../testing/enterprise-access-matrix.md)에 남긴다. 위 표는 실행 전 설계이며 PASS가 아니다. 전 역할은 위 현재 모델의 모든 역할 축을 뜻하며 앱의 모든 endpoint·모든 grant 조합·운영 경합의 전수 검증을 뜻하지 않는다. 최종 증빙에 route inventory와 실행 집합 차이를 명시한다.

Enterprise dashboard export는 현재 권한 투영과 실제 소비자를 구별해 기록한다. source export API나 별도 BI governance export의 성공을 Enterprise dashboard export 실행 성공으로 승계하지 않는다. 소비자 연결의 미확인은 정책 허용/거절의 실행 PASS가 아니다.

## 작업과 검증

1. 기존 UC051/TC050에 고정 기준과 선택 실행 항목을 연결하고 spec lint/pin을 기록한다.
2. `scripts/qa-enterprise-access-matrix.cjs`가 소유 표식이 확인된 `qa-enterprise-mysql.cjs`의 새 격리 runtime만 사용하도록 한다. random credential·loopback·tmpfs·소유 자원만 정리를 유지한다.
3. HTTP status/body와 필요 최소 DB 관측으로 행렬을 실행하고 최초 실패를 보존한다. 확인된 결함만 수정한 뒤 관련 회귀·type/lint/build를 검증한다.
4. 문서·잔여표를 동기화하고 별도 리뷰·실행 로그/packet을 보존한다. 자원 종료/credential 정리 및 공개 커밋의 기업 식별 정보·비밀 부재를 확인한 뒤 commit/push한다.

신규 엔티티/제품 정책을 추가하지 않으므로 entity model·용어·UC diagram은 기본적으로 변경하지 않는다. 새 정책 결정이 필요하면 미확정으로 남기고 검증을 통과시키기 위해 허용 범위를 바꾸지 않는다.
