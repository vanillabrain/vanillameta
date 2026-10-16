# Studio shadcn 전환 검증 — 2026-10-16

## 목적과 변경 계획

기준 develop-v2 bbd55328. 기존 UI Kit의 shadcn/Radix, 공유 primary·border·muted 토큰, 36px 기본/32px 도구 버튼,14px 본문을 Studio 생성·편집·대화·설정·게시·복제에 적용한다. 기존 API/블록 ID·정의·배치·필터·저장·게시 권한은 바꾸지 않는다.

1. 기존 Button/TextField/Notice/Checkbox/Dialog/Sheet 재사용, MUI 전용 props·아이콘 제거.
2. 모바일 Sheet의 단일 portal subtree·입력 상태·포커스 보존. 모달 Title/Description·닫기/Tab/Escape 보장.
3. Studio CSS의 하드코딩 색/제어 크기 덮어쓰기·구형 테마 경계 제거. 마지막 MUI 사용 제거 후 의존성과 lock 정리.
4. 기존 동작 회귀를 변경한 Studio 컴포넌트 검사로 고정하고, 화면별 실제 캡처/치수로 별도 기능·디자인 판정.

기존 UI 단위 테스트를 회귀 기준으로 사용한다. 이미 통과한 SQL·LLM·게시 수명주기 전체는 반복하지 않는다. gpt-6-luna 유지, VoiceOver BLOCKED 유지. 모델 신규 호출 성공을 주장하지 않는다.

## MD 조건

| ID | 조건 / 기대 결과 | 상태 |
| --- | --- | --- |
| STUDIO-UI01 | 편집 저장본25 Rill 총634513000과 블록 제목/차트 유지.1440/768/390에서 가로 넘침0·공통 크기·색·정렬 | PASS_SELECTED |
| STUDIO-UI02 | AI 패널 Enter로 열기·Tab 순환·Escape 닫기/포커스 복원. 작성 중 텍스트를 유지하며1440↔390 전환 | PASS_SELECTED |
| STUDIO-UI03 | 블록 설정의 라벨/입력/선택·숫자 표현·되돌리기. 키보드 선택과 배치 제어 유지, 저장 API 반복 불필요 | PASS_SELECTED |
| STUDIO-UI04 | 공통 기간/필터 펼치기·입력/선택·닫기. 기존 범위가 UI 전환으로 변하지 않음 | PASS_SELECTED |
| STUDIO-UI05 | 생성 화면 소스 선택·지표 체크·질문 라벨. 모바일·긴 이름·로딩/오류 안내/키보드, 제안·저장 쓰기 없음 | PASS_SELECTED |
| STUDIO-UI06 | 게시 Dialog/기존 게시 뷰어/내 데이터 복제. 기존 링크·원본 불변, Tab·Escape·닫기와390px 스크롤. 새 공개/중지 없음 | PASS_SELECTED |
| STUDIO-UI07 | MUI/Emotion import·CSS·테마0, 제거 후 FE 타입/lint/build/관련 회귀 통과 | PASS |

기능 PASS와 디자인 PASS는 캡처 확인 후 분리 기록한다. 실휴대폰·실VoiceOver·실LLM 재생성·모든 장애 상태는 이번 범위 밖이다.

## 실행 환경·기능 결과

- 화면 검증 당시 기준 커밋 `bbd55328`의 develop-v2 미커밋 변경이었다. Node24, npm clean ci(legacy-peer-deps), FE localhost:3231 / 기존 격리 API localhost:4331. 메타데이터는 이전 검증 DB의 복사본 `/private/tmp/vanillameta-merge-review-20261016/metadata.db`다. 원본 사용자 DB는 초기화하지 않았다.
- 지정 Ego 브라우저 TaskSpace4에서 실제 실행했다. 기본 샌드박스의 연결 실패 뒤 승인된 실행으로 같은 공간을 재사용했다. 새 결과를 기존 MUI 화면의 PASS로 대신하지 않았다. 종료 시 뷰포트 override와 임시 공간을 정리했다.
- UI01: 저장본25/source9, Rill **1,391,572행 / 총 요청634,513,000** 유지. 1440×1000 / 768×1024 / 390×844의 canvas를 확인했다. SQL/oracle는 기존 통과를 재사용하며 이번에는 새 UI가 같은 숫자를 표시하는지 확인했다.
- UI02: Enter로 AI 패널 열기, 입력 후1440→390→768→1440 전환에서 같은 질문 유지. 모바일에서 textarea 다음 Tab은 전송, 다음 Tab은 패널 AI 탭으로 순환하며 외부로 빠지지 않았다. Escape 후 AI 열기로 복원. gpt-6-luna 표시 유지, 전송은 실행하지 않았다.
- UI03: 블록 설정 Enter 진입→제목 수정→Enter 적용→키보드 되돌리기로 원래 제목 복원. 숫자 표시/소수 입력은 실제 Label과 값 연결을 확인했고 native select UI 선택 값 compact/1을 확인했다. 별도 formatter 수치/OS 네이티브 select 방향키 확정은 이번 브라우저 PASS에 포함하지 않는다. 기존 컴포넌트 표현·history 회귀는 통과했다. 설정 원래 버튼이 breakpoint 전환 중 교체돼도 같은 aria-label의 새 버튼으로 Escape 포커스를 복원한다.
- UI04: 모바일에서 기간·필터를 Enter로 펼쳐 36px 입력·날짜 라벨·도움말·버튼을 확인했다. 적용하지 않은 전체 기간/필터 없음 유지. 실제 필터 변경 집계·OS 날짜 popup은 기존 통과를 재사용하고 반복하지 않았다.
- UI05: `/studio/new?sourceId=9`에서 공식 Rill profile 1,391,572행/21열과 저장 지표를 조회했다. Space로 체크 선택/해제를 확인하고, 질문 입력 후 폭 변경에도 보존했다. 지표·차트 제안/파일 업로드/저장은 실행하지 않았다. 많은 지표는264px 내부 목록으로 스크롤하며 질문 입력 영역이 계속 아래로 밀리지 않는다.
- UI06: 저장본25 게시 Dialog에서 Tab이 안에 머물고 Escape가 게시·공유 버튼으로 돌아온다. 390px Dialog 폭358px/좌우16px, scrollWidth390. 기존 게시본20 v1(2023-09-10~11, Mobile/Tablet)의 **90,789,400.00 / 5.922633** 유지. 동일 source9로 내 데이터 복제의 필수5열 자동 매핑과 미리보기를 확인했다. 새 대시보드 생성·게시·중지·복제 저장은 실행하지 않았다. 권한·만료·busy 거절은 변경한 real-portal 단위 회귀를 사용한다.

## 디자인 결과

UI01~06의 관찰한 정상/선택/비활성/포커스 상태는 **디자인 PASS_SELECTED**다. 실제 캡처를 확인하고 기능 숫자와 분리해 판정했다.

- 공유 primary `#4f46e5`, 공통 border/muted/card 토큰과 lucide 아이콘을 사용한다. 전용 파란색 MUI 테마/412줄 테마 파일과 경계를 제거했다. `.Mui*` 셀렉터/구형 MUI mock/import/Emotion 의존성도 남아 있지 않다.
- 데스크톱 실제 도구 버튼32px, 게시·공유/저장36px, 버튼 글자14px. 입력36px, 모바일 입력16px 글자로 공통 primitive 기준을 따른다.
- 390/768/1440에서 문서 가로 넘침0. 표·목록은 내부 스크롤을 사용한다. 모바일 AI panel 높이844px, composer 하단844px로 화면 끝에 맞는다.
- 본문/보조문구 위계, 제목·값·선택 상태, 인접 컨트롤의 높이·정렬·줄바꿈을 확인했다. 실제 긴 임의 지표명을 추가해 저장하는 시험은 하지 않았으며 줄바꿈 경계는 CSS·검토로 보완했다.

## 발견·수정·재검증

1. 모바일 Sheet에서 desktop rail로 옮길 때 이전 focus scope와 즉시 focus 복원이 경합했다. subtree 이동 후 requestAnimationFrame에 복원하도록 바꾸고 동일 입력·뷰포트 왕복을 다시 통과했다.
2. breakpoint 변경으로 그리드 설정 버튼 DOM이 교체되면 닫힌 패널의 원래 버튼 참조가 끊겼다. 같은 aria-label 버튼을 다시 찾고, 해당 버튼이 없으면 AI 진입으로 복원한다. 실제1440→390→Escape와 회귀 추가로 통과했다.
3. 독립 검토에서 충돌 Dialog의 trigger 없는 포커스 복원 누락과 Label 구조 변경 뒤 긴 지표명 셀렉터 불일치를 발견했다. explicit restore/검사와 새 label 셀렉터를 적용했다.
4. native select 전환에 맞춰 기존 MUI mouseDown/option 클릭과 checked DOM 속성 가정을 native change/aria-checked로 수정했다. 의미 확인 실패 후 질문/버전 보존·타입이 다른 필터 값 유지 검증은 약화하지 않았다. 모달 배경을 숨기는 실제 Radix 동작에 맞춰 기존 저장 버튼 참조와 닫힌 뒤 접근성을 검사했다.

## 실행한 검사와 재사용

- 최초 Studio UI/라우트 선택 실행:11파일 중8 PASS/3 FAIL(1개는 잘못된 hook import로 수집 실패),63 PASS/2 FAIL. 수정한 Editor26/Create6/Filter5 및 PanelSurface3의 재검증 PASS. 고유 UI 검사 **93개 PASS**이며 한 번의 전체 명령으로 모두 통과했다고 표기하지 않는다. 나머지 통과 파일은 관련 동작 변경이 없으면 재사용했다.
- 게시·복제19개는 최종 액션 variant 정리 후 별도 재확인 PASS. 새 panel 회귀2개는 real Sheet의 Escape/포커스와 trigger DOM 교체를 검증한다.
- MUI 제거 후 clean npm ci PASS. 최종 FE `tsc --noEmit`, 변경 Studio/라우트 eslint, FE `npm run build`, `git diff --check` PASS.
- backend/LLM/SQL/저장/공유 수명주기의 이전 통과 전체 suite는 반복하지 않았다. 이번 UI를 제품 전체 TC005 통과로 확장하지 않는다.

## 증빙

폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-shadcn-20261016`.

최종 대표 캡처: `editor-desktop-final.png`, `editor-tablet-final.png`, `editor-mobile-final.png`, `ai-mobile-final.png`, `settings-desktop-final.png`, `settings-mobile-final.png`, `filters-mobile.png`, `create-desktop-final.png`, `create-mobile-final.png`, `publication-mobile.png`, `remix-desktop.png`, `remix-mobile.png`. `ui-measurements.json`은1440px 최종 DOM 치수와 primary/MUI 노드0을 기록한다. 첫 캡처/이름에 initial이 있는 파일은 중간 상태이며 최종 판정에는 위 대표 파일을 사용한다. `published-mobile.png`는 게시 뷰어의 수치·범위·모바일 배치 증빙이며, 이후 헤더의 복제 버튼을 primary/다시 확인을 outline으로 정리하기 전 캡처다. 해당 액션 variant의 최종 상태는 코드 검토·게시/복제19개 회귀·빌드로 확인했으며, 변경 뒤 뷰어 헤더 캡처는 재실행하지 않았다.

실기기, 실제 VoiceOver, 모든 OS native 날짜/파일/select popup, 신규 실LLM 생성·게시·복제 재실행과 확장 장애 전체는 NOT_RUN이다. **gpt-6-luna 설정 유지, VoiceOver BLOCKED 유지**. MUI 제거를 위해 새 의존성이나 새로운 디자인 시스템은 도입하지 않았다.

참고: [기존 UI Kit](../design/analysis-ui-kit.md), [공식 Sheet](https://ui.shadcn.com/docs/components/radix/sheet), [공식 Dialog](https://ui.shadcn.com/docs/components/radix/dialog).

## STUDIO-UI08 공식 로고 후속 — 2026-10-16

- 사용자 지적: Studio의 텍스트 대체 로고가 실제 VanillaMeta 로고와 달랐다. 편집/생성/게시 뷰어에 기존 헤더와 동일한 `assets/images/logo.svg`를 적용했다. 생성/뷰어의 링크 목적지는 보존하고 접근 이름을 VanillaMeta로 지정했다. 모바일에서 편집 로고를 숨기던 규칙도 제거했다.
- 기대: 원본 비율105×20px, 제목·저장/공유 버튼과 겹침 없음,390px에서도 로고 표시·가로 넘침 없음.
- Ego TaskSpace6에서 편집1440×1000/390×844, 생성390×844의 로고·인접 헤더를 실제 캡처·확인했다. 모바일 viewport390/document scrollWidth375(세로 스크롤바 제외), 로고105×20px로 가로 넘침0이다. 생성 화면은 데이터 로딩 중의 헤더를 관찰했으며 생성 흐름 전체를 재검증하지 않았다. 기능(로고 자산/접근 이름) PASS, 관찰한 헤더 디자인 PASS_SELECTED다.
- 변경한3개TSX eslint와 FE 타입 검사, diff check PASS. 게시 뷰어 로고는 같은 자산의 코드 확인만 수행했고 새 브라우저 캡처는 NOT_RUN이다. 이전 기능 회귀·실LLM·VoiceOver는 반복하지 않았다.
- 증빙: 같은 폴더의 `logo-desktop.png`, `logo-mobile.png`, `logo-create-mobile.png`. 이전 텍스트 로고 캡처는 변경 전 증빙으로 보존한다.

## develop-v2 통합·커밋 — 2026-10-16

원격 develop-v2가 `c4936ee1`까지 추가되어 이 기준 위에 Studio 변경을 rebase했다. 원격 추가23개 파일과 이번 변경37개 파일은 겹치지 않았고 충돌 없이 통합됐다. 로고 수정을 포함한 통합 결과의 FE 타입 검사·빌드·diff check를 새로 통과했다. 기존 UI93개와 화면 검증은 관련 Studio 구현이 변하지 않아 재사용했다. GitHub 활성 drumcap 계정을 확인했으며 원본 author 설정은 유지한다. gpt-6-luna와 VoiceOver 차단 설정을 수정하지 않았다.

## STUDIO-UI09 빈 기간·날짜 오류 후속 — 2026-10-16

기준 `3f313ebd`, 기존 source9/dashboard25. P1/P3의 결과 가시성·키보드 편집을 지원한다. 이전 정상 기간 집계·저장·게시·AI PASS는 재사용한다.

| 조건 | 입력 / 기대 결과 | 상태 |
| --- | --- | --- |
| UI09-A | 날짜 누락 또는 시작일>종료일: 원인 안내·적용 차단·적용된 범위 불변.390px에서 오류와 컨트롤 겹침 없음 | PASS_SELECTED: 종료일 누락·역순 |
| UI09-B | 공식 Rill 범위 밖 UTC 날짜: 실제 prepare 조회가 성공하면 빈 결과를 안내하고 이전634513000/막대를 현재 값처럼 표시하지 않음. 원본 저장본은 변경하지 않음 | PASS_SELECTED: 실제 API·빈 결과 화면 |
| UI09-C | Escape로 기간 패널 닫기/초점 복귀·undo로 원래 범위/수치 복원.1440/390px 결과 확인·캡처 | PASS_SELECTED: Escape·Enter undo·reload |

오류 발견 시 해당 표현/안내만 최소 수정하고 해당 회귀부터 재검증한다. 새 저장·게시·모델 호출·OS 권한 변경 없이 종료한다. gpt-6-luna 유지, VoiceOver BLOCKED 유지.

### 실제 결과·수정·재검증

- Ego TaskSpace7, FE3231/API4331의 기존 격리 fixture를 재사용했다. 종료일 누락·2023-10-02 시작/10-01 종료에서 각각 안내와 disabled 적용 버튼·전체 기간 유지,390px 컨트롤/안내 겹침 없음을 확인했다. Ego `fill`은 native date DOM 값과 React 입력 상태를 일치시키지 못해 날짜 값은 네이티브 value setter+input/change 이벤트로 입력했다. 실제 OS 날짜 팝업/전체 날짜 세그먼트 키보드 입력 통과로 계산하지 않는다. 적용 Enter, 패널 Escape·초점 복귀, undo Enter는 실제 키보드로 실행했다.
- UTC 2023-10-02 하루를 적용한 실제 `/studio/dashboards/25/preview`201 응답: numeric1행 `value:null`, bar0행이다. 숫자는 '값 없음'으로 올바르게 표시됐지만 차트는 빈 canvas+데이터 표 버튼뿐이어서 정상 빈 결과와 실패를 구분하기 어려웠다. 변경 전 PNG를 보존하고, 비숫자 블록의 빈 `datas`에 '선택한 기간·필터에 해당하는 데이터가 없습니다.' status를 표시하도록 수정했다. 오류/없는 preview 경로 및 숫자0 계산은 바꾸지 않았다.
- 수정 후 같은 기간의 실제 preview를 재확인했다.1440/390px 빈 결과·주변 제목/숫자·공통 기간을 실제 캡처하고 직접 확인했다. 모바일 document scrollWidth375≤viewport390(세로 스크롤바15px), 가로 넘침0, 안내가 카드 내부에 머문다. 기능·관찰한 디자인 PASS_SELECTED다.
- Escape 후 공통 기간 버튼으로 포커스 복귀. 실제 undo Enter 후 preview201이 총634513000/차트9행을 반환하고 빈 안내는 사라졌다. reload GET 뒤 전체 기간·저장 상태 clean·같은 총계가 유지됐다. 관찰 구간의 Studio XHR은 preview POST3회(수정 전·후·undo),GET1회(HMR 재조회)이며 save/run/publish POST0이다. 마지막 reload는 관찰 wrapper를 해제하며 별도 화면으로 저장본 불변을 확인했다.
- 새 선택 회귀1개 PASS/기존26개 skipped: 빈 chart는 WidgetViewer로 넘기지 않고 안내하며, 같은 화면의 정상0 numeric는0으로 유지하고 추가쓰기0. 초기 fixture의 categoryField/preview draft 누락을 바로잡은 뒤 통과했다. FE 타입·변경2개 파일 lint·FE build·diff check PASS. 이미 통과한 필터/저장/게시/AI와 전체 suite는 반복하지 않았다. 변경은 미커밋이다.
- 증빙 폴더는 동일하다. `empty-date-invalid-mobile.png`(종료일 누락), `empty-date-reversed-mobile.png`, `empty-period-before-{desktop,mobile}.png`, `empty-period-after-{desktop,mobile}.png`, `empty-period-restored-mobile.png`, `empty-period-restore.json`. 이번에 기능/디자인의 선택 범위만 완료했으며 생성 저장 응답 장애·대화 생성안 재설계·실기기·운영 조건은 남아 있다. gpt-6-luna 유지/새 호출0, VoiceOver BLOCKED 유지.

## STUDIO-UI10 신규 생성 저장 응답 유실 — 2026-10-16

T15 STUDIO-N03/N04의 미실행 브라우저 장애 조건만 선택한다. 기준 `3f313ebd`+UI09 변경, source9/dashboard25. 같은 Rill 생성은 장애 검증을 위한 준비이며 정상 생성 전체를 재검사하지 않는다. gpt-6-luna만 사용한다. 별도 비공개 검증본을 생성하며 원본25/게시본과 기존 작업을 유지한다.

1. 실제 생성안 미리보기 후 저장 응답 단계만 끊는다. 커밋 전 실패와 커밋 후 전달 실패를 구분한다.
2. 모바일 불확실 안내·같은 생성 요청 재확인을 실제 키보드로 실행한다. 결과 dashboard ID/영수증이 같고 추가 생성0인지 확인한다.
3. reload 복원·추가 쓰기0·원본 불변을 확인하고 모바일 오류/완료 캡처를 남긴다. 장애 주입은 해제한다. 실제 OS/VoiceOver/운영 장애 전체로 확대하지 않는다.

### 결과 — 기능·디자인 PASS_SELECTED

- 실제 Codex/gpt-6-luna 생성 요청으로 source9의 총634513000/디바이스별 막대2개를 제안받았다. 정상 생성 수용 전체를 반복한 것이 아니라 장애 전제다. 첫 Fetch 주입은 OPTIONS 응답에서 Node 실행이 끝나며 세션이 해제되어 정상 저장26이 완료됐다. 이를 응답 유실 성공으로 계산하지 않고 비공개 준비본으로 보존했다. 두 번째 실제 요청의 제안/실행에서 아래 장애를 확인했다. 새 모델 요청은2회이며 설정·대체 모델·로컬 LLM 변경은 없다.
- 실행 `f3c833b8-7f65-4710-a091-a7a87791041b`의 creation POST response 단계201을 포착해 실제 커밋 영수증의 dashboard27/source9/revision을 읽은 뒤 `ConnectionClosed`로 브라우저 전달만 차단했다. OPTIONS는 통과시켰고 전체 Fetch 처리를 한 실행에서 수행한 후 finally에서 해제했다. 서버/DB/OS 프로세스를 종료한 장애로 확대하지 않는다.
- 화면은 '저장 완료 여부를 확인하지 못했습니다. 같은 생성 요청으로 재시도하면 기존 저장 결과를 확인합니다.'와 '같은 생성 요청으로 저장 확인'을 표시했다. DB도27의 동일 영수증을 갖고 있었다. 실제 Enter 재확인 후27 완료·동일 revision, 대시보드26개/지표36개/Studio게시8개로 재시도 전후 동일했다.27의 게시0. 최초 생성만 dashboard+1/metric+1이며 중복 저장은0이다.
- 완료 상태 자동 포커스→Tab으로 `/dashboard/27/studio` 링크에 진입했다. reload 후 runs GET으로27 완료 기록을 복원했고 관찰한 API POST0이다.27의 별도 Studio 재조회도 제목 '저장 응답 유실 검증'/총634513000/clean을 확인했다.25의 dashboard/studio_state/dashboard_widget 행 해시는 준비 전·후 동일하다. 신규26/27은 격리 DB의 비공개 검증본으로 보존했다.
- **발견·수정:** 긴 생성/오류 카드가 모바일 panel 높이를2559px로 늘려 탭과 composer를 viewport 밖으로 밀어냈다. 기존 `.studio-panel-sheet .studio-panel`의 auto 높이 대신 Sheet→portal host→panel-content→panel의100% 높이와 min-height0을 연결했다. AI 본문만 내부 스크롤하고 inspector도 자체 스크롤한다. 로직·영수증·요청/저장 계약은 변경하지 않았다. CSS HMR 뒤에도 동일한 불확실 상태/제안이 유지돼 새 모델 호출 없이 재검증했다.
- 실제390×844: panel844px, AI본문584px(client)/2299px(scroll), composer y641~844.768×1024: panel1024/composer하단1024.1440×1000: 기존 rail876px/composer하단992.2, 가로 넘침0.390px 설정 패널도787px 내부875px 스크롤, 마지막 삭제 버튼에 키보드 포커스만 이동한 뒤 Escape가 원래 설정 버튼으로 복귀했다. 삭제는 실행하지 않았다. 대표 오류·완료·설정 캡처를 직접 확인했다. 초기 설정 PNG는 전환 중 blur로 최종 근거에서 제외했다.
- CSS 변경 뒤 FE build/diff check PASS. 새 JS/서버 변경이 없어 UI09의 타입·변경 lint·선택 회귀1개, 기존 T15 영수증/실행 계약 검사 결과를 재사용했다. 같은 통과 조건을 추가 재실행하지 않았다. gpt-6-luna와 VoiceOver BLOCKED 유지, 실휴대폰/실VoiceOver/호스트 재부팅·장기 오프라인/운영 MySQL·동시 부하는 NOT_RUN이다. 이번 상태로 전체 Studio/TC005 수용을 완료로 보고하지 않는다. 변경은 미커밋이다.
- 증빙: 같은 폴더의 `creation-loss-{baseline,commit,after-commit,retry-result,reload,final}.json`, `creation-loss-error-mobile.png`(수정 전 panel overflow), `creation-loss-warning-mobile-fixed.png`, `creation-loss-recovered-mobile.png`, `creation-loss-reloaded-mobile.png`, `creation-loss-settings-mobile-fixed.png`. 생성안 재설계·홈의 빈 대화 진입 등은 별도 제품 범위다.

### UI09·UI10 커밋 통합

사용자 커밋·push 요청에 따라 원격 `a4b0f722` 위로 변경5개 파일을 충돌 없이 통합했다. 추가된 인증 helper 변경의 연결 영향을 확인하기 위해 auth.session 선택 검사14개, FE 타입·build를 실행해 통과했다. 기존 Studio 통과 화면/결과는 구현·fixture 변경 없는 범위에서 재사용한다. 실행 당시의 미커밋 표기는 역사적 상태이며 UI09·UI10 코드와 기록을 함께 커밋한다. GitHub drumcap 활성 계정·일반 push를 사용하고 author 설정을 바꾸지 않는다.

## STUDIO-UI11 완료 링크 새 탭·복귀 — 2026-10-16

T14/T15에서 href/target만 확인하고 실제 호스트 새 탭 전달은 NOT_RUN으로 남겼던 조건이다. 기존 비공개 완료27을 사용한다. 새 모델/저장/게시 없이 다음 조건만 확인한다.

- 복원된 완료 링크를 키보드 Enter로 열 때 실제 popup Page의 URL이27 Studio이고 같은 수치/저장 상태를 표시한다.
- 원래25 탭의 문서/대화 완료 상태가 유지된다. 새 탭을 닫고 원래 탭으로 돌아와 링크가 계속 조작 가능하다.
- 모바일390px에서 링크·완료 카드·composer가 겹치지 않으며, viewport 변경이 새 탭에 적용되는 도구 동작은 명시적으로 구분한다. gpt-6-luna/VoiceOver BLOCKED 유지.

### 실제 결과 — 기능·관찰한 디자인 PASS_SELECTED

- 기준 `d51585a4`(UI09·UI10 drumcap/develop-v2 push 완료), 동일 FE3231/API4331/격리 fixture. Ego TaskSpace9의 원래25 페이지에서 복원된27 완료 링크에 focus→Enter를 실행했다. `waitForEvent("popup")`가 실제 p2를 반환했고 URL은 `/dashboard/27/studio`였다. p2를 직접 goto하지 않았다. 링크 target은 `_blank`, rel은 `noopener noreferrer`다.
- p2는 '저장 응답 유실 검증'/총634513000/clean을 표시했다.1440px 실제 캡처로 공식 로고·헤더·값·차트를 확인했다. 새 탭을 닫자 원래25의 기존 완료 카드·원본 제목이 유지됐고 같은27 링크로 다시 포커스할 수 있었다.390px 원래 탭에서 composer하단844, scrollWidth390=viewport390, 완료 링크가 composer 위에 보이는 것을 실제 캡처·확인했다.
- 새 탭의 viewport override 해제 후 원래 탭이 브라우저 기본1788px로 돌아가므로 최초 Sheet 대기는 timeout이었다. 제품 상태 유실이 아니며 원래 탭의 desktop rail/완료 링크가 존재함을 확인한 뒤390px을 명시 재적용했다. 최종 모바일 캡처만 디자인 근거로 사용한다.
- DB 개수 dashboard26/metric36/Studio게시8은 UI10 종료 후와 같고,25의 dashboard/studio_state/dashboard_widget 해시도 동일하다. 새 모델·저장·게시·제품 코드 변경0이다. 이미 통과한 unit/type/build는 반복하지 않았다. 실제 새 탭 전환은 이번 Ego·현재 로그인 세션에서만 PASS이며 다른 브라우저·실기기/VoiceOver는 미검증이다. gpt-6-luna 및 VoiceOver BLOCKED 유지.
- 증빙: 같은 폴더의 `creation-popup-opened-desktop.png`, `creation-popup-returned-mobile.png`, `creation-popup-result.json`, `creation-popup-db.json`. 임시 popup p2를 닫고 원래 페이지 override를 해제해 TaskSpace9를 종료했다. Ego 업데이트 안내를 관측했지만 업그레이드는 실행하지 않았다.

### 남은 우선순위

1. T15 미저장 생성안의 실제 서버 재시작/캐시 소실 안내 및 재생성 연결. 기존 response 유실·영수증 복구와 구분하며, 현재 격리 DB에는 미저장 생성 실행이 없어 별도 준비가 필요하다.
2. 실제10분 TTL 대기와 전체 OS 날짜·파일·select 팝업 키보드. 현재 하위 TTL 검사·부분 키보드를 전체 통과로 확대하지 않는다.
3. 홈의 빈 대화 진입/소스 선택, 같은 생성안의 지표·차원 대화식 재설계·clarification 이어받기는 미구현 제품 범위이며 별도 설계가 필요하다.
4. 실휴대폰·운영 MySQL/동시 부하·전체 Studio 수용은 별도 gate다. VoiceOver는 기존 BLOCKED를 유지한다.
