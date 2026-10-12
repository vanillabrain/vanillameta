# 숫자 KPI 축약 표시 — 2026-10-12

기준 `develop-v2`, 시작 HEAD `e3b16872` 이후 변경. DESIGN-02·03 및 WIDGET-03의 신규 숫자 표시 옵션만 검증했다. 기존 집계·AI 생성·필터 케이스는 반복하지 않았다. Codex `gpt-6-luna` 설정 유지, 신규 LLM 호출 없음.

## MD 조건

- 숫자 표시에서 전체 숫자/축약(K/M/B/T)을 선택한다. K=1천, M=1백만, B=10억, T=1조. 기존 소수 자릿수로 반올림하고 불필요한 끝자리 0은 제거한다. 반올림으로 1000단위가 되면 다음 단위로 승격한다.
- 정확한 원래 값은 KPI title/aria-label과 시계열 표에 유지한다. 1000 미만, 통화 접두사, 기존 전체 숫자 옵션은 보존한다.
- 분석 대시보드는 축약이 기본이고 선택은 브라우저 localStorage에 대시보드별 저장한다. 표시 변경만으로 SQL/preview 재조회하지 않는다. 이 선택은 서버 계정 간 동기화 설정이 아니다.
- 일반 숫자 위젯은 기존 전체 숫자가 기본이다. 위젯 편집의 숫자 표시 옵션은 기존 option JSON에 저장되며 새 조회에서도 유지한다.
- desktop1440×900/mobile390×844에서 숫자와 옵션이 넘치지 않고 키보드로 선택 목록을 열고 닫을 수 있다.

## 실행 결과

Aside daemon 인증 연결 실패에 대한 기존 승인 대체인 headed Chromium을 재사용했다. 분석 화면 `http://127.0.0.1:3400/dashboard/5`, 실제 preview만 격리 API4681로 전달하는 기존 경로 유지. 같은 Rill 광고 샘플 1,391,572행을 사용했다. 수치 oracle·Rill 곡선 비교는 [직전 결과](kpi-trends-accessibility.md)를 재사용했으며 Rill을 다시 실행하지 않았다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/compact-kpi`.

| 조건 | 결과 | 증빙 |
| --- | --- | --- |
| 축약·전체 전환 | PASS | 실제 합계634513000: 전체634,513,000 ↔ 축약635M. 두 모드 각각 reload 유지. `results.json`, `desktop-1440.png`. |
| 정확한 값·표 | PASS | title/aria-label634513000, 표169구간+헤더1행. 첫 구간1,808,200 그대로. 평균 입찰가$5.57 유지. |
| 표시만 변경 | PASS | 양방향 전환에서 preview 요청 추가0. reload는 정상 조회한다. |
| 일반 위젯 설정 영속 | PASS | 실제 UI 위젯122 편집→축약→저장 확인→새 편집 조회635M. fresh GET content.numberNotation=compact, 소수0 및 기존 옵션 보존. `widget-saved.png`, `results.json`. |
| 모바일·키보드 | PASS, 대상 옵션 | 390×844 document.scrollWidth390. Enter로 숫자 표시 목록 열기, Escape 닫기. `mobile-390.png`. 실제 스크린리더 발화 검증은 포함하지 않는다. |
| K/M/B/T·반올림·기존 형식 | PASS | 관련 FE 테스트37개: 1500→1.5K, 999500 소수0→1M, 음수, B/T, 정확한 값, 소수/접두사, 설정 보존 및 기존 숫자 정밀도·필터 경계. 새 combobox로 실패한 기존 차원 수 검사 범위를 차원 이름으로 한정한 뒤 재검증 통과. |

FE 타입·변경 파일 ESLint·빌드·git diff --check 통과. 기존 Vite 설정/Toast UI CSS 빌드 경고는 유지한다. 서버/DB/AI/의존성 변경 없음. 전체 E2E 및 관련 없는 통과 케이스는 생략. DESIGN-04의 실제 VoiceOver 잔여 조건은 그대로 부분 완료다.
