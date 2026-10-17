# Use Case: Recover New Creation Question

## Overview

**Use Case ID:** UC-048
**Use Case Name:** Recover New Creation Question
**Primary Actor:** 운영 담당자
**Goal:** 새 대시보드를 만들기 전 입력한 질문과 소스를 새로고침 후 명시 복구한다.
**Trigger:** 담당자가 질문 입력 후 새 생성 화면을 새로고침한다.
**Status:** Draft
**Requirements:** [FR-009, NFR-004](../requirements.md)

## Preconditions

- 같은 로그인 세대·탭이며 보관 기록이24시간/8KiB 안에 있다.

## Main Success Scenario

1. 담당자가 소스를 선택하고 질문을 입력한다.
2. 화면이 질문·소스 식별자만 현재 로그인 범위의 탭에 보관한다.
3. 새로고침 후 접근 가능한 소스 목록을 확인하고 복구 또는 폐기를 제안한다.
4. 담당자가 복구를 누른다. 소스가 있으면 현재 구조·접근 권한을 다시 확인한다.
5. 화면에 질문과 선택 소스가 복구된다. 지표 선택·이전 제안/미리보기는 복구하지 않는다.
6. 담당자가 명시적으로 제안을 요청해 기존 생성 흐름을 이어간다. 현재 질문의 저장 성공 후 보관 기록을 정리한다.

## Alternative Flows

### A1: Inaccessible source or failed read

**Trigger:** 목록에 소스가 없거나 소스 구조 조회가 실패한다 (step 3 or 4).
**Flow:**

1. 질문 본문을 적용하지 않고 기록을 유지한다. 담당자가 권한 복구 후 재시도하거나 해당 기록을 명시 폐기한다.
2. Use case ends.

### A2: Higher priority context

**Trigger:** 저장 확인 요청 또는 직접 소스/제안 링크가 있다 (step 3).
**Flow:**

1. 기존 UC032 저장 확인 또는 직접 링크 문맥을 우선하며 보관 질문을 자동 적용하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 명시 복구만 질문을 입력에 적용한다. 자동 생성·업로드·저장·게시 요청은 없다.

### Failure Postconditions

- 보관 실패는 현재 질문 편집을 막지 않으며 새로고침 시 손실 가능성을 안내한다.

## Business Rules

### BR-048-01: Minimal scoped record

기존 인증 scope/탭 저장소에 별도 suffix로 질문 최대2000자·소스ID만24h/8KiB 보관한다. 파일·행·SQL·제안·미리보기·토큰은 보관하지 않는다. 기존 로그인 세대·갱신 scope 계약을 재사용한다. 손상/만료는 해당 기록만 제거하며 새 로그인·다른 탭과 연결하지 않는다.

### BR-048-02: Explicit and current recovery

권한 목록 조회 후 복구를 제안하며 본문은 사전에 노출하지 않는다. 소스가 있으면 현재 profile 성공 후 입력에 적용한다. 새로 편집한 질문·직접 링크·미확인 저장 요청을 오래된 기록으로 덮지 않는다. 복구는 이전 계산 결과의 유효성을 증명하지 않는다.

### BR-048-03: Nonblocking retention

저장소 오류/한도는 현재 입력을 보존하는 안내이며 생성 기능을 막지 않는다. 빈 질문·명시 폐기·현재 문맥의 저장 성공만 해당 보관 질문을 정리한다. 다른 직접 링크의 저장이 별도 보관 질문을 자동 폐기하지 않는다.
