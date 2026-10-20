# TC-005 전체 여정·UC-023 생성 연결 검증 — 2026-10-16

기준 `develop-v2` ddceeb47 및 이번 UC023 변경. [TC005](../test_cases/TC-005-dashboard-lifecycle.md)·[UC023 설계](../architecture/creation-lifecycle.md)·[계획](../plans/UC-023.md). 기존 환경 FE3698/API4899→4898/SQLite를 유지하고 Ego TaskSpace45 하나에서 실행했다. 증빙은 `/tmp/vm-tc005/`다. 기존 DB·사용자 자료를 초기화하지 않았다.

## 확인한 공백과 수정

전체 Rill 미리보기 뒤 **“현재 초안을 저장하고 게시 미리보기로 이어 줘.”**가 새 분석 생성으로 해석돼400이 발생했다. 생성 미리보기의 proposal/digest를 유지하는 쓰기 없는 후속 질문 API를 추가했다. 명시 저장만 기존 원자 저장·영수증에 연결하고 신규 성공 revision으로 게시 준비를 연다. 링크 공개는 별도 버튼이다. 부정/모호/취소·잘못된 플래그·소스/지표 변경은 저장하지 않는다. 모호한 계산은 확인 질문을 표시한다.

영수증 재생은 같은 분석 ID만 증명하며 과거 revision을 저장하지 않는다. 재생을 최신 revision의 과거 저장 증거처럼 취급하지 않고 수동 게시 미리보기를 요구한다. 새 DB/의존성을 추가하지 않았다. 저장 후 목록 invalidate 재조회 중 게시 화면으로 이동하면 전역 로딩 막이 남는 경합도 재현했다. 목록 fetch effect의 unmount cleanup에서 해당 로딩을 해제하도록 고쳤고, pending fetch 중 저장 handoff를 고정한 회귀1개와 Ego 재검증으로 게시 미리보기 버튼 클릭을 확인했다. 최초 질문의 “저장·게시 미리보기, 실제 링크 공개 금지”에서 준비 의도가 누락된 첫 실LLM 결과도 남겼으며 준비와 실제 공개의 차이를 제공자 지침에 명확히 했다. 이 차이는 모든 자연어가 항상 맞게 분류된다는 보장이 아니다.

## 실제 전체 여정

| TC005 단계     | 실제 결과                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 생성         | source28 전체 canonical Parquet 1,391,572행에서 요청 수·평균 Bid Floor·OS별 요청 수 3블록 생성. 실 Codex gpt-6-luna 요청/API201.                                                                                         |
| 2 재사용       | 기존 지표19 SUM(bid_request_cnt) 재사용, 평균 지표20 신규, device_os 원본 열 Dimension 제안 확인. 미리보기 후 원자 저장 분석27.                                                                                          |
| 3 직접·AI 편집 | 복제→복사 블록 삭제→undo/redo, 긴 제목, 실제 데스크톱 마우스 이동/resize, 2번 차트 USD 표시 AI 수정. 원본3개 ID·비대상 정의/배치 보존.                                                                                   |
| 4 반응형       | 모바일 Chromium touch emulation drag/resize와 undo/redo, 태블릿 Shift+ArrowLeft, 폭 변경 후 선택·초안 유지. 첫 블록 mobile(0,11,4,3), tablet(0,0,3,2), desktop(0,8,8,3).                                                 |
| 5 저장·게시    | 같은 질문으로 편집 전체 저장→확정 revision 게시 준비. 재사용 명시 허용→전체 미리보기→링크 게시. 게시503에서 저장본 유지/동일 요청 재시도→version1.                                                                       |
| 6 조회         | 별도 origin 로그아웃 익명 조회·실제 accessToken 없음 확인. 숫자+169점 추세2개/OS28과 수신자 조회 확인.                                                                                                                   |
| 7 재게시       | 원본 제목만 저장해도 게시 version1 JSON 전체 불변. 같은 URL version2/새 제목으로 재게시, 익명 reload.                                                                                                                    |
| 8 재사용       | 새 수신자 계정에 전체 값 동일·열 이름 변경 source31 업로드. 누락 파일 source30은 필수 열 미연결로 preview/save 비활성. 완전한 소스4열 연결→전체 미리보기→비공개 복사본29 저장/reload. 새 블록 ID·모든 폭 배치·원본 보존. |
| 9 중지         | 원본 게시를 정상 UI로 중지→version3/inactive. 로그아웃 익명 재조회404·중지 안내. 복사본29는 유지.                                                                                                                        |

복제본의 원본 값은 요청634,513,000·평균5.571238676523278·OS28그룹, 두 추세169점이다. 새 복제본은 지표 링크 대신 본인 소스 SQL snapshot을 갖는다. 다른 계정의 원본 editor/source28/publication GET은 모두403이다. 공개 결과에 소스/SQL/인증/recipe를 제공하지 않는 기존 권한 회귀도 전체 테스트에 포함했다.

## 오류·취소와 재시도

- A1: 분자·분모·전환 정의 없는 전환율 요청은 실제 clarification201만 반환했고 preview/save/publication 쓰기0이다. 기존 미리보기 보존·부정 요청·소스 변경은 FE/BE 회귀로 함께 확인했다.
- A2: 본인 분석27의 실제 동시 변경 POST 이후 UI save409. 질문·초안 보존→저장 상태 확인→같은 제목 충돌에 명시 내 변경 사용→전체 재미리보기→save201. 비대상 최신 변경 유지·모든 경합 변형은 기존 UC017 회귀 범위와 구분한다.
- A2: 같은 모델/DB에서 AI_TIMEOUT_MS=1로 실제 CLI 제한시간500을 유발했다. 다음으로 모델은 바꾸지 않고 로컬 제공자의 HTTP400 model_not_found 응답을 주입했다. 이는 실제 계정의 모델 지원 여부를 판정한 검사가 아니다. UI는 질문·초안을 보존했고 정상 연결 복원 후 취소(status0)→같은 질문201→미리보기→저장이 성공했다. 지정 모델 자동 대체 없음.
- A3: 게시 요청을 upstream 전달 전에503으로 실패시킨 뒤 동일 requestId/body 재시도→버전1. 신규 생성 저장은 commit 후503 응답으로 바꿔 영수증 재시도·중복 없음·게시 준비 연결을 따로 검증했다. 분석30은 첫 의도 누락 결과,31은 지침 보완 후,32는 로딩 경합 보완 후다. 최종32는 같은 requestId로 replayed:true/id32를 반환했고 자동 게시 preview0에서 수동 미리보기201로 진행했다. 이 세 분석은 게시version0/비공개다. 최초 실패와 보완 후 결과는 서로 다른 파일로 남겼다.
- A4: source30에서 요청/가격/OS는 연결해도 분모 열 미연결이라 저장·미리보기가 차단됐다. source31로 교체하면 정상 복구했다.
- A5: 실제 중지 링크 재조회404와 복사본 보존은 최종 상태 증빙에 기록한다.

`initial-generation`, `first-creation-handoff`, `ai-unit`, `edited-save-handoff`, `publication-retry`, `remix-preview`, `conflict-recovery`, `llm-timeout`, `llm-unsupported`, `llm-restored-cancel-retry`, `ambiguous-creation`, `creation-replay-fixed`, `assertions.json`이 핵심 기록이다. `owner-reload-audit`·`anonymous-v2.audit`에서 editor/save/publication 추가 쓰기0을 확인했다. 저장 화면의 POST dashboard-preview는 읽기 계산이며 추가 저장으로 세지 않는다.

## Rill·UI 검증

Rill9009 실제 aggregation 응답과 canonical 독립 DuckDB oracle을 비교했다. 요청634,513,000 정확 일치, 평균 오차1e-8 미만, OS28개 모든 요청 수 정확 일치다. Rill 모델은 CURRENT_TIMESTAMP 기준 시간 이동과 로컬 시간대를 적용하므로 VM raw2023-09-09~16 UTC와 절대 시간 bucket을 같다고 주장하지 않는다. 숫자+추세·차원 배치/밀도/값 표시는 실제 Rill과 대조했다. Rill은 대화·게시·복제 기능 전체의 참조 구현이 아니다.

기능과 디자인 결과를 구분했다. Ego 캡처를 직접 읽고 버튼/입력·긴 제목·로딩/오류·선택·비활성·줄바꿈을 확인했다. owner390/768/1440 CSS px, recipient/익명390/태블릿769/1440(사이트 확대율 반올림)을 실측했다. 안정된 상태에서 문서 가로 넘침0. 폭 전환 직후 초기 측정의 overflow145는 안정된 후0이었으며 초기 editor-ai/public-v1 캡처를 폭별 합격 증거로 쓰지 않는다. `recovery-editor-*`, `final-owner-*`, `recipient-saved-*`, `public-v2-*`가 최종 대표 증빙이다. 일반 버튼·입력36px/도구32px, 본문14px/보조12px를 유지했다. 사용자 이동 좌표로 생긴 공백은 자동 압축하지 않는다. 실제 휴대폰/멀티터치·모든 오류 조합은 미검증이다.

## 자동 검사·남은 gate

**최신 상태 참고(2026-10-17):** 아래 운영 MySQL 미검증 표기는 이 실행 당시다. 이후 [MYSQL02~06](studio-mysql-production.md)에서 로컬 마이그레이션/경합/복구를 선택 검증했다. 실제 운영·실휴대폰·사람 수용은 미완료이며 [최신 요약](status.md#최신-요약--2026-10-17)과 구분한다.



루트 전체 BE97 suites/1,681개·FE67 files/1,017개, root build, FE type/변경 파일 eslint, 격리 core E2E8개 PASS. 최초 root 검사에서 새 응답 union에 맞지 않던 기존 테스트 타입 오류1개를 고친 뒤 전체를 재실행했다. 마지막 제공자 지침 문장 보완 뒤 BE37개와 BE build를 다시 확인했고, 로딩 해제 보완 뒤 FE27개·type/eslint/build를 다시 확인했다. 기존 전체 검사와 변경 후 선택 검사를 구분한다. 의미 검토는 Main의 구현/별도 리뷰 패스를 구분했으며 별도 native executor는 제공자400으로 실행되지 않았다.

기존 strict spec lint12오류(UC007~010 형식/다이어그램)는 이번 신규 오류가 아니며 승인된 baseline으로 숨기지 않았다. pin/check는 drift 검사, packet은 awaiting_review/acceptance not_recorded다. 운영MySQL·실휴대폰·임의 자연어·모든 복구 경합·기존 거절된 타 계정 변경 POST 실제 실행·사람 제품 수용은 Open이다. 이 기록의 주 여정/선택 오류 PASS를 제품 전체 승인·운영 출시로 확대하지 않는다.
