# Inline source recovery

Status: Draft. [UC034](../use_cases/UC-034-inline-source-recovery.md).

UC033 creation/clarify에 상호 배타적인 targetSourceId 답변을 추가한다. 원본 proposalId/expectedSourceRevision/requestId는 동일하다. sourceId는 서버가 양의 정수로 검증하고 기존 생성기의 접근권한·DuckDB snapshot·컴파일 검사를 통과해야 한다. 새 소스의 계산 버전은 생성기가 결정하며 완료 직전에 원 실행의 이전 바인딩을 CAS한다. 기존 refundDenominator 답변과 진행 Map/완료 receipt를 공유해 소스 변경과 분모 답변·저장이 경합하지 않는다.

생성 캐시에 requestAnswers(분모 값만)를 보관해 분모 답변 뒤 필수 열 누락→소스 변경에도 보존한다. 영속 실행 JSON에는 새 소스/제안 바인딩과 요청 hash만 남긴다. 질문·SQL·결과·답변 원문을 추가 저장하지 않는다. 저장 requestId는 기존 실행의 단일 생성 영수증을 재사용한다.

FE는 missingColumns일 때만 기존 권한별 소스 목록 API를 읽는다. TextField/Button/Notice의36px 토큰과 간격을 재사용한다. 목록 실패는 읽기 재시도, 계산 불명확은 동일 답변 재시도다. 부모 대화 acting 및 abort를 공유하고 기존 편집기를 교체하지 않는다. 소스 전환은 필수 열 누락 회복만 지원하며 파일 업로드·열 매핑·임의 질문 수정은 기존 별도 화면을 유지한다.

새 actor/엔티티/용어는 없어 요구사항·엔티티·용어집은 변경하지 않는다. Main 별도 대조와 실제 검증은 독립 리뷰·사용자 제품 수용과 구분한다.
