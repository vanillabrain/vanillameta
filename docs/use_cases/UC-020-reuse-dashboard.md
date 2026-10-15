# UC-020: Duplicate a Saved Dashboard with a New Source

## Overview

**Use Case ID:** UC-020
**Use Case Name:** Duplicate a Saved Dashboard with a New Source
**Primary Actor:** 운영 담당자
**Goal:** 소유한 저장 대시보드의 정의와 반응형 배치를 새 데이터 소스에 연결해 독립된 분석으로 저장한다.
**Trigger:** 저장 화면에서 ‘복제해서 재사용’을 선택한다.
**Status:** Draft
**Requirements:** [FR-012, NFR-001, NFR-004](../requirements.md)

## Preconditions

- 원본 대시보드와 원본·대상 DuckDB 파일 소스에 접근 권한이 있다.
- 원본이 기존 분석의 1~6개 지원 블록으로 구성되어 있다.

## Main Success Scenario

1. 담당자가 원본 저장 화면에서 복제 초안을 연다. 아직 새 대시보드를 저장하지 않는다.
2. 새 제목과 대상 소스를 선택한다. 같은 이름·호환 타입의 열은 자동 연결하고 필요한 연결은 직접 지정한다.
3. 모든 사용 열의 연결을 확인하고 전체 결과를 미리본다.
4. 시스템은 원본·대상 버전, 모든 계산·차트·배치를 검증해 새 소스의 결과를 표시한다.
5. 담당자가 복사본 저장을 누른다.
6. 시스템은 새 대시보드·블록 ID·소유 관계를 원자적으로 저장하고 복사본을 연다.
7. 담당자가 새로고침해 새 소스의 수치·차트·배치가 유지됨을 확인한다.

## Alternative Flows

### A1: Missing or incompatible columns

**Trigger:** 필요한 열 연결이 비었거나 타입이 다르다 (step 2).
**Flow:**

1. 연결이 필요한 열과 사유를 표시한다. 유효한 전체 미리보기 없이 저장하지 않는다.
2. Use case continues at step 2.

### A2: Input or source changes after preview

**Trigger:** 제목·소스·연결을 바꾸거나 원본/소스 버전이 달라진다 (step 5).
**Flow:**

1. 이전 미리보기로 저장하지 않는다. 현재 입력은 보존하고 다시 미리보기를 안내한다.
2. Use case continues at step 3.

### A3: Save response is lost

**Trigger:** 저장 결과를 받지 못한다 (step 5).
**Flow:**

1. 초안과 동일한 요청 식별자를 보존한다. 같은 저장 요청을 다시 확인하면 기존 복사본을 반환한다.
2. Use case continues at step 6.

## Postconditions

### Success Postconditions

- 복사본은 새 ID·소스·소유 관계를 가지며 비공개 상태다. 원본·게시 버전·공유 링크는 바뀌지 않는다.

### Failure Postconditions

- 부분 복사본을 만들지 않으며 원본을 수정하지 않는다. 미저장 초안은 화면에 남는다.

## Business Rules

### BR-020-01: Independent copy

미리보기까지 DB 쓰기는 없다. 복사본은 새 dashboard/block ID와 새 비공개 공유 상태를 갖는다. 원본 지표 링크·게시·저장 보기·인증 권한을 복사하지 않는다. 계산식은 새 소스의 분석 snapshot으로 복제하며 중앙 지표를 생성·변경하지 않는다.

### BR-020-02: Explicit safe mapping

열 연결은 원본에서 실제 사용하는 열과 대상의 호환 타입을 기준으로 한다. 정확한 이름은 자동 연결하고 나머지는 명시 선택한다. 숫자/시간/문자/그 밖의 타입을 구분하며 임의 변환·업무 의미 추측은 하지 않는다. 기존 제한 SELECT 문법과 검증기를 재사용한다. SQL 문자열 값·출력 alias·표시 단위·필터·차트 종류는 유지한다. 안전하게 연결할 수 없는 식은 오류를 표시하고 저장하지 않는다.

### BR-020-03: Preview-bound atomic save

서버 미리보기는 actor·원본 revision·대상 소스 revision·새 정의/배치에 묶인 5분 ticket으로 저장을 제한한다. 저장 시 권한과 버전을 재확인한다. 원자 저장과 기존 생성 영수증의 actor/requestId 유일성으로 재시도 중복 생성을 막는다. 입력 변경은 ticket을 폐기한다.

### BR-020-04: Responsive continuity

복제 전후 각 폭의 논리 좌표·읽기 순서·크기를 새 블록 ID에 연결한다. 현재 shadcn UI Kit를 재사용하며 390/768/1440px의 기본/비활성/로딩/오류 상태와 입력·버튼 정렬·넘침을 실제 확인한다. 묵은 응답은 새 소스 선택을 덮어쓰지 않는다.
