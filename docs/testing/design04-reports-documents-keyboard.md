# DESIGN-04 — 비공개 보고서·Google 문서 키보드 후속

2026-10-31. 기준 `47158685`. [아티팩트 허브 후속](design04-artifact-hub-keyboard.md)에 이어 남은 데스크톱 화면 중 비공개 보고서 목록과 Google 문서를 확인했다. 모바일과 실제 VoiceOver 발화는 제외한다.

## 조건과 환경

새 소유 MySQL8.4.11, API4294, WEB3294, CONTROL4494와 Ego104를 사용했다. 격리 DB의 전용 합성 계정으로 로그인했고 `Tab`, `Shift+Tab`, `Enter`, `Escape`만으로 조작했다. 최초 오류 주입과 Tab 관찰은 Ego 기본 1800×849, 최종 두 화면과 포커스 복구 캡처는 1440×900에서 확인했다. Google OAuth 설정이 없는 상태이므로 외부 Google 계정 승인은 실행하지 않았다. gpt-6-luna 설정은 유지했고 제품 AI 호출은0이다.

## 발견한 오류와 수정

Google 문서 목록을 일시적으로 실패시켜 오류 화면의 **다시 조회**를 Enter로 실행했다. 재조회가 성공하면 기존 오류 버튼이 사라지면서 포커스가 `BODY`로 남았다. `DocumentsList`는 조회 시작을 기록하고 결과가 렌더링된 뒤 포커스가 실제로 본문에 머문 경우에만 제목으로 옮긴다. 다시 실패하면 같은 **다시 조회** 버튼으로 복귀한다. 대기 중 사용자가 위젯 링크로 이동한 경우에는 그 링크의 포커스를 보존한다. `DocumentFrame` 제목은 프로그램적 포커스 대상으로 만들되 Tab 순서에는 넣지 않았고, 제목 너비에 맞춘 포커스 링을 표시한다.

회귀 검사는 수정 전에 제목 포커스 기대가 실패했고, 수정 뒤 `Documents.test.tsx` 32개가 통과했다. 재조회가 다시 실패하면 오류 버튼으로, 성공하면 제목으로 초점이 간다. FE 타입, 변경파일 ESLint, Vite 빌드도 통과했다. 비공개 보고서 목록은 새 코드 변경 없이 통과했다.

## 실제 관측

| 화면·동작 | 실제 결과 | 판정 |
|---|---|---|
| 비공개 보고서 Tab | 허브 복귀 링크→목록 새로고침 순으로 진입했고 빈 목록 안내가 읽힌다. | PASS |
| 비공개 보고서 재조회 | 로딩 완료 뒤 목록 새로고침 버튼 포커스 유지, 빈 결과 유지, 1440px 넘침0. 세 번 반복해 같은 결과다. | PASS |
| Google 문서 Tab | 로고→상단 메뉴→언어→추가메뉴→계정→문서 탐색 링크→푸터 순이며 비활성 `Google 문서 연결`은 Tab 대상에서 제외됐다. | PASS |
| Google 문서 빈 결과 | 설정 필요·조직 필요·빈 목록 안내, 비활성 연결 버튼, 1440px 넘침0. | PASS |
| Google 문서 오류 복구 | 요청 실패→오류 안내→Tab으로 `다시 조회`→Enter. 수정 전 성공 응답 뒤 `BODY`, 수정 뒤 `Google 문서` 제목 `H1`로 포커스 이동. 같은 재조회가 다시 실패하면 오류 버튼으로 복귀한다. | FAIL→FIXED |
| 조직 분석 접힌 폼 | `새 조직 만들기` summary에 Enter→같은 summary 포커스 유지, Tab→`새 조직 이름` 입력, 이름 입력 뒤 Tab→`조직 만들기` 버튼. 레이블 연결·36px 입력·1440px 넘침0. | PASS |
| 지연 응답 중 이동 | 재조회 요청을 보류한 상태에서 사용자가 `위젯` 링크로 이동하고, 응답 완료 뒤에도 `위젯` 링크 포커스 유지. | PASS |

## 증빙과 남은 범위

증빙 루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/design04-report-documents-20261031`이다. `reports-reload-stable.json`, `documents-empty-keyboard.json`, `documents-error-reload-observed.json`, `documents-error-reload-after-fix.json`, `documents-reload-preserve-moved-focus.json`, `organizations-form-1440-final.json`, `screens-final.json`에 실제 키 입력 상태를 남겼다. `documents-focus-red.log`, `documents-test-final.log`, `frontend-type.log`, `frontend-lint.log`, `frontend-build.log`는 단계별 검사 결과다. 대표 화면은 `reports-empty-1440-final.png`, `documents-empty-1440-final.png`, `documents-error-reload-after-fix.png`, `organizations-form-1440-final.png`다.

DESIGN-04는 실제 VoiceOver 발화·읽기 순서와 다른 화면 전체 키보드 경로가 남아 **부분 완료**를 유지한다. 모바일, 실제 Google OAuth 승인, 실기기, 운영·전체 WCAG 수용은 이번 범위가 아니다.
