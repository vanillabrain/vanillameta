# UC053 받은 분석 독립 복제 검증

2026-10-18 · [설계](../plans/UC-053-copy.md)·FR021/022/NFR005/007/008 후속이다. 전체16개/TC050 수용 완료가 아니다.

## 구현 결과

- 소유 admin은 조회 공유와 별도로 allowCopy를 명시한다. 기본 false/생략 보존·회수 시 false이며 설정 변경은 관계 version/CAS·감사·영수증과 같은 transaction이다. 기존 직접 grant/원본/게시를 바꾸지 않는다. UI는 편집 가능한 계산식/조건/배치를 제공하고 이미 저장한 사본이 회수 뒤에도 남는다는 별도 확인을 요구한다.
- 받은 자료는 허용된 행에만 내 소스로 복제 링크를 제공한다. 필수 JWT/private no-store의 `/studio/received`에서 원본/허용 기준을 조회한다. reference는 조직/소유자/대시보드/관계 version 및 현재 문서·schema·파일 revision/제한 template digest에 묶인다. reference 자체는 접근권이 아니다.
- StudioRemixService는 기본 게시 resolver를 유지하고 사내 received resolver를 내부 callback으로만 받는다. HTTP body로 resolver를 선택할 수 없다. 기존 `/studio/publications`는 사내 reference를 거절하고 사내 resolver도 게시 token을 거절한다. 익명 게시를 새로 만들지 않는다.
- 현재 받은 자료/모든 원본 소스 read·복제 허용을 template/preview/save와 저장 뒤 재확인한다. 본인 소스의 소유권/파일 revision·열/조건 매핑·지원 블록 명시 제외·전체 미리보기·원자 저장/영수증은 기존 코드를 재사용한다. 현재 범위는 서버 DuckDB와 canonical 지표 연결이다. 임의 SQL의 의미를 추측하지 않는다.
- 새 사본은 수신자 소유/새 dashboard·block·metric 연결/비공개다. 모든 폭 배치와 조건/지표 매핑 계약을 보존하고 원본 데이터 대신 선택한 본인 데이터로 다시 집계한다. 공유/복제 허용/원본 소스 권한 회수는 이미 저장한 사본을 삭제하지 않는다.
- 기존 Studio 복제 UI를 재사용하고 받은 분석/게시본의 돌아가기·원본 새로 확인/오류 문구를 구분했다. 원본이 바뀌면 명시 새로 확인으로 reference를 다시 조회하며 매핑 초기화를 표시한다. 미확정 저장 동안은 기존 frozen 요청/입력 잠금을 유지한다. 소유 설정 도구32px·모바일 select16px/데스크톱14px·theme/flex-wrap/min-w-0을 적용했다. 실제 실측은 별도다.

## 실행 증거

기업 데이터 없이 합성 계정/원본500·수신자1000 자료와 격리 SQLite/DuckDB/HTTP를 사용했다. 로그는 Git 제외 `.aiwf/evidence/UC053-copy/`에 있다.

| 검사                                     | 결과                       | 범위/제약                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 전체 BE                                  | PASS 160 suites/2676 tests | opt-in MySQL9/1suite SKIP. 최종 namespace 거절 assertion·fixture import 정리 전 실행                                                                                                                                                                                                                                                                                                           |
| 최종 BE 선택                             | PASS 2 suites/58 tests     | 기존 게시 remix/조회 공유 + 실제 사내 HTTP/복제 동의. 원본 정의409·타인/미허용/대상 원본 소스 거절·preview 쓰기0/실제1000 oracle·원자 저장/동일 영수증·새 실제 block ID/모든 폭 좌표·원본 행 불변·저장 후 허용 회수 주입 시 dashboard/metric/receipt rollback→동일 요청 복구·회수 후 사본 reload1000·활성 익명 게시 증가0·public/private namespace 거절·legacy migration 데이터 보존/반복 실행 |
| 전체 FE                                  | PASS 121 files/1729 tests  | 최종 received refresh 추가1사례/문구·select 스타일 전 실행                                                                                                                                                                                                                                                                                                                                     |
| 최종 FE 선택                             | PASS 9 files/80 tests      | 기존 SourcePicker/매핑/전체 미리보기/저장 경계와 별도 복제 동의·숨긴 동의 없이 회수·본인 소스 복제 링크·private reference 조회/denial 재시도·stale lookup/다른 분석 reference 거절·사본으로만 이동·received 원본 명시 refresh/돌아가기·기존 게시 API 경로 보존                                                                                                                                 |
| BE/FE type·변경 lint·build               | PASS                       | fixture crypto import/미사용 destructuring은 최종 lint에서 정리                                                                                                                                                                                                                                                                                                                                |
| 기존 격리 core E2E                       | PASS 8 tests               | 마지막 copy select 스타일/received 오류 문구 전 실행. 신규 실제 Ego 시연과 구분                                                                                                                                                                                                                                                                                                                |
| 실제 Ego/Rill 화면·390/768/1440·실휴대폰 | BLOCKED / NOT_RUN          | 기존 Ego96 사용자 제어권 대기; 새 세션/브라우저로 우회하지 않음                                                                                                                                                                                                                                                                                                                                |
| MySQL·운영·사람 수용·독립 에이전트 리뷰  | NOT_RUN                    | SQLite/자동 검사와 별개                                                                                                                                                                                                                                                                                                                                                                        |

## 별도 Main 검토와 수정

권한/개인 reference와 공개 token 혼동·본문 callback 주입 금지·원본/대상 권한·최종 허용 재검사·rollback/영수증·실제 새 ID와 모든 폭 좌표를 별도로 읽었다. SQLite QueryRunner에 drop/create 이전 schema cache가 남으면 addColumn이 중복될 수 있어 migration은 getTable의 현재 구조를 addColumn에 전달한다. 기존 행의 allowCopy 기본 false를 확인했다. 원본 제목 경합 test는 테스트가 변경한 updatedAt도 정확히 복원해 clone의 원본 불변과 구분했다. 회수 모드에서 숨겨진 복제 동의가 저장을 막지 않도록 조건을 고쳤다. 독립 리뷰를 수행했다고 주장하지 않는다.

Rill의 목록/개별 권한 분리 소스 대조는 [받은 자료 증빙](received-dashboards.md#rill-소스-대조)을 따른다. 사내 독립 사본 동의는 VM의 추가 계약이며 실제 Rill/Claude Artifact 화면 동등성을 검증한 것은 아니다.

## 남은 범위

동적 그룹/일반 소유 member 공유 정책·다양한 엔진/미지원 원본 블록·미확정 복제 요청 브라우저 새로고침 복구·원본 회수 뒤 미확정 결과 찾기 UX·대규모/실제 MySQL 동시 경합·Ego/모바일·운영/사람 수용은 남아 있다. 별도 소유 소스가 없는 수신자는 기존 데이터 준비 경로를 이용해야 한다. 전체16개 완료율을 하위 구현 수로 올리지 않는다.
