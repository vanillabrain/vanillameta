# 모든 하위 작업 실행

Arguments: $ARGUMENTS

현재 작업의 모든 하위 작업을 순차적으로 실행합니다.

## 워크플로우

1.  **현재 작업 조회**: `task-master next` 또는 `task-master show $ARGUMENTS`를 사용하여 현재 작업을 확인합니다.
2.  **하위 작업 목록 가져오기**: 현재 작업의 하위 작업 목록을 가져옵니다.
3.  **하위 작업 반복 실행**:
    *   각 하위 작업에 대해 `task-master show <subtask-id>`를 실행하여 세부 정보를 표시합니다.
    *   (구현 로직 실행 - 이 부분은 실제 구현에 따라 달라집니다)
    *   `task-master set-status --id=<subtask-id> --status=done`을 실행하여 완료로 표시합니다.
4.  **상위 작업 완료**: 모든 하위 작업이 완료되면 상위 작업을 완료 처리합니다.
5.  **다음 작업 제안**: `task-master next`를 실행하여 다음 작업을 제안합니다.

## 사용법

`/tm run-all-subtasks <task-id>`

`<task-id>`가 제공되지 않으면 `task-master next`를 사용하여 현재 활성 작업을 찾습니다.
