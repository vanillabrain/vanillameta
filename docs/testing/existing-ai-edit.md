# 기존 실행 환경 AI 편집 — 2026-10-14

## 수정과 설정

기존 `NODE_ENV=local` API가 `.env.dev`만 읽어 `.env.local`의 로컬 연결 설정을 사용하지 못했다. 이제 `.env.local` → `.env.dev` 순으로 읽고 셸 환경변수가 최우선이다. dev/prod 파일 선택은 유지했다.

`backend-api/.env.local`은 파일을 보존하면서 Git 추적에서 제외했다. 기존 인증 설정은 유지하고 현재 호스트의 Codex 연결만 추가했다. 다른 호스트에서는 설치된 연결 주소·카탈로그 경로·기존 Codex 로그인을 확인한다.

```dotenv
AI_PROVIDER=codex
AI_CODEX_BASE_URL=http://127.0.0.1:10100/v1
AI_CODEX_MODEL_CATALOG=/Users/drumcap/.codex/opencodex-catalog.json
AI_TIMEOUT_MS=180000
```

설정 변경 후 API를 재시작한다. 기존 셸에 `AI_PROVIDER` 등 다른 값이 지정되어 있으면 해당 값이 우선한다. 이 수정은 API ConfigModule에 적용되며 별도 CLI seed의 dotenv 로더를 변경하지 않는다. 요청 모델은 `gpt-6-luna` 고정이며 자동 대체하지 않는다.

## 실제 실행 검증

기존 화면 **http://127.0.0.1:3698/commerce/1?sample=1**에서 수행했다. API는 **4898**, 브라우저는 기존 **4899 프록시**를 경유한다. 기존 `/tmp/vm-rill-views/metadata.db`, `/tmp/vm-rill-views/uploads`, 인증·CORS 설정을 그대로 사용했다. DB 복사나 별도 데모 서버 없이 빌드된 기존 API를 재시작했다. 시연 계정과 API 전용 테스트 계정을 분리했다.

| 검증                  | 결과                   | 증거                                                                                                                                |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 실제 화면 질문 → 초안 | PASS                   | 제목을 매출·환불 운영 현황으로 변경하고 차감 수취액/주문일 코호트 환불률 설명 요청. `gpt-6-luna`, POST `/commerce/1/ai` 201, 6830ms |
| 저장 → 새로고침       | PASS                   | PUT `/commerce/1/presentation` 200 → GET report 200. 새로고침 완료 후 제목·설명·차트 제목 유지                                      |
| 화면 수치 유지        | PASS                   | 결제 20,994.61 / 환불 4,457.60 / 차감 수취액 16,537.01 USD, 주문 35/8, 비율 22.86%                                                  |
| API 실제 LLM 질문 2회 | PASS                   | 전체/2025-06-24 질문, 초안 미저장·저장/재조회·리포트/게시 digest/version 불변. 전용 테스트 계정 프로젝트2의 원래 표현 복원          |
| 독립 CSV/Decimal      | PASS                   | 전체·주문일·환불일·채널·빈 결과 5조건, 일별/채널 합계·재조회·샘플 멱등                                                              |
| 설정/AI/커머스 단위   | PASS                   | 3 suites / 36 tests. 로컬 우선·누락 fallback·셸 우선·dev/prod 유지 포함                                                             |
| 빌드·린트             | PASS                   | 루트 npm run build(BE/FE), 변경 BE 3파일 ESLint                                                                                     |
| 디자인                | PASS_SELECTED_VARIANTS | 1440×900 CSS 실제 캡처의 긴 질문/답변, 버튼 크기·정렬, 입력 높이·간격·폰트와 저장 후 KPI 배치 확인. 잘림 없음                       |

증빙은 저장소 밖에 보관한다:

- `/tmp/vm-existing-ai/ai-api.json`, `oracle-api.json`, `ui-requests.json`(인증 없는 요청 메타데이터).
- `/Users/drumcap/.aside/u/0/sessions/2026-10-14_xFQKdMnZS9BMOCgf/artifacts/existing-ai-preview.png`, `existing-ai-saved-reloaded.png`, `existing-ai-reloaded.txt`.

```sh
# 저장소 루트. 전용 테스트 계정 비밀번호를 COMMERCE_VERIFY_PASSWORD로 전달한다.
python3 scripts/commerce/verify-report.py --api-url http://127.0.0.1:4898/v1 \
  --user-id demoverify1014 --output /tmp/vm-existing-ai/oracle-api.json
python3 scripts/commerce/verify-ai-demo.py --api-url http://127.0.0.1:4898/v1 \
  --user-id demoverify1014 --output /tmp/vm-existing-ai/ai-api.json
```

UI 저장 표현은 시연용으로 유지했다. 저장 설명은 정적 텍스트이며 기간을 바꾸면 필요에 따라 다시 질문한다. 새 모바일/VoiceOver, Rill 재비교, 운영 배포, 전체 E2E 회귀는 NOT_RUN이다. UI 코드는 변경하지 않았으며 이전 Explore/Pivot 검증은 재사용한다. provider 내부 실제 모델의 독립 증명이 아니라 지정 모델 요청과 실제 응답을 확인했다.
