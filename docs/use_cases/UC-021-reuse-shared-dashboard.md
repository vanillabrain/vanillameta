# UC-021: Reuse a Shared or Published Dashboard

## Overview

**Use Case ID:** UC-021
**Use Case Name:** Reuse a Shared or Published Dashboard
**Primary Actor:** 로그인한 수신자
**Goal:** 허용된 공유/게시 대시보드를 내 데이터로 독립 재사용한다.
**Trigger:** 링크 화면에서 내 소스로 복제를 선택한다.
**Status:** Draft
**Requirements:** [FR-012, NFR-001, NFR-004](../requirements.md)

## Preconditions

- 소유자가 활성·미만료 링크의 재사용을 허용하고 수신자에게 자신의 파일 소스가 있다.

## Main Success Scenario

1. 소유자가 공유 재사용 허용 또는 게시 미리보기의 재사용 허용을 명시한다.
2. 수신자가 링크에서 복제를 선택하고 로그인한다.
3. 수신자가 내 소스와 열 연결을 선택하고 전체 결과를 미리본다.
4. 시스템은 현재 링크 권한과 버전·대상 소스를 검사한다.
5. 수신자가 새 비공개 복사본을 저장하고 새로고침한다.
6. 원본과 독립된 내 수치·차트·배치가 유지된다.

## Alternative Flows

### A1: Unavailable origin or target

**Trigger:** 불허·중지·만료·버전 변경 또는 타인 소스를 요청한다 (step 4).
**Flow:**

1. 저장하지 않고 사유를 안내한다. 기존 입력을 보존한다.
2. Use case ends.

### A2: Unknown save result

**Trigger:** 저장 결과를 받지 못한다 (step 5).
**Flow:**

1. 같은 요청을 다시 확인해 저장된 내 복사본만 반환한다. 링크 중지가 내 저장본 소유권을 취소하지 않는다.
2. Use case continues at step 5.

## Postconditions

### Success Postconditions

- 새 ID·내 소스·내 소유·비공개 복사본이며 원본/공유/게시 상태는 불변이다.

### Failure Postconditions

- 부분 쓰기는 rollback하고 원본 데이터·SQL·권한을 공개하지 않는다.

## Business Rules

### BR-021-01: Explicit grant and version

기존 링크 기본 불허. 공유는 현재 저장 버전, 게시는 게시 시점 내부 정의를 사용한다. 미저장 작업은 권한/버전을 재검사한다.

### BR-021-02: Recipient source boundary

로그인 및 대상 소스 소유권 필수. 재사용 API는 원본 소스 접근권·결과·SQL·조건 문자열·인증을 반환하지 않는다. 소유자가 허용한 계산식·필터 조건은 새 소스의 복사본 정의에 포함되며 복사본 소유자가 저장 후 편집/조회할 수 있다. 필요한 열 이름/타입만 연결 UI에 제공한다.

### BR-021-03: Independent atomic result

UC020의 새 ID·모든 폭 배치·비공개·원자 저장·동일 요청 영수증을 유지한다. 저장 후 복사본은 링크 중지와 독립이다.

### BR-021-04: Simple responsive UI

원본 링크의 진입 버튼과 기존 소스 연결/전체 미리보기를 재사용한다. 크기·정렬·실패/비활성·390/768/1440을 실제 확인한다.
