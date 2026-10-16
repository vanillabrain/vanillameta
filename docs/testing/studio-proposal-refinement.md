# Studio 생성안 후속 질문·첫 화면 연결 — 2026-10-16

계획/계약: [studio-proposal-refinement](../plans/studio-proposal-refinement.md). 기준 develop-v2 `ca8305ae` 이후 미커밋 변경. 이전 만료 저장 수정은 drumcap으로 커밋·push 완료했다. 기존 통과 MD는 관련 변경 없는 범위에서 재사용한다.

## 구현

- 첫 화면의 **질문으로 대시보드 만들기** → `/studio/new`에서 파일·샘플·기존 DuckDB 소스 선택 → 질문 → 생성안 → 후속 질문 → 전체 미리보기 → 명시 비공개 저장.
- 후속 질문은 선택 블록 하나 교체 또는 끝에 블록 하나 추가다. 서버의 소유자/소스/버전/TTL 검증을 거친 부모 정의를 사용하며 클라이언트 SQL/정의를 받지 않는다. 새 proposalId, 기존 블록 ID/순서/비대상 정의/대시보드 제목 보존, 최대6개를 강제한다. 임의 다중 블록 수정/대시보드 제목 변경은 이번 후속 질문 범위가 아니다.
- 실패·취소·누락 열 확인 시 이전 성공 미리보기와 질문을 유지한다. 저장 결과 불명확 시 같은 requestId로 결과 확인 전에는 소스·제안 변경을 막는다. 명확한400 저장 거절은 오래된 미리보기를 제거한다.
- 편집기 대화의 생성안에 **이 생성안을 이어서 수정** 링크를 추가했다. 새 탭에서 같은 서버 제안을 읽어 이어가며 원래 실행의 저장 참조는 교체하지 않는다. GET 복원은 모델·저장을 호출하지 않는다. 원래 run-bound 저장과 별개의 비공개 생성이며 링크 TTL은 연장하지 않는다.

## MD 조건과 결과

| ID | 실제 검증/기대 | 결과 |
|---|---|---|
| REFINE-01 | Rill source9, 요청 KPI+device_type 차트 → 실제 gpt-6-luna로 platform_browser 차원 변경. 제목/KPI/대상 ID 유지,40개 그룹 전체 독립 Parquet 값 일치. | PASS_SELECTED |
| REFINE-02 | 평균 입찰 하한 KPI 추가, 기존2개 정의 정확히 보존. 모델 응답은1블록만 수용하고 최대6개 제한. | 실제 추가 PASS / 제한 단위 PASS |
| REFINE-03 | 누락 missing_revenue 열은 추측하지 않고 안내, 기존3블록 유지. 실패/취소/늦은 응답 보존은 FE/BE 회귀. | PASS_SELECTED |
| REFINE-04 | 만료/타 소유자/다른 소스/소스 변경/잘못된 대상/다중·무변경 응답 거절. | 하위 PASS; 실제 TTL 400 PASS |
| REFINE-05 | 최신 제안 → 명시 비공개28 저장 → 동일 requestId 재시도28 → GET/reload 3블록 유지. 원래25/게시 불변. | PASS_SELECTED |
| START-01 | 목록 CTA를 Enter → 데이터 선택 화면. 진입 POST0. 기존 소스9 선택/제안/수정/저장과 연결. 기존 파일 업로드·샘플 설치 통과는 재사용. | PASS_SELECTED |
| REFINE-06 | 390/768/1440 실측 넘침0, 선택36px/입력96px/버튼36px, 모바일 입력16px·데스크톱14px. Tab/Enter 요청·저장 진입. | 디자인/선택 키보드 PASS; 네이티브 선택창 방향키 PARTIAL |

## 환경과 정확성

- Node24, FE3231/API4331. 이번 API는 현재 main `backend-api/dist/src/main.js`이며 기존 격리 설정 디렉터리에서 기동했다. DB `/private/tmp/vanillameta-merge-review-20261016/metadata.db`, uploads `/private/tmp/vm-studio-t6-20261015/uploads` 유지. 원본 사용자 DB 초기화0.
- 처음 새 실행 디렉터리의 설정으로 연결 암호화 키가 달라 profile 복호화가 실패했다. 기존 설정 디렉터리를 유지하고 새 빌드만 절대경로로 실행해 해결했다. 키·인증정보를 출력/복사하지 않았다. 이 실패를 제품 데이터 오류로 간주하지 않는다.
- 지정 Ego TaskSpace11에서 실제 gpt-6-luna 생성/변경/추가를 실행했다. 작업 중 HMR이 생성 상태를 초기화해 준비용 생성을 다시 한 구간은 수치 회귀 반복/성공 횟수에 중복 합산하지 않는다. 로컬 LLM/다른 모델 fallback0.
- 공식 `auction_data.parquet`: **1,391,572행 / 요청634,513,000**. 브라우저40개 그룹 전체 일치(Chrome Mobile243,987,400 / Chrome140,138,000 등). 평균 **5.571238676523278**, 원본 독립 집계 **5.57123867652688**, 부동소수 합산 순서 차이 약3.6e-12이며 표시 **5.57 USD** 일치.
- 미리보기 후 dashboard26/metric36/publication8 유지, 쓰기0. 명시 저장 후 dashboard27/metric37/publication8. private28의 게시0, 원래25 SHA-256 동일. 동일 저장 재확인도28이다. 비공개28은 검증용으로 보존했다.
- 초기 제안 `aaab18f0-386f-42ab-a4b0-666ee56e378d` → 차원 수정 `0a19cb17-77cf-46c2-86c0-ca6e88ba13cc` → KPI 추가 `70a63655-b42a-4793-a044-43944a67e573`. 초기 제안은 서버 재시작 없이 **799.57초** 경과 후 GET400을 확인했다. 저장 후 소모된 제안과 구분되는 실제 TTL 증빙이다.
- 최종 API/저장 문서·부모 보존·oracle·DB 개수·TTL은 JSON 증빙으로 확인했다. SQL/정의 전체가 사용자 공개 링크로 전송되거나 새 게시가 생성되지 않았다.

## 디자인·화면 캡처

기능 PASS와 디자인 PASS_SELECTED를 구분한다. 기존 shadcn 토큰/primitive 재사용, 추가 의존성0. 넓은 화면에서 후속 질문 버튼이 입력에서 멀리 떨어지는 정렬을 발견해 액션 행도540px로 맞췄다. 최종1440px 입력/버튼 오른쪽683.5px,768px595px,390px338px로 일치한다.

Ego `Page.captureScreenshot`는 같은 공간/새 결과 탭에서도 시간 초과됐다. DOM/실제 요청 조작은 정상이었다. OS `computer-use`의 같은 Ego 창 캡처로 대체해 실제 이미지를 저장·확인했다. 캡처에는 Ego의 제어 테두리/오버레이가 포함되고,390px는 큰 창 안의390px CSS viewport이므로 오른쪽 빈 영역은 제품 overflow가 아니다. 최종 데스크톱·모바일 패널/포커스·누락 열 안내와 저장 화면을 확인했다.768은 DOM 치수 확인이며 별도 최종 캡처를 저장하지 않았다. 색 대비/전체 스크린리더 PASS로 확대하지 않는다.

네이티브 선택의 방향키 확정은 Ego·OS 입력에서 결과를 신뢰할 수 없어 PARTIAL이다. 자동화 selectOption으로 대상 선택 후 실제 Tab/Enter 수정 실행 및 저장을 구분했다. OS 확인 중 Ego 공간 선택기가 열렸으나 원래 TaskSpace11로 복귀했으며 다른 사이트/권한/계정 설정은 변경하지 않았다. VoiceOver BLOCKED, 네이티브 날짜/파일 선택창 전체 키보드·실휴대폰·운영MySQL·새 live Rill UX 대조는 NOT_RUN이다. 파일/샘플 재수집 전체 성공, 편집기 run 링크의 실제 신규 클릭→수정→저장 전체는 이번에 반복하지 않았으며 단위 링크/캐시 복원과 별개로 후속 조건이다.

## 검사·증빙

- BE 생성/저장/DuckDB 회귀 **46 PASS**(신규 REFINE4개 포함), BE build·변경 eslint PASS.
- FE Create/대화 생성/응답 validator/첫 화면4파일 **36 PASS**(신규3개 포함), 최종 typecheck·변경 eslint·build·diff check PASS. 클래스/폭 정렬 후 동작 불변 범위의 기존36개 결과 재사용.
- 최초 회귀의 Date→JSON 문자열 비교와 공유 fixture의 지표 재사용 개수 간섭, StudioState envelope 경로 기대값을 수정했다. 테스트 의미/정답을 약화하지 않고 전체 해당 파일46개를 재실행했다. FE 테스트 빈 콜백 lint도 수정했다.
- 독립 검토 에이전트는 provider400으로 실행되지 않았으며 검토 PASS로 기록하지 않는다. 최종 경계/차이는 주 실행자의 코드 검토·대상 회귀·실제 API로 확인했다. 전체 기존 MD/core E2E는 반복하지 않았다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-proposal-refinement-20261016`.

`initial-proposal.json`, `refine-change.json`, `refine-append.json`, `comparison.json`, `oracle.json`, `save.json`, `saved-reloaded-and-ttl.json`, `baseline.json`, `final-verification.json`, `layout.json`, `onboarding.json`.

대표 캡처: `refinement-390-native.png`, `refinement-1440-native.png`, `saved-28-native.png`, `onboarding-390-native.png`. 캡처는 생성 후 직접 확인했다. Ego 업데이트 알림은 기록만 하고 업그레이드하지 않았다.

## 편집기 대화 이어받기 후속 — 2026-10-16

기준 `582c41cf`. 이번에는 기존 REFINE-01~06/START-01 전체를 반복하지 않고 아래 연결 조건만 신규 검증한다.

| ID | 입력/기대 결과 | 상태 |
|---|---|---|
| CONV-REFINE-01 | 원래25에 미저장 제목 편집 → 새 대시보드 생성 요청 → gpt-6-luna 제안 → 이어서 수정 링크. 원래 편집/저장본 유지, 확인 전 쓰기0. | PASS_SELECTED |
| CONV-REFINE-02 | 실제 링크 클릭의 새 탭이 같은 proposalId/source9/정의/숫자를 GET 복원. 자동 AI/저장0. | PASS_SELECTED |
| CONV-REFINE-03 | 복원 제안에서 블록 제목만 후속 수정 → 전체 미리보기 → 비공개 저장/reload. 원래 run/제안·비대상 정의 불변. | PASS_SELECTED |
| CONV-REFINE-04 | 모바일 연결 화면/저장 화면의 넘침·크기·포커스 확인 및 캡처. 원래 편집의 미저장 변경 복귀·되돌리기. | PASS_SELECTED |


Ego TaskSpace13에서 실제 gpt-6-luna 생성 → 실행 기록의 링크 클릭 → 새 탭의 동일 제안 GET 복원 → 첫 숫자 블록 제목만 후속 수정 → 전체 미리보기 → 비공개29 저장 → 새로고침을 확인했다. 원래25의 미저장 제목/1회 편집 이력은 별도 탭 작업 중 유지됐으며 마지막에 검증용 변경만 되돌려 저장된 상태로 복구했다. 원래25에 저장 POST는 하지 않았다.

- 부모 `3a6c44ac-63b9-4c4d-8a0f-96285be26d48` → 수정 `a0742a6f-76ca-48ea-ae38-ff01a2366c9d`. 첫 제목은 `이어받기 수정 요청 수`, 계산식 SUM(bid_request_cnt)·정수 표시·제안 블록ID·비대상 블록은 보존했다. 신규 저장에는 새 영속 블록ID가 발급된다.
- Rill source9 총 요청 **634,513,000**, device_type 차트2블록 저장/reload 일치. DB dashboard27→28, metric37/publication8 유지. 원래 dashboard25·studio_state25 SHA-256 불변, 부모 제안과 원래 실행 기록도 불변이다. 신규 저장 POST1회이며 게시하지 않았다.
- 390px 연결 링크308×36px/글자14px·명시 focus 확인, 연결/저장 화면 가로 넘침0. 실제 키보드 전체 조작은 새로 실행하지 않아 기존 선택 검증 범위만 재사용한다. 데스크톱 저장 화면도 캡처했다. 새 제품 오류는 발견하지 않았다.
- Ego 자체 캡처 시간 초과는 OS의 같은 Ego 창 캡처로 대체했다. 물리 창이 다른 공간을 가리킨 초기 캡처는 증빙에서 제거/교체하고 TaskSpace13의 실제 화면을 확인했다. 이미지의 청색 제어 테두리와 오른쪽 빈 영역은 Ego 오버레이/390px 에뮬레이션이다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-conversation-refinement-20261016`의 `conversation-proposal.json`, `popup-restored.json`, `refined.json`, `saved-reloaded.json`, `verification.json`, `conversation-link-390.png`, `saved-29-390.png`, `saved-29-desktop.png`.
- 제품 코드 변경0. 같은 코드의 BE46/FE36/type/lint/build 통과를 재사용하고 신규 MD 연결 조건만 실행했다. gpt-6-luna/VoiceOver BLOCKED 유지. 실제 휴대폰·운영MySQL·전체 키보드/스크린리더 수용은 이번 PASS에 포함하지 않는다.

## 신규 생성 저장 응답 유실 후속 — 2026-10-16

기준 `7d2b520e`. T15의 실제 브라우저 신규 저장 장애 미검증 조건만 선택한다. 정상 생성은 장애 검증의 준비이며 기존 성공 조건으로 중복 집계하지 않는다. 실제 서버 저장 응답을 받은 뒤 해당 페이지의 일회성 전송 계층 주입으로 응답을 숨긴다. 서버 장애·실제 오프라인과 구분한다.

| ID | 입력/기대 결과 | 상태 |
|---|---|---|
| CREATE-RECOVERY-01 | 실제 gpt-6-luna 제안의 명시 저장 commit 후 응답 유실 → 불명확 안내·제안/소스 변경 차단·같은 요청 확인 활성 | PASS_SELECTED |
| CREATE-RECOVERY-02 | 같은 저장 요청 확인 → 동일 requestId/body·동일 대시보드 한 개·추가 지표/게시 없음·reload 수치 유지 | PASS_SELECTED |
| CREATE-RECOVERY-03 | 390px 오류 안내·차단/재확인 컨트롤과 결과 캡처, 키보드 재확인·가로 넘침 없음 | PASS_SELECTED |


### 실제 결과

- Ego TaskSpace14, 기존 FE3231/API4331·SQLite/소스9를 재사용했다. 지정 gpt-6-luna로 요청 KPI1개 제안을 만들었다. 생성은 준비 단계이며 기존 정상 생성 PASS를 추가 집계하지 않았다.
- 실제 저장 응답을 받은 페이지 API의 일회성 interceptor가 오류를 던지도록 했다. 서버 commit은 실제이며 응답 유실은 페이지 전송 계층 주입이다. 서버 kill·실제 네트워크 단절로 주장하지 않는다.
- 첫 주입은 HMR query 없는 별도 API 모듈에 걸려 정상 저장30으로 이동했다. 이 실행은 장애 PASS에서 제외했다. 실제 로딩된 HMR 모듈 URL로 교정한 뒤 신규 제안 저장31 commit→응답 숨김→불명확 안내를 확인했다.30은 검증 준비용 비공개 자료로 보존했으며 사용자 데이터 삭제·원복 SQL을 실행하지 않았다.
- 오류 상태에서 파일/샘플/저장 소스/새로 확인/지표 선택/생성 질문/후속 질문·수정 버튼 disabled, 기존 숫자634,513,000 유지, 재확인 버튼 enabled를 확인했다.390px 안내·차단 컨트롤 캡처와 가로 넘침0, 재확인 버튼358×36px·14px를 확인했다.
- 재확인 버튼에 focus 후 실제 Enter → 두 저장 body/requestId 완전 동일 → 응답 dashboardId31/31·문서/ID 완전 동일 →31로 이동·reload → 총 요청 **634,513,000**. 재확인에서 새로운 대시보드/지표/게시는 만들지 않았다. 첫 정상 준비30을 포함한 이번 전체 dashboard28→30, metric37→38(준비30 포함 전체 신규1개), publication8 유지이며 원래25 SHA-256 불변이다.
- 제품 오류는 발견하지 않았고 제품 코드 변경0. 기존 BE46/FE36/type/lint/build 결과를 재사용했다. 문서 diff check PASS. 전체 키보드 순서/실휴대폰/운영MySQL/실제 오프라인은 NOT_RUN, VoiceOver BLOCKED와 gpt-6-luna 설정 유지.
- 증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-create-save-recovery-20261016`. `baseline.json`, `uncertain.json`, `retry.json`, `saved-reloaded.json`, `verification.json`과 `uncertain-390.png`, `retry-control-390.png`, `recovered-31-390.png`. OS의 같은 Ego 창 캡처를 직접 확인했다. 제어 오버레이/오른쪽 빈 공간은 브라우저 에뮬레이션이며 제품 넘침이 아니다. 잘못된 다른 공간 초기 캡처는 실제 검증 화면으로 교체했다.

## 생성안 수정 취소·재요청 후속 — 2026-10-16

기준 `7d2b520e` + 검증 문서 변경만. REFINE-03의 실제 수정 중지 UI 조건만 추가한다. 이전 제안이 만료되어 새 제안을 준비하되 정상 생성·저장을 중복 검증하지 않는다.

| ID | 입력/기대 결과 | 상태 |
|---|---|---|
| REFINE-CANCEL-01 | 실제 수정 요청 시작→수정 중지: 기존 미리보기·제목·숫자·질문 보존, 잠금 해제, 저장·게시0 | PASS_SELECTED |
| REFINE-CANCEL-02 | 같은 질문 명시 재요청→새 미리보기, 요청한 제목만 변경·계산식/숫자 유지, 취소된 요청이 최신 상태를 덮지 않음 | PASS_SELECTED |
| REFINE-CANCEL-03 | 390px 취소/재요청 상태·컨트롤·넘침·화면 캡처. 실제 Enter 재요청 | PASS_SELECTED |


실제 Ego TaskSpace15에서 source9/Rill1,391,572행과 gpt-6-luna를 유지했다. 이전 생성안 GET은 만료 안내라 준비용 제안을 새로 만들었다. 실제 수정 POST 전송 후 ‘수정 중지’를 클릭해 취소 안내·이전 총 요청 수634,513,000·질문 보존·입력 활성 복구를 확인했다. 동일 요청 내용을 Enter로 재전송해 새 미리보기를 받았다. 취소 응답은 UI에 적용되지 않았으며 임의 지연 응답 전체 경합은 기존 컴포넌트 회귀 범위로 구분한다. 서버 CLI 자식 종료 자체는 이번에 계측하지 않았다.

부모 `71bbdf36-bebe-44fc-b59f-05243c9c002d` → 재요청 `df420b0a-d2ba-4916-a5e4-4960a93410eb`. 블록ID·대시보드 제목·SUM(bid_request_cnt)·정수 표시·총634,513,000은 유지하고 블록 제목은 `취소 후 재요청 수`가 됐다. 다만 모델이 지표 label도 새 제목으로 변경하고 기존 지표38 참조를 생략했다. 따라서 **수정 취소·재요청과 계산 보존만 PASS_SELECTED**이며 ‘제목만 수정 시 저장 지표 연결 완전 보존’은 통과로 확대하지 않는다. 이 지표 참조 보존은 후속 보완 대상으로 기록한다. 이번에는 저장하지 않아 실제 지표 변경/생성은 없었다.

DB dashboard30/metric38/publication8 전후 동일, 저장·게시0.390px 취소/재요청 화면의 가로 넘침0, 질문/상태 문구 줄바꿈·버튼/포커스 캡처를 직접 확인했다. 기존 정상 저장·다른 차트·전체 테스트는 반복하지 않았다. 제품 코드 변경0·문서 diff check PASS. VoiceOver BLOCKED·gpt-6-luna 유지, 네이티브 선택창·실휴대폰·운영MySQL·모든 늦은 응답 경합은 미검증이다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-refine-cancel-20261016`의 `baseline.json`, `cancelled.json`, `retried.json`, `comparison.json`, `verification.json`, `cancelled-390.png`, `retried-390.png`. 초기 network 응답 버퍼는 공간 전환 뒤 비어 있어 부모 정의는 실제 서버 GET으로 다시 읽어 비교했다(`comparison.json`). OS 캡처는 동일 Ego 공간의 실제 화면이며 제어 오버레이/에뮬레이션 오른쪽 여백을 포함한다.


### 발견 오류 수정·재검증

앞 실행의 지표 참조 누락을 **FAIL→수정→PASS_SELECTED**로 구분한다. 서버는 명시적인 한국어 `제목만` 후속 요청에서 모델의 검증된 제목만 부모 블록에 적용하고 지표·차원·표현·ID 전체를 보존한다. append/일반 내용 수정 경로는 그대로다. 무변경 제목은 기존 digest 검사로 거절한다. 모든 언어·복합/모순 자연어 판별로 확대하지 않는다.

- 신규 회귀는 모델이 제목 외 AVG/지표 label/소수 자릿수까지 바꾼 응답에서 최초 실패를 확인했고, 수정 후 관련 REFINE **5 PASS/42 skipped**였다. BE build·변경2파일 lint·diff check PASS. 새 프런트엔드 변경은 없어 기존 type/lint/build를 재사용했다.
- 같은 API4331만 SIGTERM 후 기존 설정 디렉터리·DB·gpt-6-luna 그대로 재기동했다. 재시작으로 제안이 사라져 새 준비가 필요했고, 처음 network 버퍼 캡처 누락은 실제 UI API interceptor 기록으로 교정했다. 이 준비 실행을 추가 기능 PASS로 집계하지 않는다.
- 실제 gpt-6-luna 동일 제목 질문으로 재검증: `fixed-responses.json`의 부모/수정안 비교에서 **제목 외 블록 완전 동일·저장 지표38/v1·계산/표현 완전 동일**,634,513,000과 가로 넘침0을 확인했다. DB dashboard30/metric38/publication8 전후 불변·저장/게시0. `fixed-verification.json`과 `fixed-title-390.png`가 최종 증빙이다.
- 따라서 이전 문단의 참조 보존 후속 항목은 이 명시 `제목만` 조건에서 해소했다. 취소된 서버 자식 프로세스 종료 자체·모든 자연어·임의 늦은 응답 경합·실휴대폰·VoiceOver는 여전히 별도다. gpt-6-luna·VoiceOver BLOCKED 유지.

## 제목만 수정 후 저장 지표 연결 유지 — 2026-10-16

`7d2b520e` + 제목 보존 수정 diff 기준. 앞 미리보기 PASS는 재사용하고 아래 영속 조건만 검증한다.

| ID | 입력/기대 결과 | 상태 |
|---|---|---|
| REFINE-TITLE-SAVE-01 | 기존 수정안 GET 복원→명시 비공개 저장→reload. 수정 제목 유지·저장 지표38/v1 연결·계산/표현 보존 | PASS_SELECTED |
| REFINE-TITLE-SAVE-02 | dashboard만1개 추가·metric/publication 증가0·원래25 불변,390px 화면·넘침/키보드 저장 | PASS_SELECTED |


Ego TaskSpace16에서 직전 수정안 `71767856-19c9-428a-bc06-6b9c0eb820d9`를 GET 복원해 재사용했다. **새 모델 호출0**.390px에서 저장 버튼 focus→실제 Enter→비공개32 저장 POST1회→reload/GET을 확인했다. 제목 `취소 후 재요청 수`, measureRefs **38/v1**, SUM(bid_request_cnt)·정수 전체 표시·634,513,000이 유지됐다.

DB dashboard30→31, metric38/publication8 유지, 기존 metric38 행·원래 studio_state25 SHA-256 불변이다. 신규32의 publication0. 저장 중복·지표 추가·게시 생성 없이 기존 지표를 재사용했다. 추가 제품 오류/코드 변경0. 직전 수정의 BE 관련5/build/lint PASS를 재사용하고 문서 diff check PASS. 기존 저장 장애·취소·다른 차트는 반복하지 않았다.

1440×800/390×720 실제 화면과 가로 넘침0을 확인했다. 도구32px·저장/게시36px, 카드 제목·정확한 숫자 표시를 확인했다. 캡처는 같은 Ego 창의 OS 화면이며 제어 오버레이와 에뮬레이션 여백을 포함한다. **기능/선택 디자인 PASS_SELECTED**; 전체 키보드 순서·실휴대폰·운영MySQL·VoiceOver는 이번 결과로 통과 처리하지 않는다. gpt-6-luna·VoiceOver BLOCKED 유지.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-title-save-20261016`의 `baseline.json`, `save.json`, `saved-reloaded.json`, `verification.json`, `layout.json`, `saved-32-1440.png`, `saved-32-390.png`. 검증용 비공개32는 재조회용으로 보존했다. 변경/검증 기록은 미커밋이다.

## 수정 대상 네이티브 선택창 키보드 후속 — 2026-10-16

REFINE-06의 PARTIAL 중 방향키·Enter/Escape만 선택한다. 이전 제안은 만료돼 같은 소스의 준비용 생성만 실행한다. 저장/게시·전체 생성 회귀는 반복하지 않는다.

| ID | 입력/기대 결과 | 상태 |
|---|---|---|
| REFINE-KEY-01 | 수정 대상 native select에서 방향키·Enter로 append 선택→기존 블록으로 복귀,Escape/Tab 후 질문 초점·선택 유지 | PASS_SELECTED |
| REFINE-KEY-02 | 390px 대상·질문·포커스·넘침/크기 실제 캡처, 모델 수정/저장/게시0 | PASS_SELECTED |

Ego TaskSpace17의 source9/Rill1,391,572행 제안에서 실제 OS 팝업을 열고 **Down→Return: append**, **Up→Return: 0**, **Down→Escape: 0 유지**를 DOM 값으로 확인했다. 이전 키 입력 무반응은 사용자 기본 Space와 검증 Space의 물리 창 선택을 맞춘 뒤 해소됐다. `selectOption`/스크립트 값 변경으로 대체하지 않았다.

네이티브 앱 Tab은 주소창으로 이동하여 페이지 순서 증빙에서 제외했다. 같은 페이지의 선택창을 focus한 뒤 Ego 실제 keyboard Tab 경로로 TEXTAREA 이동·선택0 유지를 확인했다. 전체 OS 키보드 환경/브라우저 chrome 포커스 문제까지 제품 PASS로 확대하지 않는다.

390×720: 가로 넘침0, 선택창316×36px/입력316×96px·16px 글꼴, 각각 보이는 포커스·라벨·주변 정렬을 실제 캡처로 확인했다. 기능과 선택 디자인 PASS_SELECTED, 제품 변경0. 준비용 gpt-6-luna 생성 외 수정 요청·저장·게시 동작0, DB dashboard31/metric38/studio_publication8 유지. 이전 저장/취소/게시 PASS는 반복하지 않았다. 기존 관련 코드 검사 결과를 재사용하고 문서 diff check를 실행했다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-native-keyboard-20261016`의 `keyboard.json`, `db-after.json`, `select-focus-390.png`, `question-focus-390.png`. 캡처는 같은 Ego 창의 OS 화면이며 에뮬레이션 여백·브라우저 chrome·제어 오버레이를 포함한다. REFINE-06의 native 방향키 조건은 해소했지만 전체 키보드/실휴대폰/운영MySQL·VoiceOver는 별도다. gpt-6-luna·VoiceOver BLOCKED 유지. 변경과 검증 기록은 미커밋이다.
