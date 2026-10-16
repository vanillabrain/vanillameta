# UC032 Studio 저장 확인 reload 복구 — 2026-10-16

기준 develop-v2 `05deed96`+이번 변경. [UC032](../use_cases/UC-032-recover-studio-creation.md)·[설계](../architecture/recover-studio-creation.md)·[계획](../plans/UC-032.md)·[TC032](../test_cases/TC-032-recover-studio-creation.md)·[리뷰](../architecture/UC-032-review.md). Ego72 하나·기존 FE3698/API4899→4898/SQLite·공개 Rill source30을 유지했다. 실행 증빙은 저장소 밖 `/tmp/vm-uc032/`다.

## 설계·변경

UC031의 메모리 ref는 reload 때 사라지므로 같은 로그인/탭의 최소 확인 기록을 먼저 설계했다. `studioCreationRecovery`는 version/time/sourceId/title/prompt/request3필드만24h/8KiB 범위로 보관한다. 생성된SQL·미리보기·원본행·token/cookie는 보관하지 않는다. 사용자가 입력한 질문의 계산식 문장은 그대로 보관될 수 있다.

기존 editorDraftKey(token,1)에 suffix를 붙여 안정 authscope·정상refresh·logout prefix정리를 재사용한다.1은 namespace 계산용이며 대시보드1 본문을 읽거나 쓰지 않는다. 서버/영구DB/의존성/LLM/컴파일러는 변경하지 않았고 entity/glossary는 기존 Studio 영수증 모델을 유지한다. 새 탭 임시 envelope의 계약은 UC032에 기록했다.

저장 전에 기록이 써져야 POST하며 실패하면 입력/미리보기를 유지하고 저장을 시작하지 않았다고 알린다. reload는 권한있는 소스 목록 조회 후 확인 카드만 표시한다. preview/cache GET/AI/저장 자동 재실행0이다. 명시 같은요청 확인은 기존POST·서버영수증을 재사용하며 성공/명시폐기 때 해당 기록만 지운다. 실패/권한변경은 저장되지 않았다고 단정하지 않는다. 권한없는소스 기록은 제목/질문을 숨기고 폐기만 제공한다. 초기조회실패도 새 생성이 이전기록을 덮지 못하게 잠그고 명시 reload 재조회를 제공한다.

## 실제 Ego 주 여정

1. 기존 소스30(1,391,572행)에서 지정 Codex `gpt-6-luna`로 질문했다. “대시보드 제목은 UC032 새로고침 저장 복구. 전체 기간 SUM(my_requests) 총 요청 수 숫자 KPI와 my_os별 SUM(my_requests) 막대 차트 두 블록을 만들어 줘. 정확한 정수로 표시해 줘. 아직 저장하거나 게시하지 마.”다. 준비 중 HMR이 완료된 제안을 초기화해 최종 코드에서 한 번 다시 제안했다. 두 실제201을 한 모델 호출로 합산하지 않는다. 제안 전후DB dashboard36/metric22/studio_run1/studio_state1·게시 개수 불변이다.
2. 최종 미리보기의 숫자634,513,000과 OS28그룹을 확인하고 저장 버튼을 클릭했다. 정확한 표식 POST `/v1/studio/dashboards?uc032=1`만 임시프록시가 서버로 전달한 뒤 실제commit201을503으로 한 번 치환했다. 물리 네트워크 단절이 아니라 커밋후응답유실을503으로 모델링했다. 제품fault switch/DB직접쓰기0이다.
3. 불명확 상태에서 기록은 원requestId/proposalId/sourceRevision과 source30/제목/질문만 포함했다. 실제 reload→GET sources/userinfo 뒤 복구 카드가 나왔고 기록 전체와 질문이 동일했다. `recovery-final-audit`에는 GET만 있으며 proposal GET/모델/저장POST0이다. 원제안 캐시가 저장 시 소비돼도 재생성하지 않는다.
4. 카드390/768/1440을 캡처한 뒤 정확한 임시프록시를 종료하고 기존 정상4899를 복원했다. 같은 저장 요청 확인을 클릭해 동일3필드 POST201/원래dashboard37/document/idMap으로 열었다. 재확인 전후DB는 dashboard37/metric22/studio_run2/studio_state2로 동일했다. 새생성은 dashboard/영수증/Studio상태각1이며 기존지표를 재사용해 지표증가0·게시증가0이다.
5. 저장됨·0회변경·두블록을 실제 화면에서 확인하고 reload했다. document/sourceRevision/definitions는 일치하고 새 문서GET외쓰기0이다. 성공 후 확인key0이며 새 생성 화면의 소스 로드 완료 뒤 재진입해도 복구안내 없음/질문빈값을 확인했다.
6. 독립 DuckDB로 `/tmp/vm-tc005/recipient-missing.parquet`을 읽어1,391,572행·SUM634,513,000·OS28개 차원/값 전체를 saved/reloaded preview와 대조했다. 동률은 차원/값 집합으로 비교하며 순서불변을 보장하지 않는다. 원본35의 dashboard/Studio/게시 SHA-256은 동일했다.37은 shareYn=N·게시0인 비공개 검증본으로 보존했다.

## 초기 조회 실패 후속

같은 실제 영수증37의 확인 메타데이터를 테스트 탭에 재주입했다. 새 pending save를 만든 것으로 집계하지 않는다. GET `/bi/sources`에503을 정확1회 주입→기록동일·질문비노출·파일/샘플/질문입력잠금·390px오류 캡처를 확인했다.503의 근거는 proxy 이벤트이며 상태 렌더 직후 캡처한 XHR audit에는 마지막 loadend가 아직 없었다. 정상프록시복원→실제 다시불러오기버튼(reload)→권한GET/같은기록복구→명시POST/기존37을 확인했다. 추가 dashboard/journal/metric/publication0·최종기록0이다.

`baseline/preview/committed/confirmed/final`, `proposal/uncertain/confirmation-events`, `uncertain/recovered-state`, `recovery-final-audit`, `saved/reloaded-state`, `creation-after-success`, `initial-lookup-failure`, `lookup-retry-*`, `final-cleanup`, `oracle`, `assertions.py/json`이 근거다. 테스트 프록시는 모두 종료했고 정상서버를 유지했다. 새공개링크/타계정변경요청은 실행하지 않았다.

## 디자인·검사

기능 PASS_SELECTED_VARIANTS / 대표 디자인 PASS_SELECTED. 새 복구카드와 저장Studio390/768/1440 CSS폭 넘침0·실제 캡처를 확인했다. 새카드 버튼36px/글자14px·동일폭,390px 두버튼 한열/1440px 같은행 정렬을 실측하고390/1440 캡처를 직접 검토했다. 긴질문줄바꿈·기존 헤더/목록버튼/상하간격도 확인했다. 초기조회실패의 재조회버튼이 다음패널에 붙던 간격은 기존액션행 클래스로22px를 확보했다. 같은503을1회 더 주입해 최종390/768/1440 넘침0·간격을 재검증했고 같은37 영수증으로 정리했다. 전역CSS나화면별높이덮어쓰기0이다.

- 최종 관련24개 PASS(Create15/helper9). 무변경·취소·후속제안·미리보기 유지의 기존 회귀도 포함한다. 기록 TTL/형식/크기·같은token새로그인격리/정상refresh·logout·저장소실패·remountPOST0·동일본문/성공정리·명시폐기·권한없는소스/새로그인·초기조회실패 잠금을 검증했다.
- 첫 회귀의 임의 randomUUID fixture가 기존 authscope 형식 검증에 걸려 유효UUID로 수정했다. malformed JSON정리를 보완했고, 초기 복구조회 동안 새소스를 먼저 선택하던 기존 테스트는 준비완료전잠금/완료후선택으로 바꿔 조기대기기록 덮어쓰기를 막았다. lint의증가연산자/미사용catch인자는 제거했다.
- 최종 루트BE116파일2045개·FE91파일1321개·루트BE/FE build PASS(`root-test-final/root-build-final.log`), FEtype/변경lint PASS. 마지막미사용catch인자제거/액션행여백은 동작불변 문법·표시정리이며 해당24개/실제오류UI와 최종FE build를 별도로 재검증했다.
- 핵심8개 PASS(`core.log`, `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-FnPdP1/evidence/playwright-001.log`). 초기조회실패 보완 전 동일한 정상경로 결과를 재사용하고 최종 오류경로는 Ego/전체FE로 검증했다.

Main이 작성 후 별도 코드/명세/증빙 대조를 수행했다. 독립리뷰/사람승인이 아니며 문서Draft·packet awaiting_review/acceptance not_recorded다. AIWF strict 기존오류는 기준선수용과 구분하고 pin/check는 문서일치만 증명한다.

## 미확인

실휴대폰·탭종료/다중pending요청·권한회수/인증갱신의모든경합·운영MySQL/전체부하·VoiceOver/전체키보드·사람제품수용은 미확인이다.24시간만료·저장소quota·일부새로그인/거절은 하위회귀이며 실제장애는commit후503/reload와초기sources503 변형이다. 새live Rill UI비교는 하지 않고 같은공개데이터 수치만 독립검증했다.
