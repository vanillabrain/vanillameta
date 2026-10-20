# UC030 범위 리뷰

Status: Draft. Main의 작성 후 별도 명세 대조 패스이며 독립 리뷰/사람 승인이 아니다.

기존 인증 거절 로그아웃 계약은401/403으로 한정하고 새 로그인/승자 토큰 경계를 유지한다. transient 실패를 성공으로 처리하지 않고 초안을 보존한 채 요청 실패를 전달한다. refreshPromise와 Web Locks의 finally 경로로 재시도 가능성을 유지한다. 탭 종료는 브라우저 소유 잠금 인계만 검증하고 닫힌 탭 본문 복원이나 서버 rollback을 약속하지 않는다. 서버/영구 모델 변경은 없다. 실제 실행 결과는 [증빙](../testing/retry-token-renewal.md)을 따른다.
