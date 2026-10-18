# Use Case: Archive Artifact Dependencies

## Overview

**Use Case ID:** UC-055
**Use Case Name:** Archive Artifact Dependencies
**Primary Actor:** 산출물 소유자
**Goal:** 불필요한 결과물을 정리하면서 연결된 업무를 보존한다.
**Trigger:** 개인 보관·자산 비활성화·삭제 또는 복원을 요청한다.
**Status:** Draft
**Requirements:** [FR-024, NFR-005, NFR-007](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 개인 보관/복원은 아래 구현 계획으로 진행하며 자산 삭제/비활성 영향과 전체 수용은 별도다.

## Main Success Scenario

1. 사용자가 대상과 개인 보관/조직 자산 비활성화/삭제 목적을 선택한다.
2. 서버가 범위에 맞는 소유/관리 권한과 현재 참조·게시·사용처를 조회한다.
3. 영향과 복구 가능 범위를 보여주고 삭제와 보관을 구별한다.
4. 명시 처리 후 정의/배치·사용처/공유에 관한 계약을 보존하고 행위/결과를 기록한다.
5. 개인 보관은 본인 기본 목록에서만 숨기며 보관 목록에서 현재 권한으로 복원한다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 권한 부족·참조 중인 자원의 삭제 (step 2 or 3).
**Flow:**

1. 연결된 업무를 자동 삭제하지 않고 사용처/사유를 표시해 작업을 거절한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 불필요한 결과물을 정리하면서 연결된 업무를 보존한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-055-01: Scoped business operation

개인 보관은 데이터 삭제·공유 중지·타인 목록 변경이 아니다. 조직 비활성화는 별도 관리 권한으로 처리한다.

### BR-055-02: Preservation and evidence

자산 삭제/변경은 지표·대시보드·게시·사본의 참조 영향을 명시한다. 보관/비활성화/영구 삭제의 연쇄 정책은 구현 전에 결정한다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 신규 요구이며 구현/실행 검증은 미완료다.

## Implementation boundaries

[개인 보관/복원](../plans/UC-055-library-archive.md)은 본인의 현재 조직 허용 목록에만 상태를 적용하고 원본/공유/게시/타인 목록을 보존한다. 기존 조직 없는 계정의 탐색은 유지한다. [삭제 보호 후속](../plans/UC-055-dependency-deletion.md)은 현재 사용처/원자 삭제의 공백과 필요한 재검증을 명시한다. 설계·부분 구현·실제 화면/운영·전체 수용은 구별한다.

대시보드의 사용처 확인/삭제는 [구체 계획](../plans/UC-055-dashboard-delete.md)·[선택 실행](../testing/dashboard-deletion.md)으로 이어진다. source/metric·조직 자산 비활성 및 실제 UI/운영·전체 수용은 같은 단위로 완료 처리하지 않는다.

지표 삭제 보호의 다음 단위는 [계획](../plans/UC-055-metric-delete.md)·[증빙](../testing/metric-deletion.md)을 따른다. 저장 분석/Pivot·Studio/탐색 보기의 현재 참조와 source 소유/계정·조직·기준을 재확인하며 자동 연결 해제는 하지 않는다. source/조직 비활성·전체 TC050/16개 수용은 별도다.

소스 삭제 보호는 [계획](../plans/UC-055-source-delete.md)·[증빙](../testing/source-deletion.md)의 고정10종 영향/기준 확인과 원자 metadata 삭제·별도 지속 파일 정리를 따른다. 현재 참조·하위 공유 파일은 차단하며 자동 연쇄 삭제0이다. 실제 MySQL/파일/자동 화면·Ego/실기기/운영을 구별하고 조직 비활성·전체 E11/E12/TC050 수용은 별도다.
