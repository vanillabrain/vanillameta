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

2026-10-14 Rill 범위/변화 순위 후속: EXPLORE-09/10 하위 및 Aside 선택 조건 PASS. 원본 숫자 범위 공통 적용·전체 차원 집계 후 값/변화량/변화율 양방향 정렬, 독립 SQL6조합과 실제 XHR55127800/122756행 확인. 대시보드 숫자 열 검사·날짜 없는 비교 비활성화·DECIMAL 비교 정확성 경계 수정. Rill의 집계 지표 임계값 필터와는 의미가 다르며 Pivot/보기 저장/내보내기·이번 컨트롤 전체 접근성/모바일은 NOT_RUN. [상세](rill-exploration.md).
