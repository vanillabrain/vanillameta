# Inline creation clarification

Status: Draft. [UC033](../use_cases/UC-033-inline-creation-clarification.md).

기존 StudioExecution JSON에 마지막 답변의 requestId/payloadHash만 기록한다. DB 엔티티/마이그레이션은 추가하지 않는다. POST runs/:id/creation/clarify는 원 proposalId/sourceRevision, refundDenominator, requestId만 허용한다. 소유권/원소스 접근권한과 미저장·분모질문 조건을 확인한 뒤 기존 creation.propose에 서버 원 질문+답변을 전달한다. 모델 대기 중 DB 직렬 쓰기 잠금을 점유하지 않고 완료 직전에 최신 실행을 다시 읽어 CAS한다.

단일 서버의 run별 진행 Map은 같은 본문을 합치고 다른 본문은409다. 완료 요청/hash를 기존 실행 상태에 기록해 응답유실 재전송을 모델 재호출 없이 확인한다. JSON 상태에는 질문/SQL/미리보기/원본 행을 추가 저장하지 않는다. 저장은 latest creationResult로만 기존 saveCreation을 사용한다.

FE는 기존 Notice/Button/TextField 토큰을 사용한다. 카드 선택→명시 확인은 대화 부모가 acting을 공유하고 완료 run만 갱신한다. 실패는 선택/원질문을 유지하며 응답불명확일 때 같은 요청 재시도만 허용한다. run변경/unmount 뒤 늦은 결과는 적용하지 않는다. 필수열 확인은 기존 소스 확인 링크를 유지한다. 390/768/1440에서 카드/입력/버튼/미리보기/주변 대화 정렬을 실측한다.

새 actor·엔티티가 없어 모델/용어집의 스키마 변경은 없고 기존 실행의 선택 receipt 필드만 확장한다. Main 별도 검토는 독립 리뷰/사람 승인이 아니며 Draft를 유지한다.
