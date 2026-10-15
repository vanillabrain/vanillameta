# 질문의 명시 저장 실행

UC-014 / P3 / Draft. 기존 editor/ai는 쓰기 없는 결과+미리보기 API로 유지한다. 기본auto 분류를 `{intent,saveRequested,editPrompt}`로 확장한다. 입력은 질문뿐이며 저장/게시 명령을 생성기에 전달하지 않도록 editPrompt는 변경 부분만 담는다. 단순 변경은saveRequested=false, 저장만은intent=save/true/null, clarify는false/null이다. 부정·조건부·질문형 저장은 실행하지 않는다. 수동 content/layout은 기존처럼 미리보기만 제공한다.

compileEditor는 항상 먼저 실행한다. 기존 잘못된 비어 있지 않은 selectedKey는 분류 전 거절한다. 선택이 없는 auto는 분류할 수 있지만 save/clarify 외에는 거절한다. save는 현재 전체 초안의 서버 미리보기만 반환하며 item은 없다. content/layout은 기존 선택 블록 경로와 compile/preview를 사용한다. 응답은 실제editMode·saveRequested·preview·선택 item(수정 시)이다. 서버 자체는 editor/ai에서 저장하지 않는다.

FE는 editorBody에 결과items 인자를 허용하고, 검증한 nextItems를 미리보기·공통 이력에 적용한 뒤 saveRequested=true인 경우에만 기존 POST editor를 호출한다. change가 sequence를 증가시키므로 그 이후 현재 토큰으로 다시 고정한다. 중간 동기 구간에서 pending을 다시 잠그고 저장 중 안내를 표시한다. 요청/미리보기 동안만 취소할 수 있고 저장 전송 뒤에는 취소 버튼을 숨긴다. signal/토큰 검사와409복구는 기존 계약을 유지한다. 저장 실패 시 변경 초안과 preview를 유지하고 별도 저장 오류를 표시한다. 자동 재시도/새 의존성/새 DB는 없다.

UI는 기존28px버튼/32px입력·12px글꼴과 접힌 목적 설정을 재사용한다. 버튼 문구는 저장 실행까지 포함함을 드러내는 `AI 요청 실행`으로 바꾸고 보조 문구로 저장 명시 시 미리보기 후 저장됨을 설명한다. 저장 요청은 블록 선택 없이 가능함을 안내한다. 신규 설정 컨트롤은 만들지 않는다.

UC-015 후속은 [질문 대상 식별](prompt-target.md)에서 auto content/layout의 사전 선택 제한을 번호·정확 제목/후보 확인으로 확장한다. 위 선택 없는 변경 거절은 UC-014 초기 계약이다. 저장만/수동 모드·frozen result 저장 책임은 유지한다.
