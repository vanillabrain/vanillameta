# Use Case: Prompt To Dashboard

## Overview

**Use Case ID:** UC-005
**Use Case Name:** Prompt To Dashboard
**Primary Actor:** 운영 담당자
**Secondary Actors:** 공유 수신자
**Goal:** 대화와 직접 편집으로 대시보드를 만들고 게시·복제하여 재사용한다.
**Trigger:** 담당자가 데이터 기반 대시보드 제작을 요청한다.
**Status:** Reviewed
**Requirements:** [FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, NFR-003, NFR-004, C-003](../requirements.md)

## Preconditions

- 담당자가 로그인하고 소유한 소스를 선택하거나 분석할 파일을 제공한다.
- 실제 요청을 처리할 LLM 연결이 준비돼 있다.

## Main Success Scenario

1. 담당자가 데이터와 원하는 대시보드를 한 요청으로 제공한다.
2. 시스템이 소스를 확인하고 지표·차원·블록 및 배치를 제안하여 미리보기를 보여준다.
3. 담당자가 블록을 직접 이동·크기 조절하고 대화로 특정 블록 내용을 수정한다.
4. 시스템이 같은 정의에 변경을 반영하고 나머지 블록의 ID·계산·배치를 유지한다.
5. 담당자가 저장과 링크 공유를 요청한다.
6. 시스템이 검증된 정의를 저장하고 명시된 범위로 게시하여 링크·게시 버전·데이터 시점을 보여준다.
7. 담당자가 새로고침하고 공유 수신자가 링크로 게시 결과를 조회한다.
8. 담당자가 추가 수정 후 재게시를 요청한다. 시스템은 요청 전까지 기존 게시 결과를 유지한다.
9. 공유 수신자가 허용된 게시 결과를 복제하고 자신의 소스에 매핑한다.
10. 시스템이 새 데이터 결과를 미리보고 독립 대시보드로 저장하며 원본을 유지한다.

## Alternative Flows

### A1: Ambiguous semantics

**Trigger:** 소스 후보나 지표 계산 의미가 확정되지 않는다 (step 2).
**Flow:**

1. 시스템이 결과를 바꾸는 부족한 정보만 묻고 현재 초안을 보존한다.
2. 담당자가 소스 또는 계산 기준을 지정한다.
3. Use case continues at step 2.

### A2: Conflict or unsupported operation

**Trigger:** 모델/블록 유형이 지원되지 않거나 저장 버전이 변경된다 (step 4).
**Flow:**

1. 시스템이 실패 원인과 완료된 범위를 표시하고 이전 저장/게시 정의를 유지한다.
2. 담당자가 최신 상태에서 지원되는 변경을 재요청한다.
3. Use case continues at step 3.

### A3: Publication failure

**Trigger:** 저장은 성공했으나 게시가 실패한다 (step 6).
**Flow:**

1. 시스템이 저장된 초안과 게시 실패를 구분해 보여준다.
2. 담당자가 게시만 재시도한다. 시스템은 초안/게시를 중복 생성하지 않는다.
3. Use case continues at step 6.

### A4: Missing source mapping

**Trigger:** 복제본에 필요한 열/지표가 새 소스에 없다 (step 9).
**Flow:**

1. 시스템이 매핑되지 않은 블록과 필요한 필드를 표시하며 해당 결과의 저장/게시를 막는다.
2. 담당자가 대응 필드를 지정하거나 해당 블록을 제외한다.
3. Use case continues at step 10.

### A5: Revoked share

**Trigger:** 수신자가 중지된 링크를 연다 (step 7).
**Flow:**

1. 시스템이 조회를 거절하고 게시 데이터를 반환하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 다시 편집할 정의와 반응형 배치가 저장되고 명시한 게시 범위의 결과가 링크로 열린다.
- 복제본은 새 소유자/정의/소스 참조를 가지며 원본 정의와 게시 버전은 유지된다.

### Failure Postconditions

- 실패한 변경은 이전 저장/게시 정의를 훼손하지 않는다. 이미 성공한 단계는 명시하여 보존한다.
- 요청한 범위를 넘는 공개, 타인 소스 권한 복사, 재시도 중복 생성은 발생하지 않는다.

## Business Rules

### BR-001: One conversation

한 입력에서 제작·질문·편집·저장·게시·복제 의도를 실행한다. 모드 선택을 기본 선행 단계로 요구하지 않는다. 생성만 요청하면 미리보기까지, 저장/공유를 명시하면 해당 단계까지 실행하고 단계별 결과를 표시한다.

### BR-002: Reusable semantics

Measure/Dimension은 소스와 정의 버전에 연결한다. 이미 선택한 지표는 재사용하고 새 정의와 대시보드는 함께 저장한다. 계산식의 모호한 분모/열은 추측하여 게시하지 않는다.

### BR-003: Stable block editing

블록 추가·삭제·복제·내용 수정·이동·크기 조절은 안정적 ID를 사용한다. 특정 블록 내용 변경은 다른 블록과 기존 배치를 보존한다. undo/redo·새로고침·폭 전환에도 검증한 정의를 유지한다.

### BR-004: Publication boundary

게시 버전은 편집 초안과 분리한다. 공유 범위와 데이터 snapshot/live 모드·시점을 표시한다. 초안 수정은 명시 재게시 전까지 게시 결과를 바꾸지 않는다. 공유 중지는 서버 조회를 차단한다.

### BR-005: Independent reuse

복제본은 새 ID/소유자를 가지며 원본을 바꾸지 않는다. 새 소스의 타입/필드/지표·차원 매핑을 검증한다. 링크 접근은 원본 소스 접근권을 복사하지 않는다.

### BR-006: Verifiable completion

expectedRevision·요청 ID로 충돌 및 중복을 제어한다. 저장과 게시의 부분 실패를 구분한다. 전체 목표 완료는 TC-005의 실LLM·실제 화면/API 및 반응형 검증으로 판단한다.
