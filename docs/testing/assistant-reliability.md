# Assistant 저장 충돌·실행 중단 — 2026-10-12~13

시작 커밋 `acf29020`, develop-v2. 기존 ASSISTANT-01~05의 정상 조건은 관련 변경이 없는 범위를 재사용한다. Node24/AI SDK7/Codex gpt-6-luna 유지.

## 신규 MD 조건

| ID | 입력·기대 결과 |
| --- | --- |
| ASSISTANT-06 | 같은 대시보드를 A/B 화면에서 로드한다. A의 실제 AI 수정 미리보기 뒤 B에서 먼저 저장한다. A의 적용은409/충돌 안내이며 B의 제목·위젯·집계가 보존되고 신규 메타데이터가 남지 않는다. 최신 화면 불러오기 후 새 버전으로 저장 가능. A가 적용한 뒤 B가 변경한 상태에서 A의 되돌리기도409로 차단한다. 원본 fixture는 최신 revision으로 복구하고 재조회한다. 최종 UPDATE의 영향을 받는 행이0일 때 트랜잭션 롤백은 하위 검사로 확인한다. |
| ASSISTANT-07 | 브라우저에서 실제 gpt-6-luna 질문을 보내고 Codex 자식 프로세스 기동을 확인한다. 응답 중단 후 해당 요청의 프로세스 그룹이 종료되고 늦은 답변/제안은 표시되지 않는다. 기존 대시보드는 보존된다. 후속 실제 요청은 성공하며 동시 실행 슬롯이 반환된다. 모바일 중단 버튼·패널 닫기로도 요청을 취소할 수 있다. 정상 HTTP 응답 완료는 취소로 판정하지 않는다. 미기동/이미 취소/리스너 해제·close까지 슬롯 유지 조건은 하위 검사로 확인한다. |

## 구현 범위

- Assistant는 조회 revision을 expectedRevision으로 적용·되돌리기에 전달한다. 저장 직전 트랜잭션 안에서 검사하고, 실제 UPDATE도 기존 제목·레이아웃·정의·삭제 상태를 조건으로 비교한다. 새로운 DB 테이블/마이그레이션/서비스는 추가하지 않는다.
- 보호는 expectedRevision을 사용하는 AI 저장에 적용한다. 기존 legacy 저장 API 전체가 동일 보호를 강제한다고 보고하지 않는다. 파일 원본이나 데이터셋 원본의 외부 변경을 대시보드 revision으로 탐지하지 않는다.
- 충돌은 자동 덮어쓰기/재시도 없이 최신 화면 불러오기로 안내한다. 새로고침 시 현재 화면 대화와 제안은 초기화된다.
- HTTP 응답 연결 종료→AbortSignal→AI SDK→Codex CLI 프로세스 그룹 종료. close 시점에 슬롯을 반환하고 임시 파일을 정리한다. 서버 preview의 진행 중 DuckDB 쿼리 자체 중단은 이번 범위가 아니다. 중단은 공급자 과금 취소 보장이 아니다.
- Aside 연결 실패에 대해 이전 승인된 headed Chromium 대체를 재사용한다. 테스트 화면 FE3483/API4683, 격리 metadata DB와 기존 Rill Parquet1391572행. 증빙은 저장소 밖 `phase2-fix-evidence/dashboard-assistant/continuation`에 저장한다.

## 결과

| ID | 결과 | 실제 증빙 |
| --- | --- | --- |
| ASSISTANT-06 | PASS | A의 실제 gpt-6-luna 미리보기 뒤 B탭의 인증된 저장 API 호출201. A 적용409·B 제목/3위젯 유지·메타데이터6테이블 행 수 불변. 최신 화면 불러오기 후 새 AI 제안 적용201/소수1 compact 재조회. B2 저장 이후 A 되돌리기409·B2 위젯 유지. 원본 제목·위젯 정의를 최신 revision으로 복구했다. 최종 충돌 안내를 desktop/mobile에서 다시 캡처했다. |
| ASSISTANT-07 | PASS | Desktop 응답 중단: 실행 중인 launcher PID14094 종료. Mobile 닫기: launcher18044/native Codex18057 그룹 모두 종료, Assistant 답변 수1→1로 늦은 답변 없음. 후속 실제 gpt-6-luna 요청201, 정확한634513000 답변. 중단 질문은 저장하지 않았고 원본 대시보드는 유지됐다. |

관련 검사: BE107개(대시보드/컨트롤러70 + 제공자/CLI37), FE26개(실제 useChat/transport). FE 타입·변경 파일 린트·BE/FE 빌드 통과. 첫 실행과 수정 후의 동일 조건 반복은 재검사 횟수이며 검사 개수를 중복 집계하지 않았다. 기존 ts-jest/TypeScript, Vite/ToastUI 경고는 남았다. 전체 MD/전체 E2E/원격 CI/Docker를 반복 실행하지 않았다.

첫 중단 시도는 모델 답변이 클릭 전에 종료되어 NOT_RUN으로 판정했다. `desktop-process-before/after.json`은 자연 종료 관찰이며 중단 성공 증빙이 아니다. 실제 중단 증빙은 `stop-inflight.json`, `mobile-stop-inflight.json`이다. PID/PPID/PGID/프로그램 이름만 수집하고 프로세스 명령 인자나 키를 수집하지 않았다.

최초 충돌에서는 서버 차단은 성공했지만 긴 미리보기 위쪽에 오류 안내가 가려졌다(`apply-conflict.png`). 안내와 최신 화면 불러오기 버튼을 입력 영역 위에 고정해 desktop/mobile 재검증했다(`apply-conflict-visible.png`, `mobile-conflict-visible.png`). 가로 넘침은 없었다. `final-before/after-conflict-counts.json`은 동일 행 수이며 최종 UPDATE 실패 롤백은 실제 SQLite 트랜잭션에 영향을 받는 행0을 주입한 하위 검사로 확인했다. 실제 동시에 두 DB 트랜잭션이 충돌했다고 확대하지 않는다.

증빙: `sdk7-calls.json`, `after-conflict.json`, `after-undo-conflict.json`, `restored-definition.json`, 프로세스 JSON 및 `mobile-recovery.png`. B탭의 저장은 화면 내부 인증 API 호출이며 B의 저장 버튼까지 UI로 검증했다고 보고하지 않는다. 독립 읽기 전용 코드 검토에서 구체적인 추가 결함은 보고되지 않았다.
