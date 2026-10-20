# UC-012 설계 대조·검토 — 2026-10-15

기준 develop-v2 / 0f772da4. 동일 에이전트가 작성 후 별도 대조 패스로 검토했다. 독립 리뷰·고객 승인은 미기록이다. 이번 전달물은 AIWF 설계이며 제품 구현/DB migration/UI 검증이 아니다.

## 소스 대조

- BiService.createMetric의 random 내부 이름과 별도 save는 현재 계산 중복/원자 저장의 증거가 아니다. 계획은 deterministic 이름+기존 unique를 사용하고 영수증에 actor/request DB unique를 추가한다.
- AiDashboardService.save의 sharedManager 인자와 UC004 호출을 확인했다. 새 저장 엔진·중첩 독립 transaction을 설계하지 않고 같은 manager를 전달한다.
- metric-analysis-links가 인식하는 structured-bi-dashboard v2/items를 확인했다. 새 snapshot kind를 도입하면 지표 일괄 변경이 연결을 잃는 문제를 발견해 기존 kind를 재사용하도록 설계에 반영했다.
- withDuckDBSnapshot은 AsyncLocalStorage로 원본 파일을 고정하고 재진입한다. 그 안의 duckDBVersion은 최신 포인터 조회가 아니다. 저장 시 공유 manager의 현재 Database 포인터/token 대조와 원본 교체 interleaving 테스트를 계획에 추가했다. 구현 및 테스트는 아직 없다.
- 성공한 영수증의 재시도를 현재 소스/지표 stale 검사보다 먼저 처리하도록 설계를 보완했다. 저장 성공 후 원본이 바뀌어도 같은 key/digest는 기존 결과를 찾아야 한다.
- Rill 공식 openrtb의 source/model/metrics/explore YAML·SQL에서 책임 분리와 요청 수/평균 계산을 확인했다. VM 검증용 fixture의 SQL도 같은 SUM/RATIO_SUM이다. 새로운 Rill UI 검증/LLM 실행을 하지 않았다.

## 범위와 잔여 조건

원본 열 차원 snapshot과 독립 차원 카탈로그는 다르다. 첫 범위는 전자이며 독립 차원 편집/파생식은 미구현으로 유지한다. 기존 Source/Measure/Dimension 목표를 바꾸지 않는다. 새 원본 연결·외부 엔진·게시/공유는 추가하지 않는다.

A(제안/컴파일), B(원자 저장/영수증/링크), C(기존 UI 연결)를 구분했다. A만 개발한 상태를 전체 고객 기능 완료로 표시하지 않는다. 실제 SQLite transaction/동시성·원본 교체·실LLM·UI·운영 DB 검증은 TC-012에 모두 NOT_RUN이다. 브라우저 auto-review 거절을 대체 UI 경로로 우회하지 않는다.

## 이번 실행 검사

- 관련 현재 코드·Rill fixture 정적 대조 완료. 운영 코드·DB·서버 설정 변경0.
- 새 문서 링크/기존 목표·용어·엔티티/UC·TC·diagram ID 대조.
- 엄격 문서 lint는 기존 UC007~010 형식 오류12개 때문에 FAIL 유지. UC012/TC012 새 진단은 없다. baseline을 만들지 않는다.
- spec pin/check는 설계 변경 감지이며 품질/승인이 아니다. 리뷰 패킷은 awaiting_review / acceptance not_recorded.
- 운영 코드 불변이므로 unit/type/build·실제 API/UI를 이번 설계에서 반복하지 않는다. 과거 통과를 UC012 구현 통과로 재사용하지 않는다.

[구현 계획](../plans/UC-012.md)의 다음 단계는 A의 쓰기 없는 제안 validator/compiler와 기존 구조화 계산기의 재사용이다.

## 후속 B 구현 대조

594b39ff 이후 [B 실행 기록](../testing/semantic-creation-save.md)에 API·SQLite 검증을 추가했다. 위 설계 시점의 NOT_RUN을 과거 이력으로 유지하며 현재 A/B 구현·부분 검증과 C/운영 DB 미검증을 구분한다. 독립 리뷰·수용은 여전히 미기록이다.
