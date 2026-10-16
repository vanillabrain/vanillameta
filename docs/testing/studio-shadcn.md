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

1. T15 미저장 생성안의 실제 서버 재시작/캐시 소실 안내 및 재생성 연결은 아래 UI12에서 선택 검증했다. 기존 response 유실·영수증 복구와 구분한다.
2. 실제10분 TTL 대기와 전체 OS 날짜·파일·select 팝업 키보드. 현재 하위 TTL 검사·부분 키보드를 전체 통과로 확대하지 않는다.
3. 홈의 빈 대화 진입/소스 선택, 같은 생성안의 지표·차원 대화식 재설계·clarification 이어받기는 미구현 제품 범위이며 별도 설계가 필요하다.
4. 실휴대폰·운영 MySQL/동시 부하·전체 Studio 수용은 별도 gate다. VoiceOver는 기존 BLOCKED를 유지한다.

## STUDIO-UI12 미저장 생성안 서버 재시작 — 2026-10-16

기준 `4ba84614`, 동일 격리 DB/source9/dashboard25, FE3231/API4331. P3 실행 복구·T15 STUDIO-N03/N04의 남은 실제 재시작 조건이다. 정상 생성·응답 유실·저장 영수증·새 탭 PASS는 반복하지 않는다.

| 조건 | 기대 | 상태 |
| --- | --- | --- |
| UI12-A | gpt-6-luna 신규 제안만 생성하고 저장하지 않는다. API4331의 정확한 Node 프로세스만 정상 재시작하여 메모리 캐시 소실을 만든다 | PASS_SELECTED: 실제 SIGTERM/동일 설정 재기동 |
| UI12-B | 오래된 제안 저장/조회가 거절되면 재생성 안내·저장 차단, 원본·새 dashboard/metric/publication 추가0. reload가 모델/저장을 자동 실행하지 않음 | PASS_SELECTED: 오류 수정·실제400 재검증/GET 복원 |
| UI12-C | 모바일·키보드로 새 생성 요청을 명시 전송하여 새 proposal/실제 미리보기를 받는다. 원래 문서/완료 영수증 유지, 새 제안은 저장 전 상태 | PASS_SELECTED: 실제 재생성/새 ID·미저장·원본 불변 |

서버 실행 명령·포트·DB/업로드·Codex 모델 연결을 확인하고 같은 설정으로 복구한다. 실시간10분 TTL·SIGKILL·호스트 재부팅과 구분한다. 오류 발견 시 최소 안내/상태 변경과 해당 검사만 수행한다. 캡처는 저장소 밖 `studio-shadcn-20261016`에 남기며 gpt-6-luna/VoiceOver BLOCKED를 유지한다.

### 실제 실행·수정·재검증

- 기존 Ego TaskSpace10의 source9/dashboard25를 사용했다. 실제 gpt-6-luna 제안 실행 `0a577e9f-462d-440d-b66d-10f16427ef9c`/제안 `50565c64-7c2d-4b45-b617-5479c9647098`은 총634513000/차트2개를 미리보기만 하고 저장하지 않았다. 대시보드26개/지표36개/Studio게시8개가 준비 전후 같았다.
- 포트 소유 PID55275, argv `node dist/src/main.js`, cwd `studio-develop-v2-merge-check/vanillameta/backend-api`, Node24를 확인했다. 비밀값이 아닌 이름 허용 목록으로 기존 HOST/PORT/CORS/SQLITE_PATH/FILE_UPLOAD_DIR/AI_PROVIDER/Codex URL·catalog/PATH만 확인해 같은 dist와 설정을 사용했다. PID55275만 SIGTERM 종료→PID36408로4331 재기동, 원래 검증 서버를 계속 사용할 수 있게 보존했다. 새 backend 코드/DB 초기화/다른 서버 종료는 없다. 실행 생성부터 재기동 로그 생성까지108초이므로10분TTL 시간 이동으로 소실을 대신하지 않았다.
- 브라우저의 기존 미리보기 저장 Enter는 실제 POST400. **오류:** 만료 안내 뒤에도 오래된 preview/저장 버튼이 활성 상태였다. `StudioConversationCreation`의 명확한400 거절에만 proposal을 비워 저장 진입을 제거했다. network/5xx의 불확실 결과는 같은 요청 재확인 경로를 유지한다. 변경 전 PNG를 보존하고, HMR 후 같은 만료 생성안으로 POST400을 다시 받아 preview/저장 버튼0·재생성 안내를 확인했다.
- reload 후 dashboard/runs/creation GET 및 OPTIONS만 관찰했고 POST0이었다. 생성안 읽기도400/재시작·만료 안내로 돌아오며 저장 버튼0. 과거 완료26/27의 복구 계약과 원래 문서25를 새 생성안으로 바꾸지 않았다. 이 GET/화면 복원을 새 모델 호출로 집계하지 않는다.
- textarea 입력→Tab으로 전송→Enter의 명시 요청에서 실제 gpt-6-luna 재생성 실행 `4bcff8d2-1763-4c3d-8cf6-6c06c68177b9`/새 제안 `8c121168-7aee-4b1a-819f-a60b67e19e69`을 받았다. 기존 저장 지표35/v1을 재사용하며 총634513000·device_type 차트/1,391,572행이 표시된다. 새 저장 버튼은 포커스만 확인하고 누르지 않았다. 두 실행 모두 creationSaveResult 없음, 새 proposal ID는 다르며 원래 실패 실행도 미저장 상태다.
- 최종 dashboard26/metric36/Studio게시8로 추가0,25의 dashboard/studio_state/dashboard_widget 해시는 모두 준비 전후 동일하다. 실제 모델 요청은 준비1+명시 재생성1이다. 설정 fallback/로컬 LLM 호출0, VoiceOver BLOCKED 유지, OS 설정 변경0.

### 검사·디자인·증빙

- 재현 회귀1개는 수정 전 활성 저장 버튼 때문에 FAIL, 수정 후 PASS. 같은 catch를 지나는 불확실 저장 재확인 기존 검사1개도 선택 실행해 총2 PASS/나머지4 skipped. FE 타입·변경2개TSX eslint·FE build·diff check PASS. 서버 코드/계산/일반 저장/게시/전체 E2E의 통과 조건은 반복하지 않았다.
- 기능 PASS_SELECTED.390×844의 오류/재생성/새 저장 버튼 포커스와1440×1000의 원래 문서+새 미리보기를 실제 캡처·직접 확인해 관찰 디자인 PASS_SELECTED다. 새 오류는 카드 안에서 줄바꿈, 모바일 composer하단844, 새 저장 버튼과 입력 영역 겹침0, 가로 넘침0. 초기 reload 캡처는 Sheet 등장 전환 중 blur가 있어 최종 디자인 근거에서 제외한다. 만료 고정 화면과 재생성 최종 PNG를 근거로 사용한다.
- 증빙: `restart-unsaved-{baseline,proposal,runtime,reload,browser-result,final}.json`, `restart-unsaved-error-before-mobile.png`, `restart-unsaved-expired-fixed-mobile.png`, `restart-unsaved-regenerated-mobile.png`, `restart-unsaved-review-keyboard-mobile.png`, `restart-unsaved-regenerated-desktop.png`. 폴더는 동일하다. TaskSpace10/viewport override를 정리했다. Ego 업데이트 안내는 적용하지 않았다.
- 실시간10분 TTL, SIGKILL/호스트 재부팅, 운영MySQL/동시 부하, 실휴대폰/VoiceOver·전체 키보드/언어 조합은 NOT_RUN/BLOCKED다. 홈/빈 대화와 생성안 대화식 재설계는 별도 제품 범위다. 전체 Studio 수용 완료로 확대하지 않으며 이번 변경과 기록은 미커밋이다.

## STUDIO-UI13 날짜 네이티브 키보드 후속 — 2026-10-16

기존 UI09의 입력 이벤트 보조를 제외한 실제 날짜 입력/팝업 조건만 선택한다. source9/dashboard25, FE3231/API4331과 gpt-6-luna 설정을 유지한다. 저장·게시·AI 실행 없이 날짜 세그먼트 입력, 팝업 키보드/취소, 모바일 포커스·배치를 확인한다. 이미 통과한 빈 기간 집계·저장 조건은 재실행하지 않는다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI13-A | 실제 키보드로 날짜 세그먼트 입력·시작/종료 필드 이동, DOM 및 React 입력 상태 일치 | PASS_SELECTED |
| UI13-B | 날짜 팝업 열기·방향키/Enter·Escape와 패널 포커스 복귀 | PASS_SELECTED |
| UI13-C | 390px 실제 포커스/레이아웃 캡처·가로 넘침0·원본 저장본 불변 | PASS_SELECTED |

### 실제 결과

기준 `7d2b520e` + 기존 제목 보존 BE diff(날짜 UI 변경 없음). Ego TaskSpace18/source9/dashboard25에서 실행했다. 시작일의 연·월·일을 실제 키보드로2023-09-09 입력했고 불완전 안내/적용 전 변경 상태를 확인했다. 날짜 값 setter·input/change 이벤트는 사용하지 않았다. 날짜 입력의 달력 버튼으로 Tab→Space를 보내 실제 Chromium popup snapshot을 확인했고, 같은 실행 안의 ArrowRight→Enter로 **2023-09-10** 확정을 확인했다. 다시 popup에서 ArrowRight→Escape 후 **2023-09-10 유지**·INPUT 초점을 확인했다. Alt+ArrowDown은 이 환경에서 열리지 않아 성공으로 집계하지 않았다.

날짜 세그먼트의 내부 포커스가 유지되므로 시작점을 왼쪽으로 맞춘 뒤 입력했다. `>> nth=1` selector 경로가 종료일 대신 시작일을 조작한 중간 결과는 보존하고 제품 실패로 분류하지 않았다. 실제 DOM id로 종료일을 다시 지정해 키보드2023-09-16 입력을 확인했다. 최종 시작/종료는2023-09-16/2023-09-16이다. 기간 열만 `selectOption(__time)`으로 준비했으며 기간 열 네이티브 키보드 PASS로 확대하지 않는다. React의 적용 버튼이 활성화된 것으로 날짜 입력 상태 일치도 확인했다. **적용 버튼은 누르지 않았다.**

390×844에서 선택/날짜 입력 각각332×36px·16px, 가로 넘침0·보이는 날짜 세그먼트 포커스와 주변 라벨/버튼 정렬을 실제 OS 캡처로 확인했다. popup snapshot은 `popup-confirm.json`, 화면의 `calendar-desktop.png`는 popup이 닫힌 달력 버튼 포커스 상태이며 팝업 이미지 증빙으로 사용하지 않는다. 네이티브 popup이 라운드 간 관찰에서 사라지는 한계 때문에 같은 실행에서 열림·조작·확정/취소를 기록했다. 날짜 팝업의 모바일 전체 시각 배치·모든 날짜/언어/브라우저는 미검증이다.

마지막 Escape는 패널을 접고 `공통 기간` 버튼(aria-expanded=false)으로 복귀했다. 문서는 clean·전체634,513,000 유지, reload로 미적용 입력을 정리하고 TaskSpace18만 종료했다. 저장/게시/AI 실행0, DB dashboard31/metric38/studio_publication8 유지. 제품 변경0, 기존 날짜 UI 단위/type/lint/build 결과를 재사용하고 문서 diff check PASS. 기능·선택 디자인 PASS_SELECTED이며 전체 키보드/실휴대폰/운영MySQL은 미완료, gpt-6-luna 및 VoiceOver BLOCKED 유지.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-native-date-20261016`의 `popup-confirm.json`, `keyboard-result.json`(중간 selector 결과 포함), `mobile-ready.json`, `panel-escape.json`, `db-after.json`, `calendar-desktop.png`, `date-ready-390.png`. 캡처는 Ego 창의 OS 화면으로 에뮬레이션 여백·제어 오버레이를 포함한다. 기록은 미커밋이다.

## STUDIO-UI14 파일 선택 취소 키보드 후속 — 2026-10-16

UI06/T6의 정상 업로드는 재사용하고 source9를 고른 `/studio/new`에서 남은 취소 조건만 검증한다. 질문 입력 보존·기존 소스 유지·파일/업로드 없음이 기대값이다. 저장/게시/AI 실행 없이 종료한다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI14-A | 파일 선택 버튼 Enter로 실제 선택창 열기→Escape 취소→버튼으로 초점 복귀 | PARTIAL: Enter chooser event 확인·OS 표시 차단 / 실제 OS Escape 취소 PASS |
| UI14-B | 취소 후 질문/소스/파일0 보존, Tab으로 다음 컨트롤 이동,390px 포커스·정렬·가로 넘침0 | PASS_SELECTED |

### 실제 결과

기준 `7d2b520e` + 기존 미커밋 제목 보존 수정, FE3231/API4331/source9. Ego TaskSpace19의 질문 `파일 선택 취소 뒤에도 이 요청을 유지해 줘`를 준비하고 파일 선택 버튼에 focus→Enter를 실행했다. Ego는 `This action opened a file chooser, which was cancelled before the system dialog appeared`를 반환했다. **Enter에서 chooser event 발생만 확인했으며 OS 선택창 표시 PASS로 계산하지 않는다.** 같은 탭의 Page.setInterceptFileChooserDialog를 일시 false로 바꾼 뒤 OS Return/Space·CDP 실제 Enter를 시도했지만 창 표시는 확인하지 못해 해당 경계는 PARTIAL로 남긴다. 시스템/권한/제품 설정은 바꾸지 않았다.

같은 Ego 실제 창에서 파일 버튼 AX click으로 macOS `open-panel`/취소/비활성 열기 창을 확인했다. 이는 키보드 진입 성공의 대체 증빙이 아니라 **취소 검증을 위한 준비**다. 파일을 선택하지 않고 OS Escape로 닫은 뒤 DOM의 활성 요소 `파일 선택`, file.files.length0, 소스9, 질문 원문 보존을 확인했다. 사용자 다운로드 목록의 파일을 열거나 업로드하지 않았으며 목록/파일명은 별도 증빙에 저장하지 않았다.

390×844에서 Tab→`매출·환불 샘플`, Shift+Tab→`파일 선택` 이동을 확인했다. 버튼3개 각각316×36px·일관된 세로 배치, 포커스 가시성·라벨/카드 정렬·가로 넘침0을 실제 캡처로 확인했다. 기능은 취소/보존/페이지 Tab 범위 PASS_SELECTED, 디자인은 선택 모바일 범위 PASS_SELECTED다. 실제 휴대폰 파일 선택·OS 전체 파일 탐색/확정·VoiceOver는 미완료다.

저장/게시/AI 실행0·파일 업로드0, DB 개수 전후 동일(dashboard31/metric38/studio_publication8). 제품 오류를 확정하지 않아 제품 코드 변경0이며 기존 UI 검사 결과를 재사용했다. 문서 diff check PASS. 검증 탭의 intercept true·viewport를 복구하고 TaskSpace19를 종료했다. gpt-6-luna·VoiceOver BLOCKED 유지. 자동화 제한을 없애기 위해 제품 파일 입력을 교체하지 않는다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-native-file-20261016`의 `result.json`, `db-before.json`, `db-after.json`, `cancel-return-390.png`. OS 선택창 자체 캡처는 개인 파일 목록이 포함돼 남기지 않았으며 취소 후 제품 화면만 남겼다. 기록 미커밋. 다음은 반복적인 OS 도구 우회보다 미커밋 수정/기록 통합과 잔여 제품·운영 gate 우선순위 정리가 적절하다.

## STUDIO-UI15 분모 확인 실패·재시도 후속 — 2026-10-16

기존 source11/37주문 매출·환불 샘플을 재사용한다. 하위 검사로만 확인했던 clarification 재시도의 실제 UI 연결만 선택한다. 정상 샘플 업로드/저장/게시 조건은 반복하지 않는다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI15-A | 분모 없는 환불률 요청→명시 선택→1회 전송 전503 주입 후 질문·분모·소스 버전 보존·저장 없음 | PASS_SELECTED |
| UI15-B | 같은 질문/선택/버전으로 명시 재시도→실제 gpt-6-luna/DuckDB 미리보기·정확한 계산 | PASS_SELECTED |
| UI15-C | 390px 오류/복구 안내·선택/버튼·키보드·넘침 및 캡처, 저장·게시 없음 | PASS_SELECTED |

### 실제 결과

기준 `7d2b520e` + 기존 BE 제목 보존 diff. Ego TaskSpace20/FE3231/API4331/source11(37주문·8열)의 분모 없는 환불률 요청으로 실제 clarification 응답을 받았다. amount(성공 결제액)를 선택하고 Enter로 재요청할 때 **해당 탭 Axios request interceptor에서1회만 전송 전503 형태 오류**를 주입했다. 실제 서버503/호스트 장애로 확대하지 않는다. 기존 오류 안내, 질문 원문·소스11·amount 선택 보존, 저장 버튼 없음과 동일 expectedSourceRevision을 확인했다. 실패 시 자동 재시도는 없었으며 명시 Enter 후 세 번째 요청 body가 두 번째와 완전히 같았다.

재시도는 정상 서버→기존 Codex/gpt-6-luna→DuckDB 경로로 성공했다. 최초 의미 확인은 서버 gate, 주입 요청은 전송 전 거절이므로 실제 모델 생성은 정상 재시도에서1회다. 저장 지표7/v1을 재사용한 RATIO_SUM(refund_amount)/revenue×100·정수 축약 없는2자리 표현을 반환했고 오류 안내는 사라졌다. 첫/마지막 proposal sourceRevision 일치. preview 내부 revision digest와 원본 sourceRevision을 혼동하지 않는다.

원본 공개 payments.csv의 succeeded 합계20,994.61과 refunds.csv 합계4,457.60을 Python Decimal로 독립 계산했다. 기대21.23211624316908006388306332%, 실제21.232116243169088%(차이약7.94e-15), **표시21.23%** 일치. 이는 금액 기준이며 주문 기준8/35=22.86%와 구분한다. 신규 Rill UI를 재실행하지 않고 같은 원본의 이전 수치 기준을 재사용했다.

390×844 오류 뒤 선택/질문 보존 화면과 복구 숫자 카드의 라벨·단위·줄바꿈·버튼 정렬을 실제 캡처로 확인했다. 가로 넘침0, 명시 Enter 재요청, 선택창36px를 확인했다. 물리 Space 전환이 viewport를 초기화한 중간 desktop 캡처는390px 최종 캡처로 교체했다. 기능·선택 모바일 디자인 PASS_SELECTED. 오류 안내 본문은 DOM/JSON으로 기록했고, 실패 PNG는 유지된 선택 부분을 보여준다. 화면 전체 키보드 순서·모바일 팝업·실휴대폰·운영은 별도다.

제품 오류/제품 코드 변경0. 기존 동일 UI 관련 회귀/type/lint/build를 재사용하고 문서 diff check PASS. 저장/게시0·DB dashboard31/metric38/studio_publication8 유지. 임시 interceptor를 eject하고 TaskSpace20만 종료했다. gpt-6-luna 및 VoiceOver BLOCKED 유지. 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-clarification-retry-20261016`의 `failed.json`, `recovered.json`, `verification.json`, `failed-selection-390.png`, `recovered-390.png`. 변경과 검증 기록은 미커밋이다.

## STUDIO-UI16 게시 실패·상태 조회 복구 — 2026-10-16

STUDIO-P02/P03 중 실제 브라우저 미검증 경계만 선택한다. 기존 비공개32/source9/Rill 저장본을 사용하고 신규 공개 링크·원본 저장·모델 호출은 하지 않는다. 정상 게시/중지/만료 전체는 재실행하지 않는다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI16-A | 게시 POST 전송 전1회503→실패 안내·설정 잠금·같은 요청 재시도→동일 requestId/body | PASS_SELECTED |
| UI16-B | 재시도 실제 게시 commit 뒤 owner GET1회503→완료 범위 오인 차단→상태 다시 확인 GET만→같은 v1 복원·추가 게시0 | PASS_SELECTED |
| UI16-C | 390px 오류/복구·키보드 Enter·컨트롤/레이아웃·저장본 불변·비공개 유지 | PASS_SELECTED |


### 실제 결과

기준 develop-v2 `2fb2edb4`(원격 `5679f5f0` 통합). 기존 미커밋 제목 전용 수정과 UI12~15 검증 기록을 drumcap으로 커밋·push했다. 통합 후 BE REFINE 관련5개·FE StudioCreate/auth.session/studioCreationRecovery53개·FE 타입/빌드·BE 빌드 PASS. 기존 통과 MD 조건은 반복하지 않았다.

Ego TaskSpace1/FE3231/API4331의 dashboard32/source9를 재사용했다. 게시 UI의 비공개 기본값·복제 비허용 상태에서 Enter로 게시할 때 **해당 탭 Axios request interceptor의 전송 전503 형태 거절1회**를 주입했다. 실제 서버503나 프로세스 장애와 구분한다. 오류 안내·공개 범위/만료 설정 잠금·같은 요청 재시도 버튼을 확인했다. Enter 재시도 body/requestId/expectedRevision은 최초 시도와 완전히 같았다.

재시도 POST는 실제 서버에서 비공개 v1을 만들었다. 응답을 정상 전달한 직후 자동 owner GET만 같은 방식으로1회 거절했다. UI는 ‘게시 요청은 완료됐습니다. 최신 공개 범위를 확인하지 못했으니 게시 상태를 다시 확인해 주세요.’를 표시하며 현재 링크/버전 표시를 숨기고 게시 버튼을 비활성화했다. ‘게시 상태 다시 확인’에 focus→Enter 후 정상 GET으로 같은 비공개 v1/복제 비허용 상태가 복원됐다. 관측 순서는 POST(전송 전 거절), POST(실제 성공), GET(전송 전 거절), GET(실제 성공)이다. **실제 게시 성공1회, 복구 추가 POST0**이며 서버 응답 유실·동시 재게시 전체 조합으로 확대하지 않는다.

390×844에서 오류·복구 화면 캡처와 Enter 조작을 확인했다. dialog x16/너비358px, 문서/다이얼로그 가로 넘침0, 주요 버튼36px·카드/본문 줄바꿈/세로 footer 정렬을 확인했다. 복구 후 본문은 내부 스크롤이며 하단 재게시/닫기/중지 버튼이 유지된다. 기능·선택 모바일 디자인 PASS_SELECTED, 전체 Tab 순서·실휴대폰·VoiceOver는 별도다. OS 창 캡처는 물리 공간 전환 후 폭이 초기화된 데스크톱 화면이므로 모바일 증빙에서 제외하고, 동일 CDP 연결에서 폭390 실측 후 Page screenshot을 저장했다.

읽기 전용 DB 검사: dashboard31/metric38 유지, studio_publication8→9(32의 비공개 v1 정확1개), Studio32 저장 행 SHA256 `c0b80cbda8a806905ca79c91d08215d04f2d101cd973715dbf842bc0e4976cbc` 전후 동일. 게시 snapshot에 기존 기대값634,513,000을 확인했다. 새 공개 링크·원본/지표 저장·AI 호출0. 비공개 검증 게시본은 보존했으며 자동 중지하지 않았다. 제품 오류/제품 코드 변경0, 기존 관련 검사 재사용·문서 diff check PASS. 임시 interceptor/viewport를 복구하고 TaskSpace1만 종료했다. gpt-6-luna 설정·VoiceOver BLOCKED 유지.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-publication-recovery-20261016`의 `before.json`, `failed.json`, `owner-read-failed.json`, `recovered.json`, `verification.json`, `01-mobile-page.png`, `02-owner-read-failed-mobile.png`, `03-recovered-mobile.png`.

남은 우선 조건은 **대화 실행기의 저장 성공→게시 단계 실패 시 저장 보존/명시 재시도·취소·서버 재시작 복구의 실제 브라우저 연결**이다. 수동 게시 대화상자의 이번 결과를 해당 실행기 전체 PASS로 계산하지 않는다. 운영 MySQL·실기기·전체 제품 수용 및 VoiceOver BLOCKED도 유지한다.

## STUDIO-UI17 대화 실행기의 게시 장애·중지·재시작 — 2026-10-16

STUDIO-A03/P02의 실행기 경계만 선택한다. UI16 수동 게시 대화상자 결과는 재사용한다. 기존 로컬 dashboard32/source9의 공개 Rill 집계를 사용하며 새 원본 수집·AI 생성·정상 공유 전체는 반복하지 않는다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI17-A | 실제 저장 완료 후 실행기 게시 단계1회 실패→부분 완료·저장 보존→명시 게시 단계만 재시도·추가 save/model0 | PASS_SELECTED |
| UI17-B | 실제 저장 완료 후 게시 commit 전 대기→명시 실행 중지→저장 완료/공유 중지됨·기존 게시본 불변·자동 재개0 | PASS_SELECTED |
| UI17-C | 실제 저장 완료 후 게시 commit 전 대기→정확한 검증 Node 종료·같은 DB 재시작→부분 완료/게시 interrupted→명시 게시만 재시도·중복 save0 | PASS_SELECTED |
| UI17-D | 390px 오류/중지/복구 안내·키보드 Enter·정렬/넘침·영속 수치/정의 확인 | PASS_SELECTED |


### 실제 결과

기준 develop-v2 `e2e5b715`, FE3231/API4331, 기존 dashboard32/source9·Rill 집계634,513,000. 사용자 요청의 실행기 세 경계만 검증했다. 최초 한 실행은 실제 저장 후 게시 서비스 진입에서1회 예외를 발생시켰고, 별도 두 실행은 같은 경계에서 대기시켰다. **저장·실행 journal·재시도·취소·재시작 복원은 실제 서버/DB**, 장애/대기는 저장소 밖 Node preload의 StudioPublicationService.publish wrapper다. dashboard32 및 publication-execution requestId에만 적용했으며 제품 파일/DB 상태를 직접 조작하지 않았다. 실제 외부 네트워크 장애·DuckDB 손상으로 확대하지 않는다.

- **UI17-A:** run `15758a30-6e0d-42c5-85ba-de5813b72957`은 inspect/saveDraft succeeded·publish failed/PUBLISH_FAILED·전체 partial을 반환했다. 대화에 ‘저장 완료 · 게시 실패. 저장 결과는 유지되며 게시 링크는 갱신되지 않았습니다. 게시 단계만 다시 시도할 수 있습니다.’와 ‘공유 다시 시도’를 확인했다. Enter 재시도는 `POST /studio/runs/:id/retry {stepId:"publish"}`만 실행해 같은 run succeeded/게시v2를 만들었다. 추가 모델·저장 실행0, 해당 save journal1/게시 journal1이다. 편집기 저장 결과 적용으로 패널이 재마운트/닫힌 뒤 AI 열기로 영속 기록을 재조회했다. 닫힌 패널에서 링크 대기한 도구 timeout은 게시 실패로 계산하지 않는다.
- **UI17-B:** run `df11b8e8-45bc-4e75-a1b0-7f535cfc5472`의 실제 저장 완료·게시 대기 상태에서 ‘실행 중지’ focus→Enter를 수행했다. signal abort가 wrapper 대기를 해제하고 publish cancelled/RUN_CANCELLED·retryablefalse·전체 partial, saveDraft succeeded를 유지했다. UI는 저장 보존/공유 중지됨을 표시하며 게시 재시도 버튼이 없다. 해당 save journal1/게시 journal0·기존 게시v2 불변. 이후 서버 재시작·reload 뒤에도 같은 중지 기록을 확인했다.
- **UI17-C:** run `ecbbb539-dcae-4973-bb8d-768d7e794ea0`의 saveDraft succeeded/publish running을 읽기 전용 DB로 확인한 뒤 이번 검증이 시작한 정확한 Node PID63734를 TERM 종료했다. 같은 DB/설정의 **주입기 없는 정상 서버**로 재기동했다. 시작 복원은 전체 partial·publish interrupted/RUN_INTERRUPTED/retryabletrue·saveDraft succeeded였고 게시 journal0·기존v2를 유지했다. 브라우저 reload→AI 열기에서 같은 중단 기록·공유 다시 시도를 확인했다. 새 요청/원문 재입력 없이 Enter→GET 원래 run→POST retry의 body는 `{stepId:"publish"}`뿐이었다. 같은 run succeeded·게시v3, save journal1/게시 journal1이며 완료 save/model 재실행0·자동 게시 재개0이다.
- **UI17-D:** 390×844에서 실패 안내·중지 영속 기록·복구 완료 단계와 composer를 실제 캡처/검토했다. 카드 폭/여백·상태색/행 정렬·주요 버튼36px·가로 넘침0, Enter 전송/재시도/중지를 확인했다. 1440×1000의 저장본/실행 기록도 캡처했다. 기능/선택 디자인 PASS_SELECTED. 전체 키보드 순서·실휴대폰·스크린리더 발화는 미검증이다. 최초 중지/재시작 PNG 두 장은 재마운트·초점 스크롤로 대상 상태가 담기지 않아 시각 증빙에서 제외했다. **중단 직후 상태는 DOM+DB JSON**, 최종 중지/복구는 교체 PNG로 증명하며 중단 화면 자체 PNG가 있다고 보고하지 않는다.

세 실행의 save journal은 각각 정확1개이고 저장 문서는 revision 제외 deep equal이다. 게시 snapshot634,513,000·dashboard31/metric38을 유지했다. 모델 단계 없는 명시 저장/공유 경로이므로 제품 LLM 호출0이며 gpt-6-luna 설정을 변경하지 않았다. 새로운 제품 오류/제품 코드 변경0·기존 관련 회귀/타입/빌드 결과 재사용·문서 diff check PASS. 정상 게시·만료·권한 전체 조건은 반복하지 않았다.

검증 뒤 같은 로컬 게시본을 **비공개 v4/복제 비허용**으로 복구했다(정리용 재게시이며 신규 PASS 수로 합산하지 않는다). 임시 hook 서버를 정상 서버로 교체·관측 interceptor/viewport 정리·Ego TaskSpace2 종료를 확인했다. VoiceOver BLOCKED 유지. 서버는 정상 API4331/FE3231로 남겼다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-execution-publication-recovery-20261016`의 `adapter-events.jsonl`, `01-failed.json`, `02-retry.json`, `03-cancel.json`, `04-before-restart.json`, `05-restarted.json`, `05-restarted-db.json`, `06-restart-retry.json`, `verification-db.json`, `layout.json`, `cleanup.json`. 대표 화면은 `01-failed-390.png`, `03-cancel-persisted-390.png`, `06-recovered-detail-390.png`, `07-records-1440.png`다. 영속 기록 숫자는 DB·실제 요청과 대조했다.

이번 변경은 검증 문서만이며 미커밋이다. 남은 별도 gate는 게시 commit 직후 서버 종료/응답 유실의 실행기 연결, 다른 탭이 revision/게시 범위를 바꾸는 재시도 경쟁, 운영 MySQL·실휴대폰·VoiceOver 및 전체 제품 수용이다. 기존 하위/수동 게시 통과 결과를 이 전체 조합 PASS로 확대하지 않는다.

## STUDIO-UI18 게시 commit 직후 장애·응답 유실 — 2026-10-16

STUDIO-A03/P02의 commit 이후 실행기 경계만 선택한다. UI16/17의 commit 전 실패·취소·수동 게시 조건은 반복하지 않는다.

| 조건 | 기대 결과 | 상태 |
|---|---|---|
| UI18-A | 게시 실제 commit/journal 생성 직후 실행기 완료 기록 전 Node 종료→같은 DB 정상 재시작→같은 run/게시 영수증 완료 복원·자동 추가 POST/버전 증가0 | PASS_SELECTED |
| UI18-B | 별도 실행의 실제 저장·게시 완료 응답을 탭에서1회 유실→불명확 안내·읽기 상태 확인→동일 run/버전 복원·저장/게시 추가 POST0 | PASS_SELECTED |
| UI18-C | 390px 장애/복구·Enter·정렬/넘침·수치/정의·journal 정확1개 검증 | PASS_SELECTED |


### 실제 결과

기준 develop-v2 `722b6fbc`. UI17 기록을 drumcap으로 커밋·push했다. push 직전 원격 `50df3af3`의 Studio 생성 복구/명시 저장 연속성 변경을 충돌 없이 rebase 통합했다. 최신 BE Nest build PASS. 제품 변경 없는 이번 검증에는 기존 관련 단위·FE 타입/빌드 근거를 재사용하고 통과 MD 전체를 반복하지 않았다.

**UI18-A — 실제 commit 이후 서버 종료.** 기존 로컬 dashboard32/source9에서 Enter로 ‘저장하고 링크로 공유해줘’를 요청했다. 저장소 밖 Node preload가 해당 dashboard 및 publication-execution requestId에 한해 실제 StudioPublicationService.publish 반환 직후 대기했다. run `35c62159-f7fc-4eb7-8776-6ba55ec857df`의 save journal1·게시 journal1·게시v5/link를 읽기 전용 DB로 확인했고 실행기 상태는 running/publish running이었다. 이는 commit 전 UI17 대기와 다르다. 정확한 검증 PID40801을 TERM 종료해 실제 응답 연결을 끊었으며 브라우저는 연결 오류/저장 보존 안내를 표시했다.

같은 DB/설정의 **주입기 없는 정상 서버**로 재시작했다. 시작 복원은 같은 run의 모든 단계 succeeded·동일 게시v5 영수증을 복원했다. 사용자의 상태 새로고침 Enter 및 기존 상태 조회는 GET /studio/runs뿐이었고 추가 POST0·게시 버전 증가0이었다. save/publication journal 각각1을 다시 대조했다. DB transaction 중 전원 손실·디스크 손상이나 프로세스 SIGKILL 전체 변형을 검증한 것은 아니다.

**UI18-B — 완료 응답만 탭에서 유실.** 재시작 전 편집 기준으로 별도 실행을 준비한 첫 시도는 정상409로 차단됐다. 해당 이전 실패 기록을 새 완료 실행의 상태로 혼동하지 않았고 `preparation-stale-guard.json`에 남겼다. 최신 저장본 reload 후 별도 run `154ce6a6-49c8-44b8-b93a-3ccc718161bb`을 실행했다. 서버는 실제 저장·게시v6·전체 succeeded를 완료했고, 해당 탭 Axios response interceptor가 이 실행의 완료 응답만1회503 형태로 거절했다. 실제 서버503·HTTP 패킷 유실로 확대하지 않는다. 오류 본문 `verification completed response hidden`은 주입한 테스트 메시지이며 제품의 최종 안내 문구 품질을 증명하지 않는다.

응답 유실 직후에는 이전 요청5의 실패 기록과 오류가 남았고 새 실행6의 완료가 자동 적용됐다고 보고하지 않았다. ‘상태 새로고침’ focus→Enter로 GET1회 후 실제 새 run/게시v6/모든 완료 단계가 표시됐다. 관측 요청은 최초 POST /studio/executions1회 + 복구 GET /studio/runs1회뿐이다. 추가 전송/저장/게시 POST0·같은 run의 save/publication journal 각각1·v6 불변을 확인했다. 알려진 완료 상태를 다시 쓰는 재시도를 실행하지 않았다.

**UI18-C — 화면·지속 상태.** 실제390×844의 서버 종료 오류·v5 복원·완료 응답 유실 오류·v6 복원 화면을 캡처/직접 확인했다. 상태/단계 행 정렬·카드/본문 줄바꿈·링크 버튼·composer 하단 유지·가로 넘침0을 확인했다. 상태 새로고침/게시 링크 높이36px·composer x1/너비389/y641/높이203이다. 내부 스크롤의 카드 상단 일부가 viewport 밖인 화면은 스크롤 상태이며 문서 전체 캡처로 오인하지 않는다. 기능 및 선택 모바일 디자인 PASS_SELECTED, 전체 Tab·실기기·스크린리더·모든 네트워크 오류 문구는 별도다.

두 성공 실행의 저장 문서는 revision 제외 deep equal이고 snapshot634,513,000·dashboard31/metric38을 유지했다. 코드 오류를 확정하지 않아 제품 수정0·모델 호출0이며 gpt-6-luna 설정/VoiceOver BLOCKED 유지. 검증 뒤 같은 로컬 게시본은 비공개v7/복제 비허용으로 복구했다(정리용 재게시). 정상 서버/DB 유지·탭 reload로 interceptor 제거·viewport 해제·Ego TaskSpace3 종료 확인. 문서 diff check PASS.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-postcommit-recovery-20261016`의 `before.json`, `postcommit-events.jsonl`, `01-committed-before-stop.json`, `02-stopped-ui.json`, `03-restarted.json`/`03-restarted-db.json`, `preparation-stale-guard.json`, `04-response-lost.json`, `05-response-recovered.json`, `verification-db.json`, `layout.json`, `cleanup.json`. 대표 캡처 `02-stopped-390.png`, `03-restarted-390.png`, `04-response-lost-390.png`, `05-response-recovered-390.png`.

후속 우선 gate는 다른 탭의 revision/게시 범위 변경과 재시도 경합이다. 운영 MySQL·다중 서버/디스크 장애·실휴대폰·VoiceOver·전체 제품 수용은 여전히 미완료다. 이번 기록은 미커밋이며 앞선 UI17까지의 push와 구분한다.
