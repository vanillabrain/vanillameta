# Node 24 통합·데이터 화면 접근성 — 2026-10-13

기준 `develop-v2`, 시작 커밋 `641f847f`. Node 24·AI SDK 7 통합 시점의 루트 검사와 DESIGN-04의 미검증 데이터 화면 경로를 선택했다. 기존 통과 E2E/실AI 질문은 반복하지 않았다. Codex `gpt-6-luna` 설정은 유지했고 신규 모델 호출은 없다.

## 통합 검사

격리 Node `24.21.0`을 PATH 앞에 지정했다. 전역 Node와 다른 서버는 변경하지 않았다.

| 항목 | 최초 결과 / 수정 | 최종 결과 |
| --- | --- | --- |
| BE 전체 Jest | DB controller 테스트의 DuckDB provider 누락, commerce 테스트의 AI SDK ESM 간접 로딩, coding-agent 중단 테스트의 비동기 spawn 순서 가정으로 3파일 실패 | 44파일 / 391개 PASS |
| FE 전체 Vitest | 달력 테스트의 이전 영어 버튼 이름, WASM Worker mock의 오류 이벤트 API 누락으로 2파일 / 15개 실패 | 22파일 / 208개 PASS |
| 루트 `npm run build` | BE Nest + FE Vite | PASS |
| FE `tsc --noEmit` / 변경 파일 ESLint / `git diff --check` | 실제 변경 범위 | PASS |

테스트 수정은 누락된 테스트 의존성, 번역 키, EventTarget 구현을 반영했다. 중단 테스트는 임시 디렉터리 생성 완료 순서가 아니라 요청 prompt로 프로세스를 구별한다. Commerce는 실제 DuckDB worker를 계속 사용하며 주입된 AI stub의 경계만 격리했다. SDK 자체의 실연결 증빙은 [Assistant 기록](dashboard-assistant.md)과 [중단·복구 기록](assistant-reliability.md)을 재사용한다.

ts-jest 28의 TypeScript 5.9 지원 경고와 기존 Vite 설정/Toast UI CSS 빌드 경고는 남아 있다. Docker·원격 CI·외부 DB 드라이버 검증은 이번 PASS 범위에 포함하지 않는다.

## DESIGN-04 추가 조건

실제 headed Chromium, FE3483/API4683 및 기존 격리 DB를 사용했다. Aside 인증 연결 제약으로 기존 승인된 대체 브라우저를 유지했다.

| 조건 | 결과 / 증빙 |
| --- | --- |
| 데이터 카드 키보드 진입 | 최초 FAIL: 소스·데이터셋 선택 영역이 Tab 대상이 아니었다. 카드 제목을 실제 ButtonBase로 변경했다. Space로 auction_data 선택 후 pressed=true, Tab으로 해당 수정/삭제 진입 PASS. |
| 아이콘 이름 | 최초 FAIL: 소스·데이터셋 추가/수정/삭제와 테이블 수정의 이름 누락. 한영 이름 추가 후 AX snapshot에서 확인. |
| 미리보기 | Enter로 uploaded_data 조회, 실제 Parquet 행 표시. dialog 이름·닫기 이름 추가, Escape 후 원 미리보기 버튼에 포커스 복귀 PASS. |
| 삭제 취소 | 키보드로 auction_data 삭제 확인창을 열고 Tab 및 Escape로 취소. 전환 종료 후 삭제 버튼 포커스 복귀·원 소스 유지 PASS. 삭제를 실행하지 않았다. |
| 모바일 | 390×844에서 Enter로 미리보기, Escape 후 원 버튼 복귀. document.scrollWidth=390. 표의 내부 가로 스크롤은 유지한다. |

표 전체 셀의 키보드 편집/읽기, 소스·데이터셋 편집 폼과 다른 화면의 전체 키보드 경로, 실제 VoiceOver 발화·읽기 순서는 아직 미검증이다. DESIGN-04는 **부분 완료 유지**, 고유 MD ID 집계는 130개(129완료/1부분 완료)다. AX snapshot을 실제 스크린리더 발화 증거로 취급하지 않는다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/node24-integration`.
최초 실패 `tests-before.log`, `tests-intermediate.log`, `data-before-aria.txt`, `data-before.png`와 최종 `tests-after.log`, `build.log`, `keyboard-results.json`, `data-after-aria.txt`, `preview-aria.txt`, `data-preview-desktop.png`, `data-preview-mobile-final.png`, `mobile-aria.txt`을 보존했다. 모바일 초기 `data-preview-mobile.png`는 로딩 중 캡처이며 데이터 표시 완료의 증거로 사용하지 않는다. 첫 완료 대기 selector가 표 헤더 클래스와 맞지 않아 timeout이 발생했고, 실제 헤더 텍스트로 확인 후 완료 화면을 다시 캡처했다.
