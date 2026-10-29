# 외부 AI 원격 OAuth 연결

2026-10-29. Google 문서 연결은 `453bbe63`으로 develop에 반영했다. 이번 단위는 외부 AI가 VM에 접속하는 방향이다.

## 완료 조건

- 등록한 AI 클라이언트가 PKCE를 사용해 브라우저 승인으로 연결한다.
- 사용자는 현재 조직과 소스 설명·보관 문서 읽기의 요청 범위를 검토하고 승인하거나 취소한다.
- 취소하면 토큰을 발급하지 않는다. 연결 해제·계정 비활성·epoch·조직 변경은 기존 토큰의 후속 사용을 차단한다.
- 실제 MCP HTTP 호출은 승인 범위와 기존 소스·대시보드 접근권을 동시에 검사한다. VM 로그인 JWT를 외부 AI에 반환하지 않는다.
- 승인·취소·연결 관리 화면을 실제 데스크톱에서 검증하고 MD 증빙을 남긴다. 모바일과 VoiceOver 차단 상태는 유지한다.

## 실행 순서

- [x] 현재 stdio MCP와 권한 경계를 조사한다.
- [x] OAuth 라이브러리·영속 승인·토큰 모델을 구현한다.
- [x] 조직·권한 승인과 연결 관리 화면을 구현한다.
- [x] 공식 MCP HTTP transport와 기존 업무 서비스를 연결한다.
- [x] PKCE·권한·회수 API 및 실제 UI의 선택 조건을 검증한다.
- [x] 독립 검토와 장애 수정, 증빙·설정 문서를 마무리한다.

## 선택과 제한

단일 API 인스턴스에 유지보수 중인 OAuth 라이브러리를 포함한다. 전체 OIDC 로그인 서버 도입보다 기존 VM 로그인을 승인 화면에서 재사용하는 작은 OAuth 서버를 우선한다. OAuth client는 운영자 allowlist에 정확한 redirect URI와 이름으로 등록한다. 익명 동적 client 등록과 임의 callback URL은 허용하지 않는다.

명시한 서버 base URL에서 issuer·resource URI를 생성한다. authorization code와 access token은 고엔트로피 opaque 값이며 DB에는 hash만 보관한다. code는 단회 사용이고 access token은 짧게 만료된다. refresh token은 첫 단위에서 발급하지 않는다. 취소와 연결 해제는 원본 문서·분석·Google 연결을 변경하지 않는다.

`Model the Domain` 원칙으로 승인 요청·연결 grant·코드·토큰을 분리한다. `Boundary Discipline` 원칙으로 OAuth 토큰을 일반 API JWT 인증과 섞지 않는다. `Make Operations Idempotent` 원칙으로 재시도·중복 승인·회수 후 재호출의 결과를 검증한다.

현재 gpt-6-luna 설정을 유지한다. 프로토콜 클라이언트 검증과 실제 외부 AI 제품의 계정·네트워크 연결은 구분한다. Google OAuth 미설정은 별도 상태이며 이번 VM 자체 OAuth와 무관하다.

첫 원격 연결은 `sources:read`, `documents:read`의 읽기 도구만 제공한다. 실제 AI 생성과 비공개 저장은 승인 grant가 실행·commit 중 회수되는 조건까지 기존 Studio 쓰기에 연결해야 하므로 이번 연결 단위의 권한으로 제공하지 않는다. 사용자는 승인 화면에서 두 읽기 범위를 줄일 수 있다. 개별 문서/소스는 원래 VM 권한과 고정 조직을 다시 확인한다. 연결만으로 모델을 호출하거나 비용을 발생시키지 않는다.

## 구현과 인계

OAuth 라이브러리는5.3.1, MCP server는2.3.1, Node transport는 npm에 배포된2.1.2다. 기존 backend Zod3를 유지하며 SDK에 필요한 Zod4.6.7만 별칭으로 분리했다. HTTP에 일반 VM JWT를 전달하는 어댑터는 만들지 않았다.

[검증 결과](../testing/remote-ai-oauth.md)와 [운영 설정](../operations/remote-ai-oauth.md)을 따른다. 구현은acb4c543으로 develop에 push했다. [실제 Codex 검증](../testing/remote-oauth-codex.md)에서 CLI0.154.0의 callback 설정과 문서 조회·회수를 확인했다. 다른 외부 AI 제품, 공개 HTTPS 환경, refresh token, 원격 쓰기 권한은 후속이다.
