# 실제 Codex 원격 OAuth 검증

2026-10-29. 원격 OAuth SDK 검증 이후 실제 Codex CLI를 사용하는 후속이다. 기존 통과 조건은 [이전 검증](remote-ai-oauth.md)을 재사용한다.

## 실행 순서

1. 원격 OAuth 코드와 증빙만 develop에 drumcap으로 커밋·push한다.
2. 설치된 Codex CLI의 client ID·callback·resource 옵션을 확인한다.
3. 별도 소유 런타임과 합성 문서, 실행별 MCP 설정으로 연결한다.
4. 실제 gpt-6-luna가 MCP로 원문을 읽는지 호출 기록과 독립 정답을 대조한다.
5. VM 화면에서 연결을 해제하고 새 Codex 요청이 거절되는지 확인한다.
6. 오류 수정과 재검사, 캡처·정리를 기록한다.

## MD 조건

| ID | 기대 결과 | 상태 |
|---|---|---|
| CODOAUTH-01 | 실제 codex mcp login이 VM 승인 화면을 열고 등록된 client·조직·권한을 확인한다. | PASS |
| CODOAUTH-02 | gpt-6-luna가 vm_list_documents와 vm_read_document를 실제 호출한다. 프롬프트에 정답을 주지 않고 합성 문서의 기준일·금액을 맞춘다. | PASS |
| CODOAUTH-03 | VM의 명시 연결 해제 뒤 새 Codex 세션은 동일 연결로 문서를 조회하지 못한다. 기존 답변이나 캐시를 새 조회 성공으로 세지 않는다. | PASS |
| CODOAUTH-04 | 실행별 설정과 이번 MCP 인증만 정리한다. 전역 모델·다른 MCP·OpenAI 로그인은 보존한다. | PASS |

## 경계

현재 설치된 Codex는0.154.0이다. 모델은 gpt-6-luna를 유지한다. Google OAuth 설정과 관계없이 서버에 합성 보관 사본을 준비한다. 개인 Google 문서를 사용하지 않는다. 모바일 설계와 VoiceOver 차단 상태는 유지한다. SDK 결과로 실제 Codex 검증을 대체하지 않는다.

처리량 점검은 기존68개 BE/선택47개 FE와 빌드 증빙 재사용, 실제 호스트에서 새로 생긴 조건만 확인하는 방식이다. 연결 문제를 고치면 해당 호환성 검사와 관련 빌드만 추가한다.

## 커밋과 환경

원격 OAuth 구현과 이전 검증 기록을 `acb4c543`으로 develop에 커밋하고 drumcap으로 push했다. 무관한 아티팩트 목록 디자인과 Claude 설정 변경은 포함하지 않았다. 선별한 staged 소스를 별도 디렉터리에서 타입 검사해 기존 미커밋 화면 변경에 의존하지 않음을 확인했다.

실행은 별도 소유 MySQL8.4.11/API4266/WEB3266/CONTROL4466과 Ego93을 사용했다. Codex CLI0.154.0은 기존 로그인과 gpt-6-luna, 기존10100 proxy/catalog 연결을 실행별 인자로 사용했다. 전역 모델이나 MCP 설정 파일을 수정하지 않았다. override 없는 `codex mcp get vanillameta_qa_20261029`는 등록 항목이 없음을 반환했다.

## 초기 오류와 재검증

첫 Codex 승인 URL은 callback의 서버별 식별자와 `resource` 중복을 포함했다. VM에서 invalid_request를 재현했다. 이 요청은 승인되지 않았고 grant를 만들지 않았다. client allowlist와 `oauth.callback_url`을 실제 생성된 전체 주소로 맞추고, 자동 탐색되는 `resource`의 명시 중복 옵션을 제거했다. 서버의 exact redirect·단일 resource 검증은 그대로다.

두 번째 `codex mcp login`은 실제 VM 승인 후 성공했다. Codex가 직접 연 loopback4467 callback에서 Authentication complete를 확인했다. callback과 code 교환은 합성 SDK 클라이언트로 대체하지 않았다. API 조회에서도 `codex-cli-qa`의 documents:read grant1개를 확인했다.

## 실제 조회와 회수

합성 문서의 순매출과 검증코드는 준비 시 별도로 생성했다. Codex에는 제목과 조회 절차만 주고 문서ID·정답·토큰·비밀번호는 주지 않았다. 실제 JSONL에 vm_list_documents와 vm_read_document의 성공 호출2개가 기록됐다. 요청 버전1, 원문 hash와 최종 답변의 기준일2026-10-28·금액11,003.54 KRW·임의 검증코드를 독립 정답과 대조했다. 셸·파일·웹 호출로 대신한 이벤트는 없었다.

VM 화면에서 연결을 명시 해제했다. DB에서는 grant.revoked=1이며 token은 아직 만료 전이었다. 클라이언트 인증을 지우기 전에 같은 설정의 새 `codex exec`를 실행했다. 실제 MCP initialize가401/Auth required로 거절되고 required 서버 초기화 실패로 exit1이었다. 새로운 문서 조회나 문서 내용을 반환하지 않았다. 이후 MCP logout으로 이번 인증만 제거했다. VM의 일반 보호 GET은200이며 버전1·원문을 보존했다.

기존10100 proxy의 WebSocket426 뒤 HTTP 전환 경고와 스킬 설명 축약 알림은 있었으나 조회 호출과 답변은 성공했다. 모델 대체는 하지 않았다. gpt-6-luna는 요청 모델이며 제공자 내부 라우팅을 별도로 attestation한 것은 아니다.

## 증빙과 범위

증빙 디렉터리는 `/Users/moonklabs/workspace-vanilla/phase2-evidence/remote-oauth-codex-20261029`다. `read-events.jsonl`·`read-verified.json`은 실제 호출·정답 대조, `after-revoke-stderr.log`·`after-revoke-verified.json`·`mcp-http-statuses.json`은 회수 후 차단을 기록한다. 대표 캡처는 `codex-consent.png`, `codex-authorized.png`, `document-v1.png`, `codex-disconnected.png`다.

이번에는 제품 코드 변경이 필요하지 않았다. 호스트 설정과 운영 안내를 보완했고 기존 제품 단위 검사를 반복하지 않았다. 실제 Codex CLI의 로컬 HTTP 연결만 검증했다. Codex 데스크톱 전역 플러그인 설치, 공개 HTTPS/nginx, Claude·ChatGPT 호스트, refresh token, 모바일·VoiceOver는 이 결과로 완료 처리하지 않는다.

## 독립 검토와 정리

독립 GPT-6 Astra 검토는 실제 호스트 호출과 회수 후 거절을 확인했고, 비밀 없는 정답·검증기 보존과 기한·logout 증빙 보강을 요청했다. `expected.json`과 `verify-read.cjs`를 보존하고 재실행했다. `token-lifecycle.json`은 같은 grant의 만료06:03:09Z와 실제 Codex 거절05:58:26Z를 대조한다. `logout-confirmation.json`은 이후 이번 MCP 인증이 없음을 기록한다. 토큰 원문과 비밀번호는 포함하지 않는다.

Ego93을 종료했다. 소유 runtime4466은 정상 stop200, status=stopped, 소유 컨테이너0, runRoot 제거를 확인했다. 검증 로그인 임시 파일과 Codex 임시 작업 폴더도 제거했다. 기존22e26a 보존 환경과 전역 로그인·모델은 유지했다. viewport1800×849의 최종 연결 관리 화면에서 가로 넘침0을 확인했다.
