# UC037 saved creation publication evidence

2026-10-16. P3/P4, FR008·009·011/NFR003·004. [UC](../use_cases/UC-037-creation-publication.md) · [설계](../architecture/creation-publication.md) · [계획](../plans/UC-037.md) · [TC](../test_cases/TC-037-creation-publication.md).

## 변경과 경계

UC036의 저장 완료 후 원본 자동 복귀를 대체한다. 최근 생성 저장 영수증의 새 대시보드 ID·revision을 입력창에 표시하고 단독 “게시 준비해 줘”로 기존 상위 StudioPublish를 연다. AI 패널을 닫아 모바일 Sheet와 게시 창을 중첩하지 않는다. 새 ID·저장 버전 기준을 게시 창에도 표시한다. 준비는 읽기만 수행하며 공개 범위/복제 허용과 게시 버튼은 기존 정책을 재사용한다. 상단 원본 게시 버튼은 복사본 대상을 지우고 원본의 revision/dirty를 적용한다.

생성한 저장본 수정은 새 대시보드 열기에서 이어간다. 부정·혼합·다른 요청은 질문을 보존하고 원본 transport로 전달하지 않는다. 임의 자연어 전체와 저장+게시 혼합 명령을 추가한 것이 아니다. 게시 준비는 설정 창이며 새 snapshot 집계 미리보기는 추가하지 않았다. 준비 질문은 처리 후 소비하고 패널을 닫을 때의 메모리 대화를 영속 저장하지 않는다. 기존 게시의 서버 권한/CAS/requestId/중지 계약을 변경하지 않았다. 새 서버 API/엔티티/전역 UI 토큰/의존성은 없다.

## 실행 환경

기준19022909 + 이번 변경의 develop-v2. FE3698/API4898/정상 proxy4899, 기존 격리 SQLite `/tmp/vm-rill-views/metadata.db`. Ego **79 하나**에서 검증했다. 공개 합성 커머스 source32, 원본39/비공개 생성45(UC036의 실제 저장 영수증)를 재사용했다. 새로운 LLM 생성/저장은 이번 UI 연결의 변경 범위가 아니므로 반복하지 않았다. Codex/gpt-6-luna 설정과 사용자 서버는 유지했다. 캡처/원 XHR/전후 GET는 `/tmp/vm-uc037/`에 있다. 인증 정보·질문/SQL 원문이 들어갈 수 있는 원 GET/XHR은 저장소에 넣지 않는다.

## 기능 PASS_SELECTED

- reload 후 기존 입력창이 저장한 새 대시보드45를 대상으로 복원했다. 부정 요청과 최종 혼합 요청은 질문 보존·실행/게시 쓰기0·원본으로 전송0이었다.
- 게시 준비의 XHR은 `/studio/dashboards/45/publications` GET200 **1개**였다. 기존 AI 패널이 닫히고 새45/저장 버전 기준의 게시 창이 열렸다. 새 게시의 기본 private/복제 false를 확인한 뒤 화면에서 link를 명시 선택해 게시201/version1을 만들었다.
- 최종 상위 게시 창 구조에서 같은 저장 revision으로 재게시201/version2·동일 URL을 확인했다. 숫자 환불률21.232116243169088%(화면21.23), 날짜별37점, 총매출20994.61이었다. 독립 정답4457.60/20994.61×100과 대조했다. 인증 헤더 없는 공개 GET200에서도 같은3블록을 받았고 SQL/sourceId/자격 증명은 없었다.
- 소유 화면 reload의 요청은 GET뿐이며 게시 창은 자동으로 열리지 않았다. 이후 다시 준비하면 현재 게시 상태를 읽었다. 공개 화면 reload에서도 version2/숫자·시계열을 확인했다.
- 실제 게시 중지201 후 익명 GET410을 확인했다. 중지 뒤 최종 코드에서 준비를 다시 요청해 설정만 열리고 재게시 쓰기가 없는 것도 확인했다. 임시 링크는 중지 상태로 남겼다.
- 원본39와 저장45의 document/definitions/sourceRevision 전후가 같고, 원본39 게시 상태와 원본35 DB hash도 같다. 명시 원본 복귀는 질문을 유지했고 자동 전송하지 않았다. DB는 게시 행1개만 추가됐으며 대시보드/지표/실행/Studio문서는 추가·변경하지 않았다.
- 자동 증빙 대조 **47/47 PASS** (`/tmp/vm-uc037/assertions.py`, `assertions.json`). 관련6파일 **FE131 PASS**, type/lint/build PASS, 격리 core **8 PASS**. 실제 저장/409 대신으로 간주하지 않으며, dirty 원본 보존·copy ID/revision 게시409·상단 원본 게시의 문맥 초기화는 컴포넌트 회귀로 확인했다. 기존 게시 조회/유실/재시도 회귀도 함께 실행했다.

## 디자인 PASS_SELECTED

최종 게시 창과 공개 화면390/768/1440 모두 가로 넘침0. 게시 창 버튼/입력36px, 버튼14px/입력16px이며 하단 동작의 높이·정렬과 좁은 화면 줄바꿈을 실측/캡처했다. 폭 전환 뒤 닫기→Tab 포커스가 게시 창 안에 남았고, 모든 폭에서 중첩 Sheet가 없는 것을 확인했다. 390px 실제 클릭으로 최종 재게시/중지를 실행했다. 공개 화면의 숫자+추세/시계열은 기존 레이아웃을 재사용하며 대표 화면에서 읽혔다.

초기 구현은 대화 안에 게시 창을 중첩해 desktop→mobile 전환 시 Sheet 뒤로 가려졌다. 포털 조정만으로는 클릭 가로채기가 남아 실패로 기록했다(`prepare-390.png`, 실패 명령 출력). 이 구현을 제거하고 기존 상위 게시 창 handoff로 바꾼 뒤 같은 폭 전환/클릭/포커스에 통과했다(`final-dialog-{390,768,1440}.png`, `final-preparation-mobile.png`, `final-published-mobile.png`, `public-{390,768,1440}.png`). 전역 z-index/크기 예외는 추가하지 않았다.

## 검증 한계와 문서 동기화

strict spec lint는 기존 **12 errors/33 warnings/4 infos**이며 UC037 추가 이슈0, baseline 자동 승인0이다. pin/check는 문서 drift 검사이며 사람 승인/제품 수용이 아니다. 별도 code-reviewer 호출은 provider400으로 실패했으므로 독립 리뷰 완료를 주장하지 않는다. Main이 변경 경계를 별도 대조했고 UC036의 현재 계약·AGENTS·UC037/설계/계획/TC/다이어그램을 동기화했다. 기존 요구사항/엔티티/용어 책임은 바뀌지 않아 새 항목을 추가하지 않았다. packet은 awaiting_review/acceptance not_recorded다.

초기 격리 core 실행의 sandbox EPERM은 포트 권한으로 실패했고, 권한 있는 재실행에서8개가 통과했다. 운영MySQL/실휴대폰/VoiceOver·임의 자연어 전체·최신 saved copy가 외부에서 변경된 실제409 화면·대상 전환을 포함한 모든 응답 유실 조합·사람 전체TC005 수용은 NOT_RUN/Open이다. Rill 고정 수치/탐색 UI를 변경하지 않은 게시 설정 연결이므로 새 Rill 화면 비교는 반복하지 않았다.
