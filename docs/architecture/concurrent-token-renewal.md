# UC029 다중 탭 동시 토큰 갱신 설계

P3/P4·Draft. UC028은 다른 탭 갱신 후 초안을 찾지만 동시에 시작한 refresh의 후발 응답은 요청 거절로 끝날 수 있다. 기존 API interceptor에 원 요청 세대와 전송 토큰을 사용하고 Web Locks로 같은 origin refresh를 직렬화한다. 서버/DB/의존성 변경은 없다.

잠금 안에서 현재 세대를 확인하고 이미 같은 세대의 새 토큰이 있으면 재사용한다. 그렇지 않으면 기존 서버 refresh→UC028 scope 승계→토큰 저장을 실행한다. 성공/실패/재요청 전 세대 검사를 유지한다. 인증 헤더 설정 시 세대를 기록하므로 새 로그인 뒤 도착한 옛401도 구분한다. 잠금 대기10초 만료·잠금 호출 실패는 인증을 지우지 않는다. 미지원은 기존 탭 내부 동작이며 전역1회 보장은 하지 않는다.

[W3C Web Locks](https://www.w3.org/TR/web-locks/)의 같은 origin 배타 잠금과 callback 종료 후 release를 사용한다. 브라우저 secure context에서 실제 지원을 확인하고 새 범용 조정 프레임워크/잠금 저장소를 만들지 않는다.

검증은 독립 axios 모듈2개+공유 가짜 lock queue로 refresh1회·새 세대 거절·늦은401·잠금 실패/10초·기존 미지원/갱신 실패 회귀를 수행한다. Ego69 실제 Web Locks 두 탭에서 첫 refresh 응답을 프록시로 잠시 보류하고 두 원 preview POST에401을1회씩 반환한다. 그동안 첫탭held/둘째pending을 확인한 뒤 정상 refresh201을 전달해 양쪽 원 preview201·refresh1회를 검증한다. 양쪽 초안/질문 reload 복구와 한 탭의preview/save/publish/reload·모바일 정렬을 확인하고 링크 중지/정상 프록시 복원으로 종료한다.
