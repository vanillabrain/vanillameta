# UC-006 블록 ID·배치 보존 검증

2026-10-14 develop-v2/f2b2697c 이후 P1 첫 단위. WEB3698/proxy4899/API4898 기존 실행 환경, source7의 신규 소유 분석11을 사용했다. 기존 원본 분석8/9는 편집하지 않았다.

| 범위              | 결과              | 증거                                                                                                                                                                    |
| ----------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE                | PASS105 /5 suites | block helper, AI service/SQLite·DuckDB, saved metric, BI editor, grid service. 결정적 ID·새 ID/중복/unknown 검사·순서 변경·DB 위젯 remapping·경합 rollback·선택 AI 격리 |
| FE                | PASS78 /5 files   | DashboardAnalysis, Assistant, metric editor, transport, PageViewBox 폭 전환 상태                                                                                        |
| 타입/빌드/린트    | PASS              | FE tsc, Nest/Vite build, 변경 파일 eslint exit0. 기존 dashboard.service 미사용 id 경고1개는 유지                                                                        |
| 실제 편집/LLM/XHR | PASS              | Aside 숫자 블록 x0→6, OS y2→3 drag/save. Playwright1440 실제 resize h2→3/save. Aside gpt-6-luna 선택 제목 수정→미리보기→저장→reload                                     |
| 조회/디자인       | PASS390/768/1440  | block Card2개, KPI634513000, OS28 표시, 가로 넘침0px.1440 numeric column7/span6,row1/span3 및 OS column1/span12,row4/span5, 블록 겹침 없음                              |

LLM 요청: 선택한 제목을 UC006 요청 합계 수정으로 변경, 계산/표시 유지. 재조회에서 blockId2개, 비대상 OS widget 정의와 SQL, 전체 geometry가 유지됐고 DB Widget IDs만 바뀌었다. 저장 응답은 서버의 정규화된 draft/읽기용 blockLayouts를 반환한다. 클라이언트 입력 geometry로 저장 위치를 바꾸지 않는다.

Rill 계산 비교는 UC-004에서 확인한 동일 auction SUM/Pivot634513000 및 OS 정답 증빙을 재사용한다. 이번 변경은 계산식/원본을 바꾸지 않았고 Rill을 새로 조작하지 않았다. 직접 배치/AI 편집은 VM 실제 실행 증빙이며 Rill의 동등 기능 검증을 주장하지 않는다.

## 발견과 보정

- 초기 resize 시도는 페이지 데이터 로딩 덮개가 남아 적용되지 않았다. raw mouse 동작만으로 PASS하지 않고 실제 hit target·저장 geometry를 확인했다. 임시 z-index 변경은 원복했으며 로딩 종료 후 실제 h3 저장을 확인했다.
- 기존 분석 조회가 저장 좌표를 사용하지 않는 점을 확인해 서버 derived blockLayouts와 Card CSS grid 연결로 수정했다. content 높이를 보장하므로 editor와 조회의 pixel 높이가 같다고 주장하지 않는다.
  -768px header가60px 넘치는 실패 캡처를 남기고 preserveChildren 경로의 중간 폭 header 줄바꿈을 보완했다. 최종 세 폭 scrollWidth==viewport, 두 Card 준비 완료 후 캡처·수치·geometry를 다시 확인했다. 일반 버튼/입력 크기를 일괄 강제하지 않았다.

## 증빙과 한계

- `/tmp/vm-block-layout/`: be-final.log, fe-final.log, type.log, be-build.log, fe-build-final.log, be/fe-lint-final.log, fixture/arranged/persisted.json, views.json, view-390/768/1440.png, resized-editor.png. raw API로그/인증정보는 packet에서 제외한다.
- Aside 기존 session artifacts: uc006-arranged/preview/reload/final-view.png, uc006-responses.json, uc006-reload/final-view.txt. 읽기 전용 XHR 관찰은 해제했다.
- 레거시 분석8 GET은 legacy-8-0을 반환하며 저장 JSON을 변경하지 않는다. 조회 시점의 레거시 index 결정 ID는 다음 명시 저장부터 유지된다.
- 모바일 자유 편집, breakpoint별 사용자 배치, 통합 undo, 전체 추가/삭제/복제 UI와 TC-005 전체 여정은 후속이다. 일반 AI 저장의 지표 snapshot/link 보존 전체도 P2 후속이며 이 검증으로 보장하지 않는다.
- 독립 review/승인·운영 배포는 미실행. 작성과 별도 의미 검토는 동일 에이전트가 수행했다. 새 배치 엔진/의존성/DB migration은 추가하지 않았다.
