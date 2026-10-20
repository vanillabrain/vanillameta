# UI-001 shadcn + Tailwind 전환 검증

상태: **COMPLETE — 로컬 UI 전환 및 대표 여정 검증** (2026-10-15). 제품 전체 TC-005 수용·운영 배포 완료를 뜻하지 않는다.

- 브랜치: `codex/shadcn-design-audit`, 기준 `e8f657fd3fee467315ff6e722c6f85004385f9ab`
- 워크트리: `/Users/drumcap/.codex/worktrees/shadcn-design-audit/vanillameta`
- 계획: [UI-001](../plans/UI-001-shadcn-tailwind.md), 디자인 기준: [UI Kit](../design/analysis-ui-kit.md), [전환 전 감사](../design/shadcn-tailwind-audit.md)
- Node24.19.0, 별도 frontend/landing 의존성, 임시 SQLite/업로드를 사용했다. 검증 포트는 앱3200/API4200/랜딩3300이다. 원본3000/4000/Rill9009 서버를 변경하지 않았다.
- 원본 체크아웃에서 병행된 UC-013 등 후속 변경은 이 기준 브랜치에 포함하지 않았다. 커밋·push·merge·배포는 실행하지 않았다.

## 최종 커밋 전 재검증 — 2026-10-15

현재 결과가 아래의 개발 단계별 이력보다 우선한다. 루트 `npm test` 전체가 BE86 suites/1,450개, FE60파일/880개 모두 PASS다(`review-root-tests-final.log`). 기존 UC-003 실패는 실제1블록에 메타데이터2개와 임의 key를 주입한 fixture를 실제2블록 저장 fixture로 바로잡았다. 최종 UUID·선택 지표 버전/AVG·미선택 snapshot/차트 동일성을 확인하므로 기대값을 임의 완화하지 않았다. 관련 BE147개도 모두 PASS다.

루트 BE+FE 빌드 및 랜딩 빌드 PASS. FE 타입 PASS. npm lockfile 설치 계획 검증(`npm ci --dry-run`)을 두 패키지에서 통과했다. 실제 새 설치 증빙은 앞선 별도 임시 디렉터리 실행을 재사용한다. 리뷰의 테스트 보완 후 SourceDetails174개 재검증, 타입/lint를 수행했다. 마지막 두 수정은 테스트에만 한정되며 전체880개를 그 뒤 다시 실행한 것으로 보고하지 않는다.

독립 리뷰3개 lane APPROVE, 별도 구조 리뷰 CLEAR. 범위·발견·조치·후속 LOW와 검증 한계는 [커밋 전 리뷰](shadcn-tailwind-review.md)를 따른다. 리뷰에서 확인한 랜딩 favicon/OG 이미지 산출물 누락을 `public/`로 이동해 해결했고 원본과 dist 바이트/해시를 비교했다. shadcn CLI는 두 package의 devDependencies로 이동하고 lockfile도 같은 분류로 갱신했다. QA 공통 상태 검사에는 실제 shadcn spinner의 가시 상태 종료 assertion을 복구했다.

## 전환 결과

공식 shadcn CLI의 Radix/nova 소스를 `frontend-web/src/components/ui`에 두고 Tailwind4 Vite 플러그인으로 빌드한다. 일반 컨트롤·오버레이·표와 TextField/Notice 조합을 포함해 production TSX 34개를 공통 기반으로 사용한다. MUI 호환 계층이나 sx 변환기를 만들지 않았다.

| 범위                      | 최종 구현                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공통/shell/인증           | Button, Input, Select, Checkbox, Switch, Dialog/AlertDialog, Sheet, 메뉴, 알림, 폼, 테이블을 shadcn + Tailwind로 전환                             |
| 대시보드/Assistant/블록   | 생성·미리보기·편집·배치·복제·undo/redo·저장 및 모바일 Assistant Sheet 전환                                                                        |
| 데이터/지표/Explore/Pivot | 파일/DB 폼, 원본 상세, 평가/계산 폼, 탐색 선택/표/저장 보기 전환                                                                                  |
| 위젯/커머스/공유          | 목록·상세·설정, 파일/결과, 공유/임베드 전환                                                                                                       |
| 랜딩                      | Bootstrap/CDN 스타일 제거, React/shadcn/Tailwind로 전환. 기존 내용·이미지25개·앵커7개·SEO 보존. 독립 npm lockfile과 Jenkins 설치/빌드 경로 반영   |
| 시각 기준                 | `src/styles/tokens.css` 공유, Pretendard, 중립 surface/border 및 indigo primary. 앱600/900/1200/1536/1920, 랜딩768/1024 반응형 기준 유지          |
| 전문 엔진                 | ECharts/Ace/react-grid-layout 유지. SQL·렌더링·좌표를 담당하며 주변 조작 UI는 전환. Toast UI Grid/react-color는 제거하고 공통 표/색상 필드로 대체 |

생산/테스트 소스의 MUI/Emotion import, sx/styled와 패키지/lockfile 의존을 제거했다. 생산 소스에서 공통 ui 밖 일반 button/table/select/textarea 잔여는 0개다. 기술적인 숨김 file input과 동적 차트 색/배치 좌표는 유지한다. `git diff --check` 통과.

## 자동 검증

| 검증                  | 결과                                                  | 증빙                                                           |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| 변경 전 FE            | 55파일 / 845 PASS                                     | baseline-tests.log                                             |
| 최종 FE 전체          | 60파일 / 880 PASS                                     | frontend-tests-final.log                                       |
| 최종 타입             | PASS                                                  | frontend-typecheck-final.log                                   |
| 최종 lint             | error0 / warning22                                    | integration-lint-final.json                                    |
| 루트 BE+FE 빌드       | PASS                                                  | root-build-final.log                                           |
| 최종 FE 빌드          | PASS; 마지막 회원가입 간격 수정 포함                  | frontend-build-final.log, signup-lint.log                      |
| FE lockfile 신규 설치 | 별도 임시 경로 npm ci 성공,1453패키지                 | frontend-clean-ci.log                                          |
| 랜딩                  | 독립 npm ci / 타입 / 빌드 PASS                        | landing-ci.log, landing-typecheck.log, landing-build-final.log |
| 핵심 격리 E2E         | 8 PASS; 마지막 표/모달 폭 수정 후 관련4개 재실행 PASS | e2e-002.log, e2e-003.log                                       |
| 폭/포커스 관련        | 14파일 /313 PASS; 마지막 Grid 관련2파일/15 PASS       | dialog-width-tests.log, grid-final-tests.log                   |

전체 FE 실행 후 마지막 회원가입 padding만 조정했다. 해당 변경은 lint·빌드와 Ego 실제 폭으로 검증했으며 전체880개를 재실행한 것으로 보고하지 않는다. 테스트를 skip/todo로 바꾸지 않았고 API payload·숫자·원자성·취소·포커스 assertion을 유지했다.

**BE 기존 실패는 별도다.** 전체85 suite 중84 PASS/1 FAIL,1437테스트 중1436 PASS/1 FAIL이다. `ai-dashboard.service.spec.ts` UC-003의 key 기대값 `first`와 실제 정규화 `block-UUID` 불일치는 UI 수정 전 원본에서도 재현했다(`backend-baseline-failure.log`). 초기 UI 전환 검증 당시 백엔드 소스는 수정하지 않았다. 이후 사용자 허용 실제 AI 재검증에서 발견한 단위 전달 누락의 국소 수정은 아래 별도 기록을 따른다. 전체 저장소 테스트가 모두 통과했다고 주장하지 않는다.

## Ego 실제 화면: 디자인과 기능

같은 **TaskSpace8**을 끝까지 재사용하고 종료했다. 390/768/1440px에서 대시보드, Explore, 데이터, 지표, 파일 분석, 커머스, 위젯 목록, 연결 폼, 로그인, 회원가입, 랜딩의 대표 화면·가로 overflow·정렬·글자·간격을 확인했다. 원본 상세/Assistant/AI 미리보기/위젯 상세/Pivot/임베드와 Rill 기준도 캡처했다. 공유 캡처는 로딩 상태가 섞여 있어 정상 화면 비교 갤러리에서 제외하고 기능 결과를 별도 기록한다.

| 실제 기능        | 확인 결과                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 인증             | 잘못된 비밀번호, 로그인, 로그아웃·확인 후 재로그인                                                                                                                                               |
| 실제 AI 생성     | gpt-6-luna로 동일 소스의 저장 지표2개를 재사용해 KPI2개/기기9개 그룹 생성. UI 미리보기→저장한 대시보드4→새로고침 후 숫자 확인. 중간 source identity 거절은 성공으로 세지 않음                    |
| 블록 보존        | 복제→undo→redo→undo. 첫 제목 직접 수정→미리보기→저장→새로고침. 기존3개 block ID와 지표 연결[1,2,1] 보존 확인                                                                                     |
| 모바일 Assistant | Sheet의 실제 backdrop/포커스/Escape, 닫고 재열어 입력 초안 보존                                                                                                                                  |
| 원본/표          | 원본 상세25행, Escape 후 원래 버튼에 포커스 복귀. 최종 모달1152px, 키보드 열 너비553.00→586.73px 실제 반영                                                                                       |
| 파일 분석        | CSV[0,42.5,-2.5]를 브라우저/서버에서 확인, SUM40. 서버 저장→데이터셋 생성→목록·3행 상세 확인                                                                                                     |
| 탐색/Pivot       | 저장 보기/새로고침/CSV/삭제(E2E), 최종 Ego 실제 shadcn 표의 합계634,513,000와5.57 USD                                                                                                            |
| 커머스           | 샘플4파일 업로드. 매출20,994.61/환불4,457.60/순매출16,537.01; 3개 폭 레이아웃 확인                                                                                                               |
| 공유             | shadcn Switch와 기간 설정, 실제 공유/임베드 숫자 확인. 익명 조회200→중지 후403. 마지막 Switch false 확인. 추가 캡처를 위한 재활성화는 자동 승인 검토가 익명 공개 위험으로 거절하여 실행하지 않음 |
| 폼/위젯/랜딩     | Oracle 연결 폼과 위젯 목록3개 폭, 실제 위젯109 숫자 상세, 랜딩3개 폭. 실제 DB 접속 성공을 뜻하지 않음                                                                                            |

실제 화면에서 발견해 수정한 회귀: 로그인 전체 높이, 숫자 ID 상세 링크, ref/포커스, 숨긴 desktop Assistant, 모바일 원본 카드 이름 폭0/overflow, 긴 AI 미리보기 footer, 모달의 responsive max-width 우선순위, 실제 열 resize, 회원가입390px 입력 폭148→300px. SourceDetails의 동기 닫힘/포커스 복귀도 회귀 검사와 실제 Escape로 확인했다.

## Rill 수치 비교

동일 Parquet SHA256 `7549d18b0294932802407f6bd851a807ff88ba1406b2958bbd8b4c261a4ee157`의1,391,572행을 독립 DuckDB oracle로 계산했다. 요청634,513,000, 가중 평균5.571238676526892(허용1e-9), Mobile/Tablet307,763,000이다. 실제 AI 저장 결과 평균5.571238676523254는 허용 오차 이내다. Rill 실제 화면635M/$5.57 및 기기 그룹과 비교했다.

Rill은 원본2023년 시간을 현재로 이동시킨다. 전체 원본이 포함되는 기간/필터 없음의 합계와 기기 그룹을 비교했으며 동일 날짜 버킷 검증으로 확대하지 않는다. API로 마련한 소스3/지표1·2 픽스처와 이후 실제 LLM 생성·저장 여정도 구분했다.

## 증빙과 한계

- 지속 보관: `/Users/drumcap/.codex/visualizations/2026/10/15/01a13d02-c56c-79d1-999c-d26e799361eb/vanillameta-shadcn/`의 `index.html`, `summary.json`,초기 검증 당시 44개 PNG(후속 캡처는 아래 추가 기록 참조)와 주요 테스트 로그. 갤러리는 로딩 공유 화면3개를 정상 비교에서 제외한다.
- 원본 상세 로그: `/private/tmp/vm-shadcn-design-audit-20261015/`. 임시 QA 실행의 e2e002/003 로그는 지속 증빙 폴더에도 복사했다. 계정·인증 토큰·AI 환경 파일은 갤러리에 포함하지 않았다.
- 미실행: 모든 차트/설정/드라이버 조합, 운영 MySQL/Oracle 연결, 포인터·터치 전체 회귀, 전체 WCAG 인증, 운영 배포. 대표 기능 보존과 UI 전환의 검증 범위이며 제품 전체 TC-005 수용 완료는 별도다.

## 추가 실제 화면 검증 — 데이터·지표·탐색·Assistant

사용자 후속 요청에 따라 Ego TaskSpace13에서 데이터 관리, Requests 지표 평가, source3 Explore, 대시보드 Assistant를 1440×1000/390×1000으로 다시 열고 캡처했다. 8개 화면의 가로 overflow는 없고 실제 이미지를 확인했다. 지표 평가634513000, Explore 요청634,513,000/평균5.57USD를 확인했다.

Assistant 추천 질문 버튼이22px로 낮게 표시되어 해당 버튼만 min-h-9/py-2와 긴 단어 wrapping을 적용했다. 수정 후 실제 높이38px, label overflow 없음, 추천 질문 선택 시 입력창 자동 채움 및 모바일 전환 시 입력 보존을 확인했다. 관련 `DashboardAssistant.test.tsx`23개, 해당 파일 lint, FE 빌드 통과. CSS 국소 수정이므로 기존 전체880/E2E8 검증을 반복하지 않았다. 빌드에는 격리 API `REACT_APP_API_URL=http://127.0.0.1:4200/v1`을 명시했다.

실제 AI 질문 전송은 자동 승인 검토가 데이터의 AI 처리 경로 전달을 이유로 거절하여 실행하지 않았다. 이번 확인은 UI/추천 질문 입력까지이며 실제 응답 재검증 PASS로 확대하지 않는다. 추가 증빙은 같은 저장소 밖 증빙 폴더의 `additional-screens.html`, `review-{data,metric,explore,assistant}-{1440,390}.png`, `additional-screens.json`, `assistant-review-{tests,lint,build}.log`에 있다.

## 사용자 허용 후 실제 AI 질문·응답·수정 미리보기

테스트 데이터의 AI 전송을 사용자가 명시 허용한 후 Ego TaskSpace15에서 source3/대시보드4로 실행했다. 실제 질문 응답은 요청634,513,000, 최대 기기Mobile/Tablet307,763,000 및 조회 범위·잘린 추세169개 중120개 제한을 설명했다. 최초 답변에서 화면의 USD 단위를 모른다고 응답하는 문제를 발견했다.

원인은 `previewContext`가 화면에 저장된 prefix/suffix/decimalPlaces/numberNotation을 AI 근거에서 제외하는 것이었다. 해당4개 검증된 속성을 전달하고 설정 단위를 사용하도록 프롬프트를 보완했다. 기존 실제 DuckDB/비저장 테스트에 USD 근거 assertion을 추가해 수정 전 실패를 재현했으며 수정 후 관련3개(비저장·필터·단위 보존)가 통과했다. BE 빌드 PASS, 수정 파일 lint error0/warning6(기존 항목)다. 전체 BE/FE suite는 반복하지 않았다.

이 작업 소유의 격리 API4200만 재시작했다. 수정 후 실제 AI 답변은 원값5.5712386765232536/화면 표시5.57 USD를 설명했다. AI에 단위가 전달되는 것을 실제 응답에서 재확인했다. 소스·수치·SQL·저장 동작은 이 수정에서 바꾸지 않았다.

UI에서 첫 차트를 선택하고 제목만 `전체 기간 요청 합계 · AI 미리보기 검증`으로 변경하는 실제 AI 미리보기를 요청했다. 최종 백엔드에서도 다시 실행해 새 제목, 요청634,513,000, 평균5.57 USD, 기존 기기 차트 및 계산식 표시를 확인했다. 변경 적용/취소는 활성이고 모바일 내부 스크롤로 접근할 수 있다. 별도 탭에서 원본 제목이 유지됨을 확인했으며 변경 적용·저장은 실행하지 않았다.

1440×1000/390×1000의 실제 응답·미리보기·하단 버튼 캡처를 직접 확인했다. 긴 텍스트·숫자·범주·SQL과 고정 입력 footer에 새 겹침/가로 overflow는 발견하지 못해 추가 스타일 변경은 하지 않았다. 앞선 추천 질문22→38px 보완은 유지된다. 실기기 키보드/터치·모든 높이 조합은 미실행이다.

지속 증빙 폴더의 `actual-ai-validation.html/json`, `ai-response-{1440,390}-final.png`, `ai-preview-{1440,390}-final.png`, `ai-preview-actions-390-final.png`, `ai-question-response-after.txt`, `ai-preview-evidence.json`, `assistant-unit-{context-before,context-after,backend-build,backend-lint}.log`를 따른다. Ego 응답과 저장 전 미리보기 탭을 사용자 확인용으로 유지하고 작업을 종료했다.

## 계속 요청 후 실제 적용·저장·새로고침

사용자의 계속 요청으로 기존 Ego 공간15를 이어받아 대시보드4의 미리보기를 적용했다. 첫 저장에서 제목·수치·ID/배치는 유지됐지만 구조화 지표[1,2,1]와 차원 연결이 사라졌다. 읽기 API의 전후 비교로 발견했으며, UI 숫자만 보고 보존 PASS로 판정하지 않았다.

원인은 `AiDashboardService.save`가 명시 snapshot 없는 저장에서 structuredDefinition을 null로 지우는 것이었다. 기존 `metric-analysis-links.ts`에 보존 처리를 추가했다. 같은 소스·최종 blockId·기존 snapshot key, 정확히 같은 SQL/valueField/categoryField/type인 항목만 전체 메타데이터를 보존한다. 재정렬·삭제는 ID로 대응하고, 새/복제 블록의 링크는 추정하지 않는다. 명시 snapshot을 전달하는 지표 계산식 저장·일괄 저장은 기존 계약을 우선한다. 손상 JSON은 안전하게 연결 없음으로 처리하고, 모호한 다중 블록 키·버전·소스는 보존하지 않는다. 지원되는 레거시 링크는 읽을 수 있는 v2 형식으로 변환한다.

별도로 선택 차트의 제목을 무조건 유지하도록 하던 생성 지시문이 제목 변경 요청과 충돌하는 것을 확인했다. 명시적 이름 변경은 요청한 제목을 사용하도록 고쳤다. 제목이 바뀌지 않은 AI 미리보기는 적용하지 않았다.

최초 회귀는 수정 전 FAIL로 재현했다. 최종 관련25개(실제 DuckDB/메타데이터 저장, UC-004/006, 단위/필터/비저장, 제목 변경, 삭제/복제/차원/소스/버전 경계)가 PASS다. BE 빌드 PASS, 수정4파일 lint error0/warning6(기존 항목), diff check PASS. 기존 전체 FE880/E2E8 및 전체 BE를 재실행한 것은 아니다. 독립 읽기 리뷰를 반영했다.

기존 BI 편집 API와 현재 revision으로 실패 때 잃은 테스트 지표 연결을 복원했다. 최종 코드에서 실제 Ego AI 제목 변경 미리보기→변경 적용→저장→새로고침을 다시 실행했다. 첫 제목 `전체 기간 요청 합계 · AI 저장 검증`, 요청634,513,000/평균5.57 USD가 유지됐고 전후 API 비교에서 block ID, 지표[1,2,1], 나머지 모든 item, 첫 item의 제목 외 모든 필드가 동일하며 revision만 변경됐다. 소스/저장 지표 정의도 동일하다. 이번에는 실제 저장까지 PASS다.

1440×1000/390×1000 실제 캡처를 확인했다. 긴 제목·큰 숫자·주변 버튼에 새 겹침/가로 넘침은 없었다. Ego에 저장 후 화면을 유지했다. 지속 증빙 폴더의 `actual-ai-save-validation.html`, `ai-saved-reload-{1440,390}-final.png`, `ai-save-confirmed-1440.png`, `ai-links-saved-final.json`, `assistant-links-{before,tests-final,build,lint}.log`를 따른다. 최초 실패 전후(`ai-apply-before.json`, `ai-apply-after.json`)도 분리 보관한다.

제한: SQL 문자열이 다시 작성되면 의미상 동등해도 연결을 해제할 수 있다. 기존 편집기와 같은 보수적 기준이며 임의 SQL 정규화/자동 연결은 하지 않았다. 키 없는 다중 블록의 과거 연결 복구, 전체 기기/모든 뷰포트/운영 배포는 별도다.
