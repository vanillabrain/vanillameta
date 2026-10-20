# UC050/052 업무 변수의 조건 실행 의미

2026-10-18 · 기준 cf94c0af · FR015/018/020·NFR005/006/008·TC050 E01/E04/E08/E14. 전체16개 완료 목표는 그대로 유지한다. 이 문서는 구현 계약과 종료 기준이다. 선택 실행 결과는 [증빙](../testing/business-condition-semantics.md)에 기록하며 최종 통합/전체 수용은 대기다.

## 해결 대상과 현재 범위

착수 시 업무 유형/날짜 형식은 카탈로그에 저장되지만 조건 실행은 native schema만 사용했다. 현재 선택 구현은 고정 semantic snapshot으로 VARCHAR 업무 날짜의 범위와 수치 업무 범주의 허용 연산을 직접/AI 조건에 연결한다. legacy 조건은 native로 유지하며 저장 metadata/명시 조건/기존 SQL을 구별한다. [선택 증빙](../testing/business-condition-semantics.md)의 Source49·MySQL2·FE802·Source UI1 등은 각각의 범위이며 합산하거나 전체 소비자/실LLM 수용으로 표시하지 않는다.

## 보존과 버전 계약

- 기존 semantics 없는 조건은 native 의미를 유지한다. 최신 카탈로그를 몰래 읽어 예전 저장 분석을 재해석하지 않는다. 기존 SQL·원본 파일을 바꾸지 않는다.
- 새 업무 의미는 검토한 조건 wrapper에 고정한다. 파일 sourceRevision, 조건 편집 metadata revision, SourceCatalog 버전은 서로 다르다. 선택한 카탈로그 버전과 정규화한 업무 선언을 실행 기준으로 보존한다.
- 실행 기준은 SQL/표현식을 받지 않고 허용된 열명·businessType·dateFormat만 담는다. 해당 소스의 append-only 카탈로그 이력과 실제 native schema를 서버가 대조한다. 손상/누락/위조/다른 소스 기준은 실패 처리하며 과거 정상 버전/auto로 자동 대체하지 않는다.
- 기존 소스 저장 조건의 의미도 함께 영속화한다. 최신 업무 정의 채택은 별도 명시 동작→조건/차이 검토→미리보기→저장이며, 정의 변경만으로 기존 조건을 덮지 않는다. 저장 실패/409/늦은 응답/새로고침에서 기존 조건·질문을 보존한다.

## 확정 필드와 채택

StudioConditions에 optional semantics를 추가한다. 형태는 `{schemaVersion:1,catalogVersion:양의정수,columns:[{column,businessType:'number'|'category'|'date',dateFormat:빈문자열|'native'|세고정형식}]}`이며 전체 non-auto 선언을 열명 순으로 정규화한다. nativeType/kind/SQL은 입력하지 않는다. 해당 부모 소스의 정확한 SourceCatalogEntry 이력을 실제 schema와 대조해 부분 누락/중복/위조를 거절한다. SourceConditionEntry.semanticsJSON의 NULL은 legacy native다. 기존 semantic 저장 요청에서 필드 생략을 native 전환으로 해석하지 않고 명시 거절한다. 전체 조건 제거는 별도 명시 동작이다.

기존 고정 기준의 실행은 최신 카탈로그 편집으로 바꾸지 않는다. 최신 채택/새 AI 제안은 준비한 최신 버전을 계산 후 재검사하고 변경이면409다. 기존 native 조건을 AI 편집할 때도 native 문맥을 유지한다. 소스 교체는 사용 열 선언의 호환성을 확인한 대상 카탈로그의 새 snapshot을 만든다. 원본의 버전을 그대로 복사하거나 원본 접근권에 계속 의존하지 않는다. AST32KiB/영속 요청48KiB 등 기존 합산 한도는 유지하고 넘으면 명시 거절한다. 별도 코드 검토는 이 설계의 착수를 승인했으며 실행/전체 수용 승인은 아니다.

## 공통 계산

native auto/number는 기존 정밀 숫자/NULL/타임스탬프 계약을 유지한다. 업무 category는 원본 scalar 값의 동등/목록/NULL 선택을 쓰며 수치·날짜 범위나 문자열 contains를 암묵 제공하지 않는다. 숫자 범주 값을 문자열/DOUBLE로 바꾸지 않는다.

VARCHAR 업무 date는 저장한 세 고정 형식(YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD)을 서버가 허용한 날짜 표현식으로 변환한다. 사용자 조건 값은 ISO 날짜를 사용한다. NULL과 빈 문자열·잘못된 날짜를 구별하며 잘못된 값을 NULL로 바꾸어 조용히 제외하지 않는다. 전체 데이터 형식 검증·같은 immutable 파일에서의 미리보기와 독립 DuckDB 정답을 확인한다. 원본 날짜 문자열을 수정하지 않는다.

직접 editor의 kind/허용 연산자/값 검증과 Studio AI conditionColumns를 같은 의미 helper에서 만든다. AI는 definition만 제안하고 실행 wrapper/카탈로그/파일 기준은 서버가 붙인다. 기존 조건을 편집할 때는 고정된 의미를 사용한다. 다른 의미가 필요하면 명시 채택·재검토로 연결하며 임의 변환/근사값을 생성하지 않는다.

## 전달 경계

공통 sourceQuery/compiler와 Source/Studio 분포·표본, Explore/일반·고급 Pivot·CSV/영속 작업·보기 복구, 저장/게시/공유·복제 경로에서 wrapper의 의미를 보존한다. 실제 실행 전에 native schema·권한/파일을 검증하고 계산 후 새 기준 검사를 유지한다. 소스 교체 시 대상의 대응 업무 정의와 열을 명시 대조한다. 호환되지 않으면 원본/초안/선택을 보존하고 부족한 정의를 안내하며 의미를 삭제하거나 native로 자동 전환하지 않는다.

## 구현 분담과 종료 조건

1. 공통 semantic snapshot/업무 schema helper·조건 compiler·wrapper validator와 정밀도/날짜 회귀.
2. SourceCatalog 이력 resolver·SourceConditionEntry 영속 의미/마이그레이션·명시 채택/미리보기/저장 계약.
3. sourceQuery/Studio 직접·AI/분포·복제/Explore/출력 소비자 연결. 저장 보기의 의미 재검증과 과거 완료 파일 보존.
4. FE 공통 Tree/Studio/Source·업무 버전 안내·명시 채택·날짜 입력·실패/초안 보존과36/32px·14px·390/768/1440 검증.
5. 실제 DuckDB 독립 정답·JWT/현재 권한/카탈로그·파일 경합·저장/reload·AI fixture/실LLM 구분·실제 격리 headless UI/가능한 MySQL·별도 검토·types/lint/build·AIWF strict/pin/check/packet 후 commit/push.

이 단위가 조건 실행을 연결해도 조직 공통 분류 사전 재사용과 새 지표/차원 생성의 전체 업무 의미 적용은 별도 FR015 잔여로 추적한다. 둘을 생략하거나 FR015 전체 완료로 재정의하지 않는다. 사용자 제어 Ego96/실휴대폰/운영 및 전체16개/TC050 수용은 별도다. 착수 전 별도 설계 검토로 snapshot 필드·역사적 카탈로그 검증·소스 교체 계약을 확정했다. 단일 조건 질문의 실제 Codex E2E1개는14.5초 PASS다. BE26 suites/884 unique는 단계별 검증 완료이고 Jason·Bernoulli 범위 검토는 APPROVE/0 findings다. 안정 BE type/lint/build PASS, 최종 dist ui-stable1 PASS/11.9초이며 core-stable14 PASS/38.3초다.

## Source 분석 편집 문맥 보완

Source read의 선택적 analysisConditions는 캡처 native schema와 제공된 wrapper의 정확한 파일/이력만 검증한다. 무관한 저장 SourceEntry의 정의/semantics/history는 해석하지 않으며 version은 정보용이다. 의미 생략은 제공된 분석의 native이고 SourceEntry의 semantic 기준을 상속하지 않는다. 명시 최신 채택에서도 제공된 정의를 유지해 재검토/새 preview로 이어가며 Source 쓰기는 없다. malformed wrapper·현재 권한/파일 불일치는 실패한다.

실 Codex 시도 중 ui-real의 초기 AI 열기 테스트 경합 취소와 ui-real-final의 복합 부정 문장 unsupported publish·모델 호출 전 쓰기0 확인 후 취소는 미완료다. 복합 부정 의도 판별 제한은 열린 이슈이며 모든 자연어 지원으로 확장하지 않는다. 단일 조건 제안 질문의 ui-codex는 실제1 PASS/14.5초로 SourceEntry V2와 별개인 catalog V3 검토200→명시 적용/저장/reload V3·preview200, 모바일390 overflow0을 확인했다. Source390·실제 Codex 저장 Studio390 스크린샷은 Main이 넘침 없음을 열람 확인했다. [증빙](../testing/business-condition-semantics.md)에 실패/취소 이력을 유지한다.

후속 선택 실행은 Explore semantic oracle8 PASS/22 SKIP와 core headless14 PASS/49.4초다. 배치를 합산하지 않는다. BE26-suite 최초24 PASS/2 FAIL(864 PASS/20 FAIL)은 보존한다. 두 stale fixture suite를 전체 재실행해 legacy18/resource6 PASS로 교체한26 suites/884 unique의 단계별 범위이며864+24를 더하지 않는다. Remix/legacy 비활성 계정 read guard는 수정했고 Jason·Bernoulli APPROVE/0 findings다. 안정 BE type/lint/build 및 ui-stable1 PASS/11.9초를 확인했다. 같은 시나리오의 이전 ui-codex와 합산하지 않으며 core-stable14 PASS/38.3초다.
