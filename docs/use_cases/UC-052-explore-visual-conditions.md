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
- 현재 소스별 조건 편집/미리보기/버전 저장은 [구현 계획](../plans/UC-052.md)의 첫 단위로 진행한다. [Studio 연결](../plans/UC-052-studio-conditions.md)은 조건을 명시 복사해 공통 편집 문서에 보존한다. AI 조건 제안/차이·분포/영속 출력·실제 화면/전체 수용은 별도다.

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

## Studio Condition Follow-up

[선택 검증](../testing/studio-conditions.md)은 직접 조건 적용/제거·undo/redo·미리보기/저장/reload·AI 내용 편집의 조건 보존과 게시/재사용을 다룬다. 조건의 sourceRevision은 관리형 불변 파일 경로 hash이며 소스 조건 저장의 metadata revision과 다르다. 파일 교체 후 GET은 초안을 보존하고 실행을 거절하며 명시 제거 후 재검증한다. 공개 응답에는 적용 여부만 추가한다. AI가 조건 변경을 제안하는 흐름과 전체 E04/E05/E08/E13 수용은 완료로 승계하지 않는다.

## Validated AI Condition Proposal

[AI 검토 설계](../plans/UC-052-ai-conditions.md)에서 실제 허용 schema의 열명/native type과 현재 조건을 AI에 제공한다. 질문·설명은0연산이며 변경 제안은 선택 블록 내용 또는 전체 포함/제외 한 종류만 허용한다. 조건 제안은 서버가 파일 hash를 고정하고 공통 compiler와 재미리보기로 검증한다. 현재/제안 트리와 전체 블록 결과를 확인하고 명시 적용하기 전 초안/저장/게시는 변하지 않는다. 저장을 함께 요청해도 CONDITION_REVIEW_REQUIRED로 멈추며 적용한 문서의 후속 저장은 기존 경로를 사용한다. 검증/취소·409·실패는 초안/질문을 보존한다. [증빙](../testing/ai-condition-proposals.md)의 mock 모델 응답과 실제 SQLite/DuckDB 검사를 실LLM/전체 실제 UI 수용으로 승격하지 않는다.

## Full Distribution And Selected Sample

[분포·표본 설계](../plans/UC-052-profile.md)는 Source 또는 Studio 현재 범위를 분모로 포함/제외 전후의 전체 값 빈도·상위20+나머지·NULL/범위를 조회한다. 선택 열1~6개의 최대20행 정렬 표본은 같은 최종 조건을 사용하고 무작위/대표표본으로 표시하지 않는다. 요청/응답의 현재 권한·파일/revision/version을 검사하며 원본/SQL·초안·질문/undo·저장을 바꾸지 않는다. 셀200문자 잘림·총256KiB·미지원 native 열을 명시하며 선택하지 않은 열은 표본으로 반환하지 않는다. [검증](../testing/condition-profile.md)은 E05의 전체/표본 분모·정답과 권한 회수/변경 중 거절 범위를 구분하고 실제 UI/운영 수용은 미실행으로 둔다.

## Explore Applied Condition Snapshot

[명시 적용 설계](../plans/UC-052-explore-basis.md)는 검증한 소스 조건 미리보기의 snapshot을 현재 Explore에 적용하고 조회/값 검색/Pivot/CSV·저장 보기로 이어가는 후속 단위다. 소스 저장은 별도이며 읽기 사용자도 본인 분석에 적용할 수 있다. metadata 조건 version이 아닌 파일 sourceRevision에 묶고 원본 변경은 재검토를 요구한다. 전체 기간 UTC의 소스 건수와 현재 분석 범위의 결과는 구별한다. 실제 실행 결과는 후속 증빙으로 판정하며 설계만으로 전체 수용 상태를 바꾸지 않는다.

[동일 기준 실행 증빙](../testing/explore-reviewed-basis.md)은 BE397/FE237과 격리 headless 고유2개의 명시 조건 적용·보기 복구·현재/이전 기간·CSV·지표 변경 거절 범위를 기록한다. 실제 Ego/휴대폰/이번 MySQL/운영 및 전체16개/TC050 수용은 별도다.
