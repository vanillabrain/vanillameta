2026-10-15 Studio T4: [dashboard-studio.md](dashboard-studio.md). 실제 DuckDB 저장·reload/ID remap·legacy 보기 숫자, 두 탭409/3방향 재적용, commit 후 응답 유실 동일 요청 재시도·이후 편집 보존,768/390px 저장 복원 PASS. 숫자 가림·차트 축 잘림·status0 오류 문구·빈 캔버스 복구 수정. 보호 API401/403·파일 버전 pin·atomic rollback 확인. 선택 디자인 PASS, 실LLM/게시 NOT_RUN·VoiceOver BLOCKED 유지. 기존 집계 소급 변경 없음.

2026-10-15 Studio T3: [dashboard-studio.md](dashboard-studio.md). 합성 문서의 실제 블록 추가·복제·삭제·drag/resize·undo/redo, 폭별 배치 보존·모바일 키보드 편집 STUDIO-E01 PASS. 1440/768/390px overflow/겹침0, 긴 제목·전체 숫자 디자인 확인. Studio33·타입/lint/build PASS. 서버 저장·AI·게시 NOT_RUN, VoiceOver BLOCKED 유지. 기존 집계 소급 변경 없음.

2026-10-14 Pivot 탐색: [explore-pivot.md](explore-pivot.md) PIVOT-01~05 PASS_SELECTED_VARIANTS. 같은Rill원본1391572행/9×2/17실제조합·모든합계독립SQL 일치(56663800/3.07170877372671), Rill표시값·UX실화면비교. BE13/PivotFE6·전환1·타입/lint/build,1440/390·Tab/Enter·OSnative방향키·표스크롤·503복구·50행제한선택조건PASS. 실제깨진타소유자500→권한확인먼저수정→403재검증. 전체카탈로그130불변/VoiceOverBLOCKED/AI gpt-6-luna유지호출0. Pivot시간축·계층·이전기간·정렬편집·저장/공유/Export·운영부하는후속. 미커밋워크트리작업. 아래과거Pivot미구현기록은이번첫범위로보강됐다.

2026-10-14 탐색 개인 저장 보기: [explore-saved-views.md](explore-saved-views.md). source/user별 지표·차원·범위·기간·비교·집계·정렬·원본 펼침을 저장하고 최신 정상 데이터로 복원한다. BE55/FE28·타입/lint/build, Aside 저장/reload와 실제1440/390·키보드·새 세션·503 복구·실제 정의409/복구 PASS_SELECTED_VARIANTS. Rill URL reload와 비교했고 원본 요청56663800/이전29059200/126090행이 일치한다. 기존130개 집계 불변. Pivot·팀/URL 공유·실제 파일 게시 복원·MySQL 통합/VoiceOver BLOCKED는 후속, AI호출0/gpt-6-luna 유지. 미커밋 워크트리 작업이다. 아래 이전 기록의 탐색보기 저장 잔여는 이 선택 범위에서 보강됐다.

2026-10-14 숫자 범위·차원 변화 정렬: [explore-range-sort.md](explore-range-sort.md). 같은 원본 Rill139만행에 범위/날짜/비교 집계와 여섯 정렬을 독립SQL·실제UI XHR로 검증했다. BE267/FE19·타입/lint/build, Aside/390px·키보드 선택 조건 PASS_SELECTED_VARIANTS. Pivot·탐색보기 저장·VoiceOver BLOCKED 유지, 기존130개 집계 불변. AI호출0/gpt-6-luna 설정 유지.

2026-10-14 밀도·숫자표시 보강: [compact-controls-formatting.md](compact-controls-formatting.md). 기간/필터 접기·적용칩 유지·저장된K/M을 KPI/차원/비교/추세에 연결하고 정확값 표·unsafe숫자 문자열 보존. FE125개·타입/lint/build, Aside desktop 및 실제390/1440 키보드·XHR PASS_SELECTED_VARIANTS. 모바일 KPI y800→486, overflow0. 기존130개 카탈로그·VoiceOver BLOCKED 유지, AI호출0/gpt-6-luna 설정 유지. Rill 기간팝오버/축·내부스크롤/Pivot·숫자범위·변화정렬·탐색보기저장은 후속.
2026-10-14 저장 지표 AI 재사용: [UC-002 결과](saved-metric-ai.md). 기존 제작 계산기 공유, 소유 소스 활성 지표 최대30개 제공, 명시 metricId의 서버 계산식 적용·기존 필터/정렬 보존. BE137단위·빌드·production lint PASS. 실제 두 KPI 지표3/4 재사용→저장→reload 및 원래 정의 불변 PASS. OS막대 참조 자동 전파는 미완료이며 참조 없는 기존식 유지. 새 모바일/전체E2E/운영은 NOT_RUN.

2026-10-14 AIWF 단순 분석 후속: [UC-001 실행 결과](simple-analysis-parity.md). 문서/설계 선행 후 생성·수정 미리보기를 숫자+시계열로 통일하고 설정·저장 보기 관리 접기, UI Kit 국소 적용. FE305단위 및 라벨9개 재검사·타입·린트 PASS. 기존 분석5 실제 수정→저장→reload와 새 분석7 생성→저장→reload,390/1440·Rill1727 실제 화면 비교 PASS_SELECTED_VARIANTS. 평균 SVG의8.5e-14 오차와 날짜 이동/배치 차이는 명시. 인간 수락·물리 기기·VoiceOver·운영은 미기록/NOT_RUN.

2026-10-14 저장 AI 분석 재질문 후속: [Assistant 수정→미리보기→동일 분석 저장→새로고침](existing-ai-edit.md#저장-분석-재질문지표차트-수정-후속) PASS. 대시보드5에 평균 Bid Floor5.57 추가, OS별28항목 막대로 교체·내림차순/합계634,513,000 확인. 첫 AI 설명 오류는 저장 전 재질문으로 보정. Assistant28px/12px·선택32px·400px 패널 정렬/가로 넘침 확인. FE31단위·타입·변경린트 PASS. 이번 모바일/VoiceOver·새 Rill 실화면·전체 E2E는 NOT_RUN.

2026-10-14 AI 분석 저장·모바일 후속: [실제 질문→미리보기→저장→새로고침](existing-ai-edit.md#ai-분석-저장새로고침모바일-후속) PASS. 기존3698에서 Rill 소스7의 대시보드5 생성, 총 요청 수634,513,000·device_type9항목 및 새로고침 유지 확인. 모바일390/768 에뮬레이션의32px·12px·버튼 쌍 정렬·가로 넘침·질문 입력/취소 PASS. 모바일 버튼을 한 행으로 묶음. FE15단위·타입·변경린트 PASS. 물리 기기/VoiceOver·모바일 LLM 저장·새 Rill 실화면 비교는 NOT_RUN. 아래 기록의 분석 저장·모바일 미실행은 당시 범위이며 이번 선택 조건으로 보완했다.

2026-10-14 Commerce AI 진입·디자인 후속: [existing-ai-edit.md](existing-ai-edit.md#분석-진입컨트롤-디자인-후속). AI 분석 만들기 진입 추가, 실제 Rill KPI/기기 차트 초안 생성·취소 확인, 미지원/복호화 오류 소스 제외, 컨트롤32px·12px·동일 상단 정렬 및 날짜 역전 오류 확인. FE15단위·타입·린트 PASS. 이번 분석 저장·모바일·새 Rill 실화면 비교는 NOT_RUN.

2026-10-14 기존 환경 AI 편집: [설정·실제 화면·증빙](existing-ai-edit.md). 기존3698/4898 및 원래 DB·업로드·인증 유지, `.env.local` 우선 로딩과 Git 추적 제외 적용. Aside 질문201→저장200→새로고침 제목/설명/차트·수치 유지, 실제 LLM API2질문·리포트/게시 digest/version 불변, 독립 CSV5조건, BE36단위·루트빌드·변경린트 통과. 기존 AI 미설정 해소. 모바일/VoiceOver·새 Rill 비교·전체 E2E는 NOT_RUN.

2026-10-14 고객 데모 검증: [8분 대본·질문·실행 결과](../demo/customer-demo.md). 독립 CSV/Decimal 5조건, 실제 gpt-6-luna 질문2개·초안 격리·저장/재조회·데이터/게시 버전/해시 불변, Aside 설명 저장→새로고침·날짜 재적용, core Explore/Pivot E2E1개 통과. Rill 공식 광고 데이터 계층 보기45 저장/복원·합계307763000·CSV 파일/API 일치도 확인. 신규 AI 서버3798/4998 사용; 기존3698 AI 미설정은 보존. 새 Rill 탭 비교·모바일·VoiceOver는 NOT_RUN이며 기존 집계는 유지한다.

2026-10-14 필수 컬럼 누락 경합·모델 오류 후속: [error-help-deadline-model.md](error-help-deadline-model.md). Aside 실제 XHR120003ms 종료→Codex SIGKILL→동일 진단201, 실제 모델 거부503→동일 진단 gpt-6-luna201 확인. 기존 게시 버전/해시/요약 불변, 정상파일 재선택 noop·새로고침 수치 유지(PASS_SELECTED_VARIANTS). 제품 변경0·주입 없는API 복원·기존130개 집계 유지. 모바일/VoiceOver·provider 로그인 오류·전체 자손PID는 NOT_RUN.

2026-10-14 Aside 연결 복구 후속: [error-help-deadline-model.md](error-help-deadline-model.md). 실제 브라우저 XHR 샘플60초·날짜CSV120초 종료→Codex SIGKILL→재요청201, 샘플/CSV 실제 미지원 모델503→gpt-6-luna 명시 재요청201, 정상CSV 보고서·새로고침 수치 유지 확인(PASS_SELECTED_VARIANTS). 기존 화면/XHR BLOCKED 해소. 제품 변경0·기존 검사 재사용·130개 집계 유지. 필수 컬럼 경합 변형·모바일/VoiceOver·전체 자손PID는 NOT_RUN.

# MD 검증 현황 — 2026-10-13

2026-10-13 오류 도움 제한시간·미지원 모델 후속: [error-help-deadline-model.md](error-help-deadline-model.md). 실제 Axios60/120초 종료→Codex 자식 종료→같은 진단 재요청, 실제 CLI 미지원 모델 거부503→gpt-6-luna 명시 재요청→샘플 보고서200 확인. deadline/abort 양쪽 순서BE22개·실패 복구FE24개·타입/lint 통과. Aside는 데몬 연결 실패로 실제 화면/XHR 검증BLOCKED. 검증 주입 제거·기본 서버 복원, 기존130개 집계 유지.

2026-10-13 샘플 오류 도움 취소·timeout 후속: [sample-error-help.md](sample-error-help.md). 실제 Aside/Codex gpt-6-luna timeout 종료1009ms·취소 종료1482ms·초점 복귀·동일 진단 재요청4699ms/code0 확인. 샘플 재시도의 최초 보고서 조회는 격리 DB의 이전 upload root 참조로 실패해 검증 파일 복사/메타 경로 복구 후37주문·원래 수치를 확인했다. 제품 변경0, 모바일/VoiceOver·미지원 모델은 미검증, 기존130개 집계 유지.

2026-10-13 오류 도움 timeout 후속: [error-help-cancellation.md](error-help-cancellation.md). 실제 Codex gpt-6-luna의 첫 호출에1초 제한을 적용해 LLM_CODEX_TIMEOUT/SIGKILL 종료·실패 안내·같은 진단 재요청 성공·정상 CSV 수동 복구를 Aside에서 확인했다. 제품 변경0. 운영120초 경합·샘플/필수 컬럼 timeout UI·모바일/VoiceOver는 미실행, 기존130개 집계 유지.

2026-10-13 오류 설명 HTTP 취소 후속: [error-help-cancellation.md](error-help-cancellation.md). Aside 실제 날짜 오류 도움 취소 후 서버 Codex gpt-6-luna 자식 SIGKILL 종료(1545ms), 초점 복귀·같은 진단 재요청 정상 종료(4914ms)·기존 보고서/파일 선택 유지를 확인했다. 제품 변경0, 기존 검사 재사용. 샘플/필수 컬럼 HTTP 취소 변형·모바일/VoiceOver는 미실행이며 기존130개 집계를 유지한다.

2026-10-13 오류 설명 취소 후속: [error-help-cancellation.md](error-help-cancellation.md). 샘플/CSV AI 도움 취소 버튼·초점 복귀와 동일 진단 즉시 재요청 경합을 보완했다. FE29개·타입/lint/build, Aside 실제 CSV 도움 취소→재요청, Codex gpt-6-luna 직접 abort 종료 확인. HTTP에서 자식 종료 전체 관측·샘플 실제 UI·모바일/provider timeout은 미실행. 기존130개 집계 유지.

2026-10-13 날짜·필수 컬럼 오류 도움 후속: [import-error-help.md](import-error-help.md). 기존 명시 AI 오류 도움을 CSV 날짜/필수 헤더 검증 거부에 연결했다. 기존 보고서 유지·UTC 예시/필수 헤더·파일 재선택, 오래된 업로드/진단 무효화를 구현했다. 실제 API/Codex 및 Aside 선택 조건, FE15개·BE 관련43개·타입/lint/build 통과. 모바일/VoiceOver/실제 provider 취소·네이티브 파일창은 미실행. 기존130개 집계 유지.

2026-10-13 샘플 오류 도움 후속: [sample-error-help.md](sample-error-help.md). 고정 안전 진단과 사용자 요청형 Codex 설명, 재시도·파일 연결을 구현했다. Aside 실제 읽기 실패 → 설명(unverified) → 원래 샘플 재시도와 독립 Decimal 정답 대조 PASS. BE13/FE12·FE 타입/lint/build·BE build 통과.390px는 Aside viewport API 미지원으로 BLOCKED, 날짜/필수 컬럼 오류 및 실제 provider 취소 변형은 미실행. 기존130개 집계 유지.

2026-10-13 날짜·파일 팝업/차트 설정 키보드 후속: [native-popups-chart-keyboard.md](native-popups-chart-keyboard.md). 실제 Chromium 달력 방향키·확정/취소·복귀, macOS 주문 CSV 선택/취소와 선형·원형·분산형·표의 선택 속성을1440/390px에서 확인했다. 추가/삭제 아이콘 이름·마지막 항목 삭제 후 초점 소실·표 병합 라디오 그룹 이름/중복 ID를 수정하고 해당 조건을 재검증했다. 관련 회귀31개 및 수정 후7개 재검사, FE 타입/lint/build 통과. 저장 요청0·AI 호출0/gpt-6-luna 유지. 월/연 전체 조합·다른 차트 전체 속성·휴대폰 OS 선택창·VoiceOver는 남으며 DESIGN-04 부분 완료와 기존130개 집계를 유지한다.

2026-10-13 제작 네이티브 선택 메뉴 후속: [builder-native-select.md](builder-native-select.md). 기존 SSBI-14의 native popup BLOCKED를 실제 CUA 키 입력으로 선택 변형에 한해 해소했다.1440/390 소스·지표·집계/열·숫자 표시·차트/차원 선택과 Escape 취소를 확인했다. 조회 중 소스 disabled로 초점이 BODY에 빠지는 오류를 수정하고 지연 조회·완료 초점 및 최신 응답 유지 회귀를 확인했다. 관련 FE35개·타입/lint/build 통과, 저장 요청0·AI 호출0/gpt-6-luna 유지. VoiceOver BLOCKED·전체 부분 완료·기존130개 집계는 유지한다.

2026-10-13 인증·설정 복구 후 VoiceOver 재시도: [detail-large-screenreader.md](detail-large-screenreader.md). 사용자 확인 후 AppleScript 제어 체크상자0을 네이티브 도구로 확인해 복구 완료로 기록했다. 중복된 빈 검증 앱을 정리해 dashboard23의1391572행 상세 화면 연결은 해결했다. 실제 VoiceOver 앱 연결은 timeoutReached, OS 프로세스 조회는 -10827로 발화·읽기 순서 DETAIL-SR-02는 BLOCKED 유지다. 임시 인증파일·전용 창 정리, 제품 변경0/AI 호출0/gpt-6-luna 유지, 기존 통과 반복 없음.

2026-10-13 상세 선택창 대비 후속: [detail-large-screenreader.md](detail-large-screenreader.md). 자동 미판정1건은 유지하면서 실제 선택값·레이블의 white 배경 대비16.07/5.74/6.72:1과 텍스트 가림 없음을 관찰해 해당 텍스트만 선택 PASS로 보완했다. desktop Enter/Escape·mobile ArrowDown/Enter의50행 선택도 확인했다. 사용자 권한 허용 후 VoiceOver 프로세스는 발견됐지만 창 접근·발화 읽기(-1728)와 CUA/Orca 연결은 실패해 실제 발화 BLOCKED를 유지한다. 제품 변경0·모델 호출0, 기존 수치·E2E 통과 반복 없음.

2026-10-13 원본 상세 로딩 안내 후속: [detail-large-screenreader.md](detail-large-screenreader.md)의 DETAIL-SR-01 미확인 로딩 조건을 보완했다. 동일 atomic/live 상태 영역에서 조회 중 페이지·행 수와 완료 안내를 갱신한다.390px 최초 조회·1440px 페이지 이동·503 후 Enter 재시도와 Escape 초점 복귀를 선택 검증했다. 실제 발화는 BLOCKED, 완료 화면 axe는 오류0/미판정1로 남긴다. 기존 수치·E2E 통과 조건 반복 없음, gpt-6-luna 유지·모델 호출0.

2026-10-13 대용량 원본 상세·스크린리더 후속: [detail-large-screenreader.md](detail-large-screenreader.md). Rill 1391572행의 전체·현재/이전 주 시점 page0/1·25만/100만 offset 100행을 원본 Parquet 정답과 대조했다. 초기 UI 1.095초·나머지 API 0.216~0.765초/응답 최대64653bytes,390px 25/100행 AX·이전 문맥/페이지/오류 복구와 axe 3화면 오류0은 선택 PASS다. 실제 VoiceOver는 OS 보조 접근/도구 창 연결 실패로 BLOCKED이며 DOM/axe로 발화를 대체하지 않는다. DESIGN-04 부분 완료·기존130개 집계 유지, 모델 호출0/gpt-6-luna 유지·제품 코드 변경0이다. 페이지10000 상한·전체 deadline/abort 전파·동시 부하는 운영 잔여로 보존한다.

2026-10-13 이전 기간 시점 상세 후속: [previous-point-contributors.md](previous-point-contributors.md). 이전 KPI 추세·안전한 시간 차트의 실제 표시 시점 입력을 현재 필터/기간을 바꾸지 않고 조회한다. 같은 주 시작의 현재40/1행과 이전190/5행, NULL SUM0행/분모 전용1행·정밀 UTC 교집합을 분리했다. 실제 API16조건/거부11조건·1440/390·키보드·정의409 복구가 선택 PASS다.503 재시도에서 초점 소실/Escape 실패를 발견해 수정 후 해당 조건만 재검증했다. PREV-INPUT-01~04 선택 변형 PASS, 모델 호출0/gpt-6-luna 유지. 아래 과거 기록의 이전 시점 상세 잔여를 보강했으며 복잡한 SQL·대용량 상세/VoiceOver·전체 출시 회귀는 남아 있다. 기존130개 카탈로그 집계는 유지한다.

2026-10-13 KPI 미니 추세 시점 후속: [kpi-point-contributors.md](kpi-point-contributors.md). 실제 표시한 시간·일·주·월 시점의 집계 입력을 공통 필터/기간 변경 없이 탐색한다. NULL 결과의 빈 SUM과 분모 전용 가중 입력을 구분하고 표시 시점 목록·정의·파일 버전을 확인한다. 독립 정답 API14조건/거부10조건, 실제1440/390·방향키/Tab/Enter/Space/초점·503 fixture/실제409 복구를 확인했다. KPI-INPUT-01~04 선택 변형 PASS, 기존 MD 통과 반복 없음, 모델 호출0/gpt-6-luna 유지. 아래 이전 기록의 KPI 현재 추세 시점 잔여는 이 후속으로 보강했다. 이전 기간 상세·복잡한 SQL·대용량 성능·VoiceOver는 남아 있으며 기존130개 집계는 유지한다.

2026-10-13 집계 입력 행 후속: [aggregate-contributors.md](aggregate-contributors.md). 저장된 차트 SQL의 WHERE·집계별 NULL/COUNT 조건·현재 표시 그룹과 공통 필터/기간을 결합해 실제 입력 원본 행을 탐색한다. 비율/가중 지표는 행별 집계 구성요소를 구분하며 그룹 집합·정의·파일 버전을 고정한다. 13행 oracle의17조건, 실제1440/390·Enter/Space/Tab/스크롤/초점 복귀·정의409/검증용503 복구를 확인했다. SQL 괄호 오인 및 TOP N 그룹 불일치 위험을 수정했다. CONTRIB-01~06 선택 변형 PASS, 기존 MD 통과는 반복하지 않았으며 모델 호출0/gpt-6-luna 유지. SSBI-05의 안전하게 지원하는 위젯별 기여 상세는 구현됐고 KPI 미니 추세 시점/이전 기간 상세·복잡한 SQL·대규모 성능·VoiceOver는 남아 있다. 기존 카탈로그130개 집계는 유지한다.

2026-10-13 시간 버킷 선택 후속: [time-bucket-drilldown.md](time-bucket-drilldown.md). 서버가 확인한 UTC 시간·일·주·월을 클릭/키보드/터치로 공통 기간에 적용하고 현재 범위 교집합·기간 되돌리기·정밀도 저장/재조회·원본 행을 검증했다. 8행 oracle의7조건, 실제40/이전30·일70/이전2·부분 주150/월80·390폭·503 복구가 일치한다. UTC adapter 및 타날짜컬럼 필터 확대 오류를 수정했다. TIME-01~06 선택 변형 PASS, 모델 호출0/gpt-6-luna 유지. SSBI-05의 위젯 기여 내역/고급 탐색·대규모 상세 성능·VoiceOver는 남아 있다. 기존 MD 통과는 반복하지 않았다.

2026-10-13 차원 클릭·원본 상세 후속: [dimension-drilldown.md](dimension-drilldown.md). channel 막대/키보드→공통 필터·현재30/이전10·원본1행, NULL+지역 AND, 61행 페이지25/25/11·390폭 내부 스크롤, 400/403/409·503 fixture 복구·정의 보존의 새 조건을 선택 검증했다. 키보드 초점·특수 컬럼 값·모바일 라벨을 수정했다. SSBI-05 전체의 시간 버킷 클릭·위젯별 기여 행·대규모 상세 성능/VoiceOver는 남아 부분 완료이며 기존 통과를 반복/재집계하지 않는다. gpt-6-luna 유지·실제 모델 호출0.

2026-10-13 이전 기간 비교·일/주/월 후속: [period-comparison-grain.md](period-comparison-grain.md). 같은 필터/파일 snapshot의50↔10/+40/+400%, UTC 일/주/월 원본 재집계·보기 저장/reload·390/1440·키보드·NULL/0·상위 N/정밀도 경고·503 fixture 복구의 선택 조건 PASS. 신규 BE180+FE28와 관련 기존12개만 확인했다. SSBI-06 전체는 업무 시간대/전년·Commerce 날짜 의미/이전 선 겹침·VoiceOver가 남아 부분 완료이며 기존130개 집계와 분리한다. gpt-6-luna 유지·실제 모델 호출0.

2026-10-13 개인 저장 보기 후속: [personal-saved-views.md](personal-saved-views.md). 절대/상대기간·다중 필터·숫자 표시의 저장/복원/삭제, 오류 복구·계정 차단·실제21동시 한도·모바일/키보드 선택 조건 PASS. 신규 BE26+FE27 통과. SSBI-09 전체는 지표/정렬 선택·팀 보기·MySQL 실통합/VoiceOver가 남아 부분 완료이며 기존130개 집계와 분리한다.

[파일 교체·버전 복원](file-versions.md): SSBI-10 선택 VERSION-01~08을 검증했다. source24/metric30/dashboard26 정의·배치 유지, 독립 합계60→220→60·차원/날짜 캐시 갱신, 같은 파일 no-op(재수입0),400/403/409·CAS·최대5개·진행 중 조회 버전 고정 확인. 모바일 표/상단축 잘림 보정 및 Tab/Enter 확인. 자동 매핑/의미·장기 보존/전역 quota/crash 복구·VoiceOver는 남아 전체 SSBI는 부분 완료다. 기존130개 집계 유지, gpt-6-luna 유지·모델 호출0.

[가중 평균·합계 비율 후속](advanced-metrics.md): SSBI-03의 선택 조건 ADV-01~04를 보완했다. Rill 전체 평균5.571238676523254·독립 정답 대조, 정상 가중17.5/15%·NULL/0·음수 정책·정의/snapshot 저장·재조회·모바일/Enter 확인. 차트 표NaN을 수정·재검증했다. 원격/통화/임의식/파일 교체·VoiceOver는 남아 전체 SSBI는 부분 완료다. gpt-6-luna 유지·모델 호출0.

[139만 행 구조화 제작 후속](structured-rill-large.md): 새 소스 프로파일·저장 SUM/COUNT·3차트 편집·저장/reload·9기기 정답·snapshot 및 1440/390 화면을 확인했다. LARGE-01~03 PASS(모바일 숫자 축 밀집 수정 후 재검증). LARGE-04는 AVG와 Rill 가중 공식 구분만 PASS이며 구조화 가중 지표는 미구현이다. SSBI 전체의 부분 완료와 기존130개 집계 유지, gpt-6-luna 유지·AI 호출0.

[여러 지표·차트 편집](dashboard-chart-editor.md)의 SSBI-08 신규 조건 EDIT-01~09 PASS. 한 DuckDB 소스의 1~6개 차트 추가·표현/크기/순서·저장/reload·SQL/삭제 정의 보존·409·503 복구와 1440/390 실제 키보드를 검증했다. 재조회 크기 배열 오류와 삭제 후 초점 소실을 수정·재검증했다. 원격/다중 소스·제작 필터/고급 지표·VoiceOver는 남아 전체 SSBI-08/14는 부분 완료이며 기존 카탈로그 집계는 유지한다. gpt-6-luna 유지, AI 호출 0.

[SQL 없는 제작 2A](self-service-builder.md)의 새 DuckDB 프로파일·기본 6집계·정의 snapshot·숫자/막대/선 저장·내 파일 연결·503 복구는 선택 조건 PASS. 1440/390 화면과 Tab/입력/Enter도 확인했다. native select popup 자동화는 BLOCKED, VoiceOver는 NOT_RUN이며 SSBI-02/03/08/14 전체는 부분 완료다. 기존 130개 카탈로그 집계를 늘리지 않는다. AI 호출 0, gpt-6-luna 유지.

2026-10-13 후속: [개인 소스 소유권](source-ownership.md)의 기존 API/계보/공유 선택 조건은 수정·재검증 PASS. 저장 보기 요청의 소유권 재검사는 personal-saved-views.md 후속으로 확인했다. SSBI-04 전체는 팀 권한/전체 SaaS 운영 감사와 실제 legacy owner 배정이 남아 부분 완료다.

아래는 수정 전 발견 기록이다. 신규 SSBI-04 권한 계약은 [단계0 감사](../strategy/2026-10-13-self-service-contract-audit.md)에서 일반 source/metric/preview 계정 간 접근을 재현해 미해결 FAIL로 기록했다. 기존 단일 인스턴스 카탈로그130개 완료 집계를 새 개인 소유 격리 완료로 해석하지 않는다. 다음 보강은 일반 API 전체의 owner/참조 검사와 명시적 legacy migration이다.

셀프서비스 BI1A 신규 조건은 [self-service-onboarding.md](self-service-onboarding.md)에 별도 기록했다. 샘플37주문 실제 DuckDB 집계·재조회, 내 파일 진입/가져오기,503 재시도, 모바일·키보드가 선택 조건 PASS다. SSBI-01/02/11/14 전체 계획 완료로 확대하지 않고 기존130개 집계는 유지한다. AI 호출0, gpt-6-luna 설정 유지.

DESIGN-04 별도 색상 입력은 [color-adapters-keyboard.md](color-adapters-keyboard.md)에 추가했다. 중복 선택창3개를 통합하고 색상 입력 이름·불변 업데이트·빠른 입력 누락을 수정했다. 선형/히트맵/복합 차트의 적용·취소·포커스·390폭과 회귀5개를 검증했다. 실제 VoiceOver와 다른 전체 경로는 남아 있어129완료/1부분 완료 집계를 유지한다.

DESIGN-04 색상 선택창은 [color-picker-keyboard.md](color-picker-keyboard.md)에 추가했다. HEX 입력 중 조기 닫힘·preset 역할/Space 선택을 수정하고21개 Tab·적용/취소·모바일·한영과 회귀4개를 검증했다. 실제 VoiceOver 재시도는 런타임/창 선택 제약으로 BLOCKED 유지다.

DESIGN-04 날짜 입력 후속은 [commerce-keyboard.md](commerce-keyboard.md)의 후속 기록에 추가했다. native 미완성 날짜의 전체 기간 오조회·입력 오류 연결·조회 중 포커스 소실을 수정하고 실제 키보드/중복 차단/모바일을 재검증했다. VoiceOver·native 팝업 등은 미검증으로 유지한다.

DESIGN-04의 매출·환불 화면은 [commerce-keyboard.md](commerce-keyboard.md)에 추가했다. 일별 정확값 표·이름 있는 표 스크롤 영역·AI 초기 포커스를 보완하고 1,096행 표시/방향키·대화상자 순환·모바일을 검증했다. 실제 VoiceOver와 날짜 입력 전체 경로 등은 미검증이므로 부분 완료 집계를 유지한다.

DESIGN-04의 위젯 생성은 [widget-keyboard.md](widget-keyboard.md)에 추가했다. 타입50개 카드 진입·선택 상태, 숫자판15개 Tab 경로, 공통 폼 이름과 색상 팝업 구조를 수정·재검증했다. 저장 취소·데이터 보존과 모바일을 확인했으며, 다른 차트 속성 전체·VoiceOver는 남아 있어 부분 완료 유지다.

DESIGN-04의 메트릭 화면은 [metric-keyboard.md](metric-keyboard.md)에서 Select/아이콘 이름·모바일 입력 배치를 수정했다. 실제 9개 Tab 순환·입력 취소·포커스 복귀·평가 결과 region과 데이터 보존을 확인했다. VoiceOver 및 다른 화면 전체 경로는 남아 있어 부분 완료 유지다.

DESIGN-04의 소스·데이터셋 폼 키보드 경로는 [data-forms-keyboard.md](data-forms-keyboard.md)에 추가했다. 타입 카드·SQL 편집기 이름/탈출 경로·같은 타입의 입력 보존을 수정하고 실제 키보드 조회/취소·한영·모바일을 확인했다. VoiceOver와 다른 화면의 전체 경로는 남아 있어 부분 완료 유지다.

Node 24·AI SDK 7 통합 검사와 DESIGN-04 데이터 화면 키보드 경로를 [node24-integration.md](node24-integration.md)에 추가했다. 전체 단위 599개·루트 빌드 통과, 데이터 카드 선택·아이콘 이름·미리보기 대화상자를 수정·재검증했다. VoiceOver와 다른 화면 전체 경로는 남아 있어 집계는 129완료/1부분 완료 유지다.

Assistant 저장 충돌·실행 중단의 ASSISTANT-06~07을 [assistant-reliability.md](assistant-reliability.md)에 추가했다. 실제 오래된 적용/되돌리기409, 중단 시 요청의 Codex 프로세스 종료, 실제 모델 후속 응답 복구와 모바일 안내를 확인했다. 신규2개 완료로 현재130개(129완료/1부분 완료)다.

우측 Assistant·AI SDK7·Node24의 ASSISTANT-01~05를 [dashboard-assistant.md](dashboard-assistant.md)에 추가했다. 실제 모델 질문/수정/적용/되돌리기와 필터·모바일·장애 안내 후 복구를 확인했다. 신규5개 완료로 고유ID는128개(127완료/1부분 완료)다. 기존 완료 케이스는 관련 변경이 없는 결과를 재사용했다.

숫자 KPI의 전체/축약(K/M/B/T) 전환·원래 값 유지·설정 영속·모바일 검증을 [compact-kpi.md](compact-kpi.md)에 추가했다. DESIGN-02·03/WIDGET-03의 신규 조건이며 당시 고유 ID 집계는122완료/1부분 완료였다.

신규 매출·환불 MVP의 COMMERCE-01~08은 `fd583392`에 커밋했고 [상세 결과](sales-refund-mvp.md)를 추가했다. 이후 [인증 잔여 조건](auth-remaining.md)에서 AUTH-01/05/06을 완료했다. Assistant 추가 전 집계는 기존115개+신규8개=123개다. 매출·환불 CSV 모델/첫 대시보드는 구현됐고, 외부 API·주기 수집·상품별 환불 배분·다중 통화는 후속 범위다.

기준 브랜치 `develop-v2`, 기록 기준 커밋 `3ecc67ba`. INGEST-04 직렬화 검증 기록은 이 커밋에 반영했다. 이 문서는 기존 실행 증빙을 감사한 결과이며 제품 테스트·브라우저·모델 호출을 재실행하지 않았다.

완료는 **해당 MD에 명시한 한정 조건의 증빙이 모인 경우**다. 부분 완료는 일부 조건 통과, 기록 누락 또는 관련 구현 변경으로 이전 결과만 재사용할 수 없는 경우다. 미검증은 적합한 실행 증빙을 찾지 못한 경우이며, 과거에 한 번도 실행되지 않았다고 단정하지 않는다. 과거 보고서의 NOT_RUN/BLOCKED는 후속 증빙이 있는 조건에 한해 해소했다.

기본 E2E의 500행 sales 정답(298250/60550)과 MD의 3행 oracle(500)을 혼용하지 않는다. 고정 HTTP AI fixture는 모델 품질 증명이 아니다. 실AI 검증은 현재 Codex `gpt-6-luna` 연결 증빙으로 판정하며 설정은 변경하지 않았다.

| 범위                                  | 완료 | 부분 완료 | 미검증 | 합계 |
| ------------------------------------- | ---: | --------: | -----: | ---: |
| cases.md                              |  102 |         0 |      0 |  102 |
| 서버 DuckDB + 디자인/필터/AI 대시보드 |   12 |         1 |      0 |   13 |
| COMMERCE-01~08                        |    8 |         0 |      0 |    8 |
| ASSISTANT-01~07                       |    7 |         0 |      0 |    7 |
| 전체                                  |  129 |         1 |      0 |  130 |

집계 단위는 고유 MD ID다. 단위 테스트 수·변형 수·스크린샷 수와 다르다. 과거 통과를 현재 전체 출시 회귀 완료로 확대하지 않으며, 관련 변경이 없는 결과만 재사용한다. DATA-04~07의 결과 JSON은 남았지만 상세 HTTP 원본 일부가 덮어써진 기록 한계도 보존한다.

## 기본 기능 102개

| ID             | 상태 | 확인 범위 / 남은 조건                                                                                                                                                            | 증빙                                              |
| -------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| AUTH-01        | 완료 | 기존 dashboard·unknown 결과 재사용. root/widget/data/source/dataset/metric/file 및 신규 commerce의 14경로 실제 로그인 전환, 보호 API 요청0.                                      | [core], [authremaining]                           |
| AUTH-02        | 완료 | 초기 missing/malformed/tampered와 후속 expired/AI 계열 증빙 합산.                                                                                                                | [post], [security]                                |
| AUTH-03        | 완료 | 필수누락4종+약한 암호/불일치/이메일: 안내·가입요청0·계정 미생성.                                                                                                                 | [auth], [authai]                                  |
| AUTH-04        | 완료 | 신규 가입·로그인·숫자가 로드된 온보딩.                                                                                                                                           | [post]                                            |
| AUTH-05        | 완료 | ID/이메일 각각409·화면 안내. 가입 시도 전후 19테이블 행 수/해시 동일, 원 계정 로그인201 및 기존 매출·환불 조회200. 동시 중복 가입은 이 순차 명세 밖.                             | [authremaining]                                   |
| AUTH-06        | 완료 | 기존 잘못된 암호 결과 재사용. unknown 실제 UI401·오류 안내·토큰/쿠키 부재, 같은 화면 정상 계정 로그인 복구.                                                                      | [core], [authremaining]                           |
| AUTH-07        | 완료 | 로그인·프로필 reload와 올바른 userinfo/password 미노출 합산.                                                                                                                     | [post], [auth]                                    |
| AUTH-08        | 완료 | 실제 refresh cookie 유무별 만료 토큰 복구/로그인 이동.                                                                                                                           | [security]                                        |
| AUTH-09        | 완료 | 실제 refresh cookie 유무별 만료 토큰 복구/로그인 이동.                                                                                                                           | [security]                                        |
| AUTH-10        | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구.                                                                                                                    | [authnav]                                         |
| AUTH-11        | 완료 | 잘못된 현재 암호는 보존, 정상 수정은 새 로그인·재조회 확인.                                                                                                                      | [profile]                                         |
| AUTH-12        | 완료 | 잘못된 현재 암호는 보존, 정상 수정은 새 로그인·재조회 확인.                                                                                                                      | [profile]                                         |
| AUTH-13        | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구.                                                                                                                    | [authnav]                                         |
| AUTH-14        | 완료 | 로그아웃·쿠키 철회, 삭제 전후 계정 상태, 손상 저장 JSON 복구.                                                                                                                    | [authnav]                                         |
| FILE-01        | 완료 | 동일 oracle 브라우저3행6열/500 증빙 재사용, 현재 집계 CSV 실제 다운로드·파싱으로 total500 정확 일치.                                                                             | [fileduck], [oraclecreate]                        |
| FILE-02        | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구.                                                                                                                                       | [post]                                            |
| FILE-03        | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구.                                                                                                                                       | [post]                                            |
| FILE-04        | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열.                                                                                                                        | [files]                                           |
| FILE-05        | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구.                                                                                                                                       | [post]                                            |
| FILE-06        | 완료 | 3행/500 및 쿼리 오류·빈 결과 후 정상 복구.                                                                                                                                       | [post]                                            |
| FILE-07        | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열.                                                                                                                        | [files]                                           |
| FILE-08        | 완료 | bar/line/pie, CSV 실제 다운로드 원값, BIGINT 정확 문자열.                                                                                                                        | [files]                                           |
| FILE-09        | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구.                                                                                                                                     | [bound]                                           |
| FILE-10        | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구.                                                                                                                                     | [bound]                                           |
| FILE-11        | 완료 | 교체·특수 파일명·잘못된 형식 UI 오류와 복구.                                                                                                                                     | [bound]                                           |
| FILE-12        | 완료 | 실제 WASM 바이너리 차단 시 초기화 무응답 수정. Worker 오류/15초 제한, 실제 오류 안내→서버3행 저장/500→차단 제거·SPA 이동 후 브라우저3행/500 복구. JS 로더 모듈 장애는 별도 범위. | [fileduck]                                        |
| FILE-13        | 완료 | 현재 서버 DuckDB CSV/JSON/Parquet 각각3행 원값·500, metadata SQLite 유지.                                                                                                        | [fileduck]                                        |
| FILE-14        | 완료 | 현재 DuckDB missing/empty/header-only/malformed JSON/scalar array/corrupt Parquet 각각400·소스 목록 동일.                                                                        | [fileduck]                                        |
| FILE-15        | 완료 | .txt 업로드400·소스 미생성.                                                                                                                                                      | [fileduck]                                        |
| FILE-16        | 완료 | BOM/CRLF/quoted comma·newline·escaped quote 원값 그대로 조회.                                                                                                                    | [fileduck]                                        |
| FILE-17        | 완료 | sanitized collisions/duplicate raw headers/대소문자/숫자/Unicode 7열 이름 유일·원값 모두 보존.                                                                                   | [fileduck]                                        |
| FILE-18        | 완료 | heterogeneous JSON 4열 union·missing/null 및 원값 보존.                                                                                                                          | [fileduck]                                        |
| FILE-19        | 완료 | CSV100001 전체 저장·집계, Parquet1391572 기존 결과 합산.                                                                                                                         | [data], [ingest]                                  |
| FILE-20        | 완료 | 4096바이트 설정/4097 업로드413·목록불변·후속health200 및 UI 복구.                                                                                                                | [data03]                                          |
| DATA-01        | 완료 | 실제 SQLite 연결 폼 저장/reload, 실패 후 유효 연결 복구.                                                                                                                         | [profile]                                         |
| DATA-02        | 완료 | 실제 SQLite 연결 폼 저장/reload, 실패 후 유효 연결 복구.                                                                                                                         | [profile]                                         |
| DATA-03        | 완료 | SQLite 풀 초기화 후 같은 ID 연결 교체: 결과500→600.                                                                                                                              | [data03]                                          |
| DATA-04        | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음.                                                                  | [data]                                            |
| DATA-05        | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음.                                                                  | [data]                                            |
| DATA-06        | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음.                                                                  | [data]                                            |
| DATA-07        | 완료 | ID20경로/원값·CTE·빈쿼리/쓰기·다중문장 거절/오류 후500. 결과 JSON 보존, 상세 HTTP 원본 일부 덮어쓰기 한계 있음.                                                                  | [data]                                            |
| DATA-08        | 완료 | 실제 SCRAM 암호 PostgreSQL의 생성/목록/info/detail/수정 응답 비노출, uploaded_data 및 합계500. 생성 응답 암호·credential URL 노출 수정, 관련 회귀4개 PASS.                       | [data], [boundaries]                              |
| SET-01         | 완료 | UI 업로드→500→저장, source/query/title 재조회.                                                                                                                                   | [post]                                            |
| SET-02         | 완료 | 수정/reload 및 invalid query/required title 저장 차단.                                                                                                                           | [major]                                           |
| SET-03         | 완료 | 수정/reload 및 invalid query/required title 저장 차단.                                                                                                                           | [major]                                           |
| SET-04         | 완료 | CRUD/invalid update 보존과 후속 deleted/missing detail/update/delete 합산.                                                                                                       | [major], [profile]                                |
| SET-05         | 완료 | CRUD/invalid update 보존과 후속 deleted/missing detail/update/delete 합산.                                                                                                       | [major], [profile]                                |
| SET-06         | 완료 | 의존 위젯 처리 후 대시보드 계속 사용 가능.                                                                                                                                       | [widget]                                          |
| METRIC-01      | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답.                                                                                                                                         | [post]                                            |
| METRIC-02      | 완료 | 필수/중복/취소 및 활성 목록 보존.                                                                                                                                                | [profile]                                         |
| METRIC-03      | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답.                                                                                                                                         | [post]                                            |
| METRIC-04      | 완료 | 실제 UI CRUD/500, 6집계/2그룹 독립 정답.                                                                                                                                         | [post]                                            |
| METRIC-05      | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250.                                                                                                            | [metric]                                          |
| METRIC-06      | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250.                                                                                                            | [metric]                                          |
| METRIC-07      | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250.                                                                                                            | [metric]                                          |
| METRIC-08      | 완료 | 필터7/거절5/수정 보존, 재생성 optional 잔존 수정 후 동일ID·활성1·250.                                                                                                            | [metric]                                          |
| METRIC-09      | 완료 | missing 및 deleted 평가 거절 합산.                                                                                                                                               | [major], [profile]                                |
| WIDGET-01      | 완료 | 실제 oracle 소스15/amount/sum/숫자판 신규 저장201, 위젯104 fresh GET 및 reload500·option 동일.                                                                                   | [oraclecreate]                                    |
| WIDGET-02      | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인.                                                                                                                                | [major]                                           |
| WIDGET-03      | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인.                                                                                                                                | [major]                                           |
| WIDGET-04      | 완료 | 필수/뒤로/취소, 옵션 수정/reload, 삭제 취소/확인.                                                                                                                                | [major]                                           |
| WIDGET-05      | 완료 | TABLE/DATASET CRUD, 옵션 파싱 및 무관 위젯 보존.                                                                                                                                 | [widget]                                          |
| WIDGET-06      | 완료 | 52개 enabled component 각각 한 명시적 fixture. 실패 차트 수정 후 재검증 포함; 모든 옵션/모바일/디자인 품질 검증은 아님.                                                          | [widget], [chart]                                 |
| WIDGET-07      | 완료 | missing/소스 삭제 오류와 정상500 화면 복귀.                                                                                                                                      | [authnav]                                         |
| DASH-01        | 완료 | 위젯104로 신규 대시보드6 UI 생성201, fresh GET/reload 제목500·widget ID/layout 동일.                                                                                             | [oraclecreate]                                    |
| DASH-02        | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절.                                                                                                                             | [major]                                           |
| DASH-03        | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절.                                                                                                                             | [major]                                           |
| DASH-04        | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절.                                                                                                                             | [major]                                           |
| DASH-05        | 완료 | title-only 보존+목록 격리+삭제시 mapping/widget/share 청소 합산.                                                                                                                 | [major], [dash]                                   |
| DASH-06        | 완료 | 제목·위젯·배치 영속/삭제 취소·확인/타계정5행동 거절.                                                                                                                             | [major]                                           |
| DASH-07        | 완료 | unknown/deleted URL 제어된 오류 및 private 내용 부재.                                                                                                                            | [authnav]                                         |
| DASH-08        | 완료 | UI 템플릿 생성·선택 위젯1회 매핑/배치/reload500.                                                                                                                                 | [nav]                                             |
| SHARE-01       | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회.                                                                                                                         | [post]                                            |
| SHARE-02       | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회.                                                                                                                         | [post]                                            |
| SHARE-03       | 완료 | 실제 공유 설정/reload·익명 share/embed500·OFF 즉시 철회.                                                                                                                         | [post]                                            |
| SHARE-04       | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단.                                                                                                                  | [security]                                        |
| SHARE-05       | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단.                                                                                                                  | [security]                                        |
| SHARE-06       | 완료 | 만료/없는/삭제/날짜 경계 및 철회 토큰 읽기·쓰기·다른 보드 차단.                                                                                                                  | [security]                                        |
| SHARE-07       | 완료 | 실제 clipboard exact 링크/iframe, 거절 주입 피드백; 후속 embed overflow 재검증.                                                                                                  | [authnav], [bound]                                |
| TEMPLATE-01    | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증.                                                                                                 | [authnav]                                         |
| TEMPLATE-02    | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증.                                                                                                 | [authnav]                                         |
| TEMPLATE-03    | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증.                                                                                                 | [authnav]                                         |
| AI-01          | 완료 | 설정 없음/빈·2001자/nonpositive ID 제어 오류, 외부 호출 없음.                                                                                                                    | [authai]                                          |
| AI-02          | 완료 | 실제 HTTP 고정 fixture→Nest→SQLite500; 쓰기/다중문장 거절 및 원본3행 보존.                                                                                                       | [provider]                                        |
| AI-03          | 완료 | 실제 HTTP 고정 fixture→Nest→SQLite500; 쓰기/다중문장 거절 및 원본3행 보존.                                                                                                       | [provider]                                        |
| AI-04          | 완료 | HTTP503/빈content/잘못된JSON ERROR→정상 복구, 별도 고정 provider.                                                                                                                | [recovery]                                        |
| AI-05          | 완료 | 실Luna 등록차트와 고정 provider unknown/invalidJSON 거절·등록차트 UI 복구 합산.                                                                                                  | [authai], [recommend]                             |
| AI-06          | 완료 | 빈/missing 거절과 정상 고정 literal API·UI 합산.                                                                                                                                 | [authai], [literal]                               |
| AI-07          | 완료 | 실제 고정 provider literal/오류/복구 UI 및 별도 실Luna 복구. mock과 실모델 구분.                                                                                                 | [recovery], [literal]                             |
| AI-08          | 완료 | 실제 고정 provider literal/오류/복구 UI 및 별도 실Luna 복구. mock과 실모델 구분.                                                                                                 | [recovery], [literal]                             |
| RELIABILITY-01 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| RELIABILITY-02 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| RELIABILITY-03 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| RELIABILITY-04 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| RELIABILITY-05 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| RELIABILITY-06 | 완료 | 로컬 명세의 socket/cache/429/network/정상재시작/손상소스 복구. 강제 crash·운영 SLA 증거는 아님.                                                                                  | [security]                                        |
| NAV-01         | 완료 | 한/영 전환·reload 언어 지속.                                                                                                                                                     | [authnav]                                         |
| NAV-02         | 완료 | 390/768 대표 화면 조작, back/forward/deep link/reload/404 복구.                                                                                                                  | [nav]                                             |
| NAV-03         | 완료 | 390/768 대표 화면 조작, back/forward/deep link/reload/404 복구.                                                                                                                  | [nav]                                             |
| NAV-04         | 완료 | 기존 source/dataset/widget/AI 취소 재사용. 일반 dashboard 생성·편집 각각 취소/메뉴 이동4조건: 쓰기요청0·목록/상세 동일·reload 원 제목/위젯/layout/500.                           | [authnav], [major], [filtererrors], [dashunsaved] |
| COMPONENT-01   | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증.                                                                                                 | [authnav]                                         |
| COMPONENT-02   | 완료 | CRUD/추천 매핑/잘못된 값 제어; component duplicate409/missing404 수정 후 재검증.                                                                                                 | [authnav]                                         |

## 서버·디자인 추가 명세 13개

| ID          | 상태      | 확인 범위 / 남은 조건                                                                                                                                                                                  | 증빙                                              |
| ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| INGEST-01   | 완료      | 1391572행 실제 UI 저장/manifest/engine DuckDB·메타데이터 유지.                                                                                                                                         | [ingest]                                          |
| INGEST-02   | 완료      | 전체 요청634513000/가중평균/9기기 정답 및 정상 재시작 후 동일.                                                                                                                                         | [ingest]                                          |
| INGEST-03   | 완료      | 실제 UI 생성·9개 값/순서·reload 지속.                                                                                                                                                                  | [ingest]                                          |
| INGEST-04   | 완료      | 기존 제한/timeout/quota 복구+실worker query3개→remove 순서·API 단일경합·정상42. MD가 제외한 stress/전역quota/강제crash는 미검증.                                                                       | [ingest], [serial]                                |
| DESIGN-01   | 완료      | 기존 Luna 정답 재사용. 현재 All time 동일 질문의 Rill 정확9개/요청/평균·설명·최종 AI 차트 대조. 원본 날짜 이동은 별도.                                                                                 | [luna], [designfinal]                             |
| DESIGN-02   | 완료      | 실제 Luna 저장 완료 화면의2KPI·USD2자리·9개 이름/0축/전체 폭·기간/필터·작은값 표, Rill 완료 차트/답변 비교.                                                                                            | [luna], [designfinal]                             |
| DESIGN-03   | 완료      | 동일 수정문 Rill 조회/편집 AI 실행 및 reload, 기존 VM/필터 증빙 합산. Rill 즉시 파일 쓰기와 VM 명시저장/취소 차이 기록; UX 동일성은 아님.                                                              | [filters], [luna], [designfinal]                  |
| DESIGN-04   | 부분 완료 | 기존 모바일/키보드 선택 재사용. 대시보드/헤더 이름 누락 수정·한영/Enter·controls 대상/390폭 검증. 대비·대상 화면 키보드·대화상자·169행 추세 표 보완. 실제 VoiceOver 발화/다른 화면 전체 키보드 미검증. | [luna], [designfinal], [kpia11y]                  |
| FILTER-01   | 완료      | 기존 수치/초기화/바인딩/역순/503 복구 재사용. 타계정 analysis/필터preview/save/draft 실제403, 원 초안·자산5테이블 해시 동일, 실제 UI 차단.                                                             | [filters], [filtererrors], [boundaries]           |
| FILTER-02   | 완료      | 138055400/평균4.633939385003283±1e-9/2기기 정답, VM desktop/mobile·Rill desktop·UTC 경계·역순/부분 입력. Rill 모바일/기간 비교/필터 지속은 추가 범위.                                                  | [date], [filtererrors]                            |
| AI-DASH-01  | 완료      | 기존 Luna 생성/수정/저장/취소/오류 합산. Rill 동일 수정문 실행 비교 및 복제DB 별도 미설정 실API ERROR→UI 저장차단·5자산테이블 불변.                                                                    | [luna], [filtererrors], [aierrors], [designfinal] |
| AI-DASH-02  | 완료      | 실Chromium390 필터/AI편집 취소/KPI/긴 이름/표/overflow 없음. 기존 모바일 실행의 로컬 모델 기록은 역사적 UI 증거로만 재사용; 실AI 성공 근거는 Luna 별도.                                                | [filters], [date]                                 |
| AI-AGENT-01 | 완료      | 실제 모델 연결 실패→명시 URL/catalog 수정→같은 질문 생성/정답. timeout/빈출력 경계는 해당 하위 회귀; 다른 모델 fallback 없음.                                                                          | [date], [luna]                                    |

## 남은 작업 우선순위

1. **P0 — 이번 선택 범위 완료.** DATA-08 실제 암호 연결 응답과 FILTER-01 신규 필터 API 타계정 차단을 보완했다. AUTH-01/05/06을 포함해 관련 변경 없이 반복하지 않는다. 전체 커넥터/테넌트 보안 감사 완료를 뜻하지 않는다.
2. **P1 — 현재 DuckDB 수집 경로 완료.** FILE-12~18 잔여 조건을 보완했다. INGEST-01~04/FILE-19·20과 함께 관련 변경 없으면 반복하지 않는다. 느린 기기의 15초 초기화 한도와 JS 로더 모듈 배포 장애는 별도 운영 범위다.
3. **기본 MD 102개 완료.** FILE-01·WIDGET-01·DASH-01의 신규 생성·export와 [NAV-04 미저장 취소/이동](dashboard-unsaved.md)까지 보완했다. 관련 변경이 없으면 반복하지 않는다. 전체 출시 회귀나 운영 준비 완료를 뜻하지 않는다.
4. **P1 — DESIGN-04 접근성 잔여 조건.** 최종 AI 차트/설명·동일 수정 질문 Rill 비교·실제 미설정 조건은 [후속 비교](design-final-audit.md)에서 보완했다. 버튼 이름 누락도 수정했다. 추세·대비·대상 화면 키보드는 [후속 기록](kpi-trends-accessibility.md)으로 보완했다. 실제 VoiceOver 발화·읽기 순서와 다른 화면 전체 키보드 경로가 남았다. 제품 간 UX 차이를 동일성 PASS로 확대하지 않는다.
5. **운영 파일럿 전 P1 / 다중 사용자 확장 전 P2.** 아래 별도 운영 범위를 정의하고 필요한 최소 검사를 시행한다. 전체 MD 통과와 운영 준비는 다른 판정이다.

## 현재 MD 밖의 운영·제품 작업

- 백업과 복원(메타데이터 암호화 키 포함), 운영 메타데이터 마이그레이션, 강제 프로세스 종료/미완료 import/임시 파일 정리의 복구 검증. RELIABILITY-05 정상 재시작은 강제 crash를 입증하지 않는다.
- 다중 사용자 동시 query/delete stress, 전체 디스크 quota/용량 관찰, 테넌트 권한 설계와 보존·삭제 정책. INGEST-04는 명세상 이 범위를 제외하며 미구현·미검증을 통과로 처리하지 않는다.
- 외부 API 커넥터·주기 수집·재시도/중복방지는 추가 제품 범위다. 주문·환불 CSV 모델과 첫 대시보드는 COMMERCE-01~08에서 Analytics Engineering 자료로 검증했다. 기존 광고 경매 샘플과 별도 증빙이다.
- Oracle/ODBC 실연결, pnpm 설치·배포, 출시용 전체 회귀는 별도 미검증 범위다. 매 개발마다 실행하는 항목으로 만들지 않는다.

## 증빙 참조

각 기록 안의 JSON/PNG/최초 실패 및 재검증 기록이 원본이다. 증빙은 저장소 밖에 있으며 이 문서에는 인증정보를 복사하지 않는다. 과거 보고서의 당시 미커밋/미설정 상태는 당시 기록으로 보존한다.

[core]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/hybrid-cleanup/result.md
[post]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/post-merge/result.md
[major]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-major/result.md
[profile]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-profile-source/result.md
[files]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-files/result.md
[nav]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-navigation-template/result.md
[security]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-security-recovery/report.md
[authnav]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-auth-navigation/report.md
[bound]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-file-boundaries/report.md
[widget]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-widget-dependencies/REPORT.md
[chart]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-charts/REPORT.md
[metric]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-metric/RESULTS.md
[data]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-data/RESULTS.md
[data03]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data03-file20/RESULTS.md
[dash]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-dashboard-cleanup/RESULTS.md
[auth]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-completion/RESULTS.md
[authai]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-ai/RESULTS.md
[recovery]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-recovery/RESULTS.md
[provider]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-provider-db/RESULTS.md
[literal]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-ui-contracts/RESULTS.md
[recommend]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-chart-contract/RESULTS.md
[ingest]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/server-duckdb-1391572/RESULTS.md
[serial]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ingest-serialization/RESULTS.md
[design]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/design-rill-parity-improved/RESULTS.md
[rill]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/design-rill-parity/RESULTS.md
[filters]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-common-filters/RESULTS.md
[date]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/date-multi-filters/RESULTS.md
[luna]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/codex-luna-connection/RESULTS.md
[filtererrors]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-ai-filter/RESULTS.md
[aierrors]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/remaining-ai-errors/RESULTS.md
[authremaining]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-remaining-2026-10-12/RESULTS.md
[boundaries]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/data-filter-boundary/RESULTS.md
[fileduck]: /Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-duckdb-boundaries/RESULTS.md
[oraclecreate]: oracle-create-export.md
[dashunsaved]: dashboard-unsaved.md
[designfinal]: design-final-audit.md
[kpia11y]: kpi-trends-accessibility.md

2026-10-14 Rill 도입 1차: [KPI 비교 추세 겹쳐 보기](kpi-comparison-overlay.md). UTC 일별·동일 기간 길이의 공통 축/시작점 정렬·NULL 구간·고립 점을 구현했다. 관련31개 + 기존 원본 조회174개 회귀, FE 타입/변경 lint/build 통과. Aside 고정 입력 화면 확인이며 실제 preview/원본 XHR·390px 모바일/VoiceOver는 미실행이다. SSBI 전체 완료로 확대하지 않는다.

2026-10-14 KPI 겹쳐 보기 후속: 실제 파일 업로드/SQL 없는 제작으로 source3/metric1/dashboard2를 준비했다. preview201 현재30/이전100/−70/−70%, 이전01-01 원본100과 현재01-05 원본10의 실제 details201 확인. Aside390×844 iframe viewport 가로 overflow 없음·범례/카드 가시성 확인. 임시 응답 관찰 코드는 원복, 인증 헤더/토큰 저장 없음. [상세 증빙](kpi-comparison-overlay.md). 전체 키보드/VoiceOver·실기기 터치는 미검증.

2026-10-14 업무 시간대 날짜 기반: [선택 검증](business-timezone.md). IANA/KST→UTC 반개구간·DST23/25시간·이전 달력 기간·상대 날짜·실제 DuckDB 경계 행/합계와 기존 UTC 회귀243개 통과, BE build/변경lint 통과. 공개 API/버킷/저장 보기/Assistant/UI/XHR 연결은 NOT_RUN이며 시간대 제품 기능 완료 아님.

2026-10-14 시간대 저장 연결 후속: 명시적 시간대가 최근 기간 계산 결과에서 누락되는 문제와 새 preview 테스트 경로를 수정했다. FE 관련123개·BE 관련151개, FE 타입/관련lint·BE build/관련lint PASS. KST 개인 보기 서비스 저장·재조회 PASS. Aside는 실행/탭 연결 확인됐으나 실제 화면은 오류 대화상자, 로컬 검증 계정 로그인 최초 HTTP500은 서버 환경 복원 뒤 HTTP201로 복구했다. Aside 폼 로그인은 실패 안내를 표시해 실제 화면/XHR 저장 재조회 BLOCKED. 지역 일·주·월 추이 버킷도 미지원이다. [상세 범위](business-timezone.md).

2026-10-14 KST 실제 화면/XHR: CORS 검증 origin을 복원해 Aside 폼 로그인 PASS. 기존 source3의 암호화 설정은 보존하고 별도 source4/dashboard3을 만들었다. 실제 KST preview30/직전1099/−1069, 개인 보기POST201→새로고침→GET200→preview201 재조회, 원본details201 두 행10/20을 화면과 XHR로 검증했다. 임시 관찰 코드 원복 확인. 상대 기간 화면·지역 추이 버킷·기존 source3 키 복구는 여전히 미완료. [증빙](business-timezone.md).

2026-10-14 KPI 지역 추이 후속: 기존 구현을 확인하고 실제 DuckDB KST/DST 일·주·월 관련52개, FE 관련45개 및 타입 검사 PASS. Aside dashboard3 저장 보기 불러오기→일/주/월 표시·합계30/이전1099 유지 PASS_SELECTED_VARIANTS. 새 브라우저 응답 수집은 빈 배열이어서 XHR 증빙 NOT_RUN. 일반 라인 재집계·지역 추이 선택/기여 행·지역 비교 겹쳐 보기 미지원. [상세](business-timezone.md).

2026-10-14 지역 KPI 시점 선택/기여 행: DST 지역 버킷 경계·필터 범위 clipping, FE timezone 유지, canonical 그룹 재검증과 현재/이전 기여 행 연결. 실제 KST Aside/XHR 현재10/20·이전100/999, 시점 선택 preview201 timezone/반개구간/30 유지 PASS_SELECTED_VARIANTS. BE regional-query23/선택75/기존contributor68 및 FE 관련 회귀·타입/lint·BE build 통과. DATE열 선택/일반라인/지역겹쳐보기 미지원. [상세](business-timezone.md).

2026-10-14 Rill 동적 탐색 첫 단위: 저장 Measure/Dimension 선택·검색 다중값필터·기간/시간대/비교·차원 순위·원본 페이지를 `/explore/source`에 연결했다. Rill 원본1391572행의3조건 독립정답/실API, Aside실화면/다중필터/비교/XHR,390px iframe 선택검증 PASS. 비교는 전체집계JOIN후LIMIT로 이전순위밖값 누락을 방지한다. [범위/증빙/차이](rill-exploration.md). Pivot·숫자범위·변화정렬·탐색보기저장/내보내기·전체접근성·운영부하는후속이며 이번통과로확대하지않는다.

## 2026-10-14 신규 작업공간의 동일 예제 제작 비교

[Rill cold start](rill-cold-start.md)의 COLD-01~05를 별도 사용자 여정으로 추가했다. 기존 102개/추가 명세 완료 집계를 다시 계산하지 않았다. 같은 139만행 Parquet와 생성·수정문으로 VM/Rill 새 프로젝트를 비교했다. VM 생성·수정·저장·재조회 및 정확값 대조 완료. Rill 최초 계산식/기간 불일치를 추가 AI 질문으로 보완한 뒤 화면 비교;9개 원시값 전체 UI 추출은 미실행. 파일→AI 경로·저장후이동·KPI를밀어내던 보조영역을 즉시 수정하고 모바일·선택 키보드 재검증했다. 실제 VoiceOver 차단과 전체출시회귀 미실행을 유지한다. 새 브랜치 변경이며 develop-v2 병합/커밋으로 보고하지 않는다.

## 2026-10-14 최신 통합 코드와 작업 diff 재검증

기준 `791ec485`(로컬 origin/develop-v2와 동일) + `codex/self-service-next-20261014` 현재 diff. [실행 결과](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/develop-v2-reverify-20261014/RESULTS.md). 최신 BE로 검증 API를 재시작했다. BE71suite/1108개·FE45파일/693개, BE/FE빌드·FE타입·lint오류0(기존경고33) PASS. 영향받는 핵심 E2E4개 중 CSV브라우저분석2개는 워크트리 심볼릭링크의WASM MIME오류로 최초FAIL→Vite preserveSymlinks/React dedupe 수정→실패한2개만 재실행PASS. 정식설정에서FE693개/타입/설정lint/build도PASS, 임시설정제거.

COLD-02~05 선택조건: 같은1391572행으로 실제gpt-6-luna 생성→dashboard6저장/새로고침→Assistant제목수정/적용/재조회PASS. 634513000/5.5712386765 및9기기 독립정답일치, 제목외SQL/표현설정불변. EXPLORE-01/02/08 선택조건: 저장지표1 생성·전체→Mobile/Tablet 키보드필터→원본307763000/710193행, 실제XHR·화면PASS. dashboard/explore390px에서scrollWidth390, AI/Assistant/접힘영역/차원·원본선택키보드PASS. 캡처는외부실행폴더. 모바일필터바의긴배치/탐색KPI축약표시 미연결은UX잔여로기록. 기존통과전조건·전체출시QA·Rill전체·실기기터치 반복안함, 실제VoiceOverBLOCKED유지. 수정/기록은미커밋워크트리이며develop-v2병합/푸시로보고하지않는다.

2026-10-14 Pivot 저장·CSV: PIVOT-06~08 PASS_SELECTED_VARIANTS. [명세/범위](explore-pivot.md). 실제 다운로드 정수 exact, 비율1e-9·저장/새로고침복원·390px/Tab/Enter 확인. VoiceOver BLOCKED/gpt-6-luna 유지.

2026-10-14 PIVOT-DASH-01~04 PASS_SELECTED_VARIANTS: 저장 Pivot 대시보드스냅샷·App공통필터·날짜override·390px키보드/디자인. [상세](dashboard-pivot.md). gpt-6-luna/VoiceOver차단유지.

2026-10-14 PIVOT-DASH-03 정의 불일치 후속: 전체409로 제거 경로가 사라지는 오류 수정→Aside1440/Chromium390·Enter 제거/재조회 PASS. 기존 QA snapshot 원복. 정의 편집·재추가 전체 여정/혼합목록 UI는 NOT_RUN. [상세](dashboard-pivot.md#2026-10-14-정의-변경-복구-후속). gpt-6-luna 및 VoiceOver BLOCKED 유지.

2026-10-14 PIVOT-DASH-03/04 후속: 실제 지표 정의 label fixture 변경→버전 불일치 안내→새 보기 저장·대시보드 재추가·오류/정상 혼합표시·기존 오류카드 Enter 제거·재조회 PASS. 긴 제목390px overflow0/레이블·정렬 PASS. 원 설정 복구/생성보기 정리. [상세](dashboard-pivot.md#2026-10-14-정의-갱신재추가-및-긴-제목-후속). 필터 제한/timestamp 경고 UI NOT_RUN, VoiceOver BLOCKED.

2026-10-14 PIVOT-DASH-02/04 경고 후속: 합성6필터·timestamp 기간 경고/요청0/CSV차단·Enter 초기화복구·390px 디자인 PASS. 잘못된 중지 안내를 원인별로 수정. [상세](dashboard-pivot.md#2026-10-14-합성-필터timestamp-경고-후속). Pivot 연결 명세 잔여 변형 해소; VoiceOver/실기기touch 및 지표편집UI는 제외 범위 유지.

2026-10-14 PIVOT-03/06/07/08 후속: 두 행축 실제저장/재조회·28열 중12열 표시·CSV범위/숨겨진4344800 전체합포함·390px Enter복원/내보내기 PASS. 새결함0/보기정리. [상세](explore-pivot.md#2026-10-14-두-행축-복원12열-초과-후속). 지연소스교체UI·운영부하·실기기touch/VoiceOver 잔여유지.

## 2026-10-14 지연 응답·소스 전환 후속

PIVOT-04 **PASS_SELECTED_VARIANTS**: 실제headed1440/390에서 source3 Pivot 응답을 보류→source4(지표0) 전환→늦은 응답 해제. 기존 요청 취소/늦은 응답 후 source4 표 없음·CSV 차단, source3 복귀 새201/정상표 PASS. 지연 중 저장/CSV차단·Pivot Enter 조작·문서overflow0 및 캡처 디자인 확인 PASS. source4 기존 연결 암호화키가 현재 서버와 달라 같은 Rill source3 설정을 임시 차용했고 원본 정확히 복구/백업삭제. 지표있는 두 소스의 경쟁응답/취소불가transport는 NOT_RUN; 취소 및 빈소스격리 범위만 통과. CSV다운로드·전체Tab·실기기·운영동시부하 재실행안함, VoiceOverBLOCKED/gpt-6-luna유지. 새제품수정0, 이전단위/빌드재사용. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-stale-20261014/RESULTS.md`, `ui-results.json`, `pending-*.png`, `source4-*.png`, `recovered-*.png`. 미커밋.

## 2026-10-14 지표 있는 두 소스 경쟁 응답 후속

PIVOT-04 **PASS_SELECTED_VARIANTS**: bca84b2b 기준, 동일 Rill1391572행 source3/4·각2지표. source3 실제Pivot응답 보류→source4 카탈로그/Pivot201·표 표시→이전응답 해제 후 새표/소스 유지 PASS(1440/390). 기존 요청은 브라우저에서 취소됨; 취소불가transport 검증으로 확대하지 않는다. 지연중 저장/CSV차단·새결과 저장가능·Enter CSV다운로드 PASS. 실제CSV 지표ID3/4만 포함·총요청634513000 exact·비율새응답±1e-9 PASS. 문서overflow0/컨트롤배치·모바일표내스크롤 캡처검토 PASS.

source4 원본연결은 현서버 암호화키와 달라 config백업/동일source3 연결임시차용, 신규검증지표3/4만추가. 실행뒤 정확히삭제·원본config복구/백업삭제. 기존지표·저장보기변경없음. 새제품오류/수정0, 기존단위/빌드/Rill대조재사용. 신규항목만검증; VoiceOverBLOCKED·gpt-6-luna유지/모델호출0. 운영동시부하·실기기touch/취소불가transport NOT_RUN. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-race-20261014/RESULTS.md`, `ui-results.json`, `csv-results.json`, `source4-1440.png`, `source4-390.png`.

## PIVOT-09 — 운영 동시 부하의 로컬 선택 검증 (2026-10-14)

- 입력: 같은 Rill1391572행 source3·지표1/2·행device_type/열app_or_site. 4개 필터정답(전체634513000/MobileTablet307763000/PC173308000/ConnectedTV27207600)을 교차 배치해4·8·16·24개 HTTP요청 동시 실행.
- 기대: 성공응답의 조건/정답/revision 혼선없음,50×12상한유지. 큐포화시 controlled503 busy, 무관한500·client timeout없음, 종료후 정상조회복구. 실제브라우저 오류/재시도도 확인. 운영SLA는 별도정의하며 측정값으로 통과기준을 사후발명하지 않는다.
- 결과 **PASS_SELECTED_VARIANTS**: 4/8/16은 전부201,24는17성공/7큐busy503. 52요청중45성공·모든성공정답일치,4개후속복구201. p95 351/688/1653/1767ms; 복구93~113ms. API peakRSS302.5MiB(300ms표본, 누수판정아님). 실제32부하중브라우저503→표제거/CSV차단→Enter재시도201/표복구 캡처PASS. 제품변경0·기존빌드/단위/Rill/모바일전체반복없음.
- 범위: 단일로컬서버/같은QA사용자의 독립요청; 다중tenant·지속부하·실운영하드웨어·혼합import/write·multi-replica·crash복구 NOT_RUN.16은측정지점이며보장사용자한도아님. VoiceOverBLOCKED·gpt-6-luna유지/호출0.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-load-20261014/RESULTS.md`, `results.json`, `browser-results.json`, `busy-desktop.png`, `recovered-desktop.png`.


PIVOT-10 **PASS_SELECTED_VARIANTS** (2026-10-14): 기본요청제한120회/60초 유지·8클라이언트·실측181.4초·455요청중183성공201/272제한429. 성공183건 모두4개필터정답·지표/revision·50×12상한일치,500/전송실패/timeout0. 성공응답p95=595ms. RSS1초표본peak347.0MiB/종료45.9MiB, 장시간누수판정아님. 제한해제뒤정상복구201/154ms, 총복구관찰20.2초는15초idle포함. 실제1440px429 표없음/CSV차단→수정한요청제한안내·부하종료정상표/634513000/pageerror0/overflow0 캡처PASS. 일반오류만보이던429안내를명확히수정, 새선택단위1PASS(8skip)·FEtype/lint/build PASS.

초기helper는429를503로가정해중단→기존보호동작을그대로반영해재실행. 이실행은rate limit에따른대기포함이며3분내내worker포화검증이아니다. 무제한worker지속포화·장시간soak·다중사용자/tenant·운영하드웨어·혼합write/import·multi-replica/crash NOT_RUN. 기존단발부하·통과UI/Rill전체반복없음. gpt-6-luna/VoiceOverBLOCKED 유지. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-sustained-20261014/RESULTS.md`, `results.json`, `during-desktop.png`, `after-desktop.png`.


## PIVOT-DASH-05 — 여러 Pivot 중복 조회 최적화 (2026-10-14)

동일소스/기간/필터/지표/축의 저장Pivot을 UI에서같은대시보드에2개추가해3카드로측정. 기대: 동일진행중요청1개공유·서로다른조건분리·필터변경새조회·한카드취소가형제조회취소않음·완료결과캐시않음.

**PASS_SELECTED_VARIANTS**: 초기실제POST3→1(66.7%감소), 모든카드56663800. App열키보드Enter공통필터추가후추가POST1회·모든카드18363600, 저장bid_floor범위/기간유지.1440/390캡처디자인확인·모바일문서overflow0/표내부포커스ArrowRight PASS. 신규요청풀대시보드mount범위/동일semantic key, 마지막구독자만취소, 완료/실패즉시제거; 값같은filterobject재렌더추가조회0. 관련단위14+신규rerender1·FEtype/lint/build PASS. 생성attachment정확한ID2개씩정리/원카드유지. 제품diff미커밋.

완료결과캐시/다른조건쿼리통합/빠른연속필터debounce는추가하지않았다. 별도대시보드/사용자전역공유없음. 전체Tab·실기기touch/VoiceOver미실행/차단유지. gpt-6-luna유지/호출0, 기존통과전체반복없음. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-dedup-20261014/RESULTS.md`, `before-results.json`, `after-results.json`, `after-desktop.png`, `after-mobile.png`.


## PIVOT-DASH-06 — 빠른 필터 변경 최종 조회 (2026-10-14)

기준3d8c3a87+diff. 대시보드Pivot만최종필터250ms대기(초기/축/재시도즉시). 동일조건pending공유·완료캐시없음유지. 공통analysispause시예약취소/마지막제출필터비교유지. 초기화가조회중disabled여서키보드입력무시오류발견→busy조건제거·최종재검증.

**PASS_SELECTED_VARIANTS**: UI동일Pivot2개추가해3카드,1440/390에서App열Enter→초기화Enter(327/211ms)·Pivot추가요청각1회/최종App없음·모든카드56663800 exact. 데스크톱은250ms초과지만공통조회pause가중간예약취소; 모바일은250ms내. 신규단위빠른Mobile→Tablet최종1조회/대기표·CSV차단/unmount예약취소 PASS. 관련Pivot+DashboardAnalysis50PASS·FEtype/lint/build PASS. 모바일overflow0/캡처레이아웃/폰트/표내스크롤확인. 생성카드정확ID정리·원카드보존.

공통AIpreview·독립Explore조회는변경없음(전체요청최적화로확대않음). 기존마지막제출필터로복귀시즉시조회; 다른필터변경은250ms대기. FullTab·실기기/VoiceOverNOT_RUN/BLOCKED. gpt-6-luna유지/호출0. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-filter-debounce-20261014/RESULTS.md`, `rapid-results.json`, `after-results.json`, `rapid-1440.png`, `rapid-390.png`. 이번후속변경미커밋,이전중복조회3d8c3a87커밋/push완료.


## CHART-FILTER-01 — 공통 차트 연속 필터 최종 조회 (2026-10-14)

입력: dashboard/2, Rill auction_data 1,391,572행, 전체 기간에서 device_type Mobile/Tablet → Personal Computer를 250ms 이내 추가 선택. 1440×1000 및 390×844에서 Enter로 선택창 열기, Space로 두 옵션 선택, Escape로 닫기, Enter로 초기화.
기대: /ai/dashboard-preview는 최종 두 값을 담은 1건만 전송, 원본 합계 481,071,000(307,763,000 + 173,308,000), 조회 중 선택창은 계속 사용 가능하고 이전 차트의 상세 탐색은 차단. 페이지 가로 넘침 없음, 포커스 표시 유지.
결과 PASS_SELECTED_VARIANTS: 데스크톱 204ms/모바일 172ms 두 변경 각각 1요청; 두 화면 정확한 합계 481071000, 독립 DuckDB Parquet 계산 일치. 초기화 복귀 및 화면 확인. 관련 단위 39 PASS, FE 타입/변경 파일 lint PASS. 이전 응답은 serial로 무시하고 cleanup에서 AbortController 및 대기 timer 취소. HTTP 취소는 서버 실행 중 SQL 중단 보장이 아님. 최초조회·기간·집계·명시적 새로고침은 즉시 실행; 차원 선택창 필터만 250ms 대기. 전체 Tab/VoiceOver/실기기 touch NOT_RUN 또는 기존 BLOCKED 유지. gpt-6-luna 설정 변경/호출 없음. 이미 완료한 기능 MD 반복 없음.
증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/chart-filter-debounce-20261014/`의 results.json, oracle.json, chart-1440.png, chart-390.png. 일시 검증 스크립트는 저장소 밖 보관.
이전 Pivot 최적화는 ed66a773 커밋·push, 이번 공통 차트 변경은 후속 작업으로 분리.


## 2026-10-14 취소불가 응답·진행 중 필터 변경 후속

기준 `6d88eb80`(drumcap으로 현재 워크트리 브랜치 커밋·push 완료). PIVOT-04 잔여 취소불가 transport 변형은 단위 수준에서 PASS_SELECTED_VARIANTS: 동일 shared pool에서 source3 요청을 취소 신호를 무시하는 Promise로 보류하고 source4/revision/지표3·4 조회를 완료한 뒤 이전 성공 또는 오류를 반환했다. 최신 전체합계123456789·CSV활성·오류없음·pool정리 유지. 실제 네트워크가 취소를 무시하는 환경까지 검증한 것은 아니다.

CHART-FILTER-02: 공통 차트 조회 중 재선택 및 늦은 성공/오류. 단위 2조건 PASS: 첫 Mobile/Tablet 요청이 이미 제출된 뒤 true 추가 선택→최신42 표시→취소 무시 이전999/오류 도착해도42 유지. 기존 단위 재실행 대신 신규4개만 선택 실행(4 PASS/51 skipped). 최초 Pivot 검사 fixture가 열 없는 표의 숨겨진 전체합계를 찾고 정상 범위안내 alert를 오류로 오인해 실패했으며 검사 fixture/판정만 수정했다. 제품 오류/코드 수정 없음.

실제 headed Chromium 1440×1000/390×844에서는 Rill source3/dashboard2 첫 Mobile/Tablet 실제 API 응답307763000을 route.fetch 후 보류→키보드 Space로 Personal Computer 추가→최종481071000·상세활성→이전 응답 해제 후 최신 결과 유지 PASS. 진행 중 옵션 선택 가능, Escape/Enter/Space 경로 및 문서overflow0, 포커스·레이블·테마·줄바꿈 캡처 확인. 브라우저의 이전 요청은 취소되므로 이 화면 검증을 취소불가 transport 증명으로 확대하지 않는다. 원본 파일/지표/대시보드 저장내용 변경 없음, 필터 초기화로 종료.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/chart-inflight-20261014/`의 results.json, pending-1440.png, pending-390.png, final-1440.png, final-390.png, selected-tests.log. 기존 빌드 재사용(제품 변경 없음); FE 타입/변경 검사 lint 통과. 전체통과 MD 반복 없음. gpt-6-luna 설정 유지/호출0. VoiceOver BLOCKED·실기기touch·다중tenant/혼합write/import·장시간운영soak는 미검증 유지. 이번 후속 검사/기록은 미커밋.


## DESIGN-DASH-01 — 대시보드 버튼·필터 룩앤필 (2026-10-14)

사용자 제공 1440px 화면을 기준으로 공통 차트 분석 영역과 대시보드 헤더만 변경. 버튼 대문자 변환 제거, 8px 반경/13px 글꼴, 헤더36px·모바일40px, 아이콘36px 터치영역 통일. 보조 외곽선은 중립색, 공유/Assistant는 브랜드색으로 강조. 필터 칩은 12px·32px, 값 타입은 접근성 이름에 보존하고 화면에는 컬럼/값만 표시. 조회 상태는 보조 문구로 낮췄다. 기간 패널은 흰색 배경/헤더 구분선/정렬된 차원·날짜·집계 그룹으로 재배치하고 모바일은 한 열로 표시. 카드 원본 행 동작은 테두리 없는 보조 버튼으로 정리. 전역 테마·데이터·집계·AI 설정은 변경하지 않음.

기대: 1440×1000/390×844, 필터 두 값의 긴 이름에서도 버튼/레이블이 사라지지 않음·문서overflow0·설정 접힘/펼침·키보드 Enter/Space/Escape 유지. 기존 토큰/브랜드색 안에서 버튼/입력/간격 계층을 정리.
결과 PASS_SELECTED_VARIANTS: headed Chromium 1440/390 두 상태 캡처 직접 검토, 문서scrollWidth=viewport, 키보드 선택창 열기/닫기 PASS. Aside 기존 탭에서도 최신 DOM/명칭 확인. Aside 절대경로 캡처는 세션 디렉터리 제한으로 저장되지 않아 Chromium 캡처를 증빙으로 사용. 타입·변경 파일 lint·FE build·diffcheck PASS. 단순 스타일 변경이므로 기존 숫자/SQL/통과 전체 테스트 재실행하지 않음. 실제 VoiceOver/실기기 touch/전체Tab 미검증 또는 차단 유지. gpt-6-luna 유지/호출0.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-design-20261014/`의 updated-1440.png, updated-390.png(펼침), overview-1440.png, overview-390.png(접힘), results.json, build.log. 이전 화면은 chart-inflight-20261014/final-1440.png. 이번 디자인 수정과 MD는 미커밋. 앞선 미커밋 경합 검증 기록/테스트는 그대로 보존.


## 2026-10-14 EXP-VIEW-05 실제 파일 갱신·복원 후속

기준 `3537adee`, 제품 변경 없음. 기존 Rill139만행 소스3/저장보기1은 변경하지 않고 별도 CSV 소스/category·amount·ordered_at, SUM(amount) 지표와 저장 보기를 생성했다. 작은 고정 oracle 두 행10+20=30, 같은 스키마 새 파일 세 행40+60+80=180으로 최신 파일 게시와 보기 복원만 선택 검증.

**PASS_SELECTED_VARIANTS**: 실제 multipart file-replacement201 후 data/sourceRevision 변경·viewRevision 불변, 기존 저장보기GET200/설정동일, 최신query201 합계180/3행. 실제 1440×1000·390×844에서 Enter로 저장보기 복원180·새로고침 후 재복원180. 이전 파일 버전 file-restore201 후 같은 보기30/2행 복원. 모바일 문서overflow0·키보드 초점/Enter·숫자/레이블/패널 캡처 확인.

컬럼 amount→revenue 변경 파일은 실제 file-replacement400, 기존 파일 revision/버전·저장설정 유지. 이는 지원되는 교체 정책의 스키마 변경 거부 PASS이며, 스키마가 강제로 변경된 후 view409/stale삭제HTTP까지 검증한 것은 아니다. 현재 스키마 변경은 새 소스로 연결해야 한다. 컬럼 변경 거부의 실제 UI 안내는 이번 실행 NOT_RUN(API만 확인).

임시소스8/9/10·보기8/9/10은 API 삭제 후 DB없음 확인, 신규지표5/6/7은 정상 DELETE의 useYn=N 비활성화 확인. 기존 소스·지표·보기 수정 없음. 첫 브라우저 검사는 버튼 접근성 이름의 '보기' 누락으로 timeout, helper 수정 후 통과; 첫 모바일 캡처는 재조회 중 상태여서 완료 대기·KPI보이는 화면으로 교체했다. 제품 결함/수정0. 기존 단위/빌드 재사용·문서diffcheck만 수행. 전용 API/FE는 기존 격리 환경 설정으로 재기동, gpt-6-luna 유지/AI호출0. VoiceOver BLOCKED·실기기touch/전체Tab은 그대로.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-file-refresh-20261014/`의 api-results.json, ui-results.json, restored-desktop.png, restored-mobile.png, rollback-mobile.png, verify.cjs. DB 정리확인에서 metric은 soft-delete 의미로 해석한다. 이번 검증 기록은 미커밋. 다음 우선 조건은 EXP-VIEW-04 다른 사용자/공유토큰 실제 HTTP, EXP-VIEW-06 목록503·소스교체 경합이다.


## 2026-10-14 EXP-VIEW-04 다른 사용자·공유토큰 HTTP 후속

기준 `3537adee` + 권한 안내 수정. Rill source3의 기존 보기1/지표/파일은 변경하지 않고 임시 개인 보기·다른 사용자 DB fixture·빈 공유 대시보드 생성. 다른 사용자는 서버 사용자 행+정상 해시+실제 signin으로 인증(가입/온보딩 검증 아님). 공유토큰은 소유자가 임시 대시보드에 실제 share-on201→공유조회200을 호출해 활성 토큰 확인, 저장보기/원본 데이터는 공유 대시보드에 포함하지 않음.

**PASS_SELECTED_VARIANTS** 실제 HTTP16조건: 목록GET/보기GET/생성POST/삭제DELETE 각4조건 × 다른사용자Authorization403·유효한Authorization-Url공유토큰403·공유토큰을일반Authorization으로전달401·익명401. 소유자의 보기GET200/원state/이름보존. 403/401 응답만 확인하고 저장 데이터가 실제 유지되는지 소유자GET으로 별도검사. 다른소스ID변형/MySQL다중서버통합은 미실행.

실제1440×900/390×844 다른 사용자 source3 진입→catalog403·KPI/저장보기 노출없음 PASS. 최초 UI는 권한거부에도 일반분석실패/카탈로그재시도를 권해 UX FAIL, SourceExplore가403을 구분하여 '접근할 권한이 없습니다'와 '다른 데이터 소스 선택'을 제공하도록 수정. 수정후 두화면 안내/재시도없음·모바일Enter선택→권한오류해제/본인저장데이터없음 안내·overflow0 PASS. 신규403단위1+기존일반실패재시도1=2PASS/21skip, 타입·변경lint·FEbuild·diffcheckPASS. HTTP16은 UI수정후재실행하지않고 이전 통과 결과 재사용. UI는 캡처 직접검토.

초기helper의 긴임시ID가5~19자로그인규칙을넘어요청이안나옴/고정대시보드이동가정 timeout, 짧은영숫자ID 및 signin201기준으로 수정. 정상빈데이터안내alert를 오류로오인한검사도 권한오류텍스트에한정해 수정. 제품인증코드를 우회한 것은 아니며 실제로그인으로 검증. 임시보기/대시보드/공유행/사용자/해당refresh행 정리, cleanup.json의temporaryUsers/Views/Dashboards=0·기존보기1있음확인. 인증정보/토큰은출력·증빙저장없음.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-access-20261014/`의 results.json(16조건), before-1440.png/before-390.png, denied-1440.png/denied-390.png(수정후), recovered-390.png, cleanup.json, build.log. 이번 제품수정/기록 미커밋. gpt-6-luna설정유지/호출0·VoiceOverBLOCKED유지. 다음 미검증은 EXP-VIEW-06 목록503·탐색보기지연중소스교체 UI.


## 2026-10-14 EXP-VIEW-06 목록503·복원중 소스교체 UI 후속

기준 `3537adee` + 이전 권한안내 미커밋diff, 이번 제품수정0. Rill source3/view1/user2 및 신규 CSV 소스(두 행200+300=500)·SUM지표만 생성. 원파일·지표·보기는 변경하지 않음.

**PASS_SELECTED_VARIANTS** 실제headed1440×1000/390×844: 저장보기목록GET에503 fixture 주입→목록오류/불러오기없음·현재634513000 유지→route해제/Enter목록재시도→실제GET200/원보기목록복구·현재조건불변. 이어 view1실제GET200 응답을 route.fetch후보류→Enter복원중버튼잠금→데이터소스native선택으로새소스전환→합계500/새지표/차원category 표시→이전응답해제후새소스500유지·옛보기노출없음. 브라우저 requestfailed로 이전복원요청취소 관찰. actualtransport취소불가 증명은 아니며 해당단위검증기록과 구분.

두뷰포트 document.scrollWidth=width·오류/복구/소스전환캡처 직접검토, 이름/버튼/폰트/포커스/패널 줄바꿈 PASS. native소스선택은 selectOption으로 조작했으며 OS방향키전체 경로/실기기터치는 미실행, 목록재시도와복원은Enter. 503은실제장애발생이아닌브라우저응답주입이다. 저장/삭제/AI기존통과조건재실행없음. 제품변경없어기존단위/빌드재사용·문서diffcheck. gpt-6-luna설정유지/호출0·VoiceOverBLOCKED유지.

임시소스API삭제/임시지표DELETE useYn=N 확인, cleanup.json temporarySources=0/activeTemporaryMetrics=0/기존보기1유지. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-list-race-20261014/` results.json, list503-1440.png/list503-390.png, list-recovered-1440.png/list-recovered-390.png, source-switched-1440.png/source-switched-390.png, cleanup.json. 기록미커밋. EXP-VIEW-06의목록503·탐색endpoint복원지연중소스교체선택조건해소; 전체조건조합/MySQL운영/VoiceOver등은완료로확대하지않음.


## 2026-10-14 EXP-VIEW-03 혼합필터·빈차원 실제 저장 후속

기준 `3537adee` + 이전권한안내diff, 이번제품변경0. source3/user2/Rill1391572행의 device_type=Mobile/Tablet 값필터 + bid_floor1..10 숫자범위, 전체기간·주별·차원[]·지표순서[2,1]·순위지표1/value asc를 임시보기로 준비→실제화면에서복원→새이름으로현재보기POST201저장→전체새로고침후재복원. 첫준비만APIfixture, 최종저장은실제UI Enter 요청/state로 확인.

**PASS_SELECTED_VARIANTS**1440×1000/390×844: POSTstate원본과동일·지표순서[2,1]/빈차원[]/값+범위타입·경계/날짜null/주집계 유지, 실제복원query201 요청[2,1]·leaderboards[]·요청수119028600 exact/평균입찰가2.8735833247140867(독립Parquet±1e-9). 원본SQL은동일필터의 SUM(bid_request_cnt),SUM(bid_floor)/SUM(has_bid_floor_cnt),COUNT(*)로직접계산. 화면표시119M/$2.87과순서확인, 문서overflow0·Enter저장/복원·패널접기·포커스/필터칩줄바꿈 캡처검토. 원본날짜/불완전날짜조건은기존하위검증재사용.

첫helper는reload초기조회중비활성복원버튼에Enter를보내응답timeout. 제품오류로세지않고button enabled를기다린뒤재검증PASS. 기존파일/지표/기본보기1변경없음, 생성보기만DELETE후cleanup temporaryViews=0/primaryViewPresent=1 확인. 제품수정없어기존단위/빌드재사용·문서diffcheck. gpt-6-luna유지/호출0·VoiceOverBLOCKED/실기기터치/전체Tab미검증유지.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-mixed-empty-20261014/` oracle.json/results.json, saved-1440.png, restored-1440.png/restored-390.png, cleanup.json. 이번기록미커밋. 혼합값+범위·빈차원의실제저장/재조회선택변형해소이며모든상태조합으로확대하지않음.


## 2026-10-14 EXP-VIEW-05 컬럼명 교체 거부 실제 화면 후속

기준 `3537adee` + 이전권한안내diff, 이번제품수정0. VERSION-03의이미통과타입/JSON등전체조건은반복하지않고, 컬럼명변경후개인저장보기유지와실제안내를새로연결검증. 별도category/amount/ordered_at CSV2행·SUM(amount)·임시보기의정답30을준비.

**PASS_SELECTED_VARIANTS** 실제1440×1000/390×844지표빌더파일버전화면: hiddenfileinput에amount→revenue파일선택→Enter교체POST400→'컬럼 이름 또는 타입이 기존 파일과 다릅니다. 기존 데이터는 유지됩니다…' 실제안내·같은형식수정/새소스연결지침 표시. file-versions revision 불변, 탐색저장보기Enter복원30유지. 두문서overflow0·안내줄바꿈·파일이름/보존버전표·컨트롤캡처직접검토.

390px에서빌더다시열기→정상same-schema3행40+60+80파일선택→Enter교체201→탐색기존보기복원180/3행 PASS. 이는빌더재진입후정상파일재시도이며, 같은오류컴포넌트세션내재선택전체경로·OS네이티브파일대화상자·실기기터치는미검증. 파일선택은Playwright setInputFiles, 교체/복원은Enter. UI저장기능/이전파일복원전체는재실행않음. 강제로스키마변경후stale뷰409/삭제는별도미검증이고지원정책은스키마변경게시거부.

기존Rill소스/보기/지표변경없음, 이번생성소스/보기를API삭제·지표비활성화. cleanup temporarySources/Views=0·primaryViewPresent=1 확인. 제품변경없어기존단위/빌드재사용·문서diffcheck. gpt-6-luna유지/호출0·VoiceOverBLOCKED유지. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-schema-ui-20261014/` results.json, schema-denied-1440.png/schema-denied-390.png, recovered-390.png, cleanup.json. 기록미커밋.


## DESIGN-EXPLORE-01 — 지표 탐색 모바일 룩앤필 (2026-10-14)

사용자제공390px race-destination-qa 화면기준. SourceExplore범위에서보라색알약형Pill을브랜드파랑·옅은선택배경·7px모서리로교체, 버튼데스크톱36/모바일40px·입력40px/13px 통일. 탐색방식·기간/집계·필터·정렬·표시설정을흰색테두리패널에구분, 모바일기간2열/집계3버튼+비교한행·정렬2열, 데스크톱기간버튼은내용폭으로제한. 헤더의빌더버튼정렬·소스명중복제거(행수/연결상태만), KPI/차원결과카드10px반경·숫자34px/tabular·배경#f6f8fb. 접힌설정의중복지표/차원배지는펼침에만표시, 개수레이블유지. 모바일기술정렬설명/빈live영역여백축소. 쿼리/데이터/AI설정변경없음.

**PASS_SELECTED_VARIANTS**: 실제1440×1000/390×844 임시CSV두행200+300=500, 같은source명·지표로사용자이미지와비교. 두뷰포트scrollWidth=width, Enter Explore→Pivot표→Explore500복귀·포커스유지. 최종캡처직접검토(버튼/입력높이·폰트·선택/비활성·패널·KPI·차원카드). 최초시안모바일집계월버튼/비교겹침→최소폭0/분리grid조정, 데스크톱집계폭과헤더버튼여백/중복배지보정→최종재캡처. 복원숫자/전체저장케이스반복않음. 영향받는초기선택단위1PASS/22skip·최종FEtype/lint/build·diffcheckPASS. 실제파일/지표설정조합/VoiceOver/실기기touch전체는확대검증않음.

임시소스API삭제·지표비활성화/cleanup.json0확인. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/explore-design-20261014/` updated-1440.png/updated-390.png, results.json, build.log. 이전화면 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-list-race-20261014/source-switched-390.png`. 앞선권한안내미커밋수정과기록보존, 이번디자인도미커밋. gpt-6-luna/VoiceOverBLOCKED유지·AI호출0.


## 2026-10-14 동일 오류 화면의 파일 재선택 후속

탐색디자인·권한안내·이전검증기록을 `cfa25f63`으로drumcap계정에서현재브랜치codex/self-service-next-20261014에commit/push완료. 이후 EXP-VIEW-05/VERSION-07의남은'같은오류컴포넌트안에서정상파일재선택'390px조건만진행.

**PASS_SELECTED_VARIANTS**: 임시2행CSV/지표/보기생성→빌더에서amount→revenue파일교체400→버전revision/저장보기state불변·파일선택버튼활성확인→페이지이동/새로고침없이동일hiddenfileinput에같은스키마정상3행파일재선택→오류alert0/교체버튼활성→Enter교체201→탐색기존보기Enter복원180. 초기합계30은픽스처기준이며오류후데이터보존은파일revision불변으로확인;30UI재조회는이전통과결과재사용. 모바일overflow0·오류/복구캡처직접검토. nativeOS파일대화상자는미실행(setInputFiles사용).

제품변경0/새결함0, 이전단위·타입·lint·빌드재사용·문서diffcheck. helper최초수정에서첫빌더진입까지제거해요소없음실패→초기진입보존/오류후재진입만제거→정확조건재검증PASS. 임시소스·보기API삭제/지표비활성화, cleanup.json임시0/기존보기1보존확인. gpt-6-luna설정유지/호출0·VoiceOverBLOCKED/실기기touch유지.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-schema-inline-retry-20261014/` results.json, schema-denied-390.png, recovered-390.png, cleanup.json. 이후속기록만미커밋. 모든스키마강제변경/MySQL운영/스크린리더조건완료로확대않음.


## 2026-10-14 EXP-VIEW-05 지표 삭제 후 오래된 보기 삭제 HTTP

이전 파일 재선택 후속 기록은 `ffe35356`으로 현재 `codex/self-service-next-20261014` 브랜치에 drumcap 계정으로 커밋·push했고 HEAD/원격 일치를 확인했다. 이번 검증은 해당 커밋 + 아래 안내 수정 diff 기준이다. 기존 통과한 파일 갱신·필터·저장 조합은 반복하지 않았다.

**PASS_SELECTED_VARIANTS — EXP-VIEW-05·07**: 임시 CSV 두 행(amount=10+20, units=200+300)과 지표 두 개, 이전 정의의 보기 두 개를 준비했다. 정상 DELETE /metric으로 첫 지표를 비활성화한 뒤 catalog의 viewRevision 변경을 확인하고 남은 지표의 정상 보기를 추가했다. 실제 1440×1000/390×844 headed Chromium에서 오래된 보기 Enter 불러오기 GET409 → 현재 합계500 및 보기 목록 보존 → 삭제 Enter → 취소 기본 초점 → Shift+Tab 삭제 확인/Enter → 실제 DELETE200/목록 제거 → 목록 재조회 버튼으로 초점 복귀 → 정상 보기 GET200/원state/합계500 복원을 확인했다. 문서 가로 넘침0, 오류·대화상자·복구 캡처를 직접 검토했다. 지표 삭제는 API로 픽스처를 준비했으며 지표 삭제 UI 전체를 검증한 것은 아니다.

**발견·수정·재검증**: 409 안내가 같은 원인을 두 번 설명했고, 불러오기 오류가 삭제 확인창에도 남아 삭제 실패처럼 보였다. PersonalSavedViews에서 탐색409 안내를 한 번만 설명하고 화면 새로고침/새 보기 저장을 안내하도록 정리했다. 삭제창을 열 때 이전 요청 오류를 지워 실제 삭제 실패만 해당 창에 표시한다. 기존 탐색409 단위에 오류 잔류 검사를 추가해 수정 전 실패를 재현했고, 수정 후 관련4개 PASS/64skip(409 보존·삭제 초점·실제 삭제 실패 유지 포함). FE 타입/변경 lint/production build 및 diff check PASS. 영향받은 오류→삭제 경로만 재검증했고 전체 저장/E2E는 반복하지 않았다.

초기 삭제창 캡처는 진입 애니메이션 중이어서 안정화 뒤 다시 캡처했다. 이는 제품 렌더링 실패로 집계하지 않았다. Aside 기존 탭의 interactive snapshot에는 조작 요소가 없어, 기존 허용된 headed Playwright 대체로 실제 화면을 검증했다. 최초 단위 명령은 편집 대상 상대 경로를 잘못 지정해 편집 없이 기존 검사를 실행했고, 정확한 경로에서 회귀 검사 실패→수정→통과를 확인했다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-stale-delete-20261014/`의 results.json(최초 HTTP), before-conflict-390.png, stale-error-delete-dialog-390.png, final-results.json(수정 후), conflict-1440.png/conflict-390.png, delete-dialog-1440.png/delete-dialog-390.png, recovered-1440.png/recovered-390.png, regression-before.log/regression-after.log, build.log, cleanup.json. 임시 source21/22/23·보기는 삭제, 지표는 정상 soft-delete 처리했다. DB 확인 temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 보존. gpt-6-luna 설정 유지/AI 호출0, VoiceOver BLOCKED 유지.

잔여 범위: 강제 열 스키마 변경 이후 충돌(정상 파일 교체는 스키마 변경을 거부), MySQL·다중 서버 운영 통합, 실제 VoiceOver·실기기 터치/전체 키보드 조합은 완료로 확대하지 않는다. 이번 안내 수정과 이 검증 기록은 미커밋이다.


## 2026-10-14 EXP-VIEW-04 저장 보기 20개 한도·삭제 후 저장 복구

오류 안내 수정과 앞선 검증 기록은 `faf5caa4`로 현재 `codex/self-service-next-20261014` 브랜치에 drumcap 계정으로 커밋·push했다. HEAD/원격 일치를 확인한 뒤, 기존 단위에서만 확인했던 20개 한도의 실제 HTTP·화면 연결만 선택 검증했다. 이미 통과한 파일 교체·정의409·일반 저장/복원 케이스는 반복하지 않았다.

**PASS_SELECTED_VARIANTS — EXP-VIEW-04·07**: 별도 source24 CSV 두 행200+300=500과 SUM 지표24를 만들고, 같은 소스/사용자에 보기20개를 API로 준비했다. 21번째 POST400과 목록20개 유지 확인. 실제 headed Chromium 1440×1000/390×844에서 목록20개, 유효한 이름 입력 후에도 저장 버튼 비활성화, 최대20개/기존 보기 삭제 안내를 확인했다. 390px에서 삭제 Enter→취소 기본 초점→Shift+Tab 삭제 확인/Enter→DELETE200/19개→80자 이름 입력→저장 버튼 활성화/Enter POST201→새로고침→목록20개/80자 이름과 저장 state 보존을 확인했다. 목록 한도 재도달로 저장이 다시 비활성화됐다. 같은 소스의 UI 합계500, 두 문서 가로 넘침0. 긴 이름의 줄바꿈·버튼/입력 높이·정렬·초점과 한도 안내 캡처를 직접 검토했다.

제품 결함·수정0. 동일 코드의 앞선 관련4개 단위/타입/lint/build 통과 결과를 재사용하고 문서 diff check만 추가했다. Aside 기존 탭은 로그인 화면이었으며 helper가 실제 접근성 이름 User ID*의 별표를 생략해 로그인 요소 탐색에 실패했다. 이를 제품 오류나 Aside 전체 장애로 보고하지 않는다. 해당 실행은 허용된 headed Playwright의 정상 로그인 및 실제 화면 캡처로 검증했고, Aside에서 검증한 것으로 세지 않았다. 인증정보는 출력·증빙에 남기지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-limit-ui-20261014/`: results.json, fixture.json, limit-1440.png/limit-390.png, restored-20-long-name-390.png, aside-initial.txt, cleanup.json. 임시 소스/보기 API 삭제·지표 soft-delete 후 DB에서 temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 보존을 확인했다. gpt-6-luna 설정/VoiceOver BLOCKED 유지, AI 호출0.

20개 단일 서버 UI 경계와 삭제 후 복구만 완료했다. MySQL·다중 서버 동시성, 실제 VoiceOver·실기기 터치/전체 키보드 조합 및 강제 스키마 변경 조건은 미검증으로 유지한다.


## 2026-10-14 VERSION-06·07 — 5개 한도 실제 화면 후속

기준 `codex/self-service-next-20261014` @ `03b85ecc` + 프로필 재조회 안내 수정. 이전 하위 검사로만 확인했던 최대5버전 조건을 실제 HTTP/화면에 연결했다. 정상 파일 갱신 전체·Rill 숫자·기존 저장 보기/차트/AI 조건은 반복하지 않았다.

**PASS_SELECTED_VARIANTS**: 임시 CSV 두 행100×n+200×n(버전1..5)을 준비해 5개 한도에 도달. 실제1440×1000/390×844에서 여섯째 파일 선택→Enter 교체POST400/최대5개 안내, currentVersionId/revision/이력 불변·합계1500 보존을 확인했다. 390px에서 버전1 복원 선택/Enter 확인→POST201·5개 이력 유지·합계300, 같은 내용 파일을 다른 이름으로 재선택→201 unchanged=true·revision/이력 불변, 새로고침 뒤 버전1/current·합계300 유지. 수치는 실제 explore/query와 고정 CSV 산술로 대조했다. 문서 가로 넘침0·버전표/안내/버튼/줄바꿈·포커스 캡처 직접 검토. 파일 선택은 setInputFiles이며 OS 파일창/실기기 터치로 확대하지 않는다.

**발견·수정·재검증**: 복원201 뒤 프로필 재조회가 profile을 비워 FileVersions를 다시 생성하면서 복원 완료 안내가 사라졌다. Explore는 같은 sourceId를 재조회할 때 준비된 profile과 파일 관리 컴포넌트를 유지하고 busy로 변경 동작을 잠근다. 소스가 바뀌면 이전 profile을 비우며, 재조회 실패 시에도 profile을 제거해 낡은 정보로 제작할 수 없게 한다. 신규 회귀로 수정 전 실패를 재현했다. 수정 후 관련 Explore/FileVersions36개 PASS, 추가 재조회 실패 경계와 안내 유지2개 선택 PASS(고유 검사37개). FE 타입·변경 lint·production build/diff check PASS. 최종 브라우저에서도 완료 안내 지속과 위 한도 경로를 재검증했다.

외부 helper의 Promise.json 호출과 unchanged 응답 envelope 위치 가정은 검사 코드 오류로 수정했다. 제품 오류로 세거나 실제 완료 조건을 생략하지 않았으며 마지막 browser-final.log/results.json은 전 조건 완료다. 최초 lint의 테스트 포맷/증가 연산자는 보정 후 통과했다. Aside 기존 탭의 로그인 화면을 확인했으며 대표 뷰포트/파일 입력은 기존 허용된 별도 headed Chromium에서 검증했다. Aside 통과나 VoiceOver 발화로 집계하지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-version-limit-ui-20261014/`: limit-denied-1440.png/limit-denied-390.png, restore-notice-before-390.png, restored-at-cap-390.png, reloaded-at-cap-390.png, results.json, browser-before.log/browser-after.log/browser-final.log, regression-before.log/regression-after.log, profile-boundary-tests.log, build.log, cleanup.json. 임시 source/metric25~29만 API 삭제/soft-delete했고 DB에서 temporarySources/activeTemporaryMetrics=0·기존 source3/view1 보존을 확인했다. 파일시스템 전체 orphan scan·crash 복구를 수행했다는 뜻은 아니다.

이번 코드/검증 기록은 미커밋. 자동GC·crash 복구·장기 보존 정책·다중 서버/tenant·실기기·VoiceOver는 미검증/BLOCKED 유지. gpt-6-luna 설정 유지/AI 호출0, 기존130개 카탈로그 완료 집계는 확대하지 않았다.


## 2026-10-14 EXP-VIEW-04·06·07 — 다른 소스 ID·외부 삭제 404 후속

복원 완료 안내 수정과 앞선 VERSION-06·07 기록을 `fb51a1de`로 현재 `codex/self-service-next-20261014` 브랜치에 drumcap 계정으로 커밋·push하고 원격 일치를 확인했다. 이번 실행은 제품 변경 없이 아직 실제 HTTP/화면으로 확인하지 않았던 다른 소스 ID와 없는 보기404 조건만 진행했다.

**PASS_SELECTED_VARIANTS**: 임시 CSV 소스A(1행500)/B(1행700), 각 SUM 지표·개인 보기를 준비했다. 같은 소유자의 A경로/B보기와 B경로/A보기에 각각 GET·DELETE를 보내 실제 HTTP4조건 모두404를 확인했다. 원래 소스에서 해당 보기를 다시 GET200해 state 불변과 A목록3개/B목록1개 유지도 확인했다. 이 검증은 다른 계정403/공유토큰 조건을 반복한 것이 아니다.

실제 headed Chromium1440×1000/390×844에서 A 저장 보기 목록을 연 뒤 별도 API 삭제로 다른 창에서 삭제된 상황을 재현했다. 목록에 남은 보기 Enter 불러오기→GET404·‘탐색 저장 보기를 찾을 수 없습니다’ 안내, 현재 합계500 보존. Enter 목록 재조회→삭제된 행/오류 제거·정상 보기 활성화, A/B의 정상 보기 state 보존·모바일/데스크톱 문서 overflow0 PASS. 일반 정상 저장·정의409·CSV내보내기는 재실행하지 않았다. 오류/복구/현재조건 화면의 레이블·줄바꿈·버튼/패널 배치를 캡처로 직접 검토했다. 외부 삭제는 두 번째 브라우저의 클릭이 아니라 정상 DELETE API이며, 실제 스크린리더 발화나 실기기 터치까지 확인한 것은 아니다.

제품 결함·수정0, 관련 단위/타입/lint/build의 기존 통과 결과를 재사용하고 문서 diff check만 추가했다. 최초 helper는 합계500과 행/시계열의 같은 값까지 함께 찾아 strict locator 오류가 났다. 실제 DOM에서 관찰한 KPI의 p[aria-label="500"]로 범위를 제한해 재검증했다. 해당 실패는 제품 오류로 세지 않았다. Aside 기존 탭의 로그인 화면 확인 후 기존 허용된 별도 headed 브라우저에서 정상 로그인/대표 뷰포트 검증을 수행했으며 Aside PASS로 표시하지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-cross-source-404-20261014/`: results.json(HTTP4조건/화면2조건), missing-view-1440.png/missing-view-390.png, list-recovered-1440.png/list-recovered-390.png, conditions-preserved-1440.png/conditions-preserved-390.png, cleanup.json. 생성 source30~33/보기만 API 삭제·지표 soft-delete 후 DB temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 보존을 확인했다. 인증정보 출력/기록 없음.

MySQL·다중 서버/tenant·강제 스키마 변경·실기기/전체 키보드 조건은 미검증 유지. gpt-6-luna 설정과 VoiceOver BLOCKED 유지/AI 호출0. 전체130개 카탈로그 완료 집계는 확대하지 않는다.


## 2026-10-14 EXP-VIEW-06·07 — 삭제 실패 후 키보드 재시도

기준 `a7dc501d` + 삭제 실패 초점 수정. 기존 삭제 실패 단위 검증을 실제 화면으로 연결한 선택 변형이다. 같은 Rill1391572행 source3·기존 지표1/2를 사용하고 임시 보기만 생성했다. 기존 정상 복원·저장·필터/수치 정답 전체는 반복하지 않았다.

**FAIL→PASS_SELECTED_VARIANTS**: 실제1440×1000/390×844에서 임시 보기 삭제 확인의 첫 DELETE에 브라우저503 fixture를 응답했다(실제 서버 장애를 유발한 것은 아님). 확인창/오류 안내·보기/state는 보존됐지만 disabled→enabled 전환 후 초점이 확인창 DIV에 남아 Enter 재시도가 실행되지 않았다. PersonalSavedViews의 삭제 확인 버튼 ref와 실패 완료 effect로 버튼이 다시 활성화됐을 때 초점을 돌렸다. 자동 삭제 재요청은 하지 않는다. 기존 실패 삭제 회귀에 초점 검사를 추가해 수정 전 실패를 재현했고, 수정 후 관련3개 PASS/65skip(삭제 실패·취소/복귀·정의409의 삭제 진입 포함).

수정 후 두 뷰포트에서 503/임시 보기 GET200·state불변 확인→‘삭제 확인’ 초점→같은 창에서 Enter 재시도(응답 주입 해제)→실제 DELETE200/목록에서 해당 보기만 제거→목록 재조회 버튼 초점 복귀 PASS. 기존 보기1 전체 응답/state 불변·현재 합계634513000 유지·문서 가로 넘침0. 실패 안내/포커스/버튼·모바일 줄바꿈·재시도 완료 캡처를 직접 검토했다. FE 타입/변경 lint/production build/diff check PASS. 공유 컴포넌트 영향 회귀만 선택했으며 전체 E2E/기존 MD 통과 조건은 재실행하지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-delete-retry-20261014/`: before-failed-delete-1440.png/before-failed-focus-1440.json(초점DIV), failed-delete-1440.png/failed-delete-390.png(수정 후 초점), retried-delete-1440.png/retried-delete-390.png, results.json, browser-before.log/browser-after.log, regression-before.log/regression-after.log, build.log, cleanup.json. 최초 애니메이션 중 캡처는 안정화 대기 후 다시 저장했고 제품 렌더링 오류로 세지 않았다. 생성한 정확한 보기 ID만 삭제했으며 temporaryViewsRemaining=0/primaryViewUnchanged=true를 API로 확인했다. 원본 파일·지표·대시보드 변경 없음.

기존 허용된 headed Chromium으로 실제 화면/키보드를 검증했다. 전체Tab/실기기 터치·실제 서버 장애 복구·다중서버·VoiceOver 발화로 확대하지 않는다. gpt-6-luna 설정 유지/AI 호출0·VoiceOver BLOCKED 유지. 이번 초점 수정/검증 기록은 미커밋이다.


## 2026-10-14 RANGE-03·KEY-01 — 한쪽 경계·비정상 숫자 실제 화면

기준 `a7dc501d` + 앞선 삭제 재시도 초점 diff(그대로 보존). 이번 제품 변경0. 대용량 page10000은 이전 DETAIL-LARGE-02에서 실제 API 정답이 이미 확인돼 반복하지 않았고, RANGE-03의 하위 검사에서만 확인했던 한쪽 경계/비정상 숫자 입력을 실제 화면으로 연결했다. gpt-6-luna 설정과 VoiceOver BLOCKED 유지/AI 호출0.

**PASS_SELECTED_VARIANTS**: 원본 Rill Parquet1391572행 SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157` 확인 후 별도 메모리 DuckDB에서 직접 SQL 집계했다. 1440×1000의 bid_floor 최솟값1/최댓값빈칸은 요청342506200·가중 평균10.581600405605014, 390×844의 최솟값빈칸/최댓값10은 요청490581800·평균1.2501132274324376. 실제 Enter 적용의 POST201·range에 입력한 경계 키만 포함·요청 합계 exact/평균±1e-9 일치, 적용 뒤 필터 추가로 초점 복귀를 확인했다. 최대/최소 한쪽 입력만 허용하는 제품 계약이며, 기존 양쪽1..10 정답 조건은 재실행하지 않았다.

각 화면에서 이미 적용한 경계를 유지한 채 같은 열의 새 입력 abc/Infinity/9007199254740992를 각각 시도했다. 유효 숫자/안전 범위 안내, aria-describedby=range-filter-error, 적용 후 300ms 관찰 동안 새 explore/query 요청0·기존 KPI 유지 PASS. 잘못된 입력을 서버에 보낸 API 거절 검사로 세지 않는다. 닫기 Enter 뒤 초점 복귀·두 문서 가로 넘침0. 필터칩의 제한 없음 표시, KPI의343M/$10.58·491M 표시, 모바일 입력/오류 줄바꿈·버튼/포커스/인접 배치를 실제 캡처로 검토했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-one-sided-20261014/`: oracle.json, results.json, applied-min-1440.png, applied-max-390.png, invalid-preserves-1440.png/invalid-preserves-390.png. 기존 허용된 headed Chromium과 입력/Enter 경로이며 native 소스 선택은 selectOption을 사용했다. 소스/보기/지표/대시보드 저장 요청0, 신규 리소스0, 브라우저 검증 창만 종료. 제품 코드가 바뀌지 않아 기존 관련 단위·타입/lint/build를 재사용하고 문서 diff check만 수행했다.

이번 검증 기록은 미커밋. 최대5개 혼합필터의 전체 화면 조합·큰 정수 정렬의 실제 화면·실기기/전체Tab·MySQL 운영·실제 VoiceOver는 완료로 확대하지 않는다. 앞선 삭제 재시도 초점 수정도 미커밋 상태로 보존했다.


## 2026-10-14 RANGE-03·KEY-01 — 혼합5필터 한도와 같은 열 교체

기준 `a7dc501d` + 앞선 삭제 재시도 초점 diff(보존). 이번 제품 변경0. 하위 검사에서만 확인했던 값·범위 혼합5개/6번째 열 거절/한도에서 같은 열 교체를 실제 화면으로 선택 검증했다. 앞선 한쪽 경계·비정상 숫자·일반 저장/복원·Rill 전체 수치 조건은 반복하지 않았다.

**PASS_SELECTED_VARIANTS**: 임시 CSV App200/Site300, n1..n5가 각1/2인 두 행을 준비했다. category 값필터(App/Site)+n1..n4 범위1..2인 개인 보기 fixture를 API로 생성하고 실제1440×1000/390×844 화면에 적용했다(저장 기능 재검증이 아닌 입력 준비). n5 범위1..2를 Enter 적용하면 최대5개 열 안내·300ms 관찰 동안 새 explore/query 요청0·현재500 유지. 같은 창에서 기존 n1 범위를1..1로 바꾸고 Enter 적용→실제 query201·filters.length5·n5미포함·나머지 값/범위 조건 보존·합계200 exact. 저장한 원래 fixture state도 변경되지 않았다. CSV 두 행의 산술 정답과 대조했으며 제품 SQL 생성기를 oracle로 사용하지 않았다.

두 뷰포트 document overflow0, 칩 wrapping·오류 문구·입력/버튼 높이·정렬·선택 상태·KPI/카드 인접 배치를 캡처로 직접 검토했다. 적용 뒤 ‘필터 추가’ 초점 복귀 PASS. 열 선택은 selectOption, 적용은 Enter이며 OS native 방향키/실기기 touch·전체Tab·VoiceOver 발화로 확대하지 않는다. 제품 오류/수정0, 기존 관련 단위/타입/lint/build를 재사용·문서 diff check만 수행했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-filter-cap-20261014/`: results.json, sixth-rejected-1440.png/sixth-rejected-390.png, same-column-replaced-1440.png/same-column-replaced-390.png, cleanup.json. source34/metric34/view69만 API 삭제·metric soft-delete 후 DB temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 응답 불변 확인. gpt-6-luna 설정 유지/AI 호출0·VoiceOver BLOCKED 유지.

이번 기록과 앞선 삭제 초점 수정은 미커밋. 혼합 필터의 모든 데이터 타입 조합·큰 정수 정렬 실제 화면·운영 다중 서버·실기기/VoiceOver는 미검증으로 유지한다.


## 2026-10-14 필터 적용 레이아웃·큰 정수 추세 후속

[explore-range-sort.md](explore-range-sort.md)의 SORT-02/NUMBER-01·02와 DESIGN-FILTER-02 참조. 실제1440/390의 큰 정수1 차이/동률/NULL·0 정렬 PASS, 추세 원값을 Number로 바꾸며2 손실하는 오류를 수정해 정확값 표27021597764222978 재검증 PASS. 여러 칩의 행 시작 어긋남/추가 버튼 밀림을 분리 행+flex gap으로 정리하고 긴 이름·오류·적용/닫기까지 실제 화면/overflow0/console.error0 확인. BE3/FE8 선택 검사·FEtype/lint/BE·FEbuild/diffcheck PASS. 제품 AI 호출0/gpt-6-luna 유지, VoiceOver BLOCKED/실기기 및 전체조건은 미완료 유지. 증빙 sort-bigint-ui-20261014와 filter-layout-20261014(저장소 밖). 이전 삭제 초점 수정과 신규 두 수정·기록 미커밋.

### 2026-10-14 — RANGE-03 음수·소수 경계와 값 선택 디자인

- PASS_SELECTED_VARIANTS: 1440/390px에서 −1.5..0.25 경계 포함·NULL 제외 합계90, 문자 열의 숫자 범위 입력 차단. 기존 통과 Rill/필터 한도 조건은 재실행하지 않았다.
- FAIL→PASS: 문자 값 체크박스 잘림/라벨 간격을 해당 목록에만 수정. 모바일 한 열·데스크톱 두 열, 긴 이름 줄바꿈/220px 내부 세로 스크롤·Space 선택/해제·Enter 적용 합계20·행 초점·가로 넘침0 확인.
- 관련 FE4개/타입/lint/build PASS. 임시 source/metric44~48 정리·원보기1 보존. Aside 미실행 상태로 허용된 headed Chromium 대체. 코드/기록 미커밋, AI gpt-6-luna/VoiceOver BLOCKED 유지.
- 상세/증빙: [숫자 범위와 정렬](explore-range-sort.md), `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/range-decimal-20261014/`.

### 2026-10-14 — SORT-02 상위20·이전0/NULL 비교 실제 화면

- PASS_SELECTED_VARIANTS: 1440/390px에서24그룹 전체 정렬 후 상위20·합계2700/2400·각 행 정확값, 비교 불가 그룹 마지막 배치·이전0과 값 없음 구분을 확인했다. 기존 Rill/큰 정수/동률 통과 조건은 반복하지 않았다.
- FAIL→PASS: 차원 순위 행의 고정 높이 때문에 잘리던 비교 설명을 해당 버튼의 자동 높이·여백·행간으로 수정했다. 양 방향8조건 설명 bounding box/가로 넘침0 확인.
- FE 관련5개·타입/lint/build PASS. source/metric49~51·보기75~79 정리/원보기1 보존. 코드/기록 미커밋, gpt-6-luna 설정/VoiceOver BLOCKED 유지.
- 상세: [숫자 범위와 정렬](explore-range-sort.md), 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/sort-comparison-boundaries-20261014/`.

### 2026-10-14 — NUMBER-01·02 숫자 경계 실제 화면

- PASS_SELECTED_VARIANTS:1440/390px에서999999→$1M,999499→$999K,음수 통화/0/NULL의 KPI·차원·정확값 표 및 title/aria 원값을 확인했다. 두 저장 지표의 compact/plain 표시와 Enter 필터·Delete 해제, 가로 넘침0·콘솔 오류0.
- 새 제품 오류/수정0, 직전 관련 단위/타입/lint/build 재사용·문서 diff check. 임시 소스/지표 정리·원보기1 보존. 기존 통과 Rill/큰 정수/정렬 조건은 반복하지 않았다.
- 상세: [숫자 표시](compact-controls-formatting.md), 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/number-boundaries-ui-20261014/`. 기록 미커밋, gpt-6-luna 설정·VoiceOver BLOCKED 유지.

### 2026-10-14 — VERSION-05·07 오래된 교체409와 재시도

- PASS_SELECTED_VARIANTS:1440/390px의 오래된 파일 교체409→선행 버전/합계600 보존→Enter 최신 목록 재조회→재선택/교체201·합계900·완료 안내 유지. 실제 CAS 보호를 사용했으며 다중 서버 동시 부하로 확대하지 않았다.
- 모바일 복원 버튼의 한 글자 줄바꿈을 반응형 ‘복원’/데스크톱 기존 문구로 보정. 접근성 이름 유지·44px 높이·셀 내부 배치·Enter 확인/취소·가로 넘침0 확인.
- FE18개·타입/lint/build PASS, 임시 source53~55/metric54~55 정리·원보기1 보존. 코드/기록 미커밋, gpt-6-luna 설정·VoiceOver BLOCKED 유지.
- 상세: [파일 전체 교체·복원](file-versions.md), 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-stale-ui-20261014/`.

### 2026-10-14 — VERSION-05·07 복원 확인 도중 갱신409

- PASS_SELECTED_VARIANTS:1440/390px에서 복원 확인 중 별도 정상 갱신→낡은 복원409·최신 합계900/이력 보존→목록 새로고침 시 낡은 확인창 해제→명시적 재확인201·원합계300/세 이력 유지.
- 새 오류/제품 변경0, 이전 관련18개·타입/lint/build 재사용·문서 diff check. 임시 source/metric56~58 정리·원보기1 보존. 교체409/정상 복원 전체는 반복하지 않았다.
- 상세: [파일 전체 교체·복원](file-versions.md), 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-stale-restore-20261014/`. 미커밋, gpt-6-luna 설정·VoiceOver BLOCKED 유지.
2026-10-14 Rill 범위/변화 순위 후속: EXPLORE-09/10 하위 및 Aside 선택 조건 PASS. 원본 숫자 범위 공통 적용·전체 차원 집계 후 값/변화량/변화율 양방향 정렬, 독립 SQL6조합과 실제 XHR55127800/122756행 확인. 대시보드 숫자 열 검사·날짜 없는 비교 비활성화·DECIMAL 비교 정확성 경계 수정. Rill의 집계 지표 임계값 필터와는 의미가 다르며 Pivot/보기 저장/내보내기·이번 컨트롤 전체 접근성/모바일은 NOT_RUN. [상세](rill-exploration.md).

## 2026-10-14 develop-v2 통합 검증

`90dbfd71`과 `7bc1220d`를 통합하고 전체 단위 검사(backend 1,361 / frontend 822), 서버·웹 빌드, FE 타입 검사, 영향 범위 headed 탐색·Pivot E2E 1개를 통과했다. 상세 결정과 제한은 [통합 기록](develop-v2-integration-20261014.md)을 참조한다. gpt-6-luna와 VoiceOver BLOCKED는 유지한다.

## 2026-10-15 Studio T1 디자인 시안

개발 전용 합성 데이터 시안의 시작·결과·블록 설정·공유 미리보기를 1440/768/390px로 확인했다. 모바일 상태 버튼 간격·패널 기본 열림을 수정하고 키보드 복귀를 검증했다. 기능은 시안 전환/로컬 입력만 PASS_SELECTED이며 실제 AI/저장/게시/복제는 NOT_RUN이다. 상세·캡처·제한: [Studio MD](dashboard-studio.md). gpt-6-luna/VoiceOver BLOCKED 유지.

## 2026-10-15 Studio T2 문서·변경 이력

Studio 순수 문서/연산·history·legacy projection의 FE30/BE99 검사와 FE 타입·변경 린트·BE 빌드를 통과했다. 저장 응답 경합·revision·ID map 검토3건을 수정했다. UI 연결/실제 저장/LLM은 미실행이며 T1 캡처는 관련 코드 변경이 없어 재사용한다. [T2 범위와 제한](dashboard-studio.md#t2-문서변경-이력-기반--2026-10-15).
