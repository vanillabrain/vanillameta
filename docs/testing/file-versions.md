# SSBI-10 — 파일 전체 교체·복원

기준 develop-v2 `a630fbfa` 이후. 기존 통과 제작/차트/AI 전체는 반복하지 않고 신규 교체 조건만 실행한다. codex/gpt-6-luna 유지, 수동 기능은 모델 호출 없이 검증한다.

| ID | 입력·기대 | 상태 |
| --- | --- | --- |
| VERSION-01 | 정상 CSV 전체 교체. 같은 소스·지표·대시보드 ID/정의/배치 유지, 새 합계·차원·날짜 범위, reload | PASS: source24/metric30/dashboard26 유지, 독립 Decimal 합계60→220, channel40/20→120/100·날짜 범위 갱신, 분석 revision/정의 동일 |
| VERSION-02 | 동일 원본 파일 hash no-op(이름 변경 포함). 포인터·이력·revision 불변, 후보 파일 제거 | PASS: actual201 unchanged=true·이력2개/revision 동일. 하위 spy로 DuckDB import 호출0 확인 |
| VERSION-03 | 컬럼 이름/타입/추가 컬럼·파싱 오류는 차단, 마지막 정상 수치/파일 유지 | PASS: 실제 타입 mismatch400·malformed JSON400 및 하위 이름/추가 컬럼 차단, 후보 제거/기존 결과 보존 |
| VERSION-04 | 이전 버전 명시 복원 후 reload/원래 정답, 확인 취소는 변경 없음 | PASS: Tab 확인/취소·Enter 복원201, 원래60/채널40·20/날짜3개 및 지표/배치 유지 |
| VERSION-05 | 타계정/공유 토큰·없는 버전·경로 입력·stale/CAS 동시 교체 차단 | PASS 선택: 실제 타계정3종403·stale2종409·없는/경로 version400. CAS 동시1승/1패·공유 토큰은 하위 검사 |
| VERSION-06 | 최대5버전 한도·실패 후보 정리·원본 삭제 시 이력 정리·legacy 읽기 호환 | PASS 하위: 최대5·same-file no-op/복원 허용, DB 저장 실패/후보/원본 삭제·legacy 호환. 자동 GC/crash 복구 NOT_RUN |
| VERSION-07 | 390px 가로 overflow 없음, 키보드 파일 교체·확인/취소·복원·버전 재조회, 서버 오류 안내 | FAIL→PASS 선택: 모바일 표 줄바꿈/선 차트 상단축 잘림 보정. 문서390=scrollWidth390, Tab 확인·취소·Enter 저장/복원/새로고침. OS 파일 대화상자/VoiceOver NOT_RUN |
| VERSION-08 | 교체 도중 진행 중 다중 차트 조회는 한 버전 고정, 이후 조회·프로파일/차원 캐시 새 버전 사용 | PASS: 실제 profile/차원 옵션/날짜 캐시 갱신. 실제 DuckDB 회귀로 중간 교체에서도 schema·3차트/추세/옵션 시작 버전 고정 |

범위는 관리된 단일 uploaded_data 파일(CSV/JSON/Parquet)의 전체 스냅샷이다. 정규화 후 이름/타입이 정확히 같은 스키마만 허용한다. 자동 컬럼 매핑·통화/업무 의미 검증·Commerce 묶음 갱신·증분/CDC는 별도다. 파일 목록에 내부 경로/접속 설정을 반환하지 않는다. 버전은 최대5개로 제한하며 자동 GC를 하지 않는다. 보관 파일은 명시 소스 삭제 전까지 남으므로 백업에 metadata DB와 전체 upload 볼륨을 함께 포함한다.

기존 대시보드는 현재 활성 데이터를 읽으며 정의 snapshot이 데이터 자체를 고정하지 않는다. 교체하면 다른 사용자의 연결된 공유 조회에도 활성 데이터가 적용된다. 보관 버전 복원은 데이터를 바꾸는 명시 작업이며 확인 UI를 제공한다.

## 구현·운영 경계

같은 소스 ID의 encrypted connectionConfig에 현재 파일 포인터·원본 hash·업로드 시각/행 수·최대5개 버전을 저장한다. 새 테이블/마이그레이션/패키지/별도 데몬은 추가하지 않았다. 새 파일은 기존 DuckDB worker로 가져온 후 정규화된 이름/타입 전체를 비교한다. expectedRevision과 DB의 원래 connectionConfig·owner를 WHERE에 넣은 원자 update로 한 요청만 반영한다. 실패한 요청의 incoming/후보만 지우고 기존 정상/보관 파일은 건드리지 않는다. 미등록·import 종료 후보는 worker queue와 독립된 정리 경로를 사용하고 정리 오류가 원래 요청 오류를 덮지 않도록 한다. 파일시스템 삭제 실패는 경고로 남으며 자동 orphan 복구를 뜻하지 않는다. 버전 목록에는 경로/hash/접속 정보를 노출하지 않고 일반 소스 목록에서도 private fileVersions를 제외한다. 기존 일반 접속 정보의 현재 filename 공개 계약은 이번에 전면 변경하지 않았다.

같은 원본 hash·동일 형식이면 stream hash 확인 후 재수입을 생략하고 포인터/수정시각/이력을 유지한다. 파일 이름 변경만으로 버전을 늘리지 않는다. legacy 원본은 첫 조회에서 읽기만 하고 첫 교체에 이력을 채택한다. 복원은 보관 ID만 허용하며 직접 경로 입력은 차단한다. 조용한 타입 변환/컬럼 매핑을 하지 않는다. 타입 추정이 바뀌면 새 소스로 연결하거나 원본 형식을 맞춰야 한다.

조회 요청의 AsyncLocalStorage에 선택 파일을 고정해 전체 대시보드 schema/위젯/옵션/날짜 범위/추세를 같은 버전으로 실행한다. 후속 요청은 새 포인터를 읽고, profile은 데이터 파일 revision을 포함한 key, 차원 캐시는 파일 revision+schema로 무효화한다. 진행 중 요청을 위해 보관 파일을 자동 삭제하지 않는다. 명시 소스 삭제는 전체 이력을 삭제한다. 서버 crash 직후 미등록 후보 정리/전역 디스크 quota/다중 서버는 이 범위에 포함하지 않았다. 최대5번 보관 후에는 추가 갱신을 차단하므로 장기 파일럿 운영 전 보존/정리 정책이 필요하다.

## 실제 화면·독립 정답

검증 환경 Node24.21.0, FE3483/API4683, 이전 격리 metadata DB/영속 볼륨 재사용. 새 week1.csv3행과 week2.csv4행만 사용했다. week1 합계10+20+30=60, online40/retail20, 2026-01-10~12. week2 합계40+50+60+70=220, online120/wholesale100, 2026-02-01~04. Python Decimal로 원본 CSV를 읽어 API의 숫자·그룹·날짜별 모든 행과 독립 대조했다. 첫 지표/3차트 저장은 갱신 영향의 full-flow 준비이며 이전 정상 제작 케이스를 새 통과로 집계하지 않는다.

교체 후 새 행 수4·프로필/날짜 범위와 대시보드220을 확인하고 reload했다. 분석 revision/SQL/표시/배치가 이전과 완전히 동일했다. 현재 데이터를 참조하므로 structured snapshot의 최초 dataVersion을 새 값으로 덮어쓰지 않는다. snapshot3개가 기존 지표30을 참조함을 SQLite 재조회로 확인했다. 오류 파일 차단 후 결과220 유지, 같은 파일 no-op, 복원 확인 취소→포인터 불변, 복원 확인→원래60과 원래 필터 옵션/날짜 범위 복구를 확인했다.

Aside CLI guide는 읽었으나 daemon auth challenge 실패(Aside 미실행)로 기존 허용 headed Chromium을 사용했다. 숨은 OS 파일 선택창은 setInputFiles로 파일을 넣었으므로 전체 파일 선택 키보드 검증이라고 주장하지 않는다. 실제 Tab 순서는 복원 확인→취소, Enter 취소/복원·버전 새로고침을 확인했다. native select popup/VoiceOver는 기존 제한 유지. product AI 호출0, codex/gpt-6-luna 및 연결/catalog 유지.

## 발견·수정

390px 초기 표는 week1.csv/행 수가 과도하게 줄바꿈됐다. table column 폭28/14/30/28%·모바일12px·짧은 날짜/시간·nowrap header로 보정했다. 복원 확인은 좁은 cell 대신 전체 폭 아래 영역에 옮겼다. 초기 replacement-mobile.png와 최종 versions-mobile-final.png/restore-confirm-mobile.png를 분리 보존했다.

높이3 선 차트에서 상단 값70의 일부가 잘렸다(week2-dashboard-before-axis-padding.png). 선 차트의 plot 상단을12px 확보해 현재 복원 차트의 최댓값30 전체 표시를 확인했다. 두 캡처는 교체/복원 단계의 다른 데이터이므로 같은 데이터 전후 캡처로 보고하지 않는다. NULL·집계·원값 변경은 없다. restored-dashboard-desktop-final.png 및 모바일 최종 캡처를 확인했다.

자동화의 최초 main/button/option 이름 추정과 파일 선택 직후 너무 이른 Enter는 locator/대기 실패였다. 실제 DOM의 link/radio/범주 열을 읽고 enabled 상태 뒤 Enter를 실행했다. 제품 장애나 성공으로 집계하지 않았다.

## 검사·증빙

새 파일 버전 real DuckDB15개·보호 guard6개·profile 새 파일 key1개, snapshot/캐시 신규6개와 영향받는 기존 cache/snapshot2개 PASS. FE 파일 버전 신규18개 PASS; 모바일 표/확인 변경 후 관련5개만 재검사했다. 기존 profile/소유권2개·초기 upload/metadata 실패2개는 변경 경로 영향으로만 재검사했다. 기본 제작16개는 frontend 구현 중 영향 회귀로 확인했고 전체 suite/E2E/기존 대용량/Rill/AI는 반복하지 않았다. same-file 최적화 후 해당6개만 재검사해 import 호출0·한도/CAS/실패 정리를 확인했다. FE 타입·변경 파일lint·production build, BE 변경 파일lint/build PASS. 기존 ts-jest TS5.9/Vite config/Toast UI CSS 경고 및 기존 lint warning은 빌드 실패가 아니다.

외부 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-versions/`. 원본 week1.csv/week2.csv/bad-schema.csv, replacement-results.json/api-boundaries.json/same-file.json/restore-results.json/saved-snapshot.json/verification-results.json. 화면: week1-dashboard-desktop.png, week2-dashboard-desktop.png/week2-dashboard-mobile.png, schema-error-mobile.png, same-file-mobile.png, versions-mobile-final.png, restore-confirm-mobile.png, restored-versions-mobile.png, restored-dashboard-desktop-final.png/restored-dashboard-mobile-final.png. snapshot 회귀 상세는 외부 duckdb-dashboard-snapshot-checks.md. 인증 토큰/비밀번호는 증빙에 기록하지 않았다. SSBI-10 전체의 자동 매핑/의미/운영 범위는 남으며 기존130개 카탈로그 집계는 유지한다.

최종 독립 검토 후 보완: worker queue 포화가 후보 removeImport까지 거절하는 조건을 발견해 미등록/작업종료 후보만 직접 정리하도록 수정했다. 일반 소스 목록에 새 이력 filename/hash가 포함되는 것도 제외했다. 신규2회귀와 변경 초기 upload 실패1회귀 PASS, 실제 일반 목록200에서 fileVersions와 보관 hash가 없음을 추가 확인했다(public-metadata-check.json). 기존 정상 교체/복원 UI 전체는 반복하지 않는다.


## 2026-10-14 VERSION-06·07 — 5개 한도 실제 화면 후속

기준 `codex/self-service-next-20261014` @ `03b85ecc` + 프로필 재조회 안내 수정. 이전 하위 검사로만 확인했던 최대5버전 조건을 실제 HTTP/화면에 연결했다. 정상 파일 갱신 전체·Rill 숫자·기존 저장 보기/차트/AI 조건은 반복하지 않았다.

**PASS_SELECTED_VARIANTS**: 임시 CSV 두 행100×n+200×n(버전1..5)을 준비해 5개 한도에 도달. 실제1440×1000/390×844에서 여섯째 파일 선택→Enter 교체POST400/최대5개 안내, currentVersionId/revision/이력 불변·합계1500 보존을 확인했다. 390px에서 버전1 복원 선택/Enter 확인→POST201·5개 이력 유지·합계300, 같은 내용 파일을 다른 이름으로 재선택→201 unchanged=true·revision/이력 불변, 새로고침 뒤 버전1/current·합계300 유지. 수치는 실제 explore/query와 고정 CSV 산술로 대조했다. 문서 가로 넘침0·버전표/안내/버튼/줄바꿈·포커스 캡처 직접 검토. 파일 선택은 setInputFiles이며 OS 파일창/실기기 터치로 확대하지 않는다.

**발견·수정·재검증**: 복원201 뒤 프로필 재조회가 profile을 비워 FileVersions를 다시 생성하면서 복원 완료 안내가 사라졌다. Explore는 같은 sourceId를 재조회할 때 준비된 profile과 파일 관리 컴포넌트를 유지하고 busy로 변경 동작을 잠근다. 소스가 바뀌면 이전 profile을 비우며, 재조회 실패 시에도 profile을 제거해 낡은 정보로 제작할 수 없게 한다. 신규 회귀로 수정 전 실패를 재현했다. 수정 후 관련 Explore/FileVersions36개 PASS, 추가 재조회 실패 경계와 안내 유지2개 선택 PASS(고유 검사37개). FE 타입·변경 lint·production build/diff check PASS. 최종 브라우저에서도 완료 안내 지속과 위 한도 경로를 재검증했다.

외부 helper의 Promise.json 호출과 unchanged 응답 envelope 위치 가정은 검사 코드 오류로 수정했다. 제품 오류로 세거나 실제 완료 조건을 생략하지 않았으며 마지막 browser-final.log/results.json은 전 조건 완료다. 최초 lint의 테스트 포맷/증가 연산자는 보정 후 통과했다. Aside 기존 탭의 로그인 화면을 확인했으며 대표 뷰포트/파일 입력은 기존 허용된 별도 headed Chromium에서 검증했다. Aside 통과나 VoiceOver 발화로 집계하지 않았다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-version-limit-ui-20261014/`: limit-denied-1440.png/limit-denied-390.png, restore-notice-before-390.png, restored-at-cap-390.png, reloaded-at-cap-390.png, results.json, browser-before.log/browser-after.log/browser-final.log, regression-before.log/regression-after.log, profile-boundary-tests.log, build.log, cleanup.json. 임시 source/metric25~29만 API 삭제/soft-delete했고 DB에서 temporarySources/activeTemporaryMetrics=0·기존 source3/view1 보존을 확인했다. 파일시스템 전체 orphan scan·crash 복구를 수행했다는 뜻은 아니다.

이번 코드/검증 기록은 미커밋. 자동GC·crash 복구·장기 보존 정책·다중 서버/tenant·실기기·VoiceOver는 미검증/BLOCKED 유지. gpt-6-luna 설정 유지/AI 호출0, 기존130개 카탈로그 완료 집계는 확대하지 않았다.

## 2026-10-14 VERSION-05·07 — stale 교체409 화면과 최신 목록 재시도

기준 `a7dc501d` + 앞선 미커밋 수정 보존. 하위/API에서만 확인했던 오래된 revision의 교체 거절을 실제1440×1000/390×844에서 검증했다. 기존 정상 교체 전체·5버전 한도·정렬/숫자/Rill 조건은 반복하지 않았다. Aside 미실행으로 기존 허용된 headed Chromium/FE3484/API4684를 사용했다. gpt-6-luna 설정 유지/AI 호출0, VoiceOver BLOCKED 유지.

**PASS_SELECTED_VARIANTS**: 별도 CSV v1=100+200(300), v2=200+400(600), v3=300+600(900). 화면이 v1 revision을 읽은 뒤 정상 별도 API 요청이 v2를 먼저 게시한 상황을 만들었다. 화면에서 v3 파일 선택/Enter 교체→실제409·‘다른 화면에서 파일이 변경되었습니다. 최신 버전을 다시 불러와 주세요.’ 안내, v2 revision/currentVersionId/전체 이력 불변·독립 합계600 보존 PASS. Enter 버전 목록 새로고침200→두 버전/오류 해제·선택 파일 초기화→v3 재선택/Enter201→세 버전·완료 안내 유지·합계900을 확인했다. 선행 교체는 API이며 실제 두 사용자의 동시 클릭·운영 multi-replica CAS 부하로 확대하지 않는다. 파일 입력은 setInputFiles로 OS 파일창 검증이 아니다.

**디자인 수정·재검증**: 모바일 버전 표의 ‘이 버전으로 복원’이 마지막 한 글자까지 줄바꿈돼 가독성이 떨어졌다. 해당 버튼은 좁은 화면에서 ‘복원’, 데스크톱에서는 기존 문구를 표시하고 aria-label='이 버전으로 복원'을 유지했다. nowrap으로 셀 내부 줄바꿈을 막았으며 전역 버튼/표 열/쿼리 계약은 바꾸지 않았다. 별도 버튼 화면에서 두 뷰포트 표시 문구·44px 높이·버튼 양끝이 셀 안에 있음·가로 넘침0·Enter 확인창/Enter 취소·기존 버전 불변을 확인했다. 오류/재시도 흐름 전체를 디자인 확인을 위해 반복하지 않았다.

파일 버전 FE18개 PASS. 최초7개 실패는 MUI Button 테스트 대역이 aria-label을 전달하지 않아 두 반응형 span을 모두 읽은 문제였다. 대역이 실제 접근성 속성을 보존하게 보정한 뒤18개 통과했다. 제품 역할/이름을 우회한 것이 아니며 실제 브라우저에서도 기존 이름으로 버튼을 조작했다. FE 타입·변경 lint·production build·diff check PASS. 예상409의 브라우저 resource error만 별도 허용했고 pageerror/그 외 console.error0, 문서 가로 넘침0이다. 전체Tab/실제 VoiceOver/실기기·장기 운영은 미검증 유지.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-stale-ui-20261014/`: results.json/browser.log, stale-denied-1440/390.png, recovered-1440/390.png(버튼 수정 전), restore-button-1440/390.png/button-results.json/button-browser.log(수정 후), tests.log/tests-after.log/build.log, cleanup.json/button-cleanup.json/cleanup-db.json. 임시 source53~55/metric54~55 API 삭제/soft-delete 후 남은 소스0/활성 지표0·기존 source3/view1 응답 보존 확인. 코드/검증 기록은 미커밋이다.

## 2026-10-14 VERSION-05·07 — 복원 확인 도중 갱신409와 재확인

기준 `a7dc501d` + 앞선 미커밋 수정 보존. 직전 파일 교체409 조건은 재사용하고 아직 실제 화면에서 확인하지 않았던 복원 경로만 선택했다. 같은 FE3484/API4684·격리 QA 환경/허용된 headed Chromium1440×1000/390×844를 사용했다. Aside 미실행 대체 경로이며 VoiceOver BLOCKED/gpt-6-luna 유지/AI 호출0.

**PASS_SELECTED_VARIANTS**: 별도 CSV v1합계300→v2합계600을 준비하고, 화면에서 v1 복원 확인창을 연 뒤 다른 정상 API 요청이 v3합계900을 먼저 게시했다. 기존 확인창 Enter 복원→실제 POST409·expectedRevision=v2/대상=v1 확인·최신 버전 안내·기존 확인창 보존 PASS. 서버 v3의 revision/currentVersionId/전체 이력 불변·독립 합계900을 확인했다. Enter 버전 목록 새로고침200→세 버전/오류 및 낡은 확인창 해제→v1을 다시 선택하고 명시 확인→POST201·expectedRevision=v3/대상=v1·원합계300·세 이력 보존·완료 안내 유지 PASS. 자동 재시도/자동 복원을 하지 않는다.

두 화면 document overflow0·pageerror0·예상409 resource error 외 console.error0, 오류/확인창/완료 안내·모바일 줄바꿈/버튼 배치를 캡처로 확인했다. 모바일 완료 캡처는 프로필 재조회 종료/버튼 활성화를 기다려 다시 저장했다. 원본 복원/파일 선택/5버전/Rill/AI 전체는 재검증하지 않았다. 선행 갱신은 API이며 실제 두 사용자의 동시 UI나 multi-replica CAS 부하로 확대하지 않는다. 실제 스크린리더·전체Tab·실기기는 미검증 유지.

새 제품 결함/수정0. 이전 같은 제품 코드의 FE18개·타입/lint/build 결과를 재사용하고 문서 diff check만 추가했다. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/file-stale-restore-20261014/`: results.json/browser.log, restore-denied-1440/390.png, restored-current-1440/390.png, capture-results.json/capture-final.log, cleanup.json/capture-cleanup.json/cleanup-db.json. 임시 source/metric56~58 API 삭제/soft-delete 뒤 남은 소스0/활성 지표0·기존 source3/view1 응답 보존 확인. 검증 기록과 앞선 코드 수정은 미커밋이다.
