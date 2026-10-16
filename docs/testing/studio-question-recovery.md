# Studio 미전송 질문의 새로고침 복구

Status: Draft · P3 · UC025/TC-005 반복 질문 복구 지원 · PASS_SELECTED.

## 계약과 변경

권한이 확인된 Studio Workspace에서 기존 로그인 scope·대시보드별 별도 suffix 키를 사용해 질문/버전/갱신 시각만 sessionStorage에 보관한다.24시간·8KiB·2000자 제한이며 공백 입력/기존 전송의 입력 정리를 반영한다. SQL·블록·결과·요청 envelope는 추가 저장하지 않는다. 같은 탭의 reload 후 질문 복구/보관 질문 폐기를 명시 선택한다. 기존 key의 로그인 세대·정상 refresh 승계·로그아웃 prefix 정리를 재사용한다.

늦은 key 조회가 현재 타이핑을 덮지 않는다. 보관 질문이 발견된 동안 새 입력이 있으면 복구 버튼을 비활성화하고 보관 질문을 유지한다. 폐기는 현재 입력을 보존하고 이후 현재 입력을 보관한다. 저장소 오류는 편집을 막지 않으며 보관 실패를 안내한다. 폐기 실패도 완료로 표시하지 않는다. 읽기 실패/잘못된 값은 자동 AI로 변환하지 않는다.

복구는 질문만을 의미한다. 블록 초안·AI 실행·응답 불명확 요청의 영구 복구가 아니다. 전체 이탈 가드/모든 토큰 경합·고객 수용으로 확대하지 않는다.

## Ego86 실제 실행 · 2026-10-17

기존 FE3698/API4899·공개 합성 source32·저장45를 사용했다.

| 검증                                        | 결과                                                           |
| ------------------------------------------- | -------------------------------------------------------------- |
| 질문 입력 → 실제 reload                     | 권한 GET 이후 복구 안내, 자동 POST0                            |
| 명시 복구                                   | 390px에서 버튼 focus/Enter → Sheet의 입력 원문 일치, 전송 없음 |
| 대시보드 분리                               | 39 Studio에는45 질문의 복구 안내 없음                          |
| 45 재진입 → 폐기 → reload                   | 안내 없음·질문 suffix 키0                                      |
| 최종 질문 재보관/reload/복구 후 입력 비우기 | 최종 키0·서버45 응답 전체 전후 동일                            |
| 390/768/1440                                | 문서 넘침0·복구/폐기 버튼32px/같은 행·기존 헤더/차트 보존      |

**기능 PASS_SELECTED:** 위 실제 입력/복구/폐기/분리 범위다. 다른 로그인/정상 토큰 갱신·TTL/손상·저장소 거절·늦은 조회/현재 입력 보존은 단위 증빙이며 이번 실제 브라우저 인증 전환을 실행했다고 보고하지 않는다.

**디자인 PASS_SELECTED:** 새 안내의 공통 `w-full`에 Studio 좌우 margin이 합쳐져 가로 넘침이 발생했다. `studio-status-banner` 폭을 auto로 고쳐 같은 여백 안에 들어오게 하고 설명/액션 줄을 분리했다. 기존 버튼 높이/전역 테마 예외는 추가하지 않았다. 초기 `recovery-overflow.png`와 최종 세 폭 캡처를 구분한다. 차트/계산 변경이 없어 새 live Rill 비교는 미실행이다.

## 검사와 증빙

- FE3파일61개 PASS: Editor·question storage·Conversation activity. 첫 refresh 키 테스트는 alias 승계 후 토큰 commit을 생략해 거절됐으며 실제 인증 순서대로 토큰 commit 후 재검증했다.
- FE 타입·변경 lint(경고0)·FE build PASS. backend/core E2E·실휴대폰·전체 접근성·운영·고객 인수는 NOT_RUN이다.
- AIWF strict의 기존12 errors/33 warnings/4 infos는 유지한다. pin/check는 문서 일치이며 승인/전체 수용이 아니다.
- `/tmp/vm-uc043/`: `recovery-overflow.png`, `recovery-{390,768,1440}.png/json`, `restored-390.png`, `restored.json`, `reload-xhr.json`, `other-dashboard.json`, `discarded.json`, `final-cleared.json`, `before/after.json`, `assertions.py/json`, `unit/type/lint/build.log`.
- 고객 비식별 파일/담당자 정답은 미제공이므로 [고객 파일럿](customer-pilot.md)은 NOT_RUN을 유지한다. 에이전트 합성 데이터 검증을 고객 수용으로 대체하지 않는다.
