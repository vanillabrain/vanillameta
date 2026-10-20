# UC031 Studio 생성 저장 응답 유실 확인 — 2026-10-16

기준 develop-v2 `8e41a456`+테스트/문서 변경. [UC031](../use_cases/UC-031-confirm-studio-creation.md)·[설계](../architecture/confirm-studio-creation.md)·[계획](../plans/UC-031.md)·[TC031](../test_cases/TC-031-confirm-studio-creation.md)·[리뷰](../architecture/UC-031-review.md). Ego71 하나, 기존 FE3698/API4899→4898/SQLite·공개 Rill source30을 유지했다. 실행 증빙은 저장소 밖 `/tmp/vm-uc031/`다.

## 설계·실행

Studio T15의 실제 새 생성 저장 응답 유실 미검증을 P3 전체 여정의 다음 단위로 골랐다. UC/설계/TC/계획을 먼저 작성하고 별도 명세 대조·strict/pin을 수행했다. 기존 StudioCreate의 saveUncertain·동일 creation ref와 서버 createOnce 영수증을 검증했으며 제품 오류가 발견되지 않아 제품 코드는 변경하지 않았다.

1. 기존 내 소스30에서 실제 Codex 생성 질문을 실행했다. 고정 `gpt-6-luna` 호출 경로를 사용하며 다른 모델/로컬LLM으로 대체하지 않았다. 첫 질문은 없는 `device_os`를 명시해 소스의 `my_os`/`device_osv` 중 기준을 확인하라는 읽기 전용 안내로 멈췄다. 실제 소스의 `my_os`로 질문을 교정했다. 초기 요청은 관찰 훅이 완료 후 설치돼 응답 본문을 확보하지 못했고 UI 안내/원문만 남겼다. 교정 요청부터 전체 요청/응답을 기록했다.
2. 질문 “대시보드 제목은 UC031 저장 복구 검증. 전체 기간 SUM(my_requests) 총 요청 수 숫자 KPI와 my_os별 SUM(my_requests) 막대 차트 두 블록을 만들어 줘. 정확한 정수로 표시해 줘. 아직 저장하거나 게시하지 마.”에 실제 제안201/전체 미리보기를 받았다. 제안 `2619ee8a-7c62-4095-a0e9-06dda2d1beee`, sourceRevision `5dd4ae8537fc2ae0b5c23c68d983ea117bcbfe112c5573c7c7fdb929d19ca3b1`이다. 미리보기 전후 dashboard35/metric20/studio_run0/studio_state0/publication 개수 동일, 저장0이다.
3. 사용자가 보는 저장 버튼을 클릭했다. 테스트 XHR 표식은 정확한 POST `/v1/studio/dashboards?uc031=1`에만 붙였다. 임시 로컬 프록시는 이를 실제 서버에 전달해 정상201과 document/dashboardId36을 받은 뒤, 한 번만503으로 치환했다. 네트워크 연결 자체를 끊은 것이 아니라 **커밋 후 응답 본문 유실을503으로 모델링**한 실제 화면 검증이다. 제품 fault switch/DB 직접 쓰기는 없다.
4. 화면은 “저장 완료 여부를 확인하지 못했습니다”와 “같은 저장 요청 확인”을 표시했다. 원 질문·634,513,000/OS미리보기는 유지되고 화면의 소스 선택·파일/샘플 버튼·새 제안·후속 수정은 비활성이다. 숨겨진 file input 자체와 데이터 표 보기는 비활성 대상이 아니므로 전체 DOM 입력 잠금이라고 확대하지 않는다. 이때 DB에는 dashboard36/metric22/studio_run1/studio_state1이 이미 존재했다.
5. 같은 저장 요청 확인 버튼을 클릭해 서버201/같은 dashboardId36으로 이동했다. 요청 `7ba5abe6-d796-4bd4-acef-7f82fb15ca92`의 requestId/proposalId/expectedSourceRevision 본문3개 필드가 첫 요청과 정확히 같고 응답 document/idMap도 같았다. 같은 저장을 재확인한 뒤 DB 개수는 더 늘지 않았다. 원 제안 캐시 소비 뒤에도 영수증 replay가 먼저 실행되는 기존 계약이다.
6. 테스트 프록시를 정확한 PID/명령 확인 후 종료하고 기존 정상4899프록시를 복원했다. `/dashboard/36/studio`의 저장됨·0회변경·두 블록과 실제 reload를 확인했다. 새 문서의 GET userinfo/Studio 조회 외 생성/AI/게시 POST0이다. saved/reloaded의 document/sourceRevision/definitions는 일치하고 원본35 저장/Studio/게시 SHA-256도 유지됐다.
7. 별도 DuckDB 연결로 `/tmp/vm-tc005/recipient-missing.parquet`을 읽은 독립 oracle는1,391,572행·SUM634,513,000·OS28그룹이다. 초기 preview와 saved/reloaded preview의 총계 및28개 차원/값 전체가 일치했다. 같은 값의 HarmonyOS/WIndows NT 두 행은 동률 SQL정렬로 순서가 바뀌어 차원/값 집합으로 비교했다. 동률 순서 보장이나 모든 차트 정렬 PASS로 보고하지 않는다.
8. 대시보드36은 shareYn=N/shareToken없음·Studio게시0이며 새 공개 링크를 만들지 않았다. dashboard 증가1/영수증 증가1/지표 증가2/Studio상태 증가1, 게시 개수 불변이다. 두 제안의 지표정의가 별개여서 이번에는 지표2개가 생성됐으며 자동지표통합을 주장하지 않는다. 검증용 비공개36은 보존하고 서버는 유지했다.

`baseline/preview/committed/replay/final`, `proposal-events`, `proxy-events.jsonl`, `uncertain-*`, `confirm-events`, `saved/reloaded-state`, `reload-audit-final`, `oracle.cjs/json`, `assertions.py/json`이 근거다. 브라우저는 로그인 세션이며 타계정/익명 접근은 새로 실행하지 않았다.

## 디자인·회귀

기능 PASS_SELECTED_VARIANTS / 대표 디자인 PASS_SELECTED. 불명확 오류/재확인 하단과 저장 Studio를390/768/1440 CSS폭에서 캡처·실측해 넘침0을 확인했다.390px 오류 하단/저장 화면 캡처를 직접 확인했으며 기존36px 생성컨트롤·96px 수정입력·Studio32px 도구/44px select의 역할별 크기·정렬과 정확 정수의 한 줄 표시를 유지한다. UI/CSS 변경0, 전체 스크린리더/색대비 통과로 확대하지 않는다.

기존 FE 회귀에 질문/미리보기 보존·소스/생성/수정 잠금·자동 추가 저장 없음·초기 요청 본문 사본과 정확3필드 재사용을 보강했다. 관련 FE9개 및 BE 생성/영수증/권한46개 PASS, FE type·변경lint 오류/경고0·diffcheck PASS다. 최초lint의 줄바꿈 오류는 formatter로 수정 후 해당lint만 재검증했다. 동작 불변인 같은 제품 코드의 직전 UC030 전체BE2045/FE1306·루트build/core8 결과를 재사용하며 이번에 새 전체실행으로 집계하지 않는다.

Main이 작성 후 별도 코드/명세/증빙 대조를 수행했다. 독립 리뷰/사람 승인으로 표기하지 않고 문서는Draft·packet awaiting_review/acceptance not_recorded다. entity/glossary/영구DB/설치·배포설정은 바뀌지 않아 기존 Studio 영수증 모델을 유지한다. AIWF strict 기존12오류/33경고/4정보는 남기고 기준선을 수용하지 않는다. pin/check는 문서 일치 증거다.

## 남은 경계

불명확 상태 **자체를 새로고침할 때** standalone StudioCreate의 메모리 request ref 복구는 이번 검증에 포함되지 않았다. 이 실행은 유실→같은 화면 재확인→저장본reload다. 저장 미전달·타계정/요청바인딩·권한 회수/실제만료는 기존 BE/FE 회귀 범위와 구분한다. 실휴대폰/운영MySQL·전체오프라인/모든경합·VoiceOver/전체키보드·사람제품수용은 미확인이다. 새 Rill UI 비교는 수행하지 않고 같은 공개파일의 수치만 독립 검증했다.

후속 [UC032](recover-studio-creation.md)에서 같은 로그인/탭의 불명확상태 reload→최소요청/질문복구→명시동일저장확인을 추가 검증했다. 위 UC031의 미포함 설명은 당시 범위이며 전체초안/다른탭복구까지 확대하지 않는다.
