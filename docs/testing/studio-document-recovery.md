# Studio 미저장 블록·배치 새로고침 복구

Status: Draft · P1/P3 · UC045 · TC-005 중단 후 편집 지원 · PASS_SELECTED.

## 계약과 설계

[구현 전 계획](../plans/UC-045.md)에 따라 권한 조회가 성공한 Studio에서 같은 로그인 scope·탭·대시보드의 문서를 sessionStorage에 보관한다. 블록·표시·모든 폭 배치·공통 기간/필터와 기준 revision/sourceRevision만 24h/256KiB로 제한한다. SQL catalog·조회 결과·AI 실행 envelope·저장 영수증·undo 이력은 추가 저장하지 않는다. 기존 인증 scope와 정상 refresh 승계·로그아웃 정리를 재사용한다.

새로고침 후 **명시 복구 → 서버 전체 미리보기 → 미저장 편집 → 명시 저장**이다. 같은 저장본·소스 버전이고 현재 편집이 없을 때만 복구한다. 저장본 기준과 복구 문서를 구분해 저장 버튼이 활성화된다. 복구 중 새 편집/버전 변경·이탈은 늦은 응답의 적용을 막는다. 미리보기 실패 시 기록을 보존한다. 복구 문서의 기간/필터로 새 미리보기 범위를 표시하며 기존 충돌 재적용의 미리보기 범위는 그대로 유지한다.

보관 기록이 있는 동안 현재 새 편집으로 덮어쓰지 않는다. 보관 기록 폐기는 현재 편집을 보존한다. 정상 저장 또는 저장본으로 되돌리기는 기록을 정리한다. 저장소 오류는 비차단 안내한다. 질문은 UC043과 별도 명시 선택이다. 다른 revision/source의 병합·저장 결과 불명확 요청의 reload 재확인·undo 이력 복구는 이번 범위가 아니다.

## Ego89 실제 실행 · 2026-10-17

기존 FE3698/API4899·비공개46/source34(공개 합성 DECIMAL 자료)를 사용했다. 원본45는 읽기 비교만 했다.

| 검증                              | 결과                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 제목 변경 + 기존 정의 복제 + 크게 | 미저장4블록·세 폭 배치 보관, 추가 블록 lg 너비6                                                      |
| 실제 새로고침                     | 권한/Studio GET200 두 건, 자동 POST0·저장본3블록·복구 안내                                           |
| 명시 복구                         | `/studio/dashboards/46/preview`201 한 번, 전체 문서/배치 동일·미저장4블록                            |
| 명시 저장 → 새로고침              | save201 한 번·새 블록 ID만 서버 ID로 변환·배치/정의 보존, reload GET만·초안 키0                      |
| 최종 코드 390px focus/Enter 복구  | preview201 한 번, 제목을 저장본으로 되돌리면 추가 저장 없이 clean·키0                                |
| 검증 자료 원복                    | 추가 블록 삭제/원래 제목의 정상 UI 저장,46 내용·ID·배치 원복(revision은 정상 증가),45 전체 응답 불변 |
| 390/768/1440                      | 안내·복구 화면 넘침0, 버튼32px/14px·동일 행·간격8px, 기존 헤더/차트 유지                             |

**기능 PASS_SELECTED:** 실제 reload/명시 복구/새 미리보기/저장/reload 및 위 보존 범위다. 미리보기 장애·revision/source 불일치·지연 응답 중 새 편집·인증 scope·TTL/손상/저장소 거절은 단위 증빙이다. 같은 인증의 실제 브라우저 갱신/다른 탭 변경을 이번에 실행했다고 주장하지 않는다. 새 게시/공개 링크는 만들지 않았다.

**디자인 PASS_SELECTED:** 세 폭 캡처를 직접 확인하고 bounding box로 새 액션의 크기·정렬을 확인했다. 기존 UI Kit의 작은 버튼과 공통 Studio 배너를 재사용하며 전역 크기 예외/새 의존성을 추가하지 않았다. 계산/차트 구현은 변경하지 않아 새 live Rill 비교는 미실행이다. source34 기존 10%·총매출300 표시를 유지한다.

## 검사와 한계

- 관련 FE5파일91개·타입·변경 lint(경고0)·FE build PASS. 초기 테스트는 prepare 함수의 실제 `/preview` 경로/표준 오류 변환과 맞추었고, revision 없는 reducer 문서의 보관을 회귀로 고정했다.
- 원격 `2ef07437`의 커머스/KRW 변경은 겹치는 파일 없이 fast-forward 통합했다. 통합 후 관련 FE91·타입·FE/BE build와 실제46 재조회 결과를 확인했다.
- 독립 리뷰는 제공자400 오류로 실행되지 못했다. 수동 diff 검토와 위 검증을 독립 리뷰 승인으로 대체하지 않는다.
- AIWF strict 기존12 errors/33 warnings/4 infos는 유지한다. pin/check는 일치 확인이며 승인/전체 수용이 아니다.
- 이번 BE 단위/core E2E·운영MySQL/실휴대폰·전체 접근성·고객 파일럿/사람 수용은 NOT_RUN이다. 다른 버전 초안의 병합과 저장불명확 reload 복구는 후속이다.
- 증빙 `/tmp/vm-uc045/`: `baseline{45,46}.json`, `stored-before-reload.json`, `reload-before-restore.json`, `restore-events.json`, `restored-draft.json`, `save-events.json`, `saved46.json`, `reload-after-save.json`, `final{45,46}.json`, `final-restore-events.json`, `final-clean-state.json`, `recovery-banner/restored-{390,768,1440}.png/json`, `final-recovery-390.png/json`, `assertions.py/json`(23개), `unit/type/lint/build.log`, `integrated-*.log/json`, `integrated46.json`, `backend-build.log`, `strict.log`. 인증 토큰은 증빙에 출력하지 않는다.
