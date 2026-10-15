# UC-012 C — 기존 질문 UI 연결

2026-10-15, develop-v2 / ccfd35c6 이후 C 변경. [계획](../plans/UC-012.md), [UC](../use_cases/UC-012-semantic-creation.md), [TC](../test_cases/TC-012-semantic-creation.md). 구현·컴포넌트/API 검증과 실제 화면 gate를 구분한다.

## 변경

기존 AiDashboardPanel의 신규 생성이 `/bi/analysis-proposals` → `/preview` → `/save`를 사용한다. 새 모드나 별도 마법사는 없다. dashboardId/currentDraft가 있는 기존 분석 수정은 기존 API를 유지한다. 마지막 유효 결과와 서버 canonical proposal/digest를 연결하고 지표·분류·기존 재사용 개수를 간단히 표시한다. 계산 기준과 SQL은 기본 접힌 details 안에 둔다. 숫자와 MetricTrend는 기존 렌더러를 함께 사용한다.

유효 미리보기마다 UUID requestId를 만들고 같은 저장의 네트워크/5xx/408/429 재시도에서 그대로 유지한다. 다른 질문·소스·새 미리보기 또는409는 이전 저장을 막는다. 오류는 질문·직전 미리보기를 보존하며 생성 중지는 AbortSignal과 session 토큰으로 늦은 응답을 무시한다. 생성 중지는 대화상자를 닫지 않는다. 명시적으로 닫으면 미저장 입력을 버리는 기존 동작을 유지한다. requestId는 열린 화면 상태에만 보존하며 응답 유실 직후 탭 자체를 닫았다가 여는 복구까지 보장하지 않는다.

프런트 검증은 proposal 소스·계획·digest·블록 수와 실제 표시 미리보기의 canonical 위젯 일치를 검사한다. 객체 key 순서는 의미 비교에서 제외한다. 서버가 최종 계산·소유권·저장 권한을 검증한다.

## 실행 결과

| 범위                            | 결과                | 증거                                                                              |
| ------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| 관련 FE 컴포넌트                | PASS 2파일/60 tests | AiDashboardPanel 생성/기존 수정, DashboardAnalysis 저장 조회 회귀                 |
| FE type·변경 eslint·build       | PASS                | tsc --noEmit, eslint, npm run build                                               |
| 실제 LLM/API 연결               | PASS API            | 신규 질문, 프런트 순수 validator, preview, 저장, 같은 key 재시도, 독립 GET 재조회 |
| 수치·Rill 데이터 대조           | PASS 선택 fixture   | 요청634513000, 평균5.571238676523278, OS28개/합계 동일, 두 KPI 추세169개          |
| 실제 Aside 화면/새로고침/XHR    | BLOCKED auto-review | 아래 거절 기록. API 재조회는 브라우저 새로고침 증거가 아님                        |
| 실제 크기·정렬/반응형/Rill 화면 | BLOCKED             | 390/768/1440px 캡처·bounding box·overflow 측정 미실행                             |

컴포넌트 회귀는 기존 분석 수정의 API 유지, 생성→미리보기→저장 callback, 통신 응답 유실 시 같은 key 재시도,409 후 새 preview/key, 소스·질문 변경의 stale 저장 방지, 생성 중지·늦은 provider/preview 응답 무시, 실패 시 이전 결과 보존, 불일치 SQL 응답 거절을 포함한다. MUI와 차트는 mock한 상태 전이 검사이며 디자인 검증이 아니다.

실제 API는 기존 검증 서버4898과 공개 Rill source7, 지정 Codex/gpt-6-luna로 질문했다. 모델 대체 없이 실제 provider를 호출했으나 독립 실행 모델 provenance를 추가 입증한 것은 아니다. **검증 분석21**을 만들고 동일 requestId 재시도가 같은 ID임을 확인했다. 원본 분석은 편집하지 않았다. 생성/미리보기 응답은 현재 프런트 semanticPreview.ts를 transpile한 순수 validator로 검사했으며 DOM/브라우저를 간접 실행하지 않았다. 재조회 결과의 요청 수/평균/OS 그룹 합계를 공식 Rill fixture 기준과 비교했다. 이번에는 Rill 화면을 다시 보지 않았으며 날짜 이동/UTC 버킷 동등성을 주장하지 않는다.

## 디자인 기준과 차단

소스 대조에서는 기존 AnalysisUiProvider의 버튼28px·선택32px·보조12px를 재사용했다. 모바일 fullScreen, minmax(0,1fr) 결과 grid, 긴 텍스트 overflowWrap, 결과 내부 크기 제한을 유지했다. footer는 gap8px와 기존 sibling margin 중첩을 제거해 동일 간격을 의도했다. **이는 소스 기준이며 실제 렌더링 크기/정렬 PASS가 아니다.**

Aside guide와 기존 경로를 확인했다. 샌드박스 안의 연결 실패를 Aside 미실행으로 단정하지 않고 허용된 탭 목록 조회에서 연결을 확인했다. 다음 로컬 관련 탭 확인은 자동 승인 검토가 거절했다: “The user authorized UI verification, but this repeats the previously rejected Aside/localhost browser-verification path; use API, source, or unit-test evidence instead of bypassing that restriction.” 다른 browser/CUA/native/Playwright 우회는 시도하지 않았다. 새 실제 화면 실행은 해당 차단 범위의 명시 승인과 도구 허용이 필요하다.

따라서 질문→미리보기→저장→브라우저 새로고침·같은 폭의 Rill 비교·모바일 긴 라벨/오류/로딩·버튼/입력 실측은 미완료다. UI 기능 전체나 P2 출하 완료로 판정하지 않는다. 운영 MySQL·P1 실제 포인터/터치 gate도 유지한다.

## 증빙과 문서

`/tmp/vm-semantic-c/{result.json,proposal-preview.json,save-request.json,verify.cjs,semanticPreview.js,dashboardPreview.js}`와 `/tmp/vm-semantic-c-{tests,type,lint,build}.log`, `.aiwf/evidence/UC-012-C/`. 토큰·로그인 응답은 저장하지 않았다. 임시 증빙의 영구 보관은 보장하지 않는다.

AIWF는 UC/계획/TC/설계·용어·세션 요약의 구현 상태를 갱신하고 기존 수용 기준을 유지했다. 엔티티/서버 계약/요구사항 정책은 바뀌지 않아 추가 schema 변경이 없다. 별도 자체 대조 패스는 생성/수정 분기, preview와 저장 payload 결합, requestId 유지·무효화, abort/늦은 응답과 기존 국소 테마 사용을 확인했다. 독립 리뷰·고객 수용은 미기록이다. 엄격 문서 lint는 기존 UC007~010 오류12개로 FAIL 유지하며 UC012 새 진단은 없다. pin/check/packet은 approval을 뜻하지 않는다.
