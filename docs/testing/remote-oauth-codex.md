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
| CODOAUTH-01 | 실제 codex mcp login이 VM 승인 화면을 열고 등록된 client·조직·권한을 확인한다. | NOT_RUN |
| CODOAUTH-02 | gpt-6-luna가 vm_list_documents와 vm_read_document를 실제 호출한다. 프롬프트에 정답을 주지 않고 합성 문서의 기준일·금액을 맞춘다. | NOT_RUN |
| CODOAUTH-03 | VM의 명시 연결 해제 뒤 새 Codex 세션은 동일 연결로 문서를 조회하지 못한다. 기존 답변이나 캐시를 새 조회 성공으로 세지 않는다. | NOT_RUN |
| CODOAUTH-04 | 실행별 설정과 이번 MCP 인증만 정리한다. 전역 모델·다른 MCP·OpenAI 로그인은 보존한다. | NOT_RUN |

## 경계

현재 설치된 Codex는0.154.0이다. 모델은 gpt-6-luna를 유지한다. Google OAuth 설정과 관계없이 서버에 합성 보관 사본을 준비한다. 개인 Google 문서를 사용하지 않는다. 모바일 설계와 VoiceOver 차단 상태는 유지한다. SDK 결과로 실제 Codex 검증을 대체하지 않는다.

처리량 점검은 기존68개 BE/선택47개 FE와 빌드 증빙 재사용, 실제 호스트에서 새로 생긴 조건만 확인하는 방식이다. 연결 문제를 고치면 해당 호환성 검사와 관련 빌드만 추가한다.
