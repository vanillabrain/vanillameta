# UC051 소스·연결 대시보드 묶음 인계 검증

Status: Implemented slice; full acceptance open

[설계](../plans/UC-051-bundle-handover.md)·UC051 A9/BR-051-10·TC050 E02/E03을 따른다. 기존 단독 인계를 약화하지 않고 소스/연결 대시보드 각각1개 이상·전체2~20개의 별도 최종 동의·원자 소유권 변경/영수증을 제공한다. 운영/실기기/퇴사·전체16개 수용과 구별한다.

## 실제 fixture와 검토

공개 합성 CSV를 일반 HTTP upload로 두 소스에 가져왔다. 한 소스에 동일 데이터 file-replacement도 호출했으며 기존 중복 감지가 unchanged로 처리해 새 버전을 만들지 않았다. 이번 실제 화면의 소스별 등록 파일은 각각1개이며 과거 버전 보존을 이 화면으로 과장하지 않는다. 실제 AI 저장 API로 숫자+채널 차트 대시보드 두 개를 생성하고 Studio 저장으로 문서/블록/폭별 배치를 저장했다. 구조화 지표2개도 정상 BI API로 생성했다. 실제 LLM 요청은 실행하지 않았다. 기존 제목 의향 수락은 배경 API 준비이며 최종 동의/실행은 Ego에서 별도로 검증한다.

Studio 재저장은 이전 미연결 Widget/Dataset을 남긴다. 이를 지워 검증을 통과시키지 않고 현재 canonical 정의와 같은 소스/검증 SQL·컴포넌트/제목/설명/옵션이며 단독 소비자·외부 연결0인 동등 정의만 별도 검사/잠금/hash에 포함한다. 다른 고아/공유/모호한 참조는 계속 차단한다. 초기 fixture의 원본 파일명/의향 제목 불일치는 이름 확인409로 거절됐고 정상 업로드 응답 이름으로 새 fixture를 준비했다. 이전 owned fixture를 임의 삭제하지 않았다.

설계 별도 검토0건을 받았으며 구현 전체 독립 검토/최종 실행 결과는 아래에 기록한다. 사용자/기업 식별 원문·사적 경로·credential은 Git 제외 `.aiwf/evidence/UC051-bundle-handover/`에만 두며 공개 문서는 일반화한다. Node22.23.1 실행과 요구 Node24/운영 인증을 구별한다.

## 선택 실행과 독립 검토

- 실제 owned Docker MySQL8.4.11 고정 handover lane은313 PASS/4 SQLite 전용 SKIP,5 suites다. bundle/기존 단독/의향/DELETE 경계를 함께 검사했으며 컨테이너·임시 credential 정리/영속 volume0을 확인했다. 초기296/4 SKIP와 중복 합산하지 않는다.
- 최종 영향 SQLite bundle+DELETE는45 PASS/8 MySQL 전용 SKIP다. 별도 DELETE 서비스/컨트롤러 선택20 PASS/3 SKIP·전용 MySQL17 PASS, 초기 bundle31/5 SKIP와 겹치는 배치다.
- FE 계약/스토리지/최종 패널/부모176 PASS, BE/FE type·scoped lint·build를 확인했다. bundle은 실제 AI-save→Studio-save로 남는 동등 자식과 수신자 Studio 재조회를 포함한다.
- MySQL의 실제 두 연결 대기에서 source 기준 선행 변경409·retained Widget/Dataset fence·늦은 source metadata 거절을 확인했다. DELETE는 guard를 먼저 통과한 구 소유자가 User/Dashboard/Source/자식 잠금을 기다린 후403이 되도록 현재 actor/epoch/owner를 transaction 안에서 검사한다. DELETE 단위는 같은 소유 이전 잠금의 제어된 fixture이며 전체 bundle 서비스 호출 경합과 구별한다. 모든 raw writer·운영 경합 보장은 아니다.
- 전체 패치29개 파일 독립 검토는 잔여0/APPROVE다. 검토자는 type/lint·정적 경계를 확인했고 Main의 runtime/Ego를 재실행하지 않았다. 이후 권한 거절 안내의 FE 수정은 아래 별도 후속 검토/실행을 따른다.

## Ego108 실제 화면과 API 보존

한 TaskSpace의 p1에서 실제 로그아웃/로그인으로 양쪽 역할을 전환했다. 동시 독립 로그인 탭으로 표현하지 않는다.

1. 원 소유자의 정상 대시보드에서 합계500·숫자 아래 시계열/채널 차트를 확인했다. 혼합 의향에는 묶음 패널만 표시했다.
2. 조건 조회의 offline 실패가 원 요청을 보존했고 online 명시 재조회로 준비 가능 상태를 복구했다.
3. offline 준비의 미전달은 같은 UUID/입력을 탭에 보존했다. online→reload→원 의향 명시 조회→묶음 상태404 뒤에만 같은 UUID 재시도를 허용했다. 자동 새 요청/이전은 없다.
4. 수신자 로그인→명시 상태조회/별도 체크→최종 수락201, 소유자 로그인→최신 상태/별도 체크→전체 실행201·완료version3을 실제 XHR로 확인했다. reload→명시 조회는 같은 완료 기록/최종 체크0·추가 실행0이다.
5. 보호 API44회와 저장/파일 대조를 포함한274개 assertion을 확인했다. 구 소유자의 같은 JWT로 source profile/metrics/info/file versions와 Dashboard/Studio/Widget/Dataset 요청은403, 수신자의 대응 요청은200이다. 양쪽 과거 영수증200·admin/타 조직403이다. 정확 완료 replay1회201/replayed=true 뒤 영수증·전체 감사 행 불변을 확인했다.

전체 fixture의 Source9·Metric4·Dashboard8·Studio4·mapping8·DashboardWidget16·Widget124·Dataset28행을 이전 전후 대조했다. 허용 변경은 선택 source owner/catalogVersion+1·선택 mapping의 소유 actor·Dashboard assetVersion+1·Studio legacyRevision과 관련 수정 시각이다. 현재/보존 자식 ID·정의/SQL·원본 config·문서 bytes/블록/모든 폭 배치는 그대로다. 현재 카탈로그/조건 이력 행은0이므로 실제 과거 업무 이력 보존을 이 fixture로 주장하지 않는다. 관리 파일16개의 상대 경로/bytes/SHA256/mtime은 전체 동일하며 파일 복사/이동/chown/삭제는 없다.

복구/완료390/768/1440에서 주요 버튼36px·접기32px, 가로 넘침0·완료 최종 체크0을 실측했다. 요청 입력36px·16/16/14px,768/1440 입력·버튼 top 차이0px,390의 세로 배치는44px(36높이+8간격)이다. 복구390/완료 세 폭 screenshot을 실제 열람했다. 상세 대시보드와 Studio의 수신자 후속은 아래를 따른다. 운영 MySQL 앱 화면·실휴대폰/멀티터치·외부 연결/활성 공유·퇴사/전체16개/TC050 수용은 열려 있다.

수신자 실제 대시보드는 reload 후 합계500·숫자 아래 시계열과 채널 차트를 표시했고 Studio 편집 화면도 원 문서/두 블록을 읽었다. 화면 폭 변경 직후의 첫 DOM 계측에는 ResizeObserver 반영 전 일시 가로 크기가 남았다. 준비 완료된 레이아웃 조건을 기다린 후 재계측한390/768/1440은 모두 clientWidth=scrollWidth·500/추세 유지였고 세 폭 screenshot을 실제 열람했다. 초기 순간 캡처를 삭제하거나 회귀 성공으로 승계하지 않는다. 이 검증은 새 편집/저장을 실행한 것은 아니며 원본 보존 대조 이후 추가 업무 쓰기0이다.

## 권한 변경 안내 후속

구 소유자 GET403의 초기 상세 화면은 일반 조회 실패/재시도 안내와 빈 제목의 수정·공유 도구를 표시했다. 현재 접근권이 바뀐 경우의 고정 권한 안내로 바꾸고 과거 데이터·편집/공유/삭제·재조회 도구를 숨겼다. 자동 이동하지 않으며 같은 화면의 반복 조회도 중단한다. 초기 DashboardView 선택8개·type/lint/build를 통과했고 다음 관리 경로 보완은12개를 다시 확인했다. 인계 패널176개와 범위가 다르므로 전체 FE 통과 수로 합산하지 않는다.

Ego108에서 구 소유자로 다시 실제 로그인해 같은 대시보드를 열고 reload했다.390/768/1440 모두 명확한 권한 변경 안내·과거 내용/수정·공유/삭제/재조회 도구0·불필요한 dialog0·가로 넘침0을 확인했고 모바일 screenshot도 실제 열람했다. 수신자의 정상 조회는 이전 후속에서 별도 확인했다. AIWF packet은 awaiting_review/acceptance not_recorded이며 운영/실기기/업무 수용을 대신하지 않는다.

독립 후속 검토의 MEDIUM1건은 일반 상세403이 현재 소유자의 UC055 삭제 검토 진입까지 숨긴다는 회귀였다. 본문 접근권과 관리권을 구분해 보호된 delete-impact가 현재 소유자를 확인했을 때만 삭제 영향 확인을 제공한다. 계정/대상 변경·실패·늦은 응답은 이 관리 진입을 열지 않는다. DashboardView 최종12개·type/lint/build를 통과했으며 초기8개와 중복 합산하지 않는다. 실제 인계 후 구 소유자의 delete-impact403/수신자200도 읽기 전용으로 대조했다. 소스 비활성의 소유 관리 경로는 컴포넌트 회귀이며 이번 실제 UI에서 소스를 비활성화한 것은 아니다.

관리 경로 보완의 집중 재검토에서 MEDIUM 해소/잔여0·APPROVE를 받았다. 최종 구 소유자 reload/390·768·1440은 권한 안내·편집/공유/삭제 영향 확인0·dialog0·loading 비노출·가로 넘침0이며 최종 모바일 screenshot을 실제 열람했다. 초기 화면의 로딩 전환 캡처와 잘못된 기다림 selector의 timeout은 별도로 보존하고 최종 통과로 승계하지 않는다.
