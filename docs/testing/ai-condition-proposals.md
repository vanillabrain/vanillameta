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

## 설명→조회→변경 실제 대화 — 2026-10-21 / Ego54

기준 develop-v2 `752c043f`. 기존 조건 compiler·거절 fixture·단일 업무 날짜의 실제 Codex 적용/저장 결과는 재사용한다. 새 실행은 실제 Ego의 같은 대화에서 설명/조회0연산→공통 조건 변경안 검토→명시 적용/undo를 확인한다. 저장/reload·게시 전체 여정을 반복하지 않는다. 새 격리 SQLite 복사본에서만 dashboard32의 Pivot 블록/폭별 배치를 준비 단계로 제외한다. Pivot+공통 행 AST 조건은 명시 미지원이며 제품 제한을 바꾸지 않는다. 기존 원본 DB는 수정하지 않는다.

| ID            | 행동·기대                                                                                                   | 상태                                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI-COND-UI-01 | 현재 기간/필터/포함·제외를 설명 요청. 실제 ask/operations0·문서/저장본 보존                                 | 최초 부재 문맥 누락 후 수정 PASS_SELECTED. UTC 2025-01-06~10 양끝 포함/company=Hanul Foods/추가 포함·제외 없음. ask·operations0.                   |
| AI-COND-UI-02 | 같은 대화에서 총매출·전체 마진 조회. 검증된 preview/독립 정답 일치·ask/operations0                          | 최초 단위 누락 후 수정 PASS_SELECTED. 2,000.00 USD·5.00%와 독립 CSV/Decimal 정답 일치·ask/operations0.                                             |
| AI-COND-UI-03 | 실제 schema의 명시 조건 변경 요청. 현재/제안 차이와 전체 블록 미리보기·적용 전 초안/저장본 불변·원질문 보존 | PASS_SELECTED. component=Compute 제안1개/조건 검토 대기·1,200 USD/25%/1점 추세의3블록 미리보기. 요청 문서 동일·이력0·질문 보존.                    |
| AI-COND-UI-04 | 키보드 명시 적용→조건 반영/전체 숫자·undo 복구. 모바일/대표 폭·가시 초점·저장/게시0                         | 최초 Undo 과거 안내·초점 손실 후 수정 PASS_SELECTED. 적용1,200/25→Undo2,000/5→Redo1,200/25→Undo2,000/5, 안내0·Redo/Undo 가시 초점·저장/게시 요청0. |

모델 호출은 기존 Codex CLI `--model gpt-6-luna`/AI SDK 경로만 사용하고 대체 모델/원본 SQL 수동 주입으로 통과시키지 않는다. 실제 요청 모델명과 응답 결과를 구분한다. VoiceOver BLOCKED·실휴대폰/이번 MySQL/임의 자연어 전체/업무 수용은 별도다.

### 준비와 독립 정답

전용 Ego54/API4562·웹3462·Node24.21.0/native DuckDB와 `/tmp/vm-ai-conditions-runtime/metadata.sqlite` 복사본을 사용했다. source32의 VM 공개 합성 CSV18행 중 기존 기간/회사 범위는2행, 매출2000·이익100·마진5%이며 Compute 추가 조건은1행/1200·300·25%다. Python csv/Decimal로 계산했다. 고객 자료/Rill 공식 원본의 새 비교로 보고하지 않는다. source·지표61/62 v1·3개 일반 블록의 계산식/ID/모든 폭 배치는 그대로다.

밤사이 세션 만료로 정상 로그인 화면에 도달했다. 격리 DB의 합성 소유자9에만 새 임시 비밀번호를 설정해 정상 로그인 UI로 진입했다. 과거 비밀번호 탐색/원본 계정 DB 변경0이며 임시 파일은 로그인 직후 삭제했다. 종료 시 격리 계정의 원래 암호 hash와 준비 전 Studio32 문서 bytes를 복구했다. 초기 잘못된 CSS selector·snapshot subtree root 대기는 관찰 도구 오류로 구별하며 제품 통과로 집계하지 않는다.

### 실제 오류와 수정

1. **설명 문맥 부재:** 적용 조건이 없는 문서에서 모델 입력의 conditions 필드가 생략되어 최초 답변이 ‘정보가 없어 확인할 수 없다’였다. null을 검증된 부재로 명시하고, 기간/필터와 구별해 설명하도록 보완했다. 중간 응답의 내부 JSON 표기도 일반 한국어로 바꿨다. 최종 답변은 기간·회사·추가 포함/제외 없음이며 블록은 수정하지 않았다.
2. **조회 단위 부재:** 최초 답변 숫자2000/5는 맞지만 USD/%가 없었다. 검증한 preview의 prefix/suffix·정밀도/표기만 모델에 추가 투영했다. 값의 배율/통화 변환은 하지 않으며 SQL을 모델 문맥에 추가하지 않는다. 최종 답변2000.00 USD/5.00%를 확인했다.
3. **Undo 상태 안내/키보드:** 적용→Undo에서 숫자/문서는 원복됐으나 ‘AI 조건 적용’ 안내가 남고 마지막 Undo의 disabled 전환으로 body에 초점이 빠졌다. 사용자 Undo/Redo 시 과거 임시 안내를 비우고, 해당 작업으로 현재 버튼이 비활성화될 때만 반대 활성 버튼으로 초점을 옮긴다. 다른 컨트롤에 있는 초점은 이동하지 않는다. 실제390px 마지막Undo→다시 실행, 마지막Redo→되돌리기와 가시 링을 확인했다.

BE 새 문맥/단위 회귀는 각각1FAIL 후 수정했다. 첫 선택4PASS/21SKIP와 최종 단위·기간/필터 선택4PASS/22SKIP는 서로 겹치는 배치로 합산하지 않는다. BE 최종 type/lint/build exit0. FE 기존 조건 통합 사례에 stale 안내 제거·Undo/Redo 초점 검사를 추가해1FAIL→1PASS/54SKIP, 최종 FE type/lint/build exit0이다. 전체 BE/FE/core/기존 저장·게시 회귀는 반복하지 않았다. UI 코드 갱신으로 편집 이력이 초기화돼 조건 제안만1회 다시 요청하여 수정된 Undo를 재검증했고 설명/조회 정상 조건은 반복하지 않았다.

### 모델·문서·화면 검증

기존 AI SDK→Codex CLI 실제7호출은 요청 모델 모두 `gpt-6-luna`, 종료0이다. 설명3회(최초/부재 보완/일반 언어), 조회2회(최초/단위 보완), 조건2회(최초/이력 수정 재검사)로 나뉘며 성공 사례7개로 세지 않는다. 요청 모델명은 실행 인자로 확인했으며 upstream이 실제 사용한 모델의 별도 attestation은 없다. 모델 변경/로컬 LLM·수동 SQL 결과 대체·가짜 모델 응답 주입0이다. 계측 preload는 child_process의 Codex 명령 모델명·종료 상태만 기록하고 요청/응답을 수정하지 않는다.

최종 설명→조회→조건 제안의 요청 document는 동일했다. ask2종의 operations는0이고 조건 제안은 setConditions 한 개다. 실제 execution의 CONDITION_REVIEW_REQUIRED는 검토 대기이며 자동 적용/저장이 아니다. 검토 중 기존 캔버스2000/5·저장본·질문을 유지하고 현재/제안 조건·3블록 전체 preview1200/25/1점 추세를 표시했다.768→390→1440 전환에서도 같은 검토/질문이 보존되고 문서 넘침0이었다. 준비한 Pivot 제외를 제품 지원 확장으로 집계하지 않는다.

390px에서 Tab/Shift+Tab으로 적용/유지를 이동하고 Enter로 명시 적용했다. 적용 후 모달 컨테이너 초점에서도 Tab 조작이 가능했고 Escape는 AI 열기로 복귀했다. 수정 후 Undo/Redo는 Enter만으로 반대 활성 버튼에 초점을 보존했다. 마지막 Undo의 요청 document는 최초와 정확히 같고 저장 상태/이력0·2000USD/5%로 복구됐다. 마지막390/768/1440도 넘침0이며 실휴대폰/전체 키보드·VoiceOver 통과가 아니다.

관측한 POST는 executions와preview뿐이고 save/게시0이다. 실행 이력/멱등 기록의 정상 쓰기와 산출물 쓰기0을 구별한다. 준비 후10개 선택 표(database/metric/dashboard/dashboard_widget/studio_state/studio_publication/studio_publication_request/studio_remix_request/source_condition_entry/source_catalog_entry)의 전체 행/count/hash가 종료 준비 전까지 불변이었다. 이후 준비용 Studio32 문서와 임시 암호만 명시 원복했다. 전체 DB/모든 writer 불변으로 확대하지 않는다.

### 증빙·종료와 남은 범위

증빙 root는 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-conversation-20261021/`이다. `input.csv`/`oracle.json`, 최초/최종 설명·조회 JSON과 캡처, `condition-review.json`/`review-layout.json`, `apply-keyboard.json`/`history-final.json`/`traffic-final.json`, `db-before.json`/`db-after.json`, `codex-calls.jsonl`, red/green·type/lint/build 로그와 `cleanup.json`을 따른다.

[모바일 검토](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-conversation-20261021/review-390.png) · [단위 보완 조회](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-conversation-20261021/query-after-1440.png) · [조건 적용390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-conversation-20261021/applied-final-390.png) · [Undo 안내/가시 초점](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-conversation-20261021/undo-focus-final-390.png).

Ego54는 keep[] 종료, 최종 API51305/웹1053과 이전 이번 API PID는 종료했다. VoiceOver BLOCKED 유지/OS 권한 변경0, Ego 업데이트는 적용하지 않았다. 최초 미커밋4파일은752c043f로 drumcap commit/push 완료하며 이번 수정·검증 기록은 그 이후 diff다. **unknown/type/no-op/stale의 실제 모델·연속 화면 변형, 복합 부정 지원 계약, 이번 MySQL·목표 규모/운영·실휴대폰/전체 스크린리더·업무/전체FR020·16개 수용은 잔여**다. 기존 단일 날짜의 저장/reload PASS를 반복하거나 이번 실행으로 전체 수용을 올리지 않는다.

## 오류·늦은 응답 후속 — 2026-10-21 / Ego55

기준 `81cfae8c`(앞선8파일 drumcap commit/push 완료). AI-COND-UI-01~04의 정상 설명/조회/검토/적용/Undo 결과는 재사용한다. 새 격리 SQLite 복사본의 같은 합성 source32/일반3블록만 사용하며 원본 DB와 Pivot 지원 계약은 바꾸지 않는다. 실제 AI SDK→Codex CLI의 요청 모델은 gpt-6-luna로 고정한다. VoiceOver BLOCKED 유지.

| ID            | 새 입력·기대                                                                                                | 상태                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| AI-COND-UI-05 | 존재하지 않는 native 열의 조건 요청. 명확화/미지원 또는 검증 거절, 연산/적용/저장0·원질문/초안 보존         | 최초 질문 유실 후 수정 PASS_SELECTED. 실제 clarify/0연산·질문 유지/이력0.                      |
| AI-COND-UI-06 | 숫자 열에 부적합한 문자열 조건 요청. 추측 변환 없이 명확화/미지원 또는 거절·원질문/초안/저장본 보존         | PASS_SELECTED. revenue > banana 요청은 MODEL_FAILED/미리보기 대기·원질문/이력0/저장본 보존.    |
| AI-COND-UI-07 | 이미 없는 추가 포함·제외 조건을 다시 해제 요청. 불필요한 변경/이력/저장 없이 설명/명확화 또는 거절          | PASS_SELECTED. 중복 해제 요청은 MODEL_FAILED/미리보기 대기·질문/기간/회사필터/이력0 보존.      |
| AI-COND-UI-08 | 실제 조건 응답 대기 중 캔버스 편집 기준 변경. 늦은 응답의 자동 적용/검토 적용 차단·새 초안/질문/저장본 보존 | PASS_SELECTED. 실제 Compute 제안 도착 전 추세 이동/선택 변경→stale 안내·검토0/이력1/질문 유지. |
| AI-COND-UI-09 | 실제 조건 검토 표시 후 로컬 편집. 기존 변경안 적용 비활성·키보드/모바일에서 현재 초안 보존                  | PASS_SELECTED. 검토 후 추세 이동→적용 disabled/이력2·3폭 보존·키보드 유지/닫기.                |

시험용 응답 게이트는 실제 모델 호출이 끝난 반환값을 변경 없이 최대60초 보류한다. 정상 응답/모델 출력 주입은 하지 않는다. 대표390/768/1440px의 오류·stale 안내/입력/포커스·넘침을 관찰하며 실제 휴대폰/전체 스크린리더·이번 MySQL/운영·전체16개 수용으로 확대하지 않는다.

### 발견 오류·수정과 경계

없는 열 missing_region=Seoul 요청의 실제 모델은 clarify/operations0을 반환했지만, 실행 status=succeeded만 확인한 FE onFinish가 질문을 지웠다. 실패 화면을 보존한 후 StudioConversation에서 clarify/unsupported는 입력을 유지하도록 수정했다. 일반 ask·완료 저장의 입력 초기화와 새로운 질문을 보호하는 기존 동일 문자열 검사는 유지한다. 실제 같은 요청 재검사에서 clarify/원질문/이력0·검토0을 확인했다. 기능 추가/자동 재요청/서버 저장 변경은 없다.

숫자 열 revenue > 문자열 banana와 이미 없는 조건 중복 해제는 실제 CLI 종료0 후 proposeSemantics의 MODEL_FAILED로 거절됐고 preview/apply는 pending이었다. 원질문·초안·저장본을 유지했으며 입력을 수치로 추측해 적용하지 않았다. 모델 원문을 보관하지 않았으므로 **특정 type compiler/no-op digest 분기 때문이라고 단정하지 않는다**. 기존 하위 검증을 재사용하며 새 실제 화면은 두 사용자 입력의 안전 거절 범위다. 상세 오류 원인의 친절한 안내는 generic 단계 실패 수준이라는 UX 한계가 남는다.

시험 게이트는 실제 callLlm 완료 뒤 반환값을 변경 없이 보류했다. 보류 중 추세 핸들의 ArrowDown으로 lg y2→3/선택 변경(이력1)을 만든 뒤 해제하자 실제 edit/setConditions1 응답을 적용하지 않고 stale 안내만 표시했다. 현재 문맥으로 다시 받은 검토는 처음 적용 가능했으나 추가 ArrowDown(y3→4/이력2) 뒤 적용 불가로 바뀌었다. 두 경우 모두 조건은 미적용/캔버스2000USD·5%/질문 유지다. 파일 교체·서버 저장 revision·권한 회수 등 다른 stale 축 전체를 검증한 것은 아니다.

390/768/1440px에서 검토·비활성 적용/차단 문구·질문·이력2와 가로 넘침0을 확인했다. 적용/유지 버튼36px·모바일 입력16px·데스크톱14px이며 표 버튼32px은 기존 토큰이다. Shift+Tab/Tab은 비활성 적용을 건너뛰어 데이터 표 보기↔현재 조건 유지로 이동했다.390px Enter 유지 후 검토만 닫히고 이력2/질문 유지·추가 POST0, Escape는 AI 열기로 초점을 복구했다. 실제 캡처로 안내/버튼/입력 잘림 여부를 확인했다. 실휴대폰/전체 접근성 PASS로 확대하지 않는다.

### 실행·증빙과 잔여

FE 새 hook 회귀(clarify/unsupported/ask)는2FAIL/1PASS 후 수정했다. 최종 선택은 새3조건+인접 완료 저장 계약1개 **4PASS/16SKIP**, FE type/lint/build exit0이다. BE 제품 변경0/기존 선택검사 재사용·전체/core/기존 정상4조건 반복0이다. HMR 뒤 실패했던 없는 열 조건만 다시 호출했다.

실제 AI SDK→Codex CLI는6호출(없는 열 최초/수정 재검사2·부적합 값1·중복 해제1·stale2), 요청 모델명 모두 gpt-6-luna/종료0이다. 요청 인자 확인이며 upstream 실제 모델 attestation은 아니다. 서버/모델 응답 대체·로컬 LLM 변경0이다. 최종 관측 POST6개 모두 executions이며 save/게시 POST0, 처음5요청의 document 동일·6번째는 명시 편집한 y3/버전1이었다. 정상 실행 이력 쓰기와 산출물 저장0을 구분한다. 준비 후 선택10표 전체 행/count/hash 불변을 확인했다.

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-errors-20261021/`의 summary/unknown-before·after/type-error/noop/stale-response/stale-review/responsive-keyboard/dismiss-keyboard/traffic-final/db-before·after/codex-calls와 red/green/type/lint/build 로그다. 최초 없는 열 캡처는 실제1800px로 이름을 정정했고 나머지는 파일명 폭을 세션 안에서 설정했다. 테스트 게이트 소스도 보존했다.

[오류 안내390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-errors-20261021/type-error-390.png) · [늦은 응답 차단1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-errors-20261021/stale-response-1440.png) · [검토 후 변경390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/ai-condition-errors-20261021/stale-review-390.png).

Ego55 keep[] 종료·이번 API52029/웹52030만 종료·격리 준비 전 Studio32 문서 bytes 복구·원본 DB 변경0·인증정보 탐색/변경0이다. Ego 업데이트는 적용하지 않았다. 이번 발견 수정/기록은81cfae8c 이후 미커밋이다. **복합 부정 의도 지원 계약·중첩 조건/오류 조합·다른 stale 축·친절한 상세 실패 안내·이번 MySQL/목표 규모/운영/실기기/업무·전체16개 수용은 잔여**이며 VoiceOver BLOCKED를 유지한다.
