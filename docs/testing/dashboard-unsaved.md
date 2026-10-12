# NAV-04 일반 대시보드 미저장 조건 — 2026-10-12

기준 `develop-v2` / `097dd54c`. 제품 코드·gpt-6-luna 설정 변경 없음. `vanillameta-verify`의 남은 일반 대시보드 조건만 실제 headed Chromium(1440×900)으로 확인했다. 기존 Aside daemon 부재에 따른 허용된 대체 브라우저를 재사용했다. FE `http://127.0.0.1:3470`, API `http://127.0.0.1:4670/v1` 및 기존 격리 검증 DB를 사용했다.

| 조건 | 결과 | 확인 |
| --- | --- | --- |
| 신규 생성 초안 취소 | PASS | oracle 위젯104를 선택하고 UNSAVED_CREATE_CANCEL 제목 입력 후 취소. 대시보드 목록으로 복귀, 서버 목록 전체 응답 동일. |
| 신규 생성 초안 메뉴 이동 | PASS | 위젯104와 UNSAVED_CREATE_NAV 초안에서 위젯 메뉴 이동. 정상 위젯 페이지 도착, 서버 목록 동일. |
| 편집 초안 취소 | PASS | 기존 대시보드6에서 제목을 UNSAVED_EDIT_CANCEL로 바꾸고 Requests 위젯103 추가. 취소 후 원 조회 화면으로 복귀, 서버 상세 전체 응답 동일. |
| 편집 초안 메뉴 이동 | PASS | 제목을 UNSAVED_EDIT_NAV로 바꾸고 위젯103 추가한 뒤 위젯 메뉴 이동. 원 대시보드 상세 응답 동일. 돌아와 새로고침하면 원 제목·위젯104 하나·합계500 유지. |

모든 조건에서 대시보드 POST/PUT/DELETE 요청은0이다. 기존 저장 layout `[{"w":6,"h":5,"x":0,"y":0,"i":"104"}]`과 위젯 구성 및 제목이 보존됐다. 추가했던 위젯103은 저장된 화면에 남지 않았다. 새 pageerror0. 브라우저 메모리 초안을 저장하지 않고 버리는 동작이 현재 MD 기대에 부합하며, 미저장 경고창 표시 자체는 이 명세의 요구가 아니다.

신규 자원을 생성하거나 저장된 데이터를 수정하지 않았다. 기존 NAV-04의 source/dataset/widget/AI 취소 증빙을 재사용하고 이번 네 조건을 합쳐 ID를 완료로 갱신했다. 제품 오류를 발견하지 않아 코드 수정·기존 통과 테스트 반복·전체 빌드는 실행하지 않았다. 이번 검증은 브라우저 새로고침 후 보존 확인을 포함하지만 브라우저 강제 종료 복구 검증은 아니다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-unsaved`.

- `results.json`: 목록/상세 전후 원본 응답과 변경 요청0, 새 pageerror0.
- `restored-screen.txt`: 새로고침 후 실제 화면 접근성 스냅샷.
- `create-draft.png`, `edit-draft.png`: 미저장 초안 화면.
- `restored-dashboard.png`: 원 제목·위젯·500으로 복귀한 화면.
