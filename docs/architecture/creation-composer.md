# Creation composer continuation

Status: Draft. [UC036](../use_cases/UC-036-creation-composer.md).

POST runs/:id/creation/message는 requestId/proposalId/expectedSourceRevision/prompt만 허용한다. 소유권 확인 뒤 완료 raw message hash 재확인, 명시 저장 단독 문구, 부모 캐시 기반 대상 식별 순서다. 식별은 제한된 번호·유일한 제목·append이며 새로운 LLM 분류기/SQL 생성기를 만들지 않는다. 수정은 UC035 clarify에 위임하고 messageHash를 같은 영속 receipt 쓰기에 포함한다. 모호한 대상·금지/혼합/게시·원본 요청은 이전 결과를 유지한다. 저장은 기존 saveCreation의 원자 생성/영수증을 사용한다.

FE는 최근 성공한 미저장 생성안을 입력창 대상으로 표시한다. 수정·저장 질문은 원본 transport가 아닌 새 endpoint로 보내고 같은 useChat 메시지 목록에 질문/결과를 추가한다. onApply/onSaved로 원본 문서를 교체하지 않는다. 응답 불명확은 같은 envelope를 보관하고 입력/대상/카드 작업을 잠근다. 정상 실패는 입력을 유지하고 구체화 가능하다. 성공한 최신 run만 갱신하고 명시 저장 완료 후 원본 대상으로 돌아간다. 원본 복귀 버튼은 자동 전송하지 않는다.

입력창 대상 안내/소형 복귀 버튼은 기존 토큰32px/14px와 줄바꿈을 사용한다. 신규 전체 모드 선택을 선행 단계로 요구하지 않는다. 캐시 만료/빈 미리보기는 기존 카드 복구로 안내한다. raw 질문은 브라우저 메모리 대화에만 표시하고 영속 history 복구는 추가하지 않는다. 엔티티/요구사항/용어집·전역 스타일·의존성은 변경하지 않는다.

최종 CAS에서는 생성 journal도 같은 쓰기 큐 안에서 조회한다. 저장 commit 뒤 실행의 receipt 복구 전 도착한 수정도 원래 바인딩을 바꾸지 못한다.
