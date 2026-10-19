# Studio 혼합 Pivot의 다른 소스 복제

2026-10-19 · P1/P3/P5 · [승인 설계](../superpowers/specs/2026-10-19-studio-pivot-source-reuse-design.md) · [실행 계획](../superpowers/plans/2026-10-19-studio-pivot-source-reuse.md).

구현 기준 `d009ed37` → `eb648eec`/`1b553561`/`45d4473f`/`742a169d`/`99fc1930`/`395e38ac`, 실제 검증에서 발견한 수정 `1b6554f0`. develop-v2의 로컬 커밋이며 이번 승인으로 push/merge하지 않았다. Git 신원은 drumcap이다.

**최신 MySQL 후속:** [격리 MySQL7개 선택 검증](studio-pivot-source-reuse-mysql.md)이 최초 실행의 MySQL BLOCKED를 해당 범위에 한해 해소했다. 아래 최초 실행 기록은 보존하며 운영/모든 writer·실기기 수용과 구별한다.

## 제공하는 흐름과 경계

소유한 혼합 Studio 저장본의 **저장본 복제·소스 교체**에서 다른 소유 DuckDB 파일을 선택하고 열을 연결한다. 전체 차트·집계 Pivot 미리보기는 쓰기 없이 계산한다. 명시 저장하면 고유 계산 정의 그래프의 새 지표와 새 비공개 대시보드/블록 ID·세 폭 배치·Pivot recipe·지표 연결·영수증을 같은 metadata transaction에 저장한다. 같은 요청의 재확인은 현재 권한을 검사한 뒤 기존 사본을 반환한다.

후보 집계와 기존 저장 지표는 같은 SQL 실행 핵심을 사용한다. 긴 SQL은 metadata transaction 밖에서 실행한다. 동일 지표/FORMULA leaf를 중복 생성하지 않고 실제 저장 ID로 치환한다. 미지원 업무 의미를 자동 이식하거나 Pivot을 조용히 버리지 않는다. 제외는 명시 선택이며 일반 차트가 하나 이상 필요하다. 같은 소스의 빠른 저장본 복제와 수신자·게시본 remix 경계는 유지한다.

현재 저장 recipe의 암묵적 첫 날짜 열을 보존하기 위해 대응하는 대상 첫 날짜가 다르면 거절한다. Pivot을 모두 제외한 숫자 차트에도 이 검사를 적용한다. 향후 임의 날짜 재바인딩 지원을 의미하지 않는다.

## 실제 환경과 입력

Ego **36**, API `127.0.0.1:4560`, 웹 `localhost:3460`, Node24.21.0. 격리 SQLite `/tmp/vm-rxs-demo/metadata.sqlite`와 기존 DuckDB 워커를 사용했다. 테스트 소유 계정의 공개 합성 `samples/rill-scenarios/data/margin.csv` 원본 source4/dashboard3을 보존했다.

날짜 day→event_day, company→customer, component→service, revenue→sales_amount, cost→expense_amount, profit→earnings로 열 이름만 바꾼18행 source29와 전체를 한 번 더 붙인36행 source30을 준비했다. 업로드는 API 준비 작업이며 파일 선택창의 새 UI 수용으로 계산하지 않는다. 저장 결과는 **dashboard27/source30**, 일반 차트5+Pivot1, 새 지표43~46 네 개다. 고유 계산4개를6개 블록이 공유한다.

| 구분 | 자격 고객/기여 행 | Pivot 매출 USD | 기여 이익 USD | 마진 % |
|---|---|---:|---:|---:|
| 이름 변경18행 | Hanul/Baro,8행 | 5431.25 | 292.79 | 5.390840046029919 |
| 중복36행 | Hanul/Baro,16행 | 10862.50 | 585.58 | 5.390840046029919 |

독립 CSV Decimal 합계와 제품 응답을 대조했다. 표시 반올림은5.39%다. 자격은 각 대상 데이터에서 매출≥1000 AND 마진<20%로 다시 판정했다. 두 배가 된다는 가정으로 결과를 만들지 않았다. 원본 Rill의 동일18행 집계/화면 비교는 [기존 증빙](studio-pivot.md)을 재사용했다. **36행 변형의 Rill 신규 실행/UX 동등성 전체는 미검증**이다.

## MD 선택 결과

| ID | 판정 | 실제 증거/남은 범위 |
|---|---|---|
| SPR-01 | PASS_SELECTED | 실제 열6개 연결→키보드 전체 미리보기,18행 Pivot·셀·합계 정답. 원본/지표/대시보드/위젯/dataset/관계/StudioState/영수증/개인 보기/게시 metadata 내용 불변. |
| SPR-02 | PASS_SELECTED | source30 변경 시 이전 preview/ticket 제거·저장 비활성.36행 새 계산에서10862.50/동일 마진, 전체 차트 매출29874.98·비용24559.88·이익5315.10. 저장/reload·게시 snapshot도 일치. |
| SPR-03 | PASS_SELECTED | 실제 저장1회→27 Studio/reload. 새6블록 ID·종류/순서·xs/md/lg 좌표가 원본 ID 치환 후 동일. 지표+4·dashboard+1·widget/dataset/관계 각각+5·StudioState/영수증 각각+1. 서버 재시작으로 메모리 ticket을 잃은 뒤 같은 요청이27/replayed=true, 추가 자산0. 기존 행 모두 불변. |
| SPR-04 | PASS_SELECTED / 부분 범위 | 실제 일반 차트5개를 Space로 제외해 Pivot만 남기면 미리보기 차단·안내, 다시 포함 가능. 미연결 열·소스 변경은 저장 차단. 공통/블록 필터·기간 우선순위/축 충돌·타입·미지원 정의는 선택 단위/API 증거로 구별한다. 이번 새 UI 계산 범위는 전체 기간·공통 필터 없음이다. |
| SPR-05 | PASS_SELECTED / MySQL BLOCKED | 실제 preview 통신 차단→입력 보존·저장 차단→정상 재시도. SQLite 실제 DuckDB 통합의 지표 삽입 후 강제 실패 전체 rollback, catalog/epoch/소스 상태 재검사, 영수증 확인. 모든 파일·권한 변형을 실제 UI에서 실행한 것은 아니다. Docker daemon 미기동으로 격리 MySQL/두 연결 경합은 NOT_RUN. |
| SPR-06 | PASS_SELECTED / native 일부 NOT_RUN |390/768/1440 미리보기·저장본·비공개 게시 화면, 긴 제목·한글 파일명·오류 안내. 페이지 넘침0px, 복제 입력/주요 버튼36px, 모바일/768 입력16px·1440 입력14px. Tab/Shift+Tab 제목↔소스, Enter 미리보기/저장/새 탭, Space 단위/블록 선택, 게시 패널 Escape/복귀 포커스, 표 Home/End·방향키/내부 가로 스크롤. native select 값은 문서화된 selectOption 사용, 화살표만의 전체 선택/실휴대폰/VoiceOver 수용은 미검증. |
| SPR-07 | PASS_SELECTED / 비공개 | 새27을 UI에서 비공개 게시1로 저장하고 실제 게시 화면/reload를 확인했다. 소유 snapshot200·익명403,6블록/동일 숫자. snapshot 본문에 SQL·소스 ID·지표 정의/recipe·원본 상세·후보 키 없음, Pivot 표시 번호1/2. 새 익명 공개 링크·만료/중지·수신자 remix는 실행하지 않았다. 원본의 기존 게시 행 모두 불변. |

최초 게시390px 포커스 측정은 false였으므로 그 관찰을 성공 증거로 쓰지 않는다. 안정된 실제 표에서 방향키/End를 다시 실행해 가시 포커스·내부 scroll304px/페이지 넘침0을 확인한 `published-private27-keyboard-390.json/png`를 최종 증거로 사용한다. 실시간 resize 중 모든 포커스 경계 수용을 의미하지 않는다.

## 발견·수정과 재검증

1. **한글 업로드 이름 깨짐:** Nest9의 내부 Multer1이 UTF-8 옵션을 무시했다. 앱에 이미 설치된 Multer2를 사용하는 좁은 interceptor로 파일 수집3경로를 연결했다. storage/UUID 경로·크기/개수 제한·권한 guard는 보존한다. 한글·영문·café·문자 그대로의Ã©·명시 filename*를 구분하고413/400·스토리지 실패를 검사했다. 단순 Latin-1 재디코딩은 하지 않는다. 실제 새 업로드29/30의 한글 이름이 정상이다. 실패 진단용25~28의 과거 이름은 자동 변경하지 않았다.
2. **차트만 남길 때 날짜 기준 유실:** 독립 검토에서 발견했다. 암묵 날짜를 필수 연결로 포함하고 다른 대상 첫 날짜를 거절했다. 실패 회귀→계획/실제 DuckDB 통합 선택 통과.
3. **손상된 trend/누락 값 필드 수용:** 독립 검토에서 발견했다. 표시용 trend만 투영하고 nested points/날짜/숫자와 결과 필드·행 일치를 검증한다. 실제 API의 fields는 columnName/columnType 객체임을 반영했다. 초기 문자열 fixture가 실제 형식 차이를 숨겼던 실패를 별도로 남기고 수정했다. 실제18행 미리보기와 후속36행 저장까지 재검증했다.
4. **Network Error/포커스 유실:** 실제 오류는 response.status=0 형태였다. 이 형식도 한국어 안내로 처리하고, 진행 중 미리보기 버튼을 aria-disabled/aria-busy로 표시하며 pending guard로 중복 요청을 차단한다. 실제390px 실패 후 입력6개/소스 보존·버튼 가시 포커스·재시도 성공을 확인했다. 최초 단위의 잘못된 matcher 실패는 제품 RED로 계산하지 않는다. 실제 status0·pending 회귀2개 RED→GREEN 및 최종 같은 파일18 PASS를 증거로 삼는다.

독립 읽기 검토는 새 문맥의 GPT-6 Astra/high1회로 실행했고 P2 두 건을 반환했다. 설치된 reviewer/code-reviewer 역할이 도구에서 제공되지 않아 실제 default 역할로 실행한 사실을 보존한다. 해당 두 건은 위 회귀로 보완했으며 재검토 승인을 받은 것으로 과장하지 않는다.

## 영향 검증과 증빙

단계별 결과는 중복이 있어 합산하지 않는다. 새 engine27·graph11·계획/후보 실행17·혼합 SQLite4/기존 owner/shared33 등은 실행 계획 ledger의 해당 시점 결과다. 최종 영향 선택은 기존 segment·owner/shared reuse·Studio Pivot 통합 **4 suites60 PASS**. 검토 수정 단계의4파일은25 PASS/1실패/1 MySQL SKIP였고 실패한 multipart malformed 입력 fixture를 보완해 해당1개만 재실행 PASS다. FE 실제 fields 계약+연결20 PASS, 최종 오류/버튼 변경 후 연결 화면18 PASS다. BE/FE 타입·변경 파일 non-fixing lint·root build 및 마지막 FE build가 통과했다. 경고(ts-jest 지원 버전 범위/Vite 차기 config loader)는 오류와 구별한다.

증빙 root: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/`.

- `oracle.json`, `preview18-requests-final.json`, `preview36-requests.json`, `save.json`, `saved-read.json`, `saved-document-invariants.json`, `receipt-after-restart.json`.
- `metadata-before-preview.json`, `metadata-after-preview18.json`, `metadata-after-preview36.json`, `metadata-after-save.json`, `metadata-after-receipt.json`: 내용 digest/행 비교, 인증/session 테이블은 자산 판정에서 제외.
- `preview18-layout.json`, `saved27-layout.json`, `keyboard-navigation.json`, `network-error-final.json`, `private-publication-layout.json`.
- [저장본 전체 화면](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/saved27-overview-1440.png), [모바일 Pivot](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/saved27-pivot-390.png), [모바일 게시 표 포커스](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/published-private27-keyboard-390.png), [오류 복구 안내](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-source-reuse-20261019/preview-network-error-final-390.png).

원시 인증값은 출력/커밋하지 않는다. 로컬 save ticket/비공개 게시 조회 응답은 공개 커밋에 포함하지 않았다. 진단용25~28·검증용29/30·비공개27/비공개 게시1은 로컬 증빙으로 보존한다. 임시 네트워크 차단은 finally에서 해제했다.

**남은 경계:** 격리 MySQL 실제 실행·운영 다중 writer/부하·모든 업무 의미/일반 Pivot·수신자 remix·실제 휴대폰/멀티터치·native 전체 키보드·VoiceOver(BLOCKED 유지)·새36행 Rill 비교·전체 P5/TC005 및 기업16개 요건 수용은 Open이다. gpt-6-luna 설정은 유지했으며 이번 직접 복제 흐름에 제품 AI 호출은 없다.


## 실제 기준 변경 오류 복구 후속 — 2026-10-19

[SPR-UI-08/09](studio-reuse-catalog-recovery-ui.md)에서 실제 대상 지표 추가→저장409·입력/metadata 보존→명시 재미리보기→비공개28/source29 저장/reload를 확인했다. 포커스가 BODY로 빠지는 오류는 좁게 수정해 실제390px ‘전체 미리보기’ 가시 포커스/Tab 복귀로 재검증했다. 관련4/type/lint/FE build·세폭 overflow0이며 기존 정상 흐름/MySQL 조건을 반복 통과로 합산하지 않는다. 실기기/VoiceOver·다른 실패 변형/전체 수용은 별도다.
