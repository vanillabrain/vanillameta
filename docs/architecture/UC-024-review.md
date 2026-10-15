# UC024 별도 리뷰 패스

2026-10-16, e98aacc8 기반 변경을 Main 구현 후 별도 패스로 읽었다. 독립 리뷰어나 사람 승인을 뜻하지 않는다.

- UC005 A4/BR005와 UC024 BR01/02를 대조했다. 필수 열이 없는 블록을 자동 제외하지 않고 기본 전체/명시 subset만 허용한다. unknown·duplicate·empty ID는 서버 검증하며 요청 순서와 무관하게 원본 순서를 유지한다.
- 소유/공유/게시 경로 모두 기존 original 권한/허용 검사를 먼저 거친다. 수신자 metadata는 id/title/필요 열뿐이며 SQL·원본 sourceId·원본 결과가 추가되지 않는다. 익명 availability 계약은 변하지 않는다.
- 선택 widgets와 legacy layoutSizes를 같은 인덱스로 줄이고, 선택한 원본 모든 폭 좌표를 새 ID에 순서대로 대응한다. 저장은 기존 ticket actor·origin/source revision·receipt transaction 검증을 유지한다.
- UI는 필요한 열만 전송하고 선택 변경은 preview/attempt를 무효화한다. 결과 불명확 저장의 fieldset lock은 새 선택에도 적용된다. 접힘·미연결 경고·선택 개수·포함/제외 결과를 실제 캡처에서 확인했다.
- 실제400 layoutSizes 오류와 보완 후201, 수신자 source30의33 저장/reload·원본 동일·최종 링크404를 대조했다. 계산/지표/소스 권한을 추정해 복구하지 않는다.

신규 영속 엔티티가 없어 entity_model/glossary 변경은 없다. 운영DB·물리기기·모든 경합은 검증하지 않았다. strict lint 기존12오류를 숨기거나 UC를 Approved로 승격하지 않는다. [실행 범위](../testing/reuse-block-selection.md)를 승인/운영 배포와 구분한다.
