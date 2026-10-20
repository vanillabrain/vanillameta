# UC052 AI 조건 제안·검토 검증

2026-10-18 · develop-v2 · 기준008af89a · [AIWF 설계](../plans/UC-052-ai-conditions.md). FR018/020·NFR005/006/008·TC050 E04/E08의 선택 구현이며 전체16개 수용은 미완료다.

## 구현과 범위

기존 질문과 같은 StudioRun/Execution에서 설명·조회0연산과 조건 변경안을 구분한다. 모델 응답의 단일 setConditions.definition을 실제 허용 native schema로 검증하고 서버가 현재 파일 hash를 고정한다. 선택 블록 없이도 공통 포함/제외를 제안하며 조건 변경과 블록 내용 변경을 같은 응답에 섞지 못한다. SQL·원본/지표 참조·ID/배치·기간/기존 filters는 변경하지 않는다. unknown/타입 오류·손상·무변경은 전체 거절한다. 첫 prepare의 권한/파일/revision 확인과 모델 응답 뒤 재prepare를 유지한다. 추가 원본 행/새 LLM·MK AI 연동은 없다.

조건 응답은 대화의 pending 검토로 표시하며 현재/제안 트리와 포함/제외 변경 표시·전체 숫자/차트/추세를 확인한다. 명시 적용 전 초안/저장은 바뀌지 않는다. 조건 제안에 저장 요청이 붙어도 실행 applyDraft/saveDraft는 CONDITION_REVIEW_REQUIRED로 중단하고 저장0이며 재시도·게시 우회도 막는다. 적용 후 기존 reducer/undo·scope preview·명시 저장/reload를 사용한다. 이전 수치를 새 조건 결과로 표시하지 않는다. 대기/검토 뒤 편집/undo·선택/revision/source가 바뀌면 적용을 거절하고 source/dashboard 전환 시 이전 검토를 제거한다.

## 선택 실행

Git 제외 `.aiwf/evidence/UC052-ai-conditions/`에 실제 명령 로그를 보관한다. 모델 응답은 fixture로 주입했으며 실제 모델이 자연어를 해석한 증거가 아니다.

- 최초 RED: 신규 조건 제안/제거2건과 이전 Studio fixture의 synthetic file hash/빈 config 불일치2건 실패. 실제 저장 직전 파일 검사를 약화하지 않고 fixture도 실제 관리 파일 경로 hash/config로 맞췄다.
- 서버3 suites119 PASS: typed 제안/제거·unknown/type/손상/no-op·무선택 제안·기존 내용/기간/필터·권한/replay/취소와 저장 요청 검토 경계. 실제 SQLite/DuckDB의500→제안200/초안·DB 불변→명시 적용/저장/reload200, SQL/ID/배치 보존과 invalid 조건 거절을 확인했다.
- 실행의 조건+저장 요청은 unsupported/CONDITION_REVIEW_REQUIRED이며 영수증/저장0이다. GET은 검토 가능한 동일 제안을 반환하고 saveDraft 직접 재시도409다. 적용 문서의 새 명시 저장은1회 성공한다.
- FE3 files81 PASS: canonical wrapper/pin·null 제거·ask0연산·조건 UI 적용 전 무변경·전체 preview·명시 적용/undo·복합 저장 요청의 검토·명시 유지/닫기·편집/undo 뒤 stale 차단과 기존 대화/블록 편집 회귀다. 종전 조건 op 전체 거절 테스트는 새 검토 계약으로 갱신했다.

서버 lint의 기존 formatter 버전 차이는 model mock의 긴 chain을 지역 함수 변수로 바꾸고 require를 정식 import로 바꿔 검증했다. 테스트 의도/제품 검증을 삭제하거나 허용 경계를 넓히지 않았다.

## 검토와 미실행

중단 후 기존 하위 에이전트4개는 모두 native 도구의 not_found로 확인했다. 같은 역할 대체를 새로 생성하지 않고 Main이 통합 구현과 별도의 diff 검토를 수행한다. 별도 독립 에이전트 리뷰를 수행한 것으로 표시하지 않는다. 전체 검사·빌드·기존 core·문서 검사 결과는 아래에 기록한다.

Ego TaskSpace96은 사용자 제어 중이며 반환이 확인되지 않았다. 새 실제 Ego 질문→미리보기→적용→저장/reload·390/768/1440 크기·정렬/키보드와 실휴대폰은 BLOCKED/NOT_RUN이다. 기존 headless core와 DOM/CSS 검사를 새 UI 실행으로 승계하지 않는다. 실제 Codex/임의 자연어 전체·이번 MySQL·운영/사람 수용도 NOT_RUN이다. 분포/표본·공통 변수 의미 실행·수신자 공유·영속 export·보관·전체 TC050은 계속 열린다.

## Main 검토 후 보완·최종 검사

별도 Main diff 검토에서 두 가지를 보완했다. 전송 즉시 질문을 지우던 동작은 실패/취소/조건 검토에서 질문을 유지하고, 정상 완료 때만 같은 원질문을 지운다. 더 새로 입력한 질문은 늦은 성공 응답으로 지우지 않는다. 그리고 저장 없는 조건 제안을 applyDraft 성공으로 표시하던 실제 RED1건을 수정해 초안 반영 단계부터 CONDITION_REVIEW_REQUIRED로 중단한다. 복합 저장의 뒤 saveDraft는 pending이며 재시도409/쓰기0이다. 실행 화면도 검토 대기로 표시한다.

보완 전 전체 BE157 suites2638 PASS(MySQL opt-in9/1 suite SKIP), 전체 FE116 files1693 PASS다. 보완 후 최종 선택 서버3 suites120 PASS·화면4 files138 PASS이며 해당 결과를 합산해 새 전체 검사라고 표시하지 않는다. 실제 SQLite/DuckDB와 모델 응답 fixture·화면 mock 응답은 분리한다. 질문 보존 검사81개도 별도 통과했다.

기존 Chromium core8 PASS(22.4s)는 격리 임시 DB/테스트 서버에서 로그인·CSV 집계/저장·Explore/Pivot 복원·위젯/공유/보호 경로를 검증했다. 새 조건 UI의 Ego/모바일 여정을 실행한 증거는 아니다. 테스트 서버/DB는 실행기가 종료 후 정리했다. 추가 DB 모델은 없으며 기존 ConditionDefinition/StudioDocument/Execution 재사용이라 entity/glossary의 새 객체 추가는 없다. 최종 타입·린트·빌드/strict/pin/비공개 검사는 전달 로그로 구분한다.

최종 BE/FE 타입·대상 lint·build는 각각 exit0이다. 공개 대상21개 파일의 formatter/diff check PASS·알려진 기업 식별 문자열/출처 지문 일치0건이다. AIWF strict는0 errors/기존 FR011·NFR002 상태 경고2건으로 exit1이며 승인/Verified 상태로 바꾸지 않았다. pin/check·packet은 로컬 내용 추적이며 사람 승인/수용이 아니다.
