# Publication conflict handoff

Status: Draft. [UC038](../use_cases/UC-038-publication-conflict.md).

StudioPublish가 HTTP409를 받으면 pending receipt를 기존처럼 종료하고 conflict 상태를 표시한다. 게시 handler와 버튼을 잠근다. 같은 props로 닫고 열어도 잠금은 유지하며 dashboardId/revision이 바뀌면 해제한다. 게시 상태 GET나 네트워크 재시도는 저장 버전을 갱신하는 근거가 아니다.

충돌 안내에는 해당 게시 대상의 최신 /dashboard/:id/studio 링크를 기존 outline 버튼으로 제공한다. 새 탭에서 기존 Studio의 소유권 조회·저장본 미리보기를 수행하고, 그 화면의 저장 revision으로 명시 게시한다. UC037의 원본39에서 생성45를 게시한 경우 링크도45를 가리킨다. 이전 편집 문서/onApply/onSaved·source/metric 정의를 교체하지 않는다. 새 API/엔티티/범용 병합/집계 renderer는 추가하지 않는다.

새 화면이 계속 바뀌면 서버 CAS가 다시409로 막는다. 조회 실패는 기존 Studio 오류·재시도 화면을 그대로 사용한다. 게시 응답 유실의 동일 envelope 재시도는 기존 동작이다. 임의 외부 URL이나 자동 새로고침/공개는 없다. 보조 링크36px/14px·문구 줄바꿈·모바일 overflow를 기존 UI Kit 기준으로 확인한다.
