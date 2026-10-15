# UC-012: Create Semantic Analysis From A Prompt

## Overview

**Use Case ID:** UC-012
**Use Case Name:** Create Semantic Analysis From A Prompt
**Primary Actor:** 운영 담당자
**Goal:** 질문 하나로 재사용 지표·원본 열 차원·대시보드를 함께 제안받고 저장한다.
**Trigger:** 소유 소스에서 새 분석을 질문한다.
**Status:** Draft
**Requirements:** [FR-007, FR-008, NFR-004](../requirements.md)

## Preconditions

- 로그인한 담당자가 소유한 ready DuckDB 파일 소스가 있다.
- 지정 LLM과 기존 SQL/compiler·미리보기 경계가 준비되어 있다.
- A/B 제안·미리보기·원자 저장·재조회 API는 로컬 SQLite에서 검증했다. C 고객 UI 연결·컴포넌트 검증은 구현했으며 실제 화면·운영 DB 검증은 미완료이고 UC 전체는 Draft다. [A 실행 증빙](../testing/semantic-proposal.md)을 확인한다.

## Main Success Scenario

1. 담당자가 현재 소스에서 필요한 결과를 한 번 질문한다.
2. 시스템이 소유권·소스 프로필과 활성 지표 카탈로그를 검증하고 구조화 제안을 생성한다.
3. 시스템이 지표 정규형·차원 열·블록 참조를 검증하여 생성/재사용 계획과 KPI+추세·차트를 미리보기한다. DB에 쓰지 않는다.
4. 담당자가 결과를 검토하고 저장을 누른다.
5. 시스템이 sourceRevision·지표 version·previewDigest와 requestId를 검사하고 지표·분석·생성 영수증을 원자 저장한다.
6. 담당자가 새로고침하거나 같은 계산을 질문하여 저장 정의와 재사용 결과를 확인한다.

## Alternative Flows

### A1: Unsupported or invalid proposal

**Trigger:** 제안이 허용되지 않은 SQL/집계/열/참조이거나 계산이 모호하다 (step 2).
**Flow:**

1. 시스템이 저장하지 않고 질문과 마지막 유효 결과를 유지한다.
2. 담당자가 질문을 수정한다.
3. Use case continues at step 1.

### A2: Source or metric changed

**Trigger:** 소스 revision·지표 version·생성/재사용 계획이 바뀌었다 (step 5).
**Flow:**

1. 시스템이409를 반환하고 생성하지 않는다.
2. 담당자가 최신 계획을 미리보기한다.
3. Use case continues at step 3.

### A3: Retry or concurrent request

**Trigger:** 같은 requestId가 다시 제출되었다 (step 5).
**Flow:**

1. 동일 actor/key/payload이면 기존 결과의 dashboardId를 반환한다. 다른 payload는409다.
2. 이미 삭제된 결과를 암묵적으로 다시 만들지 않는다.
3. Use case ends.

### A4: Partial write failure

**Trigger:** 지표·데이터셋·위젯·분석 저장 중 하나가 실패한다 (step 5).
**Flow:**

1. 같은 metadata transaction 전체를 rollback한다.
2. 재시도해도 고아 지표·중복 대시보드가 남지 않는다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 같은 계산의 KPI와 분류 차트가 같은 metricId/version을 참조한다.
- 원본 열 차원은 안정적 논리 ID와 검증한 타입의 snapshot으로 남는다.
- 기존 분석·지표·소스는 수정되지 않으며 새 저장 분석은 P1 편집 및 UC-003/004 참조 경계에 연결된다.

### Failure Postconditions

- 제안/미리보기는 DB 쓰기0이며 저장 실패는 일부 정의를 남기지 않는다.
- 저장 결과가 불명확하면 같은 requestId로 재조회/재시도한다. 새 ID로 무조건 다시 만들지 않는다.

## Business Rules

### BR-012-01: Canonical meaning

허용 구조화 집계만 서버 compiler로 SQL을 만든다. 자유 SQL 역파싱/이름 추측으로 지표를 만들지 않는다. 원본 열 차원의 identity와 display를 구분한다.

### BR-012-02: Source-bound reuse

소유한 같은 소스의 활성·동등 정규형만 재사용한다. sourceRevision/지표 version 불일치를 새 정의 생성으로 우회하지 않는다.

### BR-012-03: Atomic and idempotent persistence

지표·분석·생성 영수증을 같은 EntityManager transaction에 저장한다. actorId/requestId DB unique 제약과 payload digest를 사용한다.

### BR-012-04: Simple result-first UX

기존 질문·미리보기·저장 흐름을 유지하고 계산 기준만 펼친다. Source/Measure/Dimension 모드 선택을 선행 조건으로 요구하지 않는다.

### BR-012-05: Compatibility and explicit limits

기존 구조화 분석 snapshot과 명시 지표 연결을 유지한다. 첫 범위는 소유 DuckDB 파일 소스·원본 열 차원·최대6블록이다. 미지원 의미를 지원한다고 보고하지 않는다.

[상세 설계](../architecture/semantic-creation.md), [TC-012](../test_cases/TC-012-semantic-creation.md), [계획](../plans/UC-012.md).
