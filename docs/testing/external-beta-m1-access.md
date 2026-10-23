# 외부 베타 M1 — 초대 가입·대기자 증빙

2026-10-24 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M1의 "초대 가입" 단위다. 쿼터·사용량 원장, 사용자 간 데이터 격리 증명, 공개 링크 노출 통제는 이 단위가 아니다.

## 산출물

- `backend-api/src/access/`: `InviteCode`(코드 해시만 저장, 최대 사용 횟수·만료·회수), `InviteRedemption`(누가 어느 코드로 가입했는지), `WaitlistEntry`, `AccessService`, `GET /v1/access/signup-mode`, `POST /v1/access/waitlist`(공개·멱등), 운영자 CLI `access-cli`(`invite create|list|revoke`, `waitlist list|approve|reject`), 마이그레이션 `1792700000000-add-invite-access`.
- `SIGNUP_MODE=open|invite|closed`: 운영 기본값 `invite`, 그 외 환경은 `open`(개발·CI 흐름 유지), 알 수 없는 값은 `closed`로 닫힌다. 운영 부팅 가드는 알 수 없는 값을 거부한다.
- 가입(`POST /v1/login/signup`)은 `inviteCode`를 받는다. 자리 사용과 계정 생성은 한 트랜잭션이다(실패하면 자리를 돌려준다). 가입 10/분, 로그인 20/분, 대기자 5/분의 클라이언트 주소별 한도.
- 프런트엔드: 가입 화면이 모드를 조회해 초대 코드 입력(`?invite=` 미리 채움)·대기자 등록·닫힘 안내를 보여 주고 로그인 화면은 운영 모드에서도 가입 링크를 보인다.

## 실행 결과

| 검사 | 결과 |
| --- | --- |
| `src/access` + `src/login` + `src/config` (SQLite 실DB) | 6 suites 57 tests PASS(신규 `access.spec.ts` 포함). 코드 해시만 저장, 코드 없음/모름 거부, 가입 시 자리 1개 사용과 사용 기록, 사용 소진·만료·회수·미지의 코드가 **같은 403 응답**, 동시 5건 중 정확히 1건만 마지막 자리 획득, 신원 충돌 시 자리 미소모, 계정 INSERT가 실패하면 자리 반환, closed/open 모드, 대기자 멱등·정규화·형식 오류 400, CLI 전 명령 |
| `access.mysql.spec.ts`(MySQL 8.4, 옵트인) | 2 tests PASS. 마이그레이션이 만든 세 테이블의 열·타입·기본값·인덱스가 엔티티 동기화 스키마와 동일(처음엔 `datetime` vs `datetime(6)` 불일치가 나와 마이그레이션을 고쳤다). 12건 동시 트랜잭션 중 정확히 `maxUses`(3)건만 성공, 롤백 시 자리 반환 |
| `tsc`(백엔드·프런트엔드), eslint | 통과 |
| 프런트엔드 `SignUp/` | 11 tests PASS: 오류 매핑 5, 모드별 화면 6(초대 필드·미리 채움·공백 제거·코드 없으면 제출 안 함, open 모드에 필드 없음, closed는 대기자만, 모드 조회 실패 시 초대 필드 유지, 거부 메시지) |
| 컴포즈 스택(실제 이미지, Caddy 경유, Linux VM) | `/v1/access/signup-mode`=`invite`. 코드 없는 가입 403 `INVITE_REQUIRED`. 컨테이너 안 CLI로 만든 코드로 가입 201, 같은 코드 재사용 403 `INVITE_INVALID`, 가입한 계정으로 로그인 201. 대기자 같은 주소(대소문자만 다름) 두 번 모두 202에 항목 1건, 잘못된 주소 400. CLI로 승인해 받은 1회용 코드로 가입 201, `invite list`에 코드는 나오지 않음. 가입을 반복하면 7번째 이후 429, `X-Forwarded-For`를 위조해도 계속 429. `SIGNUP_MODE=closed`로 바꾸면 모드 조회 `closed`, 가입 403 `SIGNUP_CLOSED` |
| 403 응답 형태 | `data.error`에 코드가 담겨 프런트엔드 매핑(`signupErrorKey`)과 일치 |

## 한계 (미실행·미검증)

- 실제 브라우저에서 가입·대기자 화면을 열어 보지 않았다(390/768/1440 폭, 한국어/영어). 화면은 jsdom 컴포넌트 테스트로만 확인했다.
- 이메일 발송이 없어 코드는 운영자가 직접 전달한다. 이메일 인증, 비밀번호 정책 강화, 가입 시 약관 동의는 하지 않았다(법무 항목은 M-1).
- 한도는 프로세스 메모리의 `@nestjs/throttler` 저장소이므로 단일 인스턴스에서만 의미가 있다. 사용자별(계정별) 한도는 M1 후속(쿼터 단위)이다.
- 관리 화면·관리자 HTTP API는 만들지 않았다(공격면을 줄이려고 CLI만 둔다).
- 코드 입력 무차별 대입 방지는 128비트 무작위 코드와 가입 한도에 의존한다(코드 자체의 시도 횟수 잠금은 없다).
- 마이그레이션이 1건 늘어(54건) 이전 증빙의 "53건" 수치는 그 시점의 값이다. `migrate-prod` 빈 DB 부트스트랩 재실행은 이 단위에서 하지 않았다.
- `audit`(전체 백엔드·프런트엔드 스위트)와 `architect` 검토 결과는 이 문서 작성 시점에 아직 없다.
