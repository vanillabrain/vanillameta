# UC056 MCP 제작 실행 증빙

2026-10-21 · 기준 develop `7c711bd7` + 이번 MCP 변경 · [계획](../plans/UC-056-mcp-authoring.md) · [UC056](../use_cases/UC-056-mcp-artifact-authoring.md) · [TC056](../test_cases/TC-056-mcp-artifact-authoring.md)

## 구현과 범위

`mcp-server/`는 공식 MCP SDK v2.3.1/server·zod4.6.7의 독립 Node24 stdio 패키지다. SDK client2.3.1은 테스트 의존성이다. 기존 Nest·JWT·Studio 제안/원자 저장/영수증을 HTTP로 재사용했다. 제품 backend/DB schema/AI 모델은 변경하지 않았으며 SDK 의존성은 이번 사용자 MCP 구현 요청에 한정한다.

6도구는 접근 가능한 소스, 스키마/저장 지표, 제안+전체 블록 계산 미리보기, 제안 재조회, 승인 비공개 저장, 저장 분석 재조회다. 전송 SQL/원본 표본/접속 설정/내부 파일 경로는 투영에서 제외했다. 집계 결과는 블록당240행을 넘으면 명시 잘림·원 건수를 표시한다. stdout은 MCP만 사용한다. 고정 HTTPS/loopback API와 사용자 token, redirect 금지·응답2MiB·HTTP190초/취소 전파를 따른다. token 자동 갱신/게시/공유/원격HTTP MCP/OAuth는 없다.

## 실행 결과

### 단위·프로토콜

구현 전 API 모듈 부재로 테스트 실패를 확인한 뒤 구현했다. 최종 `npm --prefix mcp-server test`는17 PASS다. 실제 stdio 자식 초기화/6도구 발견, 입력·동의·추가 SQL 차단, 고정 대상/redirect·비밀 비노출, 응답 제한·시간제한·취소, 같은 저장 입력/응답 유실 재시도, precision string/행 잘림,401/403/409를 포함한다.

초기 취소 검증은 SDK v1의 세 번째 옵션 인자 관습을 사용해 취소를 전달하지 못했다. SDK v2의 두 번째 options 인자로 바꾸고 실제 MCP→HTTP AbortSignal 전파를 확인했다. 제품을 약화하거나 테스트를 제거하지 않았다.

### 실제 SDK 클라이언트 / Nest / MySQL

전용 `qa-enterprise-mysql.cjs`의 MySQL8.4.11/Nest/native DuckDB/Vite에서 합성 두 계정과 CSV(day/amount=100/200/300)를 준비했다. SDK client가 별도 stdio child를 실행해12개 도구 호출을 검증했다.

- 본인 소스/스키마 조회, 타인 목록 비노출/프로필403.
- 실제 Codex를 사용하는 제안의 숫자600/시계열3점·두 블록. 제안 전후 dashboard COUNT 불변.
- 기존 생성안 조회, 승인 저장 후 dashboard COUNT 정확히1 증가.
- 동일 UUID/본문 재시도는 동일 ID/추가 생성0. 같은UUID에 다른 revision은409.
- 저장본 GET의 본인 소스/두 블록/600, 타인 GET403, 잘못된 token401.

새 빈 DB의 제품 Component 정의만 초기화했다. 운영 migration/일반 데이터 이전이 아니다. 기존 사용자의 서버/로그인/자료는 변경하지 않았다.

### 실제 Codex 호스트

Codex CLI0.162.1·요청 모델gpt-6-luna와 기존 로그인/필수 제공자 연결을 사용했다. 임시 CLI 옵션으로 이 MCP만 설정했으며 사용자 전역 MCP/모델/로그인을 변경하지 않았다.

최초 `codex exec`의 기본 approval=never는 조회 두 도구 뒤 비조회 제안을 거절했다. 이 결과를 연결 실패나 제품 성공으로 처리하지 않았다. 후속 실행에는 해당 합성 테스트에만 `--approve-for-me` 자동 승인 검토를 사용했다. 거절을 피하려 도구를 읽기 전용으로 위장하거나 전역 승인을 낮추지 않았다.

호스트의 첫 프롬프트가 list→describe→propose를 실제 호출해600/두 블록과 제안/버전을 반환했다. 검증기가 결과를 대조한 뒤 별도 저장 프롬프트로 사용자 요청 범위의 비공개 테스트 저장을 실행했다. save→get으로 새 dashboard2/Studio URL/600/두 블록을 반환했다. 이는 테스트 하네스의 검토/승인 입력이며 고객/사람의 업무 수용 승인은 아니다. `verify-codex-host.js`로 재현할 수 있다.

### 실제 UI·모바일·설정 도우미

Ego130에서 합성 소유자로 로그인해 Codex가 반환한 dashboard2 Studio 링크를 열고 새로고침했다. 소스mcp-sales/정의2/숫자600 USD/날짜별100·200·300을 확인했다. 390/768/1440px의 안정된 innerWidth에서 문서 가로 넘침0, 저장/게시 컨트롤36px이었다. 차트는 실제 캡처에서 직접 확인했다(특정 Recharts CSS 선택기의0건을 차트 부재로 해석하지 않았다). 새 공개 캡처29/30은 이 실행의 합성 자료만 담았다.

대화형 로그인 도우미는 표준 PTY에서 실제 합성 계정 로그인을 실행했다. 비밀번호/토큰 출력0·파일 권한0600을 확인했다. 별도 리뷰에서 환경 파일의 이스케이프된 줄바꿈과 지표 투영의 분모/배율/가중치 누락을 발견했다. 실제 줄바꿈 serializer/Node parseEnv3항목 회귀와 의미 필드 투영/비율·가중 평균 회귀로 수정했다. 최종 PTY가 만든 파일을 `node --env-file`로 읽은 새 stdio 프로세스에서 실제 인증된 소스 조회까지 통과했다. 파일 존재/권한 확인만으로 연결 성공으로 간주했던 초기 점검을 보완했다. 별도 code-reviewer의 두 수정 재검토는 남은 지적0/수정 범위 승인으로 끝났다. 리뷰어의 Node22 검사와 Main의 Node24/실제 연결 증거는 구분한다. 최초 macOS `script`를 pipe에 연결한 하네스는TTY 부재로 실패했으며 실제PTY로 바꿨다. 도우미의 인증을 우회하거나 토큰을 공개하지 않았다.

## 문서·게이트

UC056/TC056의 scoped strict/no-baseline lint는 각각 오류0/경고0/정보0이었다. 초기 작성 형식의 대체 흐름 누락은 수정했다. 기존 전체 기업 명세/수용을 이번 scoped lint로 대체하지 않는다. FR029는Open, UC/TC는Draft다.

사용자 가이드·README·AGENTS의 현재 MCP 미제공 안내를 이번 stdio 범위와 검증 상태로 갱신했다. 이전 `agent-authoring-guide`의 미구현 판정은 당시 기준이며 이 실행으로 supersede한다. 문서 루트와 `/guide/` 하위 경로 빌드는 각각26개 HTML/1287개 참조 오류0이었다. Ego130의 최종 문서390/768/1440px에서 가로 넘침0·강조 문법 노출0, 모바일 접기 영역과 신규 이미지2개 로딩을 확인했다. 자동 배포는 최종 push SHA에 대응하는 결과로 별도 전달한다.

`aiwf-spec check --root .`는 drift로 종료1이었다. 이번 UC056/TC056/계획/요구사항·다이어그램 변경뿐 아니라 이전 가이드·통합 등 여러 기존 변경도 포함했다. 새 범위는 위 scoped lint로 검사했고, 관련 없는 문서까지 검토한 것처럼 전체 pin을 refresh하지 않았다. digest 상태를 승인으로 취급하지 않는다.

## 한계

실제 호스트는Codex만 검증했고 Claude Code는 공식 등록 형식 안내만 제공한다. 원격HTTP/OAuth/게시·공유/저장본 수정 도구/인증 자동 갱신/모든 역할·대용량 운영/실휴대폰·고객 수용은 미실행 또는 범위 밖이다. 모델에 confirmSave=true를 받는 것은 실제 사람 승인 증명이 아니며 호스트가 동의를 받아야 한다. 저장 후 응답 유실·취소의 결과는 정확 요청으로 확인해야 한다.

## 정리

작업 전용 supervisor 종료200, ownedContainerRemoved/temporaryCredentialsRemoved=true·persistentVolumesCreated=0을 확인했다. 별도로 생성한 개인 계정 JSON과 환경 파일4개도 제거했다. 사용자 기존 서버·전역 MCP 설정·로그인은 그대로 유지했다.
