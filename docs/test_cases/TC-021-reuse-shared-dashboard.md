# Test Case: Reuse Shared or Published Dashboard

## Overview

**ID:** TC-021
**Goal:** [UC-021](../use_cases/UC-021-reuse-shared-dashboard.md)의 권한과 독립 저장을 검증한다.
**Status:** Draft

## Preconditions

공개 Rill 데모 원본/소유자·별도 수신자·수신자 파일 소스, 임시 공유/게시 링크.

## Flow

허용→링크→로그인→내 소스/열 연결→미리보기→복사본 저장→reload. 불허·중지/만료/재게시·타인 target·익명과 원자 실패/재시도를 확인한다.

## Validation

| ID      | Expected                                                    | Status |
| ------- | ----------------------------------------------------------- | ------ |
| TC02101 | 기본 불허·소유자만 허용/게시 private recipe·public 비노출   | PASS   |
| TC02102 | 수신자 로그인/내 소스·원본 SQL/조건/결과 비노출             | PASS   |
| TC02103 | 공유 현재본/게시 고정본·중지/만료/버전 변경·rollback/재시도 | PASS   |
| TC02104 | Ego 공유/게시→소스교체→preview→save→reload·원본 불변        | PASS   |
| TC02105 | 390/768/1440 크기·정렬·비활성/실패·넘침                     | PASS   |

실휴대폰·운영 MySQL·전체 TC005는 NOT_RUN이다.

[실행 증거](../testing/shared-dashboard-reuse.md): 자동 권한/SQLite 원자 저장, Ego 두 계정 공유/게시 복제·새로고침과 대표 폭을 확인했다. 실제 UI 응답 유실·모든 오류/로딩 조합·운영/실기기 범위는 미검증이다.
