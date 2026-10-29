# 고정 보고서의 목록·열람·지정 공유

2026-10-29. U1 `dd3a7b16` 이후 단위다. [기존 저장 검증](../testing/private-sales-report.md)을 재사용한다. 모바일과 제품 AI 호출은 제외하며 gpt-6-luna 설정과 VoiceOver BLOCKED를 유지한다.

## 작업 순서

1. `how` over the affected subsystem. 완료. 기존 보고서 get/list는 현재 보고서·Studio·소스 소유자만 허용한다. 수신자는 별도 현재 관계 검증과 고정 결과 투영이 필요하다.
2. `architect` for parallel design exploration. 완료. 보고서 전용 공유를 선택했다. 공통 자원 grant 확장 후보의 정리/가시성 원칙을 반영하고 현재 epoch·고정 head·별도 수신자 투영을 보강했다.
3. Write the throughput checkpoint as four todo items.
   - Blocking first steps. 검증된 U1 29파일을 먼저 선별 커밋·push했다. 사용자 설정·다른 설계 파일은 보존한다.
   - Independent workstreams. 구현 담당은 API·화면 계약을 함께 소유한다. 부모는 MD·격리 MySQL·브라우저·독립 정답/권한 검증을 맡는다.
   - Shared mutable state. 설계 후보는 별도 파일만 쓴다. 제품 공유 관계는 실제 공통 객체이므로 현재 actor와 관계 CAS를 같은 transaction에서 확인한다. 다른 작업과 포트·runtime 포인터를 분리한다.
   - Smallest safe decomposition. 허브 항목·읽기 응답·공유 관계는 한 계약이므로 구현 담당 하나가 변경한다. 운영 환경·기존 조직 공유 모델·AI·모바일로 확장하지 않는다.
4. Delegate code-writing to a subagent. 완료. 단일 계약 구현 뒤 새 담당의 한정 UI 수정과 부모의 실제 재현 수정을 통합했다. 두 독립 리뷰의 epoch·action 403·초점 지적을 보완했다.
5. Verify on the matching surface. 완료 범위와 미검증 조합은 RSH 표를 따른다. 실제 MySQL API·Ego95 데스크톱·대상 테스트/빌드와 캡처를 남겼다.
6. Rebase into small, ordered commits. U1은 `dd3a7b16`으로 push했다. 이번 신규 공유 단위는 별도 커밋으로 반영한다.
7. If the design is contested, `interrogate` before shipping. 완료. 후보 교차 검토 후 계약을 확정했다. 독립 리뷰는 AGENTS 역할에 따른 GPT 모델로 수행했으며 다른 공급자 검토로 주장하지 않는다.
8. Run **Opening a PR**. skip. 사용자는 develop 직접 작업을 지정했으며 PR 생성은 요청하지 않았다.

## 공유 계약

조직 내 지정 수신자에게 저장한 보고서 버전을 읽기 전용으로 전달한다. 소유자 편집은 공유 버전을 자동 변경하지 않는다. 최신 저장본 전달은 별도 명시 동작이다. 익명 링크·편집·복제·원본 데이터 grant는 만들지 않는다.

수신자와 소유자의 현재 활성 계정·조직·로그인 epoch를 확인한다. 원본 Studio와 소스의 활성/소유 신원이 달라지면 제목과 본문을 모두 숨긴다. 고정 집계를 읽을 때 원본 SQL을 실행하지 않는다. 수신자에게는 본문·정제 집계·기간·시간대·버전·포착 시각만 투영하며 원본 경로·전체 schema·비공개 정의·Studio 이동 링크를 반환하지 않는다.

공유와 회수는 요청 UUID와 관계 CAS로 보호한다. 과거 성공 영수증은 현재 활성 공유가 아니다. 정확한 replay가 회수된 관계를 되살리면 안 된다. 수신자 화면은 focus/visibility 재조회 전에 표시 데이터를 숨긴다. 서버 거절과 계정 변경·지연 응답 뒤에도 예전 내용을 표시하지 않는다.

## 인수 조건

[지정 공유 검증](../testing/report-recipient-sharing.md)의 RSH-01~08을 따른다. 기존 RPT-01~09 전체를 반복하지 않고 권한·저장 projection의 변경 영향만 선택 확인한다.

## 구현 경로

허브는 `/dashboard`, 보고서 읽기는 `/reports/:reportId/read`, 소유자 편집은 기존 `/reports/:reportId`다. 기존 private 소유자 API는 보존하고 `/reports/library`, `/reader`, `/peers`, `/shares`, `/shares/outcome/:requestId`를 별도 경계로 추가했다. 전달 관계와 UUID 영수증은 전용 두 표를 사용한다. 수신자 응답은 generic category/value와 표시 정보만 포함하고 비공개 정의를 보내지 않는다.

공유는 현재 읽은 최신 저장 버전에만 동의할 수 있다. 재조회·tab 복귀·오류는 자동 재전송하지 않는다. 미확정 요청은 계정/조직/보고서별 탭 티켓에 보존하고 영수증 뒤 현재 조회까지 성공해야 해제한다. 숨김 상태의 같은 세션 DOM 보존은 일반 제어기 안정성을 위한 것이며 보호 경계는 즉시 숨기고 권한 실패 때 제거한다.

## 적용한 원칙

- Model the Domain. 원본 자원 grant와 고정 보고서 전달 관계를 분리했다.
- Boundary Discipline / Type System Discipline. 외부 명령·epoch·수신자 응답을 엄격하게 검증하고 비공개 저장 모델을 그대로 보내지 않는다.
- Make Operations Idempotent. 정확 UUID·입력·CAS와 과거 영수증을 현재 공유 상태와 구별했다.
- Separate Before Serializing Shared State. 포트·runtime·합성 계정을 격리하고 제품이 공유하는 관계만 잠금과 CAS로 조정했다.
- Sequence Verifiable Units. 검증된 U1을 먼저 push하고 새 공유 단위는 별도로 남겼다.
- Fix Root Causes. remount·안내 위치 이동·disabled focus·목록용 grid 배치의 각각의 원인을 수정했다.
- Prove It Works. 단위 결과와 실제 MySQL·Ego 화면·캡처를 구분해 기록했다.
