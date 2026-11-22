# 11월 23일 고객 발표 · 비공개 AI 차트

2026-11-22에 발표 전용 Compose에서 검증했다. PostgreSQL 17.11, 웹 포트 3000, API 포트 4000을 사용했다. 제품 기준은 `feat/mcp-artifact-system@c8bca132`이며, 발표 시나리오는 [Codex로 첫 차트 만들기](../user-manual/site/codex-first-chart.md)를 따른다. 아래 값의 단위는 만 원이고 모두 합성 데이터다.

| 조건 | 실제 관찰 | 증빙 파일 |
| --- | --- | --- |
| Claude Code 2.1.330 연결 | 브라우저에서 VanillaMeta Demo 조직과 아티팩트 읽기·쓰기를 확인해 승인했다. 콜백 53683을 거쳐 다섯 도구가 보였다. | live-approval.png, rehearsal-live.json |
| 도움말로 라이브 시연 | 새 브라우저와 새 Claude 대화에서 목차 → 승인 → 두 프롬프트 → 재열기까지 82.988초. 생성 링크에서 서울 120·부산 80, 같은 대화로 수정 후 같은 URL에서 서울 120·부산 100을 읽었다. 상세 탭을 닫고 허브에서 같은 ID의 버전 2를 열었다. | rehearsal-live.json, live-v1.png, live-v2.png |
| 실제 Codex 호스트 | ChatGPT 앱 번들 CLI 0.167.0-alpha.3.2가 기존 ChatGPT 로그인과 gpt-6-luna로 생성·조회·수정했다. 0.154.0의 OAuth 연결은 성공했으나 같은 계정의 모델 호출은 model_not_found였다. | codex-host.json, codex-owner-v2.png |
| 영속성 | 두 호스트가 만든 ID의 PostgreSQL 내용이 브라우저 금액과 같았다. 전체 컨테이너를 다시 만든 뒤 두 ID 모두 소유자가 리비전 2로 열었다. | postgres-hosts.jsonl, codex-after-restart.json, live-verified-browser.json |
| 목록과 개인 권한 | 1440px·390px에서 내 아티팩트 검색, 상세 재열기, 검색 조건으로 돌아가기, 넘침 0px. 독립 계정의 소유자 API 목록은 비었고 직접 URL은 404로 제목·본문을 숨겼다. | live-verified-browser.json, live-verified-hub-390.png, live-verified-other-account.png |
| 승인 취소·쓰기 미승인 | 실제 승인 UI에서 취소 시 access_denied, 읽기만 선택하면 도구 목록에 조회 두 개만 남았다. 전용 로컬 테스트 클라이언트를 사용했다. | consent-decisions.json |
| 낡은 버전 충돌 | 별도 로컬 MCP 계약 검사에서 버전 1 기반의 재수정이 거부됐고 같은 ID의 버전 2와 120·100이 유지됐다. | contract.json, postgres.json |
| 고객 도움말 | VitePress 빌드, 29페이지 로컬 참조 1,690개 검사 오류 0. 목차·빠른 시작·MCP에서 튜토리얼로 진입하며 실제 캡처 두 장이 열린다. | docs-codex-browser.json, docs-remote-browser.json, rehearsal-saved.json |

로컬 증빙 폴더는 `phase2-evidence/demo-20261122/`다. `presenter.md`에 발표용 시작·종료 명령과 예비 저장본이 있다. 검증 환경에서 10분짜리 MCP 토큰 만료 후에는 호스트에서 다시 승인한다.

변경부 프런트엔드 선택 테스트 24개와 대시보드 호출자 테스트 1개, 권한 검색 설정 테스트 13개가 통과했다. 전체 Dashboard 테스트에는 기존에 기록된 실패 12개가 남아 있다. 실제 고객 기기·사람의 수용 테스트·VoiceOver 발화·운영 배포는 이번 판정 범위 밖이다.
