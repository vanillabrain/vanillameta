# Rill·VanillaMeta — 동일36행 매출·마진 비교

2026-10-19 · 기준 develop-v2 `56d9ea44`. [SPR-02](studio-pivot-source-reuse.md)의 미검증 Rill36행 변형만 확인한다. VM 저장/게시/복구 정상 조건과18행 Rill 통과는 재실행하지 않는다. 새 제품 기능 설계/전체 동등성 선언이 아닌 기존 시나리오의 대조 검증이다.

| ID | 입력/조작 | 기대 | 상태 |
|---|---|---|---|
| R36-01 | VM source30과 바이트 동일 CSV, Rill 새 격리 source/metrics/explore, 전체기간 UTC | 36행·매출29874.98/비용24559.88/이익5315.10USD·마진17.791141617500664% | PASS_SELECTED |
| R36-02 | customer별 매출≥1000 AND 마진<20%, service Pivot | Hanul/Baro16기여행,10862.50/10276.92/585.58USD·5.390840046029919%, 셀/행/열/전체 합계 재계산 | PASS_SELECTED |
| R36-03 | 같은 조건의 VM 저장27/source30과 Rill1440·390px, 키보드 | 숫자·단위/반올림·KPI/표/스크롤·조작 차이를 구별하고 실제 캡처 | PASS_SELECTED |

Rill v0.90.5의 기존 localhost9019 프로젝트에 이번 비교 전용 `vm_pivot36` 파일만 추가한다. 기존 source/dashboard는 수정하지 않는다. 공개 합성 margin을 두 번 붙이고 열 이름을 변경한 기존 파일을 그대로 복사하며 독립 Decimal 정답으로 검사한다. Rill 비율0~1과 VM %배율100을 구분한다. Rill Cloud/AI/외부 배포·새 VM 저장/게시0이다. gpt-6-luna/VoiceOver BLOCKED 유지, 실제 휴대폰/전체 Rill parity/기업16개 수용은 별도다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/`.


## 실제 결과 — Ego42

기존 Rill v0.90.5/localhost9019와 VM 웹3460/API4560을 재사용했다. 새 Rill 비교 source/metrics/Explore만 추가했으며 VM은 기존 비공개 dashboard27/source30을 읽기만 했다. CSV의 SHA256 `42c87d86bbb772b75a161169a3dcf073091b9307d083dc46667083e6c9c748da`가 VM 검증 원본과 Rill 입력에서 바이트까지 같다. 첫 복사 과정의 줄바꿈 정규화는 실제 비교 전에 원본 bytes 복사로 바로잡았다.

- **R36-01 PASS:** Rill UI에서 All time/UTC와36 of36 rows를 확인했다. 표시 KPI는$29,875/$24,560/$5,315/17.79%다. UI Export model data→CSV의36행을 Decimal로 합산한 결과29874.98/24559.88/5315.10USD가 독립 정답·기존 VM 수치와 같다. 화면의 정수 반올림을 센트 오차로 보지 않는다.
- **R36-02 PASS:** Add filter→Revenue→By dimension Customer→Greater Than Or Equals1000, Margin Percent→Customer→Less Than0.2를 실제 입력했다. 조건은 AND이며16 of36 rows와Hanul/Baro 두 고객만 남았다. Rill은0~1 비율을percentage로 표시하므로 VM의20%와0.2가 같은 조건이다. UI CSV16행의 합계10862.50/10276.92/585.58USD, 재계산 마진5.390840046029919%가 같다. Pivot 행Customer/열Service·Revenue·Margin Percent를 메뉴로 구성했다. Pivot CSV 네 셀의 금액과 정규화한 마진이 Decimal 정답과1e-9 이내다. Rill Pivot CSV는 합계 행/열을 포함하지 않으므로 그 파일에 정확한 합계가 있다고 주장하지 않는다. 합계는16행 CSV/독립 재계산과 화면의 반올림 표시를 대조했다.
- **R36-03 PASS_COMPARE_SELECTED:**1440/390px의 양쪽 실제 화면을 캡처하고 직접 열람했다. VM 모바일 표는 End키로 내부 scrollLeft292px·가시 포커스true·전체10862.50USD/5.39%에 접근했다. Rill은 Enter로 집계 조건 적용, Enter로 Pivot 행 선택 메뉴/Customer 선택을 확인했고 나머지 구성은 실제 클릭이다. 전체 native 키보드·실제 휴대폰·VoiceOver로 확대하지 않는다. 양쪽 페이지 가로 넘침은 안정 상태0px다. VM 최초 resize 직후 측정324px는 안정된 재측정에서0이어서 제품 수정 근거로 쓰지 않았다. Rill390px는 선택 사이드바가240px를 차지해 초기 표 영역이 좁다. 페이지 넘침0이라는 이유로 모든 셀이 가시적이라고 판정하지 않는다.

| 항목 | Rill 결과 | VM 결과/차이 |
|---|---|---|
| 전체 KPI | $29,875·17.79%, 일별 추세를 같은 열에 표시 | 29874.98USD·17.79%, 이 저장본의 KPI는 숫자 카드 표현 |
| 조건부 총매출·마진 | 10862.50USD·5.39%, 화면 전체 필터 | 같은 값, 저장 Pivot 블록의 조건으로 적용 |
| Hanul Compute / Storage | 6920·12.774566…% /1600·−25% | 같은 값·표시12.77%/−25.00% |
| Baro Compute / Storage | 1281·−12.786885…% /1061.50·25.000471…% | 같은 값·표시−12.79%/25.00% |
| 전체 합계의 마진 |16기여행에서 재계산5.39% | 같은 값. 셀 비율 평균/합이 아님 |
| 필터의 가시성 | 상단 칩에Customer별Revenue≥1000·Margin<0.2 | 블록에 ‘저장 보기 조건 적용’ 설명. 임계값은 카드에서 바로 읽기 어려움 |
| 표 밀도·모바일 | 데스크톱은 지표별 열, 총합 상단/좌측.390px 초기 영역은 사이드바에 크게 할당 | 셀 안에 지표/정확한 금액을 쌓고 총합 하단/우측.390px 내부 가로 스크롤과 긴 도움말 |

**해석:** 같은 범위의 계산·선택 결과는 일치한다. Rill 화면 전체의 조건부 KPI와 VM 블록 단위 조건을 무조건 같은 화면 상태로 취급하지 않는다. UX 완전 동등성은 Open이다. 다음 좁은 개선 후보는 Studio Pivot 카드에서 ‘고객 매출≥1000·마진<20%’와 ‘이 블록에 적용’을 읽을 수 있게 보여 주고 긴 일반 도움말을 접는 것이다. 전역 집계 조건 기능이나 저장된 recipe를 자동 변경하는 요청으로 해석하지 않는다.

## 증빙과 재현

외부 증빙 root의 `oracle.json`, `rill-all-check.json`/`rill-csv-check.json`/`pivot-comparison.json`, 실제 UI CSV3개, `rill-qualified-ui.json`/`rill-pivot-ui.json`/`rill-mobile.json`/`vm36-ui.json`/`vm-mobile.json`을 대조했다. `rill-project/`에는 이번 로컬 비교의 바이트 동일 CSV와YAML3개를 보존했다. 기존 비교 프로젝트의 다른 파일은 변경하지 않았다.

- [Rill 전체 KPI1440px](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/rill-all-1440.png)
- [Rill 조건부 Pivot1440px](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/rill-pivot-1440.png)
- [VM 같은 Pivot1440px](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/vm36-pivot-1440.png)
- [Rill390px](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/rill-pivot-390.png)
- [VM390px·가시 포커스/전체 합계](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/rill-pivot36-20261019/vm36-pivot-390.png)

VM은 직전56d9ea44 검증 종료의12개 자산 테이블 행digest와이번 종료가 같다(`vm-metadata-final.json`). 새 VM 소스/지표/대시보드/보기/게시 생성0이며 인증정보는 출력/커밋하지 않았다. 이번 diff는 문서뿐이므로 기존 타입/lint/build/단위 검증을 재실행하지 않았다. 새 Rill 원본36행/조건16행/Pivot CSV와 Decimal·실제 양쪽 UI 대조가 이번 검증이다. Rill UI의 최초 대기문구에서 대소문자 기대값이 맞지 않아 timeout1회가 있었으며 실제 렌더 완료 후 상태를 확인해 계속했다. 일회성 timeout을 제품 오류나 Rill 전체 장애로 기록하지 않는다.

gpt-6-luna 설정을 유지했고 이번 제품 AI/Rill AI 호출은0이다. VoiceOver BLOCKED·실기기/운영/전체 P5·TC005·기업16개 수용은 Open이다. 기존18행 대조/저장·게시·서버 복구 검증을 새로운 통과 건수로 합산하지 않는다.
