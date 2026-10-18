# Use Case: Distribute Artifacts

## Overview

**Use Case ID:** UC-053
**Use Case Name:** Distribute Artifacts
**Primary Actor:** 산출물 소유자
**Goal:** 수신자에게 결과물 접근 또는 독립 사본을 전달하고 상태를 확인한다.
**Trigger:** 직원/그룹에게 결과물 공유를 요청한다.
**Status:** Draft
**Requirements:** [FR-021, FR-022, NFR-005, NFR-007, NFR-008](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 직원 조회 공유/회수의 첫 단위는 [설계](../plans/UC-053-deliveries.md)·[증빙](../testing/recipient-deliveries.md)을 따른다. 받은 자료의 현재 권한 조회/열기는 [설계](../plans/UC-053-received.md)·[증빙](../testing/received-dashboards.md)을 따른다. 동의 기반 독립 사본 전달은 [설계](../plans/UC-053-copy.md)·[증빙](../testing/received-copy.md)을 따른다. 동적 그룹의 현재 서버 범위(그룹 관계 CAS/영수증·감사, 구성원 기반 받은 자료 조회, 복제 동의와 private reference 재검사)는 [계획](../plans/UC-053-group-deliveries.md)·[범위 증빙](../testing/group-deliveries.md)을 따른다. 이 구현 포인터는 수용 상태를 뜻하지 않는다. 권한 변경 본인 알림의 첫 구현은 [계획](../plans/UC-053-notifications.md)·[증빙](../testing/personal-notifications.md)을 따른다. 그룹 공유/회수와 명시적 구성원 추가·제외/활성 변경 알림은 [계획](../plans/UC-053-group-notifications.md)·[증빙](../testing/group-notifications.md)을 따른다. 수신 대상은 사건 시점 snapshot이고 그룹 감사 subject는 groupId로 유지된다. 실제 UI/모바일·MySQL/운영·전체 전달 수용은 미완료다.

## Main Success Scenario

1. 소유자가 수신자와 조회 공유/독립 복사 목적을 선택한다.
2. 서버가 양쪽 조직·자원·전달 범위/소스 권한을 검사한다.
3. 중복 요청을 확인하고 필요한 공유 관계/사본을 한 저장 단위로 반영한다.
4. 성공 결과는 유지한 채 수신자 알림 생성을 시도하고 실패는 별도 재시도 상태로 기록한다.
5. 수신자는 본인 알림/받은 목록에서 권한 확인 후 열고 본인 알림만 읽음/목록 제거한다.
6. 공유 취소 시 접근 관계를 중지하고 이력을 유지한다. 재공유는 현재 권한으로 다시 검증한다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 수신자 권한 부족·중복 전달·알림만 실패 (step 2 or 3).
**Flow:**

1. 비허용 전달은 저장하지 않고 동일 요청은 기존 결과를 확인한다. 알림 실패는 본 저장과 구별한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 수신자에게 결과물 접근 또는 독립 사본을 전달하고 상태를 확인한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-053-01: Scoped business operation

조회 공유는 원본 권한/정의를 복사하지 않는다. 독립 사본은 새 소유자/ID로 기존 복제·소스 매핑 계약을 따른다.

### BR-053-02: Preservation and evidence

공유 중지는 이미 생성한 수신자 소유 사본을 삭제하지 않는다. 알림 읽음/삭제는 공유 권한/자원 삭제와 별개다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 그룹 전달의 구현 범위는 [현재 구현 포인터](../testing/group-deliveries.md)를 참조한다. UC-053 전체 수용 상태는 Draft이며 해당 실행/검증을 승격하지 않는다.
