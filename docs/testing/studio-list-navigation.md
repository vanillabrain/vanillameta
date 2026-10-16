# 초안·질문을 유지하며 대시보드 목록 열기

Status: Draft · P3 · TC-005 반복 편집 진입 지원 · PASS_SELECTED.

## 변경과 경계

Studio 캔버스 도구줄의 기존 보기 옆에 ‘목록 ↗’을 추가했다. `/dashboard`를 새 탭으로 열며 `noopener noreferrer`를 사용한다. 원본 편집 탭의 블록·질문을 자동 저장하거나 삭제하지 않는다. 기존 보기·브라우저 뒤로 등 전체 이탈을 막는 가드가 아니다.

처음 헤더에 배치했을 때390px에서 저장 버튼이 다음 줄로 밀리는 회귀를 발견해 최종적으로 캔버스 도구줄에 배치했다. 공통 outline/sm32px·14px를 사용하고 헤더 버튼 배치는 유지했다. 새 테마/전역 높이 예외를 추가하지 않았다.

최종 실검증에서는 보조 패널을 닫으면 Conversation이 unmount돼 입력 질문이 사라지는 기존 오류를 발견했다. 같은 Workspace가 입력 문자열을 소유하고 Conversation에 선택적 controlled draft를 전달해 닫기/재열기·설정 패널 전환에서 보존한다. 전송 성공의 기존 입력 정리는 유지하고 브라우저 저장소/서버에는 추가 저장하지 않는다. Workspace 교체·페이지 reload까지 보존한다고 보장하지 않는다. 실행중 요청·모든 내부 대화 카드 상태의 보존 범위를 확장하지 않았다.

## Ego85 실제 검증 · 2026-10-17

기존 FE3698/API4899·공개 합성 source32·소유 저장45를 사용했다. 서버의 저장본 응답 전체를 전후 비교했다.

- 미저장 블록 복제(3→4)·전송 전 질문 입력 → 패널 닫기 → 실제 목록 새 탭 → 편집 탭 패널 재열기에서 질문/복제 블록/undo1/미저장 상태가 유지됐다.
- 390px Sheet에서도 질문 유지 → 닫기 → 목록 새 탭 → 패널 재열기를 확인했다. 질문·AI 요청은 전송하지 않았다.
- 390/768/1440의 최종 미저장 화면을 캡처·실측했다. 문서 가로 넘침0, 목록 링크32px/14px, 헤더 저장 버튼은 원래 행을 유지하며 기존 보기/블록 추가 주변과 겹치지 않는다.
- 마지막에는 질문을 비우고 undo로 검증용 복제 블록을 원복했다. 저장45 응답 전체(정의·배치·revision·미리보기)가 전후 동일하다. 수집된 편집기 XHR은 runs GET200뿐이며 저장/AI/게시 POST0이다.

**기능 PASS_SELECTED:** 실제 새 탭·동일 편집 탭·미저장 블록/질문 보존. **디자인 PASS_SELECTED:** 최종 세 폭의 도구줄/헤더·주변 요소 크기와 정렬. 실제 휴대폰·전체 접근성·운영·페이지 이탈/reload 영구 복구·모든 실행중 상태는 NOT_RUN이다. 차트/계산은 미변경이므로 새 Rill live 비교는 하지 않았다.

## 검사·증빙

- 관련 FE3파일53개 PASS: Editor·PanelSurface·Conversation activity. 새 회귀는 목록 URL/새 탭/rel·미저장 복제/편집 이력·패널 닫기/재열기 질문·자동 POST0을 확인한다. 첫 테스트는 복제 제목의 여러 렌더링을 단일 요소로 찾던 기대를 수정했다.
- FE 타입·변경 lint·FE build PASS. backend/core E2E는 범위 밖이다.
- AIWF strict는 기존12 errors/33 warnings/4 infos로 미해결이며 pin/check 일치는 승인/전체 수용과 구분한다.
- 증빙: `/tmp/vm-uc042/`의 `final-dirty-{390,768,1440}.png/json`, `final-controls-*.json`, `final-preserved.json`, `mobile-preserved.json`, `final-list-tab.json`, `final-xhr.json`, `before/after.json`, `assertions.py/json`, `unit/type/lint/build.log`. 초기 `dirty- 390.png`는 헤더 배치 실패, 초기 `final-preserved`의 질문 손실은 수정 후 같은 파일의 최종 재검증으로 대체했다.
