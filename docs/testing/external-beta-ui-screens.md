# 외부 베타 전 화면 검증

2026-10-24 · develop `9da87fe0`(푸시 전 로컬). 사용자 요청: 배포 전에 각 화면을 스크린샷으로 남기고 실제 화면으로 검증한다. 운영과 같은 구성(`NODE_ENV=prod`, `SIGNUP_MODE=invite`, `ALLOWED_SOURCE_TYPES` 기본 `file,sample`, `AI_PROVIDER=openai`·`AI_API_KEY` 없음)의 compose 스택(web, api, migrate, mysql)을 개발 머신의 colima VM에 올리고 Ego 브라우저로 조작했다. 이것은 **운영 VM·도메인·TLS·실제 LLM이 아니다.** 일회용 시크릿·계정이며 검증 뒤 스택과 볼륨을 삭제했다.

캡처는 [images/external-beta-ui/](images/external-beta-ui/)에 있다. 데스크톱 캡처는 창 폭 1440 또는 1800 CSS px로 찍혔고(에뮬레이션이 페이지 이동 뒤 유지되지 않는 경우가 있었다), 가로 넘침은 `innerWidth`와 `scrollWidth`로 따로 쟀다. 모바일은 390px 에뮬레이션이며 실기기가 아니다.

## 결과 요약

| 구분 | 결과 |
| --- | --- |
| 막힘(출시 불가) | Studio AI 생성이 운영 구성에서 동작하지 않는다 |
| 고쳐야 할 화면 문제 | 막힌 외부 DB 연결 시도가 화면에 아무 메시지도 남기지 않는다 |
| 확인 후 결정 | 공개 링크 만료 기본값, 게시 화면이 두 종류, 샘플 목록의 외부 제품 표기 |
| 사소한 것 | 가입 제목 띄어쓰기, 잘못된 복제 링크의 일반 오류 문구 |
| 통과 | 가입(초대·대기자) → 로그인 → 파일·샘플 → 지표·대시보드 → 게시 → 익명 열람 → 복제 → 내 소스 연결 → 비공개 저장 |

## 발견

**F1. Studio AI 생성이 운영 구성에서 불가능하다(차단).** 화면: [studio-propose-result-1440.png](images/external-beta-ui/studio-propose-result-1440.png). 샘플을 고르고 추천 질문으로 "지표와 차트 제안"을 누르면 "AI 연결 또는 처리 상태를 확인하지 못했습니다"가 나온다. 원인은 코드에 있다. `studio-creation.service.ts:526`·`studio-run.service.ts:123`은 Codex gpt-6-luna만 허용하고 다른 모델로 대체하지 않는데, 운영 가드는 `AI_PROVIDER=codex`를 거부한다. 두 조건이 동시에 만족될 수 없다. 화면의 "Codex · gpt-6-luna 요청" 문구(`StudioCreate.tsx:724`, `StudioConversation.tsx:451`)도 고정 문자열이라 실제 제공자와 무관하다. 계획의 M2(제공자 레지스트리·게이트웨이)가 끝나야 풀리며, 그때 이 문구와 오류 메시지("AI가 설정되지 않았습니다"와 "일시 오류"를 구분)도 함께 고친다.

**F2. 막힌 외부 DB 연결이 화면에서 조용히 실패한다.** 화면: [datasource-create-1440.png](images/external-beta-ui/datasource-create-1440.png), [mysql-test-connect-1440.png](images/external-beta-ui/mysql-test-connect-1440.png). 데이터 소스 만들기에 MySQL·Oracle 등 13종 타일이 그대로 보이고, MySQL로 TEST CONNECT를 누르면 API는 403(`This data source type is not available in this environment.`)을 돌려주는데 화면에는 어떤 문구도 뜨지 않았다(0.25초 뒤와 3.5초 뒤 DOM 변화 없음). 저장 버튼은 비활성인 채로 남는다. 같은 맥락에서 대시보드 홈의 "데이터베이스 연결" 카드와 로그인 배경의 DB 로고도 베타에서 쓸 수 없는 기능을 광고한다. 허용 유형만 보이게 하거나, 최소한 403 메시지를 표시해야 한다.

**F3. 공개 링크가 두 종류이고 만료 기본값이 계획과 다르다.** `/dashboard/:id/publication`(기존 BI 게시, 토큰이 UUID, 기본 만료 7일)과 Studio의 "게시·공유"(토큰이 64자 16진, 만료를 비우면 만료 없음)가 비슷한 문구로 공존한다. 기존 BI 게시 링크로 `/remix`를 열면 "연결 또는 복제 상태를 확인하지 못했습니다"라는 일반 오류만 나온다(토큰 형식 검사가 `/^[a-f0-9]{64}$/`이어서 요청 자체를 보내지 않는다). 계획의 "기본 만료 30일"은 Studio 쪽에 아직 없다. 계획의 M5(공유 일원화)와, M1의 공개 링크 노출 통제가 이 두 가지를 다룬다.

**F4. 샘플 목록에 "Rill 광고 샘플 · Rill 공식 데이터 · 139만 행"이 있다.** 사용자 가이드는 외부 제품 참고 정보를 제거했는데 앱 화면에는 남아 있다. 이 샘플을 눌러 보지 않았다. 데이터의 출처·라이선스와 이미지에 들어 있는지부터 확인해야 한다.

**F5. 가입 화면 제목이 "회원가입후 편리하게 이용하세요."로 띄어쓰기가 빠졌다.** [signup-noinvite-1440.png](images/external-beta-ui/signup-noinvite-1440.png). 두 텍스트 노드 사이에 공백이 없다.

## 통과한 흐름 (스크린샷 있음)

| 흐름 | 확인한 것 | 캡처 |
| --- | --- | --- |
| 로그인 화면 | 렌더링, 가로 넘침 0 | `login-1440` |
| 초대 없는 가입 화면 | 초대 코드 필드와 대기자 등록, 1440/768/390 모두 넘침 0 | `signup-noinvite-*` |
| 대기자 등록 | 이메일 제출 → "등록했습니다" | `waitlist-done-1440` |
| 초대 링크 가입 | `?invite=` 값이 입력칸에 채워지고 주소창에서 제거됨, 가입 → 로그인 화면 | `signup-filled-1440`, `after-signup-1440` |
| 로그인 후 홈 | 샘플 카드·내 파일·DB 카드·내 산출물 | `home-after-login-1440` |
| 주요 경로 11개 | `/dashboard /widget /data /commerce /studio/new /organizations /organization /explore /data/metric /data/source/create /data/file`를 1440과 390에서 열어 모두 로딩, 가로 넘침 0 | `<이름>-1440`, `<이름>-390` |
| 샘플 보기 | 매출·환불 샘플 보고서 | `sample-dashboard-1440` |
| 파일 업로드 | CSV(4행) 선택 → 소스 생성 → 데이터셋 생성 화면 | `file-analysis-uploaded-1440`, `file-saved-1440` |
| Explore | 소스 선택 → 합계 지표 저장 → 숫자 차트 미리보기 → 대시보드 저장 | `explore-*` |
| 대시보드 보기 | 1440/768/390 모두 넘침 0 | `dashboard-view-*` |
| 기존 BI 게시 | 게시·재게시(복제 허용)·링크 | `publication-1440`, `publication-published-1440` |
| 익명 열람(기존 BI 링크) | 로그인 정보를 지운 뒤 1440/390 | `published-anon-*` |
| Studio 게시 | 링크 공개 + 복제 허용 → 버전 1, 만료 없음 | `studio-publish-*`, `studio-published-1440` |
| 익명 열람(Studio) | 읽기 전용 스냅샷, 1440/390 | `studio-published-anon-*` |
| 익명 복제 | 로그인 요구 문구 | `remix-anon-real-1440` |
| **복제 전체 여정** | 두 번째 사용자가 가입·로그인 → 공유 링크의 복제 화면 → 자기 샘플 소스 선택 → 열 자동 연결 → 자기 데이터로 다시 계산한 미리보기 → 새 비공개 대시보드 저장(대시보드 #4, 지표 #2는 원본과 별개) | `remix-user2-real-1440`, `remix-user2-sample-mapped-1440`, `remix-saved-user2-1440` |

마지막 줄은 계획서에서 출시 필수로 적어 둔 "외부 사용자 간 공유 → 로그인 → 내 소스 연결 → 저장"의 개발 머신 증명이다. 운영 URL에서의 증명은 아니다.

## 하지 못한 것

- 운영 VM·도메인·HTTPS·실제 LLM·실기기. 이 검증은 어느 것도 대신하지 않는다.
- 사용량·쿼터 표시와 한도 초과 화면: 아직 구현되지 않았다.
- 초대 코드 오류(잘못된 코드, 소진, 만료)의 화면 문구, 영어 화면, 대기자 중복 등록.
- 조직 생성·직원 추가, 매출·환불 파일 가져오기, 위젯 편집기, 메트릭 생성, 게시 중지 뒤의 링크 화면.
- 768px는 가입·대시보드 보기만 찍었다. 나머지 경로는 1440과 390만 있다.
- 접근성(키보드·스크린리더), Safari·Firefox.
- Rill 샘플 선택, 비용·마진·앱 전환 샘플.

## 사용자 가이드(VitePress) 영향

`docs/user-manual/`의 VitePress 사이트는 `.github/workflows/user-guide.yml`로 Cloudflare Pages(`docs.vanillameta.net`)에 이미 배포되고 있고, `docs/user-manual/**` 변경이 develop에 푸시될 때만 갱신된다. 이번 로컬 커밋은 `docs/testing`·`docs/plans`·`backend-api`·`deploy`만 건드리므로 푸시해도 사용자 가이드가 배포되지 않는다. 다만 공개 가이드에는 아직 베타 변경이 없다: 초대 가입·대기자 안내가 없고, `site/data.md`가 외부 DB 연결 절차를 안내하는데 베타에서는 403이며(F2), `site/scope.md`의 "현재 주의할 제한"에 베타의 소스 유형 제한이 없다. 가이드 수정은 develop 푸시가 곧 공개 배포이므로 베타 공개 시점과 맞춰 한 번에 반영하는 편이 안전하다.
