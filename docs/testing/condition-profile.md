# UC052 전체 분포·선택 열 정렬 표본 검증

2026-10-18 · develop-v2 · 기준851f0fd2 · [설계](../plans/UC-052-profile.md). FR019·NFR005/006/008·TC050 E05/E08의 선택 구현이며 전체16개 수용은 미완료다.

## 실제 계약

Source 현재 조건 입력과 Studio 문서의 현재 기간/공통 필터/포함·제외를 읽기만 한다. 분모는 각각 전체 소스 또는 기간·공통 필터를 적용한 전체 행이다. 같은 compiler 정의로 전체/포함/충족 중 제외/최종 건수·비율을 계산하고 실제 native 값별 전체 빈도를 구한다. 전체 빈도 상위20개와 나머지 합계/NULL/그룹 수·min/max를 구분한다. 분포를 표본으로 추정하거나 연속형 동일 폭 histogram으로 표시하지 않는다.

사용자가 선택한1~6열의 같은 최종 조건에서 native 값 순서/NULL 우선 최대20행을 반환한다. 중복은 유지하며 표본의 한도/전체 최종 행수·추가 행·정렬 표본/대표성 없음과 셀200문자 잘림을 명시한다. 값은 native 문자열/NULL로 투영해 BIGINT/DECIMAL/날짜 정밀도를 지키고 미선택 열/연결정보/SQL은 반환하지 않는다. 전체256KiB·미지원 native 열 제한을 적용한다. 불변 관리 파일 경로 hash는 내용 checksum이 아니므로 외부의 in-place 덮어쓰기를 탐지한다고 주장하지 않는다.

Source는 기존 metadata 포함 sourceRevision/조건 version을 사용하고 Studio는 별도 file hash/dashboard revision을 사용한다. 두 값을 서로 비교하지 않는다. 권한/활성·현재 정의와 확정 file pin/schema를 캡처하고 긴 SQL은 metadata lease 밖에서 실행한다. 응답 전 새 metadata 캡처로 권한/현재 기준을 확인한다. 중간 변경은409/현재 권한 거절이며 결과를 최신 값으로 돌려주지 않는다. Studio profile은 임의 블록 SQL이 아닌 공통 범위의 고정 생성 query만 실행한다. 새 영속 모델/AI 요청/저장/게시 동작은 없다.

## 실행 증빙

Git 제외 `.aiwf/evidence/UC052-profile/`의 명령 로그를 사용한다. native worker SQL와 실제 SQLite/JWT HTTP·FE mock 응답을 분리한다.

- 공통 계산/기존 조건20 PASS에서 실제 DuckDB의 NULL/중복·0행/0분모·기간/필터+중첩 포함·제외와 표본 선택 열을 확인했다. 상위20+나머지와 빈도11/9의 숫자 순서,43행 전체·20행 표본, 정확 BIGINT9007199254740993/DECIMAL(30,4) 값·Unicode 잘림·미선택 secret 열 비노출을 확인했다. DECIMAL fixture는 실제 native DECIMAL literal 관계를 사용하며 CSV 자동 DOUBLE 추론에서 잃은 값을 복구했다고 주장하지 않는다.
- 서버 선택4 suites51 PASS는 실제 JWT/SQLite 정책/read grant와 DuckDB 전체 분포/표본을 포함한다. 익명401·타 조직403·읽기 grant 성공/저장 거절·회수 후 SQL0, 집계 중 소스 비활성403/metadata 변경409와 저장0을 확인했다.
- Studio는 미저장 조건+현재 날짜 범위에서 전체1/최종1·Mobile/200 표본을 반환하며 원본 문서/영수증 불변이다. 조회 중 파일 교체409·무권한 SQL0과 느린 집계를 멈춘 동안 독립 metadata 쓰기가1초 안에 완료되는 실제 SQLite 검사를 포함한다.
- FE 선택4 files135 PASS는 명시 선택/조회·자동 요청0·올바른 scope echo/타입·표본/전체 구분·선택 한도/미지원 열·오류/late 응답 보존·Source read-only 연결과 Studio 질문/문서/저장 상태 불변을 검사한다. 정상 Studio 편집 문서는 revision 필드를 별도 expectedRevision으로 보내므로 이 계약에 맞춰 fixture 기대를 정정했다.

초기 helper compile failure는0 tests이며 동작 RED가 아니다. 생성 compiler SQL의 binding을 사용자 SELECT 문법 validator에 넣던 실제 실패는, validator를 완화하지 않고 검증된 base CTE와 내부 compiler fragment를 조합해 수정했다. Jest.each의 빈 배열 행이 done callback으로 해석되던 검사 timeout은 object case로 정정했다. bigint syntax는 기존 target에 맞는 BigInt 생성자를 사용한다. 이 실패들을 최종 통과로 덮지 않는다.

## 별도 Main 검토

독립 에이전트 리뷰를 수행했다고 표시하지 않는다. 별도 Main diff 검토에서 선택 열을 해제/재선택하면 동일 key의 옛 결과가 다시 보이는 반례를 실제 RED1로 확인했다. scope/disabled/선택 변경마다 결과를 완전히 폐기하도록 보완했고 최종 선택4 files136 PASS로 확인했다. 검증 fixture의 공유 zero 객체도 각 응답 복사본으로 고쳐 검증 실패 주입이 다음 사례를 오염시키지 않게 했다. 긴 문자열 공백은 보존하고 NULL을 '값 없음 (NULL)'로 구분한다.

동일 네이티브 값 집계/선택 열만 투영·binding 순서·fresh source 캡처와 읽기 전후 권한을 검토했다. Source 조건 preview는 공통 population parser를 재사용하며 기존 회귀로 수치 계약을 확인한다. 화면 결과 검증은 전체/나머지 합계·샘플 행수/열명/타입·대표성 없음/잘림을 확인한 필드만 투영한다. 새 조건·선택 변경이 저장/질문/undo를 만들지 않는다.

## 미실행과 후속 — 2026-10-18 실행 당시

Ego TaskSpace96 사용자 제어권 반환은 확인되지 않았으며 다른 공간으로 우회하지 않았다. 새 실제 화면의 Source/Studio 조회 여정·390/768/1440 크기/정렬·실휴대폰/키보드·이번 MySQL·대규모 운영/사람 수용은 BLOCKED/NOT_RUN이다. 기존 core나 CSS/DOM을 이 증거로 승계하지 않는다. 값 빈도 표/정렬 표본을 무작위 대표표본·동일 폭 histogram·전체 FR019 수용으로 확대하지 않는다. 이름별 조건 세트·수신자/알림·영속 export·보관과 전체 TC050은 계속 열린다. MK AI 연동은 계속 제외한다.

## 최종 전달 검사

전체 BE158 suites2651 PASS(MySQL opt-in9/1 suite SKIP), 전체 FE117 files1701 PASS다. 이 전체 FE는 위 결과 재등장 수정 전이며 보완 후 최종 선택136개로 재검증했다. 결과를 합산해 새 전체 통과로 표시하지 않는다. 최종 BE/FE type·대상 lint·build는 각각 exit0이다. lint 초기의 미사용/빈 callback·증가 연산 스타일은 정리했고 요청 세대 의미를 바꾸지 않았다.

기존 Chromium core8 PASS(21.6s)는 격리 임시 DB/서버의 로그인·CSV/집계 저장·Explore/Pivot 복원·공유/보호 경로다. 테스트 서버/DB는 실행기가 종료 후 정리했다. 이는 새 분포 화면의 실제 Ego 검증이 아니다. 새 영속 객체가 없으므로 entity/glossary에 별도 모델을 추가하지 않았다. AIWF strict는0 errors/기존 FR011·NFR002 상태 경고2개로 exit1이며 상태를 임의 승인하지 않았다. pin/check·패킷은 내용 추적이며 사람 수용이 아니다.


## 실제 브라우저 후속 — 2026-10-20 / Ego51

기준 develop-v2 `b0239e8b` + 이번 미커밋 diff. 사용자의 검증 계속 요청에 따라 기존 `vanillameta-verify`/MD의 **실제 Source·Studio 분포/표본 UI 미실행**만 선택했다. 기존 서버·단위/독립 숫자 회귀·생성/저장/게시를 반복하지 않는다. 사용자 제어 중이던 과거 공간96은 조작하지 않았고 이번 전용 공간51을 사용했다.

### 입력과 정답

새 `/tmp/vm-profile-ui-runtime/metadata.sqlite` 복사본/API4562·웹3462, 기존 합성 계정9/source33/dashboard33을 사용했다. 로그인 세션을 그대로 이용했고 새 계정/암호 탐색·설정은0이다. source33의 샘플 태그 hash는 VM 소유 공개 합성 `margin-reuse.csv`의 SHA256과 정확히 일치했다. 이는 Rill 공식 샘플이나 고객 자료가 아니다.

CSV를 Python csv/Counter/Decimal로 독립 계산해 전체18행, 회사 빈도4/4/4/3/2/1·통화USD18, 현재 Studio의2025-01-06~10/company=Hanul Foods 범위2행과 정렬 표본1600.00/2400.00을 대조했다. Source 표본18행은 company/currency 순 정렬과 중복 보존이 일치했다. 본인 Studio의 day 공통 기간/회사 필터는 유지하며 블록 Pivot 추가 조건을 원본 전체 행 조건으로 섞지 않는다.

| ID | 행동·기대 | 결과 |
|---|---|---|
| PROFILE-UI-01 | 키보드로 패널 열기·열3개 선택→명시 조회. 선택만으로 자동 요청0, Studio 현재 범위2행·전체 빈도와 정렬 표본 구분 | PASS_SELECTED. 실제 Studio profile201, 전체2/포함2/제외0/최종2·회사1그룹/통화1그룹/금액2그룹·표본2/2. |
| PROFILE-UI-02 | 금액 열 해제→같은 열 재선택 시 옛 결과가 되살아나지 않음 | PASS_SELECTED. 두 상태 모두 표본 결과0개/요청1→1이며 재선택은 자동 조회하지 않았다. |
| PROFILE-UI-03 | 이 탭의 profile만 통신 차단→입력/선택 보존·옛 결과0·한국어 안내·키보드 재시도 | 최초 오류 후 수정 PASS_SELECTED. 아래 원문 오류/초점 손실을 수정하고 체크3개·버튼 가시 초점·Enter1회 실제201 복구를 확인했다. |
| PROFILE-UI-04 | Source 전체 소스/전체 기간·UTC와 Studio 현재 기간/필터의 분모 구분 | PASS_SELECTED. Source profile201의18/18·회사6그룹/통화1그룹과 정렬18/18이 독립 CSV 정답과 일치했다. 양쪽 표본은 ordered/representative=false이며 무작위 대표표본으로 설명하지 않는다. |
| PROFILE-UI-05 | 대표 폭·키보드 가시 초점·표 내부만 가로 이동·읽기 보존 | 최초 머리글 줄바꿈 후 수정 PASS_SELECTED. Source 분포390/768/1440 문서 넘침0·머리글28px/nowrap·숫자 우측 정렬,390 표288/내용384px·ArrowRight scrollLeft>0. 최종 Studio390도314/384px·넘침0/가시 초점이다.9개 metadata 표 전체 행·hash·행수 불변이다. |

### 발견·수정과 재검증

1. **기술 오류 원문:** `ConditionProfilePanel`이 `Error.message`를 그대로 렌더해 실제 네트워크 차단에서 `Network Error`만 표시했다. 알려지지 않은 서버 진단도 같은 경로로 노출될 수 있었다. 기존409의 기준 변경 안내는 유지하고 그 밖에는 한국어 조회 실패·선택/입력 보존·연결/데이터 상태 확인/재조회 안내로 통일했다. 원문 오류를 출력하지 않는다. 진단 문자열 비노출 회귀는 최초1FAIL/6미선택→수정 후PASS다.
2. **키보드 재시도 실패:** 조회 시작 시 native disabled로 바뀐 버튼이 Chromium 초점을 body로 보내, 오류 후 Enter가 실행되지 않았다. 이 때문에 첫 복구 대기는 timeout이었으며 성공으로 처리하지 않았다. 관련 회귀1FAIL/7미선택을 확인한 뒤, 외부 disabled/미선택은 유지하되 busy 동안은 aria-disabled/aria-busy로 알리고 기존 request guard로 중복 실행을 차단한다. 실제 실패 후 같은 버튼의 :focus-visible=true·선택3개/옛 결과0·Enter→201·버튼 초점 유지를 재확인했다. 중복 실행 차단과 입력/결과 검사는 최종 같은 파일8PASS에 포함한다.
3. **모바일 분포 표:** 좁은 중첩 패널에서 전체/포함/제외/최종 머리글이 글자 단위로 줄바꿈됐다. 값 열 최소 폭·표384px 최소 폭·머리글/숫자 nowrap와 숫자 우측 정렬을 국소 적용했다. 페이지 폭을 늘리지 않고 기존 focusable overflow 영역 안에서만 이동하며3폭 실제 캡처/치수로 재확인했다. CSS 변경 뒤 최종 Studio 모바일 부모 영역도 별도로 확인했다. 이 재조회는 새 숫자 시나리오 통과로 합산하지 않는다.

기능 PASS와 디자인 PASS를 분리했다. Studio 표본 영역의3폭358/720/1392px 패널·14px 표·가시 초점/넘침0을 확인했고 최종 분포 CSS는 Source3폭/Studio390에서 확인했다. 표 내부 가로 이동 후 캡처는 보이는 열이 달라질 수 있으며 페이지 자체 overflow가 아니다. 선택/표 이동 조작에 새 profile 요청은0이다.

최종 관련 단위8PASS, FE type·변경2파일 non-fixing lint·최종 FE build PASS다. Vite의 기존 native config 미래 호환 안내는 유지한다. 전체 core/BE/MySQL/AI는 변경이 없어 기존 범위 결과를 재사용했다. 이번 계측은 Studio5 profile 요청(성공2/통신 실패3), Source2 성공, 최종 CSS 확인 Studio1 성공이며 저장 POST로 집계하지 않는다. 실제 전후9표 전체 행/hash가 같고 새 생성/저장/게시/지표/복제 영수증·모델 호출0이다.

### 증빙·남은 범위

root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/`. `oracle.json`/`oracle-checks.json`, `studio-result.json`/`studio-requests.json`, `selection-error.json`, `error-fixed.json`, `source-result.json`/`source-requests-final.json`, `studio-layout.json`, `source-layout.json`/`source-distribution-layout.json`, `studio-distribution-final.json`, `db-before.json`/`db-after.json`, `summary.json`과 red/green/최종 검사 로그를 대조했다.

[최초 기술 오류390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/studio-profile-error-390.png) · [수정한 오류·초점390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/studio-profile-error-fixed-390.png) · [표본390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/studio-sample-390.png) · [머리글 최초390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/source-distribution-before-390.png) · [수정한 Source 분포390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/source-distribution-390.png) · [최종 Studio 분포390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/studio-distribution-final-390.png) · [Source1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-ui-20261020/source-distribution-1440.png)

Source/Studio의 대표 실제 UI 미실행은 이 선택 범위에서 보완했다.20그룹 초과/나머지·NULL/0행·잘림/정밀 native 값/조회 중 파일 변경의 실제 화면 변형·목표 규모 성능, 이번 MySQL·실휴대폰/VoiceOver·운영/업무·전체FR019/16개 수용은 남는다. 하위 계산 검사의 통과를 이 실제 화면 변형의 통과로 올리지 않는다. gpt-6-luna 설정 유지/새 호출0·VoiceOver BLOCKED 유지다.

Ego51을 keep[]로 종료하고 이번 API4562 PID65130/웹3462 PID65609만 종료했다. 격리 DB·원본 CSV/DuckDB와 기존 다른 서버를 보존했다. 이번 수정/기록과 앞선 UXB10의 미커밋 변경은 그대로 남겼다. Ego Lite 업데이트 안내만 확인했고 설치/업그레이드는 하지 않았다.


## 경계 화면 후속 계획 — 2026-10-20

기준 b0239e8b + 앞선 미커밋 수정. PROFILE-UI-01~05는 재사용한다. PROFILE-UI-06은 별도 합성 CSV46행/26그룹·상위20합40/나머지6·NULL3·중복 유지/NULL 우선 정렬 표본20/46/추가 행을 실제 Source profile 응답/모바일 화면과 독립 CSV 정답으로 대조한다. PROFILE-UI-07은 같은 소스의 미일치 조건을 로컬 입력해 전체46/최종0·표본0·비율0%와 과거 표본 제거를 확인한다. PROFILE-UI-08은 기존 Studio의 행이 없는 날짜 범위로 전체 모집단0·분모0의 비율 없음과 표본0을 확인한다. 조건·날짜는 미저장으로만 편집하며 저장/AI/게시를 실행하지 않는다. 신규 소스 업로드는 이 경계 입력 준비이며 기존 파일 업로드 통과를 새로 집계하지 않는다. 초기 NOT_RUN; gpt-6-luna·VoiceOver BLOCKED 유지.


## 경계 화면 결과 — 2026-10-20 / Ego52

**PASS_SELECTED: PROFILE-UI-06~08.** 이전 PROFILE-UI-01~05/8개 단위와 숫자·생성·저장·게시 통과는 재사용했다. 전용 metadata 복사본/API4562·웹3462에서만 실행했고 과거 사용자 공간은 조작하지 않았다.

### 입력·기대·실제 결과

준비용 CSV는25개 문자열 그룹의43행(v24=11/v23=9/나머지 각1)에 NULL category3행을 추가한46행이다. NULL amount1개와(NULL,1000) 중복2개를 포함한다. Python csv/Counter로 구한 전체26그룹·상위20합40/나머지6, NULL 우선 정렬 표본20행을 실제 응답/화면과 대조했다. 업로드는 전제 준비로만 실행해 **새 source34 한 개**를 만들었고 업로드/차트 생성 기능을 새로 통과 집계하지 않았다. 지표/대시보드/조건 저장·게시·모델 호출은0이다.

| ID | 결과 | 실제 근거 |
|---|---|---|
| PROFILE-UI-06 상위20/NULL/추가 행 | PASS_SELECTED | Source profile201·전체46/최종46·category26그룹/상위20행40+나머지6이 독립 정답과 일치한다. category NULL빈도3이 상위세 번째이며 표본 첫 행(NULL,NULL)/다음 두 행(NULL,1000)과 전체20행 순서가 CSV 정답과 완전히 같다. 표본20/46·추가 행 있음·무작위 대표표본 아님을 실제 화면에서 확인했다. |
| PROFILE-UI-07 조건 미일치0행 | 최초 안내 미흡 후 수정 PASS_SELECTED | 로컬 category=`__PROFILE_NO_MATCH__`만 입력해 전체46/포함0/제외0/최종0·비율0%·표본0/0을 확인했다. 조건 편집만으로 요청1→1·옛 표본0·선택 열2개 보존이다. 원 전체 분포의 빈도와 나머지는 유지되며 최종 열만0이다. 수정 후 빈 표본은 포함·제외 조건 확인을 안내하고 가시 region 초점→Tab `건수 미리보기`로 이동한다. |
| PROFILE-UI-08 모집단0/0분모 | 최초 NULL 범위 오해 안내 후 수정 PASS_SELECTED | 기존 Studio33의 미저장 기간만 UTC2026-02-01~02로 적용했다. 실제 profile201·전체0/최종0·두 ratio=null·0그룹/표본0이다.0%·NaN/Infinity로 표시하지 않고 `비율 없음`을 유지한다. 수정 후 NULL 값 범위 대신 `현재 범위에 값 그룹이 없습니다.`와 원본·기간·필터 확인 안내다.390/768/1440 문서 넘침0·가시 초점/줄바꿈을 확인했다. |

### 발견·수정·재검증

모집단0인데 min/max의 null을 실제 NULL scalar로 출력해 `NULL 포함0그룹 · 범위 값 없음(NULL) ~ 값 없음(NULL)`로 안내했다. 빈 표본도 머리글만 남아 원 범위가 빈 경우와 조건으로 제거된 경우를 구분하기 어려웠다. 계산 응답·NULL scalar·기존 정렬/한도·요청은 그대로 두고,0그룹 설명과 빈 표본 안내만 분리했다. 모집단이 있으면 조건 검토, 모집단이 없으면 원본·기간·필터 확인을 안내한다. 실제 NULL이 있는 PROFILE-UI-06의 값 표시를 빈 모집단으로 바꾸지 않는다.

관련 두 변형 회귀를 먼저2FAIL/8미선택으로 확인한 뒤 수정했다. 최종 새 선택2PASS/기존8미선택·FE type·변경2파일 non-fixing lint·FE build PASS이며 기존8PASS와 합산해 새 전체10PASS로 보고하지 않는다. BE·핵심 저장/게시·Rill 전체 숫자·모델 검증은 변경이 없어 반복하지 않았다.

### 관측과 보존

- Source 미일치 조건은 저장/이 분석 적용 없이 로컬 입력만 했다. Studio 임시 날짜도 종료 전 되돌리기로 기존2025-01-06~10으로 복구했다. 준비 후 **소스 조건 표를 포함한10표 전체 행/동일 직렬화 hash·행수 불변**이며 새 저장/게시/복제 영수증은0이다. 준비 source34/CSV·관리 DuckDB와 격리 metadata는 재현용으로 보존했다.
- 날짜 도구 fill의 표시값이 제어된 초안과 일치하지 않는 준비 과정은 native 입력 이벤트로 보정했다. 최종 실제 profile 요청의 dateRange를 확인했고, 달력/날짜 필드 전체 키보드 검증 PASS로 승계하지 않는다. 적용·열 선택·조회·빈 표의 Tab 이동은 실제 키 입력이다.
- 첫0모집단 응답 직후에는 chart resize 중 문서 폭 차이가1378px로 관측됐다(`studio-zero-population.json`). 안정 상태 재조회/3폭은 모두0이었다. 최초 관측을 안정 PASS로 쓰거나 이 수치만으로 CSS 제품 결함이라고 단정하지 않았다. 최종 캡처와 JSON 치수를 기준으로 판정했다.
- 두 번째 Source 탭의 명시 재조회는 수정한 빈 결과 안내 검증이며 새로운 숫자 시나리오를 추가한 것이 아니다. 본 실행에서 관측한 profile5회와 기간 preview/원복 조회를 저장 쓰기로 집계하지 않는다. 준비 업로드의 source 추가와 준비 후 읽기 전용 검증을 분리한다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/`. `profile-edge.csv`/`oracle.json`, `full-profile.json`, `condition-edited.json`, `source-zero.json`/`source-zero-after.json`, `source-requests-final.json`, `studio-zero-population.json`/`studio-requests-final.json`, `studio-zero-layout.json`, `db-before.json`/`db-after.json`, `summary.json`과 red/green/type/lint/build 로그를 대조했다.

[26그룹390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/category-groups-390.png) · [NULL/중복 표본390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/null-sample-390.png) · [조건 미일치 최초390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/source-zero-final-390.png) · [조건 미일치 수정390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/source-zero-after-390.png) · [0모집단 최초390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/studio-zero-before-390.png) · [0모집단 수정390](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/studio-zero-after-390.png) · [1440](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/condition-profile-edge-20261020/studio-zero-after-1440.png)

20그룹 초과/NULL/0행·0분모의 **선택 실제 화면 변형**은 보완했다. 잘림/정밀 native 값과 집계 중 파일/권한 변경의 실제 화면, 목표 규모·이번 MySQL·실휴대폰/전체 스크린리더·업무/전체FR019·16개 수용은 여전히 남는다. gpt-6-luna 유지/호출0·VoiceOver BLOCKED 유지다. Ego52를 keep[]로 종료하고 이번 API PID57958/웹PID58354만 종료했다. 기존 데이터/파일을 초기화하지 않았으며 이번 수정·기록은 앞선 변경과 함께 미커밋으로 남겼다. Ego Lite 업데이트는 안내만 확인하고 적용하지 않았다.
