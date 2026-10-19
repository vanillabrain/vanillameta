# UC051 인계 전 파일 보관 신원·사용처 검토

Status: Draft

## 목표·제한

FR016/FR017/NFR005/NFR007·UC051 A6/BR-051-07·TC050 E02/E03, [연결 검토](UC-051-handover-review.md)의 후속이다. 수락된 고정 요청의 소유자가 선택한 파일형 소스의 관리 파일 존재/연결 신원, 알려진 파일 공유 소비자와 갱신 작업을 읽기만 한다. 원본 파일·DB·권한·의향·감사 쓰기0이며 파일 내용의 계산 검증/복사/삭제/실제 이전은 하지 않는다. 수신자 동의를 새로운 내용 공개 권한으로 확장하지 않는다. 실행 가능성·배타적 보관·복구 가능 판정은 여전히 제공하지 않는다.

## 고정 HTTP 계약

`GET /enterprise/handover/:id/custody`는 기존 dependencies와 같은 현재 활성/epoch·현재 조직 소유자 전용이다. 미존재404/수신자·admin·다른 조직403/오래된 token401, 미수락·철회·만료·발급 양쪽 epoch/조직 버전·선택 자료 소유/활성/제목/metadata 변경409다. DB snapshot에서 선택 기준을 확인하며 파일 검사 후에도 현재 권한/요청과 선택 자료 기준을 다시 검사한다. 원본 파일과 metadata를 하나의 원자 snapshot으로 묶을 수 있다고 주장하지 않는다. filesystem 오류의 원문/경로는 숨긴다.

응답은 정확히 requestId/organizationId/ownerId/recipientId/proposalVersion/checkedAt/scope(`selected_file_custody_v1`)/executionAvailable(false)/sources다. sources는 기존 manifest에서 source만 추린 순서의 kind(`source`)/id/title/storage(`managed_file|external_connection|unresolved`)/identity(`observed|unresolved|not_applicable`)/filesChecked(0~5)/consumers(`present|none_observed|unresolved|not_applicable`)/refresh(`active_or_unresolved|none_observed|not_applicable`)다. 선택 source가 없으면 sources=[]다. 내부 신원/dev/inode·hash·manifest·파일명/경로·설정·다른 소스 ID/제목/직원·작업 ID/상세는 응답하지 않는다. 각 상태의 개수는 합산하지 않는다.

## 관리 파일 검사

DuckDB와 SQLite 계열만 관리 파일 후보이며 FILE_UPLOAD_DIR의 허용 형태만 읽는다. 외부 연결은 external_connection/identity·consumers·refresh not_applicable/filesChecked0이며 별도 연결 계정 검토를 안내한다. 엔진/설정/암호 해독/버전 목록 손상은 unresolved다. 현재 파일과 fileVersions의 중복 제거1~5개를 검사하며 일부만 확인한 것을 전체 확인으로 표시하지 않는다. 파일 시스템 접근은 서버 설정 관리 루트/허용 패턴에 한정하고 임의 경로나 symlink를 따라가지 않는다.

관리 디렉터리를 재귀 순회하는 삭제용 inspector는 사용하지 않는다. 선택 파일과 import.json, SQLite companion3종만 확인한다. 소비자 경로는 길이4096/깊이32 이내로 제한하며 초과는 unresolved다. manifest는 최대1MiB+1의 제한된 읽기로 처리하고 증가/신원 변경은 실패한다. DuckDB는 UUID/data.duckdb 및 import.json의 ready·정확한 databaseId 연결·존재하는 일반 파일을 확인한다. 삭제 복구용 allowMissing/allowUnregistered/validation_failed 허용은 승계하지 않는다. SQLite는 서버 sample-UUID.db와 기존 제한된 signature/파일 신원 검사만 재사용하며 source 소유 manifest가 없음을 UI에 밝힌다. 파일 bytes 전체를 읽거나 SQL 연결/검증하지 않는다. 검사 사이 파일/디렉터리/manifest 신원·변경이 감지되면 identity=unresolved다. 관리 루트는 신뢰된 앱 코드만 쓸 수 있어야 한다. 같은 UID의 적대적 프로세스가 검사 사이 경로를 교체하는 모든 경우를 Node 경로 API로 동결한다고 주장하지 않는다. identity=observed는 관측된 신원일 뿐 내용 정상/내구 보관/수신자 책임 확정이 아니다.

다른 Database의 파일 설정/버전과 CommerceSource.publishedFilename을 제한된 metadata 순회로 확인한다. 동일 경로·DuckDB 관리 디렉터리 하위·SQLite companion의 겹침 및 안전 관리 경로의 같은 inode/hard link를 발견하면 consumers=present다. 다른 사용처의 제목/ID/정확 건수는 숨긴다. 적어도 하나의 공유가 확실히 관측되면 다른 소비자의 검사 불완전 여부와 별개로 present를 유지한다. 이는 전체 소비자를 확인했다는 뜻이 아니다. 공유 관측이 없을 때 잘못된 설정/검사 실패/순회 제한 도달은 unresolved며 none_observed로 대체하지 않는다. 최대2000개 소비자 행을 검사하며 상한 초과는 unresolved다. 임의 외부 파일을 열어 소비자를 검사하지 않는다. none_observed는 알려진 두 종류의 검사 범위에서 미관측이며 외부 프로세스/metadata 밖 소비자 부재 증명이 아니다.

FileRefresh의 sourceId별 queued/running 또는 해제되지 않은 leaseToken/leaseUntil·미지원 상태는 refresh=active_or_unresolved다. 만료 lease도 자동 회수하지 않는다. 실패/중단/완료 기록은 열린 lease가 없을 때만 none_observed다. 파일은 읽기 검사 전후 신원을 대조하되 동시 외부 변경을 완전히 동결하지 않는다. 모두 executionAvailable=false다.

## 화면·복구

기존 소유자 전용 접힌 연결 검토 안에 ‘파일·갱신 상태 확인’ 명시 버튼과 선택 소스별 결과를 제공한다. 파일 확인/공유 사용처/갱신 주의를 일반 용어로 표현하며 상세 한계는 접는다. source 없는 요청의 빈 상태를 안내한다. 이전 결과는 요청/조직/고정 기준 변경·접기·재조회 시작/실패 시 제거하고 늦은 응답을 폐기한다. 요청 번호·기존 선택은 보존하며 자동 실행/자동 복구/새 의향 생성은 없다.36px 버튼/32px 도구·390/768/1440 입력16/16/14px·가로 넘침과 정렬을 확인한다.

## 검증·종료

BE 보호 HTTP와 실제 임시 파일의 존재/등록/ready/누락/손상/경계/symlink/hardlink/버전 일부 실패·소비자/순회 제한·활성/만료 lease·권한/metadata 재검사·쓰기0를 SQLite/로컬 Docker MySQL에서 선택 검증한다. FS 실패를 성공값으로 덮지 않는다. FE shape/소유 범위/실패·늦은 응답·입력 보존을 검증하고 Ego 실제 파일 조회→실패/재시도→reload·모바일을 확인한다. 독립 검토 후 현재 branch에 commit/push한다. 운영/실휴대폰·실제 이전/탈퇴·전역 의존성·최종 동의/CAS/영수증·전체16개/TC050은 Open이다.
