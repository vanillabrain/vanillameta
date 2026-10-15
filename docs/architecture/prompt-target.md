# 질문의 블록 대상 식별

UC015/P3/Draft. UC014의 엄격 의도/저장 분류는 변경하지 않는다. 자동content/layout에만 원래 prompt와 검증된 현재items·selectedKey로 동작하는 순수 대상 resolver를 추가한다. 숫자 번호는 현재 순서의1-based 값이며 key는 재사용한다. exact title marker만 인식하고 새 제목 문자열/SQL/지표 이름의 유사도를 추측하지 않는다. 번호가 여럿이거나 제목 후보가 여럿이면 후보로 반환한다. 명시 참조가 없을 때만 현재 선택을 문맥으로 사용한다.

후보는 `{key,title,position}`의 최대6개이며 소유권 검증 후 현재 초안에서 만든다. 모호 결과는 `{editMode:'clarify',saveRequested:false,targetCandidates}`로 끝나므로 생성·preview·저장0이다. 알 수 없는 번호/명시 제목은 현재 블록 전체를 후보로 보여주며 질문을 구체화할 수 있다. targetChoiceKey는 서버가 재계산한 모호 후보 중 하나일 때만 확인으로 적용한다. 명확한 다른 번호/제목을 덮어쓰지 않는다. 잘못된 key/타입은 provider 전에 거절한다. 혼합/다중 작업을 의도 분류가 clarify한 경우에는 후보를 붙이지 않고 UC014 안내를 유지한다.

해결된 key를 body의 selectedKey 대신 지역 변수로 사용해 기존 생성·geometry·재compile을 실행한다. 응답에는 targetKey를 추가한다. FE는 auto 응답targetKey(기존 명시선택 응답은 selectedKey fallback)를 현재 items에 대조해 하나만 바꾸고 실제 선택 상태를 갱신한다. 기존 UC014 frozen nextItems 저장·취소/token·revision 경계는 유지한다.

후보 UI는 질문 패널 안의 짧은 안내와 기존28px버튼/12px글꼴을 wrap 배치한다. 긴 제목은 한 줄 말줄임으로28px높이를 유지하고 전체 제목은 접근 이름과title속성에 남긴다. 선택은 pending 저장 실행이 아니라 선택 확인만 하며 다음 `AI 요청 실행`으로 원래 질문을 다시 보낸다. 질문/초안/선택/이력/폭 변경 후 후보·choice를 무효화해 묵은 확인을 쓰지 않는다. 기존32px입력·고급 목적 접기와390/768/1440 크기를 유지한다. 새 DB/의존성/범용 에이전트 라우터는 없다.

실제 번호 질문이 일반 clarify로 끝난 문제를 확인해 기존 의도 분류 지침에 번호/제목의 대상 존재 확인은 서버 책임이라는 규칙과 숫자 예시를 보강했다. strict3키·저장 부정/조건부 규칙과 입력 질문만 전달하는 경계는 유지한다. 알 수 없는 비따옴표 블록 표기도 이전 선택으로 조용히 대체하지 않고 후보로 처리한다. [검증 기록](../testing/prompt-target.md) 참조.

새 제목 절(`제목을/제목은`) 뒤에 나온 다른 블록 번호/제목 marker는 기존 대상 참조로 결정하지 않고 후보 확인으로 제한한다. 명확한 기존 참조를 제목 절 앞에 쓰는 대표 흐름은 그대로다.

UC-016 확장: 서로 다른2~6개 블록을 명시한 내용/배치 작업은 [다중 블록 계약](../use_cases/UC-016-batch-block-edit.md)으로 처리한다. 기존 단일 의도 strict3키/save/clarify·후보 확인은 유지하고 batch만 별도strict actions 스키마를 사용한다. 다중 블록을 clarify로 제한한 위 설명은 UC016 이전 범위이며, 같은 블록의 내용+배치 혼합·모호한 요청은 여전히clarify다.
