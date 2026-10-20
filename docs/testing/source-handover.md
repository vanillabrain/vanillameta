# UC051 소스·파일 자체 인계 검증

Status: Implemented slice; full acceptance open

[설계](../plans/UC-051-source-handover.md)·[UC051 A8/BR09](../use_cases/UC-051-manage-enterprise-access.md)·[TC050 E02/E03](../test_cases/TC-050-enterprise-analysis.md)를 따른다. source-only 관리 DuckDB 파일의 앱 관리권을 별도 양쪽 최종 동의로 이전한다. 파일의 OS 소유자/위치/bytes 변경·외부 연결·대시보드 혼합·직원 퇴사·전체16개 수용과 구별한다.

## 검증 상태

실제 DuckDB import3개(두 소스의 현재2/과거1)와 BI 구조화 지표2개·일반 가입/편입 API의 가상 계정을 준비했다. 기존 제목 의향 수락은 배경 API fixture이며 최종 준비/수락/실행은 Ego107 실제 화면으로 수행했다. 이 초기 fixture는 수동 FILE 유형이었으므로 최종 지원 계약의 정상 업로드 증빙으로 승계하지 않는다. 독립 검토가 실제 업로드의 duckdb 유형과 다른 판정을 발견해 수정했고 정상 HTTP 업로드를 별도로 준비했다.

기존 파일 관측이 기본 seed의 SQLite metadata DB 연결을 미지원 소비자로 반환함을 확인했다. 사용자/검증 데이터를 지우거나 unknown을 정상값으로 바꾸지 않고, 서버에 설정된 정확한 SQLite metadata 파일만 제한된 NOFOLLOW 신원 비교 대상으로 다룬다. 그 외 미지원 소비자는 계속 차단하며 원본 내용이나 경로를 공개하지 않는다. 관리 루트 밖 임의 파일 열기/재귀 순회로 확대하지 않는다.

비공개 증빙은 Git 제외 `.aiwf/evidence/UC051-source-handover/`에 보관한다. 공개 합성 자료만 사용하며 기업/고객 식별 원문·사적 출처 경로·credential은 공개 커밋에 포함하지 않는다. Node22.23.1 실행과 요구 Node24/운영 검증을 구별한다.

## 설계·독립 검토와 선택 실행

Source 부모 아래 현재 소유권과 양쪽 계정/조직/epoch·고정 manifest/파일 proof·최종 기한을 재검사해 전체 소스의 ownerId와 catalogVersion만 함께 변경한다. 같은 완료 replay는 쓰기0이며 기존 지표·파일·이력을 재작성하지 않는다. 파일 복사·OS chown·자동 삭제·이미 전달한 데이터/진행 SQL 회수는 범위 밖이다. 미지원/공유/사용 중/불명확한 파일은 차단한다.

갱신 접수는 User→Source 잠금 뒤 소유권을 다시 확인한다. bounded admission marker 검사는 관리 root·refresh-input·UUID 디렉터리와 marker symlink를 거절하고 NOFOLLOW/최대513-byte·전후 신원을 대조한다. 실제 MySQL 두 연결의 갱신 접수/권한 writer/소스 metadata writer 대기를 검증한다. 모든 raw writer·운영 파일시스템 경합 보장으로 확대하지 않는다.

- 실제 owned Docker MySQL8.4.11 선택 lane 최종260 PASS/4 SQLite 전용 SKIP(3 suites), 별도 HTTP 업로드 회귀를 포함한 SQLite46 PASS/3 MySQL 전용 SKIP(1 suite)다. 초기 MySQL256·SQLite259/15 SKIP와 겹치므로 합산하지 않는다. 컨테이너·임시 credential·volume 정리를 확인했다.
- FE 서비스/탭 복구/최종 패널/부모 초기138 PASS와 유형별 패널 후속32 PASS는 겹친 범위다. BE/FE type·scoped lint·build를 확인했다.
- 전체 패치 독립 검토의 업로드 유형 HIGH를 수정했고 집중 재검토 APPROVE/잔여0이다. 검토자는 runtime을 재실행하지 않았으며 Main 실행과 구별한다.

## Ego107 실패·복구·별도 동의

소유자가 통신 실패 후 명시 재조회하고, hardlink가 있는 동안 파일 공유 blocker로 준비를 막는 것을 확인했다. owned QA alias만 제거했다. offline 준비는 UUID/입력이 탭에 보존되며 online→reload→원 의향 조회→최종 상태404 후 같은 UUID 재시도로 준비한다. 새 UUID 자동 생성·자동 실행은 없다. 실제 로그아웃/로그인으로 수신자 별도 최종 수락→소유자 최신 상태·별도 실행→완료version3→reload 재조회를 확인했다.

초기 완료 화면390/768/1440은 주요 버튼36px·접기32px·글자14px, clientWidth375/753/1425와 scrollWidth가 같고 완료 최종 체크0이다. 모바일 screenshot을 실제 열람했으며 실휴대폰/멀티터치 검증이 아니다. 정상 HTTP 업로드의 최종 빌드 여정과 권한/원본 보존 결과는 아래 후속 기록으로 구분한다.

## 최종 빌드 정상 업로드 후속과 보존 대조

HTTP `/database/upload`의 일반 CSV 업로드로 만든 소스304는 실제 `type=duckdb`·암호화 connectionConfig·등록 manifest를 사용한다. 최종 빌드 재시작 뒤 Ego107에서 조건 검토→별도 준비→수신자 실제 로그인/최종 수락201→소유자 실제 로그인/최종 실행201→완료version3→reload/명시 재조회를 확인했다. 초기 FILE fixture의 지원 판정은 최종 계약으로 승계하지 않는다. 실제 업로드 HTTP 회귀도 파일/config를 보존한 최종 이전을 검증한다.

초기 두 소스의 보호 API·원본 대조58개를 확인했다. 같은 구 소유자 token의 profile/metrics/database info/file versions8개는403, 수신자의 대응8개는200이다. 양쪽 과거 영수증200·admin/타 조직403이다. 정확 완료 replay1회201/replayed=true 뒤 source/Metric/영수증·감사11행은 불변이다. source 모든 열은 owner/catalogVersion+1/허용 수정 시각 외 동일하고 Metric2행은 timestamp/정의까지 동일하다. 최초 관리 파일13개의 상대 이름/bytes/SHA256/mtime도 불변이다. 이후 일반 업로드로 추가된6파일을 포함해 디렉터리 전체 개수 불변을 주장하지 않는다. 최초 harness의 감사 verb/전체 폴더 수 가정 오류는 같은 캡처로 교정했으며 replay를 중복 전송하지 않았다.

최종 업로드 준비/완료390/768/1440에서 가로 넘침0·주요 버튼36px/도구32px를 실측했다. 요청 입력은36px/16·16·14px,768/1440 입력과 버튼 top 차이0px,390은 세로 배치44px(36높이+8간격)이다. 완료 최종 체크0이며 세 폭 screenshot을 실제 열람했다. 실휴대폰·운영 MySQL 앱 화면·퇴사/탈퇴·실사용 관계가 있는 자산 통합 인계·전체16개/TC050 수용은 열려 있다. AIWF packet은 awaiting_review/acceptance not_recorded를 유지한다.

정상 업로드304의 최종 읽기 전용 API 후속18개도 통과했다. 구 소유자4종403/수신자4종200·양쪽 완료 영수증200/admin·타 조직403이며 추가 POST/replay0이다. 초기58개 보존 대조와 범위를 나누어 기록한다. 선택 UC051/TC050 lint는 각각0이고 전체 strict lint는 기존17오류/5경고가 남아 별도 gate다.
