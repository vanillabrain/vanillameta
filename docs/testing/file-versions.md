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
