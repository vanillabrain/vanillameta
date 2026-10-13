# 셀프서비스 BI 1A — 첫 시작·매출/환불 샘플

2026-10-13. 기준 HEAD `9e6a1035` 이후 이 문서와 함께 커밋되는 diff. 계획: [self-service-bi-plan](../strategy/2026-10-13-self-service-bi-plan.md). 기존 130개 검증은 반복하지 않고 신규 진입 흐름만 확인했다.

## 입력과 기대 결과

`backend-api/src/commerce/samples/manifest.json` 및 LICENSE.txt가 출처·선택 규칙·SHA256을 고정한다. Analytics Engineering Ecommerce Sales & Returns v1.0.0 공개 합성 데이터의 기존 정상 묶음에서 첫32개 주문과 첫8개 환불의 연결 주문을 선택했다. 연결된 결제/고객 행과 원값을 유지했다. orders37/payments40/refunds8/customers37. USD/UTC, CC BY4.0, 실제 고객 매출이 아니다.

독립 Python Decimal 합산 정답: 결제20994.61, 환불4457.60, 차감수취16537.01. 상품 순매출·이익으로 해석하지 않는다. 전체 기간은 실제 데이터 범위2023-01-05~2025-12-12이며 최근24시간 같은 상대 기본값으로 빈 화면을 만들지 않는다.

증빙 루트: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/self-service-onboarding`. 검증 서버 FE3483/API4683, Node24, 분리된 assistant24.db·영속 테스트 업로드 경로. 준비용 신규 계정 사용. AI_PROVIDER=codex / gpt-6-luna 설정 유지, 이번 흐름 AI 호출0. Aside 가이드 확인, 기존 Aside 연결 불가로 허용된 실제 headed Chromium/Playwright 명령 브리지를 재사용했다. 새로운 자동 E2E suite는 만들지 않았다.

## MD 실행 명세와 결과

| 조건 | 절차 / 기대 결과 | 결과 / 증빙 |
| --- | --- | --- |
| SSBI-01 / 시작 진입 | 대시보드 홈에 샘플·매출/환불 파일·일반 파일·DB 연결의 이름 있는 버튼. 기존 대시보드 목록 보존. | PASS_SELECTED_VARIANTS. home-desktop.png / home-mobile.png. 빈 목록 변형은 dashboard GET만 SUCCESS/data[]로 주입하고 home-empty-desktop.png / home-empty-mobile.png에 기록했다. 실제 가입은 별도 준비이며 빈 목록 주입을 실제 계정 저장으로 확대하지 않는다. 기존 자동 온보딩 자산 생성은 유지되어 새 가입에도 starter dashboard가 생길 수 있다. 최근 목록은 시작 카드 아래 유지; 최근 작업 우선 배치는 후속 UX 과제. |
| SSBI-01 / 샘플 실제 생성 | 샘플 버튼을 Enter로 실행 → 서버 DuckDB 저장·검증 → 프로젝트2 전체기간 보고서. 정답3금액 및37개 주문, 결제주문35/환불주문8. 새로고침 후 유지. | PASS. report.json / sample-desktop.png / sample-mobile.png. |
| SSBI-01 / 재조회 | 홈에서 재시도 및 POST sample 재조회가 동일 ID2 반환, 새 샘플을 중복 생성하지 않는다. | PASS. 응답 SUCCESS, projectId2, reused:true. 같은 소유자 동시 요청 합치기는 단위 검사로 확인. 단일 Node 프로세스 운영 전제. |
| SSBI-02 / 내 파일 진입 변형 | 샘플의 내 파일 연결을 Enter → 가져오기 폼 → 이름 및 CSV4개 선택 → Enter 가져오기 → 프로젝트3. 동일 독립 정답. | PASS_SELECTED_VARIANTS. import-report.json / file-import-mobile.png. 신규 진입 통합을 확인했으며 기존 전체 CSV 오류 조합은 재실행하지 않았다. 수동 지표 정의·차트 제작·일반 대시보드 저장 단계는 이1A 범위 밖. |
| SSBI-01 / 추가 연결 | 일반 파일 버튼 Enter → /data/file, DB 관리 버튼 Enter → /data. | PASS_SELECTED_VARIANTS. general-file-mobile.png. 새 DB 드라이버나 실제 DB 연결은 추가·재검증하지 않았다. |
| SSBI-11 / 샘플 일시 실패 | 브라우저에서 sample 요청만503 주입 → 역할 alert의 오류 안내·파일 연결 보존 → 주입 해제 → 다시 시도 Enter → 동일 프로젝트2 정상 보고서. | PASS_SELECTED_VARIANTS. sample-error-mobile.png. 장애 주입에 의한 검사이며 실제 운영 장애/AI 복구 증명이 아니다. |
| SSBI-11 / 필수 파일 안내 | 이름·필수CSV 없이 가져오기 Enter → 입력·선택 요구 안내. 이후 정상4CSV 가져오기는 프로젝트3으로 완료. | PASS_SELECTED_VARIANTS. file-error-mobile.png / file-import-mobile.png. AI 원인 진단·자동 수정은 NOT_RUN. |
| SSBI-14 / 모바일·키보드 | 1440×900 /390×844. 홈4버튼 Tab 순서·focus-visible 확인. 샘플/재시도/파일 연결/가져오기 Enter. 샘플 정확값 details Enter → Tab으로 이름 있는 표 스크롤 영역. | PASS_SELECTED_VARIANTS. keyboard.json / sample-keyboard-table.png. 홈·샘플 document scrollWidth=390. 실제 VoiceOver 발화는 기존 도구 제한으로 BLOCKED, 전체 앱 접근성 완료로 확대하지 않는다. |
| 신규 endpoint 인증 | 새 비인증 context에서 POST /commerce/sample →401. owner+ready+digest 재사용 조건 검사. | PASS. 브라우저 API401 및 BE 회귀. 타인 소유 보고서 접근의 기존 통과 결과는 재사용; 신규 동시 다중 서버 조건은 NOT_RUN. |

## 수정·확인한 문제

- 최초 빌드에서 CSV assets가 `dist/commerce`에 복사되고 서비스는 `dist/src/commerce`에서 실행됐다. nest assets의 outDir를 `dist/src`로 지정하고 재빌드 후 실제 샘플201·저장·집계 성공으로 재검증했다.
- 샘플 실패는 원시 서버 오류를 노출하지 않고 샘플 작업 자체 재시도와 파일 연결을 안내한다. 재시도 성공은 화면 대체가 아니라 동일 데이터의 실제 집계 조회로 확인했다.
- 처음 캡처의 로딩 overlay/차트 resize 중간 프레임은 최종 증빙에서 교체했다. 390폭에서 canvas332px로 자리잡은 상태를 다시 캡처했다.

## 선택 검사

신규 BE commerce-sample3개 / FE GettingStarted3개 PASS: 안전한 임시 복사·원본 보존/정리, 소유자·digest 재사용, pending 요청 합치기·실패 후 재시도, 두 파일 경로, UI 실패·재시도, 중복 실행 및 잘못된 성공 ID 차단.

FE TypeScript PASS, 변경 FE ESLint 오류0(테스트 non-null assertion 경고1), 변경 BE ESLint PASS. FE/BE build PASS. prettier 형식 오류는 수정 후 lint 재검사했다. 기존 전체 단위/core E2E/AI 모델 검증은 변경 범위 밖으로 반복하지 않았다. 한글 UI 우선; 영어 온보딩 번역, 실제 스크린리더, 시각 지표 정의·저장, AI 오류 진단은 미검증·후속 범위다.
