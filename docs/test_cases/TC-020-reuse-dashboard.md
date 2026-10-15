# Test Case: Duplicate and Reuse Dashboard

## Overview

**ID:** TC-020
**Goal:** [UC-020](../use_cases/UC-020-reuse-dashboard.md)의 독립 복제와 새 소스 연결을 검증한다.
**Status:** Draft

## Preconditions

소유 공개 Rill 데모 분석, 새 호환/이름 변경/비호환 파일 소스와 Ego를 사용한다. 원본 및 게시·공유 상태를 기록한다.

## Flow

1. 복제 초안 조회 → 제목/대상 소스/열 연결 → 미리보기.
2. 새 복사본 저장 → 새로고침 → 소스 수치/레이아웃/비공개 확인.
3. 원본 및 게시 상태 불변, 새 dashboard/block ID, 원본 지표 링크 없음 확인.
4. 누락/타입·버전/권한·묵은 응답·응답 유실 재시도에서 저장 경계를 확인한다.

## Validation

| ID      | Expected                                                    | Status |
| ------- | ----------------------------------------------------------- | ------ |
| TC02001 | SQL 열 연결의 alias/문자열/필터 보존, 누락/타입/미지원 거절 | PASS   |
| TC02002 | actor/source/revision 검증·새 ID/모든 배치·원본 불변        | PASS   |
| TC02003 | 부분 실패 rollback·같은 요청 재시도 중복 없음               | PASS   |
| TC02004 | UI 입력 변경 ticket 무효화·묵은 응답/실패 보존              | PASS   |
| TC02005 | Ego 복제→소스 교체→미리보기→저장→reload·새 수치             | PASS   |
| TC02006 | 390/768/1440px 크기·정렬·상태·넘침                          | PASS   |

[2026-10-15 실행 증거](../testing/dashboard-reuse.md): TC02001은 helper15개, TC02002/03은 SQLite10개, TC02004는 FE8개, TC02005/06은 Ego 대표 흐름과 폭별 화면을 검증했다. 저장 응답 유실은 FE 대역/SQLite 재시도와 실제 API 동일 요청 재확인이며 실제 UI 유실 주입은 NOT_RUN이다. 모든 상태의 폭별 조합은 NOT_RUN이다.

실휴대폰·운영 MySQL·공유 수신자 remix·전체 TC-005는 NOT_RUN이다.
