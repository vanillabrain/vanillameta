# UC038 publication conflict evidence

2026-10-16. P4/FR009·011/NFR003·004. [UC](../use_cases/UC-038-publication-conflict.md) · [설계](../architecture/publication-conflict.md) · [계획](../plans/UC-038.md) · [TC](../test_cases/TC-038-publication-conflict.md).

## 변경

게시409 뒤 낡은 저장 버전의 게시 handler/버튼을 잠그고, 게시 대상의 “최신 저장본 확인”을 제공한다. 새 탭에서 기존 Studio의 소유 조회·실데이터 미리보기를 확인한 뒤 그 화면의 저장 버전으로 명시 게시한다. 기존 원본 문서나 저장 영수증을 최신 버전으로 조용히 교체하지 않는다. 같은 props의 닫기/다시 열기나 게시 상태 GET는 잠금을 풀지 않는다. 부모의 dashboardId/revision이 변경되면 충돌 안내/잠금을 초기화한다. 새 버전에서도409면 다시 잠근다. 네트워크/5xx의 동일 envelope 재시도는 유지했다.

상위 게시 창/기존 UI Kit36px 버튼을 그대로 사용하며 중첩 Dialog·새 SQL/집계/버전 병합 API·전역 크기 예외·엔티티/의존성을 추가하지 않았다. 이 기능의 미리보기는 링크로 연 기존 Studio 화면의 최신 저장본이며, 별도 publication snapshot 미리보기 API가 아니다.

## 환경과 실제 기능 PASS_SELECTED

기준165cdea0 + 이번 develop-v2 변경. 기존 FE3698/API4898/정상 proxy4899와 격리 SQLite `/tmp/vm-rill-views/metadata.db`를 유지했다. Ego **80 하나**의 p1 원본39/생성45 게시 준비, p2 실제 저장 및 공개 조회, 복구 링크가 연 p3 최신45로 실행했다. 공개 합성 source32만 사용했고 신규 LLM 호출/모델 교체는 없다. 원 GET/XHR/캡처는 저장소 밖 `/tmp/vm-uc038/`에 있다.

1. p1에서 UC037 생성 저장 영수증45의 게시 설정을 열었다. p2에서45의 첫 블록 제목을 `환불 비율 · 최신 저장본 UC038`로 실제 수정→저장201/GET200했다. 소스/수치·다른 블록/모든 폭 배치는 유지됐다.
2. p1의 예전 revision 게시 POST가 서버의 실제 **409**로 거절됐다. fault injection은 없다. 기존 게시 조회는 전후 null로 같고 낡은 버전의 게시 버튼이 잠겼다. 링크는 원본39가 아닌 **/dashboard/45/studio**였다.
3. 모바일에서 링크를 실제 클릭해 p3를 열었다. 최신 제목·21.23%·시계열과 GET의 새 revision을 확인했다. 최신 화면의 게시 창에서 link 공개를 명시 선택해 POST201/version1을 만들었다. 쓰기는45의 최신 저장 revision을 사용했고 복제 허용 false였다. 이전 링크는 이미 중지된 상태였으므로 새 URL이다.
4. 인증 헤더 없는 공개 GET200과 실제 공개 화면 reload에서 최신 블록 제목·숫자21.232116243169088%(화면21.23)·날짜별37점·총매출20994.61을 확인했다. 금액4457.60/20994.61×100의 독립 정답과 일치했다. 공개 응답에 SQL/sourceId/자격 증명은 없다.
5. 원래 p1에서 닫기→AI 다시 열기→같은 게시 준비를 했을 때 최신 게시 상태를 GET했지만 예전 저장 기준의 재게시 버튼은 계속 잠겼다. 추가 게시 POST는 없었다.
6. p3에서 임시 게시 중지201 후 익명 GET410을 확인했다. 검증용 첫 블록 제목도 UI에서 원래 `환불 비율`로 복원→저장201했다. 원본39 document/definitions/sourceRevision·게시 상태는 전후 완전히 같다.45 document/definitions는 **revision을 제외한 전체 내용이 원복**됐고 sourceRevision도 같다. 정상 저장이므로45 revision은 새 값이며 이전 생성 저장 영수증을 덮어쓰지 않았다.
7. 최종 코드에서도 이전 영수증의 게시409·잠금/링크를 다시 확인했다. 실제 키보드 Tab의 포커스가 게시 창 안에 남았다. 최종 검증 이후에도 임시 링크는 중지 상태다.

저장 대기 조건을 /45가 아닌 /45/save로 수정한 자동화 대기 실패와, 개발 HMR이 effect를 다시 실행해 기존 충돌 표시가 사라진 시점의 locator 실패는 관찰 오류로 구분했다. 저장 XHR201/GET200을 먼저 읽고 복구했으며, HMR 후 최종 코드로 실제409를 재검증했다. 이 실패를 제품 저장 실패나 브라우저 차단으로 일반화하지 않았다.

## 디자인 PASS_SELECTED

충돌/복구 링크·공개 화면을390/768/1440에서 캡처·실측하고 직접 확인했다. 가로 넘침0, 링크36px/14px이며 긴 안내/대상 번호도 경계를 벗어나지 않았다. 중복 오류 카드를 합쳐 안내1개와 복구 동작1개를 제공했다. 모달 하단 게시 버튼은 비활성이고 닫기와 복구 링크를 조작할 수 있다. 기존 숫자·시계열 화면을 재사용했으며 모바일에서도 읽혔다. `conflict-{width}.png`, 최종 `final-conflict-{width}.png`, `recovery-link-{width}.json`, `latest-preview-{width}.png`, `public-{width}.png`에 증빙했다. 모든 로딩/오류·실휴대폰 전체 상태 검증은 아니다.

## 실행 검사와 한계

- 선택 FE **47 PASS**: StudioPublish/StudioEditor/studioPublication.409 잠금/reopen·새 revision 해제·재충돌, 실제99 대상 링크·원본 dirty 유지, 기존5xx 동일 envelope 재시도/권한 조회 실패/중지 회귀를 포함한다.
- FE type/lint/build PASS. 격리 core **8 PASS**: `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-BxvzPG/evidence/playwright-001.log`.
- 저장된 실제 GET/XHR/폭/수치 대조 **40/40 PASS**, `/tmp/vm-uc038/assertions.json`. 최종409/포커스 보강은 `final-conflict.json`, `keyboard.json`.
- Strict 문서 검사는 기존12 errors/33 warnings/4 infos를 유지하며 새 UC038 오류는 없다. baseline을 자동 승인하지 않았다. pin/check/packet은 digest·검토 준비이며 사람 승인/제품 수용은 아니다.

Main이 변경 코드·서버 CAS 무변경·기존 호출부·UC/BR/TC 계약을 별도 대조했다. 독립 리뷰는 이번에 실행하지 않았다. 기존 요구사항/엔티티/용어 책임은 바뀌지 않으며 UC037에서 지적한 실제409 화면 공백을 이번 선택 여정으로 채웠다. A1 최신 조회 실패·권한 거절과 A2 최신 화면에서 다시 바뀌는 조합은 기존 컴포넌트 회귀이며 이번 실제 화면에서는 NOT_RUN이다. 운영MySQL/실휴대폰/VoiceOver·모든 응답 유실/경합 조합·TC005 사람 수용은 Open이다. Rill 탐색·수치/집계 구현을 변경하지 않은 게시 복구이므로 새 Rill 비교를 반복하지 않았다.

후속 [UC039](latest-dashboard-read.md)에서 A1의 최신 읽기503→명시 재시도 및 타 소유27 실제403 화면을 선택 검증했다.45의 실제 권한 회수·동시 반복 조합을 포함한 전체 A1/A2 수용은 별도다.

[UC038 A2 후속](publication-reconflict.md)에서 활성 게시본을 보존한 첫409→최신 조회 후 다시 저장→두 번째 실제409→최신 확인/명시 재게시를 검증했다. 모든 경합 조합/전체 수용을 뜻하지 않는다.
