# Use Case: Reuse Selected Blocks

## Overview

**Use Case ID:** UC-024
**Use Case Name:** Reuse Selected Blocks
**Primary Actor:** 공유 수신자
**Goal:** 필요한 열이 없는 블록을 제외하고 나머지를 새 소스로 재사용한다.
**Trigger:** 재사용 화면에서 새 소스의 열 연결이 부족하다.
**Status:** Draft
**Requirements:** [FR-012](../requirements.md)

## Preconditions

- 수신자는 로그인했고 허용된 원본과 본인 서버 파일 소스를 사용한다.

## Main Success Scenario

1. 수신자가 원본과 새 소스를 선택한다.
2. 시스템이 선택 블록별 미연결 필드를 표시한다.
3. 수신자가 필요한 블록을 명시적으로 제외한다.
4. 시스템이 남은 블록에 필요한 연결만 검증해 전체 미리보기를 계산한다.
5. 수신자가 확인 후 독립 비공개 복사본을 저장하고 새로고침한다.

## Alternative Flows

### A1: No valid selection

**Trigger:** 선택이 비거나 원본에 없는/중복 ID가 있다 (step 3).
**Flow:**

1. 시스템이 미리보기·저장을 차단하고 원본 선택을 다시 확인하도록 안내한다.
2. Use case continues at step 3.

### A2: Changed selection or origin

**Trigger:** 선택/소스/연결 또는 원본 버전·허용이 바뀐다 (step 4).
**Flow:**

1. 기존 미리보기를 저장하지 않고 재확인을 요구한다. 입력은 보존한다.
2. Use case continues at step 1.

## Postconditions

### Success Postconditions

- 포함 블록은 새 ID와 원래 순서·폭별 배치를 갖고 원본은 유지된다.

### Failure Postconditions

- 제외 블록·타 소스 권한·무효 ticket을 임의로 저장하지 않는다.

## Business Rules

### BR-024-01: Explicit subset

최소1개·중복 없는 원본 블록만 선택한다. 생략은 전체 포함이며 자동 제외하지 않는다.

### BR-024-02: Preserve independent copy

선택한 원본 순서·모든 폭 배치를 유지하고 새 ID로 저장한다. 선택 변경 뒤 이전 ticket을 쓰지 않는다.
