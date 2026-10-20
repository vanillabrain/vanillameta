# UC051 인계 전 연결 자료·보관 조건 검토

Status: Draft

## 목표와 경계

FR016/FR017/NFR005/NFR007·UC051 A5/BR-051-06·TC050 E02/E03을 지원한다. [의향 수락](UC-051-handover-proposal.md) 뒤 소유자가 선택 대시보드에 연결된 소스의 선택 누락과 소스별 보관 검토 필요를 확인한다. 이번 범위는 선택 자료에서 바깥으로 향하는 저장 연결의 읽기 검토다. 전역 역방향 사용처·지표 계산식의 임의 SQL 의존성·파일 실체/공유 경로·외부 계정 이전 가능성을 확인한 것으로 해석하지 않는다. 실제 소유권 이전·자료 복사·grant·파일 이동·퇴사 확정은 구현하지 않는다. 수신자는 제목·번호 공개에만 동의했으므로 새 의존성 정보는 소유자에게만 표시한다.

## 고정 HTTP 계약

`GET /enterprise/handover/:id/dependencies`는 현재 활성·같은 조직의 소유자만 호출한다. 수신자·일반 admin·다른 조직은403, 유효한 미존재 요청404, 오래된 로그인401이다. 수락 상태·공개 가능·양쪽 발급 epoch·조직 버전·선택 자료 소유/활성/제목/metadata fingerprint가 현재와 일치해야 한다. 변경·철회·만료·미수락이면409이며 오래된 의향으로 새 자료를 검토하지 않는다. 읽기 snapshot 이후 현재 신원/조직/양쪽 상태/요청 기준을 재검사한다. 조회는 DB/감사/파일 쓰기0이며 실행 가능한 ticket을 발급하지 않는다.

응답은 정확히 requestId/organizationId/ownerId/recipientId/proposalVersion/checkedAt/scope(`selected_dependencies_v1`)/executionAvailable(false)/assets다. assets는 기존 선택 순서의 kind/id/title/dependencyStatus(`covered|missing|unresolved`)/requiredSources/selectedSources/missingOwnedSources/otherSources/metricCount/storage(`not_applicable|file_review_required|connection_review_required|unresolved`)만 포함한다. 숫자는 중복 제거한 소스 건수이며 지표 건수와 합산하지 않는다. 미선택 소스 ID·이름·열·SQL·경로·설정·hash·링크·다른 직원 정보는 반환하지 않는다.

대시보드는 analysisDefinition.databaseId, structuredDefinition.sourceId, pivotDefinitions의 각 sourceId, StudioState.document.document.sourceId와 기존 widget→dataset/table→databaseId 연결을 검사한다. 비어 있는 대시보드는0개 연결로 표시한다. 형식 오류·누락 참조·지원하지 않는 widget 유형은 unresolved로 숨기지 않는다. 연결 소스가 없거나 비활성이면 unresolved, 타인/legacy 소유면 otherSources로 구별하고 covered로 표시하지 않는다. 소유자 활성 소스인데 선택되지 않은 경우 missingOwnedSources로 표시해 후보에 소스를 추가한 새 의향 요청을 검토하도록 안내한다. 자동 추가·기존 요청 수정·재수락은 없다. 명시 연결만 다루며 임의 계산식의 완전한 의존성을 증명하지 않는다.

source의 metricCount는 해당 소스 지표 전체(비활성 포함) 건수이며 별도 소유 이전 대상이 아니다. 파일 계열 DuckDB/SQLite는 file_review_required, 외부 DB는 connection_review_required다. 엔진 미확인은 unresolved다. 파일 bytes나 경로를 읽지 않으며 존재·배타적 소유·이관 가능 판정은 하지 않는다. 따라서 모든 응답의 executionAvailable은 false다.

## 구현·복구·화면

BE는 기존 의향 서비스의 읽기 권한·snapshot·fingerprint를 재사용하며 검토 전용 helper로 연결을 수집한다. 기존 쓰기 잠금·create/accept/cancel의 계약은 유지한다. schema 변경은 없다. FE는 요청을 읽은 소유자에게만 ‘연결 자료·보관 조건 확인’을 제공한다. 결과는 접힌 추가 검토로 표시하며 부족점/다음 조치를 일반 용어로 설명한다. 이전 결과는 요청/조직 변경·접기·재조회 시작·실패 시 제거하고 늦은 응답은 버린다. 재시도는 명시 조회만 하며 요청 번호와 기존 선택/질문을 바꾸지 않는다. 기본36px/도구32px·390/768/1440 입력16/16/14px와 넘침·정렬을 확인한다.

## 검증과 종료

보호 HTTP에서 소유자/수신자/admin/다른 조직/epoch·미수락/만료/철회·수락 후 자료 변경409, 모든 저장 표현 연결·중복 제거·누락/타인/형식 오류·지표 건수·비밀 비노출·조회 전후 불변을 SQLite와 로컬 Docker MySQL로 검증한다. FE scope/늦은 응답·실패 후 재시도와 Ego 실제 소유자 조회→부족점→실패/재시도→reload 및 모바일 정렬을 확인한다. 독립 검토·type/lint/build 후 현재 브랜치에 commit/push한다. 운영·실휴대폰·실제 이전/탈퇴·전체16개/TC050 사람 수용은 Open이다.
