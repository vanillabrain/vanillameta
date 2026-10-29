# U1 고정 비공개 매출 보고서

2026-10-29. 사용자가 허브 커밋·push 후 구현을 승인했다. [시나리오 대조](../testing/artifact-implementation-audit-20261029.md)의 U1 인수 조건을 따른다. 후속 구조 검토에서 Studio TEXT 확장 대신 별도 보고서 저장 모델을 선택했다. 계산 블록·AI·게시·복제 계약 전체를 바꾸지 않고 고정 결과와 본문을 함께 보존하기 위한 선택이다.

## 작업 순서

1. `how` over the affected subsystem. 완료. Studio 조회는 재집계하며 독립 본문과 고정 비공개 저장은 없다.
2. `architect` for parallel design exploration. 완료. 두 설계와 독립 검토가 별도 보고서 aggregate를 선택했다.
3. Write the throughput checkpoint as four todo items.
   - Blocking first steps. 허브 오류 재현·수정·검증 후 선별 커밋·push. 완료 후 보고서 구현 시작.
   - Independent workstreams. 한 구현 담당자가 API·화면 계약을 소유한다. 부모는 격리 런타임·검증 fixture·MD·브라우저 검증을 담당한다.
   - Shared mutable state. 같은 develop에서 파일 소유 범위를 분리한다. 보고서 저장은 User→Dashboard→Source→Metric→Report 순서의 현재 권한·버전 검사와 원자 revision/receipt로 보호한다.
   - Smallest safe decomposition. 본문·KPI 하나·차트 하나·목록·재열기는 하나의 계약이므로 구현 소유자를 나누지 않는다. AI 본문·공유·모바일·범용 블록 편집은 후속이다.
4. Delegate code-writing to a subagent. 완료. 구현 담당1명과 관측된 초기 권한 오류 후속 담당1명을 순서대로 사용했다.
5. Verify on the matching surface. 완료 범위는 검증 MD에 기록했다. 실제 API/MySQL·Ego 데스크톱의 핵심 저장·고정·재열기를 확인했고 운영·모바일·모든 경합까지 확대하지 않는다.
6. Rebase into small, ordered commits. 허브19파일을 `f65fe50b`로 develop에 drumcap push했다. 보고서 구현·검증 기록은 별도 미커밋 변경으로 남긴다.
7. If the design is contested, `interrogate` before shipping. 두 후보와 독립 검토에서 별도 모델에 합의했다. 새 이견이 생기면 다시 검토한다.
8. Run Opening a PR. skip. 사용자는 develop 직접 커밋·push를 지정했다. PR은 요청하지 않았다.

## 데이터와 상태

Report는 고정 owner/org/rootDashboard/source와 currentRevision을 가진다. Revision은 본문·제목·정제 집계·완전한 계산 기준·포착 시각을 불변 저장한다. Request는 actor/org/UUID별 저장 결과를 같은 transaction에 기록한다. Chunk는 2MiB 이하 UTF-8 payload를 8,000 Unicode code point 이하 TEXT로 나누며 순서·개수·bytes·hash를 확인한다. 본문은 64KiB 이하 plain text다. 소유자 retained payload는 20MiB까지다. 자동 삭제는 없다.

`capture`는 저장 Studio revision·KPI/차트 ID·미리보기 digest를 받는다. 서버가 현재 권한으로 계산하고 검토한 기준과 같을 때만 저장한다. 클라이언트 결과·SQL·원본 행은 받지 않는다. `retain`은 같은 보고서의 현재 revision에서 신뢰된 집계·기준을 복사해 제목·본문만 바꾼다. 결과 변경은 명시 미리보기와 새 revision이 필요하다.

GET/list/outcome은 현재 계정·조직·유일 소유권·root/source 활성/접근을 재검사한다. 과거 숫자는 과거 파일/지표 버전의 근거이며 현재 데이터로 재계산하지 않는다. 새 로그인은 현재 권한이 있으면 읽는다. 삭제/회수된 root/source는 보고서 접근을 차단하되 저장 revision을 삭제하지 않는다. Root/source FK cascade나 새 grant는 만들지 않는다.

저장 전 file pin 아래 집계하고 commit까지 보존한다. 최종 잠금 뒤 epoch/org·root revision·현재 파일/지표 정의·report CAS를 다시 검사한다. MySQL은 기존 READ COMMITTED 패턴, SQLite는 공통 metadata 조정을 사용한다. UUID exact replay는 같은 revision을 반환하고 head를 되돌리지 않는다. 다른 입력은409다. 미확정 입력은 제한된 탭 저장소에 보존하며 reload는 결과 확인만 하고 자동 저장하지 않는다.

## 화면 범위

저장 Studio의 마지막 저장본에서 보고서 작성을 시작한다. `/reports` 목록, `/reports/new?dashboardId=...` 작성, `/reports/:id` 고정 보고서 조회·본문 수정이다. 제목·본문·KPI·차트·기준을 보여준다. 계산 미리보기와 비공개 저장을 구분한다. 기존 shadcn 토큰·아이콘·버튼 높이·정렬을 사용한다. 허브 복귀 문맥을 유지한다. 공유·게시 UI는 만들지 않는다.

gpt-6-luna 설정과 VoiceOver 차단 상태를 유지한다. U1은 AI 호출을 요구하지 않는다. 모바일·운영 배포는 범위 밖이다.

## 검증

[검증 MD](../testing/private-sales-report.md)에 결과와 증빙을 기록한다. 기존 PASS를 재실행하지 않는다. 공통 sanitizer를 추출할 때에만 그 소비자 영향 조건을 선택 실행한다. 실제 API 재시작·source refresh·현재 권한 거절·숫자 대조·Tab 조작을 완료와 구분한다.
