# 저장한 Pivot 대시보드 연결

2026-10-14 기준 codex/self-service-next-20261014 @c59d10fa + 작업 diff. 이전 Pivot 저장/CSV는 c59d10fa커밋, 이번 신규 연결·디자인만 검증. source3 Rillauction1391572행/user2/dashboard2. AI codex/gpt-6-luna 유지 호출0, VoiceOver BLOCKED.

| ID | 조건 | 기대/결과 |
| --- | --- | --- |
| PIVOT-DASH-01 | 저장한Pivot→같은소스대시보드선택→추가→새로고침 | 설정스냅샷복사/원보기변경영향없음/재조회지속. 분석정의·기존위젯보존. PASS API+UI |
| PIVOT-DASH-02 | 공통App필터·공통날짜변경/Pivot열클릭 | 공통조건같은열우선/다른기본범위유지. 요청56663800→App18363600. 날짜2023-09-10~10공통override XHR. PASS |
| PIVOT-DASH-03 | 타소유자/다른소스/비Pivot/8개초과/정의변경/제거 | 거부/오류안내, 설정삭제않음. 제거만해당ID·원지표/분석정의보존. PASS선택API. 정의불일치 오류카드·키보드제거·재조회 PASS (아래 후속 범위) |
| PIVOT-DASH-04 | 1440/390px 추가dialog·카드·Tab/Enter/표스크롤/Escape | 문서overflow0/표내부스크롤, 레이블/폰트/카드padding/정렬·간격·기존테마일관. PASS_SELECTED_VARIANTS |

디자인:중복Pivot제목·비활성축select가공간차지→임베드요약으로줄임. 제목18px/600,표13px/숫자우측정렬/표내부최대600px/모바일세로카드12px패딩/표버튼32px(데스크톱24px). 실제period/filter표시로기존KPI와다른범위도명시. 동일소스분석대시보드만목록표시. 모바일dialog로드완료후Escape/focus흐름확인. 전후캡처직접검토.

범위:공통조건미선택시는저장한기본필터·기간사용. timestamp정밀공통기간은경고/집계중지(날짜만지원). 공통/기본필터합5개초과중지. 공유/익명Pivot뷰·드래그위젯배치·차트편집기통합·전그룹export·실기기터치·VoiceOver범위밖. 스냅샷최대8개. 메타DB새nullable컬럼/migration. 새스킬UI회귀기준원본·설치본갱신/frontmatter검사PASS;pythonvalidator는PyYAML없어미실행.

검사BE신규3PASS/FE연동2포함최종108PASS,변경Explore/Pivot29PASS,타입·lint·BE/FEbuild·diffcheckPASS. 기존테스트mock새API충돌발견→새컴포넌트mock분리+독립mounted연동검사추가→재검사PASS. 전체통과MD반복없음. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-pivot-20261014/RESULTS.md`.

## 2026-10-14 정의 변경 복구 후속

`47f73ac6`에 대시보드 연결·디자인 스킬을 커밋한 뒤 PIVOT-DASH-03 미검증 정의 불일치 조건만 진행했다. 태스크가 생성한 attachment revision을 무효화해 실제 API 오류 경로를 주입했다(실제 지표 편집 UI는 NOT_RUN). 최초 목록 전체409로 제거 버튼이 사라지는 FAIL을 발견했다. 카드별 오류 응답·안내·제거 경로로 수정했고 오류 Pivot 집계는 실행하지 않는다. 정상 sibling 보존은 mounted 단위 검사로 확인했다.

Aside1440px와 headed Chromium390px 오류 화면·키보드 Enter 제거 DELETE200·재조회 지속 PASS. 모바일 문서 overflow0, 제목18px/600·제거 버튼·경고 줄바꿈·패딩/정렬/테마 직접 캡처 검토 PASS. QA snapshot 검증 후 정확히 원복. 관련 BE3/FE3, 타입·린트·BE/FEbuild·diffcheck PASS. 전체 통과 MD 반복 없음.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-pivot-recovery-20261014/RESULTS.md`, `definition-before.png`, `recovery-desktop.png`, `recovery-mobile.png`, `ui-results.json`.

남은 NOT_RUN: 정의 변경 후 저장 보기 갱신·재추가 전체 여정, 유효/오류 Pivot 혼합목록 실제 UI, 합성 필터5개 초과·timestamp 경고 UI, 긴 이름 변형·실기기 touch. VoiceOver BLOCKED. gpt-6-luna 설정 유지/AI호출0.

## 2026-10-14 정의 갱신·재추가 및 긴 제목 후속

기준 `0850f0ec`, 제품 코드 변경 없이 PIVOT-DASH-03/04 미검증 변형만 진행했다. 격리 QA 지표1의 definition.label을 DB fixture에서 변경하여 실제 catalog revision이 바뀌는 조건을 만들었다(지표 편집 UI 자체는 NOT_RUN). 기존 보기 불러오기409·안내/원보기 보존→목록 재조회→새 Pivot 설정→긴 이름 새 보기 저장→기존 대시보드 추가→오류/정상 혼합 카드 표시→기존 오류 카드 Enter 제거→새로고침 후 갱신한 Pivot 정상 표시 PASS.

390px 긴 제목 줄바꿈·제거/CSV 레이블·표 내부 스크롤·문서 overflow0 PASS. 제목18px·제거 버튼36px·섹션폭366px. 데스크톱/모바일 캡처 직접 검토. 최초 모바일 캡처는 고정헤더가 제목을 가려 증빙으로 채택하지 않고 위치 조정 후 재캡처했다. 제품 수정 필요 오류는 없었다. 전체 기간 숫자는 관찰만 하며 이전 정확성 검증을 재사용했다. 관련 코드 변경이 없어 빌드/단위를 반복하지 않았다.

종료 후 원 지표 정의·대시보드 Pivot snapshot 정확히 원복하고 이번 생성 보기4만 삭제했다. AI gpt-6-luna 설정·VoiceOver BLOCKED 유지, AI호출0. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-readd-20261014/RESULTS.md` 및 `mixed-desktop.png`, `readded-mobile.png`, `ui-results.json`.

잔여 NOT_RUN: 합성 필터5개 초과·timestamp 기간 경고 UI, 실기기touch, 실제 지표 편집 UI를 통한 정의 변경. 재추가/혼합목록/긴 제목 변형은 이 후속 범위에서 해소했다.

## 2026-10-14 합성 필터·timestamp 경고 후속

PIVOT-DASH-02/04 잔여 경고 변형: 기본bid_floor + 공통5컬럼=6개, 저장보기의 ISO UTC timestamp1시간을 실제 UI에서 적용했다. 경고·Pivot 요청0·이전표 제거·CSVdisabled PASS. Enter 적용/필터 초기화 후 집계재개·표복구 PASS. 시간차트 직접클릭은 이 실행 범위가 아니며 timestamp 저장보기 경로로 확인했다.

최초 status가 원인과 다른 기간·지표선택 문구여서 pauseReason으로 원인별 중지 안내를 보완했다. 최종390px overflow0·경고/기간 줄바꿈·제목/버튼/비활성상태 디자인 직접 캡처검토 PASS. Aside desktop 최초화면/헤디드390 최종화면 증빙. FE관련11PASS/타입·린트·build·diffcheck PASS. 테스트fixture시간문자열 및 미등록matcher오류는 검증코드에서 수정했다.

증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-limits-20261014/RESULTS.md`, `filter-mobile.png`, `time-mobile.png`, `ui-results.json`. 생성 QA보기5/6만 삭제. gpt-6-luna/VoiceOverBLOCKED 유지. 현재 명세의 Pivot 연결 잔여 경고·복구·긴제목 변형은 완료. 실제지표편집UI·실기기touch/VoiceOver는 미검증 범위로 유지한다.


## PIVOT-DASH-05 — 여러 Pivot 중복 조회 최적화 (2026-10-14)

동일소스/기간/필터/지표/축의 저장Pivot을 UI에서같은대시보드에2개추가해3카드로측정. 기대: 동일진행중요청1개공유·서로다른조건분리·필터변경새조회·한카드취소가형제조회취소않음·완료결과캐시않음.

**PASS_SELECTED_VARIANTS**: 초기실제POST3→1(66.7%감소), 모든카드56663800. App열키보드Enter공통필터추가후추가POST1회·모든카드18363600, 저장bid_floor범위/기간유지.1440/390캡처디자인확인·모바일문서overflow0/표내부포커스ArrowRight PASS. 신규요청풀대시보드mount범위/동일semantic key, 마지막구독자만취소, 완료/실패즉시제거; 값같은filterobject재렌더추가조회0. 관련단위14+신규rerender1·FEtype/lint/build PASS. 생성attachment정확한ID2개씩정리/원카드유지. 제품diff미커밋.

완료결과캐시/다른조건쿼리통합/빠른연속필터debounce는추가하지않았다. 별도대시보드/사용자전역공유없음. 전체Tab·실기기touch/VoiceOver미실행/차단유지. gpt-6-luna유지/호출0, 기존통과전체반복없음. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-dedup-20261014/RESULTS.md`, `before-results.json`, `after-results.json`, `after-desktop.png`, `after-mobile.png`.


## PIVOT-DASH-06 — 빠른 필터 변경 최종 조회 (2026-10-14)

기준3d8c3a87+diff. 대시보드Pivot만최종필터250ms대기(초기/축/재시도즉시). 동일조건pending공유·완료캐시없음유지. 공통analysispause시예약취소/마지막제출필터비교유지. 초기화가조회중disabled여서키보드입력무시오류발견→busy조건제거·최종재검증.

**PASS_SELECTED_VARIANTS**: UI동일Pivot2개추가해3카드,1440/390에서App열Enter→초기화Enter(327/211ms)·Pivot추가요청각1회/최종App없음·모든카드56663800 exact. 데스크톱은250ms초과지만공통조회pause가중간예약취소; 모바일은250ms내. 신규단위빠른Mobile→Tablet최종1조회/대기표·CSV차단/unmount예약취소 PASS. 관련Pivot+DashboardAnalysis50PASS·FEtype/lint/build PASS. 모바일overflow0/캡처레이아웃/폰트/표내스크롤확인. 생성카드정확ID정리·원카드보존.

공통AIpreview·독립Explore조회는변경없음(전체요청최적화로확대않음). 기존마지막제출필터로복귀시즉시조회; 다른필터변경은250ms대기. FullTab·실기기/VoiceOverNOT_RUN/BLOCKED. gpt-6-luna유지/호출0. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pivot-filter-debounce-20261014/RESULTS.md`, `rapid-results.json`, `after-results.json`, `rapid-1440.png`, `rapid-390.png`. 이번후속변경미커밋,이전중복조회3d8c3a87커밋/push완료.
