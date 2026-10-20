# UC050 조직 공통 분류와 변수 연결

2026-10-18 · 기준 6a2c9996 · FR015/FR014·NFR005/007/008 · TC050 E01/E02/E03/E12/E13. 추가16개 요건의 일부이며 전체 수용 완료가 아니다. MK AI 연동은 제외한다.

## 목표와 경계

조직의 공통 분류를 만들고 여러 소스 열에서 명시 선택·미리보기·저장·새로고침으로 재사용한다. 기존 classification 문자열은 그대로 유지하며 이름 일치로 자동 연결하지 않는다. 분류는 정리용 metadata이며 조건 실행 의미·SQL·소스 권한·기존 게시·출력 숫자를 바꾸지 않는다. 계층/분류별 데이터 값 사전·공식 승인 workflow는 이 계약이 구현했다고 주장하지 않는다.

## 사전

EnterpriseClassification은 id, organizationId, name, nameKey, active, version이다. 이름은 NFKC 정규화 후 trim·UTF-16 길이1~80·원문/정규화 이름의 제어문자 및 단독 surrogate 금지다. nameKey는 정규화 이름의 소문자 UTF8 SHA256 hex64로 만들어 SQLite/MySQL collation에 따른 equality 차이를 피한다. 같은 조직의 key는 DB unique이며 다른 조직의 같은 이름은 허용한다. 비활성 이름도 예약하고 재활성화한다. 물리 삭제는 제공하지 않는다. 버전은 양의32비트 CAS이며 한계에서 거절한다.

활성 구성원만 본인 조직 사전을 조회한다. 생성/이름/활성 변경은 현재 admin만 한다. 사전 응답에는 소스·열·사용처가 없다. 목록은 id순20개+cursor이며 검색은 불러온 범위임을 표시한다. controller는 JWT epoch를 검증하고 서비스는 metadata queue/transaction 이후에도 현재 계정 활성·authVersion·소속을 다시 검증한다. 변경의 expectedActorId/expectedOrganizationId와 현재 문맥이 다르면 거절한다. 사전 admin이 소스 edit를 얻지는 않는다.

GET enterprise/classifications?afterId는 raw {actorId,organizationId,canManage,entries,nextAfterId}, entries는 {id,name,active,version}이다. POST collection은 {expectedActorId,expectedOrganizationId,requestId,name}, POST :id는 {expectedActorId,expectedOrganizationId,expectedVersion,name,active}다. 생성 응답은 raw {actorId,organizationId,entry,replayed}, 변경 응답은 raw {actorId,organizationId,entry}이며 entry는 {id,name,active,version}이다. authVersion은 검증된 JWT actor에서만 받으며 본문에 허용하지 않는다. 모든 응답 no-store. 생성 UUID와 canonical 본문/조직에 묶인 영수증으로 응답 유실 재확인을 제공한다. 동일 UUID의 다른 본문/조직은409, 중복 행/감사0이다. 영수증은 생성 당시 entry snapshot이며 현재 이름/활성/새 연결 허용 증명이 아니다. 현재 상태는 목록을 다시 읽는다. 저장 영수증의 정확한 shape·actor/org·양의 ID·정규화 요청 이름·최초 active/version을 검증하고 손상은409로 거절한다. 변경은 CAS 영향행1과 감사 원자 저장이며 무변경은 쓰기0이다. actor/조직 전환 뒤 과거 요청을 새 조직에 replay하지 않는다. 잠금은 공통 User→membership→분류 id순이며 사전 변경은 source를 역잠금하지 않는다.

## 변수 연결과 보존

BusinessVariable의 기존 classification에 선택적 classificationRef {organizationId,id,version} 또는 명시 null을 추가한다. 저장된 이력의 ref는 엄격한 양의정수 shape로 검증하되 현재 사전을 재조회해 역사적 이름을 바꾸지 않는다. ConditionSemantics에는 이 ref를 추가하지 않는다.

- 기존 연결이 있을 때 ref 생략은 연결/이름을 보존한다. 연결 중 문자열만 바꾸려 하면 거절한다. 기존 연결이 없는 legacy/해제 후 열은 ref 생략 시 제공한 classification 문자열 편집을 허용하며 문자열도 생략하면 보존한다.
- ref null은 명시 해제다. null을 저장 metadata·preview draft·조회/이력에서 생략하지 않고 보존한다. 기존 이름을 자유 문자열로 유지하며 diff에 해제를 표시한다. 해제 후 별도 편집에서 이름 변경이 가능하다.
- 이전과 같은 ref/이름은 보존이며 사전의 새 이름/비활성/이전 조직 때문에 다른 metadata 편집을 막지 않는다.
- 신규 연결/다른 ref/같은 id의 최신 버전 채택은 현재 source edit와 현재 소속 조직의 활성 사전/정확 버전을 검증하고 서버가 이름을 채운다. client 이름으로 사전 이름을 바꾸지 않는다. 같은 이름이라도 ref 연결/해제는 별도 diff다.
- 사전 이름 변경/비활성은 기존 catalog의 이름/ref·분석을 자동 갱신하지 않는다. 명시 선택→diff/preview→새 catalog 버전 저장만 반영한다. 비활성은 새 연결을 막고 기존 연결은 보존한다.
- source 소유자의 조직 이동 후 기존 ref는 역사 metadata로 읽고 새 조직으로 자동 이관하지 않는다. 새 연결은 본인 현재 조직에서 다시 선택한다.

SourceCatalog prepare는 source/file/schema/catalog CAS와 선택 사전 기준을 확보한다. SQL/날짜 전체 검사는 기존대로 metadata 잠금 밖이다. preview 반환 전·save transaction 안에서 현재 actor/소속·새 연결 사전의 조직/활성/version을 재검사한다. save는 source 잠금에 이어 분류를 id순 잠그고 append와 필요한 감사가 실패하면 전체 rollback한다. 현재 권한은 미리보기 전후/저장 때 다시 확인하며 사전 손상/누락을 native/free text fallback으로 바꾸지 않는다. 기존 ref의 보존/해제는 현재 사전 조회를 강제하지 않는다.

## 화면과 복구

조직 화면에 접힌 공통 분류 목록과 admin 생성/편집/활성 전환을 제공한다. 소스 업무 유형의 추가 설정에 검색/명시 선택·연결 이름/버전·해제·목록 다시 읽기를 둔다. 사전 조회/검색만으로 입력·preview를 바꾸지 않는다. 목록은 조회 당시 조직에 묶고 늦은 응답/계정 전환으로 다른 조직에 연결하지 않는다. 미확정 생성은 UUID/본문을 고정해 같은 요청 확인을 제공하며 새 생성과 구분한다. 과거 생성 영수증은 현재 목록에 새 entry로 삽입하거나 현재 이름/활성으로 덮지 않는다. 페이지 밖 현재 상태는 cursor를 유지한 명시 load-more로 확인하며 중복 ID를 만들지 않는다. 탭 저장소에 최소 생성 요청만 현재 로그인 세대/actor/조직 범위로24시간·8KiB 보관한다. 새로고침 후 현재 목록/조직/권한을 확인한 뒤 명시 재확인만 제공하며 자동 POST하지 않는다. 정상 토큰 갱신은 같은 scope를 쓰고 새 로그인/다른 actor·조직에는 요청을 복구하지 않는다. 확정 성공/명시 폐기 시 기록을 제거하며 저장소 오류는 현재 화면의 초안/질문을 지우지 않고 안내한다.409/네트워크 실패는 입력을 보존하고 새 검토를 요구한다. 일반 입력/선택36px·도구32/36px·폰트14px(모바일 입력16px)를 사용하고390/768/1440에서 정렬·넘침을 실제 화면으로 검증한다.

## 종료 증거

같은 조직의 두 source가 같은 분류ID를 저장/reload하고 이름 변경 후 과거 이름 유지→명시 최신 채택→새 버전 저장을 검증한다. 비활성 신규 차단/기존 보존·해제/legacy 문자열/같은이름 ref차이·타 조직 ID/actor/epoch위조·reader/admin권한 분리·CAS/중복이름/동일UUID재시도·응답 유실 후 reload/명시 재확인·preview뒤 변경과 rollback을 확인한다. 실제 MySQL migration 재실행/이름 equality/두 연결 CAS·이력 보존을 격리 Docker로 검증한다. FE 단위/type/lint/build·JWT/SQLite/DuckDB 독립정답·headless 실제 UI·별도 검토·AIWF strict/pin/check/packet 후 commit/push한다. 사용자 제어 Ego96/실휴대폰/운영·사람 수용은 수행하지 않았다면 미실행으로 남긴다. 다음 공백인 새 지표/차원 생성의 전체 업무 의미 적용과 전체16개 수용을 이 단위로 대체하지 않는다.

## 현재 구현·검증 상태

[증빙](../testing/organization-classifications.md)에 BE10 suites/293 PASS·types/lint/build, FE8 suites/102 PASS 뒤 영향13/23 PASS·각 types/lint/build, 실제 MySQL15 PASS/8.924초와 격리 자산 cleanup, core15 PASS/51.0초를 구분해 기록한다. 겹치는 배치를 합산하지 않는다. 마지막 receipt/pagination 및 필드 정렬 수정 후 실제 UI2 PASS/13.1초를 확인했다. 생성 commit503→reload→동일 UUID/body 확인과 두 source 연결/이름 보존·명시 채택/비활성/해제/자유 이름 편집/reload, 페이지 밖의 과거 영수증과 현재 목록 분리를 포함한다. 기존 UI Kit의900px 미만 입력16px/desktop14px·높이36px를 유지하며390/768/1440 overflow0, 768/1440 세 필드 top 차이0px와 수정 후 시각 열람을 확인했다. 두 별도 reviewer의 확인된 finding은 해소됐다. Ego96 제어권 인수·물리 휴대폰·운영·사람 수용, 새 semantic 지표/차원 생성 및 전체 FR015/16개 수용은 열린다.
