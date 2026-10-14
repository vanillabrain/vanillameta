# 탐색 조건 개인 저장·복원

기준 `codex/self-service-next-20261014`, `db584d6e` + 작업 diff. 기존 통과한 숫자 범위·정렬 집계는 재사용하고 이번 영속 상태와 복원 조건만 실행한다. AI codex/gpt-6-luna 설정 유지, 이 경로 모델 호출0. VoiceOver BLOCKED 유지.

| ID | 조작 | 기대 결과 |
| --- | --- | --- |
| EXP-VIEW-01 | 원본 Rill1391572행 source3에서 지표·차원·범위1~10·UTC Sep10~11·일·이전비교·증감률asc·원본 펼침 저장 | POST201, state whitelist만 저장. KPI56663800·이전29059200·현재126090행, Device Type첫 Connected Device−66.6666667% |
| EXP-VIEW-02 | 전체 새로고침 후 저장 보기 열기→이름으로 불러오기 | 모든 선택과 원본 펼침 복원, page0. 최신catalog sourceRevision으로 조회. 저장 전 결과/행은 metadata에 보관하지 않음 |
| EXP-VIEW-03 | 값 필터+숫자 범위 및 지표/순위 지표 선택 순서·전체기간/빈차원·불완전날짜 | 구조·타입·선택 순서 유지. 미적용/불완전 기간·조회 실패·지표0에서는 저장 차단. 기존 페이지/소스/보기 손상 없음 |
| EXP-VIEW-04 | 소유자 변경/다른 소스·계정·공유 토큰·익명, 상태/이름/20개한도·migration | 매 요청 소유권·ID범위검사, 잘못된 입력400/권한403/없는ID404. 기존 dashboard보기 보존. SQLite20개동시한도·실패후queue복구 |
| EXP-VIEW-05 | 지표/열 정의가 변경된 보기 열기·삭제·카탈로그갱신 | load409, 현재 조건과 기존 보기 유지·재조회 안내. stale보기도삭제가능. 정상 데이터 파일 게시/행·날짜경계만 변경 시 최신 데이터로 복원 |
| EXP-VIEW-06 | 목록/불러오기503·조건변경 중 지연응답·중복클릭 | 실패한 복원은 현재조건보존, 재시도·상태변경중응답차단·자원변경시abort. 삭제취소/확인은보기만삭제 |
| EXP-VIEW-07 |1440/390px, Tab/Enter 저장·복원·삭제 확인/취소 | 문서 가로넘침0·레이블·상태/오류·안전한삭제대화상자·초점복귀. 실제VoiceOver 제외 |

정답은 이전 `explore-range-sort.md`의 같은 원본 SHA256 및 독립 Parquet SQL을 재사용한다. 서버 저장소는 기존 metadata `personal_view`에 nullable sourceId와 소스/사용자 index를 추가한다. 대시보드 보기는 기존 dashboardId와 분리한다. 소스별·사용자별20개, 이름1~80자. 지표/열 정의 해시는 원본 행·최소/최대 날짜·파일 revision을 제외하고 정의 변화는 보수적으로 차단한다. 같은 스키마의 최신 데이터 재조회이며 역사 데이터 snapshot 복원은 아니다.

이번 탐색 보기의 기간은 전체기간 또는 절대 달력 날짜다. 상대기간, 팀 공유·URL 공유, 기본 보기 자동 적용, Pivot·내보내기, MySQL 실통합/운영 다중서버 부하는 후속이다. 저장 보기 패널은 기본적으로 접어서 탐색 화면 밀도를 유지한다.

## 실행 결과

2026-10-14, Node24.21.0/API4684/FE3484, 별도 검증 metadata와 source3/user2. 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/explore-saved-views-20261014`.

| ID | 판정 | 실행 범위와 증빙 | 남은 변형 |
| --- | --- | --- | --- |
| EXP-VIEW-01 | PASS 선택 조건 | Aside에서 이름 `입찰가 범위·증감률 QA` 저장201. view1의 sourceId3/dashboardIdNULL와 whitelist 상태를 metadata에서 확인. `aside-saved-rows.json`, `aside-saved-desktop.png` | 다른 소스·다른 집계 정의의 전체 조합 |
| EXP-VIEW-02 | PASS 선택 조건 | Aside 전체 새로고침→이름으로 복원 및 독립 headed Chromium 새 로그인/새로고침 복원. API201 현재56663800/이전29059200/126090행, Device Type9그룹 증감률 오름차순이 이전 독립 oracle와 동일, details.page0. `ui-results.json`, `ui-xhr.json`, `aside-restored-desktop.png`, `vm-restored-desktop.png` | 모든 상태 조합의 실제 화면 |
| EXP-VIEW-03 | PASS 하위·선택 화면 | FE 상태17개에서 혼합 필터·선택 순서·전체기간/빈차원·한쪽0·미등록/불완전/unsafe 거절, SourceExplore 새2개에서 한 번의 조회로 전체 적용/page0·미완성 날짜 저장 차단. BE 검증에서 SQL/원본/unknown 입력 거절. 실제 화면은 01의 범위/date/선택 조합 | 혼합 값+범위·빈차원의 실제 저장 화면 |
| EXP-VIEW-04 | PASS 하위·선택 API | 신규 BE27개 실제 in-memory SQLite에 서비스/소유권/ID범위·상태·20개 동시 생성/실패 후 queue복구·기존 dashboard보기 보존·migration 멱등성. 실제 새 endpoint 목록/상세 익명401. 기존 공통 queue/entity 영향 회귀28개 함께 PASS | 공유 토큰 및 다른 사용자 실제 HTTP, MySQL 동시성/운영 통합 NOT_RUN |
| EXP-VIEW-05 | PASS 하위·선택 화면 | 검증 지표2의 label만 일시 변경→실제 load409, 현재 전체기간/정렬/634513000과 view1 유지·삭제 버튼 사용 가능. 원 정의 문자열 복구→목록 재시도/불러오기201/56663800. `definition-conflict-results.json`, `vm-definition-conflict.png`. BE 정의 hash는 rowCount/sourceRevision/날짜 경계 변화에 안정적이고 정의 변화/race 거절 | 실제 새 파일 게시 후 복원·실제 열 변경과 stale 삭제 HTTP NOT_RUN |
| EXP-VIEW-06 | PASS 하위·선택 화면 | 모바일 load503 응답 fixture→현재 기간/asc/56663800 유지, 목록 재시도/복원201. `vm-load-failure-mobile.png`, `ui-results.json`. 영향받는 공유 FE 회귀에서 지연 load/조건 변경/중복 잠금/abort·삭제 취소/실패 유지 | 탐색 endpoint 지연·소스 교체 및 목록503의 실제 화면 NOT_RUN |
| EXP-VIEW-07 | PASS 선택 조건 | 실제1440×900/390×844, 390 document scrollWidth390. Enter 복원, 이름 입력→Tab 저장→Enter201, 삭제 Enter→취소 기본 초점→Enter 취소/초점 복귀, Shift+Tab 삭제 확인→Enter200/목록 fallback 초점. 정확한 임시 보기만 삭제했고 view1 유지. `vm-restored-mobile.png`, `vm-views-mobile-viewport.png`, `vm-final-mobile.png` | 실제 VoiceOver BLOCKED, 전체 스크린리더·실기기 터치 NOT_RUN |

### Rill 대조

Rill0.90.5/API9014의 기존 동일 원본 파생 범위 모델 `auction_range_metrics`를 사용했다. URL `tr=2023-09-10+to+2023-09-12&compare_tr=rill-PP&grain=hour&dims=device_type&sort_type=delta_percent&sort_dir=ASC`를 새로고침한 뒤 같은 기간/이전 비교/증감률asc와 첫 Connected Device200/−400/−67%, 요청56.7M/평균$3.07가 복원되는 것을 Aside에서 확인했다. 비동기 표가 `(No available values)`에서 정상 목록으로 전환된 뒤 최종 `rill-reload-state.png`를 저장했다. 기존 수치 정답을 다시 생성하지 않았다.

VanillaMeta는 소스/사용자별 이름을 붙인 조건을 metadata에 저장하고 불러온다. Rill의 이번 로컬 UI는 URL 재현을 확인했으며 이름 저장/클라우드 북마크는 검증하지 않았다. Rill 범위는 SQL 파생 모델에 고정돼 있고 시간 grain은 hour, VanillaMeta는 동적 범위 필터/day다. 숫자 반올림과 축 차이는 이전 기록대로 유지하며 UX 전체 동일성으로 확대하지 않는다.

### 검사·데이터 보존

- BE55 PASS = 신규 explore-view27 + 영향받는 기존 dashboard view28. FE28 PASS = 순수 상태17 + 선택 UI/관련 공유 회귀11; 나머지95개는 skipped이며 새 PASS로 세지 않는다.
- FE 타입/변경 lint/production build, BE 변경 lint/nest build, `git diff --check` PASS. 전체 출시 suite·기존 숫자 범위/집계/AI 조건은 반복하지 않았다. Node24를 명시했으며 새 패키지·별도 상시 서버·AI 호출을 추가하지 않았다.
- `metadata-after-check.json`: 기존 database6/metric2/dashboard5의 전체 행이 검사 전 backup과 동일. 검증 중 지표 정의는 원 문자열로 복구했고 임시 view2만 제거, view1만 남았다. 백업은 로컬 private 파일이며 인증정보를 문서/응답에 복사하지 않는다.
- 초기 새 단위 검사가 미사용 AI SDK ESM import를 따라가 실패해 단위 경계의 BiExploreService만 mock으로 격리했다. 실제 catalog/revision/조회는 UI HTTP로 별도 확인했다. 첫 root 테스트 명령이 선택 인자를 전달하지 않아 전체 suite를 시작한 것은 중단했고 완료 통과로 계산하지 않았다. 실제 BE cwd 선택 재검사는55 PASS다.
- 초기 standalone Chromium 시작은 sandbox mach bootstrap 거부로 실패했다. 승인된 로컬 headed 실행으로 재시도해 정의409/복구를 통과했다. 최초 실패 로그 `conflict-browser-launch-first-failure.log`를 보존했다. Aside의 첫 reload 직후 버튼 탐색은 catalog 준비 전이라 실패했으며 fresh snapshot에서 준비된 버튼으로 복원했다. 제품 성공 조건을 우회하지 않았다.

이번 단위는 미커밋 `codex/self-service-next-20261014` 작업이며 develop-v2 병합/푸시로 보고하지 않는다. VoiceOver 차단·gpt-6-luna 설정은 유지한다.


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


## 2026-10-14 EXP-VIEW-04·06·07 — 다른 소스 ID·외부 삭제 404 후속

복원 완료 안내 수정과 앞선 VERSION-06·07 기록을 `fb51a1de`로 현재 `codex/self-service-next-20261014` 브랜치에 drumcap 계정으로 커밋·push하고 원격 일치를 확인했다. 이번 실행은 제품 변경 없이 아직 실제 HTTP/화면으로 확인하지 않았던 다른 소스 ID와 없는 보기404 조건만 진행했다.

**PASS_SELECTED_VARIANTS**: 임시 CSV 소스A(1행500)/B(1행700), 각 SUM 지표·개인 보기를 준비했다. 같은 소유자의 A경로/B보기와 B경로/A보기에 각각 GET·DELETE를 보내 실제 HTTP4조건 모두404를 확인했다. 원래 소스에서 해당 보기를 다시 GET200해 state 불변과 A목록3개/B목록1개 유지도 확인했다. 이 검증은 다른 계정403/공유토큰 조건을 반복한 것이 아니다.

실제 headed Chromium1440×1000/390×844에서 A 저장 보기 목록을 연 뒤 별도 API 삭제로 다른 창에서 삭제된 상황을 재현했다. 목록에 남은 보기 Enter 불러오기→GET404·‘탐색 저장 보기를 찾을 수 없습니다’ 안내, 현재 합계500 보존. Enter 목록 재조회→삭제된 행/오류 제거·정상 보기 활성화, A/B의 정상 보기 state 보존·모바일/데스크톱 문서 overflow0 PASS. 일반 정상 저장·정의409·CSV내보내기는 재실행하지 않았다. 오류/복구/현재조건 화면의 레이블·줄바꿈·버튼/패널 배치를 캡처로 직접 검토했다. 외부 삭제는 두 번째 브라우저의 클릭이 아니라 정상 DELETE API이며, 실제 스크린리더 발화나 실기기 터치까지 확인한 것은 아니다.

제품 결함·수정0, 관련 단위/타입/lint/build의 기존 통과 결과를 재사용하고 문서 diff check만 추가했다. 최초 helper는 합계500과 행/시계열의 같은 값까지 함께 찾아 strict locator 오류가 났다. 실제 DOM에서 관찰한 KPI의 p[aria-label="500"]로 범위를 제한해 재검증했다. 해당 실패는 제품 오류로 세지 않았다. Aside 기존 탭의 로그인 화면 확인 후 기존 허용된 별도 headed 브라우저에서 정상 로그인/대표 뷰포트 검증을 수행했으며 Aside PASS로 표시하지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/view-cross-source-404-20261014/`: results.json(HTTP4조건/화면2조건), missing-view-1440.png/missing-view-390.png, list-recovered-1440.png/list-recovered-390.png, conditions-preserved-1440.png/conditions-preserved-390.png, cleanup.json. 생성 source30~33/보기만 API 삭제·지표 soft-delete 후 DB temporarySources/Views/activeTemporaryMetrics=0, 기존 source3/view1 보존을 확인했다. 인증정보 출력/기록 없음.

MySQL·다중 서버/tenant·강제 스키마 변경·실기기/전체 키보드 조건은 미검증 유지. gpt-6-luna 설정과 VoiceOver BLOCKED 유지/AI 호출0. 전체130개 카탈로그 완료 집계는 확대하지 않는다.
