# 샘플 오류 도움 — 2026-10-13

범위: P1 오류 도움 중 고정 매출·환불 샘플 읽기 실패만 구현한다. 날짜 형식/필수 컬럼 오류는 이번 범위에 포함하지 않는다.

## 계약

- 실패 응답은 고정 안내와 `requestId/errorCode/stage/version/target/dataHealth`만 제공한다. 원본 오류·경로·자격증명·고객 행을 반환하거나 AI에 전달하지 않는다.
- 사용자의 명시 클릭으로 `/commerce/sample-help`를 호출하며 입력은 requestId 하나다. 인증 사용자별 10분 진단, 최대 1000개 보관, 진행 중 중복 차단 및 설명 캐시를 사용한다.
- 제품 AI는 기존 Codex/gpt-6-luna 경로다. 다른 provider로 대체하지 않는다. 모델 설명은 최대 1000자 plain text이며 서버/모델 출력으로 URL·명령·자동 변경을 실행하지 않는다.
- 재시도·내 파일 연결은 고정 UI다. 설명만으로 복구 판정하지 않고 `unverified`를 유지한다. 재시도/언마운트 시 도움 요청을 취소하고 오래된 결과를 무시한다.
- 프런트 오류 안내는 고정 문구를 사용한다. 응답 message 길이 제한만으로 민감정보를 안전하게 처리할 수 없으므로 원본 message를 렌더링하지 않는다.

## 선택 검증

증빙: `/tmp/vm-sample-help-evidence/` (이 호스트의 임시 경로).

| ID             | 결과                   | 실행 조건                                                                                                                                                                          |
| -------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HELP-SAMPLE-01 | PASS                   | Aside 실제 화면에서 검증용 dist orders.csv를 잠시 숨겨 실제 읽기 실패 재현. 실패 화면에 재시도/파일 연결/명시 AI 도움 표시. 원본 src 파일과 기존 데이터 보존, dist 파일 즉시 복원. |
| HELP-SAMPLE-02 | PASS_SELECTED_VARIANTS | 실제 제품 AI 도움 클릭 후 설명 표시, 원인 미확인 및 복구 unverified 유지. 기존 Codex gpt-6-luna 호출 경로 사용. 실제 provider 취소/모델 미지원 변형은 NOT_RUN.                     |
| HELP-SAMPLE-03 | PASS                   | 원래 샘플 재시도 → `/commerce/1?sample=1` 정상 보고서. 독립 Python Decimal 원본 CSV 정답: 결제20994.61 / 환불4457.60 / 차감16537.01. 실제 UI와 일치.                               |
| HELP-SAMPLE-04 | PASS                   | BE 관련 13개, FE 관련 12개: 소유권/만료/중복/응답 검증/취소/오래된 결과/민감한 응답 message 미노출.                                                                                |
| HELP-SAMPLE-05 | BLOCKED                | Aside REPL page.setViewportSize 미지원으로390px 선택 조건 미실행. 데스크톱 실제 화면만 확인. VoiceOver/OS 모바일 NOT_RUN.                                                          |

FE 타입, 변경 FE lint(기존 non-null assertion 경고1), FE production build, BE build, diff check 통과. Vite 및 기존 CSS minify 경고 유지. 전체 E2E/전체 카탈로그는 반복하지 않았으며 기존130개 집계는 유지한다.

핵심 캡처: sample-failure.png / sample-help.png / sample-recovered.png. 원본 오류 로그·토큰·비밀번호는 새 결과 문서에 기록하지 않는다.

## 잔여

날짜 형식/필수 컬럼 오류 도움, 실제 provider 타임아웃·취소·미지원 모델 및390px/발화 조건은 추가 선택 검증이 필요하다. 진단은 단일 서버 메모리이므로 서버 재시작 후 기존 requestId는 만료 상태로 거부된다.

날짜·필수 컬럼 오류 도움은 이후 [후속 구현과 선택 검증](import-error-help.md)으로 보완했다. 위 범위와 미실행 표기는 당시 기록이다.

## 실제 취소·타임아웃 후속

2026-10-13, 같은 제품 diff의 격리 API4883/FE3683을 Aside에서 확인했다. 증빙은 `/tmp/vm-import-help-evidence/`. 저장소 밖 `sample-reliability.cjs`로 샘플 orders 읽기에 ENOENT를 주입했고 원본 파일은 보존했다. 실제 Codex 첫 호출에 AI_TIMEOUT_MS=1000, 이후120000을 적용했다. 모델/응답 fixture 대체는 없다.

| 조건                                             | 판정                      | 증빙                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HELP-SAMPLE-02 timeout 후 로딩 해제·복구 제공    | PASS_SELECTED_VARIANTS    | PID24947/gpt-6-luna/1009ms/SIGKILL/LLM_CODEX_TIMEOUT. `sample-timeout.png/txt`에 실패 안내와 샘플 재시도/내 파일 연결/설명 버튼 유지. 기본120초 전체 대기·Axios 경합은 미실행.                                                                                                                                                                                                                                                                                         |
| HELP-SAMPLE-02 브라우저 취소→자식 종료·초점 복귀 | PASS_SELECTED_VARIANTS    | PID25605/1482ms/SIGKILL/LLM_REQUEST_ABORTED. `sample-cancelled.png/txt`에 취소 안내와 설명 버튼 focused.                                                                                                                                                                                                                                                                                                                                                               |
| HELP-SAMPLE-02 동일 진단 재요청                  | PASS_SELECTED_VARIANTS    | PID26385/4699ms/code0. `sample-retry.png/txt`에 설명·복구 unverified.                                                                                                                                                                                                                                                                                                                                                                                                  |
| HELP-SAMPLE-03 샘플 재시도와 정상 보고서         | PASS_AFTER_FIXTURE_REPAIR | 실패 주입 해제 후 프로젝트1로 이동했으나 최초 조회400 invalid managed analysis file. 격리 metadata가 이전 `/tmp/vm-sample-help-evidence/uploads/`를 참조했다. 원본 DuckDB 파일을 현재 격리 upload root에 복사하고 프로젝트1의 격리 메타 경로만 갱신했다(`sample-path-repair.json`). 재조회 `sample-reliability-recovered-fixed.png/txt`:37주문, 결제20994.61/환불4457.60/차감16537.01·채널 표시 복구. 데이터 경로 복구 없이 자동 샘플 복구 성공했다고 확대하지 않는다. |

`sample-reliability-trace.jsonl`은 오류 코드·spawn/close만 기록한다. 읽기 실패 주입 플래그는 제거했다. 제품 코드 변경0, 관련 기존 검사는 재사용했고 문서 diff check를 확인했다. 원본 샘플과 이전 증빙/DB는 보존했다. 모바일/VoiceOver·미지원 모델은 여전히 미검증이며 기존130개 집계 유지.
