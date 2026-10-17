# Studio 저장 응답 유실 후 새로고침 복구

Status: Draft · UC047/P3 · TC047 · PASS_SELECTED.

## 설계와 변경

[사전 계획](../plans/UC-047.md)·[Use Case](../use_cases/UC-047-recover-studio-save.md)의 요청 보관/동일 확인/최신 조회 계약이다. 기존 저장 영수증 replay/CAS를 사용하며 BE/DB 변경·새 의존성은 없다.

최초 전송 전에 기존 인증 scope의 탭 저장소에 SQL 없는 v2 문서와 정확한 저장 요청을 보관한다. 요청/문서 합계256KiB·24h이며 SQL/catalog/결과/토큰은 추가 저장하지 않는다. 보관 실패는 전송하지 않고 현재 편집을 유지한다. pending→confirmed 상태 이름의 크기 차이까지 최초 용량 검사에서 확보한다. 새로고침의 권한 GET 성공 후 미확정 요청을 먼저 표시해 편집/새 요청을 차단한다. 자동 POST/AI/게시는 없다. 기존 재시도 해제 버튼도 이 결과 확인으로 연결해 미확인 요청을 새 ID로 덮지 않는다.

명시 같은 요청 재확인은 이미 저장된 결과를 replay하거나 미전달 저장을 완료한다. UI에 실제 저장 가능성을 안내한다. 영수증을 옛 최신본으로 적용하지 않고 확인 상태를 보관한 뒤 최신 GET으로 연다. 그 조회만 실패하면 confirmed 상태로 재시도/reload하며 GET만 한다.409는 요청/초안을 보존하고 명시 초안 복귀를 제공한다. 이탈 뒤 늦은 결과를 적용하지 않는다. 질문은 별도 보관이며 게시 승인으로 연결하지 않는다.

## Ego92 실제 실행 · 2026-10-17

기존 FE3698/API4899·비공개46/source34의 공개 합성 자료를 사용했다. 기존4898/4899를 유지하고 표식이 있는 저장 한 건만 별도4901 검증 응답기를 거쳤다. 첫 경우는 실제 서버201/commit 후503으로 본문을 치환했고, 두 번째는 전달 전에503을 반환했다. 토큰은 기록하지 않았으며 검증 응답기는 종료했다.

| 검증                         | 결과                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 제목/질문 편집→저장201 뒤503 | 실제 저장 제목 존재·요청/초안/질문 보관                                                                            |
| reload                       | 권한/Studio GET만·확인 화면·편집 없음                                                                              |
| 같은 요청 명시 재확인        | 정확한 원 요청 body·기존 영수증 replay201→최신GET200, 요청별 영수증1/전체46 영수증14로 동일                        |
| 확인 후 reload               | 블록/요청 키0·GET만·같은 저장본, 질문 유지                                                                         |
| 두 번째 미전달503            | 서버 내용 그대로·해당 영수증0·reload 자동 POST0                                                                    |
| 같은 요청 명시 재확인        | 최초 저장201 한 번·영수증0→1/전체14→15·질문 원문 복구                                                              |
| 원복/보존                    | 정상 UI로46 제목 원복/reload·질문/요청/초안 키0,45 전체 응답 불변·모든 폭 ID/배치·10%/일별10·300 유지·비공개/게시0 |
| 390/768/1440                 | 확인 화면 넘침0·32px 버튼·14px 설명/버튼·대상 제목 가독성과8px 이상 기존 간격 유지                                 |

**기능 PASS_SELECTED:** 실제 저장 후 응답 유실·미전달의 제목 변경 범위다. 임시 신규 블록 ID가 포함된 reload 복구·확정 후 최신 GET 실패/reload·409 초안 복귀·모든 인증/경합 변형은 이번 실제 화면에서 실행하지 않았다. 신규ID의 기존 저장 테스트·확인/최신 GET·409/이탈/보관 오류는 회귀로 구분한다.

**디자인 PASS_SELECTED:** 확인 전 편집기 대신 대상 제목/간단한 설명/하나의 주 버튼을 제공한다. 기존 UI Kit Notice/32px 버튼을 재사용했고 세 폭 캡처를 직접 확인했다. 새 전역 높이 예외·설정 모드·기술 필드는 추가하지 않았다. 계산/차트 변경이 없어 새 live Rill 비교는 미실행이다.

## 검사와 증빙

- 관련 FE8파일111개·타입·변경 lint(경고0)·FE build PASS. 초기 신규 회귀의 fixture에 빠진 정의 카탈로그 메타데이터를 보완했고 실제 API 검증 경계를 그대로 유지했다.
- 실제 요청/저장소/API/영수증/화면 대조31개 PASS. 처음 영수증 수 조회의 잘못된 dashboardId 열 가정을 수정하고 저장 결과 JSON의 dashboardId 및 정확한 requestId로 재조회했다. 완료 후/동일 확인 후의 전체·해당 요청 수를 대조했다.
- BE 코드/DB 변경 없음. BE 단위/core E2E·실휴대폰/운영/전체 접근성/고객 수용은 NOT_RUN이며 전체 P3/TC005 수용이 아니다.
- AIWF strict 기존12 errors/33 warnings/4 infos 유지. pin/check는 일치 확인이며 packet은 awaiting_review/acceptance not_recorded다. 별도 독립 리뷰 승인은 없다.
- 증빙 `/tmp/vm-uc047/`: `baseline{45,46}.json`, `fault.cjs/json`, `fault-events.jsonl`, `stored-after-loss.json`, `committed46.json`, `reload-pending.json`, `confirmation-events.json`, `confirmed46.json`, `confirmed-reload.json`, `after-confirmation-storage.json`, `receipt-after-commit/confirm.json`, `undelivered-storage/server46/reload.json`, `undelivered-confirm-events.json`, `undelivered-confirmed46.json`, `receipt-before/after-undelivered-confirm.json`, `question-restored.json`, `final{45,46}.json`, `final-state.json`, `final-code-state.json`, `confirmation-final-{390,768,1440}.png/json`, `assertions.py/json`, `unit/type/lint/build/strict.log`.
