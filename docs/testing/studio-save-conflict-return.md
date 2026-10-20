# Studio 저장409 후 보관 초안 복귀

Status: Draft · UC047/P3/FR009 · TC047 · PASS_SELECTED.

## 계획과 변경

[UC047 계획](../plans/UC-047.md)의409 후속이다. [확정 후 조회 복구](studio-confirmed-read-recovery.md) 다음 선택 검증으로, 실제 저장409를 받은 요청의 기록을 보존하고 명시 초안 복귀→UC046 최신 비교/동의/미리보기→새 명시 저장까지 연결한다.

제품 소스는fde87ab3 그대로다. 기존409 회귀에서 명시 복귀 전 정확한 요청/문서/질문 보존·자동 복귀/GET0을 추가 검증했다. 새 기능·DB·의존성 변경은 없다.

## Ego95 실제 실행 · 2026-10-17

기존3698/4898/4899와 비공개46/source34의 공개 합성 자료를 사용했다. 별도4901 응답기는 표식 저장 한 건만 서버 전달 전503으로 중단했다.409는 조작하지 않고 다른 탭의 실제 저장으로 발생시켰다. 응답기는 종료하고 정상 실행 환경을 유지했다. 토큰은 기록하지 않았다.

1. 첫 탭에서 첫 블록을 `UC047 내 초안 환불률`로 수정하고 미전송 질문을 입력했다. 저장 미전달503 후 서버 무변경·요청/문서/질문3개 기록 보존을 확인하고 reload했다.
2. 같은 Ego 공간의 둘째 탭에서 첫 제목을 `UC047 다른 탭 환불률`, 비대상 총매출 제목을 `UC047 최신 총매출 유지`로 바꿔 실제 저장201을 확인했다.
3. 첫 탭에서 정확히 같은 보관 요청을 명시 재확인해 정상 서버409를 받았다. 서버 전체 API 응답 불변·보관3개 원문 불변·거절된 요청 영수증0이다.
4. `보관 초안으로 돌아가기`를 명시 실행했다. pending marker만 제거하고 원문 문서/질문은 보존했다. 권한 있는 최신 GET 한 건으로 편집기에 돌아왔고 자동 저장/AI/게시0이었다.
5. `최신본과 초안 비교`의 GET 후 같은 제목의 최신값/내 초안값을 보여줬다. `충돌 항목에 내 초안 사용`에 명시 동의하고 병합 미리보기POST201을 실행했다. 최신 revision을 기준으로 전체 문서를 검증했고 이때까지 서버 내용은 그대로였다.
6. 질문 복구 후 실제 입력 원문이 같았다. 명시 저장201은 기존 거절 요청과 다른 새 requestId/최신 revision으로 실행됐다. 내 첫 제목과 다른 탭의 비대상 총매출 제목을 함께 보존했다. 전체 영수증은21→22로 명시 최종 저장1건만 추가됐고 거절 요청 영수증은 계속0이다.
7. 저장본 reload는 GET만이며 같은 문서/revision/3블록을 반환했다. 원본45 전체 응답·기존 ID/계산SQL/lg·md·xs 배치를 보존했다. 검증한 두 제목은 정상 UI 저장으로 원복하고 별도 보관 질문은 `보관 질문 폐기`를 명시 실행해 정리했다. 정상 원복은 새 revision을 만든다.46은 비공개/게시0이다.

## 화면·검사·한계

- 409/비교/병합 화면390/768/1440px 실측 넘침0.409 두 버튼32px와 실제 캡처의 간격/줄바꿈·비교값/체크박스·오류 구분을 확인했다. 실휴대폰 검증이 아니다.
- 관련 FE3파일16테스트·타입·변경 lint PASS. 제품 코드 불변이므로fde87ab3 FE build 결과를 재사용한다. 이번 실행에서 전체 테스트/build를 재실행했다고 표현하지 않는다.
- 실제 요청/기록/서버/영수증/병합/질문/원복/UI52개 대조 PASS. 최초 원복 검사에서 별도 보관 질문이 남아 있음을 확인하고 정상 명시 폐기로 정리했다. 새 입력을 비워도 별도 보관 질문을 자동 폐기하지 않는 기존 계약을 유지했다.
- 계산/집계·차트 변경이 없어 새 Rill 실행은 반복하지 않았다. 같은 공개 합성 자료의10%/일별10%/총매출300 계산 정의를 보존했다.
- AIWF strict 기존12 errors/33 warnings/4 infos로 실패 유지. pin/check는 지문 일치이며 packet은 awaiting_review/acceptance not_recorded다. 별도 독립 리뷰·전체TC005/고객 승인이 아니다.
- 409 직후 재reload/반복경합·source 교체/삭제 경계 전체·운영 MySQL·실휴대폰·제품 전체 수용은 Open이다. 기존 UC046 회귀/이전 실검증 범위와 구분한다.

증빙 `/tmp/vm-uc047-conflict/`: `before/after-{45,46}.json`, `undelivered/undelivered-server.json`, `fault-events.jsonl`, `storage-undelivered/conflict/returned/preview.json`, `other-tab-save.json`, `latest-before-conflict/server-after-conflict/server-before-final-save.json`, `conflict/return-to-draft/compare/comparison-text.json`, `merged-preview/final-save/merged-saved/reloaded.json`, `reload-saved-audit.json`, `question/final-state.json`, `db-before-conflict/after-recovery.json`, `conflict/comparison/merged-{390,768,1440}.png/json`, `assert.py/assertions.json`, `unit/type/lint/strict.log`. `/tmp`는 로컬 실행 증빙이다.
