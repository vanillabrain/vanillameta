# UC051 인계 후 조직 탈퇴 확정 검증

Status: Selected verification passed; full acceptance Open

[설계](../plans/UC-051-staff-departure.md)·UC051 A10/BR-051-11·TC050 E02/E03을 따른다. 본인 명시 요청과 다른 현재 admin의 최종 실행을 분리하고 User 계정/원본/역사를 보존한다. 법적 퇴사/계정 삭제·운영/실기기·전체16개 수용과 구별한다.

## 실제 fixture 준비와 검토

새 owned QA runtime/가상 계정만 사용한다. 일반 signup이 만든 본인 SQLite 샘플은 인계 지원 범위 밖이므로 예외 처리하지 않았다. 이 새 fixture의 정확한 본인 샘플 Dashboard→Widget/Dataset→Source를 기존 보호 삭제·파일 cleanup API로 명시 정리하고 완료를 확인했다. 실제 사용자/과거 영구 fixture는 건드리지 않았다. 초기 harness의 문자열 DELETE 응답 JSON 파싱 오류는 현재 상태를 재조회한 뒤 남은 단계만 이어갔으며 업무 쓰기를 재전송하지 않았다.

그 뒤 일반 CSV upload 두 소스·정상 AI 저장/Studio 저장 두 분석과 지표를 만들고 기존 묶음 인계 API로 수신자에게 최종 이전했다. 이 인계는 배경 API fixture이며 이번 Ego 최종 탈퇴 여정의 화면 증거로 승계하지 않는다. 본인 잔여 Source/UserMapping0을 확인했다. admin 소유의 별도 샘플에 직접 read·그룹 가입/그룹 read·개인/그룹 전달 관계를 만들어 실제 회수 대조를 준비했다. `/database/info`는 owner 전용이므로 read grant의 증거로 사용하지 않고 보호된 capabilities와 Dashboard 조회 성공으로 접근을 확인했다.

보존 기준은 위 준비/명시 정리·인계 이후 탈퇴 직전이다. 새 샘플 정리의 의도적 삭제를 탈퇴의 삭제로 계산하지 않는다. 비공개 증빙은 Git 제외 `.aiwf/evidence/UC051-staff-departure/`에 보관하고 corporate 원문/사적 경로/credential을 공개하지 않는다. Node22 실행과 요구 Node24/운영 수용을 구별한다.

설계 별도 검토에서 일반 빈-layout Dashboard 생성이 User/epoch 잠금 없이 새 소유 mapping을 넣는 경합을 지적했다. 이 경로의 현재 신원 fence와 실제 두 연결 선후 관계를 필수 보완 대상으로 포함했다. 추가로 Studio 실행 접수의 User/epoch fence 누락을 확인해 보완했다. 두 경로 모두 현재 User→Dashboard→Source 순서와 대기 뒤 신원 검사를 따르며, 외부 AI 실행 전에 접수 transaction을 끝낸다.

## 최종 선택 실행

- Docker MySQL8.4.11 고정 `node scripts/verify-semantic-mysql.cjs --departure`: 4 suites, **78 PASS / 1 SKIP**. 영향 조회·실제 탈퇴 서비스·Dashboard 생성·Studio 접수의 두 연결 경합을 포함한다. owned container/임시 credential을 정리했고 persistent volume은 만들지 않았다.
- SQLite 및 lifecycle 후속 선택: 6 suites, **145 PASS / 11 MySQL 전용 SKIP**. 이전 MySQL/SQLite 배치와 합산하지 않는다.
- FE 서비스/저장 복구/표시/통합: 6 files **120 PASS**. 이후 조회 UUID와 본인 생성 폼을 분리한 컴포넌트 **26 PASS**는 앞 배치와 겹친다. type/scoped lint·BE/FE build가 통과했다.
- 별도 수정 검토: 기존 Dashboard 생성 HIGH·Studio 접수 MEDIUM을 보완 후 해당 범위 APPROVE, 추가 consequential finding 0. 사람 수용/운영 승인과 구별한다. Studio 전용 경합은 실제 접수와 grant 정책을 호출하고 탈퇴 User fence를 모사하므로 실제 탈퇴 서비스 통합 테스트와 구별한다.

## Ego109 실제 화면

한 TaskSpace/p1에서 가상 계정으로 본인 요청의 통신 실패→reload→UUID 보존→현재 기록 확인→동일 요청 재시도를 수행했다. 다른 admin으로 로그인해 남은 소스 1개 때문에 확정 UI가 차단됨을 확인했다. 그 소스를 별도 지원 인계 API로 수신자에게 이전한 뒤 잔여 9종 0건을 재조회했다.

최신 검토 조회 실패는 UUID를 보존하고 record/review를 해제한다. 현재 기록 조회→최신 잔여 검토로 복구했다. 최종 동의 후 offline POST 미전달→reload→현재 기록 확인→별도 재시도 동의→같은 UUID/입력의 확정 POST201·완료 v2를 확인했다. admin reload 재조회, 탈퇴 본인의 정상 재로그인→소속 없음→본인 과거 영수증 조회/reload도 통과했다. 조회 중 다른 직원의 본인 생성 폼이 섞이지 않도록 숨기고 명시적인 새 작성 버튼으로 초기화한다.

390/768/1440px에서 재시도·본인 완료 영수증의 가로 넘침 0, 입력/주요 버튼36px·접기32px, 입력16/16/14px를 실측하고 캡처를 검토했다. 390px 조회 버튼은 입력 아래로 접히며 768/1440px는 같은 top이다. 수신자 대시보드 reload 후 합계500·시간별 추세·채널 차트, Studio의 두 블록/저장 상태를 확인했다. 수신자 보기 3폭의 가로 넘침도 0이다. 실제 휴대폰 터치/전 상태 조합 검증은 아니다.

## 보존·권한 대조

탈퇴 직전/직후 70개 테이블을 읽기 대조하고 HTTP까지 **124 assertions**를 확인했다. 58개 일반 테이블은 원본 동일성 또는 append-only 이력 보존 대상으로 검사했으며, 나머지는 의도한 User epoch/session·Membership·조직/그룹 버전·관계 회수·요청/감사 변경만 허용했다. `login_history`에는 화면 reload의 `/userinfo` 접근 1건이 추가됐고 기존 행은 유지됐다. 따라서 모든 테이블 불변으로 표현하지 않는다. 관리 파일12개의 경로·bytes hash·크기·mtime은 동일했다.

기존 액세스/갱신 token401·명시 direct/group 소스/받은 대시보드403, 새 로그인/본인 과거 영수증200·소속 null, 현재 원 조직 admin200·일반 직원/타 조직403을 확인했다. 정확한 완료 replay는 추가 epoch/감사 변경0이었다. 다른 구성원에 대한 admin 소유 그룹 권한/전달은 유지하고 탈퇴자 가입만 제거했다. 수신자의 인계 분석/Studio 응답은200이며 원본/문서/파일은 보존됐다. 인증용 값과 원본 경로는 공개 증빙에 넣지 않는다.

## 종료 범위

이는 인계 후 조직 Membership 탈퇴 단위다. 개인 계정 삭제나 법적 퇴사, 임의 외부/활성 공유 자산의 인계, 모든 writer/운영 migration·Node24·실기기·전 역할 행렬·전체16개/TC050 수용 완료를 뜻하지 않는다. AIWF 문서는 Draft, review packet은 awaiting_review/acceptance not_recorded로 유지한다.
