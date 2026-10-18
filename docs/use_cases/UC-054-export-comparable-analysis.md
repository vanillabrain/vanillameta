# Use Case: Export Comparable Analysis

## Overview

**Use Case ID:** UC-054
**Use Case Name:** Export Comparable Analysis
**Primary Actor:** 분석 담당자
**Goal:** 검토한 기간·조건과 동일한 비교 리포트/파일을 받는다.
**Trigger:** 비교 리포트 조회 또는 내보내기를 요청한다.
**Status:** Draft
**Requirements:** [FR-023, FR-025, NFR-005, NFR-006, NFR-007, NFR-008](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 영속 집계 CSV 작업은 부분 구현이며 실제 화면·운영 및 전체 비교 리포트 수용은 미완료다.

## Main Success Scenario

1. 사용자가 기준/비교 기간·시간대·분류·필터·제외 적용 범위를 확인한다.
2. 서버가 권한과 검증 조건/소스·지표 버전을 고정하고 같은 기준으로 미리보기한다.
3. 명시 내보내기 요청은 권한 검사 후 동일 요청ID의 작업을 접수하거나 기존 작업을 반환한다.
4. 접수/실행/완료/실패/취소 또는 중단/결과확인 상태를 조회한다.
5. 완료한 파일의 기준·행/집계 범위·만료 시각을 표시하고 다운로드 시 현재 요청자 권한을 다시 확인한다.
6. 조회/파일의 동일 조건 정답을 대조한다. 현재 데이터가 바뀌어도 고정한 결과를 현재 조회로 오인하지 않는다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 권한 회수·파일 만료·실패·재시작 중 미확정 (step 2 or 3).
**Flow:**

1. 비허용 파일을 전달하거나 완료로 추정하지 않고 원인/현재 상태와 명시 재시도/재확인 경로를 제공한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 검토한 기간·조건과 동일한 비교 리포트/파일을 받는다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-054-01: Scoped business operation

미리보기·건수·export는 하나의 검증 조건을 참조한다. 작업 생성/외부 조회 전에 권한을 검사하며 공개 원본 URL을 결과로 노출하지 않는다.

### BR-054-02: Preservation and evidence

샘플·전체 원시행·집계 export는 구별하고 기본은 허용된 집계다. 대량 파일/식별자 원시행은 별도 권한·한도·전달 설계가 필요하다. 기간과 분류 선택 한도는 구현 단위에서 정의한다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 전체 수용은 미완료다. [영속 집계 작업 계획](../plans/UC-054-export-jobs.md)과 [부분 구현 증빙](../testing/export-jobs.md)에 SQLite/DuckDB/JWT·컴포넌트 검증과 미실행 실제 화면/운영 경계를 구분한다.

## Implemented Slice: Durable aggregate CSV

Explore/고급 Pivot의 검토 조건과 소스/지표 버전을 고정해 멱등 접수→사용자의 CSV 만들기→상태 확인/취소→권한 보호 파일을 연결한다. SQL 없는 입력 검증과 현재 권한/인증 세대 재검사, CAS/실행 lease·원자 파일 저장은 위 구현 계획을 따른다. lease 복구 검사는 같은 SQLite connection에서 새 service 인스턴스를 만든 것이며 실제 프로세스 재시작 증거가 아니다. 이 부분 구현으로 전체 비교 리포트 시나리오·TC050 상태를 올리지 않는다.

출력 완료/실패/취소의 과거 사건 알림은 [별도 계획](../plans/UC-054-export-notifications.md)·[증빙](../testing/export-notifications.md)을 따른다. 알림을 현재 파일 상태/유효성·권한으로 오인하지 않는다.

## Reviewed Explore Basis

[동일 기준 설계](../plans/UC-052-explore-basis.md)는 실제 조회에 사용한 지표 버전을 응답하고 화면의 명시 조건 snapshot과 함께 출력을 요청한다. 데이터 hash가 같아도 지표 변경은409로 거절해 재검토하며 완료 영속 파일의 과거 기준은 보존한다. 이전 기간 비교·시간대·분류·추이의 기존 계산을 재사용하고 새로운 전체 보고서 엔진을 필수로 추정하지 않는다. 전체 TC050 수용과 실제 실행 증빙은 분리한다.

[동일 기준 실행 증빙](../testing/explore-reviewed-basis.md)은 BE397/FE237과 격리 headless 고유2개의 명시 조건 적용·보기 복구·현재/이전 기간·CSV·지표 변경 거절 범위를 기록한다. 실제 Ego/휴대폰/이번 MySQL/운영 및 전체16개/TC050 수용은 별도다.
