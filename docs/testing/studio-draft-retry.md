# Studio 보관 초안의 조회 실패·재충돌 실제 복구

Status: Draft · UC046 A3/BR-046-03 · TC046 후속 · PASS_SELECTED.

## 범위와 방법

[기존 설계](../use_cases/UC-046-concurrent-studio-draft.md)·[사전 계획](../plans/UC-046.md#a3-실제-장애재충돌-후속--2026-10-17)의 오류 경계를 실제로 검증했다. 제품 소스는 `e4410fc5`와 동일하다. 기존 회귀를 보강해503→첫 비교/409→서로 다른 최신 revision 재조회→동의 초기화→정상 미리보기에서 초안·질문과 비대상 변경을 확인한다. 새 기능/의존성/전체 실패 처리 프레임워크는 추가하지 않았다.

Ego91 두 탭·기존 FE3698/API4899·비공개46/source34 공개 합성 자료를 사용했다. 기존4898/4899 프로세스를 교체하거나 종료하지 않았다. 검증용 XHR open 표식으로 **다음 명시 비교 GET 한 건만** 별도4901의 같은 경로로 보내 실제 HTTP503을 반환했다. 표식 헤더/1회 카운터·별도 응답기 로그로 한 건을 확인했다.503 본문에 보이는 영어 문장은 검증 응답기의 지정 문구다. 재시도는 기존4899로 정상 연결했고 종료 후4901만 정리했다.409는 주입하지 않고 다른 탭의 실제 두 번째 저장으로 서버가 거절하게 했다.

## 실제 흐름과 결과 · 2026-10-17

| 흐름                                                        | 결과                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 첫 탭 제목/질문 보관 → 둘째 탭 제목/비대상 총매출 제목 저장 | 유효한 기준/초안/질문, 실제 첫 revision 변경                                                                                        |
| 첫 탭 reload → 명시 비교 GET503                             | 정확 한 건, 초안·질문 기록 원문 동일·서버 응답 전체 무변경·재시도 가능                                                              |
| 명시 재조회200 → 첫 비교/동의                               | 첫 저장본 제목을 표시하며 자동 미리보기/저장 없음                                                                                   |
| 둘째 탭 다시 두 제목 저장 → 첫 탭 병합 미리보기             | 실제 preview409, 요청은 첫 revision/서버는 두 번째 revision, 서버 응답 전체·초안/질문 무변경                                        |
| 409 후 재조회/재비교                                        | 최신 두 번째 제목·동의 unchecked·미리보기 disabled                                                                                  |
| 재동의 → 전체 미리보기201                                   | 두 번째 revision CAS·최신 기준으로 보관 갱신·내 제목/최신 비대상 제목·ID/모든 폭 배치 유지                                          |
| 질문 복구 → 명시 저장201 → reload                           | 질문 원문 일치·LLM 전송0, save 한 번·같은 최신 revision 기준, reload GET만·블록 초안 키0                                            |
| 수치·최종 정리                                              | 환불률10%·일별10/10·총매출300 보존, 원본45 전체 응답 불변,46 내용은 정상 UI 저장으로 원복(revision 증가)·질문/블록 키0·비공개/게시0 |

**기능 PASS_SELECTED:** 위 GET503 한 건·재충돌 한 번·명시 재시도 여정이다. 반복503/통신 단절/탭 종료/모든 경합 조합·소스 변경·실기기·운영 전체를 실행했다고 주장하지 않는다. 게시/새LLM 요청은 이번 범위가 아니다.

**디자인 PASS_SELECTED:** 오류/409/저장본390·768·1440px를 캡처하고 직접 확인했다. 문서 가로 넘침0, 비교/폐기 버튼32px·14px 글자·동일 행·8px 간격, 질문 안내와 주변 헤더/도구 정렬을 유지했다. 새 전역 높이 예외나 화면별 덮어쓰기는 없다. 계산/차트 변경이 없어 새 live Rill 비교는 미실행이다.

## 검사와 증빙

- FE Editor44개·타입·변경 lint(경고0) PASS. 기존 테스트 한 개를 최신 revision 재미리보기·비대상 보존·질문 보존까지 보강했으며 테스트 수를 새 기능 수로 세지 않는다.
- 실제 요청/저장소/API/수치/화면 대조36개 PASS.503/409 전후 기록의 갱신 시각까지 동일함과 서버 전체 응답 불변을 대조했다. 새 미리보기와 저장은 두 번째 revision을 사용한다.
- 제품 소스 무변경을 `git diff --exit-code e4410fc5`로 확인했다. 전체 FE101·FE build 결과는 같은 소스의 [UC046 증빙](concurrent-studio-draft.md)을 재사용하며 이번에 새로 실행했다고 보고하지 않는다. BE 단위/core E2E·전체 접근성·실휴대폰/운영/고객 수용은 NOT_RUN이다.
- AIWF strict 기존12 errors/33 warnings/4 infos 유지. pin/check는 일치 확인이고 review packet은 awaiting_review/acceptance not_recorded다. 독립 리뷰 승인을 주장하지 않는다.
- `/tmp/vm-uc046-retry/`: `baseline{45,46}.json`, `stored-before.json`, `stored-after503/409.json`, `read-failed-events.json`, `retry-read-events.json`, `reconflict-events.json`, `reread-events.json`, `comparison1/2.json`, `remote1/2.json`, `server-after503/409.json`, `stored-recovered.json`, `preview-success-events.json`, `question-recovered.json`, `save-success-events.json`, `reload-saved.json`, `saved46.json`, `final{45,46}.json`, `final-state.json`, `read-failed/reconflict/saved-{390,768,1440}.png/json`, `fault.cjs/json`, `injections.jsonl`, `assertions.py/json`, `unit/type/lint/source-unchanged/strict.log`. 토큰·비밀번호는 출력하지 않는다.
