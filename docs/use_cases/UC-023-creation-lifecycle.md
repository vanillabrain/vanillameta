# UC-023: Continue Creation with Save and Publication

## Overview

**Use Case ID:** UC-023
**Use Case Name:** Continue Creation with Save and Publication
**Primary Actor:** 운영 담당자
**Goal:** 생성 미리보기를 같은 질문 입력에서 저장하고 게시 준비한다.
**Trigger:** 생성 미리보기 뒤 저장·게시 준비를 명시하거나 생성 질문에 함께 요청한다.
**Status:** Draft
**Requirements:** [FR-007, FR-011, NFR-004](../requirements.md)

## Preconditions

- 본인 소스와 지정 LLM이 준비돼 있다.
- 후속 저장에는 유효한 proposal/미리보기 digest가 있다.

## Main Success Scenario

1. 담당자가 생성 질문으로 지표·차원·차트 미리보기를 확인한다.
2. 같은 입력에서 현재 초안의 저장과 게시 준비를 명시한다.
3. 시스템이 현재 proposal의 권한·버전·미리보기를 재검증한다.
4. 시스템이 같은 요청 ID로 저장하고 확정된 저장 버전의 게시 준비 화면을 연다.
5. 담당자가 범위·만료·결과를 확인하고 별도 게시 버튼으로 공개한다.

## Alternative Flows

### A1: Ambiguous or unsupported request

**Trigger:** 의미가 모호하거나 생성 초안 변경+저장 범위가 지원되지 않는다 (step 2).
**Flow:**

1. 원래 초안·질문을 보존하고 필요한 확인 또는 저장 후 편집 경로를 안내한다. 저장하지 않는다.
2. Use case continues at step 2.

### A2: Changed source or preview

**Trigger:** 권한·소스·지표 버전·digest가 달라졌다 (step 3).
**Flow:**

1. 저장을 차단하고 다시 미리보도록 안내한다.
2. Use case continues at step 1.

### A3: Uncertain save and receipt replay

**Trigger:** 저장 응답이 유실됐다 (step 4).
**Flow:**

1. 같은 요청으로 영수증을 재확인해 같은 분석을 연다. 재생은 과거 revision을 증명하지 않으므로 게시 결과를 수동으로 다시 확인한다.
2. Use case continues at step 5.

## Postconditions

### Success Postconditions

- 명시한 초안만 저장하고 공개는 별도 동작으로 실행한다.

### Failure Postconditions

- 중복 분석을 만들지 않으며 실패한 제안·취소 요청을 저장·공개하지 않는다.

## Business Rules

### BR-023-01: Frozen creation request

후속 save-only는 기존 proposal/digest/requestId를 유지한다. 새 소스에 이전 초안을 적용하지 않는다.

### BR-023-02: Explicit lifecycle boundary

서버가 검증한 명시 저장/게시 준비 플래그만 연결한다. 새 저장 revision과 영수증 재생의 확인 범위를 구분한다.
