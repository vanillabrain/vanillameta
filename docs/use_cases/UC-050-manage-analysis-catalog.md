# Use Case: Manage Analysis Catalog

## Overview

**Use Case ID:** UC-050
**Use Case Name:** Manage Analysis Catalog
**Primary Actor:** 데이터 관리자
**Goal:** 분석 데이터와 변수의 업무 의미를 등록·유지한다.
**Trigger:** 데이터 등록 또는 정의 변경을 요청한다.
**Status:** Draft
**Requirements:** [FR-014, FR-015, NFR-005, NFR-007](../requirements.md)

## Preconditions

- 요청자가 같은 조직의 유효한 업무 계정이며 대상의 현재 권한을 확인할 수 있다.
- 전체 목표의 조직 관리자 권한·승인/분류·영향 확인은 미완료다. 소유 소스 업무 설명의 첫 구현 범위는 아래 Implementation Slice를 따른다.

## Main Success Scenario

1. 관리자가 현재 권한으로 원천의 허용 구조를 조회한다.
2. 표시명·설명·열 유형/날짜 형식/단위·분류 연결을 입력한다.
3. 서버가 관리자 권한·실제 스키마·이름 중복·필수 옵션을 검증한다.
4. 현재 정의와 변경 영향을 보여주고 명시 저장한다.
5. 새 정의/버전·변경 이벤트를 기록하며 기존 분석은 영향 확인 없이 덮어쓰지 않는다.

## Alternative Flows

### A1: Rejected or incomplete operation

**Trigger:** 조회 권한 부족·중복·유형 불일치·사용 중 삭제 요청 (step 2 or 3).
**Flow:**

1. 사유와 영향을 표시하고 등록/변경/삭제를 반영하지 않는다.
2. Use case ends.

## Postconditions

### Success Postconditions

- 분석 데이터와 변수의 업무 의미를 등록·유지한다. 명시한 범위의 결과/이력이 제공된다.

### Failure Postconditions

- 비대상 자원·기존 초안/원본·허용되지 않은 권한을 변경하지 않는다. 작업/알림의 별도 성공 여부는 구분한다.

## Business Rules

### BR-050-01: Scoped business operation

목록과 실제 스키마/권한을 대조한다. 변수 수·허용 범위·활성 상태를 관리자가 확인하며 원본 데이터 값은 불필요하게 복사하지 않는다.

### BR-050-02: Preservation and evidence

날짜 형식·열명/표시명·단위를 구별하고 스키마 변경은 영향 확인을 요구한다. 카탈로그는 승인 원천이며 업로드 파일 전체를 자동 공식 등록하지 않는다.

## Source Evidence

[VM 목표 설계](../architecture/enterprise-analysis.md)·[TC050](../test_cases/TC-050-enterprise-analysis.md)를 따른다. 전체 시나리오 수용은 미완료이며 첫 구현의 실행 범위는 아래 증빙을 따른다.

## Implementation Slice — 2026-10-18

[첫 구현 계획](../plans/UC-050.md)·[검증 기록](../testing/source-catalog.md)의 소유 DuckDB 소스 표시명/설명과 실제 열별 표시명/설명/단위 읽기·버전 저장을 구현했다. 기존 Explore에서 `데이터 업무 설명`을 열어 편집한다. 기존 소유권 검사만 사용하며 조직 관리자/공식 승인·활성 상태/분류·날짜 형식/유형 변경·기존 분석 전파는 미구현이다. 위 Main Success Scenario 전체와 TC050 전체는 여전히 미완료다. 열 구조가 변경되면 이력을 보존하고 저장을 잠근다. 실제 Ego/모바일 검증은 사용자 제어권 점유로 BLOCKED이며 자동 검사와 구분한다.

### Saved History Follow-up

[저장 이력·버전 비교](../testing/source-catalog-history.md)는 동일 소유 소스의 저장 버전 요약/커서 조회와 두 정상 저장 버전의 업무 필드 차이를 읽기 전용으로 제공한다. 미저장 입력을 변경하지 않는다. 손상 버전은 요약에서 격리하고 선택 비교는409로 차단한다. 변경한 업무 설명을 기존 분석에 전파하는 영향 검토·공식 승인·버전 복원과는 구분한다. 전체 Main Success Scenario/Draft 상태는 유지한다.

### Pre-save Preview Follow-up

[저장 전 변경 미리보기](../testing/source-catalog-preview.md)는 동일 소유 소스의 입력을 서버에서 검증/정규화해 현재 기준 대비 업무 필드 차이를 쓰기 없이 보여준다. UI는 명시 확인한 서버 draft만 저장하고 입력/기준 변경 시 확인을 해제한다. 기존 save 계약/CAS를 유지해 미리보기 뒤 경쟁 저장은409로 거절한다. 실제 조직 승인/기존 분석 사용처 영향 검토와 전체 UC050 수용은 미완료다.

### Direct Usage Follow-up

[소스의 직접 사용처](../testing/source-catalog-usage.md)는 기존 소유권과 저장 연결을 기준으로 활성 지표/본인 미삭제 저장 분석을 읽는다. 본인 분석의 현재 자원 권한도 검사하고 SQL/행/정의는 반환하지 않는다. 후보20개 단위로 이어가며 확인된 범위를 전체 변경 영향이나 사용처 없음으로 단정하지 않는다. 현재 초안·동의/원본은 유지하고 일반 위젯/게시/독립 사본 간접 영향·자동 반영은 미포함이다. 전체 UC050 수용은 미완료다.
