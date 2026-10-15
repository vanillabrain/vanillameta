# UC-011 실행 — 2026-10-15

기준 develop-v2 / 7d63804e 위 diff. [UC](../use_cases/UC-011-ai-block-layout.md), [TC](../test_cases/TC-011-ai-block-layout.md), [계획](../plans/UC-011.md).

## 구현·실행

기존 AI 블록 편집에 compact 목적 선택(차트 내용/배치)을 추가했다. 배치는 현재 선택 블록과 현재 편집 화면 폭에만 적용한다. AI에 SQL·원본 행·접속 정보를 주지 않고 제목·좌표만 제공한다. 반환은 x/y/w/h 네 정수 필드만 허용한다. 서버 재compile로 겹침·범위·소유권·버전을 검증한다. 기존 content 요청은 호환된다. 새로운 엔티티·DB·의존성은 없다.

| TC                    | 결과                         | 실제 증거                                                                                                             |
| --------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 011-01 선택 배치 격리 | PASS 단위/실LLM/API          | 내용 AI 호출과 분리, SQL 비노출, 선택 폭만 반영, 전체 widget 정의 동일                                                |
| 011-02 오류 격리      | PASS 단위                    | JSON·unsupported·추가 SQL필드·정수·범위·겹침 거절, FE 실패 후 초안/저장 gate 보존                                     |
| 011-03 취소/충돌      | PASS 단위, UI 로딩 부분 확인 | 제공자 전/후 abort, 제공자 응답 중 revision 변경 거절, 기존 취소/오래된 응답 회귀; 실제 경합을 UI에서 재현하지는 않음 |
| 011-04 공통 이력      | PASS 컴포넌트/UI             | AI 성공 후 undo/redo, 미리보기 재실행→저장                                                                            |
| 011-05 저장·재조회    | PASS 실LLM/UI/API            | 새 비공개 분석18에서 요청→미리보기→저장→브라우저 새로고침, SQL·다른 블록/폭·원본17 동일                               |
| 011-06 컨트롤         | PASS 대표 UI                 | 1440px·390px 선택 블록/목적/입력/버튼, 요청 중 비활성; 모바일 버튼28px·region343px·document375 ≤ viewport390          |

실제 요청: “너비를 5칸으로 줄이고 오른쪽으로 한 칸 이동해 줘. 세로 위치와 높이는 그대로 유지해.” 3번 블록 desktop x0/y10/w6/h3 → x1/y10/w5/h3. 화면 입력으로 undo 원복과 redo 재적용을 확인했다. 브라우저 새로고침에서 KPI635M 두 개와 숫자 시계열3개가 유지됐다. API 비교에서 모든 widgets 정의가 완전히 동일하고 선택 좌표 외 세 배치가 동일했다. 새 복사본만 수정했으며 분석17은 동일했다.

로컬 설정 AI_PROVIDER=codex, 지정 모델 gpt-6-luna, 기존 proxy/catalog를 사용했다. 모델 자동 대체는 없다. CLI 설정은 요청 모델의 증거이며 모델 내부 실행 provenance를 독립적으로 보증하지 않는다. 브라우저는 cua_repl의 Codex In-app Browser이며 Aside CLI 성공으로 보고하지 않는다. 실제 마우스·터치와 전체 P1, 게시/공유, 다중 블록·자동 의도 분류는 미검증/미구현이다.

Rill 데이터·전체 기간 KPI/추세 기준은 직전 [실제 비교](pointer-block-layout.md#실제-화면-재검증--2026-10-15)를 재사용했다. 이번 변경은 계산하지 않으며 Rill과 같은 자연어 배치 편집 UI가 있다고 주장하지 않는다. 이 단위에서 Rill 화면을 새로 실행하지 않았다.

## 검증·문서 상태

BE46 tests / FE22 tests, BE/FE build·변경 lint·FE type PASS. 기존 도구 경고는 남아 있다. 엄격 문서 lint는 기존 UC-007~010의 제목/Overview/diagram 누락12 errors로 FAIL이며 이번 UC-011·TC-011 진단은 없다. 기존 문제를 숨기는 baseline을 추가하거나 관련 없는 문서를 고치지 않았다. spec pin/check는 변경 감지일 뿐 승인/전체 문서 품질 PASS가 아니다. 동일 에이전트의 별도 의미 검토이며 독립 리뷰·고객 승인은 미기록이다.

AIWF sync 범위: UC/TC/계획·use-case diagram·배치 아키텍처·제품 다음 작업·AGENTS와 이 실행 기록. requirements의 FR-009/010 목표는 바꾸지 않고 P1 Open을 유지한다. glossary/entity_model은 새 개념·저장 엔티티가 없으므로 변경하지 않는다. 별도 design-spec 추적 파일은 없다.

증빙 `/tmp/vm-uc011/{fixture.json,result.json}`, `/tmp/vm-uc011-be.log`, `/tmp/vm-uc011-fe.log`, `/tmp/vm-uc011-{be,fe}-build.log`와 `.aiwf/evidence/UC-011/`. 캡처는 대화에 출력했고 이미지 파일로 별도 저장하지 않았다. 임시 파일의 영구 보관은 보장하지 않는다. 비밀번호·토큰은 증빙에 저장하지 않았다.

다음은 P1 남은 실제 포인터·터치 및 복제/내용 AI와 배치 AI의 연속 편집 회귀다. 다중 블록 자연어 배치는 명시 범위 후속이며 P2~P5를 대체하지 않는다.
