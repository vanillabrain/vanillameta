# UC-022: Edit a Copied Dashboard with AI and Publish

## Overview

**Use Case ID:** UC-022
**Use Case Name:** Edit a Copied Dashboard with AI and Publish
**Primary Actor:** 복사본 소유자
**Goal:** 내 데이터로 복제한 분석을 질문으로 수정하고 독립 게시한다.
**Trigger:** 복사본의 질문/차트 편집 화면을 연다.
**Status:** Draft
**Requirements:** [FR-007, FR-011, FR-012, NFR-001, NFR-004](../requirements.md)

## Preconditions

- 소유 복사본과 본인 파일 소스가 있으며 원본과 별도 ID다.
- 기존 원본 링크가 중지돼도 복사본 소유권은 유지된다.

## Main Success Scenario

1. 담당자가 복사본의 질문 편집 화면을 연다.
2. 수정 대상을 명시한 질문으로 변경을 요청한다.
3. 전체 미리보기에서 새 데이터·숫자/추세/차트와 비대상 보존을 확인한다.
4. 현재 초안의 저장과 게시 준비를 명시한다.
5. 시스템은 복사본에 저장하고 같은 저장 버전의 게시 미리보기를 연다.
6. 담당자가 범위·만료를 확인하고 링크 게시를 실행한다.
7. 소유/익명 화면을 새로고침해 같은 게시 결과와 추가 쓰기 없음을 확인한다.

## Alternative Flows

### A1: Unauthorized or stale handoff

**Trigger:** 다른 계정이 편집·저장·게시를 요청하거나 전달 revision이 다르다 (step 5).
**Flow:**

1. 원본·복사본·게시 상태를 변경하지 않고 권한/버전 오류를 안내한다.
2. Use case ends.

### A2: Preview or save failure

**Trigger:** AI/미리보기/저장에 실패한다 (step 3).
**Flow:**

1. 기존 초안을 보존하고 재시도/기존 복구 흐름을 제공한다. 실패한 결과를 게시하지 않는다.
2. 내용 변경의 선택 정의가 기존과 같으면 생성 교정을 최대2회 시도한다. 모두 같으면 성공 미리보기·자동저장·게시 준비로 진행하지 않는다.
3. Use case continues at step 2.

## Postconditions

### Success Postconditions

- 수정/게시된 대상은 복사본뿐이다. 원본·다른 복사본·비대상 정의/배치는 유지된다.

### Failure Postconditions

- 실패/새로고침으로 추가 저장·게시가 발생하지 않는다. 권한 밖 데이터/SQL을 공개하지 않는다.

## Business Rules

### BR-022-01: Copy ownership

모든 editor/AI/save/publication 요청은 복사본 소유권과 본인 소스에 묶인다. 중지된 원본 링크를 다시 요구하지 않는다.

### BR-022-02: Preview and revision continuity

새 데이터의 전체 미리보기를 검토한 초안만 저장하고 성공 revision으로 게시 준비한다. block ID·비대상·모든 폭 배치는 유지한다. 원 질문에서 제목만/이름만을 명시하면 선택 블록의 계산·차트·표시는 유지하고 제목만 적용한다.

### BR-022-03: Explicit independent publication

명시 게시 버튼만 공개를 수행한다. 익명은 집계 snapshot만 읽고 새로고침은 쓰기를 반복하지 않는다. 원본과 다른 복사본은 불변이다.

### BR-022-04: Responsive design

기존 UI Kit와 접힌 고급 설정을 유지한다. 질문·미리보기·저장/게시 컨트롤의390/768/1440 크기·정렬·넘침을 실제 검증한다.
