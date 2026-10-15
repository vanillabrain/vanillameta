# UC-018: Publish an Explicit Dashboard Snapshot

## Overview

**Use Case ID:** UC-018
**Use Case Name:** Publish an Explicit Dashboard Snapshot
**Primary Actor:** 운영 담당자
**Goal:** 저장본의 전체 기간 집계·배치를 미리보고 링크 게시·재게시·중지를 명시 실행한다.
**Trigger:** 저장 화면의 게시 버전 버튼을 연다.
**Status:** Draft
**Requirements:** [FR-011, NFR-001, NFR-002, NFR-004](../requirements.md)

## Preconditions

- 저장 분석과 원본의 소유권이 있다. 기존 live 공유는 별도 기능으로 유지한다.
- 원본 DuckDB 분석은 기존 분석/미리보기 compiler로 조회할 수 있다.

## Main Success Scenario

1. 담당자가 게시 화면을 열어 현재 저장 revision과 게시 버전·범위·시점을 확인한다.
2. 전체 기간·필터 없음·UTC의 저장 분석을 게시 미리보기한다. 집계 숫자와 가능한 추세·차트·배치를 함께 표시한다.
3. 링크를 가진 사람이 고정 결과를 본다는 범위와 만료일을 읽고 링크 게시를 명시한다.
4. 서버가 소유권·저장 revision·게시 버전·미리보기 ticket을 확인하고 한 번 게시한다.
5. 익명 수신자는 고정된 숫자·시계열·차트와 게시 버전·집계 시점·범위를 읽는다. SQL/소스 경로/연결 정보는 반환하지 않는다.
6. 소유자가 저장 분석을 수정해도 기존 게시 결과는 유지된다. 새 미리보기 후 명시 재게시하면 같은 URL의 다음 버전만 보인다.
7. 소유자가 게시 중지를 실행하면 이후 URL 조회를 거절한다. 저장 분석과 편집 초안은 유지된다.

## Alternative Flows

### A1: Revision or publication conflict

**Trigger:** 저장 분석 또는 게시 버전이 바뀐다 (step 4 or 7).
**Flow:**

1. 409로 쓰기를 거절하고 기존 게시·저장 분석을 보존한다. 상태를 다시 확인하고 새 미리보기를 요구한다.
2. Use case continues at step 1.

### A2: Preview expires or save response is lost

**Trigger:** 5분 ticket 만료·서버 재시작·통신 오류가 발생한다 (step 4).
**Flow:**

1. 만료 preview는 다시 만든다. 결과 불명확 시 owner 상태를 읽고 같은 requestId 재시도만 허용해 중복 버전 증가를 막는다.
2. Use case continues at step 1.

## Postconditions

### Success Postconditions

- 저장과 게시가 분리되며 공개 URL은 현재 활성 버전 하나만 반환한다.
- 재게시/중지 전후 저장 분석 정의·SQL·배치는 변경하지 않는다.

### Failure Postconditions

- 실패로 게시 중인 버전이나 저장 분석을 덮어쓰지 않는다.

## Business Rules

### BR-018-01: Explicit snapshot scope

첫 범위는 전체 기간·필터 없음·UTC 집계 결과의 링크 snapshot이다. 현재 탐색 필터·원본 행·live 갱신·계정 수신자·질문 게시·embed는 후속이며 기본 공개하지 않는다. 기존 live 공유를 snapshot으로 바꿔치기하지 않는다.

### BR-018-02: Owner and public boundary

owner API는 dashboard/source 소유권을 다시 확인한다. 공개 API는 활성·미만료·미삭제 게시만 읽으며 source SQL 실행과 인증 토큰 발급을 하지 않는다. 공개 객체는 명시 whitelist의 표시 정의·집계 값·추세·배치만 포함한다. SQL·databaseId·filePath·queries·원본 열 preview는 제거한다. 결과 최대1MiB·블록6개·블록별2000행·추세240점이며 초과는 잘라 성공하지 않고 거절한다.

### BR-018-03: Version and retry

dashboard당 최신 게시행 하나를 사용한다. 활성 상태 재게시의 UUID는 유지하고 중지/만료 뒤 새 게시의 UUID는 교체한다. 미리보기는 쓰기 없이 5분/최대100개(총20MiB) ticket으로 owner/dashboard/revision/결과에 묶는다. expectedRevision/expectedVersion CAS와 DB unique로 중복 경합을 막는다. requestId와 payload digest가 같은 마지막 성공 재시도는 같은 영수증을 반환한다. 새 재게시/중지는 version을 한 번 증가한다. 오래된 요청 재시도는409이며 과거 공개 버전 URL은 제공하지 않는다.

### BR-018-04: UI continuity

오류/충돌은 저장 분석을 바꾸지 않고 상태 확인·미리보기 재실행으로 복구한다. 전송 중 중복 실행을 잠그고 route 변경/늦은 응답을 무시한다. 일반 버튼28px/입력32px와390/768/1440 줄바꿈을 기존 UI Kit로 검증한다. 만료/중지 후 이미 받은 수신자의 화면·복사본 회수는 보장하지 않는다.
