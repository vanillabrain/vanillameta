# UC-019: Continue a Save Question to Publication Preview

## Overview

**Use Case ID:** UC-019
**Use Case Name:** Continue a Save Question to Publication Preview
**Primary Actor:** 운영 담당자
**Goal:** 기존 질문에서 명시한 저장·게시 요청을 저장 성공→그 저장 버전의 게시 미리보기→명시 링크 게시로 이어간다.
**Trigger:** 기존 차트·배치 편집 질문에 저장과 게시 준비를 요청한다.
**Status:** Draft
**Requirements:** [FR-007, FR-011, NFR-001, NFR-004](../requirements.md)

## Preconditions

- UC014~017의 공통 초안/미리보기/저장 및 UC018 게시 경계를 사용한다.
- 소유 저장 분석과 원본 접근 권한이 있다.

## Main Success Scenario

1. 담당자가 현재 초안에서 “저장하고 게시 미리보기로 이어 줘”라고 질문한다. 지원되는 블록 수정과 저장·게시를 함께 요청할 수도 있다.
2. 서버는 질문만으로 의도를 분류하고 쓰기 없는 전체 미리보기와 저장/게시 준비 요청 여부를 반환한다.
3. 화면은 검증된 결과만 기존 저장 API로 한 번 저장한다.
4. 저장 성공의 dashboardId/revision을 확인하고 그 저장 revision에 묶인 게시 화면으로 이동한다.
5. 게시 화면은 현재 소유권·저장 버전을 읽고 일치하면 쓰기 없는 게시 미리보기를 자동으로 만든다. 저장 완료 안내와 별도의 게시 상태·공개 범위를 표시한다.
6. 담당자가 전체 기간·필터 없음·UTC 고정 집계와 만료일을 확인하고 링크 게시를 누른다.
7. 게시 완료 버전·링크를 확인하고 새로고침/공개 조회한다.

## Alternative Flows

### A1: Save fails or is uncertain

**Trigger:** 저장409/통신오류/취소가 발생한다 (step 3).
**Flow:**

1. 기존 UC-017 복구에 머무르며 초안·질문을 유지한다. 게시 화면 이동·게시 호출은 없다. 복구 후 게시 요청은 다시 명시한다.
2. Use case continues at step 1.

### A2: Publication preparation fails or revision changes

**Trigger:** 저장후상태조회/게시미리보기실패 또는다른편집이저장된다 (step 5).
**Flow:**

1. 저장 완료 사실과 게시 전 상태를 구분한다. 새로운 저장본을 자동 게시하지 않는다. 같은 revision이면 미리보기를 재시도하고 다르면 저장 화면 확인을 안내한다.
2. Use case continues at step 5.

### A3: No explicit publication request

**Trigger:** 저장만/변경만/부정·조건·질문형·인용형게시표현이다 (step 1).
**Flow:**

1. 기존 저장·변경·확인 질문 흐름을 유지하고 게시를 시작하지 않는다. 지원하지 않는 계정 수신자·게시 중지·복제 요청은 확인 질문으로 처리한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 질문에서 저장한 같은 버전만 게시 미리보기로 이어지며 실제 공개는 명시적인 링크 게시에서만 실행한다.

### Failure Postconditions

- 게시 준비 실패가 성공한 저장을 되돌리거나 다시 저장하지 않으며 공개 상태를 바꾸지 않는다.

## Business Rules

### BR-019-01: Intent is preparation

기존 strict 단일/batch 계획에 선택적 `publicationRequested: true`만 추가한다. false나 다른 값은 400으로 거절하며 필드 생략이 기존 동작이다. true는 `saveRequested: true` 및 non-clarify에서만 허용한다. 명시적인 저장과 게시·게시 미리보기 요청에만 사용한다. 부정·조건·질문·인용·보고 표현과 불명확한 범위는 실행하지 않는다. 생성기의 editPrompt/actions에는 저장·게시 문구를 제거한다. 분류 LLM 입력은 질문 문자열뿐이다.

### BR-019-02: Saved revision handoff

화면은 게시 요청 flag와 auto/save 관계를 검증한다. 저장 응답의 분석 ID와 64자리 소문자 hex revision을 확인한 후 `/dashboard/:id/publication?savedRevision=:revision`으로 이동한다. URL은 게시 권한이 아니며 기존 owner API 검증을 우회하지 않는다. 빈 값·형식 오류·중복 query·상태 조회 revision 불일치 때 자동·수동 미리보기와 게시를 막고 저장 화면 확인으로 연결한다.

### BR-019-03: No mount publishing

revision 일치 시 자동 실행은 조회·미리보기뿐이다. URL 조작·새로고침은 게시·저장 쓰기를 일으키지 않는다. 공개 범위는 링크를 가진 사람으로 고정하며 화면에 표시한다. 게시 버전·만료·visibility는 기존 UC-018의 명시적 링크 게시 버튼에서만 작성한다. 원문 질문을 URL로 노출하거나 별도 영구 저장하지 않는다.

### BR-019-04: Continuity and failures

저장 실패·취소·묵은 응답에는 게시 화면으로 이동하지 않는다. 게시 상태 조회·미리보기 실패에는 저장 완료와 재시도 안내를 표시하며 저장을 반복하지 않는다. route 변경·cleanup은 abort와 sequence로 묵은 미리보기를 무시한다. 기존 버튼 28px·입력 32px·폰트 12px와 390/768/1440px 정렬을 실제 검증한다.
