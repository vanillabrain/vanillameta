# 단순 분석 UI·미리보기 일치 — 2026-10-14

## Scope and design

[AIWF UC-001](../use_cases/UC-001-review-and-save-analysis.md), [TC-001](../test_cases/TC-001-consistent-analysis.md), [설계](../architecture/simple-analysis.md)를 먼저 작성·검토·pin한 후 구현했다. 기존 제품 전체를 AIWF로 역설계하거나 독립 지표 레지스트리를 새로 구현한 작업은 아니다. 합의된 책임 경계를 AGENTS.md 세션 핵심 지침에도 연결했다.

생성 미리보기의 includeTrends 누락과 두 AI 미리보기의 추세 렌더 누락을 보완했다. MetricTrend를 재사용하고 숫자·시계열을 함께 배치한다. 시간 데이터가 없거나 지원되지 않으면 제공 불가 안내를 표시한다. 미리보기에는 저장 화면의 기간 선택/원본 행 드릴다운을 활성화하지 않는다.

분석 설정(숫자 표시·업무 시간대), 기간 계산 안내, 저장 보기 관리, 위젯 집계 원본 확인은 기본 접기로 변경했다. 기존 상태와 핸들러를 유지하고 primary 기간·필터·집계 단위·비교·Assistant는 노출한다. AnalysisUiProvider를 국소 적용하고 부모 버튼 높이 예외를 제거했다. 모바일 빈 질문 라벨/예시문 겹침은 InputLabel shrink로 수정했다.

## Executed evidence

| Gate                | Result                 | Evidence                                                                                                                                                                                                         |
| ------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIWF 문서 선행      | PASS                   | requirements/UC/TC/entity/architecture/plan, strict no-baseline lint0 errors/warnings, 작성 후 별도 의미 검토 pass. 인간 승인 아님                                                                               |
| FE 회귀             | PASS                   | 관련5파일305단위. 새로운 생성/수정 추세·제공 불가 안내·명시 저장 검사 포함. 라벨 보완 후 생성 패널9개 재검사 PASS                                                                                                |
| FE 빌드             | PASS                   | npm run build, vite production build 완료                                                                                                                                                                        |
| 타입/린트           | PASS                   | FE tsc --noEmit, 변경8파일 ESLint, 라벨 수정 후 해당 lint/type 재검사                                                                                                                                            |
| 기존 Rill 분석 수정 | PASS                   | 기존3698 분석5, 실제 지정 gpt-6-luna 요청 → 두 숫자/추세 미리보기 → 변경 적용 → 새로고침. 총634,513,000 / 평균$5.57 유지                                                                                         |
| 시계열 일치         | PASS_SELECTED_VARIANTS | UTC2023-09-09~16 시간별 추세 설명·첫/마지막 값 동일. 총 요청 수 SVG 경로 정확히 일치; 평균 SVG좌표 최대8.5265e-14 차이로1e-9 미만. 최초 exact 비교 실패는 부동소수점 오차로 확인, 감추지 않고 NFR 허용 기준 명시 |
| 새 분석 생성        | PASS                   | 별도 테스트 계정 sales 소스에서 실제 AI 생성 → 매출298,250+주별 추세 → 저장 분석7 → 새로고침 추세 유지. 시연 로그인과 기존 소스 유지                                                                             |
| 접기/펼치기         | PASS_SELECTED_VARIANTS | Aside 분석5 설정·저장 보기 열기/닫기, 테스트 분석7의390/1440에서 같은 동작. 개인 저장 보기는 삭제하지 않음                                                                                                       |
| 디자인              | PASS_SELECTED_VARIANTS | 390/1440 생성·저장·Assistant 캡처, 숫자+추세 가시성/줄바꿈·경계 확인. 저장 화면 페이지 가로 넘침0. Assistant 일반 버튼28px/12px, 선택32px. 추천 긴 문구는 자연 높이. 최종 빈 질문 라벨 재검사 PASS               |
| Rill 대조           | PASS_SELECTED_VARIANTS | 로컬9009 실제 Explore를 VM Aside와 같은1727×1080으로 캡처. 같은 공식 광고 원본의 총635M(반올림), 평균$5.57, 숫자+추세/OS순위 구성을 비교. VM은 정확 숫자634,513,000·$5.57과 추세를 보여줌                        |

Rill은 숫자 왼쪽/추세 오른쪽과 순위 표, VM은 숫자 위/추세 아래와 별도 막대를 유지한다. 완전한 픽셀·레이아웃 동등성 PASS가 아니다. Rill의 이동된2026년 PDT 날짜와 원본2023년 UTC를 같은 기간 버킷이라고 주장하지 않는다. 미리보기와 저장은 같은 렌더러·조회 계산을 쓰되, 편집 미리보기는 탐색 동작을 제한한다.

## Runtime and artifacts

첫 새로고침은 기존FE/API가 종료돼 연결 거부였다. 실행 포트를 읽기 확인하고 보존된 런타임 설정으로3698/4898 및4899프록시를 재기동했다. 기존 `/tmp/vm-rill-views/metadata.db`·uploads·인증 유지, DB 복사/초기화·API 빌드 변경 없음. Rill9009와 Codex10100은 계속 실행 중이었다.

- `/tmp/vm-ai-parity/`: unit.log, label-unit.log, static.log, label-static.log, build.log, mobile.log, mobile-ui.json, label.log, aside-result.log, api-requests.json, rill-final.log.
- 같은 폴더 create-390/1440.png, saved-390/1440.png, assistant-390/1440.png, label-390/1440.png, rill-explore.png. 초기 생성1440 캡처는 resize 직후 전체 화면 전환 상태이며, 최종1440 라벨 패널 캡처로 넓은 폭 전환을 재확인했다.
- Aside `/Users/drumcap/.aside/u/0/sessions/2026-10-14_ElRAuMzDbgj1MolF/artifacts/`: assistant-trend-preview.png, reloaded.png/txt, preview-trends.json, saved-trends.json.
- CLI pin/check/review-packet은 `.aiwf/`의 로컬 산출물이며 Git ignore를 유지한다. sanitized checks 로그만 packet에 포함하고 raw API로그·로그인 값은 포함하지 않는다. 상태 awaiting_review / acceptance not_recorded를 유지한다.

## Not run

물리 모바일·VoiceOver·전체 핵심 E2E·BE 전체 회귀·외부 엔진/알림/API·운영 배포는 NOT_RUN. UI/preview 요청 변경 범위에서 기존 저장 충돌·취소·원본 정합성 회귀와 실제 저장/reload를 선택 실행했다. 독립 지표 레지스트리 재사용은 향후 구현 범위로 남는다. AI가 질문의 제목을 위젯 제목으로 해석하는 경우도 있으므로 생성 결과 검토는 유지한다.
