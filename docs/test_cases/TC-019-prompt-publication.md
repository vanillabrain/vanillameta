# Test Case: Prompt Save To Publication

## Overview

**ID:** TC-019
**Goal:** [UC-019](../use_cases/UC-019-prompt-publication.md)의 질문 저장·게시 준비 연결을 검증한다.
**Status:** Draft

## Preconditions

공개 Rill 분석 12, 기존 지정 Codex/gpt-6-luna, Ego를 사용한다. 사용자 허용 범위의 임시 링크를 검증 후 중지한다. 기존 저장·게시 권한 계약을 유지한다.

## Flow

1. 명시적 저장·게시 질문 → 검증 초안 저장 → 같은 revision의 게시 미리보기.
2. 공개 범위·만료일 확인 → 링크 게시 → 소유자·공개 화면 새로고침.
3. 저장 409·결과 불명확·취소 시 이동 없음. 게시 준비 오류 시 저장 보존·재시도.
4. 다른 revision·묵은 route·잘못된 flag·부정 질문은 게시를 시작하지 않는다.

## Validation

| ID      | Expected                                                             | Status                           |
| ------- | -------------------------------------------------------------------- | -------------------------------- |
| TC01901 | strict flag·부정/조건/인용 지시·기존 동작 호환                       | PASS (unit, 명시/부정 실제 질문) |
| TC01902 | 저장 성공 → id/revision 전달 → 같은 게시 미리보기                    | PASS (FE unit)                   |
| TC01903 | 저장 실패·취소 시 이동 없음, 게시 준비 실패 시 저장 반복 없음        | PASS (FE unit)                   |
| TC01904 | 버전 불일치 차단·묵은 응답 무시·새로고침 게시 없음                   | PASS (FE unit)                   |
| TC01905 | Ego 질문 → 저장 → 게시 미리보기 → 명시 링크 → 새로고침·수치          | PASS (Ego)                       |
| TC01906 | 390/768/1440px에서 주요 버튼 28px·입력 32px·폰트 12px·가로 넘침 없음 | PASS (Ego 실측·캡처)             |

부정·조건·인용 문장의 전체 LLM 정확도와 운영 MySQL·실제 휴대폰·전체 TC-005는 NOT_RUN으로 남긴다. 단위 테스트의 모의 응답 검증과 실제 지정 LLM 실행을 구분한다.

실제 결과·한계·증빙은 [검증 기록](../testing/prompt-publication.md)을 따른다.
