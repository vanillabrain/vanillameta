# Studio 저장 확정 후 최신 조회 실패와 새로고침 복구

Status: Draft · UC047/P3/FR009 · TC047 · PASS_SELECTED.

## 계약과 변경

[UC047 계획](../plans/UC-047.md)의 확정 후 GET 실패/reload 후속이며 [신규 ID 복구](studio-save-new-block-recovery.md) 다음 선택 검증이다. 저장 결과를 확인한 다음 최신 GET이 실패하면 confirmed 기록과 문서·질문을 유지한다. reload 후 권한 GET을 거쳐 명시 최신 조회만 제공하고 저장/AI/게시를 자동 실행하지 않는다.

`StudioSaveRecovery`의 confirmed 안내를 실제 동작에 맞게 “저장을 다시 실행하지 않고 현재 최신 저장본만 조회합니다”로 바꿨다. pending 상태의 미전달 저장 가능성 설명은 유지한다. 재마운트 시 confirmed 보존·자동 요청0·명시 GET만·질문 유지/확정 정리를 회귀1개로 보강했다. 저장 프로토콜·BE·DB·의존성은 변경하지 않았다.

## Ego94 실제 실행 · 2026-10-17

기존 FE3698/API4898/정상 proxy4899를 유지하고 비공개46/source34의 공개 합성 자료를 사용했다. 별도4901 응답기는 표식 저장 한 건의 실제commit201 후503을 반환하고, 다음 명시 확인의 후속 GET 한 건만503을 반환했다. 기존 서버는 유지하고 검증 응답기는 종료했다. 토큰은 기록하지 않았다.

| 단계                          | 실제 결과                                                                                                |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| 첫 블록 제목/미전송 질문→저장 | 실제201 commit 후 브라우저503·초안/요청/질문 보존                                                        |
| reload→명시 같은 저장 확인    | reload는 권한/Studio GET만, 원 요청과 정확히 같은POST201/동일 영수증                                     |
| 후속 최신 GET 실패            | 실제503 한 건·confirmed 기록/문서/질문 유지·조회 버튼/오류 안내                                          |
| 실패 상태에서 reload          | 권한/Studio GET만·세 기록 원문 동일·저장 확정/조회만 안내·자동POST0                                      |
| 명시 최신 저장본 다시 조회    | GET200 한 건만·현재 저장본 진입·문서/요청 키 정리·질문 보존                                              |
| 질문 명시 복구/저장본reload   | 실제 입력 원문 동일·GET만·동일 문서/revision/3블록/모든폭배치                                            |
| 중복 방지                     | 전체46 영수증19/해당 요청1로 commit후와 복구후 동일, 추가 저장 revision0                                 |
| 원복                          | 정상 UI 저장으로 첫 블록 제목 원복·질문 정리/reload·기존 문서/정의/ID/배치 보존, 정상 원복은 새 revision |
| 경계                          | 원본45 전체API응답 불변·46 비공개/게시0                                                                  |

## 화면·검사·한계

오류/confirmed reload/복구 편집 화면에서390/768/1440px 실측 넘침0이다. 확인 버튼32px를 유지하고 실제 캡처에서 제목/설명 줄바꿈·좌우 간격·오류와 버튼 구분을 확인했다. 모바일은 Chromium 폭 검증이며 실휴대폰 검증이 아니다. 기존 UI Kit의 Notice/버튼을 유지했다.

관련 FE2파일10테스트·타입·변경 lint·FE build PASS. 실제 요청/확정기록/reload/영수증/문서/질문/UI/원복43개 대조 PASS. 계산식/집계·차트는 변경하지 않았고 새로운 Rill 실행은 반복하지 않았다. 원본 합성 자료10%/일별10%/총매출300의 계산 정의를 보존했다.

AIWF strict는 기존12 errors/33 warnings/4 infos로 실패 상태 유지, pin/check는 일치 확인이며 packet은 awaiting_review/acceptance not_recorded다. 별도 독립 리뷰/고객 승인 또는 전체TC005 수용이 아니다.409 초안 복귀 실제 화면·반복 장애/인증 전환 전체·운영 MySQL·실휴대폰·사람 제품 수용은 Open이다.

증빙 `/tmp/vm-uc047-read/`: `before/after-{45,46}.json`, `lost-response.json`, `fault.cjs/json`, `fault-events.jsonl`, `committed.json`, `confirm-read-failed.json`, `storage-confirmed/confirmed-reload/recovered.json`, `reload-pending/confirmed/recovered-audit.json`, `read-retry.json`, `recovered/reloaded.json`, `question/final-state.json`, `db-committed/recovered.json`, `read-error/confirmed-reload/recovered-{390,768,1440}.png/json`, `assert.py/assertions.json`, `unit/type/lint/build/strict.log`. `/tmp`는 로컬 실행 증빙이며 영구 배포 산출물이 아니다.
