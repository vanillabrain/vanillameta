# UC051 퇴사·인계 전 영향 확인

Status: Draft

## 범위

[설계](../plans/UC-051-departure-impact.md)·UC051 A3/BR05104·TC050 E02/E03의 읽기 전용 첫 단위다. 비교 기준은 develop-v2의 d8518702 이후 이 단위 변경이다. 개인 소유 자료와 현재 조직 관계를 구분해 고정11종 건수만 확인한다. 퇴사/탈퇴/소유권 인계/계정 삭제 확정은 구현하지 않았고 기존 자료·권한·소속·감사를 변경하지 않는다.

## 검증 기록

- 서버는 보호 GET과 counts-only projection을 추가했다. SQLite 공통 metadata 큐/transaction과 MySQL REPEATABLE READ snapshot, snapshot 종료 후 단일 최신 계정·소속·조직 조회를 적용한다. 자료 내용 hydrate·감사 쓰기·소유권/소속 변경은 없다. 기존 entity/schema 변경이 없어 migration은 추가하지 않는다.
- 서버 선택 실행: departure-impact와 기존 staff-transfer 2 suites **43 PASS/4 SKIP, 2.163초**. native executor의 실제 도구 실행 보고를 `.aiwf/evidence/UC051-departure-impact/delegated-checks.json`에 기록했다. 별도 stdout 로그가 없는 실행이며 MySQL과 합산하지 않는다.
- 실제 Docker **MySQL8.4.11 departure21 PASS/SQLite 전용1 SKIP, 2.707초**: 11종 정답·비활성/회수·중복 mapping/고아 제외, 실제 JWT/filter HTTP, DB 내용 불변, 두 연결의 RR 집계 중 소스/지표 추가에도 동일 snapshot, snapshot 중 계정/역할/소속/팀/조직 변경 뒤 최신 검사의401/403/409를 확인했다. `mysql.log`의 컨테이너·임시 credential 정리를 확인했다. SQLite suite와 겹치는 케이스가 있으므로21+43으로 계산하지 않는다.
- FE 선택 실행: API/패널/직원 목록/기존 이동 **4 files73 PASS, 2.69초**. 정확한 키/정수/조직·직원·버전·시각 검증, 관리자 전용/명시 GET, 실패·대상 변경/접기/unmount/늦은 응답 보존 경계를 검사했다. 타입·범위 lint·FE build 통과는 같은 executor 보고이며 FE build2.77초다. BE 타입·범위 lint 통과와 Main BE build 로그를 구분한다.
- 독립 native code-reviewer Gauss의 정적 검토는 **APPROVE/확정 finding0**이며 타입/lint/runner 문법/diff를 실행했다. 리뷰어가 runtime/MySQL/Ego를 재실행한 것은 아니다. 사람 수용이 아니다.

### Ego102 실제 화면과 별도 앱 API

사용자 실행 서버와 분리한 임시 SQLite QA 서버에서 가상 조직/admin/직원/다른 조직만 사용했다. API로 명시 조직 연결을 준비하고, 소유 검증 DB에 비활성 소스/지표·삭제 표시 대시보드·중복 mapping 합성 fixture를 추가했다. 실제 화면에서 관리자로 로그인→직원 선택(요청0)→명시 조회200/11카드→대상 변경 즉시 결과 제거→다시 조회→탭 통신을 실제 오프라인으로 전환해 XHR0/오류와 이전 결과 제거·직원 선택 유지→연결 복원/명시 재조회200을 확인했다. 응답을 가짜로 주입하지 않았다.

접기→열기는 기존 결과를 다시 보여주거나 요청하지 않았고, 명시 재조회만200이다. 브라우저 reload 뒤 접힘/결과 없음과 재선택 필요를 확인했다. 일반 직원으로 실제 로그아웃/로그인 후 직원 목록/이 패널 모두 비노출이다. 별도 앱 API 요청은 admin200/직원403/다른 조직403/미로그인401, 응답 메타6키/11종 건수와 비밀 sentinel 비노출을 확인했다. 실제 앱의 API와 화면 DB는 SQLite이며 MySQL 앱 화면으로 표현하지 않는다.

실제 조회 전후 전체65개 테이블 hash가 같았다(`readonly-invariants.json`의 directGet). 화면 reload를 포함한 별도 비교에는 기존 userinfo 경로의 login_history1행이 추가돼 전체 DB 불변으로 표현하지 않는다. 자산/권한/소속/기업 감사 등 나머지64개는 동일했다. 독립 서비스/보호 HTTP의 조회 자체 쓰기0은 서버 테스트와 directGet 비교로 확인했다.

| 폭   | 선택/조회 버튼 | 선택 폰트 | 배치                       | 가로 넘침 |
| ---- | -------------- | --------- | -------------------------- | --------- |
| 390  | 각각36px       | 16px      | 세로, top 차44px=36+8 간격 | 없음      |
| 768  | 각각36px       | 16px      | 가로, top 차0px            | 없음      |
| 1440 | 각각36px       | 14px      | 가로, top 차0px            | 없음      |

Main은 세 스크린샷을 직접 열람했다. 상세 기준은 기본 접힘이며1/2/3열 카드와 줄바꿈을 확인했다. `scrollWidth-innerWidth=-15px`는 세로 스크롤바 공간으로 가로 넘침0이다. 최종 화면은 기존36px UI Kit을 사용하며 휴대폰/터치·키보드 전체 수용은 아니다. Node22.23.1 검증 런타임이며 지정 Node24 운영 호환성 검증은 아니다.

자동화의 첫 snapshot subtree 호출에 CSS selector를 넘긴 것은 Ego API 입력 오류였고, 오프라인 검증의 첫 대기는 더 구체적인 오류 문구를 예상해 timeout됐다. 이후 같은 공간에서 실제 일반 재시도 안내·선택/건수 제거를 확인해 복구했다. 이 실패를 숨기거나 별도 제품 PASS로 합산하지 않는다. Ego102는 최종 finish했고 임시 서버·credential을 정리했다.

### 문서·검토 경계

UC051 A3/BR05104, TC050 선택 정의, 완료 계획/수용 점검/AGENTS를 동기화했다. FR016 기존 직원 lifecycle 목표를 확장한 새 요건 ID는 없고 entity/용어/actor 관계도 바뀌지 않아 requirements/entity_model/glossary/use_cases.puml은 변경하지 않았다. 선택 UC051/TC050 lint와 전역의 기존 중복 ID/상태 불일치 잔여를 구분한다. AIWF pin/packet은 문서 snapshot/검토 준비이며 제품 수용이 아니다. UC051/TC050 선택 lint는 각각0 errors/0 warnings, 전역 strict는 기존 중복 ID/미연결·상태 문제17 errors/5 warnings로 실패하며 이번 변경으로 전체 문서 통과를 주장하지 않는다.

원격 f58ab617의 Studio Pivot 작업을 보존해 rebase했다. 통합 후 Main은 BE 선택43 PASS/4 SKIP(4.249초)·FE73 PASS(1.54초), 양쪽 type/범위 lint/build를 재실행해 통과했다. 같은 테스트를 다시 합산하지 않는다. Ego 검증은 통합 전이며 원격은 이 단위의 enterprise 파일/공통 UI Kit을 변경하지 않았고, 통합 후 실제 Ego를 다시 실행한 것으로 계산하지 않는다. 결과는 `*-integrated-*.log`에 기록했다.

## 한계와 후속

개인 소유 건수는 조직 귀속 자료 목록이 아니다. 비활성/회수 관계와 중지·만료 Studio 게시/종료 출력도 포함하며 현재 유효 권한이나 공개 링크 수를 뜻하지 않는다. 고아 mapping/소스 없는 지표·개인 저장 보기·기존 대시보드 게시/공유·별도 BI 조직/정책·외부 원본·파일 크기와 전체 사용처는 제외한다. MySQL RR의 한 시점 건수와 조회 뒤 계정/소속/조직 기준 재검사를 구별한다. 자료를 동결하거나 인계 실행 기준/ticket을 발급하지 않는다.

다음은 업무 자료의 명시 선택·수신자 수락·의존성/보관 주체 고정 후 실제 인계/탈퇴의 원자 저장·영수증·권한 비부활 계약이다. 실제 휴대폰/운영·전체 FR016/FR017/16개 요건/TC050·사람 수용은 미완료다. MK AI 연동 계약은 보류한다.
