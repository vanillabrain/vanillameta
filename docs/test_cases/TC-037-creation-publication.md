# Test Case: Saved Creation Publication Continuation

## Overview

**ID:** TC-037
**Goal:** 생성안 저장 후 같은 입력창에서 새 대시보드 게시 준비와 명시 게시를 연결한다.
**Status:** Draft

## Flow

| Step | Name                   | Description                                                  | Use Case                                              |
| ---- | ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| 1    | Publish saved creation | 저장 영수증→동일 입력창 준비→범위 확인→명시 게시→reload·중지 | [UC-037](../use_cases/UC-037-creation-publication.md) |

## Validation

- BR03701/A3: 새 ID 대상 유지/reload·자동 창/쓰기0·명시 원본 복귀·질문 보존.
- BR03702/A1: 준비는 GET만, 부정/혼합/수정은 원본 무전송, 실제 공개는 별도 버튼.
- BR03703/A2: 영수증 ID/revision·권한/409·유실 재시도는 기존 게시 검사와 연결한다.
- Ego에서 새 게시본 데이터·원본 정의/배치/게시 보존 및390/768/1440 컨트롤/넘침을 기능과 디자인 별도 기록한다.

## Execution

PASS_SELECTED: Ego79 저장 영수증45→준비 GET만→명시 게시1/2→익명/reload→중지410, 원본/저장본 보존 및390/768/1440 클릭·포커스·넘침0. FE131/type/lint/build/core8·증빙47개 PASS. 실제409는 컴포넌트 회귀이며 전체 수용은 Open. [증빙](../testing/creation-publication.md).
