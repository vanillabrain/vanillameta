# Use Case: Explore Visual Conditions

## Overview

**Use Case ID:** UC-052
**Use Case Name:** Explore Visual Conditions
**Primary Actor:** 분석 담당자
**Goal:** 변수·조건·AI 제안을 같은 분석 기준으로 탐색한다.
**Trigger:** 허용 소스에서 조건이나 AI 제안을 편집한다.
**Status:** Draft
**Requirements:** [FR-018, FR-019, FR-020, NFR-005, NFR-006](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 현재 소스별 조건 편집/미리보기/버전 저장은 [구현 계획](../plans/UC-052.md)의 첫 단위로 진행한다. Studio/AI/분포·출력·실제 화면/전체 수용은 별도다.

## Main Success Scenario

1. 허용 소스의 업무 변수·유형·정의 버전을 조회한다.
2. 사용자가 직접 조건 또는 AI 변경 제안을 구성한다.
3. 열·지표·유형별 연산자·중첩 깊이/실행 한도를 서버 검증하고 기존 초안과 차이를 표시한다.
4. 명시 적용한 동일 조건으로 분포·샘플·전체/조건충족/제외후 건수와 비율을 조회한다.
5. 설명/조회 응답은 정의 변경과 구별하고 조건·선택 변수·소스/지표 버전을 기존 초안 저장/reload에 연결한다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 알 수 없는 열·유형 오류·지원하지 않는 조건 묶음 (step 2 or 3).
**Flow:**

1. 변경 묶음을 반영하지 않고 기존 초안/질문을 보존하며 교정할 사유를 표시한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 변수·조건·AI 제안을 같은 분석 기준으로 탐색한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-052-01: Scoped business operation

AI와 직접 편집은 공통 검증 조건 정의를 사용한다. 임의 SQL을 클라이언트에서 실행하거나 일부 유효 필드만 몰래 저장하지 않는다.

### BR-052-02: Preservation and evidence

샘플/전체·분자/분모·제외 기준·기간/시간대를 명시한다. 식별자 제외 업로드는 기본 기능이 아니라 데이터 권한/형식 설계 후 선택 적용한다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)·[구현 계획](../plans/UC-052.md)을 따른다. 전체 구현/실행 수용은 미완료다.
