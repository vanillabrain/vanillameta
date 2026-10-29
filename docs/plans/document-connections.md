# 문서 연결과 버전 보관 실행 계획

2026-10-29. 사용자가 아침 보고의 후속 우선순위 실행을 승인했다. 현재 develop의 미커밋 아티팩트 목록 변경을 보존한다.

## 실행 순서

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [ ] Phase C: Run the loop
- [ ] Phase D: Keep the audit trail
- [ ] Phase E: Verify and hand back

첫 구현 단위의 상태는 [검증 기록](../testing/document-connections.md)을 따른다. 문서 연결·원문 사본·버전 저장·복구 코드와 선택된 실제 DB/UI 검증은 완료했다. Google 실계정 승인, 외부 AI 원격 OAuth, 네이티브 버전 선택 방향키 조건은 열려 있다. 전체 계획을 완료로 표시하지 않는다.

## 우선순위와 완료 조건

1. Google 문서를 연결하고 원문 Markdown 사본을 버전으로 보관한다. 원본 수정 후 명시 갱신으로 새 버전이 생기며 이전 버전은 보존된다. 다른 사용자는 읽거나 갱신할 수 없다. 실패하면 마지막 성공 버전을 보존한다.
2. 외부 AI 연결은 기존 로컬 stdio MCP와 구분한다. 원격 OAuth의 조직 및 도구 승인 경계를 설계하고 구현 가능 범위와 실제 클라이언트 검증을 구분한다.
3. 새 흐름의 Tab 순서, 대화상자 초점, 취소 후 초점 복귀를 실제 데스크톱 브라우저에서 검증한다. 모바일 설계와 기존 VoiceOver 차단 상태는 변경하지 않는다.

## 데이터 형태

외부 문서 연결은 원본의 provider/file ID와 소유자 문맥이다. 보관 버전은 원본 version과 Markdown bytes/hash를 고정한다. 조회 시 자동 갱신이나 유료 AI 요약을 실행하지 않는다. OAuth 연결과 외부 AI 도구 승인은 서로 다른 권한이다.

## 검증과 처리량 점검

공급자 API 확인과 현재 코드 조사 뒤 인터페이스를 확정한다. 각 단위는 관련 서비스 검사와 타입 검사 후 다음 단위로 진행한다. 실제 Google 계정 승인이 없는 모의 API 결과를 실제 연동 완료로 표시하지 않는다. 기존 통과 케이스는 관련 변경이 없는 한 재실행하지 않는다. 브라우저는 한 소유 검증 환경에서 실행하고 정확한 증빙 경로를 기록한다.

원격 Google OAuth 설정 또는 사용자 승인처럼 외부 입력이 필요한 경우 독립적인 구현과 검증을 계속하고 해당 실연동 조건만 BLOCKED로 남긴다. gpt-6-luna 설정을 유지한다.

## 선택한 구조

두 독립 설계 검토는 전용 문서 연결과 불변 버전 저장을 권했다. 기존 Studio 문서와 SQL 소스를 확장하는 안은 서로 다른 권한·보관 의미가 섞여 제외했다. 현재 기능은 소유자와 고정 조직 문맥에서만 접근한다. 관리자가 다른 직원의 원문을 자동으로 읽지 못한다.

연결, OAuth 시도, 불변 버전, 갱신 요청 기록을 별도로 저장한다. 본문은 최대 2 MiB이고, SQLite와 MySQL TEXT의 크기 차이를 피하도록 Unicode 문자 기준 청크로 나눈다. 본문 청크와 버전·현재 포인터·영수증을 같은 transaction에 저장한다. 원문 내 외부 이미지와 HTML은 실행하거나 가져오지 않는다.

저장된 사본은 원문과 독립된 비공개 자료다. 연결 해제는 Google 자격증명 사용을 중단하며 보관 사본을 삭제하지 않는다. 현재 VM 계정·조직 접근 검사는 계속 적용한다. 자동 요약·공개 공유·문서 편집은 이 단위에 포함하지 않는다.

Google Picker redirect의 `drive.file` 범위와 `trigger_onepick`를 사용한다. 전체 Drive 읽기 권한을 요청하지 않는다. Google의 선택 파일 범위는 편집 권한을 포함할 수 있지만 VM은 고정 파일 ID에 대한 조회·내보내기만 호출한다. 승인 화면과 안내에서 이를 숨기지 않는다. OAuth PKCE/state와 원래 actor epoch를 고정한다. Google 토큰은 브라우저에 반환하지 않는다.

Google 내보내기 전후 메타데이터 일치는 관측된 변경이 없다는 뜻이다. Google 서버의 transaction snapshot 또는 특정 revision의 원자 내보내기를 보증하지 않는다. 실제 보관 bytes와 SHA-256은 고정한다.

사용자가 2026-10-29 기존 Google OAuth 설정이 없다고 확인했다. 실제 계정 승인 검증은 BLOCKED다. 선택 문서 접근과 토큰 교환의 네트워크 모의 검증, 실제 DB 저장 및 UI 검증은 별도로 진행한다.

## 외부 근거

- [Google Picker redirect와 선택 파일 범위](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker).
- [Google Workspace 내보내기 형식](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).
- [Google 웹 서버 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

## 다음 외부 AI OAuth 단위

현재 로컬 MCP는 `@modelcontextprotocol/server`2.3.1과 사용자 JWT로 기존 API를 호출한다. 원격 연결은 별도 MCP용 audience·조직·도구 승인·회수와 현재 사용자 권한을 검사해야 한다. Google 문서 연결 토큰을 VM 로그인이나 외부 AI 승인에 재사용하지 않는다.

SDK2.3.1의 보호 리소스 metadata·bearer 검증은 유지되지만 Authorization Server 도우미는 deprecated legacy 패키지로 분리돼 있다. 다음 단위는 유지되는 OAuth 라이브러리와 VM 로그인·조직 동의를 연결하는 구조를 먼저 확정한다. 기존 JWT를 그대로 외부 AI에 전달하는 임시 구현으로 대체하지 않는다. 이번에는 원격 OAuth 서버나 외부 AI 클라이언트 연결을 구현·검증하지 않았다.

근거는 [SDK2.3.1 인증 안내](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/docs/serving/authorization.md)와 [v2 전환 안내](https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.3.1/docs/migration/upgrade-to-v2.md)다.
