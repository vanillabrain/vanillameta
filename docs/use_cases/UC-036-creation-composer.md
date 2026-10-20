# UC-036: Continue a Creation from the Conversation Composer

## Overview

**Use Case ID:** UC-036
**Use Case Name:** Continue a Creation from the Conversation Composer
**Primary Actor:** 분석 소유자
**Goal:** 저장 전 생성안의 후속 수정·추가·명시 저장을 기존 대화 입력창에서 이어간다.
**Trigger:** 최근 대화 실행이 미저장 생성안을 제안했다.
**Status:** Draft
**Requirements:** [FR-008, FR-009, FR-011, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 소유 대화의 가장 최근 실행이 성공한 미저장 생성안이며 소스/제안 기준이 유효하다.

## Main Success Scenario

1. 시스템은 기존 입력창 위에 저장 전 생성안 대상을 표시한다.
2. 소유자가 블록 번호·유일한 제목으로 수정을 요청하거나 새 블록 추가를 요청한다.
3. 서버가 소유 실행/제안/소스 기준을 확인하고 기존 생성안 수정기로 전체 미리보기를 갱신한다.
4. 같은 대화에 질문·결과와 새 전체 미리보기를 표시하며 원본 편집기는 유지한다.
5. 소유자가 입력창에서 생성안의 비공개 저장을 명시 요청한다.
6. 서버가 최신 생성안만 저장하고 완료 링크·새로고침 후 같은 결과를 표시한다.

## Alternative Flows

### A1: Ambiguous or unsupported target

**Trigger:** 대상/행동이 모호하거나 원본·공유·게시·복제·혼합 저장을 요구한다 (step 2).
**Flow:**

1. 두 대시보드를 변경하지 않고 대상/별도 저장을 명확히 하도록 안내한다. 원본 편집으로 돌아가는 명시 경로를 제공한다.
2. Use case continues at step 2.

### A2: Failed or uncertain response

**Trigger:** 수정·저장 실패/응답 불명확/취소 (step 3 or 6).
**Flow:**

1. 질문과 이전 결과를 보존한다. 불명확이면 다른 질문·카드 작업·대상 변경을 잠그고 동일 요청만 재확인한다.
2. Use case continues at step 3.

### A3: Stale or incomplete proposal

**Trigger:** 제안 만료·권한 없음·기준 변경·미리보기 미완성 (step 3).
**Flow:**

1. 원본과 최신 생성안을 유지하고 카드에서 기준/소스를 먼저 확인하도록 안내한다. 자동 재생성/저장/게시하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 같은 입력창의 후속 질문과 명시 저장이 새 대시보드에만 적용되고 원본은 유지된다.

### Failure Postconditions

- 질문/미리보기 보존, 원본으로 자동 전환하거나 저장/공개하지 않는다.

## Business Rules

### BR-036-01: Visible context

가장 최근 성공한 미저장 생성 실행을 기본 대상으로 표시한다. 원본 편집 복귀는 명시 동작이며 질문을 자동 전송하지 않는다. 저장 후 대상 유지는 후속 [UC037](UC-037-creation-publication.md#br-037-01-saved-target)을 따른다.

### BR-036-02: Bounded commands

서버는 첫째~여섯째/1~6번 블록·유일한 제목·새 블록 추가만 식별한다. 단일 블록은 묵시 대상이 될 수 있다. 여러 대상/원본/공유/혼합 저장·모호함은 무변경 안내다. 저장은 지원하는 명시적 단독 긍정 문구만 실행하며 모델 추측으로 쓰기를 허용하지 않는다. 임의 자연어 전체 지원은 아니다.

### BR-036-03: Preserve and replay

수정은 UC035의 같은 요청 단일화/CAS/완료 receipt를 사용한다. raw 질문 hash를 같은 receipt에 보존해 완료 수정의 응답 유실 후 원 캐시가 없어도 같은 결과를 확인한다. 영속 실행에 질문/계산식을 추가하지 않는다. 저장은 기존 실행의 단일 생성 영수증이며 최신 바인딩만 허용한다.
