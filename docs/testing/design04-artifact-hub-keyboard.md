# DESIGN-04 — 아티팩트 허브 키보드 후속

2026-10-31. 기준 `fba55bee`와 이번 수정. [DESIGN-04 비교](design-rill-parity.md)의 남은 ‘다른 화면 키보드’ 중 아티팩트 허브를 데스크톱에서 확인했다. 모바일과 실제 VoiceOver 발화는 제외한다.

## 조건과 환경

새 소유 MySQL8.4.11, API4293, WEB3293, CONTROL4493과 Ego103을 사용했다. 데이터는 격리 DB의 전용 합성 계정과 매출·환불 샘플37주문이다. 허브 전체 Tab 경로와 메뉴는 Ego 기본 1800×849, 허브 초기화 최종 상태와 외부 AI 연결은 1440×900에서 `Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`, 한글 붙여넣기만으로 조작했다. gpt-6-luna 설정은 유지했고 제품 AI 호출은0이다.

## 발견한 오류와 수정

검색어와 유형을 적용한 뒤 **검색 조건 초기화**에서 Enter를 누르면 필터는 지워졌지만 포커스가 `BODY`로 사라졌다. 초기화 직후 버튼이 비활성화되면서 포커스가 유지될 대상이 없어진 것이 원인이다. `ArtifactLibrary`가 검색 입력을 소유하는 ref를 두고 초기화 직후 그 입력으로 포커스를 돌린다. 외부 AI 연결의 **목록 다시 읽기**도 조회 중 버튼이 사라져 같은 포커스 소실이 있었다. 재조회 시작을 기록하고 결과가 다시 렌더링된 뒤 같은 버튼으로 포커스를 복구한다. 사용자가 대기 중 다른 링크로 초점을 옮긴 경우에는 복구하지 않는다. 두 수정 모두 기능·URL·API 계약은 바꾸지 않았다.

회귀 검사는 수정 전에 두 포커스 기대가 실패했고, 대기 중 사용자가 다른 링크로 이동한 뒤 응답이 끝나는 경우에도 같은 실패를 확인했다. 수정 뒤 `ArtifactLibrary.test.tsx` 6개와 `AiConnections.test.tsx` 15개가 통과했다. FE 타입, 변경파일 ESLint, Vite 빌드도 통과했다. ESLint 첫 실행은 기존 긴 JSX 줄과 새 버튼 속성의 포맷 오류를 냈고, 프로젝트 formatter로 고친 최종 재검사가 통과했다. 이번 문서와 수정의 기준 환경만 기록하며 다른 DESIGN-04 화면 전체를 통과로 확대하지 않는다.

## 실제 관측

| 동작 | 실제 결과 | 판정 |
|---|---|---|
| 최초 Tab 순서 | 로고→아티팩트→위젯→데이터→매출·환불→언어→추가메뉴→계정→허브 작업→연결 화면→보관 보기→표시 방식→검색→유형→정렬→초기화 순서로 들어갔다. | PASS |
| 그리드 전환 | 그리드에서 Space, `aria-pressed=true`, URL에 `artifactDisplay=grid`, 포커스 유지. | PASS |
| 한글 검색 | 검색 입력의 `산출물 제목 검색` 레이블·ref 연결 확인, 한글 붙여넣기 뒤 정확한 검색어와 URL 생성. | PASS |
| 초기화 포커스 | 수정 전 포커스 소실 재현. 수정 뒤 Enter로 초기화하고 URL 필터 제거, 입력값 빈 문자열, 검색 입력 포커스 복귀. | FAIL→FIXED |
| 보관함·기본 목록 | 보관함 Space→`aria-pressed=true`·`artifactView=archived`, Shift+Tab→기본 목록 Space→active URL·포커스 유지. | PASS |
| 계정 메뉴 | Enter로 열고 로그아웃에 초점, Tab 회원정보수정, Shift+Tab 로그아웃, Escape 닫기 뒤 `계정 메뉴` 트리거로 복귀. | PASS |
| 언어 메뉴 | Enter로 `한국어/English` 표시, Escape 닫기 뒤 `언어` 트리거로 복귀. | PASS |
| 외부 AI 연결 재조회 | 수정 전 포커스 소실 재현. 1440×900에서 수정 뒤 Enter로 재조회하고 빈 연결 상태가 다시 표시된 후 같은 버튼 포커스 복귀, 넘침0. 지연 응답 중 사용자가 다른 링크로 이동하면 그 초점을 유지한다. | FAIL→FIXED |
| 1440 레이아웃 | 허브와 외부 AI 연결의 헤더·필터·빈 결과·버튼 높이와 정렬이 유지되고 `scrollWidth-innerWidth=0`. | PASS |

## 증빙과 남은 범위

증빙 루트는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/design04-hub-keyboard-20261031`이다. `focus-path.json`, `search-archive-keyboard.json`은 수정 전 관측이다. 외부 AI 연결의 수정 전 포커스 소실은 실제 키 입력 도구 출력으로 확인했으며 별도 JSON은 만들지 않았다. `reset-archive-after-fix.json`, `account-menu-keyboard.json`, `language-menu-keyboard.json`, `hub-1440-final.json`, `ai-connections-keyboard-after-fix.json`은 수정 후 관측이다. `unit-red.log`, `unit-green-final.log`, `ai-reload-red.log`, `ai-green.log`, `frontend-type-final.log`, `frontend-lint-after-fix.log`, `frontend-build-final.log`에 단계별 결과를 남겼다. 대표 화면은 `hub-1440-reset-focus-after-fix.png`, `ai-connections-1440-after-fix.png`이며 수정 전 비교는 `hub-search-archive-keyboard.png`다.

DESIGN-04는 실제 VoiceOver 발화·읽기 순서와 다른 화면 전체 키보드 경로가 남아 **부분 완료**를 유지한다. 모바일, 실기기, 운영·전체 WCAG 수용은 이번 범위가 아니다.
