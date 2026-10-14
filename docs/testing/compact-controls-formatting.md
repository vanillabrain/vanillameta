# 대시보드 설정 밀도와 탐색 숫자 표시

기준: `codex/self-service-next-20261014`, HEAD `db584d6e` + 이번 diff. 기존 성공 케이스는 관련 변경 범위만 재사용한다. AI `gpt-6-luna` 설정은 유지하고 이 표시 변경에서는 호출하지 않는다.

## 신규 검증 조건

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| DENSITY-01 | 대시보드6 첫 진입 | 기간·필터 설정 및 개인 저장 보기는 기본 접힘. 적용 기간/필터 칩·숫자표시·Assistant는 사용 가능. 집계·저장 payload 변화 없음 |
| DENSITY-02 | 키보드 Enter/Space로 설정 열기/닫기, 날짜/기기 필터 후 닫기 | 설정 값·집계 보존, 추가 query 없음. 닫혀도 적용 조건/미적용 날짜/오류 안내 표시. 내부 입력은 Tab으로 접근 가능 |
| DENSITY-03 | 1440×900 및 390×844 같은 상태 비교 | 문서 가로넘침 없음, KPI까지 스크롤 거리 감소, 텍스트/컨트롤 겹침 없음. Rill 동일 뷰포트 캡처 비교 |
| NUMBER-01 | 저장 지표 compact/plain로 KPI와 차원 순위 표시 | K/M/B/T·화폐·소수점 일치, 정확한 전체 숫자는 title/접근성에 보존. `9007199254740993` 반올림 손실 없음 |
| NUMBER-02 | 추세/이전 기간 비교와 전체 숫자 표시 전환 | 선택된 숫자 표기를 일관 적용, exact 값 표 및 계산 결과 유지. NULL/0/음수와 999999 경계 승격 검사 |

## 실행 기록

실행 후 PASS / FAIL / BLOCKED / NOT_RUN을 기록한다. 전체 VoiceOver는 기존 BLOCKED를 유지하며 이번에 재시도하지 않는다. 전체 출시 회귀·Pivot·숫자범위·상태 저장은 이번 변경 범위 밖이다.

### 2026-10-14 실행 결과

환경: Node24.21.0, FE127.0.0.1:3484/API4684, 기존 격리 cold-start DB/uploads와 허용된 테스트 계정 사용. Rill localhost9014의 `auction_data_metrics_canvas`, 원본1391572행/source3/dashboard6. 새 소스나 제품 데이터 변경 없음. 저장 API/LLM 호출0, gpt-6-luna 설정 변경0.

- **DENSITY-01~03 PASS 선택 조건**: 대시보드 최초 진입 기본 접힘, Enter/Space 열기·닫기, Tab→업무시간대 진입, 기기 선택 후 닫기/재열기 값 유지, 날짜 미적용 안내, 전체 숫자 전환을 실제390×844/1440×900 브라우저에서 확인했다. 모바일 문서폭390=viewport390, 탐색 화면도390. 최초 KPI 제목 y800→486, 314px 감소. Aside 데스크톱 실제 snapshot/필터/Enter 및 정확값 표 확인. Aside의 Space 확인은 변화가 없어 PASS 근거로 쓰지 않았으며, 실제 headed Chromium에서 Space 양방향 성공을 별도로 확인했다.
- **NUMBER-01 PASS 선택 조건**: 저장 compact 지표가 탐색 KPI635M·Mobile/Tablet308M·Games Console931K로 표시된다. catalog는 definition.numberNotation=compact. XHR 집계634513000/필터307763000, 대시보드 평균5.571238676523254/5.655265295535606으로 기존 원본 oracle 대비1e-9 이내. title/접근성에는 원래 숫자를 보존한다. unsafe정수·20자리 초과 소수·NULL/음수/화폐/경계 승격은 단위 검사로 확인했으며 모두의 실제 화면은 NOT_RUN.
- **NUMBER-02 PASS 선택 조건**: Aside 탐색2023-09-10~11 UTC 비교의 현재182M·이전87M·변화+95M 표시, 이전 정확값87188000/증감94665400 title을 확인했다. 시계열 표는90,048,200/91,805,200 전체 수치를 표시하며 compact로 축약하지 않는다. 모든 단위/시간대/숫자 설정 조합의 실제 화면은 NOT_RUN.
- **검사 PASS**: 영향받는 FE9파일/125개 테스트, FE타입·변경파일lint, FE build, git diff whitespace 검사. 쿼리·집계·저장 계약 변경이 없어 BE 전체/핵심E2E/이미 성공한AI생성·수정은 반복하지 않았다.

Rill 같은 뷰포트의635M/$5.57과 짝 캡처를 남겼다. 이번은 컨트롤 밀도·숫자 가독성 보강이며 완전한Rill UI동등성을 주장하지 않는다. 기간 팝오버·축 라벨·좌우 내부 스크롤·차원 변화량 정렬·Pivot·탐색 보기 저장은 후속이다. 전체 VoiceOver는 기존BLOCKED 유지, 실기기터치·전체대비 인증·출시회귀는 NOT_RUN.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/compact-controls-formatting-20261014/`의 `ui-results.json`, `ui-xhr.json`(인증정보 제외), `final-tests.log`, `typecheck.log`, `lint.log`, `build.log`, `vm-{desktop-after,mobile-after,explore-desktop,explore-mobile}.png`, `rill-{desktop,mobile}-reference.png`, `aside-vm-explore-{exact-table,compare}-final.png`. `controls-red.log`는 구현 전 새 접기 컨트롤 없음 실패, 이후 회귀125개 PASS로 분리했다.
