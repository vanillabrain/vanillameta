# TC-056: MCP Artifact Authoring

## Overview

**ID:** TC-056
**Goal:** MCP에서 기존 권한과 계산 검증을 유지해 비공개 분석을 제작한다.
**Status:** Draft

## Preconditions

전용 합성 자료/두 계정과 기존 API 및 AI 실행기를 준비한다. SDK 프로토콜 검증, 실제 Nest/MySQL, 실제 코딩 에이전트 호스트 검증을 분리한다.

## Flow

| Step | Name     | Description                                                         | Use Case                                                |
| ---- | -------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | Discover | 초기화/도구6개·소스/스키마/지표·타인 접근 거절/비밀 투영 확인       | [UC-056](../use_cases/UC-056-mcp-artifact-authoring.md) |
| 2    | Propose  | 실제 합성 매출600·시계열3점·미저장/전체 블록 미리보기 확인          | [UC-056](../use_cases/UC-056-mcp-artifact-authoring.md) |
| 3    | Save     | 동의 없는 입력 거절·승인 저장·동일UUID 재시도/충돌 확인             | [UC-056](../use_cases/UC-056-mcp-artifact-authoring.md) |
| 4    | Reload   | 저장본 조회·Studio reload·소스/숫자·시계열 보존                     | [UC-056](../use_cases/UC-056-mcp-artifact-authoring.md) |
| 5    | Recover  | 401/403·만료·409·응답 유실·취소·크기 초과의 정제 오류와 재시도 확인 | [UC-056](../use_cases/UC-056-mcp-artifact-authoring.md) |

## Verification Boundary

실행 증거에 각 단계의 실제 실행 여부를 기록한다. SDK client 성공이 Codex/Claude Code 호스트 전체 지원을 뜻하지 않으며 원격 HTTP MCP/OAuth·모든 역할/운영·실기기는 별도다.
