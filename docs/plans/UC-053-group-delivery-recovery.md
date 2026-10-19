# UC053 그룹 공유 요청 새로고침 복구

Status: Draft

## 목표·경계

FR021/NFR005/NFR008·UC053 A3/BR-053-04·TC050 E06/E07. 직접 직원 공유 복구 다음으로 동적 그룹 조회 공유/회수·독립 복제 허용 설정의 미확정 요청을 복구한다. 독립 사본 생성 요청 복구·일반 member 공유 정책·MK AI 계약은 이번 범위가 아니다.

## 복구 계약

직접 공유와 별도 prefix의 sessionStorage에 actor/org/dashboard/session epoch·savedAt·정확한 UUIDv4/groupId/expectedGroupVersion/expectedVersion/active/allowCopy를 전송 전에 검증 저장/읽어 확인한다. 24h/8KiB·양수 ID/그룹 버전·CAS<2147483647·회수 시 allowCopy=false·정확한 키를 검증하며 이름/SQL/원본/token/링크를 저장하지 않는다. 저장 실패/손상/만료는 쓰기를 차단하고 경고한다. 잘못된 자료를 자동 삭제/재전송하지 않는다.

접기/이동/reload 후 같은 범위의 티켓만 복구하며 자동 POST0이다. 최신 그룹/관계 GET 성공도 미확정 티켓을 지우거나 그룹 버전/CAS를 최신 값으로 교체하지 않는다. 그룹 번호·버전·변경을 확인하고 현재 관리 조회 후 별도 동의로 정확한 동일 요청만 재시도한다. 영수증이 있으면 역사 응답이며 현재 그룹/공유 가용성 증거가 아니다. 영수증이 없으면 최초 쓰기를 시도하므로 그룹 변경409/비활성403을 보존하며 자동 재바인딩하지 않는다. 성공 후 최신 상태 재조회 전 새 쓰기를 금지한다.

명시 탭 보관 해제는 서버 취소/공유 회수가 아님을 설명하고 별도 확인한다. 다른 계정/조직/epoch의 티켓·늦은 응답을 적용하지 않는다. 현재 권한과 epoch는 서버에서 매번 검사하며 GET 성공이나 cache fence로 대신하지 않는다. 그룹 POST의 잠금 후 epoch 검사를 직접 공유와 대조하고 확인된 공백만 최소 수정한다. 그룹 version/CAS·도메인 digest·공유/감사/영수증의 원자성·직접/직원 공유·원본/사본 보존을 유지한다.

그룹 POST에서도 User 잠금 뒤 현재 authVersion을 검사하지 않는 공백을 확인했다. controller에서 epoch를 전달하고 기존 groupAdmin 잠금 뒤·정책/영수증 앞에서 현재 active/epoch를 검사한다. 공통 그룹 CRUD/트랜잭션 계약은 변경하지 않는다.

## 검증·종료

저장소 격리/한도/만료/엄격 입력·쓰기 실패, FE reload/remount/접기·GET실패/성공 보존·동의/동일 요청·403/409·늦은 응답·명시 보관 해제를 검사한다. 실제 Docker MySQL에서 그룹 변경409·회수 후 역사 replay의 재활성화0·다른 도메인 UUID 충돌·rollback·잠금 대기 epoch 변경 거절을 선택 검증한다. Ego 한 공간에서 commit 후 응답 유실→reload→현재 조회→동일 요청 replay, 미전달 뒤 그룹 변경409 보존/보관 해제, 대표390/768/1440px 크기·정렬·원본 보존을 확인한다. 설계/UC/TC·수용 잔여·AGENTS를 동기화하고 별도 검토·pin/check/packet 후 commit/push한다. 운영/실기기/전체16개 수용은 Open이다.

## 변경 범위

GroupDeliveries·ResourcePolicies의 조직/actor 전달, 별도 groupDeliveryPendingStorage와 검증/회귀 테스트. 필요한 그룹 POST controller/service epoch fence·선택 MySQL lane/spec. 새 schema/entity는 만들지 않으며 그룹/직접 공유가 같은 영수증을 쓰되 도메인 구분은 유지한다.
