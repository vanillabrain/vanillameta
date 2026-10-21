# UC056: 외부 에이전트에서 Artifact 제작

2026-10-21 · develop `7c711bd7` · 사용자가 MCP 서버 추가를 요청해 기존 제안/저장 경계에 로컬 stdio 어댑터를 연결한다. 구현을 위한 새 의존성은 이 사용자 요청의 MCP SDK에 한정하며 기존 AI 모델/실행기를 바꾸지 않는다.

## 설계 선택

Nest에 원격 MCP HTTP/OAuth를 추가하는 방식과 로컬 stdio 어댑터를 비교했다. 첫 버전은 `mcp-server/` 독립 npm 패키지의 공식 SDK v2를 사용한다. API는 기존 Nest HTTP/JWT 그대로이며 새 DB·큐·서버 포트를 만들지 않는다. stdout은 MCP 전용이다. 사용자의 명시 MCP 추가 요청과 앞서 제시한 제작 범위에 따라 설계 후 로컬 구현을 진행하며 명세 상태는 Draft로 유지한다.

## 계약

- 설정한 고정 API URL(HTTPS/HTTP loopback만)과 사용자 access token으로 모든 요청을 보낸다. 도구 인자로 URL/token/actor/SQL을 받지 않는다. redirect를 따르지 않는다.
- 소스 목록은 `/bi/sources`, 스키마/저장 지표는 profile/metrics 보호 API를 사용하고 설정·파일 경로·원본 표본을 투영에서 제외한다.
- `vm_propose_analysis`: sourceId/prompt/선택 지표·필요한 명확화 답변→기존 `/studio/proposals`. 생성과 전체 계산 미리보기이며 영속 저장0이다.
- `vm_get_proposal`: 명시 원 제안 조회, 만료는 자동 재생성하지 않는다.
- `vm_save_analysis`: proposalId/expectedSourceRevision/UUID requestId/confirmSave=true가 있어야 기존 `/studio/dashboards`로 저장한다. 모델의 true만으로 사람 승인을 증명하지는 않으며 호스트가 사용자 승인을 얻어야 한다. 저장 도구는 destructive=false/readOnly=false/idempotent=true이며 게시/공유를 하지 않는다.
- 응답 유실은 정확한 같은 입력/requestId로 재시도한다. 409/401/403/만료는 정제된 오류로 반환하고 자동 모델·권한·버전 변경을 하지 않는다.
- 저장 결과는 dashboardId/저장 문서 요약/설정된 웹 base의 Studio URL을 제공한다. URL은 인증정보를 포함하지 않는다.
- `vm_get_artifact`: 보호 GET으로 저장 분석을 다시 읽어 요약/집계 미리보기/Studio 링크를 확인한다. 저장 정의/배치 전체와 파일 경로를 무조건 전송하지 않는다.
- API body/응답 크기·시간 제한, MCP 취소→HTTP abort, 프로세스 종료 정리를 적용한다. 오류 원문·응답 헤더·토큰을 반환/로그하지 않는다.

## 변경/검증

독립 패키지 src(config/API/projection/server/stdio), 공식 SDK 클라이언트 테스트, 로컬 Nest/MySQL 실행기 검증, 사용 설명서 MCP/제작/연결·README 지원 현황을 갱신한다. 단위/프로토콜 테스트는 인증·응답 투영·쓰기 동의·같은 UUID·HTTP 실패/시간제한/취소·잘못된 입력/URL/redirect를 포함한다. 실제 서버는 두 계정 격리·실제 Codex 합성 샘플 제안/미리보기·저장/replay/GET과 다른 계정 거절을 구분한다. SDK 클라이언트 실행과 실제 Codex 호스트의 도구 호출은 별도 증거다.

## 제외

원격 Streamable HTTP/OAuth, 익명 MCP, 자동 공개 게시/공유·임의 SQL/파일 업로드·기존 분석 AI 수정 전체·MK AI 계약·운영 수용은 이번 단위가 아니다. 기존 버전/권한/원자 저장을 복제 구현하지 않는다.
