# DESIGN-04 — 매출·환불 키보드 후속

2026-10-13, develop-v2 시작 `ff65e1e4`. FE3483/API4683의 기존 격리 환경과 승인된 headed Chromium을 재사용했다. Aside 연결 제약은 이전 기록과 같다. 기존 COMMERCE-01~08의 저장·계산·Rill·AI 결과는 재사용하며 이번 결과로 다시 판정하지 않는다. AI는 Codex `gpt-6-luna` 설정 유지, 호출0이다.

## 발견과 수정

- 일별 차트에 키보드로 읽을 수 있는 정확값 표가 없었다. 기존 report.daily와 USD 포맷을 그대로 사용하는 접이식 표를 추가했다. UTC/통화 이름, 열 헤더, 스크롤 중 고정 헤더를 제공한다.
- 주문 표는 Chromium에서 Tab으로 스크롤 영역에 들어갈 수 있었지만 이름이 없었다. 일별·채널·주문 표에 이름과 region/Tab 진입을 명시하고 주문 펼치기 버튼을 대상 표에 연결했다.
- AI 창의 초기 포커스가 창 컨테이너였다. 편집 요청 입력에 autofocus를 추가했다. 호출·집계·저장 로직은 변경하지 않았다.

## 실제 검증

현재 격리 DB에는 Commerce 프로젝트가 없었으므로 기존 Analytics Engineering 정상 CSV4개를 화면에 지정하고 프로젝트 `MD 접근성 매출·환불` ID1을 준비했다. 이는 이번 키보드 검증의 픽스처 준비이며 기존 파일 선택·저장 케이스를 반복 검증한 것으로 집계하지 않는다. OS 파일 선택창 전체 키보드 경로는 NOT_RUN이다.

| 조건 | 결과 / 확인 범위 |
| --- | --- |
| 일별 표 | PASS: summary Enter→Tab으로 이름 있는 region 진입, outline 2px, ArrowRight/Down으로 실제 scrollLeft/Top 각각40 이동. 1,096행의 날짜·금액 표시가 API report 포맷과 모두 동일. 서버 계산의 독립 정확성 검사는 기존 oracle 결과 재사용. |
| 채널·주문 표 | PASS: 채널 summary Space→Tab으로 region 진입. 주문 전체100건 Enter→Tab으로 region 진입, ArrowRight로40 이동. 표의 이름/열 헤더는 AX snapshot 확인. 실제 스크린리더 발화 검증은 아니다. |
| AI 창 | PASS: 열기 버튼 Enter→AI 편집 요청 초기 포커스. Tab으로 취소→초안 생성→입력 순환, 비활성 저장 제외. Escape→열기 버튼 복귀. 모델 요청과 저장은 실행하지 않았다. |
| 가져오기 영역 | PASS: 열기 Enter 후 대상/프로젝트 이름/파일 선택4개/가져오기7개 Tab 대상과 outline 확인. 닫기 Enter. 다시 가져오기는 실행하지 않았다. |
| 프로젝트·채널 메뉴 | PASS: Enter로 열기, 채널 End 이동, Escape로 닫고 Select 복귀. 선택 적용·기존 필터 수치 검사는 재사용한다. 날짜 입력 전체 세그먼트 조작은 이번에 실행하지 않았다. |
| 모바일 | PASS: 실제390×844, 페이지 scrollWidth=viewport=390. 표 내부 가로·세로 스크롤과 고정 헤더 캡처. desktop1440×900도 확인. |
| 상태 보존 | PASS: 픽스처 준비 이후 GET report 전후 응답 동일, 관찰된 Commerce POST/PUT/PATCH/DELETE0. |

## 검사·증빙·잔여

FE 타입·대상 ESLint·빌드·diff check PASS. UI 이름·표 대체수단·포커스 변경이므로 실제 브라우저로 검증하고 새 자동 UI 테스트나 의존성을 추가하지 않았다. 이전 전체599개 단위·BE 빌드는 재사용했다. 기존 Vite/Toast UI CSS 빌드 경고 유지.

증빙 루트 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-keyboard`:

- 최초 `before-aria.txt`, `ai-before.png`, `table-before-mobile.png`.
- 최종 `results.json`, `baseline-report.json`, `after-aria.txt`, `types.log`, `lint.log`, `build.log`.
- 화면 `ai-after-mobile.png`, `orders-after-mobile.png`, `daily-after-desktop.png`, `daily-after-mobile-final.png`. 최종 모바일 이미지는 고정 헤더 추가 후 캡처다.

실제 VoiceOver 발화·읽기 순서, 전체 WCAG, OS 파일 선택창, 날짜 입력 전체 키보드 경로, 다른 차트 전체 속성은 미검증이다. DESIGN-04 부분 완료, 130ID의129완료/1부분 완료 집계를 유지한다.
