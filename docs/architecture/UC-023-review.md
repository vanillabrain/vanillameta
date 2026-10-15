# UC023·TC005 별도 리뷰 패스 — 2026-10-16

Main 구현/문서 작성 후 별도 패스로 소스·실행 로그·UC023 BR01/02·TC005 단계를 대조했다. 별도 native executor는 제공자400으로 실행되지 않았으므로 독립 리뷰라고 주장하지 않는다.

- 권한은 profile/catalog 조회와 compile에서 LLM 전후 재확인한다. question은 쓰기 없이 의도를 반환하고 save 원자 저장에서 다시 검증한다. digest와 requestId는 후속 save-only 동안 유지한다.
- 새 저장 revision은 실제 저장 결과에서 오며 receipt replay에는 과거 revision을 만들어 붙이지 않는다. 새 게시 화면은 현재본 수동 preview가 필요하다. 부정/모호·소스 변경·취소/늦은 응답은 save 경로로 이동하지 않는 회귀가 있다.
- 실 화면에서 확인한 생성 후속400, 준비/공개 의도 누락, 목록 refetch 로딩 막 잔존을 각각 보완했다. 최초 실패와 수정 후 증빙을 구분했다. 로딩 효과의 정리 함수는 목록이 fetch 중 unmount될 때 해당 막을 해제한다.
- 원본27·복사본29 ID/배치/소스 권한, 전체 데이터 수치·OS28, 게시 snapshot/재게시/revoke, 동일 요청503 재시도를 비교했다. 공개는 사용자 버튼 뒤에만 실행된다.
- 지표/Dimension/Block/Publication 책임이나 영수증 schema 변경은 없다. glossary/entity_model에는 새 영속 엔티티가 없어 수정하지 않았다. requirements의 기존 In Progress와 Draft UC 조합은 strict lint의 status drift 경고이며 사람 승인으로 덮지 않았다.

잔여: 실휴대폰·운영MySQL·모든 자연어/경합·기존 거절된 타 계정 변경POST 실제 실행은 미검증이다. strict lint 기존12오류는 보존하고 pin/packet을 승인으로 해석하지 않는다. 상세 증빙은 [전체 여정](../testing/dashboard-lifecycle.md)을 따른다.
