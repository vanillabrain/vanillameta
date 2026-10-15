# Test Case: Semantic Creation And Reuse

## Overview

**ID:** TC-012
**Goal:** 단일 질문의 지표·차원·분석 제안/미리보기/원자 저장·재사용을 검증한다.
**Priority:** High
**Status:** Draft

## Roles

- 운영 담당자: 질문·결과 검토·저장·재시도.

## Preconditions

- [UC-012](../use_cases/UC-012-semantic-creation.md)의 A/B API·로컬 SQLite를 부분 실행했다. [A 증빙](../testing/semantic-proposal.md)에 단위·실LLM/API·독립 계산 결과를 기록한다. C UI 연결/컴포넌트/API는 부분 실행했으며 Ego 대표 실제 화면은 PASS, 운영 DB는 NOT_RUN이다. [B 증빙](../testing/semantic-creation-save.md)을 확인한다.
- 공식 Rill source7 fixture를 비공개 테스트 분석에 사용한다. 사용자 원본을 변경하지 않는다.

## Flow

| Step | Name    | Description                                        | Test Data                  | Use Case                                           |
| ---- | ------- | -------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| 1    | Propose | 전체 요청 수·평균 입찰가·OS별 요청 수를 한 번 질문 | source7, 지정 LLM          | [UC-012](../use_cases/UC-012-semantic-creation.md) |
| 2    | Preview | 새 지표/재사용·원본 차원·3블록 검토                | SUM 및 RATIO_SUM           | -                                                  |
| 3    | Save    | 같은 previewDigest/requestId로 저장                | 최신 source/metric version | -                                                  |
| 4    | Reload  | 정의·결과·참조·배치 확인                           | KPI2개+OS1개               | -                                                  |
| 5    | Reuse   | 같은 의미의 다른 표시명 요청을 저장                | 다른 requestId             | -                                                  |

## Validation

| ID        | 경계/BR           | 예상 결과                                                                                                                                                      | 상태           |
| --------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| TC-012-01 | 01 제안/미리보기  | Metric/Dataset/Widget/Dashboard/영수증 row 변화0, 원본 행/비밀을 LLM에 주지 않음                                                                               | NOT_RUN        |
| TC-012-02 | 01 계산 의미      | 요청 수634513000, 평균5.571238676526892 상대 오차1e-9, OS 요청 합계 동일. AVG(bid_floor)면 실패                                                                | NOT_RUN        |
| TC-012-03 | 02 재사용/중복    | KPI와 OS 차트가 같은 지표 ID, 기존 동등 정의는 새 지표0개, 다른 이름/정밀도도 동일 계산·단위 재사용                                                            | NOT_RUN        |
| TC-012-04 | 02 격리           | 다른 소스/다른 사용자/비활성/다른 단위/다른 계산/손상된 정의를 재사용하지 않음                                                                                 | NOT_RUN        |
| TC-012-05 | 01·05 차원        | source+원본 column 안정적 ID, 열 삭제/타입 변경/미지원 파생식 거절, 조회만으로 차원 테이블 생성0                                                               | NOT_RUN        |
| TC-012-06 | 03 재시도         | 같은 actor/key/digest의 동시 저장과 성공 후 응답 유실 재시도에서 분석/지표 중복0, 같은key/다른payload409; 성공 후 소스/지표 갱신에도 같은 key는 기존 결과 반환 | NOT_RUN        |
| TC-012-07 | 03 rollback       | 지표 생성/위젯 저장/분석/영수증 삽입 단계별 실패 주입 후 전체 row 변화0, 재시도 정상                                                                           | NOT_RUN        |
| TC-012-08 | 02 source/version | 갱신·지표 변경·PLAN_CHANGED·stale previewDigest409, 저장된 원본 동일; pinned DuckDB context 중 원본 포인터 교체도 탐지                                         | NOT_RUN        |
| TC-012-09 | 05 링크 호환      | UC-003/004 영향 확인에서 KPI/OS 지표 참조 모두 탐지, P1 직접/내용·배치 AI/복제/저장 뒤 차원 snapshot 보존                                                      | NOT_RUN        |
| TC-012-10 | 04 UI             | 390/768/1440px 질문→결과→저장→새로고침, KPI+추세 동시 표시, 계산 기준 기본 접힘, 버튼28·입력32, 가로 넘침0                                                     | PASS 대표 화면 |
| TC-012-11 | 01 오류/취소      | 자유 SQL/모르는 필드/키 중복/6개 초과/참조 누락/취소/늦은 응답/LLM 미설정 시 쓰기0·이전 결과 유지                                                              | NOT_RUN        |
| TC-012-12 | 03 운영 경계      | 로컬 SQLite와 실제 운영 DB의 unique/transaction 동시성 별도 검증, 삭제된 영수증 결과를 자동 재생성하지 않음                                                    | NOT_RUN        |

## Postconditions

- 정확한 생성 ID만 기록하고 원본 분석·Aside 세션을 삭제하지 않는다.
- Rill의 이동한 데모 날짜와 VM 원본 UTC를 동일 버킷으로 비교하지 않는다.
- 단위·API·실LLM·UI·DB migration·운영 DB 검증을 구분한다. 설계 lint/pin 성공을 TC 실행 PASS로 표시하지 않는다.

## A 부분 실행 — 2026-10-15

- TC01: 실제 제안·미리보기·오류 요청 전후 모든 메타데이터 테이블 행 수 동일. 추가 미리보기 전후 SQLite 전체 dump SHA256 동일. provider 문맥의 원본 행/파일 경로 제외는 단위 검사 PASS. 영수증 테이블은 아직 존재하지 않는다.
- TC02: 실제 지정 LLM/API에서 요청634513000·평균5.571238676523271·OS28개/합계 동일. 독립 Parquet 평균5.571238676526883과 상대 오차1e-9 이내. 숫자별 추세169개 PASS.
- TC04/05/11: 비활성·다른 소스·손상 정의·단위/계산 identity·안정 차원 ID·원시 SQL/미지 필드/참조/타입 거절·취소 전후 검사는 단위 PASS. 실제 API의 미지 SQL400/stale source409 PASS. 실제 provider 장애·늦은 응답·UI 마지막 결과 유지는 NOT_RUN.
- TC03: 계획의 동등 재사용·표시 변형·30개 초과 후보 검사는 단위 PASS. 실제 저장 중복·같은 지표 ID는 B NOT_RUN.
- 표의 전체 시나리오 상태는 A/B/C 전체 수용 기준으로 유지한다. 부분 PASS를 전체 TC PASS로 승격하지 않는다. TC06~09/12는 아래 부분 실행 범위를 참고한다. TC10 대표 화면은 후속 Ego 검증으로 PASS이며 모바일 모든 오류/로딩 상태는 별도 미검증이다.

## B 부분 실행 — 2026-10-15

- TC03/06: 실제 SQLite 두 연결의 동일 key 동시 저장은 분석/지표/영수증 각1개. 서로 다른 key의 동시 create는 한 요청만 저장되고 다른 요청은 PLAN_CHANGED409. 새 미리보기 후 같은 계산은 지표1개 유지. 표시 정밀도가 다른 블록도 계산 identity별1개. 성공 응답 유실을 가정한 재요청과 이후 source/metric 변경은 기존 ID 반환. 다른 payload409, 삭제된 결과404.
- TC07: 실제 저장 테이블의 trigger로 metric/dataset/widget/dashboard/receipt 단계 실패를 주입했고 전체 row 수 불변과 같은 key 재시도 성공을 확인했다.
- TC08: 고정된 profile을 유지해도 transaction의 현재 원본 포인터 변경은409/rollback. 별도 SQLite 연결의 원본 쓰기는 생성 transaction 중 SQLITE_BUSY, commit 후 성공으로 순서화 확인. 실제 DuckDB 파일 교체 E2E/운영 DB interleaving 전체 검증은 NOT_RUN.
- TC09: 실제 분석20의 KPI/OS/복제 차트가 같은 지표18을 참조하고 UC004 영향 API가 인덱스0/2/3을 탐지. 직접 수정/복제/재조회 후 안정 차원 ID 보존. 공통 지표 갱신 helper의 dimensionDefinition 보존은 단위 PASS. 분석20의 실제 내용 AI/배치 AI/undo UI 연속은 NOT_RUN.
- TC12: SQLite migration 멱등/기존 행 보존/unique/빈 테이블 downgrade PASS. 영수증 존재 시 downgrade 거절 PASS. 운영 MySQL은 NOT_RUN.
- 전체 시나리오 표는 여전히 고객 UI·운영 경계까지 포함하므로 전체 PASS로 승격하지 않는다.

## C 부분 실행 — 2026-10-15

- TC01/03/06/08/11: 생성/미리보기/저장 API 연결, 동일 key 재시도,409/질문/소스 변경 시 무효화, 응답 불일치 거절, 생성 중지와 늦은 응답, 실패 시 이전 질문·미리보기 보존을 FE 컴포넌트에서 PASS. 기존 분석 수정 경로도 회귀했다.
- 실제 지정 LLM/API의 분석21 저장·같은 key 재시도·독립 GET 재조회, 요청634513000/평균 상대 오차1e-9 이내/OS28개·합계/각169개 추세 PASS. API 재조회는 실제 브라우저 새로고침 PASS가 아니다.
- TC10: source에서 기존 국소 UI Kit/접힌 계산/반응형 결과 grid 적용을 대조했으나 실제390/768/1440px 화면·컨트롤 실측·Rill UI 비교는 auto-review 재거절로 BLOCKED. 전체 시나리오 PASS로 승격하지 않는다. [실행 기록](../testing/semantic-creation-ui.md).

- Ego 후속 TC10: 사용자 명시 승인·최종 Ego 지정 후 source7 질문→미리보기→분석22 저장→실제 reload/XHR을 확인했다. 세 폭의 미리보기/저장 화면을 실측·캡처했고 부모 크기 회귀 수정 후 주요 버튼28px·입력 외곽32px·가로 넘침0을 확인했다. Rill 화면635M/$5.57 대조 PASS. 이전 BLOCKED는 과거 기록이며 전체 제품 수용/운영 DB/P1 터치를 승격하지 않는다.
