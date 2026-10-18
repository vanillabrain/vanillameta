# UC051 소스·지표·갱신 인증 경계

2026-10-18 · develop-v2 · 기준 ffe0bfa0 · [설계](../plans/UC-051-metadata-boundaries.md). FR014/017·NFR005/008·TC050 E01/E02/E03 후속이다. 전체16개 요건과 TC050 수용은 미완료다.

## 구현·재현

실제 메모리 SQLite에서 공통 큐의 transaction을 유지한 채 일반 DatabaseService.create와 MetricService.create를 실행했다. 종전에는 두 요청이 SUCCESS를 반환했지만 앞선 rollback 후 소스0/지표0이었다. 기대한 early0/source1/metric1 대신 early1/0/0으로 실패한 로그를 Git 제외 `.aiwf/evidence/UC051-metadata-boundaries/catalog-red.log`에 남겼다. 수정 뒤에는 두 쓰기가 기다린 다음 독립 저장한다.

소스 생성·파일 등록 metadata save·암호화 config CAS·수정/삭제 metadata 구간과 기본 행 조회를 기존 공통 큐에 연결했다. import/digest/manifest·파일 조회/삭제·연결 종료는 구간 밖에서 실행한다. 기존5버전/CAS/충돌·등록 실패 cleanup과 등록 성공 후 manifest 실패 보존을 유지한다. 기존 source remove의 여러 삭제는 하나의 transaction으로 바꾸지 않았다. 따라서 삭제 일부 실패까지 원자 rollback한다고 보장하지 않는다.

지표 create/update/remove의 읽기·변경을 같은 범위로 묶고 목록/단일·평가용 정의를 확정 상태로 읽는다. 구조화 definition 변경 금지와 soft delete/revive·타입/필터 검증은 유지한다. 미커밋 expression 변경을 lookup/evaluate가 사용하지 않고 rollback 뒤 amount로 평가하는 실제 SQLite 회귀를 확인했다. evaluate의 데이터 SQL은 lease를 놓은 뒤 실행하며 긴 SQL을 gate로 보류해도 다른 metadata 작업이 진행한다.

갱신 인증은 JWT/actor 형식 확인 후 User/RefreshToken을 같은 범위에서 읽도록 연결한다. 기존 active/authVersion/jwtId·저장 token 일치·401 응답을 유지한다. 세션 갱신 쓰기·계정 변경의 여러 statement 원자성은 후속이다.

새 schema/API/UI/의존성은 없다. fake Repository에 실제 계약의 manager.connection/options를 보완하되 기존 기대값을 완화하지 않는다.

## 실행 상태

제품 변경 전 catalog 실제 회귀1개 실패/SQL 경계 회귀1개 통과를 확인했다. 변경 후 실제 catalog3개, 기존 소스·파일/지표 선택51개 및 연결/비밀 응답29개를 검증했다. Refresh 실제 SQLite4개 중2개가 수정 전 early1로 실패했고 수정 후 전체 auth7 suites/92 tests PASS다. 계정/저장 session 임시 변경 rollback 뒤 원래 토큰 승인·서명 오류의 즉시401·확정 session 회수401을 포함한다.

- 최종 전체 BE143 suites/2372 tests PASS(86.021초).
- BE type/build PASS·변경 전체 lint 오류/경고0. 기존 frontend 제품 소스는 미변경이다.
- 격리 합성 DB의 core Chromium8개 PASS(21.8초). 새 기업 UI/실LLM 검증은 아니다.
- AIWF strict 오류0/기존 FR011·NFR002 상태 드리프트 경고2개로 exit1이다. pin/check/packet은 로컬 검토 증빙이며 승인/수용이 아니다.

## 독립 검토·추가 회귀

Native code-reviewer APPROVE(critical/high/medium0)이며 범위 내7파일/84개를 별도 실행했다. source update not-found/제거 응답의 closure 복귀·CAS/cleanup·worker 구간 분리와 인접 refresh diff를 확인했다. 검토 후 제품 코드 변경 없이 실제 두 restore 요청의 CAS 경쟁1개를 추가했다. 최종 파일 수명주기16개·추가 lint PASS: 성공1/ConflictException1, 원래 파일 합계10·두 보관 파일 모두 유지다. 전체2372개 실행은 이 마지막 테스트 추가 전이며 최종 파일16개를 별도 확인했다.

## 잔여

AuthService 세션 회전/로그아웃·User/Login·비동기 샘플 provisioning·dataset/widget/template/구형 공유 token 쓰기와 ConnectionService/BI의 다른 일반 조회는 여전히 후속이다. 이 결과를 모든 SQLite 쓰기/권한/재시작 복구 완료로 확대하지 않는다. 앞 단위 Studio get/prepare가 집계까지 점유하는 granularity 개선도 남아 있다.

실제 Ego/390·768·1440은 기존 사용자 제어권 반환 전 BLOCKED이며 다른 브라우저로 우회하지 않는다. 이 단위 제품 UI는 미변경이다. MySQL 경합·실휴대폰·운영·사람 수용/추가 요건 전체는 NOT_RUN이다. 기존 core 회귀는 새 기업 UI 디자인이나 실제 LLM/전체 TC050 수용 증거가 아니다.

세부 조회 후속에는 findData의 dataset/table_query와 findTypeList 및 ConnectionService의 source config 읽기를 포함한다. evaluate가 지표 정의를 확정해도 별도 config 조회까지 고정된 실행 snapshot을 보장하지 않는다. 큐를 SQL까지 넓히기보다 확정 config를 pin하는 기존 snapshot 경계로 연결한다.
