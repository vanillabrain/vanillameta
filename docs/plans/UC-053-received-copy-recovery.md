# UC053 받은 분석 독립 복제 생성 요청 복구

Status: Draft

## 목표·범위

FR021/NFR005/NFR008·UC053 A4/BR-053-05·TC050 E06/E07. 직원/그룹으로 받은 분석을 본인 소스로 복제하는 저장 요청을 전송 전에 보존하고, reload 후 이미 생성된 본인 사본을 읽기 전용으로 찾는다. 미생성 요청만 원래 조건 재미리보기와 별도 동의로 동일 요청을 재시도한다. 일반 게시 링크/소유 저장본 복제의 전면 초안 복구·모든 미저장 편집 복구·MK AI 계약은 이번 범위가 아니다.

## 탭 보존

received route의 현재 actor/org·대시보드 번호·opaque session/auth epoch에 묶인 sessionStorage 티켓을 사용한다. 24h/128KiB 상한, 정확 키·소문자 UUIDv4·양수 ID/버전·64hex revision·매핑 최대128열(각256자, 위험 key 거절)·제외 최대6블록/중복 없는 bounded ID·현재 route와 reference의 원본 ID 일치를 검증한다. 저장 실패·손상/만료는 새 저장을 차단하고 명시 보관 해제로만 정리한다. 공개 bearer token/원본 파일/행/SQL/비밀/미리보기 숫자/문서/직원 이름을 저장하지 않는다. JWT 권한이 별도로 필요한 d-/g- private reference는 정확 요청 digest 재구성을 위해 값에만 보존하며 공개 링크 토큰처럼 취급하지 않는다.

보존 대상은 미리보기 완료 후 실제 저장을 시도한 frozen reference+RemixSaveInput이다. 미전송 편집 전체를 복구한다고 표현하지 않는다. 다른 계정/조직/epoch의 자료와 늦은 응답을 적용하지 않으며 계정 변경 시 현재 범위를 재확인한다.

## 읽기 전용 결과 확인

`POST /studio/received/:reference/remix-result`는 정확 RemixRequest를 정규화해 원래 digest를 계산하는 조회 전용 API다. 현재 JWT actor/epoch를 잠금 뒤 검사하고 actor+requestId 영수증을 읽는다. 결과가 있으면 User→사본 Dashboard→target Source 부모 순서로, 미관측이면 User→target Source 순서로 잠근 뒤 현재 소유/활성을 검사한다. 찾으면 digest/대상 일치를 검사하고 실제 사본 OWNER·target source OWNER/active를 재검사한 뒤 `{found:true,dashboardId,sourceId,revision}`만 반환한다. revision은 저장 당시 영수증 기준이다. 원본 공유/복제 허용이 나중에 회수돼도 현재 본인 소유 사본을 확인할 수 있으며 원본 접근을 주지 않는다. source/사본 소유권 상실·비활성은 차단한다. hash/reference/문서/SQL은 반환하지 않는다.

영수증이 없으면 현재 actor와 target source OWNER/active 확인 후 `{found:false}`다. 조회 시점 미관측이며 진행 중 저장의 미완료/취소 증명이 아니다. 조회는 origin resolver·SQL/파일 집계·preview/save/새 UUID·감사 쓰기를 호출하지 않는다. 기존 내부 receipt 용도는 유지한다.

## 복구 UI

reload 복구는 쓰기0이며 자동 복제 저장/새 reference 교체를 하지 않는다. 명시 결과 확인으로 이미 생성된 사본이면 본인 사본 열기를 제공한다. 못 찾으면 원 frozen reference/원본 lifecycle·버전/매핑/제외/target source revision을 그대로 재미리보기한다. 현재 집계 미리보기의 sourceRevision까지 원 요청과 같을 때만 전체 미리보기→별도 동의→정확 동일 요청을 저장한다. 결과 조회 실패/403/409·원본 변경·소스 변경은 티켓을 유지하고 자동 버전 갱신/새 UUID를 만들지 않는다. 보관 해제는 서버 취소나 기존 사본 삭제가 아니며 별도 경고·동의를 요구한다.

received 재미리보기도 계산 시작 전과 성공 응답·계산 오류 상세 반환 전에 현재 epoch를 재검사한다. 긴 계산 중 User 잠금은 유지하지 않으며, 계산 중 인증 회수 시 집계/상세를 반환하지 않는다. received save도 현재 epoch를 첫 신원 경계와 최종 원자 저장/replay 앞의 User 잠금에서 재검사한다. User 잠금은 Dashboard/Source보다 먼저 취득하고 긴 DuckDB/LLM 작업 중에는 유지하지 않는다. 일반 게시 controller가 같은 서비스에 epoch를 전달할 필요가 있으면 호출 계약만 맞추며 기존 복제 의미는 유지한다. 그룹 private reference도 received UI/오류/돌아가기 경로로 분류한다.

## 검증·종료

저장소 한도/엄격 입력/손상/격리/쓰기 실패·UI remount/reload/늦은 응답·확정/미관측·실패/403/409·정확 재미리보기와 별도 저장·보관 해제를 확인한다. Docker MySQL의 정확 digest/다른 actor·소유/소스/epoch·조회 쓰기0·원자 사본/영수증·동시 동일 UUID·잠금 대기 경합을 선택 검증한다. Ego 한 공간에서 실제 저장 commit 후 응답 유실→reload→확정 사본 찾기/열기·미전달→결과 미관측→재미리보기→같은 요청 저장/reload·원본 보존·대표390/768/1440px를 확인한다. spec/수용 잔여/AGENTS 동기화·별도 검토·pin/check/packet 후 commit/push한다. 운영/실기기/전체16개 수용은 Open이다.
