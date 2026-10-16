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
