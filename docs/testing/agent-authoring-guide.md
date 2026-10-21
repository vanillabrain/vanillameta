# 에이전트 제작 안내 대조·검증

2026-10-21 · 기준 develop `863e5500` · [계획](../plans/agent-authoring-guide.md)

## 코드 대조

- `ai/coding-agent.ts`: Codex 고정 요청 모델, 임시 cwd/read-only/ephemeral/ignore-user-config, PATH/HOME/CODEX_HOME만 전달, 명시 연결/카탈로그, POSIX 한정·동시2·기본120/최대180초.
- `ai/ai.service.ts`, `dashboard-studio/studio-run.service.ts`: 서버 제공자 선택과 제한된 초안 AI 실행. 서버→CLI와 외부 클라이언트→VM 도구 호출은 다른 방향이다.
- `dashboard-studio/studio.controller.ts` 및 관련 HTTP 컨트롤: 기존 보호 API가 있지만 MCP server/transport/tool 등록이 아니다.
- README Roadmap과 추적 소스의 MCP 구현 부재를 대조했다. 이전 MK AI 별도 프로젝트 원칙과 현재 사용자의 VM 외부 에이전트 진입 우선순위를 구별했다.

UC012 생성과 UC008 초안 편집의 기존 계약·Draft 상태는 유지했다. 문서 부재를 기능 구현 완료로 바꾸지 않았다. 일반 사용자의 제작 여정과 운영자의 실행 엔진 설정, 미제공 MCP를3개 가이드로 분리하고 메뉴/홈/목차/AI 생성/문제 해결/지원 범위를 연결했다. AGENTS에는 이 구분과 후속 우선순위만 추가했다.

## 이번 실행

- 기존 CLI `codex-cli 0.162.1`의 version/login help/exec help를 확인했다. 로그인 status는 ChatGPT 로그인 상태였다. 로그인·전역 설정을 변경하지 않았다.
- 기존 제품 호출기와 실제 설정을 사용해 합성 schema `sales(day DATE, revenue DOUBLE)`만으로 집계/값 열/시간 열의 구조화 응답을 요청했다. 10,542ms 후 `{aggregate: SUM, valueColumn: revenue, timeColumn: day}`를 얻고 assertion을 통과했다. 요청 모델은gpt-6-luna이며 응답의 자기소개를 실제 모델 실행 증명으로 사용하지 않았다.
- `npm --prefix backend-api test -- --runInBand --runTestsByPath src/ai/coding-agent.spec.ts`: 1 suite/22 PASS. child process를 mock하는 단위 검증이며 실호출과 별도다.
- 공개 설치 설명은 OpenAI 공식 CLI 안내와 현재 CLI 명령을 대조했다. MCP 개념은 공식 아키텍처 안내만 참고했다. 외부 Claude Code·MCP 실행/새 전체 앱 생성·게시 여정은 수행하지 않았다. 기존 실제 캡처의 재사용과 외부 요청문 예시를 본문에 명시했다.

## 문서 검증 범위

루트와 `/guide/` 하위 경로 빌드 모두26개 HTML/1277개 로컬 참조 오류0이었다. Ego129에서 새3개 문서를390/768/1440px로 읽고 가로 넘침0·강조 문법 노출0, 기존 이미지5개 로딩을 확인했다. 모바일 검색에서 Codex 입력 후 연결 가이드의 본문 섹션이 결과로 노출됐다. 최종 push SHA·Actions·실제 도메인 검증은 전달 결과로 구분한다. 제품 소스 수정은 없으며 기존 backend-api/yarn.lock과 잠금 파일은 제외한다.

## 남은 제품 공백

MCP 설치/인증/도구 발견→접근 가능한 소스·지표→제안/전체 미리보기→명시 저장→Studio 링크의 직접 여정은 미구현이다. 이번 문서 보완을 그 수용으로 표시하지 않는다. 새 서버 구현은 동일 권한·epoch·버전·멱등 저장 경계를 재사용하고 실제 지원 클라이언트로 검증해야 한다. 기능 목록 수나 문서 수를 제품 완료율로 환산하지 않는다.
