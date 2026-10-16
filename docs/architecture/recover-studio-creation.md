# UC032 Studio 저장 확인 reload 복구 설계

Status: Draft. [UC032](../use_cases/UC-032-recover-studio-creation.md).

기존 StudioCreate.creation ref는 reload 때 사라진다. 새 studioCreationRecovery helper에서 최소 확인 envelope를 검증·보관한다. editorDraftKey(getToken(),1)에 :studio-create-save suffix를 붙여 기존 인증scope/refresh연속성과 logout prefix정리를 재사용한다. 양의1은 namespace 계산용이며 실제 대시보드 대상이 아니다. 다른 계정/새로그인의 key는 접근하지 않는다. 새 영구 DB/entity는 추가하지 않는다.

정상 저장 직전 기록 성공을 확인한 뒤 기존 POST를 실행한다. 원 제안은 메모리에 유지하며 UC031 같은 화면 UI/잠금은 그대로다. reload에서는 소스 목록이 해당 소스의 권한을 확인한 후 별도 확인 대기 카드에 제목·질문과 같은요청확인/기록지우기를 표시하고 정상 제작 패널은 숨긴다. 요청 재확인은 preview가 없어도 원 body를 보내 기존 영수증을 읽는다. 요청 시 다시 authscope가 같은지 검사한다. 입력만료나권한거절시 임의새request를 생성하지 않는다.

저장/AI 자동 재실행0, 제안GET0, 원본·SQL·미리보기영구보관0이다. 기록 쓰기 실패는 저장 전에 차단하고 기존 미리보기/질문을 유지한다. 삭제 실패는 안내하고 잠금을 유지한다. 새 UI는 기존 Alert/Button/card 토큰을 재사용하고390/768/1440을 검증한다. 전체초안복구/다중대기요청/다른탭이관/닫힌탭복원/운영수용은 별도다.

초기 소스 목록/인증scope 조회 실패도 초기화 실패 상태로 잠근다. 명시 다시 불러오기는 실제 reload로 권한 조회부터 재시도하며 대기 기록을 새 생성에 덮지 않는다.
