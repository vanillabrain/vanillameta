# KPI 현재/이전 추세 겹쳐 보기

2026-10-14, develop-v2 / 21d87990 + 작업 diff 기준. FE만 변경하며 API·기간 계산·개인 보기 스키마는 유지한다.

UTC 일별·동일 길이·동일 날짜 컬럼의 현재/이전 응답을 선택 기간 시작점 기준으로 정렬한다. 공통 Y축은 0과 두 기간의 관측값을 포함한다. 현재 실선/이전 점선과 범례를 표시하고 NULL/누락 날짜는 연결하지 않는다. 고립된 점도 표시한다. 원래 날짜와 원본 조회는 기존 각 기간의 표/추세를 유지한다. 주/월·timestamp 정밀도·불일치/중복/범위 밖 버킷은 겹치지 않고 안내한다. 240일 초과는 기존 표시로 돌아간다.

| 검증                                                            | 결과                                                                                               |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 공통 축·기간 시작 정렬·누락/NULL·음수·한 점·빈 기간·잘못된 버킷 | PASS: comparisonTrend 고정 정답                                                                    |
| 점선 표시·비교 해제 제거·이전 값만 있음·주별 안내               | PASS: 컴포넌트 검사                                                                                |
| 기존 MetricTrend 기간 선택/원본 조회                            | PASS: 관련 회귀와 신규 검사 합계31                                                                 |
| DashboardAnalysis/SourceDetails 현재·이전 원본 조회 조건        | PASS: 기존174개 회귀, 실제 XHR 검증 아님                                                           |
| 타입·변경 파일 eslint·FE production build·diff check            | PASS; 기존 Vite/CSS 빌드 경고 존재                                                                 |
| Aside 실제 고정 입력 화면                                       | PASS_SELECTED_VARIANTS: 공통 축/고립 점, 이전 날짜 callback, 주별 안내, 해제시 점선0개             |
| 실제 서버 preview/원본 조회 XHR                                 | NOT_RUN: 이번 브라우저의 기존 DB에는 해당 비교 대시보드 fixture가 없어 컴포넌트 고정 입력을 사용함 |
| 390px 모바일·전체 키보드 흐름·VoiceOver                         | NOT_RUN: Aside setViewportSize 미지원; 이를 모바일 통과로 대체하지 않음                            |

Aside 연결은 이번에 정상 복구했다. 화면 입력은 현재01-05=10/01-06=20, 이전01-01=100/01-03=0이고 각 기간은01-04~06/01-01~03이다. 비교 그림의 현재 점 좌표는(300,47.6)/(596,43.2), 이전은(4,8)/(596,52)이며 누락된 이전 둘째 날은 연결되지 않는다. 이전 원본 버튼은 원래01-01 callback을 보냈다. 이는 실제 API 숫자/소유권 검증이 아니다.

화면 증빙과 재현 입력은 `/tmp/vm-overlay-evidence/desktop.png`, `overlay-verification.html`, `overlay-verification.tsx`다. 재현용 임시 페이지/모듈은 저장소에서 제거했고 기존 사용자 데이터는 변경하지 않았다. 개발 중 테스트의 MUI styled-engine 초기화 실패는 기존 테스트 방식의 MUI mock을 적용해 해결했다. 최종31개와 타입/린트는 고립 점 보정 뒤 재검사했다. 최종 보정 후 production build도 다시 통과했다.

기능 코드는 구현했으며 실제 대시보드/API와 모바일 인수 검증은 남아 있다. SSBI 전체 완료나 기존 카탈로그 통과로 확대하지 않는다.

## 실제 서버/XHR·390px 후속 검증 (2026-10-14)

기존 FE3683/API4883, 서버 DuckDB worker와 metadata.db를 재사용했다. 브라우저 로그인 토큰은 추출·파일 저장하지 않았다. 자동 승인 검토가 토큰 파일 저장 요청을 거절했으며 제품의 업로드→지표→미리보기→대시보드 저장 화면으로 검증 데이터를 준비했다. 새 검증 자원은 source3/metric1/dashboard2이고 후속 시간대 검증에 재사용하도록 남겼다. 기존 dashboard1/commerce8은 변경하지 않았다.

- **PASS 실제 preview/XHR**: 4행 CSV의 전체130, 현재01-04~06=30, 이전01-01~03=100, 차이−70/−70%. 일별 현재 점10/20, 이전 점100/0을 실제 HTTP201 응답과 대조했다. 누락 날짜를 정답0으로 바꾸지 않았다.
- **PASS 실제 이전 시점 details/XHR**: period=previous, 원래 timestamp01-01T00:00:00Z와 이전 groupFingerprint로 요청했다. 현재 비교 기준01-04~06은 유지하고 응답은 이전01-01/amount100 원본1행이다.
- **PASS 실제 현재 시점 details/XHR**: 390px 화면에서01-05 원본 버튼으로 amount10 원본1행을 조회했다. 닫기 후 해당 버튼 초점 복귀를 snapshot으로 확인했다.
- **PASS_SELECTED_VARIANTS 반응형**: Aside의 viewport API 미지원 대신 같은 origin/로그인 세션의 실제 dashboard2를390×844 iframe viewport로 실행했다. innerWidth390, client 문서 scrollWidth375(스크롤바 제외), SVG309px. 비교값·축·범례·원본 버튼이 카드 안에 보이고 문서 가로 overflow가 없다. 실제 기기 터치/OS 키보드/VoiceOver 검증으로 확대하지 않는다.

Aside waitForResponse도 미지원이라 apiHelper에 임시 응답 관찰 코드를 넣었다. preview/details URL·HTTP status·JSON body만 기록했고 Authorization/cookie/header는 기록하지 않았다. 실제 요청이나 응답 내용은 변조하지 않았다. 종료 후 apiHelper는 원본과 동일하게 복원했고 임시 iframe 페이지/전용 탭을 제거했다. 제품 코드는 이번 후속에서 수정하지 않아 앞선31+174/타입/린트/build 결과를 재사용했다.

증빙: `/tmp/vm-overlay-evidence/live-xhr.json`, `mobile-xhr.json`, `live-desktop.png`, `live-mobile.png`, `overlay.csv`, `mobile-frame.html`. Python으로 응답의 현재/이전 시점 배열·비교값·원본1행을 CSV 고정 정답과 assert 대조했다. 인증정보는 증빙에 없다. 위 초기 NOT_RUN 기록 중 실제 preview/details와390px selected variants는 이번에 해소했으며 전체 키보드/VoiceOver는 남는다.
