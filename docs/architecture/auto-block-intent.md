# 선택 블록 질문의 자동 목적 판별

UC-013 / P3 첫 단위 / Draft. 기존 `POST /bi/dashboards/:id/editor/ai`에 `editMode:auto`를 추가한다. 생략/명시 content/layout의 기존 호출은 유지한다. auto는 현재 layoutMode를 반드시 전달한다.

compileEditor와 selectedKey/prompt 검증 후 AiDashboardService의 intent 분류를 호출한다. 입력은 사용자 질문 하나이며 SQL·원본 행·블록 제목·자격 증명은 전달하지 않는다. 출력은 정확히 `{intent:content|layout|clarify}`만 허용한다. fence 제거는 기존 layout parser 패턴을 재사용한다. 혼합/불명확/저장·게시·복제 요청은 clarify로 반환한다. 분류 자체는 실행 권한이 아니며 다음 경로가 기존 모든 검증을 수행한다.

content/layout은 기존 실행 경로를 재사용하고 응답에 실제 editMode를 넣는다. clarify는 `{editMode:clarify}`만 반환하여 고정 안내를 표시한다. 분류 오류와 취소는 예외이며 후속 LLM을 호출하지 않는다. 모델은 지정 Codex/gpt-6-luna, 순차 최대2회 호출이며 대체/범용 에이전트 작업기/새 DB·의존성은 없다.

FE는 기본auto, 수동 목적 선택은 접힌 details에 둔다. auto 응답에는 content/layout/clarify 중 하나가 필수다. layout 응답은 기존 geometry 전용 병합, content 응답은 기존 정의 검증을 거친다. clarify는 질문·초안·이력을 보존하고 저장 gate를 무효화한다. 적용 목적·선택 폭은 결과 안내에 표시한다. 저장은 기존 명시 버튼이며 한 프롬프트의 저장 실행은 다음 단위다.

실제 검증에서 한 칸을 블록 높이로 해석한 차이를 확인해 배치 LLM 입력을 selectedRect/occupiedRects로 분리하고 제목을 제거했다. 한 칸=grid1과 수치 예시를 명시한다. 실제 선택 시나리오와 한계는 [검증 증거](../testing/auto-block-intent.md)를 따른다. editor AI 전용 HTTP timeout은180초이며 전역 기본값은 유지한다.
