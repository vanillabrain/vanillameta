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

### A2: Consented organization transfer

**Trigger:** 직원이 다른 조직으로 이동한다 (step 2).
**Flow:**

1. 직원 본인이 대상 조직 번호를 지정해 15분 이동 코드를 발급한다. 코드를 철회하거나 바꾸면 이전 동의는 무효다.
2. 대상 조직 admin은 코드로 요청을 검토하고 팀/member 수락을 명시한다. 수락만으로 권한·소속이 바뀌지 않는다.
3. 현재 조직의 다른 admin은 직원·양쪽 조직 버전·수락 팀을 검토하고 고정 reviewBasis로 이동한다. 재수락/epoch/소속/버전/만료 변경은409 또는 권한 오류이며 쓰기0이다.
4. 원자적으로 소속/member 팀·양쪽 조직 버전·로그인 유효 상태와 관계 회수를 반영한다. 예전/대상 조직의 직접 권한·개인 공유·소유자 그룹 공유를 회수하고 모든 그룹 가입을 제거한다.
5. 본인은 다시 로그인해 현재 소속/이동 상태를 확인한다. 응답 유실은 상태 확인 후 명시 재검토하며 자동 이동을 반복하지 않는다.
6. Use case ends.

### A3: Departure impact review

**Trigger:** 관리자가 직원 퇴사·탈퇴 전에 업무 자료의 보존/인계 범위를 검토한다 (step 2).
**Flow:**

1. 현재 조직 admin이 불러온 직원 명단에서 대상을 선택하고 영향 조회를 명시한다.
2. 서버는 현재 로그인 유효 상태·관리자 역할·같은 조직 소속을 확인하고 [고정11종](../plans/UC-051-departure-impact.md)의 건수만 조회한다. 비활성 직원도 검토 가능하다.
3. 조직/계정 기준이 달라지거나 조회가 실패하면 이전 결과를 숨기고 명시 재조회를 요구한다. 자산 내용·계산식·파일 경로·게시 링크·상대 명단은 반환하지 않는다.
4. 계정 소유 건수와 조직 관계 건수를 구분한다. 현재 권한·조직 소유·인계 실행 승인을 의미하지 않으며 탈퇴/삭제/소유권 변경은 수행하지 않는다.
5. Use case ends.

### A4: Owner-selected handover intent

**Trigger:** 소유자가 업무 자료를 인계할 수신자에게 검토를 요청한다 (step 2).
**Flow:**

1. 소유자가 본인의 활성 소스 또는 단독 소유 대시보드 후보를 명시 조회하고 최대20개를 선택한다.
2. 같은 조직의 다른 활성 직원 번호를 지정하고 선택 자료의 제목·번호를 공개하는 데 동의해 요청을 저장한다.
3. 소유자가 요청 번호를 기존 채널로 전달하면 지정 수신자는 로그인 후 명시 조회한다. 자동 외부 발송은 없다.
4. 수신자가 고정 목록을 확인하고 의향을 수락한다. 현재 소속·계정·조직·자료 기준 변경이나 만료는 수락을 거절하며 기존 선택을 자동 수정하지 않는다.
5. 소유자는 요청을 철회할 수 있다. 수락·철회·응답 유실은 같은 요청 번호로 확인한다. 어느 동작도 자료 소유권·접근권·파일·퇴사 상태를 변경하지 않는다.
6. Use case ends.

### A5: Owner dependency and custody review

**Trigger:** 소유자가 수락된 인계 의향의 연결 자료와 보관 조건을 확인한다 (step 2).
**Flow:**

1. 수락된 요청을 읽은 소유자가 연결 자료·보관 조건 확인을 명시 실행한다.
2. 서버는 현재 당사자/조직·선택 자료 고정 기준을 확인하고 대시보드의 저장 연결과 선택 소스 누락을 건수로 표시한다.
3. 미확인 연결·타인 소스·파일/연결정보 보관 검토를 구별하며 다른 자료의 제목/번호/내용을 공개하지 않는다.
4. 실패/기준 변경은 이전 결과를 숨기고 요청 번호와 선택을 보존해 명시 재조회한다. 이 조회는 실제 이전 권한이나 실행 ticket이 아니다.
5. Use case ends.

### A6: Managed file custody observation

**Trigger:** 소유자가 수락된 의향의 선택 소스 파일·공유 사용처·갱신 상태를 확인한다 (step 2).
**Flow:**

1. 기존 연결 검토를 연 소유자가 파일·갱신 상태 확인을 명시한다.
2. 서버는 현재 고정 의향과 파일 관리 경계를 확인하고 선택 파일 신원/알려진 소비자/열린 갱신을 조회한다.
3. 확인 실패·누락·손상·미지원·공유 소비자·열린 lease를 구별하고 경로/신원 proof/미선택 자료 정보는 공개하지 않는다.
4. 실패 시 이전 결과를 숨기고 요청을 유지한다. 재시도와 새로고침 이후 조회는 명시 동작이며 실제 이전/파일 변경을 수행하지 않는다.
5. Use case ends.

### A7: Explicit final dashboard handover

**Trigger:** 고정 의향의 양쪽 당사자가 비공개 대시보드의 실제 소유권 이전을 별도로 동의한다 (step 2).
**Flow:**

1. 소유자가 수락된 의향의 최종 검토를 읽는다. source 선택·활성 공유/게시/작업·미지원 저장 연결은 차단하고, 필요한 소스는 이미 수신자가 소유해야 한다.
2. 소유자는 효과를 확인하고 최종 요청을 준비한다. 수신자는 별도 동의로 최종 수락하며 제목 공개 의향을 실행 동의로 승계하지 않는다.
3. 소유자가 최신 상태를 명시 조회하고 전체 이전을 실행한다. 서버는 양쪽 현재 계정/소속/epoch·고정 기준·지원 범위를 재검사한다.
4. 전체 mapping·assetVersion·Studio 연결 기준과 완료 영수증/감사를 함께 저장한다. 실패하면 전부 rollback한다. 기존 ID·블록/모든 폭 배치·파일/지표·이력·독립 사본은 유지한다.
5. 응답 유실/새로고침 후 같은 요청 상태를 조회한다. 정확한 재시도는 완료 영수증만 반환하며 다시 이전하지 않는다. 이전 소유자의 소유권 접근은 다음 보호 요청부터 거절한다.
6. Use case ends.

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

### BR-051-03: Employee search and transfer preservation

직원 검색은 현재 조직 admin의 로그인 ID·팀·번호 문자 검색과20명 cursor다. 다른 조직이나 이메일/비밀은 검색하지 않는다. 이동은 [선택 계약](../plans/UC-051-staff-transfer.md)의 본인·양쪽 admin과 고정 수락 기준을 요구한다. 원본·지표·대시보드·소유 ID·독립 사본·게시 행·과거 이력은 삭제/이관하지 않는다. 자료 조직 문맥은 소유자 현재 소속을 따르지만 새 조직에 자동 권한을 주지 않는다. 게시/분석 가용성은 현재 소스/게시 권한에 의존하며 과거 관계는 돌아와도 자동 복원하지 않는다.

### BR-051-04: Departure and handover separation

퇴사·조직 탈퇴·계정 삭제·업무 인계는 별도 명시 동작이다. [영향 확인 첫 단위](../plans/UC-051-departure-impact.md)는 현재 admin에게 건수만 제공하며 개인정보·자산 내용 접근권을 확대하지 않는다. 다중 mapping은 인계 가능 소유권으로 해석하지 않는다. 과거 게시/출력·회수 관계도 포함된 건수는 활성 권한이 아니고 총합하지 않는다. 실제 인계/탈퇴 확정은 수신자 동의·의존성·최신 기준·원자 처리/영수증을 별도로 구현하기 전까지 미완료다.

### BR-051-05: Handover intent is separate from execution

[선택·수락 계약](../plans/UC-051-handover-proposal.md)은 소유자 동의로 고정 제목·번호만 지정 수신자에게 공개한다. 관리자는 타인 자료를 대신 선택할 수 없고, 일반 구성원도 본인 자료만 제안한다. 과거 수락 영수증은 현재 접근권이나 실제 이관 승인 기준이 아니다. 실제 이전은 전체 의존성·파일 보관·최신 동의와 권한의 별도 최종 검토가 필요하다. 알려지지 않은 저장 결과는 같은 요청으로 확인하며 자동 중복 요청하지 않는다.

### BR-051-06: Read-only dependency and custody prerequisites

[연결 검토 계약](../plans/UC-051-handover-review.md)은 현재 소유자에게만 수락된 고정 선택 자료의 명시 연결 범위를 제공한다. 소스 누락은 자동 포함하지 않고 새 의향 요청을 요구한다. covered는 선택 연결의 포함 여부일 뿐 전역 의존성·파일 실체/배타 보관·자격정보 이전 가능·실행 승인 증명이 아니다. 수신자에게 공개 범위를 확대하지 않으며 모든 결과의 executionAvailable=false를 유지한다.

### BR-051-07: Custody observation cannot authorize transfer

[파일 보관 검토](../plans/UC-051-handover-custody.md)는 현재 소유자의 수락된 고정 요청에 한정한다. observed는 관리 파일 신원의 관측이며 내용 정상/배타적 보관/수신자 책임 증명이 아니다. 소비자 미관측은 알려진 검사 범위만 뜻하며 검사 실패/순회 상한을 성공으로 대체하지 않는다. 열린/만료 lease는 자동 회수하지 않고 주의 상태로 남긴다. 파일·DB·권한 쓰기0/실행 불가와 현재 기준 재검사를 유지한다.

### BR-051-08: Final consent and atomic ownership receipt

[최종 인계 설계](../plans/UC-051-handover-transfer.md)는 단독 비공개 대시보드1~20개 전부의 이전만 지원한다. 선택 source는 부분 실행하지 않고 차단하며 source/파일 실제 이전·퇴사/탈퇴는 후속이다. 과거 의향/파일 관측은 최종 동의가 아니다. 현재 당사자/조직·epoch·정확한 소유 mapping·현재 공유/작업·고정 기준을 부모 잠금 아래 검사한다. 모든 mapping/버전·Studio legacyRevision·감사/영수증을 원자 저장하고 document bytes/배치를 보존한다. 과거 actor/권한/사본을 소급 변경하거나 활성 공유를 자동 정리하지 않는다. 완료 이후 영수증은 현재 자산 접근권이 아니며 의향 철회로 확정 이전을 되돌리지 않는다.

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

## 직원 검색·조직 이동 후속

[설계](../plans/UC-051-staff-transfer.md)·[검증](../testing/staff-transfer.md)은 FR016의 검색·명시 이동 및 관계 회수/자료 보존 단위다. 탈퇴·업무 소유권 이관·전체 보호 경로·운영 적용·실기기/업무 수용은 별도다.

[실제 화면 후속](../testing/staff-transfer-ui.md)은 초기 상태/철회된 요청·수락 기준 변경의 구체적 복구 사유, 명시 거절과 통신 결과 미확정 분리, 실제 로그인 역할 전환과 이동/reload를 선택 검증했다. MySQL 앱 화면·실휴대폰/운영/사람 수용은 별도다.
