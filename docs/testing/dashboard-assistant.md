# 우측 Assistant·AI SDK 7·Node 24 — 2026-10-12

시작 HEAD `5ec1ef6a`, `develop-v2`. 기존 완료 케이스 전체를 반복하지 않고 신규 Assistant 및 SDK/런타임 영향 범위를 선택한다.

## MD 조건

| ID | 조건 |
| --- | --- |
| ASSISTANT-01 | 기본 접힘. Desktop1440×900에서는 우측400px 패널과 차트가 같이 보이고, Mobile390×844에서는 전체 화면 패널을 사용한다. 닫기/키보드/Escape와 포커스 복귀, 가로 넘침을 확인한다. 대화는 패널 재열기에서 유지하며 페이지 새로고침에서는 초기화한다. |
| ASSISTANT-02 | 같은 Rill 광고 샘플1391572행, 현재 기간·필터·선택 차트와 최대10개의 대화 이력을 전달한다. 서버가 소유권/입력을 검증하고 실제 preview를 다시 조회한다. 총 요청634513000, 기기9개 합계634513000, 차이0 및 가중 평균 계산식을 질문 답변과 대조한다. 질문은 쓰기/저장/LLM SQL 실행을 하지 않는다. |
| ASSISTANT-03 | 수정 요청→검증된 미리보기→명시적 적용→fresh GET로 저장을 확인한다. 미리보기 취소는 저장하지 않는다. 화면 조건이 달라진 제안은 적용 차단한다. 적용 후 직전 draft로 되돌리고 재조회한다. 기간·필터는 조회 문맥이며 저장 SQL에 고정하지 않는다. |
| ASSISTANT-04 | 오류 후 대화/기존 대시보드 보존, 후속 요청 복구. 중단·화면 전환 뒤 늦은 답변/제안 무시, 저장 중 중복 요청 방지, 실패 제안 재시도 가능. 실제 오류 UI와 하위 상태 검사를 구분한다. |
| ASSISTANT-05 | Node24, AI SDK7, React UI4에서 타입·린트·관련 테스트·BE/FE 빌드·실제 SQLite/DuckDB 기동과 Codex gpt-6-luna 모델 호출을 확인한다. 런타임/CI/Docker 기준과 lockfile을 맞춘다. |

## 구현·운영 범위

- `useChat`이 대화 메시지/상태/오류/중단을 관리한다. 커스텀 ChatTransport는 기존 인증·토큰 갱신 경로를 재사용한다. 서버 `generateText`는 기존 Codex CLI를 LanguageModelV3 어댑터로 호출한다. SDK7은 V3 모델 호환을 지원한다. `maxRetries:0`, 자동 모델 대체 없음.
- Codex 로그인과 `AI_PROVIDER=codex`, `gpt-6-luna`, 현재 환경의 연결 URL/카탈로그를 유지한다. 신규 API 키나 로컬 LLM을 사용하지 않는다. CLI 요청 모델 정보는 실제 사용 모델의 공급자 증명을 뜻하지 않는다.
- 코드 검토에서 현재 대시보드와 요청 소스의 불일치 차단, 이후 draft 변경 시 되돌리기 차단을 추가했고 관련 회귀 검사를 통과했다. 다른 브라우저의 동시 편집을 서버 버전 조건으로 차단하는 CAS는 후속 범위다.
- CLI는 답변 완성 후 반환한다. 토큰 스트리밍/도구 실행/자동 수집/영속 대화/다단계 에이전트 루프는 이번 범위가 아니다. 응답 중단은 브라우저 요청과 늦은 응답 반영을 취소한다. 이미 실행된 서버 CLI는 기존 timeout/동시 실행 제한 안에서 마무리될 수 있다.
- 질문마다 기존 preview SQL 및 숫자 KPI 추세 SQL을 실행한다. 열기/닫기는 LLM을 호출하지 않는다. 대화이력10개·메시지2000자·최대6위젯, 각100행/120추세점을 전달하고 누락·잘림을 명시한다. 모든 구간을 분석했다고 보고하지 않는다.
- 일반 숫자 표시의 전체/축약 선택은 유지한다. `위젯 설정` 모드는 AI로 저장한 위젯별 numberNotation을 사용하며 미지정은 축약이다. AI 적용/되돌리기는 이 모드로 돌아간다. 소수 자릿수/단위 편집은 SQL 값을 스케일링하지 않는다.
- 기기별 합계를 LLM이 잘못 더한 실제 실패를 보존하고, 서버가 정수 문자열/안전한 정수를 BigInt로 합산한 정확한 합계·차이를 근거로 제공하도록 수정한다. 소수/NULL/잘린 행을 전체 합계로 꾸미지 않는다. 가중 평균을 분모 단독 합계와 잘못 비교하지 않는다. 모델 답변 자체는 실행별 수치 검증이 필요하다.
- Node24.11+~24.x: `.nvmrc`, root/BE/FE engines, CI, Debian bookworm Docker 이미지 기준. 로컬 검증 바이너리는24.21.0이며 전역 Node 설정은 변경하지 않는다. 백엔드 TypeScript5.9는 SDK 의존성 문법 지원에 필요하다.
- SDK7은 ESM 전용. 기존 Jest28 서비스 단위 검사에서는 SDK 경계를 mock하고 별도 실제 Node24/브라우저 실행으로 SDK 호출을 검증한다. 프런트 테스트는 실제 SDK useChat을 사용한다. 기존 ts-jest28의 TS5 지원 경고는 남으며 테스트 도구 전면 교체는 하지 않는다.
- 기존 Lambda nodejs14 설정, Oracle/ODBC/외부 DB 드라이버, Docker 이미지 실제 빌드·CI 원격 실행은 별도 미검증이다. 서버 DuckDB worker는 단일 상시 서버와 영속 업로드 경로를 사용한다. 이번 런타임 변경을 Lambda 배포 완료로 보고하지 않는다.

## 환경·증빙

Aside 인증 연결 실패에 대한 기존 승인 대체인 headed Chromium 사용. 실제 최종 FE `http://127.0.0.1:3483/dashboard/5`, 격리 Node24 API4683, 기존 메타데이터 백업 `assistant24.db`, 동일 원본 Parquet/업로드. 최종 실행은 응답 가공/모델 응답 fixture 없이 API를 직접 호출한다. 이전4500/4670/4681 서버는 유지했다.

증빙 루트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-assistant`.

## 결과

| ID | 결과 | 확인 범위 |
| --- | --- | --- |
| ASSISTANT-01 | PASS | 1440×900 우측400px, 1024×900·390×844 전체 화면. 가로 넘침 없음. Escape→Assistant 버튼 포커스 복귀, 재열기 대화 유지. 모바일 전환 시 초기화 오류 수정 후 실제 요청 중 화면 전환에서도 필터/선택/대화 유지. |
| ASSISTANT-02 | PASS | 실제 SDK7/Codex 응답: 총634513000, 기기9개 합634513000, 차이0. Mobile/Tablet·2023-09-10~11 UTC 조건90789400·48시간 추세, selectedWidget0과 실제 SQL 바인딩 확인. 질문 후 fresh GET의 위젯 정의는 원본과 동일. 소유권/입력/범위는 관련 단위 검사로 확인. |
| ASSISTANT-03 | PASS | 실제 AI 수정에서3개 SQL 동일, 첫 KPI 소수1·축약634.5M 미리보기. 선택 변경 시 적용 차단. 명시적 적용 후 fresh GET decimal1/compact 확인. 대화·Undo 유지, 되돌린3개 위젯 정의가 원본과 정확히 동일. 취소/저장 실패/중복 방지는 관련 상태 검사로 확인. |
| ASSISTANT-04 | PASS | 실제 브라우저503 일회 주입→오류 안내→같은 조건의 실제 gpt-6-luna 후속 요청201/정답90789400. 중단/늦은 응답/저장 실패·재시도는 단위 검사로 확인. 서버 모델 장애 자체를 이503 주입으로 검증했다고 보고하지 않는다. |
| ASSISTANT-05 | PASS | Node24.21.0 실제 FE/BE 기동·SQLite/DuckDB1391572행·SDK7 질문/수정 성공. BE6개 관련 suite113개, FE 관련38개(기존AI패널6 포함) 통과. FE 타입·변경 파일 린트·BE/FE 빌드 통과. 원격CI/Docker 이미지 실행은 미실행. |

최초 실패 `failure-arithmetic-sdk7.png/json`: 실제 기기 합계를615552000, 차이18961000으로 잘못 설명한 모델 산술 오류를 보존했다. 서버 BigInt 합산 근거 추가 후 `desktop-answer-fixed.png`/`sdk7-calls.json`에서634513000·차이0 재검증. 모바일 전환 초기화는 PageViewBox의 Desktop/Mobile 컴포넌트 교체가 원인이었다. 대시보드에 한해 같은 컴포넌트를 유지하고 반응형 스타일을 적용했으며 상태 지속 회귀1개와 실제 브라우저 전환으로 확인했다.

핵심 화면: `applied-sdk7-final.png`, `undo-sdk7.png`, `stale-proposal.png`, `mobile-error.png`, `mobile-recovered-sdk7.png`, `desktop-filtered-sdk7.png`, `tablet-sdk7.png`. `sdk7-calls.json`에는 최초 실패와 후속 실제 응답을 함께 보존했다. 숫자 정확성과 저장 여부는 캡처 외 서버 응답/재조회로 판정했다.

기존 ts-jest의 TS5.9 지원 경고, Vite 설정/레거시 ToastUI CSS 경고는 남아 있지만 관련 검사와 빌드는 성공했다. 기존 DESIGN-04의 실제 VoiceOver 발화 검증은 여전히 부분 완료다.

최종 소스 일치 검사 후 실제 API에 databaseId999999를 요청해400/dashboard source mismatch를 확인했다(`source-check.json`). 최종 빌드로 실제 AI 수정·적용·되돌리기를 재확인했으며 원본 위젯 정의가 그대로 복구됐다.
