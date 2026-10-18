# Studio 집계 Pivot 블록

2026-10-18 · [계획](../plans/studio-pivot.md) · P1/P3/P4/P5. 최종 상태는 아래 실행 결과를 우선한다. 최초 정의 당시 아래 신규 조건은 NOT_RUN이었다. 과거 RXS02 집계·셀 기여 원본·CSV PASS는 재사용하며 이 문서의 Studio 통합 완료로 간주하지 않는다.

## 고정 입력과 정답

`samples/rill-scenarios/data/margin.csv` 18행. 소유 source4 / 분석3 `VM 마진 데모` / 개인 보기1(고객 매출≥1000 AND 마진<20%, component Pivot, 지표1·4). 자격 고객 Hanul/Baro, 기여8행. 매출5431.25 USD, 이익292.79 USD, 마진 `292.79/5431.25*100 = 5.390840046029919%`. 셀 비율을 더하지 않고 기여 원본으로 합계를 다시 계산한다. Baro×Compute 매출640.50/이익−81.90/마진−12.7868852459%. 기존 Rill 대조 수치는 [RXS02](rill-scenarios.md)의 동일 입력 증빙을 재사용한다.

## 신규 MD 조건

| ID | 절차 / 기대 결과 | 상태 |
|---|---|---|
| SP-01 | 본인 저장 보기에서 같은 소스 집계 Pivot 선택 → 초안에만 추가(쓰기0) → 제목/크기/순서 편집·undo/redo → 전체 미리보기 → 명시 저장 → reload. 기존5차트 정의/ID 불변, Pivot은 안정 새 ID·recipe와 세 폭 배치를 보존. 숫자는 독립 정답과 일치. | 아래 PASS_SELECTED 참조 |
| SP-02 | 저장본 게시 → 익명 화면/reload → 소유 초안 수정에도 게시본 불변 → 명시 재게시/중지. 표는 snapshot만 사용하며 SQL·원본 행·소스/지표 ID·private recipe·토큰 유출0. | 아래 PASS_SELECTED 참조 |
| SP-03 | 같은 소스의 저장된 혼합 문서를 비공개 복제 → 새 dashboard/block ID와 세 폭 배치 보존 → 미리보기·저장/reload → 같은 정답 대조. 원본/원본 게시 불변·미저장 초안 제외. 다른 소스/수신자 remix 미지원은 저장 전 차단. | 아래 PASS_SELECTED 참조 |
| SP-04 | 390/768/1440 화면에서 추가/표/설정/게시·복제 결과 확인. Tab/Enter/Escape·제목/순서/크기·표 Home/End. 문서 가로 넘침0, 표 내부만 가로 스크롤, 버튼36px·도구32px, 긴 제목 줄바꿈·수치 정렬·포커스 가시성. | 아래 PASS_SELECTED 참조 |
| SP-05 | 다른 소스 보기/낡은 지표 버전/변조 recipe/클라이언트 결과·SQL 거절, 조건 미지원 조합 보존형 안내. 저장 CAS·영수증 재시도는 중복 생성0. | 아래 PASS_SELECTED 참조 |

각 조건은 실제 실행 범위를 기록한 뒤에만 PASS로 올린다. 단위/API PASS와 실제 UI/디자인 PASS를 구분한다. 실제 휴대폰/VoiceOver BLOCKED·운영 MySQL/일반 Pivot 전체·임의 AI 문장 전체는 이번 선택 검증에 포함하지 않는다. gpt-6-luna 설정은 유지하며 Pivot 직접 조작을 AI 실행으로 보고하지 않는다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-20261018/`. 최초 Ego 공간32, 사용자 승인 후 실제 후속은 공간33. 초기 화면 `before-1440.png`는 기능 구현 전 기준이며 완료 증빙이 아니다.

## 2026-10-18 실행 결과 — Ego33

기준 HEAD `c13773b867411e511b23b0c233a654233a0fa126` + 이번 Pivot 미커밋 diff. 누적 변경/원격 통합은 이 HEAD까지 **drumcap으로 develop-v2 push 완료**다. 아래 신규 Pivot 구현/증빙은 그 뒤의 변경이며 앞선 push에 포함됐다고 보고하지 않는다.

사용자 승인으로 사라진 공간32 대신 Ego33 `VM Studio Pivot continuation 20261018`에서 실행했다. API `127.0.0.1:4560`, Vite `localhost:3460`, Node24.21.0, 격리 로컬 SQLite `/tmp/vm-rxs-demo/metadata.sqlite`와 기존 DuckDB 파일을 사용했다. 마지막 root build 후 작업 소유 API만 재기동하고 저장본을 다시 조회했다. gpt-6-luna 설정은 유지했으며 이번 직접 Pivot 조작에 실제 AI 호출은 없다. 과거 Rill 동일 margin 집계/CSV/기여 원본 PASS는 재실행하지 않았다.

| ID | 최종 판정 | 실제 실행 범위 / 제한 |
|---|---|---|
| SP-01 | PASS_SELECTED | 소유 분석3의 기존5차트 + 저장 보기1 → 초안6개/서버5개 → Tab/Enter 추가·undo/redo·전체 미리보기 → 제목/세 폭 크기·방향키 배치 → 명시 저장/reload. 원래5개 블록 정의/ID/SQL/배치 불변. 안정 Pivot ID `2e89dad5-a03a-4629-9f7a-eb19c0ce6bf8`. 중간에 끼운 혼합 순서는 API 분석24에서도 저장/reload·영수증 replay로 확인. |
| SP-02 | PASS_SELECTED | 분석24의 게시1 → 익명 HTTP200/whitelist → 소유 저장 제목 수정에도 공개 snapshot 불변 → 같은 URL 재게시2 → 중지410. 실제 UI에서는 분석3의 링크 게시1/새 탭 표·reload·390/768/1440 → 명시 중지/오류 안내를 확인. 테스트 링크 모두 최종 중지. 이번 신규 Pivot의 만료 시각/다중 서버 게시 경합은 미실행. |
| SP-03 | PASS_SELECTED | API24→25 및 UI3→26 같은 소스 비공개 복제. 새 dashboard/all block ID·복제 시점 모든 폭 좌표·recipe·정답 보존, 추가 지표0. UI 원본의 임시 제목·미전송 질문·URL 유지, 실제 copy 요청1. 복사본26에는 미저장 제목 제외·reload 확인. 임시 원본 편집은 undo/질문 비우기로 복원. 다른 소스/수신자 remix는 지원하지 않으며 쓰기 전 거절. |
| SP-04 | PASS_SELECTED / native 선택 키 일부 NOT_RUN | 390/768/1440 소유·게시·복사본 대표 화면/넘침0. Tab/Enter 추가·preview/save·복제/새 탭 열기, Escape 패널 닫기, Pivot handle Down(62px)/Up(원위치), 표 Home/End·가시 포커스를 확인. **저장 보기 native select의 ArrowDown/End 선택은 Ego 키 입력으로 값이 바뀌지 않아 자동화 제한으로 남겼다.** 실제 선택은 문서화된 selectOption 후 버튼을 키보드로 실행했다. 따라서 전체 키보드 수용 PASS는 아니다. 실제 휴대폰/VoiceOver는 미실행·기존 BLOCKED 유지. |
| SP-05 | PASS_SELECTED | 실제 API 낡은 지표 참조·recipe SQL400/쓰기0; SQLite 회귀의 Pivot-only/변조·AST/HAVING 미지원·legacy 누락 방지·소유권/epoch/복제 영수증/지표 삭제 보호. 실제 운영 MySQL·모든 동시 경합은 미실행. |

### 정확한 숫자와 범위

독립 CSV Decimal 정답은 대상8행, 매출 **5431.25**, 이익 **292.79**, 마진 **5.390840046029919%**다. 화면 5,431.25 USD/5.39%와 API 정밀값이 일치한다. Baro×Compute는640.50/−12.7868852459%. 셀 비율을 더하지 않는다.

추가 읽기 전용 미리보기에서 저장 보기2의 기간+Compute는3460/12.774566473988438%, 저장 보기3+공통 company=Baro는640.50/−12.786885245901642%, 공통1월6–7일 대체는 대상0건이다. 분석25 저장 문서는 바뀌지 않았다. owner preview에는 원본 details가 없고, 공개 snapshot에는 SQL/source/metric/private recipe/conditions/token이 없으며 공개 지표 번호는 익명1·2로 치환된다. 공개 화면의 데이터 요청은 snapshot GET뿐이며 소스 집계 요청이 없다. 익명 접근 판정은 인증 헤더 없는 HTTP로 별도 실행했다.

API 전후 대조로 기존 **42개 지표 행 전체 불변**, 분석3의 원래5차트 정의/ID/배치 불변을 확인했다. 복사본26은 복제 당시 h10을 유지하며 이후 원본의 명시 크기 조정(md/lg h8)을 따라 자동 변경되지 않는다. 새 비공개24·25·26은 검증 자료로 보존했다. 분석3·24의 이번 임시 공개 링크는 모두 revoked/익명410이다.

### 발견·수정한 디자인/흐름

1. 작은 기본 카드에서 설명/표가 별도 세로 스크롤로 나뉨 → 새 Pivot 기본 전체 폭, xs h10·md/lg h8로 조정. 기존 저장 좌표는 자동 변경하지 않고 실제 화면의 기본 크기로 명시 적용·저장했다. 최종 카드606px/482px, body514/398/390px와 scrollHeight가 같아 중첩 세로 스크롤0. 표 내부 가로 폭639px/모바일332px이며 페이지 가로 넘침0.
2. Inspector 내부 `지표1 gte1000` 노출 → `총매출 ≥ 1,000 USD · 마진 < 20%`로 표시. 제목/설명36px·본문14px·블록 도구32px의 기존 테마/배치 유지.
3. 복제 성공 시 원본 페이지 이동 → 원본 초안·질문을 유지하고 완료 카드의 **복사본 Studio 새 탭에서 열기**로 변경. 완료 후 재오픈은 재생성 버튼 대신 기존 결과를 제공한다.
4. Pivot 게시에서 지원하지 않는 수신자 재사용 선택은 비활성 안내로 구별한다. 같은 소스의 Studio 저장본 복제와 구분하며 서버 거절 계약은 유지한다.

최초 실패 캡처 `inspector-before-390.png`, `pivot-draft-390.png`는 수정 전 증거다. 최종 `inspector-fixed-390.png`, `pivot-final-390.png`, `pivot-final-768.png`, `pivot-final-1440.png`로 재검증했다. 과거 `picker-390.png`/`picker-keyboard-390.png`는 native 옵션 선택 성공 증거가 아니며 실제 선택/추가 증거는 `picker-selected-390.png`다.

### 하위 검사와 증빙

- BE 관련7파일221개, AI/reuse4파일72개, metric deletion45개 PASS(일부 중복, 합산하지 않음). 신규 실제 SQLite/DuckDB 통합4개 PASS. 마지막 폭별 높이 operations56개 PASS. BE lint/build PASS.
- FE 관련44파일534개, 최종 응답 계약5파일48개·디자인/높이 선택 회귀 PASS(중복 합산 안 함). 타입/변경 lint PASS. 최종 root API+FE build PASS. 게시 지원 안내 후속 검사는 아래 최종 부록에 기록한다.
- 이전 통합의 core16개와 business-basis 선택1개 PASS는 변경 없는 일반 흐름의 증거로 재사용한다. 신규 Studio 흐름은 위 실제 API/Ego로 검증했으며 core 전체를 새로 실행했다고 보고하지 않는다. 전체 BE/FE 수천 건을 반복하지 않았다.
- 독립 reviewer 역할 호출은 현재 도구에서 지원되지 않아 실행되지 않았다. 부모의 집중 diff/원본 보존 대조와 테스트 결과를 독립 리뷰라고 보고하지 않는다.

[전체 증빙 폴더](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-20261018/): `api-flow-01-private.json`(혼합순서/저장), `api-flow-02-private.json`(복제/게시), `api-scope-03-private.json`(조건), `final-audit-private.json`(불변·정확값·중지), `compact-layout-keyboard.json`/`final-browser-layout.json`(배치·넘침), `copy-browser.json`(초안/질문 보존), `public-browser.json`(snapshot 조회).

`browser-save-network.json`의 XHR 감시를 두 번 감싼 흔적은 실제 중복 요청으로 판정하지 않았다. 브라우저 performance resource로 실제 preview1/save1을 대조했으며 복제도 copy1이다. 스크린샷과 실제 요청/DB 판정은 분리한다.

실제 휴대폰/VoiceOver·운영 MySQL·일반 다축 Pivot 전체·다른 소스 매핑/수신자 remix·Pivot-only·새 AI 계산식/전체 TC005·고객 수용은 이번 선택 검증의 완료 범위가 아니다.

### 최종 게시 지원 안내 후속

`StudioPublish`의 원본 저장본에 Pivot이 있을 때만 수신자 재사용을 체크 해제/비활성화하고 같은 소스 복제 안내를 표시했다. 별도 생성 대시보드의 게시 대상에는 원본 Pivot 제한을 잘못 적용하지 않으며, 이미 전송한 pending 요청의 동일 envelope는 바꾸지 않는다. 관련2파일19개·type/lint PASS, FE 최종 build PASS다. 실제390px 대화상자358×588.19px·주요 버튼36px·넘침0·체크false/disabled를 확인했고 새 게시를 반복하지 않았다(`publish-support-390.png`, `publication-support-ui.json`). root build의 BE와 최종 FE build 결과를 함께 사용하며 앞선 게시/복제 수치 테스트는 관련 변경 없이 재사용한다.

최종 실제 저장본 URL: `http://localhost:3460/dashboard/3/studio`, 비공개 복사본: `http://localhost:3460/dashboard/26/studio`. 모델 설정/인증정보는 커밋하지 않는다. 검사 로그는 `/tmp/vm-studio-pivot-root-build-final.log`, `/tmp/vm-studio-pivot-fe-build-last.log`, `/tmp/studio-pivot-breakpoint-height-test.log`, `/tmp/vm-studio-pivot-responsive-height-tests.log`, `/tmp/vm-studio-pivot-publication-remix-{tests,type,lint}.log`다. 최종 소스 파일별 SHA256·HEAD·재사용 범위는 외부 증빙 `manifest.json`에 기록한다.
