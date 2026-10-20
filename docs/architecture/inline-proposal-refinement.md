# Inline proposal refinement

Status: Draft. [UC035](../use_cases/UC-035-inline-proposal-refinement.md).

기존 creation/clarify 요청을 세 가지 상호 배타적 입력으로 확장한다: 분모 답변, 새 소스 답변, 생성안 수정 질문+대상. 공통 requestId/proposalId/expectedSourceRevision과 소유권·진행 Map·마지막 receipt·CAS를 재사용한다. 수정 질문은2000자 이하, 대상은0~5 또는 append다. 서버 캐시의 완성된 부모만 기존 creation.propose의 parentProposalId/targetBlockIndex로 수정한다. 완료 미리보기와 같은 소스/기준·부모를 확인한 뒤 바인딩을 교체한다. 열 누락/분모 재질문/변경 없음은400으로 이전 바인딩을 유지한다. 사용자는 질문을 구체화해 재시도한다. 분모 질문 응답 UI를 별도 중첩하지 않는다.

카드의 수정 영역은 기본 접힘이다. 기존 TextField/Button/Notice,36px 입력/주요 버튼·14px 본문·모바일 입력16px를 재사용한다. 대상/질문/한 번의 미리보기 버튼만 제공한다. 오류는 입력·이전 미리보기를 보존한다. 불명확 응답은 동일 requestId/본문 재확인만 허용하고 저장도 잠근다. 같은 대화 acting과 abort를 공유한다. 최신 실행의 생성안 GET 실패는 기존 읽기 재시도를 사용하며 자동 모델/저장 호출은 없다.

기존 StudioCreate의 독립 생성안 수정 UI/생성기·entity/요구사항/용어집은 유지한다. 새 엔티티/전역 스타일/의존성/업로드/게시 기능은 추가하지 않는다. 캐시10분·단일 서버 진행 단일화와 미완료 제안 재시작 제한은 기존과 같다.
