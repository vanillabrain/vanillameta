# UC-022 복사본 AI 편집·재게시 검증 — 2026-10-16

[설계](../architecture/copy-ai-publication.md) · [UC](../use_cases/UC-022-copy-ai-publication.md) · [TC](../test_cases/TC-022-copy-ai-publication.md). 기준 develop-v2 `43377464`, 기존 실행 환경 FE3698/API4899→4898/SQLite, Ego44. 검증한 복제·AI 편집·게시 런타임 코드는 기준 커밋과 동일하다. 종료 시 원격 `707fca2f`까지 fast-forward 통합했으며 추가된 Commerce 로딩/재시도 수정 두 파일은 이번 변경과 겹치지 않는다. 기존 UC021→UC019 연결이 동작해 신규 기능/DB 변경 없이 복사본 전용 회귀 테스트를 추가했다. 증빙은 `/tmp/vm-copy-ai-publication/`, 승인·운영 배포·전체 TC005 수용은 아니다.

## 실제 질문과 저장·게시

원본23의 링크·재사용 허용은 이미 중지 상태다. 수신자 소유 복사본26/source27(공개 Rill 파일 파생 2,000행, 요청 수3배·열 이름 변경), 저장 지표 링크 없이 SQL snapshot만 있는 기존 블록을 사용했다. 비대상 복사본25도 비교했다. 지정 Codex `gpt-6-luna` 설정으로 실제 API201/LLM 결과를 확인했다. 제공자 내부 모델 라우팅을 별도 입증했다는 뜻은 아니다.

1. 첫 질문의 계산식+제목 동시 변경은 한 블록 한 변경 계약에 따라 `clarify`로 종료됐다. 초안·저장·게시 쓰기0. 이 문장을 성공 사례로 집계하지 않는다.
2. **“1번 차트의 요청 수 계산을 현재 요청 수 합계의 두 배로 바꿔줘.”** → content/저장false. 전체3블록 미리보기의 요청 수10,660,800(축약11M), 시간별25점. source27 oracle5,330,400의2배다. 평균3.5034561451116626($3.50)·OS17그룹과 비대상 정의는 유지됐다. 저장 전 조회의 revision은 기존 `d548…704a` 그대로다.
3. **“현재 초안을 저장하고 게시 미리보기로 이어 줘.”** → saveRequested/publicationRequested true → POST26/editor 한 번 → 확정 revision `91f4…dab3`의 게시 미리보기. 링크 공개 전까지 publication version0. 별도 **링크 게시** 버튼으로 복사본 버전1 게시.
4. 복사본 편집기에서 **“1번 차트의 제목을 요청 수 두 배로 바꿔줘.”** → 미리보기. 계산식2배·다른 블록·모든 폭 좌표는 유지. 같은 저장/게시 준비 질문 → revision `dc20…3550` 저장. 이때 로그아웃한 별도 origin의 익명 탭은 여전히 버전1/이전 제목을 표시했다.
5. **이 결과로 재게시** → 같은 UUID의 버전2/새 제목. 익명 새로고침에서11M+추세/$3.50+추세/OS차트 확인. 미리보기와 게시 snapshot의 전체 `datas`, 두 추세의25점, responsiveLayouts를 정확 비교했다.
6. 소유 게시/저장 화면과 익명 화면을 새로고침했다. XHR/fetch 기록상 추가 editor save/publication publish0. 게시 화면은 읽기성 POST preview 한 번을 다시 수행하며 게시 버전은 늘리지 않는다. 저장 화면 GET2회도 쓰기는 아니다.
7. 마지막 **게시 중지** → 비활성 version3, 익명404/중지 안내. 수정한 비공개 복사본26은 보존했다. 원본23·복사본25는 최종 DB revision까지 처음과 일치했다.

`calculation-events.json`, `republish-handoff-events.json`, `public-v1-before-republish.json`, `public-v2.json`, `*-reload-events.json`, `assertions.json`, `final-original-db.json`, `final-revoked.json`에 요청/응답·비교를 남겼다. 인증 정보는 저장하지 않았다. 복사본26의 block ID, 비대상2개 정의, layoutSizes/blockLayouts/responsiveLayouts는 모두 보존됐다.

## 권한과 실패 범위

다른 계정(원본 소유자)의26/editor·publication GET은403, 실제 편집 화면에 편집 정보 오류만 표시돼 질문·저장 폼이 열리지 않았다. 로그아웃한 별도 탭은 accessToken 없음, editor/publication GET401, 공개 화면에는 편집·저장·게시 중지 액션이 없었다. 공개 JSON의 재귀 필드 검사에서 SQL/소스ID/연결/인증/recipe/원본 행을 제외하고 집계 결과만 확인했다.

자동 승인 검토는 다른 계정 세션의 AI·저장·게시·중지 POST 연속 검증을 거절했다. 권한 결함 시 타 계정 데이터·게시 상태가 변경될 위험이라는 이유다. 우회하지 않고 읽기 전용 UI/GET 검증과 서버 회귀로 대체했다. 실제 다른 계정 POST는 NOT_RUN이다. `bi-editor.spec`는 editor/preview/AI/save를 소유권 검사에서 거절하고 provider/저장 호출0을, `publication.service.spec`는 타 계정 state/preview/publish/revoke 거절·게시 생성0을 검증한다.

첫 selector textarea 대기는 input인 TextField의 검증 스크립트 오류였다. Ego의 Target.createTarget은 제공 표면에서 거절돼 만든 빈 컨텍스트만 정리했다. localhost.는 Vite host 거절로 사용하지 않았다. 이후 테스트 계정의 정상 UI 로그아웃과 별도127.0.0.1 익명 탭으로 검증했다. 이를 제품 권한 결함이나 전체 브라우저 차단으로 보고하지 않는다.

## UI·Rill 비교

기능 PASS와 디자인 PASS를 구분한다. 질문·전체 미리보기·게시 준비·저장/익명 화면의 대표 상태를 캡처하고 직접 확인했다. 모바일390/데스크톱1440, 소유 화면의 태블릿 요청768은 Ego origin 확대율의 정수 반올림 때문에 CSS767로 실측됐다. 익명 화면은390/768/1440 정확 실측이다. 초기 `ai-preview-*`/`publication-preview-*`는 배율 보정 전이므로 폭별 합격 증거에서 제외하고 `title-ai-preview-*`, `republish-preview-*`, `final-saved-*`, `public-v2-*`를 사용한다. 측정 JSON에 실제 CSS 폭을 남겼다.

- 모든 대표 화면의 문서 가로 넘침0. 모바일 질문 입력/실행 버튼은 세로로, 게시 버튼은 자연스럽게 줄바꿈한다. 고급 목적/블록 설정은 접힌 상태를 유지한다.
- 질문/게시 일반 액션·입력36px, 저장 도구줄32px, 본문14px·보조12px 등 현재 shadcn UI Kit와 역할별 크기를 확인했다. 국소28/32px 컨트롤을 부모 전역 selector로 덮어쓰지 않았다. 요구사항 NFR001의 이전 MUI28/32px·Verified 표기는 UI001 기준과 맞추고 전체 새 UI 수용은 In Progress로 남겼다.
- 모바일 공개 화면은 숫자+추세2개와OS차트를 세로로 표시한다. 태블릿/데스크톱의 큰 공백과 아래쪽 첫 블록은 기존 저장 좌표 그대로다. 제목 변경을 이유로 사용자 배치를 자동 압축하지 않았다.
- Rill9009의 요청 수/평균과 시간별 추세·OS차원을 실제 확인했다(`rill-reference.png`). 현재 Rill은 이동된 전체1.39M행/635M/$5.57, 이 검증은2000행·열 이름·요청 수가 바뀐 파일/UTC이므로 두 화면 총액의 동등성 PASS로 보고하지 않는다. 숫자+추세 결합과 차원 이름/표현을 비교했고, 복사본 정답은 source27 oracle 및 전체 preview/snapshot 비교로 판정했다. 이번에 Rill에 동일 변형 소스를 적재하거나 Rill AI/배포를 실행한 것은 아니다.

`public-v2-390.png`, `title-ai-preview-390.png`, `republish-preview-390.png`, `final-saved-1440.png`, `other-actor-denied.png`, `public-revoked.png`가 핵심 캡처다. 로딩·clarify·접근 오류도 확인했지만 모든 오류/포커스/긴 라벨 조합의 디자인 PASS는 아니다.

## 자동 검사와 남은 gate

BE3 suites166개(편집/게시/의도), FE편집79개(UC022 신규1개 포함)+게시/표시25개, FE type/변경 파일 eslint/build PASS. 로그는 `be-targeted.log`, `fe-editor.log`, `fe-publication.log`, `fe-type.log`, `fe-lint.log`, `fe-build.log`. 이번 복제·AI 편집·게시 런타임 코드 변경이 없어 이전 UC021의 전체BE1667/FE1006·root build를 다시 실행하지 않았고 신규 PASS 수에 합산하지 않았다. 원격 Commerce 통합 후 해당 로딩 회귀11개와 FE type/build를 별도 실행했다(`fe-remote-commerce.log`, `fe-integrated-type.log`, `fe-integrated-build.log`). 전체 core Playwright도 이번에 재실행하지 않았다.

strict spec lint의 기존12오류는 UC007~010 형식/다이어그램 누락이며 이번 UC022 신규 오류0이다. 의미 리뷰는 별도 executor가 수행했다([기록](../architecture/UC-022-review.md)). pin/check는 drift 검사이며 승인 증거가 아니다. UC/TC Draft, packet awaiting_review/acceptance not_recorded를 유지한다.

실제 다른 계정 변경 POST, 운영MySQL·실휴대폰/터치·모든 자연어/복구 오류·안전 집계 미지원 AI식의 게시 복구·전체TC005는 NOT_RUN이다. 이번 성공 질문의 모델 분류 결과를 모든 문장의 보장으로 확대하지 않는다. 다음 제품 gate는 새 기능을 늘리기보다 TC005 전체 여정을 최신 UI에서 묶고 남은 권한/복구 경계를 선택 검증하는 것이다.

## UC024 제외 복사본 후속 — 2026-10-16

기준 develop-v2 `f3279ffe`와 이번 선택 응답 교정 변경이다. Ego59 하나, 기존 FE3698/API4899→4898/SQLite와 지정 Codex `gpt-6-luna`를 사용했다. UC024에서 평균 블록을 제외한 수신자 복사본35/source30은 원본27과 독립이며 원본 링크는 이미 중지 상태였다. 새 DB·의존성·LLM 대체·Studio 대화 전환 없이 기존 질문 UI를 검증했다. 실행 증빙은 `/tmp/vm-excluded-copy-ai/`다.

### 발견과 보완

첫 “1번 차트의 요청 수 계산을 현재 요청 수 합계의 두 배로 바꿔줘.”는400으로 실패했고 질문/초안을 유지했다(`calculation.json`). 같은 질문의 재시도는201이었지만 실제 정의·수치가 이전 SUM/634,513,000 그대로였다(`retry-calculation.json`). 이때 후속 저장/게시 준비 질문까지 실행돼 변경 없는 정의의 새 revision이 저장됐으나 링크는 게시하지 않았다. 단순히201·미리보기 표시를 계산 변경 PASS로 간주하지 않고 해당 시도를 실패 증빙으로 남긴다.

내용 편집 경로가 생성기에 `requireSelectedChange:true`를 전달하도록 보완했다. 선택한 검증 정의가 기존과 동일하면 기존 최대2회 교정 루프에 넣고, 계속 같으면 ERROR로 종료해 편집기의 성공 미리보기/자동저장을 막는다. 일반 생성의 유지 요청은 그대로다. 이 비교는 정규화된 정의의 동일성 검사이며 모든 SQL 의미/자연어 일치를 증명하지 않는다. 실제 수치 검증을 계속 수행한다. 첫 시도의 일반400 원인은 응답에서 세분화되지 않으므로 특정 제공자 장애로 단정하지 않는다.

[설계 후속](../architecture/copy-ai-publication.md) → 교정 성공/2회소진·저장 불변 회귀2개 및 편집기 플래그 연결 단언 → BE build → 기존4898만 새 코드로 재기동했다. 새 회귀의 첫 배치는 fixture scope 밖에 삽입돼 컴파일 실패했으며 올바른 기존 fixture 안으로 옮겨 최종 통과했다. 이를 제품 동작 실패와 구분한다.

### 실제 수정·저장·게시

1. 같은 자연어 질문을 보완 후 다시 실행했다. 실제 SQL `SUM("my_requests") * 2`와1,269,026,000, 시간별169점 각각2배를 확인했다. OS28그룹 값·정의·2개 블록ID·모든 폭 배치·원본27은 유지됐다. 미리보기 중 저장 revision은 앞선 변경 없는 저장 이후 상태 그대로였다(`fixed-unsaved`, `fixed-calculation`).
2. “현재 초안을 저장하고 게시 미리보기로 이어 줘.” → saveRequested/publicationRequested true → 복사본35/editor201 한 번 → 반환 revision의 게시 미리보기201. 명시 **링크 게시**로 버전1을 공개했다. 공개 JSON은 인증 헤더 없는 fetch로도 조회되며 source/SQL/recipe/인증 필드는 없다.
3. 편집기로 돌아가 “1번 차트의 제목을 요청 수 두 배로 바꿔줘.” → SQL2배/OS/배치를 유지한 전체 미리보기. 같은 저장/게시 준비 질문으로 저장했다. 이때 공개 링크는 여전히 버전1/이전 제목으로 전체 응답이 동일했다.
4. **이 결과로 재게시** → 같은 UUID의 버전2. 공개 새로고침에서 새 제목·1B(원래 compact/소수0 표시, 정확한 값1,269,026,000)·169점 추세·OS차트를 확인했다. 게시와 미리보기의 숫자·추세 모든 점·OS28범주 값·responsiveLayouts를 비교했다. OS의 동점 값들은 원래SQL에 tie-breaker가 없어 배열 순서가 바뀔 수 있으므로 범주별 값으로 비교했다.
5. 소유 게시/저장·공개 화면을 실제 새 문서로 reload하고 XHR/fetch를 기록했다. 추가 editor save/publish0이며 게시 preview와 dashboard-preview는 읽기 계산으로 구분했다. `original-before/after`, `original-publication-before/after`는 전체 동일하고 `copy-reloaded`와 최종 중지 후 복사본도 동일했다.
6. 명시 **게시 중지** → version3/inactive·공개404/중지 안내. 수정한 비공개 복사본35는 보존한다. 원본27이나 기존 다른 복사본/소스를 변경·삭제하지 않았다.

`fixed-save-handoff`, `title-change`, `title-save-handoff`, `publication-v1/v2`, `public-before-republish`, `public-v2`, `*-reload-audit`, `publication-final`, `public-revoked`, `assertions.py/json`에 기록했다. 기존 거절된 타 계정 변경 POST는 재시도하지 않았다. 공개 탭은 별도 origin의 원본 소유자 로그인 상태였으므로 익명 브라우저 로그인 세션 검증으로 표기하지 않는다. 인증 헤더 없는 공개 GET과 공개 whitelist를 확인했다.

### UI·검사와 범위

기능 PASS / 대표 디자인 PASS. `fixed-ai-preview`, `title-preview`, `republish-preview`, `saved-final`, `public-v2` 캡처를 실제로 읽고 입력/버튼36px·도구32px·입력16px/본문·버튼14px, 같은 행 높이·모바일 질문 행 세로 정렬·게시 버튼 wrapping·폰트/간격·주변 컨트롤을 확인했다. 소유390/769/1440, 공개390/768/1440 CSS폭에서 가로 넘침0이다. 소유 태블릿768 요청은 기존 사이트 배율 반올림으로 실제769다. 고급 설정은 접히며, 원래 저장된 아래쪽 숫자 블록 좌표와 공백을 자동 압축하지 않았다. `public-v2-full-390.png`·`saved-final-full-390.png`는 숫자+시계열까지 포함한다.

BE3 suites167개(생성/편집/게시)·FE2 files102개(편집/게시)·BE build·변경 BE eslint(오류0/기존경고6)·FE type PASS. FE코드/스타일 변경이 없어 직전 통합 build/core 결과는 재사용하고 새로 실행한 것으로 집계하지 않는다. Main은 구현 후 별도 diff/명세 리뷰에서 내부 플래그 적용 범위·교정 최대2회·원본/비대상 보존·추가쓰기 경계를 대조했다. 독립 외부 리뷰/사람 수용으로 표기하지 않는다.

원본 canonical Rill 데이터 수치 비교는 UC024/TC005의 기존 oracle을 재사용했고 새 요청 지표는 그 합계와169개 시간값의2배로 판정했다. 이번에 Rill 화면/AI를 새로 실행하지 않았다. 물리 휴대폰·운영MySQL·모든 자연어/의미상동일SQL·모든 실패 상태/동시경합·Studio 전체 여정·제품 최종 수용은 Open이다.

이번 strict spec lint도 기존12오류/33경고/4정보(UC007~010 형식·상태 등)를 유지했고 UC022/TC022 신규 오류는0이다. 변경 문서 링크와 diff whitespace, pin/check는 PASS이며 Draft·사람 수용 상태는 바꾸지 않았다.
