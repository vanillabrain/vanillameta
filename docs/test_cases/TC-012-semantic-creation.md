# Test Case: Semantic Creation And Reuse

## Overview

**ID:** TC-012
**Goal:** 단일 질문의 지표·차원·분석 제안/미리보기/원자 저장·재사용을 검증한다.
**Priority:** High
**Status:** Draft

## Roles

- 운영 담당자: 질문·결과 검토·저장·재시도.

## Preconditions

- [UC-012](../use_cases/UC-012-semantic-creation.md)의 A API만 부분 실행했다. [A 증빙](../testing/semantic-proposal.md)에 단위·실LLM/API·독립 계산 결과를 기록한다. B 저장/C UI 및 운영 DB는 NOT_RUN이다.
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

| ID        | 경계/BR           | 예상 결과                                                                                                                                                      | 상태    |
| --------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TC-012-01 | 01 제안/미리보기  | Metric/Dataset/Widget/Dashboard/영수증 row 변화0, 원본 행/비밀을 LLM에 주지 않음                                                                               | NOT_RUN |
| TC-012-02 | 01 계산 의미      | 요청 수634513000, 평균5.571238676526892 상대 오차1e-9, OS 요청 합계 동일. AVG(bid_floor)면 실패                                                                | NOT_RUN |
| TC-012-03 | 02 재사용/중복    | KPI와 OS 차트가 같은 지표 ID, 기존 동등 정의는 새 지표0개, 다른 이름/정밀도도 동일 계산·단위 재사용                                                            | NOT_RUN |
| TC-012-04 | 02 격리           | 다른 소스/다른 사용자/비활성/다른 단위/다른 계산/손상된 정의를 재사용하지 않음                                                                                 | NOT_RUN |
| TC-012-05 | 01·05 차원        | source+원본 column 안정적 ID, 열 삭제/타입 변경/미지원 파생식 거절, 조회만으로 차원 테이블 생성0                                                               | NOT_RUN |
| TC-012-06 | 03 재시도         | 같은 actor/key/digest의 동시 저장과 성공 후 응답 유실 재시도에서 분석/지표 중복0, 같은key/다른payload409; 성공 후 소스/지표 갱신에도 같은 key는 기존 결과 반환 | NOT_RUN |
| TC-012-07 | 03 rollback       | 지표 생성/위젯 저장/분석/영수증 삽입 단계별 실패 주입 후 전체 row 변화0, 재시도 정상                                                                           | NOT_RUN |
| TC-012-08 | 02 source/version | 갱신·지표 변경·PLAN_CHANGED·stale previewDigest409, 저장된 원본 동일; pinned DuckDB context 중 원본 포인터 교체도 탐지                                         | NOT_RUN |
| TC-012-09 | 05 링크 호환      | UC-003/004 영향 확인에서 KPI/OS 지표 참조 모두 탐지, P1 직접/내용·배치 AI/복제/저장 뒤 차원 snapshot 보존                                                      | NOT_RUN |
| TC-012-10 | 04 UI             | 390/768/1440px 질문→결과→저장→새로고침, KPI+추세 동시 표시, 계산 기준 기본 접힘, 버튼28·입력32, 가로 넘침0                                                     | NOT_RUN |
| TC-012-11 | 01 오류/취소      | 자유 SQL/모르는 필드/키 중복/6개 초과/참조 누락/취소/늦은 응답/LLM 미설정 시 쓰기0·이전 결과 유지                                                              | NOT_RUN |
| TC-012-12 | 03 운영 경계      | 로컬 SQLite와 실제 운영 DB의 unique/transaction 동시성 별도 검증, 삭제된 영수증 결과를 자동 재생성하지 않음                                                    | NOT_RUN |

## Postconditions

- 정확한 생성 ID만 기록하고 원본 분석·Aside 세션을 삭제하지 않는다.
- Rill의 이동한 데모 날짜와 VM 원본 UTC를 동일 버킷으로 비교하지 않는다.
- 단위·API·실LLM·UI·DB migration·운영 DB 검증을 구분한다. 설계 lint/pin 성공을 TC 실행 PASS로 표시하지 않는다.

## A 부분 실행 — 2026-10-15

- TC01: 실제 제안·미리보기·오류 요청 전후 모든 메타데이터 테이블 행 수 동일. 추가 미리보기 전후 SQLite 전체 dump SHA256 동일. provider 문맥의 원본 행/파일 경로 제외는 단위 검사 PASS. 영수증 테이블은 아직 존재하지 않는다.
- TC02: 실제 지정 LLM/API에서 요청634513000·평균5.571238676523271·OS28개/합계 동일. 독립 Parquet 평균5.571238676526883과 상대 오차1e-9 이내. 숫자별 추세169개 PASS.
- TC04/05/11: 비활성·다른 소스·손상 정의·단위/계산 identity·안정 차원 ID·원시 SQL/미지 필드/참조/타입 거절·취소 전후 검사는 단위 PASS. 실제 API의 미지 SQL400/stale source409 PASS. 실제 provider 장애·늦은 응답·UI 마지막 결과 유지는 NOT_RUN.
- TC03: 계획의 동등 재사용·표시 변형·30개 초과 후보 검사는 단위 PASS. 실제 저장 중복·같은 지표 ID는 B NOT_RUN.
- 표의 전체 시나리오 상태는 A/B/C 전체 수용 기준으로 유지한다. 부분 PASS를 전체 TC PASS로 승격하지 않는다. TC06~10/12는 NOT_RUN이며 UI gate는 기존 auto-review 거절로 BLOCKED다.
