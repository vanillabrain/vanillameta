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
