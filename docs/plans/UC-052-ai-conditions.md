# UC052 AI 조건 제안과 명시 검토

2026-10-18 · 기준008af89a · FR018/020·NFR005/006/008·TC050 E04/E08. 전체16개 요건 완료 목표를 유지한다. 기존 Studio 질문에서 설명/조회와 변경 제안을 구분하고, 중첩 포함/제외 조건의 검증 차이→전체 미리보기→명시 적용→저장/reload를 연결한다. 새 모드 선택/새 LLM·MK AI 연동은 추가하지 않는다.

## 계약

기존 StudioRunService.propose의 JSON intent ask/edit/clarify/unsupported와 operations 한 개 한도를 유지한다. 모델은 선택 블록 updateBlock 또는 전체 공통 조건 setConditions 중 한 종류만 제안할 수 있다. 조건 모델 operation은 `{type:"setConditions",definition:ConditionDefinition|null}`이며 sourceRevision은 서버가 현재 요청 파일 hash로 고정한다. null은 전체 조건 제거, include/exclude 모두null은 실제 정의인 빈 조건이다. 실제 schema의 모든 열명/native type·연산자/깊이/값/크기 한도를 공통 compiler로 검증한다. 같은 정의의 no-op는 거절한다. 원본 SQL·블록/ID/레이아웃·기간·기존 filters·지표 참조 변경은 허용하지 않는다.

권한·기준 revision/file 확인을 마친 prepare가 실제 열명/native type 목록을 모델 문맥에 제공한다. 원본 행을 새로 추가 제공하거나 임의 SQL을 허용하지 않는다. AI 결과 뒤 다시 prepare하여 현재 권한/파일/문서 기준과 전체 집계를 확인한다. 응답은 기존 공통 setConditions operation의 wrapper와 검증된 전체 preview다. 조건 제안은 조회/설명 답변과 구분하며 무변경/혼합/손상/알 수 없는 필드는 전체 거절한다.

## 저장/게시 경계

조건이 포함된 제안은 질문에 저장 요청이 있어도 미리보기 뒤 명시 검토를 요구한다. StudioExecution은 applyDraft/saveDraft 단계에서 쓰기를 하지 않고 unsupported/CONDITION_REVIEW_REQUIRED로 반환한다. GET/재시도·게시 단계가 이 경계를 우회할 수 없다. 결과는 검토 가능한 조건 제안과 preview를 유지한다. 사용자가 명시 적용하면 기존 공통 reducer의 하나의 undo 단위로 초안만 바뀌고 저장은 기존 명시 버튼/후속 저장 질문이 담당한다. 기존 내용 편집·저장/게시 질문은 바꾸지 않는다.

## UI

기존 대화에서 조건 operation을 받으면 자동 적용하지 않는다. 현재 포함/제외와 제안 트리를 읽기 전용 차이로 나란히(모바일 한 열) 표시하고 서버가 검증한 전체 블록 preview를 제공한다. '조건 변경안 적용'·'유지/닫기'의 명시 선택과 미저장 안내를 제공한다. 응답 대기/검토 중 편집·선택·revision/source·로그인 문맥 변경은 기존 freshness guard로 적용을 막는다. 실패/취소는 질문·초안 보존, 조건 적용 후 이전 결과를 새 조건 수치로 표시하지 않는다. 질문부터 새로 해야만 하는 별도 화면으로 분리하지 않는다. UI Kit36/32px·min-w-0/긴 열명 줄바꿈·키보드/상태 문구를 유지한다.

## 검사와 종료

AI 응답 fixture 기반으로 설명/조회0연산·조건 추가/변경/제거·무변경/유형/미지원 열/혼합 거절·파일/권한/문서409·재시도/취소를 검사한다. 실제 SQLite/DuckDB의 원본 조건→AI 제안 preview→명시 적용/기존 save→reload 수치·비대상 SQL/ID/배치 보존과 거절 시 쓰기0을 검증한다. 실행 저장/재시도/게시 우회0도 검사한다. FE는 pending 차이/preview와 적용 전 무변경·명시 적용/undo·late/실패 보존·조건 응답검증을 검사한다.

선택 회귀/type/lint/build·독립 검토·문서 동기화/strict/pin/check/packet·기업정보 검사 후 현재 develop-v2 commit/push한다. Ego TaskSpace96의 사용자 제어권 반환은 확인되지 않았으며 다른 공간으로 우회하지 않는다. 새 실제 Ego/390·768·1440/실휴대폰·이번 MySQL/운영·실LLM/임의 자연어 전체·사람 수용은 별도 gate다. 분포/표본과 전체 FR020 수용은 이 단위 회귀만으로 완료하지 않는다.
