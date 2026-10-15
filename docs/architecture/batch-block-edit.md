# 다중 블록 질문 변경

UC016/P3/Draft. 기존 단일 content/layout/save/clarify 응답을 유지하고 batch만 추가한다. 분류 JSON은 batch일 때 `{intent:'batch',saveRequested:boolean,actions:[{editMode:'content'|'layout',targetPrompt:string,editPrompt:string}]}`이다. 각 targetPrompt는 원문에 포함된 명시 참조이며 서버가 UC015 resolver에 선택/확인 없이 대조한다. 동일 key·모호 참조·초과 개수는 전체 실패다. batch가 아닌 경우 기존 strict3키 계약을 유지한다.

서버는 모든 대상을 먼저 확정한 뒤 기존 generate/proposeBlockLayout을 순차 사용한다. staged items는 요청 로컬 변수이며 각 결과를 선택한 대상에만 병합한다. 내용action에서 제목/이름/title/rename을 명시하지 않으면 대상 제목도 기존items에서 유지해 복사KPI의의도하지않은rename을막는다. 모든 layout 작업은 요청의 단일 layoutMode를 공유한다. 배치 동작에 화면 폭을 명시하는 질문은 clarify하며 사용자가 선택한 화면 폭만 적용한다. 블록 제목에 포함된 모바일 등의 단어는 화면 폭 지시와 구분한다. 단계별 compile로 권한/revision/정의/배치 경계를 재검사하고 최종 전체 preview(includeTrends)를 한 번 실행한다. 반환은 `{editMode:'batch',saveRequested,changes:[{targetKey,editMode,item}],preview}`이며 실패 응답은 안전한 `{batchFailure:{stage:'target'|'change'|'preview',position?:number},message}`다. 취소/409는 기존 신호/충돌 의미를 유지한다. position은 작업 순서가 아니라 현재 items의1-based 번호다. 전체preview 실패에는position을 붙이지 않는다. 기존 HTTP 필터가 이 객체를 response.data.data에 감싸므로 FE는 해당 경계를 읽는다. 실패 시 staged 결과는 응답하지 않는다.

FE는 모든 changes를 검증한 후 기존 items에 key별로 병합한다. layout은 선택 폭 rect만, content는 검증된 정의만 기존 대상에 적용한다. 결과 목록은 질문 패널에 작은 텍스트로 번호·제목·내용/배치를 표시한다. 추가 모드나 큰 버튼 없이28px버튼/32px입력/12px본문·wrap·말줄임을 유지한다. 전체 preview와 함께 한 번의 change 호출로 이력을 만든다. 실패 시 기존 질문/초안/이력을 유지하고 기존 실행 버튼으로 전체 재시도한다.

저장은 기존 saveEditor→AiDashboardService.save의 단일 transaction과 revision CAS를 재사용한다. 여러 블록마다 저장을 반복하지 않는다. DB 변경은 추가하지 않는다. transaction 중간 쓰기 실패의 rollback은 실제 SQLite 테스트로 입증한다. UI 저장 실패/응답 유실은 검증된 전체 초안을 유지하며 rollback을 추측하지 않는다. 별도 분산 transaction·부분 저장·임의 범위 편집·게시·모든 자연어 이해는 범위 밖이다.
