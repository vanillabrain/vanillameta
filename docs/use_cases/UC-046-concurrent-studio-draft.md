# UC-046: Recover a Studio Draft After Concurrent Changes

## Overview

**Use Case ID:** UC-046
**Use Case Name:** Recover a Studio Draft After Concurrent Changes
**Primary Actor:** 대시보드 소유자
**Goal:** 다른 탭의 저장 변경을 유지하면서 보관 초안을 복구한다.
**Trigger:** 미저장 초안을 보관한 탭을 다른 탭 저장 후 새로고침한다.
**Status:** Draft
**Requirements:** [FR-009, NFR-003, NFR-004](../requirements.md)

## Preconditions

- 같은 로그인 세션·탭의 유효한 초안과 비교 기준이 보관되어 있다.
- 최신 편집 권한이 있고 데이터 소스 버전이 같으며 현재 새 편집이 없다.

## Main Success Scenario

1. 담당자가 첫 탭에서 미저장 블록과 배치를 편집한다.
2. 담당자가 다른 탭에서 대시보드를 수정해 저장한다.
3. 담당자가 첫 탭을 새로고침한다.
4. 시스템은 편집 권한 확인 후 저장본 변경과 보관 초안을 안내한다.
5. 담당자가 최신본과 초안 비교를 선택한다.
6. 시스템은 최신본을 조회해 실제 변경 항목과 같은 항목의 충돌 값을 보여준다.
7. 담당자가 충돌 항목의 내 초안 사용을 명시 선택하고 병합 미리보기를 요청한다.
8. 시스템은 최신본의 비대상 변경을 유지하고 전체 미리보기 후 미저장 편집으로 연다.
9. 담당자가 명시 저장하고 새로고침해 결과를 확인한다.

## Alternative Flows

### A1: No overlapping changes

**Trigger:** 양쪽이 서로 다른 항목을 변경했다 (step 6).
**Flow:**

1. 충돌 동의 없이 병합 미리보기를 제공한다.
2. Use case continues at step 8.

### A2: Unavailable or incompatible baseline

**Trigger:** 비교 기준 없음·소스 교체·삭제된 대상 변경·정의 교체·겹치는 배치가 발견된다 (step 6).
**Flow:**

1. 시스템은 초안을 보존하고 병합을 차단하며 이유를 안내한다.
2. 담당자는 기존 저장본을 확인하거나 보관 초안만 명시 폐기한다.
3. Use case ends.

### A3: Read or preview failed

**Trigger:** 조회 실패·미리보기 실패·재충돌·대기 중 새 편집이 발생한다 (step 6 or 8).
**Flow:**

1. 시스템은 현재 편집과 보관 초안을 유지하고 재시도를 제공한다.
2. 재충돌은 최신본 재조회와 새로운 충돌 선택을 요구한다.
3. Use case continues at step 5.

## Postconditions

### Success Postconditions

- 비대상 최신 변경·ID·배치를 유지하며 저장 성공 시 보관 기록을 정리한다.

### Failure Postconditions

- 자동 저장·게시·AI 재실행 없이 보관 초안과 현재 편집을 유지한다.

## Business Rules

### BR-046-01: Bounded comparison data

새 보관 형식은 SQL 없는 기준 문서를 함께 보관하며 전체24h/256KiB를 유지한다. 이전 형식은 같은 버전 복구만 제공한다.

### BR-046-02: Explicit overlap resolution

실제 로컬 변경만 최신본에 적용한다. 같은 항목 충돌은 두 값을 보여주고 명시 동의를 요구한다. 구조·배치 오류를 조용히 생략하거나 자동 재배치하지 않는다.

### BR-046-03: Revalidate before applying

권한·소스·저장 버전을 서버에서 확인하고 전체 미리보기 후 적용한다. 늦은 응답이 새 편집을 덮지 않으며 재충돌은 동의를 초기화한다. 저장 성공 뒤 후속 조회 대기 중에도 이미 저장된 기록을 정리한다.
