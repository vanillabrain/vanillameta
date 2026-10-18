# UC053 그룹 공유 알림 검증

2026-10-18. [설계](../plans/UC-053-group-notifications.md)는 FR022/NFR005/007/008의 구현 단위다. 전체16개·TC050 수용 완료가 아니다.

## 사건 수신자와 현재 권한

그룹 공유·복제 동의 변경/회수의 감사 원장과 사건 당시 현재 활성/같은 조직 구성원 audience를 원자 기록한다. 명시 그룹 구성 변경의 가입/제외·비활성/재활성도 현재 유효한 공유 자원에 새 사건을 기록한다. 소유자는 자기 알림에서 제외하고 이름 변경만으로 사건을 추가하지 않는다. 그룹 audit.subjectId는 그룹ID이며 직원ID로 해석하지 않는다.

알림 조회/mark는 현재 활성 본인·현재 조직과 개인 action/subject 또는 그룹 action/명시 audience를 확인한다. 그룹에서 제외된 당시 수신자는 회수 사건을 확인할 수 있고, 나중 가입한 구성원은 자기 가입 사건부터 받는다. 과거 group 감사는 당시 명단이 없어 현재 명단으로 소급하지 않는다. 소스 권한·자료/원본/개인·그룹 권한·독립 사본은 알림이 변경하지 않는다.

표시 상태의 읽음/목록 제거는 원장/관계 삭제가 아니며 알림은 현재 접근권 증명이 아니다. 응답은 기존 번호/시각/버전/사건/읽음과 그룹 사건의 viaGroup=true만 반환한다. 그룹/직원 이름·명단·actor/subject·소스 정의·SQL·토큰은 반환하지 않는다. 사건 version은 해당 공유 관계 version이며 그룹 전체 revision이 아니다.

## 실행 범위

- SQLite 서비스와 실제 JWT HTTP에서 그룹 subject/직원 번호 충돌·audience 없으면 목록/mark 거절·현재 조직/epoch 보호·그룹 회수 표시/읽음/제거·개인 상태 단방향/멱등을 확인한다.
- 그룹 공유 후 명시 구성원 추가→새 가입 알림·이전 사건 비노출→제외/비활성/재활성→회수 뒤 사건 읽음·동일 영수증/낡은 그룹 CAS의 추가 사건0·이름만 변경 시 audience 추가0을 확인한다.
- audience INSERT 실패를 SQLite trigger로 주입해 공유 관계/감사/영수증 또는 구성원/version/감사가 전체 rollback됨을 확인한다. 이는 저장의 필수 사건 기록이다. 이미 commit된 공유 뒤 알림 조회 오류는 원 공유/실제 read/받은함을 보존한다. 외부 발송 worker는 추가하지 않는다.
- 신규 audience migration 두 번 실행·기존 audit/state 보존·복합 PK 중복 거절·파괴적 down 거절을 확인한다. 명시 fixture metadata를 추가했으며 제품에 metadata 부재 우회는 없다.
- FE 조직 화면9 files/75개 PASS: 그룹 조회 공유/회수 표시·현재 권한 안내·명시 읽음·잘못된 viaGroup/permission 응답 거절과 기존 조직/그룹/공유 회귀를 확인했다. 기존 UI Kit의 도구32px/14px 본문/12px 보조·wrap/min-w-0을 유지한다. 화면 크기 실측은 아니다.
- 양쪽 type/lint/build PASS·격리 headless core E2E8개 PASS. 직전 단위 전체 BE2696/FE1746 결과는 역사적 회귀이며 이번 전체 실행으로 합산하지 않는다. 최종 선택 BE 5 suites/116개 PASS다. 로그는 Git 제외 `.aiwf/evidence/UC053-group-notifications`에 보관한다.

초기 그룹 알림 이전의 “권한 알림만” 기대는 새 그룹 회수 사건에 맞춰 갱신했다. JWT 비공개 필드 검사는 기존 resourceId를 sourceId로 잘못 탐지한 부분 문자열 정규식을 JSON key 기준으로 수정했다. 실제 응답 필드를 삭제하거나 권한 검사를 약화하지 않았다.

## 리뷰와 잔여

Main의 구현 후 별도 검토는 원장의 그룹 subject와 본인 audience 구분·read/remove 단방향·후속 접근 재검사·같은 transaction 안의 실패 복구를 확인했다. 독립 native code-reviewer(Sol)는 생산/스키마9개·계획과 관련 테스트를 읽고 추가 지적0을 보고했다. 검토자가 pending으로 남긴 Main 검사는 최종 BE116/FE75·core8로 완료했다. 검토자의 코드 의견을 사람 수용/운영 승인으로 기록하지 않는다. 정적/자동 검사와 사용자/운영 승인·수용은 별도다.

실제 Ego96은 사용자 제어 상태이며 새 Ego/390·768·1440 실측/실휴대폰은 NOT_RUN이다. MySQL audience·그룹/계정 경합·대규모/운영·사람 수용, 계정 활성/조직 변경만으로 자동 생성하는 그룹 사건·외부 발송·export 알림·브라우저 reload 공유 요청 복구는 남는다. 전체 FR022/TC050·16개 완료를 주장하지 않는다.
