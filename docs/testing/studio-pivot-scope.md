# Studio Pivot — 블록 집계 조건과 도움말

2026-10-19 · 기준 develop-v2 `2246b569`. [동일36행 Rill 비교](rill-pivot36-comparison.md)의 가시성 개선 후속. 사용자의 ‘다음’ 승인으로 기존 Pivot 카드에 적용 범위/정확한 임계값을 표시하고 긴 안내를 접는다. 계산·정의/저장·공개 계약은 기존 경로를 사용한다.

| ID | 조건 | 기대 | 상태 |
|---|---|---|---|
| SPIV-UX-01 | dashboard27/source30의 고정 매출≥1000·마진<20% | ‘이 블록에 적용’/customer별 AND·총매출≥1000USD·마진<20%, 실제 snapshot 이름/단위·임계값 정밀도 보존 | PASS_SELECTED · 아래 범위 |
| SPIV-UX-02 | 접힌 집계·기간 도움말, Enter/Space 열기/닫기와 표 Home/End | 표를 먼저 읽기 쉬움·정확한 기간/필터/상한/총합/키보드 안내 접근·토글 요청/쓰기0·표 내부 스크롤 | PASS_SELECTED · 아래 범위 |
| SPIV-UX-03 | 390/768/1440 및 긴 이름/공개 집계 | 카드/조건 wrap·폰트/버튼/정렬·overflow0·숫자/기존 자산 불변, 공개 조건 신규 비노출 | PASS_SELECTED · 아래 범위 |

기존 Rill36행 정답10862.50USD·5.39%/4셀과 기본 저장/게시/복구 PASS는 재사용한다. 새 대시보드/AI/게시·전역 필터 적용을 실행하지 않는다. 제품 gpt-6-luna·VoiceOver BLOCKED·실휴대폰/운영/전체P5/TC005 수용Open 유지. 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-scope-20261019/`.


## 변경과 선택 검증

`StudioPivotConditions`는 확인된 블록 recipe의 차원/조건과 같은 미리보기 응답의 지표 이름·단위만 읽는다. 현재 지표 catalog를 재조회하지 않는다. 임계값은 표시용 소수 자릿수로 반올림하지 않아1000.0001을1000.00으로 잘못 설명하지 않는다. `%`는20%, USD는1,000USD로 명시하며 모든 조건은 AND다. 결과에 없는 지표 이름/단위를 추정하지 않고ID/단위 확인 필요로 표시한다. 새 문서는 기존 계산 scope 검사를 통과한 블록에만 나타난다.

Studio에서만 `compactHelp`와 소유자의 저장 기간/원본 필터 설명을 넘겨 native details ‘집계·기간 안내’에 기존 긴 문구를 보관한다. 기본 Explore/공개 집계에는 이 소유 조건 컴포넌트/recipe를 전달하지 않는다. 일부 대상/열이 표시 상한으로 생략된 경고는 접힌 안내 바깥에 남는다. 표의 키보드/드릴·숫자/CSV/저장 경로는 바꾸지 않았다.

최초 새 컴포넌트 import의 모듈 누락은 실행 오류였다. 최소 stub으로 렌더할 수 있게 한 뒤 실제 누락 동작의 **RED3/기존PASS2**를 확인해 구현했다(`red-behavior.log`). 최종 **FE3파일8PASS**, FE type·변경6파일 non-fixing lint·FE build1.49초 PASS다. 단계별8건을 합산하지 않는다. 공개 aggregate-only 렌더 회귀는 조건 목록/‘이 블록에 적용’이 나타나지 않으며 읽기/쓰기 호출0임을 확인했다. 새로운 공개 링크/실제 익명 HTTP 여정은 수행하지 않았고 해당 기존 검증을 재사용한다.

## Ego43 실제 실행

기존 테스트 소유 계정·dashboard27/source30·웹3460/API4560을 읽기만 했다. 기존36행 Rill/Decimal 정답과저장 정상·재시작 복구를 반복하지 않았다.

1. **SPIV-UX-01:** 카드에서 ‘이 블록에 적용’, `customer별 · 모든 조건 충족 (AND)`, `총매출 ≥ 1,000 USD`, `마진 < 20%`를 실제 확인했다. 네 셀·행/열/전체 합계는 이전과 동일하며 전체10862.50USD/5.39%를 화면에서 확인했다. 단위 검사에서 소수 임계값 보존과 메타데이터 누락 시 추정 금지도 확인했다.
2. **SPIV-UX-02:** 도움말은 기본 닫힘이다.390px에서 summary에 키보드 초점을 두고Enter→열림/가시 초점 유지, Space→닫힘, Tab→집계 조건 Pivot 표, End→scrollLeft292/client332/전체624px와가시 초점true를 확인했다. 도움말 열림에서도 표는 안내 아래에 있고 겹침0이다. 안내에는저장 필터0·전체 기간/공통 조건 우선 규칙·50/20상한·총합 재계산·Home/End 설명이 있다. 조작 구간 API 요청0이며 조건 토글/정리용 쓰기도 없다.
3. **SPIV-UX-03:**390/768/1440에서 조건 본문14px·안내 조작부32px/14px·페이지 가로 넘침0을 실측했다. 첫 안내28px/12px를 기존 도구 기준에 맞춰32px/14px로 개선했다. 긴 이름은 저장 자료를 수정하지 않고 DOM 문자열에만 약144자의 한글 이름을 임시 주입해 줄바꿈/레이아웃을 확인한 후 원복했다.390px 조건 최대332px/컨테이너332px·넘침0·아래 표 겹침0이다. 이 스트레스 검사는 실제 긴 catalog 저장/서버 여정으로 보고하지 않는다.

문서 전후를 추적한12개 자산 테이블 행digest는2246b569 종료와 모두 같다. 블록 ID/recipe/지표·대시보드/보기/게시/영수증과기존 파일을 변경하지 않았다. 신규 데이터/대시보드/AI 호출·저장·게시0이다. source/SQL/worker/모델 설정 변경은 없어 BE·전체 E2E를 반복하지 않았다. 셀 반올림/임계값의 표시를 계산 변경으로 혼동하지 않는다.

## 증빙

외부 root의 `layout.json`, `keyboard.json`, `long-label-layout.json`, `metadata-check.json`/`metadata-final.json`, `red-behavior.log`/`selected-final.log`·type/lint/build 로그를 대조했다. 실제 캡처를 직접 열어 조건 줄바꿈/정렬·펼친 안내·표와가시 초점을 확인했다.

- [모바일 카드·조건·정확한 합계](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-scope-20261019/card-final-390.png)
- [1440px 조건과 전체 표](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-scope-20261019/conditions-1440.png)
- [모바일 도움말·가시 포커스](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-scope-20261019/help-open-390.png)
- [긴 문구 레이아웃 스트레스](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/studio-pivot-scope-20261019/long-label-layout-390.png)

제품 gpt-6-luna와 VoiceOver BLOCKED를 유지한다. 실제 휴대폰/VoiceOver·전체 키보드/언어·공개 조건 노출 정책 변경·전체 UX 동등성/운영/기업16개 수용은 별도다. 이번 변경은 기존 화면의 읽기 가시성 개선이며 전역 집계 조건 기능을 구현한 것이 아니다.
