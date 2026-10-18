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

## 2026-10-19 후속 계획 — SP-06

SP-06: 비공개 테스트 복사본25에서 기존 Pivot을 초안에서만 제거해 추가 공간을 만든다. 저장 Pivot 목록 GET만 해당 탭에서 통신 실패시킨다. 기존5개 초안·미저장 안내 보존/추가 비활성·오류 안내 → 차단 해제 → 명시 다시 읽기/목록 복구 → 취소/초안 undo로6개 복원. 저장·게시·복제 POST0, 서버 dashboard25/Studio문서/지표·영수증·게시 개수 불변을 확인한다. 최초 실행 전 NOT_RUN이며 기존 SP01~05 전체를 반복하지 않는다.

## 2026-10-19 실제 후속 결과 — Ego34

**최신 Git:** 기존48개 파일의 SHA256이 전날 manifest와 모두 일치함을 먼저 확인해 통과한 전체 테스트는 반복하지 않았다. Pivot 구현/기록은 `d40454b0`으로 커밋했고 원격 `e27d7607`·`f5f9a230`·`d8518702`의 업무 기준/MySQL 증빙·직원 조직 이관 변경을 충돌 없이 보존 병합했다. 병합본 **`21220bba`까지 drumcap으로 develop-v2 push 완료**다. 위의 ‘신규 Pivot 미커밋’ 표기는2026-10-18 실행 당시 상태이며 현재 상태가 아니다.

원격 공통 권한/Studio 기준 영향만 선택해 BE3 suites **50 PASS/6 SKIP**(MySQL 변형 미실행), FE 직원 이관24 PASS·타입·루트 API/FE build PASS를 확인했다. 기존 Pivot/Rill/CSV·게시 전체를 반복하지 않았으며 이번에도 운영 MySQL 전체를 통과했다고 하지 않는다. 로그 `/tmp/vm-pivot-followup-merge-{be,fe,build,type}.log`를 따른다. 작업 소유 API만 새 빌드로 재기동했고 모델 설정은 그대로다.

### SP-04 native 선택 키 재확인

Ego34의390px·활성 native select에서 실제3개 보기/disabled false를 확인했다. ArrowDown/Enter, keyCode40을 명시한 CDP 진단, Alt+ArrowDown/Enter에도 value는 빈값이었다. 수신 이벤트는 trusted/keyCode40/defaultPrevented false였다. **선택 키는 자동화 한계로 NOT_RUN 유지**하며 제품 결함 확정이나 성공으로 바꾸지 않는다. DOM value 변경·selectOption으로 이 조건을 대체하지 않았다. 실제 휴대폰/VoiceOver의 상태도 유지한다. `native-key-diagnostic.json`, `native-keyboard-390.png` 참조.

### SP-06 PASS_SELECTED — 실제 통신 실패와 명시 복구

비공개 복사본25의 Pivot을 초안에서만 제거하고 `http://127.0.0.1:4560/v1/studio/dashboards/25/pivot-options` GET만 해당 탭의 CDP Network 차단으로 실패시켰다. HTTP503을 응답한 것은 아니며 실제 브라우저 통신 실패 변형이다. 오류 안내/‘다시 읽기’/추가 disabled와 기존5개 블록 ID·미저장 상태 보존을 확인했다. 차단 해제 후 포커스된 재조회 버튼의 Enter 실행로 선택지3개+placeholder가 복구됐고 페이지 넘침0이었다. 이후 취소·undo로 저장된6개 상태를 복원했다.

기록한 비GET XHR은 **0개**였고 별도 DB 전후 비교에서 dashboard25/Studio 문서·metric42/dashboard26/studio_run24/studio_publication5가 모두 불변이었다. 해당 탭의 네트워크 차단은 finally에서 해제했다. 새 게시·복사본·지표를 만들지 않았으며, 로그인 세션 갱신을 자산 저장으로 세지 않는다. 임시 UI 편집은 최종 복원했다. 제품 코드 변경은 없으므로 이전 숫자/저장·게시 테스트를 재실행하지 않았다.

대표390px의 오류/복구 화면을 직접 확인했다. 추가 HTTP 상태/지연 경합·다른 폭의 오류 상태·원래 남은 native 선택 키/실휴대폰/VoiceOver·운영은 이 조건의 선택 PASS로 승격하지 않는다.

증빙: [2026-10-19 폴더](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-followup-20261019/), `picker-read-error-390.png`, `picker-read-recovered-390.png`, `read-recovery.json`, `read-recovery-db.json`. 이 후속은 문서/증빙만 추가하며 전체 제품 수용은 Open이다.

## 2026-10-19 후속 계획 — SP-07 게시 만료

P4의 남은 선택 조건이다. 비공개 샘플 복사본26(일반 차트5+집계 Pivot)의 저장본에 새 테스트 링크/가까운 미래 만료를 명시 설정한다. 만료 전 공개 snapshot GET200·5431.25USD/5.390840046029919% → 실제 서버 시간의 만료 후 익명 GET410·공개 화면의 집계 제거/안내 → 소유자 저장본 조회200/원본 정의·지표·배치 불변을 확인한다. 자동 시간 경계와 reload 뒤 차단을 구별하고390px 만료/포커스/넘침0을 캡처한다. 기존 저장·복제·재게시 전체를 반복하지 않으며 VoiceOver/실기기/운영은 미검증 유지다. 최초 실행 전 NOT_RUN.

## 2026-10-19 SP-07 실제 결과 — Ego35

**PASS_SELECTED: 명시 API 만료 설정·공개 자동 만료·reload/소유본 보존. native 날짜 입력부터의 전체 UI 흐름은 미검증.** 기준 `f58ab617` + 공개 재조회 버튼 포커스 수정이다. 기존 SP01~06·Rill 숫자/CSV·전체 core는 반복하지 않았다. VoiceOver BLOCKED·gpt-6-luna·실기기/운영/전체 수용 상태는 유지한다.

### 만료값 설정 경계와 실제 시간

처음 Ego의 `datetime-local` fill 후 표시된 값이 React 게시 요청에 반영되지 않았고 `expiresAt`가 빠진 version1/2가 생성됐다. 진단에서 DOM 입력값은 보였지만 다음 렌더/실제 요청은 빈값이었다. 따라서 **날짜 UI 입력 성공으로 판정하지 않는다.** 제품 소스는 onChange→현재 expiry→ISO 요청을 사용하지만 실제 사람 입력을 확인하지 않았으므로 도구 한계와 제품 오류를 단정하지 않는다. DOM 값/React 상태 강제 변경이나 다른 모델로 우회하지 않았다. 이 두 초기 게시본은 성공 증거가 아닌 입력 진단이다(`expiry-input-diagnostic.json`, `expiry-config-390.png`, `anonymous-before-private.json`).

같은 샘플 복사본26/같은 링크를 기존 테스트 세션의 명시 API 요청으로 version3 재게시해 **`2026-10-18T16:58:21.433Z`(한국 2026-10-19 01:58:21.433)** 만료값이 실제 응답/DB에 일치함을 확인했다. 이는 UI 날짜 입력을 통과시킨 대체 증거가 아니라 분리한 서버/API 설정 변형이다. 인증값은 출력/커밋하지 않았다.

- 16:57:37 GMT, 인증 헤더 없는 GET **200**, 매출5431.25/마진5.390840046029919% 정확값 일치.
- 실제 시간의 만료 후 **16:58:21.497Z**에 이미 열린 공개390px 화면이 자동 GET410/차트·Pivot·합계 제거/만료 안내로 전환됐다. Network resource는200→410이며 강제 서버·브라우저 시계 변경이나 만료 전 수동 revoke는 없다.
- 별도 익명 GET410을 확인할 때 DB `revokedAt`는 여전히null이어서 **만료 자체에 의한 차단**임을 구별했다. 새로고침 후에도 데이터 없이 차단 안내를 표시했다.
- 소유자 저장본은 GET200/6블록/동일 정답이며 dashboard26·studio_state·42개 Metric 전체가 불변이다. 만료 판정 뒤 이번 테스트 링크만 revoke201로 정리했다. 공개 원본 데이터/새 소스·지표·복사본은 만들지 않았다.

### 발견한 키보드 오류와 수정·재검증

만료 화면의 ‘다시 확인’을 Enter로 실행하면 조회 중 native disabled 처리로 브라우저 포커스가 BUTTON→BODY로 사라지는 것을 실제 응답 완료 후 재현했다. 버튼을 포커스 가능한 상태로 두고 `aria-disabled`/`aria-busy`로 읽기 상태를 알리며 로딩 중 재실행은 거절하도록 좁게 수정했다. 자동 만료/권한 조회·snapshot 계산·저장 API는 변경하지 않았다.

신규 회귀를 먼저 실행해 기존 disabled 동작에서1개 실패(red)를 확인했고, 수정 후 관련3파일 **11 PASS**(신규1/공개 블록4/경로6)·FE type/lint/build가 통과했다. 로딩 중 중복 클릭에 추가 읽기0·조회 후 포커스 유지를 확인한다. 실제390px Enter 재조회도 응답 전후 BUTTON/‘다시 확인’ 유지, `:focus-visible` true·집계 없음·가로 넘침0이다. native 날짜 UI는 이 수정으로 해결됐다고 보고하지 않는다.

증빙: [만료 검증 폴더](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-expiry-20261019/). 성공 기준은 `confirmed-setup.json`·`confirmed-anonymous-before-private.json`·`confirmed-before-expiry-390.png`, `browser-expired.json`·`automatic-expired-390.png`, `anonymous-after.json`·`owner-and-cleanup.json`이다. `refresh-focus-before-fix.json`과 `refresh-focus-after-fix.json`/`keyboard-retry-fixed-390.png`로 오류 전후를 구별했다. 초기 재조회 스크립트의 단순 alert 대기는 이전 alert를 관찰할 수 있어, 최종 검증은 새 resource 완료+busy false를 기다려 판정했다.

검사 로그 `/tmp/vm-pivot-expiry-focus-{red,green}.log`, `/tmp/vm-pivot-expiry-{type,lint,build}.log`. 제품 변경은 FE 버튼 한 곳·회귀1개이며 BE/전체 단위/전체 E2E를 반복하지 않았다. 실제 사람의 native 날짜/방향키·다른 폭의 만료/모든 권한·동시 경합·운영은 후속이다.
