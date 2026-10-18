# UC052 Studio 공통 조건 연결

2026-10-18 · 기준bddd2ec5 · FR018/019/020·NFR005/006/008·TC050 E04/E05/E08. 전체16개 완료 목표를 유지한다. 소스 조건의 중첩 포함/제외를 기존 Studio 편집·미리보기·저장/reload·AI 내용 편집·게시·복제에 연결한다. AI의 조건 변경 제안/차이 UI와 분포/표본·운영/사람 수용은 별도다.

## 문서와 실행

StudioDocumentV1의 optional `conditions`는 `{sourceRevision:string,definition:ConditionDefinition}`다. sourceRevision은 기존 Studio의 관리형 불변 파일 경로 식별자 hash(64hex, 내용 checksum 아님)이며 소스 카탈로그의 metadata 포함 revision과 구분한다. 새 `setConditions` 연산의 null은 명시 제거다. 조건은 기본 자동 적용하지 않는다. 소스에서 읽은 조건을 현재 Studio의 파일 revision에 명시 적용하고 실제 schema에서 전체 검증한다. 원 소스 조건의 이후 저장은 적용 복사본을 바꾸지 않는다. 현재 파일이 달라지면 미리보기/저장/게시 전에409로 거절하며 자동 재바인딩하지 않는다.

공통 sourceQuery는 실제 schema로 검증한 조건을 기존 filters/dateRange와 AND로 적용하고 바인딩 순서를 유지한다. 숫자·차트·추세·비교·상세/입력 행·CSV가 같은 조건을 사용한다. 지표/블록 정의·SQL과 비대상 배치는 유지한다. 스키마 없는 저장/문서 projection은 구조만 검증하되 실행은 실제 타입 검증을 통과해야 한다. 손상 scope를 없는 조건으로 간주하지 않는다.

기존 Dataset.query 기반 소비자도 저장 조건을 빼고 조회하지 않게 한다. 현재 저장소가 bindings를 영속하지 않으므로 검증된 read-only query의 값만 안전한 고정 SQL literal로 인코딩해 저장하거나 동등한 영속 바인딩을 사용한다. 임의 SQL/미검증 문자열 보간을 하지 않고 질문표가 있는 인용 식별자/문자열·quote·Unicode·세미콜론 값의 실행과 저장 크기를 검사한다. 새 의존성은 추가하지 않는다.

## 게시와 재사용

공개 publication은 조건이 적용된 고정 집계와 조건 적용 여부만 전달하고 새 조건의 열/리터럴/SQL/원본은 추가 공개하지 않는다. private opt-in remix recipe는 전체 조건을 보존한다. 모든 조건 열은 모든 유지 블록의 필수 연결 필드다. 대상 실제 열/유형이 안 맞으면 전체 미리보기/저장을 막고 조건을 몰래 제거하지 않는다. 완전 매핑 후 recipient 파일 revision으로 조건 복사본을 고정하고 원본/원 조건은 보존한다. 기존 source/dashboard read/edit/publish/owner 경계를 유지한다.

## 화면

기존 Studio 필터/기간 옆 접힌 '포함·제외 조건'에서 저장 조건 읽기→트리 검토/편집→명시 적용한다. 읽기는 질문/초안/실행을 바꾸지 않는다. 적용/제거는 공통 reducer·undo/redo·전체 미리보기 무효화·저장/복구를 따른다. 현재 sourceRevision을 사용하며 stale response/source 전환을 무시한다. 기존 UI Kit36/32px·라벨/키보드·모바일 한 열/긴 열명 줄바꿈을 유지한다. 게시 화면은 적용됨만 알리고 원시 조건은 익명에게 반환하지 않는다.

## 검증

실제 DuckDB 독립 oracle로 조건+filters+날짜의 숫자/추세/비교/상세/CSV와 영속 Dataset query를 대조한다. 실제 SQLite Studio apply→preview→save→get/reload, 원본/ID/배치 보존·현재 권한/버전 거절·손상 scope, 게시 집계/리터럴 비공개·remix 열 누락 차단/완전 매핑 재조회·AI 내용 편집의 조건 불변을 검사한다. FE는 read 미적용·명시 apply/undo/redo·미리보기 무효화·저장·reimport·실패/late 응답과36/32 역할을 검사한다. 관련 회귀/type/lint/build·독립 검토·strict/pin/check/packet·비공개 검사 후 develop-v2 commit/push한다. Ego TaskSpace96은 사용자 제어 중이며 반환 전 실제 Ego/390·768·1440은 NOT_RUN이다. 기존 core는 새 UI 검증을 대신하지 않는다.

레거시 DashboardAnalysis·Publication/Reuse/recipe도 같은 조건을 전달/보존한다. 별도 데이터셋 소비자의 조건 누락과 일반 withDuckDBSnapshot의 미커밋 연결 캡처를 발견해 공통 literal 저장/확정 캡처 및 기존 fixture metadata context 검증을 포함했다. 외부에서 관리형 파일을 직접 덮어쓰는 변형은 불변 파일 계약 밖이며 이번 경로 hash 검증으로 탐지했다고 주장하지 않는다.
