# 대시보드 삭제·최종 묶음 인계·레거시 표시 후속 — 2026-10-25

기준 `develop/698e82ad`와 이번 제품/검증/도움말 diff. 도움말34·43과 빈 대시보드에서 기존 위젯을 추가하는48의 대표 흐름이다. 별도 소스-only42·대시보드-only41 및 조직 이동44/탈퇴45는 이번 실제 UI 실행 범위가 아니다. gpt-6-luna와 VoiceOver 차단을 유지했으며 이번 LLM 호출은0이다.

## 환경과 전제

Ego68, 전용 API4263/Web3263/Control4463, fresh development MySQL8.4.11/native DuckDB, Node26.12.1. 정상 API로 합성 소스2·지표1·대시보드2와 소유자1/수신자2를 같은 조직에 준비했다. 이미 확인한 제목 의향 생성·수락은 API 전제조건이며 이번 UI 수락으로 합산하지 않는다. 삭제 전용 대시보드4와 재사용 검증용 대시보드5는 인계 원본과 별개다. 원본 정답은100+200+50=350이다.

## 실제 UI 검증

| 조건 | 결과 |
|---|---|
|34 직접 권한이 남은 삭제|직원 read1건 표시·삭제disabled.390/768/1440 가로 넘침0|
|34 권한 회수 후 삭제|별도 정상API 회수→UI 사용처 다시 읽기0건→키보드 명시 삭제→목록 재조회. DB의 대시보드4 행0·별도 인계 원본2 보존|
|43 최종 준비|원소유자 ‘함께 이전할 조건 검토’→소스1·대시보드1·파일1·지표1 확인→별도 동의→준비v1|
|43 수신자 최종 수락|실제 로그아웃·확인·수신자 로그인→같은 의향번호 검토→묶음 상태 조회→별도 동의·Space/Tab/Enter 수락v2|
|43 소유자 최종 실행|원소유자 재로그인→현재 수락·기한 재조회→별도 동의→선택 묶음 전체 이전 실행→완료v3|
|43 이전 전후 권한|수락만으로 소유 변경0. 실행 후 source2.ownerId와 dashboard2.user_mapping은1→2. 원소유자source/dashboard200→403, 새소유자200|
|43 새 소유자 실제 조회|대시보드2 열기·reload350, 같은source2/metric1 실제 preview201·350|
|48 빈 화면|수정 후 정상 빈 대시보드5에 위젯 추가 안내·해당 분석 요청0·삭제 도구 유지.390/768/1440 넘침0|
|48 편집·재사용|제목 `빈 대시보드 & 편집 확인`을 유지해 위젯 추가→저장→수정 확인. 아래 SQL 호환성 오류 수정 후 reload350·빈 안내/정의 오류 없음·390px 넘침0|

최종 인계는 한 쌍이며 모든20개 구성·장애·동시성 변형의 실제 화면 수용이 아니다. 단독 인계41/42의 제한을 우회한 것이 아니라 별도 묶음43 계약을 실행했다. Space·Tab·Enter와 링크 이동은 선택 구간 검증이며 VoiceOver/실기기/전체 키보드 수용이 아니다.

## 보존 증명

`before-transfer.json`·`accepted-not-executed.json`이 동일하다. `after-transfer.json`에서 소유자와catalog/asset 버전만 의도대로 바뀌고, 연결 정보 암호문 hash·지표 정의 hash·대시보드 title/analysis/structured/pivot/layout 묶음 hash가 유지됐다. 전용 uploads의 관리 DuckDB2개는 경로·SHA256이 모두 동일하며 선택 밖 소스3도 포함한다. 원본 파일 복사나 OS chown은 수행하지 않았다.

`access-after-transfer.json`은 양쪽 정상 인증의 source/profile·dashboard 상태와 새소유자350 재집계를 기록한다. `final-preservation.json`은 선택 밖 소스1/3과대시보드1의 소유자1 유지, 위젯 재사용 뒤 저장 Dataset2.query 원문 불변을 확인한다. 재사용 대시보드5 추가는 완료 이후 새소유자의 별도 작업이며 인계 대상에 소급 포함하지 않는다.

## 발견1: 정상 빈 대시보드가 오류로 표시됨

정상 `POST /dashboard {layout:[]}`201·GET200인데 무조건 마운트된 DashboardAnalysis가 `/ai/dashboard-analysis`의 nomappings400을 정의 읽기 실패로 표시했다. 서버는 빈 생성 계약을 지원한다. 프런트는 성공·명시ID일치·현재 요청의 응답이고 widgets/layout이 모두 비어 있으며 세 저장 정의가 없을 때만 빈 안내를 표시한다. 로딩/실패/다른ID/늦은응답은 빈 화면으로 오인하지 않는다. 저장 analysis/structured/Pivot 정의가 있거나 잘못되면 보호된 분석 경로를 유지한다.

두 편집 링크의 제목을 URI 인코딩해 &, #, ? 같은 문자가 제목 매개변수를 자르지 않게 했다. 실제 `&` 제목으로 편집 입력과 저장·reload의 제목 유지 확인. 최초 실패는 삭제전용4, 수정 빈 화면은 별도5로 검증했다.

FE red2 FAIL/15 PASS 후 최종 **21 PASS**(기존12+실제 DashboardAnalysis를 쓰는9검사). malformed scope400·generic400 차단, missing/mismatchedID, route late response·링크 roundtrip 포함. 최종 scoped lint/type/build PASS. 단위 네트워크는 mock이며 실제 앱 검증과 구분한다. 기존 same-route 계정 변경의 모든 경합은 추가 수용 범위가 아니다.

## 발견2: 재사용한 일반 BI 위젯의 저장 SQL 호환성

빈5에 인계받은 위젯을 추가·저장하면 일반 GET200/widgets1인데 분석 API는400 `only SELECT from source is allowed`였다. 실제 저장 query는 `WITH source AS (SELECT * FROM uploaded_data) SELECT SUM("amount") AS value FROM source`. 레거시 변환이 CTE 내부 FROM까지 바꾸고 validator가 이를 거절했다.

서버가 생성하는 정확한 무조건 prefix만 제거해 내부 SELECT를 복원한다. structuredDefinition/Pivot 정의가 존재하면 새 복원 경로는 계속 거절한다. WHERE/투영/다른 테이블/다른CTE/주석이 있는 wrapper는 제거하지 않으며 최종 validateSourceSql과 기존 권한·preview 검사를 유지한다. 저장 SQL/metadata를 다시 쓰지 않고 기존 plain SELECT 정규화는 그대로다. 저장 조건을 버리는 raw SQL fallback은 추가하지 않았다.

회귀 red1 FAIL/17 PASS 후 관련3 suites **98 PASS**. 새18검사는 canonical→실제DuckDB350·기존plain3·위험/조건wrapper7·저장정의6·권한거절을 확인한다. helper의 owner/preview는mock이므로 전체 권한 통합으로 확대하지 않는다. 이후 실제 수정서버 새PID/restart200에서 dashboard5 분석200·안전한 SELECT FROM source·화면350·오류없음·제목보존을 확인했다. BE scoped lint/type/build PASS. 독립 정적 검토 CLEAR, 블로커0.

## 재검증·증빙

기존 전체 일반 BE5988/FE3438·core8·MySQL192를 반복하지 않았다. 이번 영향98/21은 기존 배치와 겹치므로 합산하지 않는다. 최초 저장 확인창 미처리·초점 이동과 route 전환 직후 snapshot의 자동조작 대기는 현재 화면을 다시 확인한 뒤 정상 UI로 진행했으며 제품 실패와 구분한다. 실제 발견한 두 제품 실패는 원인을 확인하고 red→green과 앱 재검증을 별도로 남겼다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/help-final-transfer-20261025/`의 fixture/proposal.json, before/accepted/after-transfer.json·transfer-assertions.json, access-after-transfer.json·final-preservation.json, empty-dashboard/verification.txt·red/green/type/lint/build, legacy-red/green.log·legacy-final.json·legacy-reuse-query.json·legacy-api-fixed.json와 UI 캡처. 비밀번호/토큰은 공개 기록에 포함하지 않았다.

## 도움말과 잔여

시나리오43에 계정 전환 뒤 **처음 의향번호→고정목록 검토→묶음 인계 상태 조회** 절차와 최종 묶음 번호의 구분을 추가했다.48에 빈화면 위젯추가→저장·수정 확인→재조회와 저장 조건 보존 원칙을 보완하고 실제 모바일2장을 추가했다.

다음 실제 UI는 단독 인계41/42, 조직 이동44/탈퇴45 등이다. 운영DB·실제모바일·VoiceOver·전체 제품 수용은 별도이며 도움말 배포와 제품서버 운영 배포를 구별한다. 기존 사용자 서버·다른 Colima프로필과 `.claude/settings.json`·`CLAUDE.md`의 다른 작업은 보존한다. 런타임 cleanup·문서 최종 배포 확인은 실행 증빙을 따른다.

최종 확인: 변경 코드/검사4파일은 실행 worktree와 byte 일치, BE/FE type·scoped lint·build PASS, 문서27HTML/1532참조/오류0·diff check PASS. 감독기 restart200·최종stop200 및 소유 컨테이너/임시 credential 제거·영속volume0 확인. 도움말만 운영 Pages에 배포하며 제품 서버 운영 배포와 구분한다.
