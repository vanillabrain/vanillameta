# UC031 Studio 비공개 생성 저장 확인 설계

Status: Draft. [UC031](../use_cases/UC-031-confirm-studio-creation.md).

기존 StudioCreate의 creation ref와 saveUncertain 잠금, StudioCreationService.createOnce의 actor/requestId/payloadHash 영수증을 먼저 검증한다. 커밋 뒤 서버 생성 캐시는 소비돼도 replay는 캐시 조회보다 먼저 수행한다. 별도 저장기/의존성/영구 모델을 추가하지 않는다. 소유/소스 권한 재검사를 유지한다.

Ego71의 공개 Rill source30에서 실제 지정 Codex gpt-6-luna 질문→미리보기를 만들고 명시 저장한다. 테스트 프록시가 해당 표식 POST /studio/dashboards의 실제 upstream201 본문만503으로 치환한다. DB 커밋·응답 유실을 구분하고, 화면의 동일요청 재확인→같은ID→저장본 reload·증가량/게시0을 대조한다. 실제LLM 지원 실패는 성공으로 대체하지 않는다.

제품 차이가 발견될 때만 최소 수정하며 기존 단위/권한/회귀 증거를 재사용한다. UI는 기존 shadcn 크기/레이아웃을 유지하고390/768/1440 오류/완료 상태의 치수와 캡처를 확인한다. 불명확 상태 reload의 request ref 복구는 후속 범위로 남긴다.
