# UC-056: Create Artifact Through MCP

## Overview

**Use Case ID:** UC-056
**Use Case Name:** Create Artifact Through MCP
**Primary Actor:** 외부 코딩 에이전트를 사용하는 분석 제작자
**Goal:** 기존 데이터 권한과 계산 검증을 유지하면서 외부 질문에서 비공개 분석을 만든다.
**Trigger:** 제작자가 연결한 MCP에서 분석 생성을 요청한다.
**Status:** Draft
**Requirements:** [FR-029, NFR-005](../requirements.md)

## Preconditions

- 로컬 stdio 서버에 실제 API/웹 주소와 유효한 본인 access token이 설정되어 있다.
- 제작자는 지원되는 ready DuckDB 소스를 소유한다. 조회 권한만으로 새 분석을 생성할 수 있다고 가정하지 않는다.
- API의 기존 AI 실행 환경이 준비되어 있다.

## Main Success Scenario

1. 클라이언트가 MCP 서버를 실행하고 도구 목록을 읽는다.
2. 제작자가 현재 접근 가능한 소스·스키마·지표를 확인한다.
3. 제작자가 sourceId와 질문으로 제안을 요청한다.
4. 기존 서버가 구조화 정의와 전체 블록의 집계 미리보기를 검증한다. MCP가 계산 요약과 제안/버전/저장 요청 ID를 돌려준다.
5. 제작자가 결과를 검토하고 저장을 명시 승인한다. 호스트가 승인받은 요청만 저장 도구에 전달한다.
6. 서버가 기존 버전·권한·원자 저장을 적용해 새 비공개 분석을 만들고 Studio 링크를 반환한다.
7. 제작자가 저장본을 다시 조회하고 브라우저에서 새로고침해 결과를 확인한다.

## Alternative Flows

### A1: Invalid or revoked identity

**Trigger:** 현재 계정 인증 또는 접근권 검사가 실패한다 (step 2~7).
**Flow:**

1. 시스템은401/403을 자동 로그인·계정 전환 없이 반환한다.
2. 제작자는 기존 질문을 보존하고 현재 계정·권한부터 확인한다.
3. Use case ends.

### A2: Ambiguous request or expired proposal

**Trigger:** 명확화가 필요하거나 원본 제안이 만료됐다 (step 3~5).
**Flow:**

1. 시스템은 저장하지 않고 확인 질문 또는 만료 오류를 반환한다.
2. 제작자는 필요한 답변이나 새 질문을 준비한다.
3. Use case continues at step 3.

### A3: Conflict or uncertain save

**Trigger:** 버전 충돌 또는 저장 결과가 불명확하다 (step 6).
**Flow:**

1. 시스템은409 또는 미확정 오류를 자동 버전 변경 없이 반환한다.
2. 제작자는 충돌이면 최신 기준을 검토하고, 응답 유실이면 동일 requestId/정확한 본문으로 결과를 확인한다.
3. 새 UUID로 맹목 재시도하지 않는다.
4. Use case ends.

### A4: Cancellation or oversized response

**Trigger:** 호출이 취소되거나 응답 제한을 초과한다 (step 2~7).
**Flow:**

1. 시스템은 취소를 진행 HTTP에 전파한다.
2. 시스템은 크기 초과·잘못된 응답을 정제된 오류로 반환한다.
3. 저장 직후 취소라면 결과가 불명확하다고 안내하고 성공을 주장하지 않는다.
4. Use case ends.

## Postconditions

### Success Postconditions

- 새 대시보드 번호와 인증값 없는 Studio URL이 있고 기존 조회·새로고침으로 확인한다.
- 게시 상태를 변경하지 않는다.

### Failure Postconditions

- MCP가 직접 DB/파일/SQL을 수정하지 않으며 오류의 토큰·서버 내부 진단을 노출하지 않는다.
- 실패 응답만으로 서버 저장이 없었다고 단정하지 않는다.

## Business Rules

### BR-001: Current caller and fixed destination

사용자 입력으로 actor·token·API URL·임의 SQL을 지정할 수 없다. 고정 설정의 기존 JWT API에서 매번 현재 권한/epoch를 검사한다. HTTP redirect를 따르지 않는다.

### BR-002: Explicit persistence

생성 제안과 조회는 영속 저장하지 않는다. 저장 도구는 필수 confirmSave=true와 원 제안/버전/UUID를 받는다. 이 boolean 자체가 실제 사람 동의를 증명하지 않으므로 MCP 호스트의 사용자 확인이 필요하다. 게시·공유는 이 도구 집합에 없다.

### BR-003: Minimal projection

프로필의 원본 표본/연결 설정/파일 경로, 미리보기 SQL/실행 쿼리를 제외한다. 모든 블록은 포함하되 블록당 집계 행240개 초과는 잘림과 원 건수를 표시한다.

### BR-004: Existing integrity

기존 제안 만료·소스/지표 버전·권한·멱등 영수증을 재사용한다. 별도 DB나 저장 컴파일러를 만들지 않는다.
