# UC038 A2 active-publication reconflict evidence

2026-10-16. P4/FR009·011/NFR003·004. [UC038 A2](../use_cases/UC-038-publication-conflict.md#alternative-flows) · [계획](../plans/UC-038-A2.md) · [TC038](../test_cases/TC-038-publication-conflict.md).

## 결과와 변경 범위

**PASS_SELECTED.** 첫409로 최신 저장본을 읽은 뒤 다른 탭이 다시 저장하여 게시 직전에 두 번째409가 발생하는 실제 여정을 확인했다. 기존 동작이 계약을 만족해 **제품 구현은 수정하지 않았다**. 활성 게시본의 URL/버전/설정이 두409 동안 보존되고 최신 revision도 명시 동작 전에는 게시되지 않는 컴포넌트 회귀1개만 추가했다. 새로운 UC/API/버전 병합/전역 UI 변경/의존성은 없다.

## Ego 실제 실행

기준76c76ddd + 테스트/문서 변경. 기존 FE3698/API4898/정상 proxy4899/격리 SQLite와 공개 합성 source32·원본39·저장45를 사용했다. Ego **82 하나**에서 p1 원본39/이전 영수증, p2 저장45 작성 및 공개 조회, p3 첫 최신 R0, p4 두 번째 최신 R1로 진행했다. 신규 LLM 호출/프록시 장애 주입/권한 변경은 없다. 원 GET/XHR/캡처/대조는 저장소 밖 `/tmp/vm-uc038-a2/`에 있다.

1. p2에서 현재 저장45를 link 공개/복제false로 명시 게시해 활성 version1을 만들었다. 익명 GET200의 전체 본문과 metadata를 고정 기준으로 보관했다.
2. p1에서 생성45의 이전 저장 영수증으로 재게시하여 첫 실제409를 받았다. 게시 버튼은 잠기고45의 최신 저장본 확인 링크가 나타났다. **익명 응답 본문 전체가 기준 version1과 같았다.**
3. 복구 링크를 실제 클릭해 p3의 현재 저장45/R0를 읽었다. R0는 실행 전 저장본과 같았고 게시 창은 기존 version1/URL/공개 범위를 표시했다. 이 시점에는 재게시하지 않았다.
4. p2에서 첫 블록 제목을 `환불 비율 · 재충돌 검증 A2`로 변경→실제 저장201/GET200하여 R1을 만들었다. p3의 방금 읽은 R0로 재게시하자 두 번째 실제409였다. **두 번째에도 익명 응답 본문 전체·URL·version1·데이터가 기준과 같았다.** 두409 모두 서버 CAS이며 mock/fault injection이 아니다.
5. p3의 복구 링크를 실제 클릭해 p4에서 R1/새 제목/21.23%와 시계열을 확인했다. 기존 게시 설정은 link/복제false를 표시했다. 미리보기·게시 설정을 닫고 다시 여는 동안 GET만 발생했으며 자동 게시0이었다.
6. p4에서 명시 재게시201로 **같은 URL/version2**를 확인했다. 요청 expectedRevision은 R1이었다. 익명 GET200과 실제 공개 reload에서 새 제목·3블록·같은 ID/배치·환불률21.232116243169088%(화면21.23)·날짜별37점·총매출20994.61을 확인했다. 금액4457.60/20994.61×100의 독립 정답과 일치했다.
7. p4에서 임시 게시 중지201 후 익명 GET410. 첫 블록 제목을 원래 `환불 비율`로 UI에서 복원→저장201했다. 원본39의 document/definitions/sourceRevision·게시 상태는 전후 완전히 같고,45의 document/definitions는 revision을 제외하면 완전히 원복됐다. 정상 저장으로45 revision은 새 값이며 기존 생성 저장 영수증은 갱신하지 않았다. 두 이전 창의 재게시 버튼은 계속 잠겨 있었다.

## UI·디자인 PASS_SELECTED

두 번째 충돌 안내·활성 게시 카드/URL·disabled 재게시/복구 링크와 공개 version2 화면을390/768/1440에서 실측·캡처했다. 모두 가로 넘침0, 복구 링크36px/14px·정확한45 경로다. 좁은 화면에서 긴 안내/새 블록 제목이 줄바꿈되고 모달 내부만 세로 스크롤하며 하단 버튼이 읽혔다. 복구 링크에서 Tab을 눌렀을 때 포커스가 게시 창 안에 남았다. 더 최신 R1의 숫자·차트 미리보기1440/390과390px 실제 복구 링크/재게시/중지를 확인했다.

캡처: `second-conflict-{width}.png`, `latest-r1-preview-{width}.png`, `public-v2-{width}.png`. 직접 확인한 폭/상태만 PASS이며 모든 로딩/오류·실휴대폰·전체 접근성 검증은 아니다.

## 실행 검사·재사용·한계

- 새 회귀를 포함한 StudioPublish/studioPublication **20 tests PASS**. 두409의 활성 게시본/URL 유지·새 revision에서도 명시 전 POST0·확정 후 같은 링크 version2를 검사한다.
- FE 타입/변경 테스트 lint PASS. 실제 저장/XHR/공개 본문·정답/폭 자동 대조 **48/48 PASS** (`assertions.py`, `assertions.json`).
- 제품 소스가76c76ddd와 같아 build/core를 이번에 반복하지 않았다. 이전 [UC039](latest-dashboard-read.md)의 build/core8 증빙을 재사용하며 이번 새 실행으로 보고하지 않는다. 전체 단위/운영 테스트도 미실행이다.
- strict lint는 기존12 errors/33 warnings/4 infos, 신규 계획/TC 이슈0이며 baseline 자동 승인0. pin/check는 digest 검사이고 packet은 awaiting_review/acceptance not_recorded다.

Main이 변경 테스트·서버/FE 무변경·계획/UC038 A2/TC 계약을 별도 대조했다. 독립 리뷰는 실행하지 않았다. 요구사항/엔티티/용어/설계 책임은 바뀌지 않았다. UC038의 A2 실제 화면 공백을 이 선택 실행으로 보완했으며 무한 반복·응답 유실/권한 회수와의 모든 조합·운영MySQL/실휴대폰/VoiceOver·사람 전체TC005 수용은 Open이다. Rill 분석/집계 구현은 바뀌지 않아 비교 화면을 반복하지 않았다.
