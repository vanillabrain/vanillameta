# Studio / develop-v2 통합 검증 — 2026-10-16

## 기준과 범위

- 원래 작업: `codex/self-service-next-20261014`, HEAD `58a1a39f81cc41cc06bbc1cb67d95f04fe8cc265`. 미커밋 30개 경로를 별도 snapshot `f8e8f38c2f4aeb83e0cd224a928392c8d73131fb`에 보존했다.
- 원격 develop-v2: `ddceeb47efe5b862a7e533043649b40092181194` (fetch 기준). 원래 브랜치는 원격 대비 12 ahead / 36 behind다.
- 수정 위치: `codex/studio-develop-v2-ready-20261016`, `/Users/moonklabs/.codex/worktrees/studio-develop-v2-merge-check/vanillameta`. 기존 작업 트리와 develop-v2 포인터를 변경하지 않는다.
- Node 24, 새 프런트 npm ci, 백엔드 동일 lock의 기존 의존성 재사용. FE localhost:3231 / API localhost:4331. 기존 메타데이터 DB의 별도 SQLite backup을 사용한다. 기존 서버·DB를 초기화하지 않는다.
- 증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/develop-v2-merge-20261016`. 임시 원본 검사 로그는 `/private/tmp/vanillameta-merge-review-20261016`. 인증정보·DB·서버 원본 로그는 증빙/커밋에 포함하지 않는다.
- gpt-6-luna 설정 유지. 모델 호출 변경이 없어 기존 실제 AI 검증을 재사용하며 신규 생성 성공을 주장하지 않는다. VoiceOver BLOCKED 유지.

## MD 인수 조건

| ID | 입력 / 기대 결과 | 상태 |
| --- | --- | --- |
| MERGE-01 | 최신 원격과 미커밋 내용을 포함해 통합. 9개 텍스트 충돌 해소, 충돌 마커/미해결 index 0. clean npm ci, FE 타입, 양쪽 build 및 영향 테스트 통과 | 최종 Git 확인 중 |
| MERGE-02 | 복사 DB의 Studio25, Rill 총 요청 634,513,000. 공통 shadcn 화면과 Studio 국소 MUI 테마 공존. 데스크톱/390px에서 제목·숫자·버튼·패널 잘림 없이 표시, 키보드 대화 패널 열기/닫기 | PASS (1280×720 / 390×844) |
| MERGE-03 | 기존 64hex Studio 게시 링크는 Studio API/뷰어, UUID 링크는 신규 분석 게시 API/뷰어. 부정 응답에서 다른 API로 fallback하지 않음. 잘못된 형식은 요청 없이 안내 | NOT_RUN |
| MERGE-04 | 구형 손상 링크 메타데이터는 복구 가능, 손상 Studio 기간/필터는 범위 확장 없이 거절. stable block UUID 유지. 원자 생성 preview 계약과 양쪽 migration 등록 유지 | PASS (SQLite / 단위) |

## 충돌 해소 방식

공통 페이지·차트·토큰은 최신 shadcn/Tailwind 구현을 유지한다. Studio의 기존 4개 MUI/Emotion 의존성과 국소 ThemeProvider만 유지한다. 전역 MUI 부트스트랩이나 삭제된 구형 라이브러리를 복원하지 않는다. Studio 전체 shadcn 전환은 별도 후속 작업이다.

`AGENTS.md`, AppModule, 지표 링크 테스트, DashboardAnalysis, GettingStarted, DashboardView, FileAnalysis, LineChart resize 테스트, WidgetViewer의 텍스트 충돌을 병합했다. 양쪽 migration·테스트 조건·Studio 진입점과 hideHeader를 보존했다. 자동 병합에서 남은 Alert→Notice 불일치, 위젯 내부 CSS 선택자, 게시 URL 라우트 충돌도 수정했다.

## 검사 결과

- BE 초기 전체: 115파일 중 112 PASS, 3 FAIL (1,996 PASS / 15 FAIL). 실패 원인을 수정한 뒤 해당 3파일 **94 PASS**. 합계 고유 테스트 **2,012 PASS** (회귀 1개 추가). 전체 명령이 한 번에 통과한 결과로 표기하지 않는다.
- FE 초기 전체: 88파일 중 87 PASS, 1 FAIL (1,237 PASS / 1 FAIL). Radix 다중 선택 테스트 helper로 수정한 해당 파일 **47 PASS**. 합계 고유 테스트 **1,238 PASS**. 나머지 통과 파일은 반복하지 않았다.
- 양쪽 최종 build PASS, FE tsc PASS. 변경 FE lint PASS. 변경 BE lint 0 errors / 기존 spec 경고 6개.
- API 복사 DB에서 기동 성공. 양쪽 migration 등록이 포함된 AppModule 빌드·SQLite 로드 성공.

UI 결과와 최종 Git 상태는 아래에 추가한다.
