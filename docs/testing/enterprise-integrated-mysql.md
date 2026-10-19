# TC050 실제 MySQL 전체 앱 통합 — 선택 업무 여정

2026-10-19 · Draft / PASS_SELECTED. [계획](../plans/TC-050-integrated-mysql.md)·[최신 잔여표](enterprise-acceptance-audit.md). 전체16개·TC050 E01~E14 전체 수용·운영/사람 승인은 Open이다.

## 환경과 범위

새 소유 표식·랜덤 credential·loopback·tmpfs의 Docker MySQL8.4.11에 **실제 Nest HTTP 서버 전체**와 Vite/Ego114를 연결했다. native DuckDB 파일의 실제 집계를 사용했다. 기존 service-only MySQL/SQLite UI 증빙과 구분한다. 새 빈 schema의 development synchronize로69개 테이블을 준비했으며 운영 migration 검증이 아니다. 빈 DB에 필요한4종 Component는 기존 보호 seed API로 준비했다. Node22.23.1이며 Node24/운영 버전 수용을 뜻하지 않는다.

주 데이터는 날짜3개·region A/B·amount100/200/300의 합성 CSV다. 수신자 본인 소스는 같은 열/형식의200/400/600이다. 테스트에서만 만든 다른 조직과 같은 조직 admin/member를 사용했고 기업자료·외부 원본·익명 게시를 사용하지 않았다. 처음 입력 제한을 넘은 QA 로그인 fixture는 짧은 별도 계정으로 수정했다. 처음 만든 fixture와 최종 실행을 섞어 고유 계정 수나 테스트 수를 완료율로 환산하지 않는다.

## 연결한 여정

| 단계        | 실제 검증                                                                | 결과                                                                                  |
| ----------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 연결/질문   | HTTP 업로드→Ego 저장 지표 선택→한국어 질문→Codex CLI 경로 제안           | 저장 Revenue v1을 두 블록에 재사용, 합계600과 날짜별100/200/300                       |
| 저장/복원   | Ego 전체 미리보기→명시 비공개 저장→새로고침                              | 원본 대시보드1·숫자/시계열2블록·저장 지표 참조 보존                                   |
| 사내 공유   | 같은 조직 source read/export 부여와 별도 allowCopy 전달→수신자 받은 자료 | 실제 HTTP와 Ego의 받은 자료/복제 진입 확인. 다른 조직 GET403                          |
| 독립 복제   | 수신자 본인 소스 매핑→전체 미리보기→저장/replay                          | HTTP 사본2·같은 UUID 추가 생성0, Ego 사본3·새로고침. 수치1200과 새 ID/본인 소스       |
| 조회/출력   | 전체 기간과 고정 하루의 직전 기간 비교→영속 CSV                          | 전체600; 현재300/이전200/증감100/50%. 별도 Decimal 원본 합계·HTTP·CSV 일치            |
| 개인 보관   | 사본2 HTTP 보관/복원, 사본3 Ego 보관→새로고침→보관함→복원                | 목록 상태만 변경, 원본/저장 문서/직접 접근 보존                                       |
| 서버 재시작 | 실제 API 새 PID→같은 MySQL/파일→GET·Ego 새로고침                         | 원본1/사본2·3/완료 파일1·2 보존, CSV bytes 동일                                       |
| 회수        | 원본 공유·source 권한 회수 후 현재 요청                                  | 수신자 원본403, 독립 사본2·3의 본인 접근/1200 유지. Ego에서도 차단과 사본 재조회 확인 |

질문은 “저장된 Revenue 지표를 재사용해서 amount 합계 숫자 하나와 day 날짜별 amount 합계 선 차트 하나를 만들어 줘. region으로 분류할 수 있게 하고, 아직 저장하거나 게시하지 마.”였다. 실제 `POST /studio/proposals`201은 약7.9초였고 이어서 별도 저장201을 확인했다. 모델 fixture/수동 SQL 응답으로 대체하지 않았다. 코드가 요청한 모델은 gpt-6-luna이며 공급자의 실제 사용 모델을 별도로 attestation한 것은 아니다. 이번1개 질문을 모든 자연어/복합 조건 수용으로 확대하지 않는다.

첫 통합 driver의 최종 불변 비교는 매 GET마다 달라지는 관측값 `queriedAt` 때문에 실패했다. 최초 로그를 보존했고 그 필드만 제외한 정의·revision·결과의 읽기 전용 재확인으로 원본 불변을 확인했다. 이미 확정된 저장/공유를 무작정 재전송하지 않았다. 사본2는 API, 사본3은 별도 명시 UI 실행이며 같은 요청의 중복 생성으로 집계하지 않는다.

## 실제 화면과 수정

생성 미리보기·저장 사본·복제 매핑의390/768/1440 CSS폭을 실측/캡처했다. 페이지 가로 넘침0, 주요 버튼36px, 모바일 입력16px/desktop14px를 확인했다. 좁은 소스 열 표의 내부 스크롤은 페이지 넘침과 구분한다. 실제 휴대폰/네이티브 선택창 전체·스크린리더 수용은 아니다.

실제 매핑 화면에서 과거 `.studio-remix-field select` CSS가 공통 TextField/NativeSelect를44px·모바일14px로 덮는 차이를 확인했다. 크기/폰트/색상/포커스 중복 규칙을 제거하고 공통 UI Kit의36px·모바일16px/desktop14px를 쓰도록 보완했다. 최종 세 폭에서 매핑 열의 같은 너비/정렬과 넘침0을 확인했다. 기존 Remix/embedded11개·type/lint·CSS 구문·FE build를 확인했으며 무변경 BE 전체 suite는 반복하지 않았다.

## 검증 실행기

`scripts/qa-enterprise-mysql.cjs`는 새 소유 컨테이너/DB/파일만 만들고 실제 앱을 실행한다. 상태·DB신원·표식 확인, 임의 기존 DB 거절, loopback, 디렉터리0700/config0600, 로그 마스킹, 인증된 control API를 사용한다. 기존 운영 환경이나 user data를 정리하지 않는다.

실행기 리뷰에서 detached Codex가 API process group과 별도여서 정리에서 빠지는 P2를 발견했다. 테스트 전용 preload/IPC는 자신이 만든 detached group만 관측하고 drain에서 새 spawn을 막는다. 최대180초 이내 전체 group 소멸을 확인한 뒤 API를 종료한다. 불확실한 IPC/timeout/조기 API 종료에는 DB/파일 정리를 거절해 보존한다. 임의 PID를 종료하지 않는다. 유료 모델 호출 없이 실제 dummy detached child/손자 프로세스로 timeout 거절·추가 spawn 차단·leader 종료 뒤 대기·group 소멸을 확인했다. 통합 여정 당시 supervisor에는 이 후속이 소급 적용되지 않으며 실제 모델 요청이 끝난 뒤만 재시작/종료했다. 후속 실행기 자체도 새 임시 MySQL/69 tables로 실제 startup health200·인증 restart200/새 PID·stop200을 확인했다. 소유 process group·컨테이너·임시 credential 제거와 영속 volume0을 확인했으며 LLM 추가 호출은 없었다. 이 실행기 smoke와 앞의 업무 여정은 별도다.

## 증거와 남은 일

Git 제외 `.aiwf/evidence/TC050-integrated-mysql/`에 원 질문/제안·저장 XHR, 실제 runtime/DB 신원·PID, API/회수·CSV/Decimal oracle, 폭별 JSON/PNG, 최초 실패·정정·review/cleanup을 보존한다. 계정/토큰/DB credential은 public commit에 넣지 않는다.

이번에 연결한 정상 여정은 더 이상 “전체 Nest HTTP MySQL 미실행”으로 분류하지 않는다. 다만 E01~E14 전 변형·모든 역할/보호 경로/일반 writer, 중첩 부정/0행/0분모·전체 기간 경계, 알림 장애/계정·조직 사건 정책, 임의 비교 기간·지원 밖 인계 계약, 운영 migration/부하/백업·실휴대폰·실제 업무 정답/담당자 수용은 남는다. 후속은 이 잔여 중 권한 행렬과 AI/정답 변형을 우선하며 통과한 정상 여정을 이유 없이 반복하지 않는다.
