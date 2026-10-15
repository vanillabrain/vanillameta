# Studio / develop-v2 통합 검증 — 2026-10-16

## 기준과 범위

- 원래 작업: `codex/self-service-next-20261014`, HEAD `58a1a39f81cc41cc06bbc1cb67d95f04fe8cc265`. 미커밋 30개 경로를 별도 snapshot `f8e8f38c2f4aeb83e0cd224a928392c8d73131fb`에 보존했다.
- 최초 원격 develop-v2: `ddceeb47efe5b862a7e533043649b40092181194`. 당시 원래 브랜치는 12 ahead / 36 behind였다. 최종 확인에서 추가된 `e98aacc8bd9992cc614789b2d98f6d31de765b17`까지 다시 fetch·통합했다 (원래 브랜치 기준 12 ahead / 37 behind).
- 수정 위치: `codex/studio-develop-v2-ready-20261016`, `/Users/moonklabs/.codex/worktrees/studio-develop-v2-merge-check/vanillameta`. 기존 작업 트리와 develop-v2 포인터를 변경하지 않는다.
- Node 24, 새 프런트 npm ci, 백엔드 동일 lock의 기존 의존성 재사용. FE localhost:3231 / API localhost:4331. 기존 메타데이터 DB의 별도 SQLite backup을 사용한다. 기존 서버·DB를 초기화하지 않는다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/develop-v2-merge-20261016`. 임시 원본 검사 로그는 `/private/tmp/vanillameta-merge-review-20261016`. 인증정보·DB·서버 원본 로그는 증빙/커밋에 포함하지 않는다.
- gpt-6-luna 설정 유지. 모델 호출 변경이 없어 기존 실제 AI 검증을 재사용하며 신규 생성 성공을 주장하지 않는다. VoiceOver BLOCKED 유지.

## MD 인수 조건

| ID | 입력 / 기대 결과 | 상태 |
| --- | --- | --- |
| MERGE-01 | 최신 원격과 미커밋 내용을 포함해 통합. 9개 텍스트 충돌 해소, 충돌 마커/미해결 index 0. clean npm ci, FE 타입, 양쪽 build 및 영향 테스트 통과 | PASS |
| MERGE-02 | 복사 DB의 Studio25, Rill 총 요청 634,513,000. 공통 shadcn 화면과 Studio 국소 MUI 테마 공존. 데스크톱/390px에서 제목·숫자·버튼·패널 잘림 없이 표시, 키보드 대화 패널 열기/닫기 | PASS (1280×720 / 390×844) |
| MERGE-03 | 기존 64hex Studio 게시 링크는 Studio API/뷰어, UUID 링크는 신규 분석 게시 API/뷰어. 부정 응답에서 다른 API로 fallback하지 않음. 잘못된 형식은 요청 없이 안내 | PASS_SELECTED (Studio200 / UUID404 / malformed요청0; UUID200은 컴포넌트 회귀) |
| MERGE-04 | 구형 손상 링크 메타데이터는 복구 가능, 손상 Studio 기간/필터는 범위 확장 없이 거절. stable block UUID 유지. 원자 생성 preview 계약과 양쪽 migration 등록 유지 | PASS (SQLite / 단위) |

## 충돌 해소 방식

공통 페이지·차트·토큰은 최신 shadcn/Tailwind 구현을 유지한다. Studio의 기존 4개 MUI/Emotion 의존성과 국소 ThemeProvider만 유지한다. 전역 MUI 부트스트랩이나 삭제된 구형 라이브러리를 복원하지 않는다. Studio 전체 shadcn 전환은 별도 후속 작업이다.

`AGENTS.md`, AppModule, 지표 링크 테스트, DashboardAnalysis, GettingStarted, DashboardView, FileAnalysis, LineChart resize 테스트, WidgetViewer의 텍스트 충돌을 병합했다. 양쪽 migration·테스트 조건·Studio 진입점과 hideHeader를 보존했다. 자동 병합에서 남은 Alert→Notice 불일치, 위젯 내부 CSS 선택자, 게시 URL 라우트 충돌도 수정했다.

## 검사 결과

- BE 초기 전체: 115파일 중 112 PASS, 3 FAIL (1,996 PASS / 15 FAIL). 실패 원인을 수정한 뒤 해당 3파일 **94 PASS**. 합계 고유 테스트 **2,012 PASS** (회귀 1개 추가). 전체 명령이 한 번에 통과한 결과로 표기하지 않는다.
- FE 초기 전체: 88파일 중 87 PASS, 1 FAIL (1,237 PASS / 1 FAIL). Radix 다중 선택 테스트 helper로 수정한 해당 파일 **47 PASS**. 합계 고유 테스트 **1,238 PASS**. 나머지 통과 파일은 반복하지 않았다.
- 양쪽 최종 build PASS, FE tsc PASS. 변경 FE lint PASS. 변경 BE lint 0 errors / 기존 spec 경고 6개.
- API 복사 DB에서 기동 성공. 양쪽 migration 등록이 포함된 AppModule 빌드·SQLite 로드 성공.

## 실제 브라우저 / 디자인 결과

Codex 인앱 브라우저 localhost:3231에서 확인했다. 기존 Aside/Ego 명령 대신 현재 제공되는 CUA 브라우저 도구를 사용했다.

- MERGE-02 기능 PASS: Studio25의 총 요청 **634,513,000** 유지. 중복 위젯 제목 없음, 차트 내부 높이 204px / 모바일 폭332px. 공통 shadcn 홈과 국소 MUI Studio가 각각 렌더링된다.
- MERGE-02 디자인 PASS_SELECTED: 1280×720 / 390×844의 제목·숫자·버튼·차트·보조 패널을 실제 캡처로 확인했다. 390px document scrollWidth390. 모바일 대화 Drawer가 화면 안에 있고 입력/전송이 보인다. Enter로 AI 패널 열기→입력에서 Escape→AI 열기로 포커스 복원. 실제 VoiceOver/실기기/모든 오류 상태는 미실행이다.
- MERGE-03: 보존한 로컬 테스트 게시본20 v1은 `GET /v1/studio/publications/<64hex>`200, 2023-09-10~11 Mobile/Tablet 요청 **90,789,400.00** / 평균 **5.922633**. 기존 게시나 권한을 새로 만들지 않았다.
- 존재하지 않는 형식상 정상 UUID는 `GET /v1/publications/<uuid>`404와 기존 중지·만료 안내를 표시한다. Studio API fallback0. `invalid` 토큰은 형식 안내와 API 요청0. 실제 활성 UUID200은 이 복사 DB에 fixture가 없어 NOT_RUN이며, 라우트 단위 회귀에서 올바른 뷰어/layout 선택을 검증했다. 기존 게시 기능 전체 PASS로 확장하지 않는다.
- `publication-routing.json`은 URL·메서드·상태만 저장하며 Studio 토큰은 마스킹했다. 원본 request/response headers·인증·서버 로그는 보존하지 않는다.

캡처: `studio-desktop.jpg`, `studio-mobile-canvas.jpg`, `studio-mobile-panel.jpg`, `studio-published-mobile.jpg`, `uuid-published-404-mobile.jpg`. 증빙 폴더는 위 경로를 따른다.

## 최신 추가 커밋 통합

검증 중 원격 develop-v2가 `e98aacc8`로 전진했다. 생성 질문→frozen proposal 저장→게시 준비 handoff의 22파일 변경을 추가 통합했다. 코드 충돌은 없었고 `AGENTS.md` / `TC-005-dashboard-lifecycle.md` 문서 충돌2개는 최신 UC023 전체 여정 증빙과 Studio T10~15의 시점별 증빙을 모두 남겼다. 서로 다른 UI의 통과를 합산해 전체 수용으로 바꾸지 않는다.

최종 추가 영향 검사 (앞의 전체 결과와 중복을 단순 합산하지 않음):

- BE `creation-lifecycle`, `semantic-proposal.service`, `semantic-creation.service`, `studio-creation.service`: **4파일 / 79 PASS**.
- FE `AiDashboardPanel`, `Dashboard/index`, `StudioConversationCreation`: **3파일 / 32 PASS**.
- 최종 루트 `npm run build` PASS (BE+FE), FE `tsc --noEmit` PASS, 추가 변경 BE/FE eslint PASS.
- 최신 생성 모달의 실제 Rill 공식 소스 선택·안내 문구·취소를1280/390에서 확인했다. `analysis-creation-selected-desktop.jpg` / `analysis-creation-selected-mobile.jpg`. 최초 빈 선택 상태 캡처와 구분한다. 신규 LLM 호출/저장·게시 전체 여정은 이 병합 범위에서 반복하지 않았다. 따라서 upstream 문서의 실제 LLM/E2E 결과는 기존 증빙이며 이번 후보의 fresh 결과로 주장하지 않는다.

## 보존 / 후속 범위

원래 30개 미커밋 경로는 백업과 SHA256 비교에서 모두 동일하며 HEAD도 그대로다. 원본 develop-v2 로컬 포인터 `0887922a`는 변경하지 않는다. 전체 병합은 별도 후보에만 로컬 커밋하고 원격 push는 하지 않는다. 초기 merge 커밋은 `5e288042`이며 최종 후보는 추가 upstream merge를 포함한다.

현재 작업은 충돌 수정·통합 가능성 검증이다. 운영 MySQL migration 실행, 활성 UUID 게시200의 실제 브라우저, 모든 핵심 E2E, gpt-6-luna 재생성, 실제 VoiceOver, Studio 전체 shadcn 전환은 이번 실행 범위 밖이다. 기존4개 MUI/Emotion 의존성의 국소 공존은 호환성 조치이며 전면 마이그레이션 완료를 뜻하지 않는다.

검증된 후보를 통합할 때에는 이 후보 전체 이력을 사용한다. UI/의존성 수정 파일만 구형 원본 브랜치에 따로 복사하면 upstream 전제가 없어 깨질 수 있다. 원본 미커밋 T14/T15는 snapshot 부모에 이미 포함되어 있으므로 같은 내용을 중복 적용하지 않는다. develop-v2가 다시 전진했다면 새 차이를 먼저 확인한다.
