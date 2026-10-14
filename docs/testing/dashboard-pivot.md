# 저장한 Pivot 대시보드 연결

2026-10-14 기준 codex/self-service-next-20261014 @c59d10fa + 작업 diff. 이전 Pivot 저장/CSV는 c59d10fa커밋, 이번 신규 연결·디자인만 검증. source3 Rillauction1391572행/user2/dashboard2. AI codex/gpt-6-luna 유지 호출0, VoiceOver BLOCKED.

| ID | 조건 | 기대/결과 |
| --- | --- | --- |
| PIVOT-DASH-01 | 저장한Pivot→같은소스대시보드선택→추가→새로고침 | 설정스냅샷복사/원보기변경영향없음/재조회지속. 분석정의·기존위젯보존. PASS API+UI |
| PIVOT-DASH-02 | 공통App필터·공통날짜변경/Pivot열클릭 | 공통조건같은열우선/다른기본범위유지. 요청56663800→App18363600. 날짜2023-09-10~10공통override XHR. PASS |
| PIVOT-DASH-03 | 타소유자/다른소스/비Pivot/8개초과/정의변경/제거 | 거부/오류안내, 설정삭제않음. 제거만해당ID·원지표/분석정의보존. PASS선택API. 정의변경브라우저미실행 |
| PIVOT-DASH-04 | 1440/390px 추가dialog·카드·Tab/Enter/표스크롤/Escape | 문서overflow0/표내부스크롤, 레이블/폰트/카드padding/정렬·간격·기존테마일관. PASS_SELECTED_VARIANTS |

디자인:중복Pivot제목·비활성축select가공간차지→임베드요약으로줄임. 제목18px/600,표13px/숫자우측정렬/표내부최대600px/모바일세로카드12px패딩/표버튼32px(데스크톱24px). 실제period/filter표시로기존KPI와다른범위도명시. 동일소스분석대시보드만목록표시. 모바일dialog로드완료후Escape/focus흐름확인. 전후캡처직접검토.

범위:공통조건미선택시는저장한기본필터·기간사용. timestamp정밀공통기간은경고/집계중지(날짜만지원). 공통/기본필터합5개초과중지. 공유/익명Pivot뷰·드래그위젯배치·차트편집기통합·전그룹export·실기기터치·VoiceOver범위밖. 스냅샷최대8개. 메타DB새nullable컬럼/migration. 새스킬UI회귀기준원본·설치본갱신/frontmatter검사PASS;pythonvalidator는PyYAML없어미실행.

검사BE신규3PASS/FE연동2포함최종108PASS,변경Explore/Pivot29PASS,타입·lint·BE/FEbuild·diffcheckPASS. 기존테스트mock새API충돌발견→새컴포넌트mock분리+독립mounted연동검사추가→재검사PASS. 전체통과MD반복없음. 증빙 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/dashboard-pivot-20261014/RESULTS.md`.
