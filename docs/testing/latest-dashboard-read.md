# UC039 latest saved dashboard read recovery evidence

2026-10-16. P4/FR009·011/NFR003·004. [UC](../use_cases/UC-039-latest-dashboard-read.md) · [설계](../architecture/latest-dashboard-read.md) · [계획](../plans/UC-039.md) · [TC](../test_cases/TC-039-latest-dashboard-read.md).

## 보완과 재사용

UC038 최신 저장본 확인 이후의 읽기 실패/재시도·접근 거절은 기존 StudioStateScreen과 fetchStudioDashboard 오류 처리를 재사용했다. 새로운 설정·모드·버튼은 추가하지 않았다.

대상 조회 도중 경로가 바뀌면 이전 요청의 늦은 오류가 현재 정상 화면을 오류로 덮는 문제를 회귀로 재현했다(`fe-red.log`:1 failed/31 passed). StudioEditor load에 요청 세대를 추가하고, 이전 성공/오류·unmount 결과를 적용하지 않도록 했다. Workspace는 result.document.dashboardId가 현재 route와 같을 때만 표시한다. 네트워크 요청 취소나 서버 작업 중지를 구현한 것은 아니다. API/엔티티·의존성/전역 UI 토큰/게시 CAS는 바뀌지 않았다.

## 환경과 실제 기능 PASS_SELECTED

기준88758206 + 이번 develop-v2 변경. FE3698/API4898/SQLite `/tmp/vm-rill-views/metadata.db`, 공개 합성 source32, 원본39/저장45를 재사용했다. Ego **81 하나**에서 진행했다. 신규 LLM 생성·모델 변경은 없었다. 원 GET/XHR·캡처·장애 주입 기록은 저장소 밖 `/tmp/vm-uc039/`에 있다.

1. p1 원본39의 대화→이전 생성 영수증45 게시 준비→실제 POST409/잠금을 확인했다. UC038 후 저장45 revision이 정상 변경됐으므로 새로운 데이터 수정 없이 이전 영수증이 충돌한다.
2. 기존 대화가 띄운 정상 proxy4899의 정확한 PID/명령을 확인한 뒤 이번 프록시로 잠시 교체했다. **X-VM-Verify:uc039가 있는 GET /v1/studio/dashboards/45 한 번**에만503을 응답했다. 다른 경로/표식 없는 요청은 기존 서버로 전달했다. 관찰한 복구 링크 URL을 표식된 p2 새 탭에서 열어 첫 조회부터503을 받았다. 원 링크의 실제 클릭 자체는 UC038 증빙이며 이번에는 장애 범위를 고정하려 URL navigation을 사용했다.
3. 실패 화면은 기존 안내와 “다시 시도”만 표시했고 편집/게시 버튼은 없었다. 자동 재시도·쓰기0. 실제 버튼 클릭 후 GET200 **1개**로 최신45가 복원됐으며 이전 정의/배치/revision과 동일하고 숫자21.23%·시계열을 표시했다. 주입 로그는 정확1줄이고 remaining0이다.
4. 별도 p3에서 같은 계정으로 실제 타 소유 **27번**을 읽어 서버 GET403을 확인했다. 권한 없음/다시 시도만 표시하고 데이터·편집·게시 버튼이 없었다. 이는 권한 경계의 실제 거절 사례이며 **45번 권한을 실제 회수한 검증은 아니다**. 타 계정 쓰기/사용자 권한 변경은 하지 않았다.
5. 정확히 이번 임시 프록시만 종료하고 기존 정상 proxy4899로 복원했다(PID71094). p2 표식도 해제했다. 정상 환경에서 복원된45 화면의 게시 설정→link 명시 선택/복제false→POST201/version1을 확인했다. 실제 최신 저장 revision을 사용했으며 저장 API나 AI를 실행하지 않았다.
6. p3 공개 화면·인증 헤더 없는 GET200·reload는21.232116243169088%(화면21.23), 날짜별37점, 총매출20994.61과3블록을 보존했다. 4457.60/20994.61×100의 독립 정답과 같았다. 공개 응답에 SQL/sourceId/자격 증명은 없다.
7. 임시 게시 중지201 후 익명 GET410. 원본39/저장45의 document·definitions·sourceRevision 전후가 완전히 같고 원본39 게시도 같다. p1의 기존 충돌 버튼은 계속 잠겼으며 추가 저장·게시 성공은 없다. 이번에는 검증용 제목도 변경하지 않았다.

## 디자인 PASS_SELECTED

503 오류와 실제403 권한 오류·공개 화면390/768/1440에서 가로 넘침0. 기존 재시도 버튼36px/14px, 오류/제목/버튼 간격과 중앙 정렬을 실측하고 캡처를 직접 확인했다. 오류 화면에는 데이터나 게시 동작이 섞이지 않았다.503 화면의 `UC039 controlled...`는 주입 응답의 테스트 문구이며 새 제품 문구가 아니다. 최신 저장본의 숫자·시계열 화면1440/390도 확인했다. 캡처는 `read-failure-{width}.png`, `denied-{width}.png`, `latest-preview-{width}.png`, `public-{width}.png`다. 모든 로딩/포커스/실휴대폰 상태를 확인한 것은 아니다.

## 검사와 미검증

- FE3파일 **60 PASS**: StudioEditor/StudioPublish/studioApi.503 명시 재시도·403 편집/게시 없음·이전 대상 성공/오류 무시와 기존 저장/게시 회귀를 포함한다. 늦은 응답 재현은 변경 전 실패·변경 후 통과를 구분했다.
- FE type/lint/build PASS. 격리 core **8 PASS**: `/var/folders/_k/_fd433317sv9bwb5hgwyckv80000gn/T/vanillameta-qa-iiSfDZ/evidence/playwright-001.log`.
- 실제 GET/XHR·수치·폭/버튼·전후 정의 자동 대조 **46/46 PASS**, `/tmp/vm-uc039/assertions.py`와 `assertions.json`.
- Strict spec lint는 기존12 errors/33 warnings/4 infos이며 새UC039 이슈0이다. baseline 자동 승인0. pin/check는 digest 검사, packet은 awaiting_review/acceptance not_recorded다.

Main이 source/호출부/UC·BR·TC를 별도 대조하고 AGENTS와 UC038 후속 증빙을 동기화했다. 독립 리뷰는 이번에 실행하지 않았다. 기존 요구사항/용어·엔티티 책임은 그대로다. UC038 A1의503과 실제 권한 거절 화면을 선택 확인했으며,45번 실제 권한 회수·다중 장애 반복/동시 새로고침·실브라우저의 늦은 응답 경로 전환·unmount 뒤 상태 갱신의 별도 계측·운영MySQL/실휴대폰/VoiceOver·사람 전체TC005 수용은 NOT_RUN/Open이다. Rill 분석/집계 구현은 바뀌지 않아 새 비교를 반복하지 않았다.
