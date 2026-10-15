# UC-016: Preview And Save Multiple Block Changes

## Overview

**Use Case ID:** UC-016
**Use Case Name:** Preview And Save Multiple Block Changes
**Primary Actor:** 운영 담당자
**Goal:** 한 질문의 여러 블록 변경을 전체 미리보기하고 한 번에 저장하며 부분 실패를 안전하게 재시도한다.
**Trigger:** 번호·정확 제목으로 두 개 이상의 블록 변경을 질문한다.
**Status:** Draft
**Requirements:** [FR-009, FR-010, NFR-001](../requirements.md)

## Preconditions

- 소유 분석의 현재 revision과 최대6개 안정 key의 공통 초안이 있다.
- UC014 명시 저장·UC015 단일 대상 경계를 유지한다.

## Main Success Scenario

1. 담당자가 각 대상과 변경을 질문한다. 저장은 원하는 경우에만 명시한다.
2. 서버가 권한·revision·전체 초안을 검증하고 질문을 최대6개 내용/배치 작업으로 분해한다.
3. 모든 대상 참조를 현재 블록에 결정적으로 대조한다. 각 대상은 서로 달라야 한다.
4. 변경을 메모리에만 순서대로 구성하고 전체 초안을 재검증한다. 모든 차트와 추세의 미리보기가 성공해야 결과를 반환한다.
5. 화면은 모든 대상의 변경 종류와 전체 미리보기를 표시하고 한 단계의 undo/redo로 취급한다.
6. 담당자의 저장 버튼 또는 명시 저장 요청으로 전체 결과를 기존 단일 transaction에 저장한다.
7. 새로고침 후 대상 변경과 비대상·다른 폭의 보존을 확인한다.

## Alternative Flows

### A1: Ambiguous or unsupported plan

**Trigger:** 참조 누락/중복 대상/존재하지 않는 대상/2~6개 밖의 작업 (step 3).
**Flow:**

1. 전체 요청을 거절하고 질문을 구체화하도록 안내한다. 단일 선택으로 축소하거나 일부만 생성하지 않는다.
2. Use case ends.

### A2: Partial generation or preview failure

**Trigger:** 한 작업 또는 전체 미리보기가 실패한다 (step 4).
**Flow:**

1. 실패 단계와 가능한 경우 블록 번호를 안내한다. 성공했던 부분도 초안·이력·DB에 적용하지 않는다.
2. 기존 초안·질문을 유지한다. 질문을 고쳐 전체 요청을 다시 실행한다. 실패 부분만 자동 저장하지 않는다.
3. Use case continues at step 1.

### A3: Save conflict or uncertain response

**Trigger:** 저장 transaction 실패/409/응답 유실 (step 6).
**Flow:**

1. 서버 실패는 전체 rollback한다. 화면의 검증된 전체 초안은 보존한다.
2. 409는 최신 내용 재조회로 복구한다. 응답 유실은 저장 상태가 불명확함을 안내하고 최신 저장 상태부터 확인한다.
3. Use case ends.

## Postconditions

### Success Postconditions

- 검증된 대상들만 변경되고 전체 결과가 한 transaction으로 저장된다.

### Failure Postconditions

- 생성/미리보기 실패 시 전체 초안·이력·DB가 유지된다. 실패/취소 뒤 늦은 결과는 적용하지 않는다.

## Business Rules

### BR-016-01: Bounded plan and targets

자동 의도의 batch는 서로 다른2~6개 블록의 작업이다. 모든 layout 작업은 현재 선택한 단일 layoutMode를 공유하고 배치 동작에 폭을 명시하는 질문은clarify다. 각 작업은 content 또는 layout 하나이며 같은 블록의 중복 작업은 거절한다. targetPrompt는 원래 질문에 실제 포함된 번호/정확 제목 참조여야 한다. 서버 resolver에 선택/확인 fallback을 주지 않는다. 생성 모델의 임의 key나 전체 items를 신뢰하지 않는다.

### BR-016-02: Whole preview before application

모든 대상은 생성 전 검증한다. 각 결과는 대상 하나에만 병합하고 현재 폭 배치만 변경한다. 최종 전체 compile/preview가 성공해야 changes와 전체 preview를 반환한다. 생성·preview는 DB 쓰기0이다. 내용 작업의 editPrompt에서 제목/이름/title/rename 변경을 명시하지 않으면 기존 제목을 서버가 보존한다. 이는 원문 분해 정확성 전체 보장이 아니다.

### BR-016-03: One history entry and atomic save

FE는 changes의 개수·유일한 현재 key·종류·각 정의와 배치를 모두 검증한 뒤 한 번에 반영한다. 단일 undo/redo로 전체를 전환한다. 전체 미리보기 성공 후만 저장할 수 있고 frozen nextItems를 기존 editor 저장 API에 한 번 전송한다. 서버의 기존 revision CAS와 transaction을 재사용한다.

### BR-016-04: Recover without partial effects

대상/변경/미리보기 실패는 전체 변경 미적용과 질문 수정·재실행 안내를 표시한다. 실패 블록 번호는 현재 items의 번호이고 SQL/원시 provider 오류는 노출하지 않는다. 취소·409·응답 유실은 UC014 경계를 유지한다.

UC-017 후속: 저장409와결과불명확은 [편집 복구 계약](UC-017-editor-recovery.md)의상태확인/초안보존·제한병합을사용한다. 저장실패후즉시재전송하지않고서버저장상태부터확인한다. 기존초안을버리는재로드는명시선택으로남긴다.
