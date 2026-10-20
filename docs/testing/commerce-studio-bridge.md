# Commerce → Studio 소스 연결 — 2026-10-17

## 계약

P2/P3 첫 데이터→질문 생성 여정의 CSV 재가공 단계를 제거한다. Commerce 소유자만 정상 게시된 현재 버전을 비공개 분석 소스로 연결한다. 기존 DuckDB 워커 `analytical:true`의 주문당1행 계산을 재사용하며 원본 CSV·Commerce 파일·프로젝트/기존 대시보드를 변경하지 않는다. 별도 서비스/큐/DB 마이그레이션/의존성을 추가하지 않는다.

주문일 코호트 전체 기간·UTC. 보고서의 결제/환불 이벤트 기간·채널 필터는 전달하지 않으며 UI에 명시한다. 결제와 환불을 먼저 주문별 집계한 뒤 결합해 분할 결제·다중 환불의 fanout을 피한다. KRW/USD 단일 통화만 지원하고 권한 확인 전에 파일을 읽지 않는다. 연결은 분석 소스만 준비하며 AI·대시보드 저장·게시를 자동 실행하지 않는다.

같은 owner/project/version/digest는 재사용한다. 동시 동일 요청은 단일 작업, 재시작 후도 DB 태그+원본 연결 기록으로 재사용한다. 독립적으로 파일 교체된 분석 소스는 재사용하지 않는다. Commerce 버전이 준비 중 바뀌면409·미등록 파생 파일 정리. 새 버전은 새 소스로 연결해 이전 대시보드의 기준을 보존한다. MySQL 메타데이터 등록은 원본 행 잠금 후 다시 확인한다. SQLite 경합/운영 다중 서버 전체 보장은 별도 검증이며 등록 불명확 후 파일을 무작정 지우지 않는다. 이 경우 재시도로 기존 소스 확인이 가능하고, 롤백이 확인되면 파생 파일을 정리한다. DB 조회 자체가 실패하면 커밋된 파일 삭제를 피하기 위해 보존하며, 이 경우의 잔여 파일 정리는 별도다.

## MD 조건

| ID | 입력/동작 | 기대 결과 | 결과 |
|---|---|---|---|
| BRIDGE-01 | 현재 원화 프로젝트 버튼→Studio | 파일 재업로드 없이 선택 소스·KRW·주문일/전체 범위 명시 | PASS_SELECTED |
| BRIDGE-02 | 재클릭/동시/재시작 후 재요청 | 같은 sourceId·소스 증가1·원본 불변 | PASS_SELECTED |
| BRIDGE-03 | 다른 소유/미인증·미준비 프로젝트 | 403/401/400·새 파일/메타데이터 쓰기0 | PASS_SELECTED |
| BRIDGE-04 | 분할 결제/다중 환불·새 버전/준비 중 교체 | 독립 정답 일치·기존 소스 보존/409·누수 방지 | PASS_SELECTED |
| BRIDGE-05 | gpt-6-luna 요청→미리보기/명시 저장 | 같은13000/2000/11000 KRW·50% 정답과 통화·새로고침 유지 | PASS_SELECTED |
| BRIDGE-06 | 390/768/1440·키보드/실패 | 버튼·안내·포커스·줄바꿈/넘침·재시도, 늦은 응답 이동 없음 | PASS_SELECTED |

검증 스킬 `vanillameta-verify`로 변경 단위/API→실제 Ego 화면을 선택한다. 이전 KRW/Studio 통과 조건은 재사용하고 연결 영향 범위만 실행한다. gpt-6-luna 유지·VoiceOver BLOCKED·실고객/실휴대폰/운영 gate 미완료. 합성 소유 로컬 DB만 사용한다.


## 실행 결과

2026-10-17, develop-v2 / HEAD `4795775f` + 미커밋 변경. `vanillameta-verify`를 적용해 격리된 합성 원화 프로젝트1과 Ego 작업 공간13에서 확인했다. 기존 Rill·KRW 통과 조건은 재사용했고 이번 연결에 필요한 조건만 실행했다.

- BRIDGE-01/05: 실제 버튼→자동 source4 선택→실제 Codex gpt-6-luna 제안→명시 비공개 dashboard4 저장→reload. 결제 성공액13,000원·환불액2,000원·차감 수취액11,000원·환불 주문 비율50.00%가 API와 화면에서 일치했다. 통화/소수 자리는 질문에 명시했으며 자동 추론 완료로 보고하지 않는다.
- BRIDGE-02: 인증된 동시4회 요청과 서버 재시작 후 실제 버튼이 같은 source4를 재사용했다. 시작 대비 Database3→4, dashboard3→4, metric4→8, publication0 유지. 원본 Commerce 행 전체는 시작 기록과 일치했다. 기존 대시보드 사전 해시의 직렬화 기준을 재구성하지 못해 이번 최종 해시 비교는 INCONCLUSIVE로 남긴다. 원본 보존의 하위 계약은 단위 검사로 확인했다.
- BRIDGE-03: 실제 미인증401. 다른 소유403/미준비400·파일 읽기 전 차단은 서비스 회귀 검사이며 다른 계정의 실제 변경 POST는 실행하지 않았다.
- BRIDGE-04: 실제 DuckDB 워커를 쓰는 회귀에서 분할 결제·다중 환불을 주문별로 집계한 정답, 버전 교체409/파생 파일 정리, 새 버전의 새 소스, 교체된 분석 파일 재사용 금지를 확인했다. DB commit 후 응답 유실은 기존 파일을 보존하고 재시도 시 같은 ID, callback 후 rollback은 등록0/파일 정리를 확인했다. 운영 MySQL 다중 프로세스 경합은 미실행이다.
- BRIDGE-06: 실제390/768/1440 버튼/Studio 저장 화면과 선택 키보드 Enter·Tab/ShiftTab 포커스, 버튼36px/글자14px·가로 넘침0을 확인하고 캡처를 직접 검토했다. 실패 재시도/늦은 응답/화면 이탈/잘못된 응답은 관련 컴포넌트 회귀로 확인했다. 전체 키보드·실휴대폰·VoiceOver 검증으로 확대하지 않는다.

### 발견 오류와 재검증

첫 실제 연결에서 서버는 소스를 만들었지만 프런트 응답 해석이 성공 상태를 놓쳐 이동하지 못했다. 응답의 HTTP2xx·SUCCESS·양의 정수 sourceId를 함께 검증하도록 수정했다. 재시도에서 기존 source4로 이동하며 중복 소스 증가0을 확인했다. ERROR envelope/boolean ID도 이동을 차단한다.

DB transaction callback 뒤 rollback된 경우 파생 파일이 남는 경로를 수정했다. 정확한 소유자/ID의 durable 등록과 해당 파일 참조를 확인해 커밋 파일 보존과 rollback 정리를 구분한다. 안전한 통화 입력400은 유지하고 내부 워커/파일 오류는 고정503 안내로 감춘다. 재사용 파일의 행 수를 확인하며 임의 파일 교체본은 재사용하지 않는다.

### 검사·증빙·한계

이번 관련 BE9/FE25, BE/FE build·FE type·변경 lint·diff whitespace PASS. 전체 suite/core E2E는 관련 없는 기존 결과를 재사용했으며 이번 실행으로 재집계하지 않는다. 프런트의 중간 실패 캡처와 수정 후 캡처를 구분해 보관했다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/commerce-studio-bridge-20261017/`. `api-final.json`, `reuse-api.json`, `button-layouts.json`, `studio-layouts.json`, `restart-reuse-screen.txt`, `bridge-first-error-390.png`, `bridge-button-final-390.png`, `bridge-studio-1440.png`, `bridge-studio-768.png`, `bridge-studio-390-kpi.png`, 선택 검사 로그와 `manifest.json`.

주문일 코호트 전체 기간/UTC이고 Commerce 이벤트 날짜·채널 필터는 넘기지 않는다. 별도 소스 준비는 처음 한 번 워커 파일을 생성하므로 대용량 추가 저장 비용 측정은 남아 있다. 메타데이터 tag/config가 독립적으로 재작성되면 재사용 식별이 달라질 수 있다. 실제 고객/운영 MySQL·장시간 부하·실휴대폰/전체 접근성·전체 제품 수용은 미완료다. gpt-6-luna와 VoiceOver BLOCKED를 유지한다. 코드·기록은 아직 미커밋이다.


## 커밋·원격 후속 통합 — 2026-10-17

원화 수집/보고서·Studio 배치·자동 연결 및 기록을 `5f7175c7`에 커밋했다. 원격 develop-v2의 Studio 질문 보존·복사본 handoff 4커밋(`7982392f`까지)을 `0669fe2d`로 충돌 없이 병합했다. 작성자 설정은 유지하고 GitHub 인증은 사용자 지정 drumcap을 확인했다.

병합 영향 검사: BE Commerce/import/legacy 4 suite42개, FE Commerce/StudioEditor/questionDraft/DashboardReuse 4 suite81개 PASS. FE type/lint/build와 diff whitespace PASS. BE 제품 소스는 원격에서 변경되지 않아 직전 BE build/lint와 실제 Ego 3폭/키보드 캡처를 재사용한다. 새 LLM/게시·전체 E2E·이미 통과한 UI 조건은 반복하지 않았다. 로그는 같은 증빙 폴더의 `merge-*.log`다. 운영/실기기·VoiceOver BLOCKED·기존 INCONCLUSIVE 범위는 그대로다.
