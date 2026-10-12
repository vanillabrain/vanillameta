# 인증 잔여 조건 — 2026-10-12

기준 `develop-v2 / fd583392`. 제품 코드 수정 없음. `vanillameta-verify`로 AUTH-01/05/06의 미완료 조건만 선택했다. 기존 dashboard/unknown smoke와 잘못된 암호 검증을 재사용했다. MVP 구현 10파일의 SHA256이 기존 verification-receipt와 일치해 빌드·단위·Rill·AI 성공 검사를 반복하지 않았다. Codex `gpt-6-luna` 설정 유지, 이번 인증 검증에서는 AI 호출 없음.

환경: API `http://127.0.0.1:4670/v1`, 웹 `http://127.0.0.1:3470`, MVP 격리 metadata.db 및 테스트 소유 계정. 실제 Chromium 1440×900. Aside guide/repl 확인 후 데몬 미실행으로 기존 허용된 headed 브라우저 대체. 다른 서버·사용자 계정은 변경하지 않았다.

| ID | 신규 실행 조건 | 결과 |
| --- | --- | --- |
| AUTH-05 | 기존 ID+새 이메일, 새 ID+기존 이메일 순차 가입 | 각각409, `conflict userId`/`conflict email`, 화면의 중복 안내 PASS |
| AUTH-05 | 중복 가입 전후 원 계정·저장 자산 보존 | 19테이블의 정렬된 전체 행 해시와 행 수 동일. 원 계정 로그인201, userinfo200 동일 사용자, commerce/1/report200. 순수입 `60030205.79` 유지 PASS |
| AUTH-06 | 미존재 계정, 정책에 맞는 암호 | 401, `ID 또는 비밀번호가 일치하지 않습니다.` 안내, 로그인 화면 유지. local/session accessToken null, 쿠키0 PASS |
| AUTH-06 | 위 거절 후 같은 페이지에 정상 원 계정 입력 | 로그인201, token 존재만 확인, dashboard 전환 PASS. 원 계정 보존 확인과 함께 한 번 실행 |
| AUTH-01 | 익명 root·widget/data/source/dataset/metric/file·commerce 경로 | 14개 모두 login 전환, 로그인 입력 표시. 보호 API 요청0 PASS |

익명 경로: `/`, `/widget`, `/widget/1`, `/widget/create`, `/widget/modify/1`, `/data`, `/data/source/create`, `/data/source/modify/1`, `/data/set/create/1`, `/data/set/modify/1`, `/data/metric`, `/data/file`, `/commerce`, `/commerce/1`. 이미 통과한 dashboard 및 unknown은 반복하지 않았다.

제품 오류 발견 없음. 초기 캡처는 snackbar 등장 애니메이션 중이어서 글자가 흐렸으며, 해당 캡처만 애니메이션 종료 상태로 보완했다. 터미널의 긴 입력이 잘리는 도구 문제가 있었고 자동 승인 검토가 빈 줄 입력을 거절했다. 별도 콘솔과 짧은 명령으로 복구했으며 제품 장애로 기록하지 않았다.

증빙 폴더: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/auth-remaining-2026-10-12`.

- `http-checks.json`: 실제 HTTP 상태, 공개 오류 본문, 토큰 존재 여부와 원 계정 집계. 인증값은 기록하지 않음.
- `db-before.json`, `db-after-duplicates.json`: 테이블별 행 수/해시만 기록, 원 행·암호 미포함.
- `anonymous-routes.json`: 경로별 실제 accessibility snapshot 및 API 요청 기록.
- `duplicate-id.png`, `duplicate-email.png`, `unknown-account.png`: 오류 안내 캡처.
- `anonymous-*.png`, `recovered-original-account.png`, `original-commerce-after-auth.png`: 차단·복구 및 원 자산 조회 화면.
- `browser-page-errors.json`: 제품 pageerror 0.

전체 집계는 완료105 / 부분 완료18 / 미검증0 (123 ID). 부분 완료 조건은 남아 있으므로 전체 회귀 완료를 뜻하지 않는다. 다음 P0는 DATA-08 실제 연결 암호 응답과 FILTER-01 신규 필터 API 타계정 차단이다. 순차 중복 가입 명세를 동시 경합 안전성으로 확대하지 않는다.
