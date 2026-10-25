# 도움말 미검증 조건 후속 — 2026-10-25

기준 `develop/1c934e16`와 이번 테스트·문서 diff. [앞선 검증](help-release-20261025.md)의 MySQL opt-in188항목과 도움말31/32 관리자 상태 관리가 대상이다. 일반 BE5988/FE3438·core8을 재실행하지 않았다. gpt-6-luna 설정과 VoiceOver 차단 상태를 유지했으며 이번에는 AI를 호출하지 않았다.

## 관리자 실제 화면: 시나리오31/32

전용 dev MySQL8.4.11/native DuckDB·API4263/Web3263/Control4463·Node26.12.1, Ego66을 사용했다. 신규 합성 계정/CSV만 준비하고 조직 생성과 상태 변경은 실제 UI로 실행했다. 같은 계정의 source2 `daily-check`와 기본 샘플 dashboard1을 사용했다. source2는 dashboard1과 연결되지 않은 독립 자료다.

| 조건 | 결과 |
|---|---|
| 소스 현재 상태→명시 비활성·동의·저장 | 활성v0→비활성v1, profile200→403 |
| 소스 활성·동의·키보드 저장·reload | 활성v2, profile200, 새로고침 후 상태 재조회 |
| 대시보드 현재 상태·8종 영향 읽기→명시 비활성 | 활성v0→비활성v1, dashboard200→403 |
| 대시보드 활성·동의·키보드 저장·reload | 활성v2, dashboard200, 과거 영수증과 현재 상태 별도 조회 |
| 저장 정의 보존 | 대시보드 title/analysisDefinition/structuredDefinition/pivotDefinitions/layout의 묶음 해시 불변 |
| 소스 연결 보존 | 암호화 connectionConfig 원문 해시 불변. 파일 bytes 해시 검증으로 확대하지 않음 |
| 화면 폭 | 390/768/1440px 문서 가로 넘침0. 최종390px 상태·건수·버튼 캡처 직접 확인 |
| 키보드 | 상태 선택·Space 동의→Tab 저장 버튼→Enter. 전체 페이지/VoiceOver 검증은 아님 |

상태 조회/변경은 모두 현재 소유 admin 계정이다. 직원·그룹·게시·진행 중 SQL의 모든 조합을 이 UI 결과에 포함하지 않는다. 최초 기다린 완료 문구가 실제 ‘과거 상태 변경 영수증’과 달라 타임아웃한 자동조작은 실패 기록으로 보존했다. 재요청 저장을 하지 않고 관찰/일반API200·403와 현재 상태를 확인했다. 소스 연결 정보는 암호화돼 JSON으로 읽을 수 없으므로 해독하지 않고 원문 해시만 사용했다.

## MySQL 선택 검증과 발견한 fixture 문제

각 테스트는 새 소유 MySQL8.4.11에서 명시 gate·owner·서버UUID를 확인한다. 메인 UI runtime과 별도다. 초기188항목:166 PASS,4 FAIL,17 실행 설정 차단,1 비활성 환경 안내용 sentinel. 기존 통과를 합산하지 않고 최종 개별 결과로 승계한다.

- 출력 만료: DATETIME(0)가 밀리초를 반올림하므로 저장 전 JS deadline+50ms가 실제 만료보다 이를 수 있었다. 정확한 소유 MySQL 임시 테이블에서 .250/.750 반올림을 확인했다. fixture에서 저장된 expiresAt을 읽고 그 이후까지 기다리도록 수정했다. 실제 시계·생산TTL·lease/expiry CAS·parts0/ready감사0/failed감사1 단언은 유지한다.
- 대시보드 권한 경합2조건: 현재 양쪽 writer가 User→Dashboard 순서로 잠그므로 Dashboard 대기만 찾던 관측이 실패했다. 해당2조건만 실제 InnoDB User 대기를 확인하도록 변경하고 다른 Dashboard 대기 검사는 그대로다. 권한·상태 결과 단언을 완화하지 않는다.
- 과거 계정 중복 진단: fixture가 오래된 UQ 이름만 제거해 현재 IDX 고유 인덱스가 남았다. 테스트 소유DB에서 userId/email의 실제 단일열 unique index를 제거하고 없음도 확인한 뒤 과거 중복 입력을 재현한다. 제품 unique/FK는 변경하지 않는다.
- legacy 분리17조건: 소유 runtime의 포인터 연결을 조정한 뒤 같은 guard/identity로 실행했다. 제품 migration 변경이나 기존 운영DB 작업은 없다.

최종 집계와 실패 재검사·정리 결과는 아래 확정 절에 추가한다. UI 정상만으로 MySQL 경합/재시작/마이그레이션 결과를 대신하지 않는다.

## 도움말·증빙

[기능별 시나리오](../user-manual/site/feature-scenarios.md)의31/32에 정확한 자원 권한 진입과 저장 영수증 후 현재 상태 재조회 절차를 명시했다. 합성 자료의 모바일 복원 화면을 추가했다. 소스·대시보드 UI 제품 코드 수정은0이다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/help-followup-20261025/`의 before/source-disabled/source-restored/dashboard-disabled/dashboard-restored.json·ui-summary.json, source/dashboard 상태 캡처, mysql 개별 JSON/로그·초기실패·probe·재검사. 초기 source-disabled 캡처는 상태 패널 상단만 보이므로 최종 상태 증빙은 source-restored-390과 dashboard-disabled/restored를 사용한다.

메인 runtime 정상stop200·별도 소유 자원 정리만 요청했다. 기존5173/다른Colima프로필·사용자 데이터는 건드리지 않았다. 관리 worktree는 기존 보호에 따라 유지한다. `.claude/settings.json`·`CLAUDE.md`의 다른 작업 변경은 보존한다. 실운영·실휴대폰·VoiceOver·나머지 관리자 화면 전체는 미완료다.


## 최종 확정 결과

- 최초 목록의 실행 가능한187조건 PASS. 비활성 환경에서만 존재하는 안내용 sentinel1개는 성공 사례로 세지 않고 실제 Studio 재사용5조건으로 대체 실행했다. 최종 **192개 고유 조건 PASS / 미해결 FAIL0**이다.
- 최초166 PASS를 보존하고 기존4실패·17실행 설정 차단을 재검사했다. 중간 상태관리16·identity9·legacy17의42 PASS와 마지막 expiry1·reuse5의6 PASS는 겹치는 조건을 제외해 집계한다. 최초188+재검사48처럼 합산하지 않는다.
- MySQL8.4.11 실제 권한·회수·계정 무결성·삭제 보호·인계/이동/탈퇴·마이그레이션·출력 재시작·재사용의 선택 조건이다. 운영DB·부하·모든writer·모든실기기 수용을 뜻하지 않는다.
- 변경3개 spec lint/type/diff check PASS. 제품BE/FE로직 변경0, 테스트 인덱스 준비/관측/시각정밀도만 보완했다.
- 각 별도 실행의 소유 컨테이너 제거와 임시 credential 정리 결과를 보존했다. 임의프로세스종료·prune·오류플래그초기화는 하지 않았다.
- 도움말 최종 빌드27HTML/내부참조1527/오류0. 신규 관리자 모바일 이미지는 직접 확인했다.
