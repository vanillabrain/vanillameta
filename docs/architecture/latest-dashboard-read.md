# Latest saved dashboard read recovery

Status: Draft. [UC039](../use_cases/UC-039-latest-dashboard-read.md).

StudioEditor의 route load에 증가하는 요청 세대를 둔다. load 시작·effect cleanup에서 이전 응답을 무효화한다. await 성공/오류가 현재 세대일 때만 result/status/error를 바꾼다. Workspace 렌더에도 document.dashboardId와 현재 route id의 일치 검사를 추가해 effect 시작 전 새 경로/옛 문서가 한 프레임 결합되는 것을 막는다. unmount 뒤 결과를 적용하지 않는다. AbortController/네트워크 취소를 새로 추가하지 않는다.

기존 StudioStateScreen의 로딩·오류·다시 시도와 fetchStudioDashboard의 오류 분류를 유지한다. 접근 거절은 편집·게시 UI를 만들지 않는다. UC038의 이전 탭은 자동 변경하지 않으며, 최신 조회가 성공한 새 화면에서 기존 수치/차트와 명시 게시를 재사용한다. 설정/크기 토큰/엔티티·의존성·서버 API 변화는 없다.
