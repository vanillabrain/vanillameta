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
