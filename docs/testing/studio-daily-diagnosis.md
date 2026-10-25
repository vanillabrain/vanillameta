# Studio 일별 추이 거절 원인 분리 — 2026-10-25

기준 `develop/9fcadbba`와 이번 안내·검사 diff. [M2-6 재실행](external-beta-m2-llm.md)의 일별 요청3/3 `missingColumns` 관찰을 인계받아 조사했다. 당시 입력 CSV·실제 profile·응답 원본이 삭제돼 같은 실패를 재현했다고 주장하지 않는다.

## 확인한 것

- 기존 `still asks the model … 일별 매출 추이` 검사는 모델을 mock하고 channel 카테고리 차트가 나와도 통과했다. 모델 호출 여부 증거이며 일별 숫자 정답 증거는 아니다.
- 실제 CSV 파서는 ISO/슬래시 날짜를 DATE, `YYYYMMDD`를 BIGINT로 추론했다. 존재하지 않는2월29일이 섞이면 VARCHAR가 됐다. `BiService.profile`은 물리 DATE/TIMESTAMP에 temporal을 표시하고, 업무 날짜 선언이 있으면 별도로 투영한다. 금액 열의 numeric 판정과 그 열이 업무상 매출인지 여부는 다르다.
- native DATE는 원래 열로 날짜별 집계한다. 자동 TIMESTAMP는 시각별로 묶이며, 업무 유형 date 선언이 있을 때만 날짜 표현식으로 투영한다. 날짜처럼 보이는 열 이름만으로 일별 집계를 보장할 수 없다.

## 실제 모델 진단

현재 소스에서 조건 없는 일반 소스용 시스템 프롬프트 문자열을 추출하고, 제품 `callCodingAgent` 경계에 합성 profile을 전달했다. Codex CLI 요청 모델은 **gpt-6-luna**, 기존 로컬 프록시·로그인을 사용했다. 인증 파일을 읽거나 설정을 바꾸지 않았다. 직접 어댑터 진단이므로 HTTP/게이트웨이·원장·생성 저장 E2E 증거가 아니다.

| 합성 입력 | 결과 |
|---|---|
| native DATE `order_date` + numeric `amount`, 일별 매출 추이 | 약4.1초, SUM(amount) / order_date CHART_LINE 생성안 |
| 같은 DATE 소스, 실제 열 이름 명시 | 약4.9초, 같은 집계/차원 CHART_LINE 생성안 |
| 실제 VARCHAR profile 모양(temporal:false, 날짜 min/max 없음), 열 이름 명시 | 약3.4초, missingColumns로 날짜 매핑 요청 |

총4회 중1회는 VARCHAR로 바꾼 뒤 DATE min/max를 남긴 불일치 fixture였고 CHART_LINE을 반환했다. 일반 VARCHAR profile과 다르므로 위 유효 비교3개에서 제외했으며 최초 입력/응답도 보존한다. 반복 통계나 개선률은 산출하지 않았다. 현재 DATE 입력의 성공만으로 과거 거절의 원인을 모델/프롬프트/타입 중 하나로 확정하지 않는다. 시스템 프롬프트는 수정하지 않았다.

## 수정·검증

미지원 요청 안내가 모든 소스에 일 단위 추이를 대안으로 제시하던 문제를 고쳤다. effective temporal이 참이고 native DATE 또는 업무 유형 date인 열이 있을 때만 날짜·집계 열을 명시한 일별 요청을 안내한다. 나머지는 날짜 열의 업무 유형과 형식을 먼저 확인하도록 안내한다. 월별·상위N 지원, 자동 타입 변환·열 매핑, 모델 재시도는 추가하지 않았다.

| ID | 조건 | 결과 |
|---|---|---|
| DAILY-01/02 | native DATE / 업무 날짜로 선언한 VARCHAR | 일별 요청 안내 PASS |
| DAILY-03/04/05 | 자동 TIMESTAMP / 미설정 VARCHAR / category로 선언한 DATE | 수정 전3 FAIL → 날짜 설정 확인 안내 PASS |
| DAILY-06 | 모델이 실제 VARCHAR 열로 CHART_LINE 반환 | 서버400·미리보기 호출0·Metric/Dashboard 행수 불변 PASS |
| DAILY-07/08 | DATE 소스의 자연어/명시 열 질문, 모델 형태 line 응답 | 실제 DuckDB 집계100+200=300/다음날50·Metric/Dashboard 행수 불변 PASS |

격리 managed worktree에서 Node26.12.1·독립 npm ci를 사용했다. 새 DAILY8 PASS(126 SKIP) 이후 생성 suite 전체134 PASS/0 FAIL/0 SKIP, 타입 검사 PASS다. 두 배치의8개는 겹치므로 합산하지 않는다. 변경 lint의 포맷1건은 기존 prettier로 수정하고 해당 lint만 재검사해 PASS했다. native parser/기존 날짜10개 기준 검사는 별도다. 행수 불변은 기존 모든 행 bytes/hash 불변 증거가 아니며 Node24/운영 제공자 검증도 아니다.

독립 architect는 이번 안내 조건과 compiler의 날짜 투영이 일치한다고 판정했다(CLEAR). 이 안내 수정 시점에 남았던 refinement 미지원 계산 우회·FORMULA 자기 비율·과도한 동일 열 차단은 이후 [계산 검증 후속](calculation-followup.md)에서 수정·검증했다.

## 화면·증빙

Ego63에서 제품의 실제 Notice 컴포넌트·CSS와 소스에서 읽은 두 문구를 임시 렌더 페이지로 확인했다.390/768/1440px 문서 넘침0, 알림 높이98/58/58px·폭358/736/736px이며 캡처를 직접 확인했다. **문구 렌더 검증이며 로그인→Studio 제안 전체 여정, 실제 모델 저장, 실휴대폰·키보드 전체 검증이 아니다.** 프런트 소스 변경0·VoiceOver BLOCKED 유지다.

증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/daily-diagnosis-20261025/`의 합성 입력/응답·프롬프트·SHA256 manifest, CSV 타입 관측, audit 로그와 notice-layout.json·notice-{390,768,1440}.png다. Ego 공간과 전용3397 Vite를 종료하고 임시 HTML을 제거했다. 기존5173 및 Docker 프로필은 사용하지 않았다.

검증 전용 `/Users/moonklabs/.codex/worktrees/vm-daily-diagnosis/vanillameta`는 관리 도구의 archive 요청이 pinned task/workspace 보호로 거절돼 보존했다. 수동 삭제로 우회하지 않았고 필요한 로그와 두 변경 소스는 먼저 증빙 폴더/메인 체크아웃에 반영했다.

## 다음

원래 실패한 CSV/profile/질문을 확보하거나 승인된 새 격리 전체 앱에서 입력 타입·모델 거절 응답을 함께 보존해 실패를 다시 확인한다. 통과한 DATE 생성은 반복하지 않는다. 승인된 새 합성 DATE 파일의 전체 앱 생성·수정·저장·reload는 [계산 검증 후속](calculation-followup.md)에서 확인했다. 운영 제공자, 월별/상위N 확장, 원장/쿼터 정책은 별도 작업이다.
