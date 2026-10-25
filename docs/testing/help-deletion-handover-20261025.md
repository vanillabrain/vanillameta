# 삭제 보호·인계 의향 실제 도움말 검증 — 2026-10-25

기준 `develop/ca774ce1`, 제품 코드 수정0. [기능별 시나리오](../user-manual/site/feature-scenarios.md)33·35·36·37·38·39·40의 미실행 대표 UI를 Ego67에서 검증했다. 앞선 일반 검사·MySQL192조건은 관련 코드가 같아 재실행하지 않았다. 실제 최종 소유권 이전(41~43), 조직 이동·탈퇴, 대시보드 영구 삭제34는 이번 범위가 아니다.

## 환경·준비

별도 fresh dev MySQL8.4.11/native DuckDB, Node26.12.1, API4263/Web3263/Control4463. 정상 API로 전용 소유/수신 계정·같은 조직을 준비하고 source2의 SUM(amount) metric1을 dashboard2에 연결했다. 별도 미사용metric2, 삭제 전용source3은 이번 검증에서만 사용한다. 합성 입력은100+200+50=350. AI 호출 없이 준비했으며 gpt-6-luna 설정·VoiceOver 차단은 유지했다.

## 실제 실행

| 시나리오 | 결과 | 확인 |
|---|---|---|
|33 사용 중 지표 삭제 보호|PASS_SELECTED|`/data/metric`의 목록→삭제 영향. 대시보드 정의1건·삭제disabled. 연결 변경/삭제 실행0|
|33 미사용 지표 삭제|PASS_SELECTED|별도metric2 사용처0→키보드 Tab/Enter 삭제→reload 목록 제외, DB useYn=N. metric1은Y로 유지|
|35 사용 중 소스 삭제 보호|PASS_SELECTED|source2의 데이터셋1·지표1·대시보드1 표시·삭제disabled. 원본 보존|
|35 미사용 소스 삭제|PASS_SELECTED|별도source3만 명시 삭제→영수증1·파일 정리 대기. reload 목록 제외·DB 행0|
|36 삭제 확정 파일 정리|PASS_SELECTED|영수증의 관리 파일1개에 별도 ‘파일 정리’ 실행→완료. 다른 소스와 원본 집계 보존. 임의 경로 삭제/외부 원본 삭제 없음|
|37 퇴사·인계 영향 읽기|PASS_SELECTED|admin의 직원1 조회: 전체소스2·비활성포함지표2·단독대시보드2, 나머지 표시관계0. 읽기만 실행|
|38 의향 생성·수락·reload·철회|PASS_SELECTED|소유자가 source2+dashboard2의 제목/번호 공개 동의→수신자2의 별도 고정 목록 검토·Space/Tab/Enter 수락→reload 동일 요청 재조회→소유자 철회|
|39 연결 검토|PASS_SELECTED|수락 이후 원소유자 GET: 대시보드 필요소스1·선택소스1·누락0, source 지표2(비활성 포함). 실제 이전 실행 불가 안내|
|40 파일·갱신 관측|PASS_SELECTED|관리파일1·연결신원 관측·알려진 공유 미관측·열린 갱신 미관측. 파일 내용정상/배타적보관/이전승인으로 해석하지 않음|

수신자는 유효한 context200 상태에서도 원본 source/profile과 dashboard가403이다. 의향 수락은 접근권을 부여하지 않는다. 철회 후 수신자 GET200·status=cancelled·version3·detailsAvailable=false·assets0으로 제목/번호 공개 종료를 확인했다. 요청 번호를 다른 사람에게 외부 메시지로 발송하지 않았고 두 합성 계정에서 같은 번호를 직접 입력했다.

## 보존과 정답

의향 생성 전/수락 후/철회 후의 source2 소유자1·암호화 connectionConfig hash, dashboard2 user_mapping 소유자1·title/analysis/structured/pivot/layout 묶음 hash, metric1/2의 정의 hash와 사용상태가 모두 동일하다. 미사용metric2의N·source3 행0은 삭제 후 기준이며 삭제 전 모든 DB 불변이라는 뜻이 아니다. 마지막 실제 `/bi/preview`201에서 보호된metric1 합계350을 다시 확인했다. 전체 파일 bytes/hash 검증이나 전체 DB table 불변으로 확대하지 않는다.

## 모바일·키보드

지표 차단 대화상자와 수신자 수락 화면390/768/1440px 가로 넘침0, 파일 검토390/1440px 넘침0. 소스 차단은390px 대표 캡처다. 지표 삭제는 사용처 읽기 버튼→Tab 삭제→Enter, 수신자 수락은 검토checkbox Space→Tab 수락→Enter를 실행했다. Escape로 대화상자를 닫았다. 캡처를 직접 열어 라벨·건수·줄바꿈·버튼과 비활성을 확인했다. 실기기·전체키보드·VoiceOver는 별도다.

## 발견·도움말 보완

- 지표 삭제는 지표 빌더가 아닌 **데이터→메트릭(`/data/metric`) 목록**이었다. 시나리오33의 경로를 수정했다.
- 인계 요청 번호는 reload 때 자동 보관되지 않으므로 같은번호 재입력→명시 상태조회 방법을38에 추가했다.
- 파일 검토 버튼은 원소유자가 연결·보관 검토를 먼저 조회한 뒤 접근하므로40의 순서를 구체화했다.
- 초기 리스트 로딩 중 클릭, 로그아웃 확인 대화상자 누락, 확정 이전의 snapshot·부정확한 기대 문구 대기는 도구 조작 미완료로 기록한다. 실제 현재 화면을 확인하고 정상 UI 절차로 이어갔으며 이를 제품 실패나 통과로 세지 않았다.

제품 권한/삭제/인계 로직 변경0이며 기존 통과 단위검사를 반복하지 않았다. 도움말의 진입/재조회 절차만 보완하고 실제 모바일 캡처2개를 추가했다.

## 증빙과 잔여

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/help-deletion-handover-20261025/`의 fixture.json, before/accepted/cancelled-handover.json, recipient-access/cancelled.json, original-oracle.json, assertions.json, 지표/소스 삭제·인계/파일 검토 캡처. UUID는 해당 격리자료 요청 번호이고 비밀번호·토큰은 공개 기록에 넣지 않았다.

삭제36의 실제 파일 정리 완료는 UI와 서버 영수증으로 확인했으며 독립 파일시스템 before/after hash 검사는 하지 않았다. 실제 이전41~43·조직 이동44·탈퇴45·대시보드삭제34 및 나머지 시나리오의 미실행 조합은 그대로 남는다. 기존 사용자 서버·데이터·다른Colima프로필은 사용하지 않는다. 런타임·문서 배포 확인은 후속 기록을 따른다.

최종 로컬 문서 검사27HTML·1529참조·오류0, diff check PASS. 감독기 /stop200 및 ownedContainerRemoved=true·temporaryCredentialsRemoved=true·persistentVolumesCreated=0을 확인했다. 운영 제품 배포는 실행하지 않으며 도움말만 기존 Pages 경로로 배포한다.
