# Use Case: Manage Enterprise Access

## Overview

**Use Case ID:** UC-051
**Use Case Name:** Manage Enterprise Access
**Primary Actor:** 조직 관리자
**Goal:** 직원·그룹과 데이터/산출물별 권한을 관리한다.
**Trigger:** 직원 등록·소속 변경·권한 부여 또는 회수를 요청한다.
**Status:** Draft
**Requirements:** [FR-016, FR-017, NFR-005, NFR-007](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 전체 목표 명세는 Draft다. 조직/직원 첫 단위 구현·자동 검사와 전체 자원 권한/실제 UI 검증을 [증빙](../testing/enterprise-membership.md)에서 구분한다.

## Main Success Scenario

1. 관리자가 직원·그룹·자원 범위를 검색한다.
2. 직원 활성 상태/소속과 자원별 열람·편집·게시·내보내기 범위를 지정한다.
3. 서버가 요청자 관리 범위·대상 조직·자원 권한과 자기 권한 확대 여부를 검증한다.
4. 명시 변경을 저장하고 행위자/결과 이벤트를 기록한다.
5. 다음 보호 요청에서 최신 활성 상태/권한을 검사하며 회수한 자원의 새 조회/작업을 차단한다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 관리 권한 부족·다른 조직 대상·사용자 비활성화 (step 2 or 3).
**Flow:**

1. 권한 확대나 자원 결과를 반환하지 않고 거절한다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 직원·그룹과 데이터/산출물별 권한을 관리한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-051-01: Scoped business operation

조직/소속/데이터/산출물 권한은 별도 자원이다. 기존 계정을 인증 우회로 대체하지 않으며 SSO 방식은 배포별 후속 설계다.

### BR-051-02: Preservation and evidence

목록·상세·변경·미리보기·공유·export·파일 전달 모두 서버 검사한다. 화면 숨김이나 MK AI의 확인만으로 권한을 증명하지 않는다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 신규 요구이며 구현/실행 검증은 미완료다.

## 첫 구현 단위

[계획](../plans/UC-051.md)의 격리 조직 생성·조직 지정 본인 동의 코드·직원 역할/활성 관리·epoch 인증 회수를 진행했다. 자원 grant 후속은 [설계](../plans/UC-051-resource-access.md)와 [선택 검증](../testing/enterprise-resource-access.md)을 따른다. 원 소유권 유지·동작별 권한·별도 소스 read·실제 actor·CAS/회수/감사를 연결했다. 그룹·영속 export/파일·실제 UI·전체 E02/E03은 후속이며 Status Draft/요건 Open은 유지한다.

## SQLite 교차 작업 경계

[설계](../plans/UC-051-sqlite-coordination.md)·[검증](../testing/sqlite-coordination.md)은 명시 transaction/기존 큐·선택 권한 조회를 공통 조정한다. Studio rollback 중 별도 쓰기 성공 유실과 미커밋 소스/계정 상태 노출을 재현해 보호한다. raw Repository 단일 쓰기·일반 조회 전체/운영·파일 전달은 후속이며 전체 요건/TC050 상태는 승격하지 않는다.

[일반 metadata 경계 후속](../testing/metadata-boundaries.md)은 source/metric 저장·확정 정의와 refresh 조회를 연결한다. 이미 인증된 작업 전체 취소나 세션 회전 쓰기 원자성을 보장하는 기능은 아니다.

[계정·세션 경계](../plans/UC-051-account-session-writes.md)는 현재 계정 token 연결과 인증 epoch를 commit 시 확인한다. [증빙](../testing/account-session-writes.md)의 부분 실패/SQLite 선택 회귀를 운영/모든 세션 수용으로 확대하지 않는다.

[계정 무결성 설계](../plans/UC-051-identity-integrity.md)·[실제 MySQL 증빙](../testing/identity-integrity.md)은 신규 unique/FK와 동일 계정 잠금·부분 CAS를 연결한다. 초기 MySQL 가입/소속 경합의 알려진 잔여는 이 범위에서 보완했다. Enrollment 만료 코드나 다른 자산의 모든 참조 정리까지 포함하지 않으며 운영 DB 적용은 별도다.

## UC051 동적 그룹 선택 검증

[설계](../plans/UC-051-groups.md)·[증빙](../testing/dynamic-groups.md)은 E02/E03의 그룹/구성원 CAS·직접/그룹 권한 합산·현재 소속/활성/소스 독립·동일 JWT 회수·게시 소비자·원자 rollback·생성 영수증 재확인을 선택 검증한다. 그룹 전달/알림·영속 파일 소비자·실제 Ego/모바일/MySQL/운영·전체 수용은 별도이며 요건 상태를 승격하지 않는다.
