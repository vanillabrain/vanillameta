# UC030 갱신 중단 복구 설계

Status: Draft. [UC030](../use_cases/UC-030-retry-token-renewal.md).

현재 apiHelper는 실제 refresh 시작 뒤 모든 실패에 removeToken을 호출한다. removeToken은 보관 초안과 공유 인증 scope까지 정리하므로503 같은 일시 장애도 복구를 끊는다. catch에서401/403만 인증 거절로 분류하고 기존 unchanged 검사와 함께 로그아웃한다. 그 외 오류는 원 요청에 전달하고 refreshPromise/finally·브라우저 잠금 해제는 유지한다. 자동 retry/backoff·서버/DB·새 UI/의존성은 없다.

같은 세대 승자 토큰 재사용과 새 로그인 세대 검사는 UC029 그대로다. 대기 탭은 보유 탭 종료 후 새 잠금 callback에서 이를 검사한다. [Web Locks 표준](https://www.w3.org/TR/web-locks/)의 브라우저 소유 해제를 사용하고 응답 유실된 갱신의 서버 rollback은 보장하지 않는다.

영구 entity/저장소 모델·UI 토큰은 바꾸지 않는다. 일시 실패 뒤 인증/세대/초안/질문과 UI 오류 상태·reload 복구, 보유 탭 종료→대기 탭 재요청을 Ego에서 검증한다. 명확한401/403 정리와 새 로그인 보호는 단위에서 검증한다. 실제 휴대폰·모든 장애 조합·운영 수용은 범위 밖이다.
