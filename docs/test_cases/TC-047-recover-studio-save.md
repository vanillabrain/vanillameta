# Test Case: Studio Save Confirmation After Reload

## Overview

**ID:** TC-047
**Goal:** 저장 응답 유실과 미전달에서 동일 요청 확인으로 편집을 복구한다.
**Status:** Draft

## Flow

| Step | Name                     | Description                                              | Use Case                                             |
| ---- | ------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Retain request           | 제목/질문 편집→명시 저장→완료 후 응답503                 | [UC-047](../use_cases/UC-047-recover-studio-save.md) |
| 2    | Confirm committed save   | reload→확인 화면/자동POST0→동일 요청/기존 영수증→최신GET | [UC-047](../use_cases/UC-047-recover-studio-save.md) |
| 3    | Confirm undelivered save | 미전달503→reload/자동POST0→동일 요청 최초저장→질문 복구  | [UC-047](../use_cases/UC-047-recover-studio-save.md) |
| 4    | Verify and restore       | ID/배치/수치·원본 보존·390/768/1440→검증 변경 정상 원복  | [UC-047](../use_cases/UC-047-recover-studio-save.md) |

## Validation

- BR-047-01/A1: 정확한 요청/손상/만료/한도·보관 실패 시 POST0.
- BR-047-02: 초기 권한 GET 후 확인 화면·자동 POST0·새 편집 없음·동일 요청 재사용.
- BR-047-03/A2/A3: 옛 영수증 대신 최신 GET·확정 후 조회만 재시도·409 명시 초안 복귀·이탈 중 응답 무시.

## Execution

PASS_SELECTED: Ego92 실제 commit201 뒤503→reload/동일 요청 확인/영수증 증가0·미전달503→reload/동일 요청 최초저장1·질문 복구/원복·390/768/1440을 확인했다. 관련 FE111/type/lint/build·실제 대조31개 PASS. 조회 실패·409·이탈/저장소 변형은 회귀이며 전체 수용은 별도다. [증빙](../testing/studio-save-recovery.md).

Ego93 후속 PASS_SELECTED: 복제 임시 ID/크기 변경 포함 저장201 뒤503→reload→동일 요청/동일 idMap→최신GET/4블록·추가 영수증0→질문 복구/원복을 확인했다. FE9/type/lint·실제38개와390/768/1440 넘침0. 제품 소스는6911c634이며 직전 build를 재사용했다. [신규 블록 증빙](../testing/studio-save-new-block-recovery.md).

Ego94 후속 PASS_SELECTED: 명시 동일 저장 확인201 뒤 최신GET503→confirmed/문서/질문 보존→reload/자동POST0→명시GET만/영수증·revision 증가0→질문 복구/원복. FE10/type/lint/build·실제43개와390/768/1440 넘침0. [확정 후 조회 복구 증빙](../testing/studio-confirmed-read-recovery.md).

Ego95 후속 PASS_SELECTED: 실제 두 탭 저장409→기록/질문 보존→명시 초안 복귀→최신 비교/같은 항목 동의→전체 미리보기→최신 revision 새 저장/reload. 비대상 최신 제목·ID/SQL/모든폭배치/원본45 보존·46 정상원복·390/768/1440 넘침0. FE16/type/lint·실제52개이며 제품 코드fde87ab3/build 증빙을 재사용했다. [409 초안 복귀 증빙](../testing/studio-save-conflict-return.md).
