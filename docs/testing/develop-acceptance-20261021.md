# develop 로컬 인수 시나리오 검증

2026-10-21 · 사용자 요청에 따른 `develop` 검증. 기준은 `c79312de`(main 기능 보존 통합 + develop-v2 최신 3개 커밋)와 아래 미커밋 수정이다. **정의된 로컬 시나리오는 통과했으나 관측 오류가 남아 전체 제품 수용·운영 출시 승인을 의미하지 않는다.** [기업 수용 잔여표](enterprise-acceptance-audit.md)의 16개 요건은 그대로 Open이다.

## 환경과 범위

- Node 24.19.0, 새 소유 Docker MySQL 8.4.11, 실제 전체 Nest 앱/native DuckDB와 Vite 서버를 사용했다. 새 DB의 development synchronize이며 운영 migration 검증이 아니다.
- 기존 사용자 서버·DB·업로드·브라우저 프로필을 초기화하지 않았다. 테스트 자료는 저장소의 합성 데이터이며 고객 원문은 사용하지 않았다.
- 실제 AI는 Ego 122에서 Codex provider에 `gpt-6-luna`를 요청한 생성 1회다. 자동 E2E의 업무 기준 테스트 이름에 AI가 포함되어 있어도 `QA_REAL_CODEX` 미설정 분기를 실제 LLM 검증으로 계산하지 않는다.
- Git 제외 증빙은 `.aiwf/evidence/develop-acceptance-20261021/`의 로그·캡처·`basis.json`, 권한 행렬의 개별 실행 폴더에 보존했다. 공개 문서에 계정 비밀번호·토큰·게시 capability를 복사하지 않는다.

## 결과

| 범위                    | 판정          | 실제 확인                                                                                                                                                                                                                 |
| ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 기본 사용자 여정 8개    | PASS          | 로그인 실패/성공/로그아웃, 보호 라우트 3개, CSV 합계/차트, 서버 데이터셋 저장, 위젯→대시보드→무인증 공유/임베드, Explore/Pivot 저장·reload·복원·CSV                                                                       |
| 확장 사용자 여정 9개    | PASS          | 업무 날짜 조건, 조직 분류 2개, 대시보드 삭제 보호, 비활성/응답 유실/409/reload/복원, 검토 기준의 비교/Pivot/CSV, 지표 삭제 보호, 업무 기준 생성, 소스 삭제 보호                                                           |
| 최종 E2E 실행 구분      | PASS_SELECTED | 마지막 전체 배치 16 PASS/1 FAIL(비활성 복구 테스트 경합), 응답 대기 보완 후 해당 1개 4.9초 PASS. 고유 17개를 중복 합산하지 않으며 단일 전체 배치 17 PASS라고 기록하지 않는다.                                             |
| TC050 역할·회수 HTTP    | PASS_SELECTED | 최종 297 HTTP/12개 의미 검사, 401/403 거절 111건. 직접/그룹 합집합·source/dashboard 독립 권한·전달/복제·파일/epoch·거절 시 원본 보존을 기존 실행기로 검증. 초기 동일 실행과 중복 합산하지 않는다.                         |
| Ego AI 생성→저장→reload | PASS_SELECTED | 비용·마진 합성 18행에서 총매출 숫자와 날짜별 매출 시계열 2개 블록 생성. 원본 CSV를 Python Decimal로 독립 합산한 `14,937.49 USD`와 화면이 일치. 저장 후 새로고침에서도 값·차트 유지.                                       |
| Ego 게시→reload         | PASS_SELECTED | 소유자만 조회하는 비공개 게시 V1, 게시본 열기·새로고침 후 제목/총매출/시계열 유지. 공개 Studio 게시·재사용 전체 조합 검증으로 확대하지 않는다.                                                                            |
| Ego 디자인              | PASS_SELECTED | 390/768/1440px 상단 컨트롤·저장 상태, 390/1440px 숫자/시계열 캡처 직접 확인. 가로 넘침 없음. 주요 컨트롤 36px, 이력/보조 버튼 32px. 모바일 블록 선택 44px/16px, 그 밖의 주요 버튼 14px. 모든 상태·실휴대폰 검증은 아니다. |
| 수정 관련 회귀          | PASS          | BE 3 suites/28 tests, FE 5 files/74 tests. migration discovery·빈 대시보드·위젯 선택/오류·외부 E2E seed 차단·기존 Studio/게시/분포 표시 포함.                                                                             |
| 정적 검사               | PASS          | Node 24 최종 BE/FE build, FE type, 변경 파일 lint 오류 0, diff whitespace 검사 통과. lifecycle E2E의 기존 non-null assertion 경고 4개와 Vite 번들 경고는 남음.                                                            |

## 발견한 결함과 보완

1. **CLI 시드/migration 로딩 실패:** 전체 파일 glob이 migration 옆 테스트를 실행해 `describe is not defined`가 발생했다. 테스트를 제외해도 migration 모듈의 공유 상수/함수 export가 생성자로 취급되어 실패했다. 시간 접두사 파일의 `up/down` 클래스만 로딩하도록 수정했다. 실제 격리 MySQL에서 53개 migration 클래스 로딩과 시드 준비를 확인했고 선택 회귀를 추가했다. migration 자체를 운영 DB에 적용한 결과는 아니다.
2. **위젯 선택 창의 빈 목록:** 실제 API는 위젯을 반환했지만 창이 Axios의 HTTP `status`를 제품 `SUCCESS`와 비교했다. `response.data.status/data`를 읽도록 수정하고 실패를 표시했다. 단위 선택/기존 위젯 제외와 실제 생성→공유/임베드 재실행으로 확인했다.
3. **빈 대시보드의 MySQL 500:** 위젯이 없는 조회/공유에서 `IN ()`가 생성됐다. 매핑이 없으면 빈 목록을 반환하도록 수정했다. 대시보드 삭제 보호 및 비활성/복원 HTTP·화면 시나리오가 이후 통과했다.
4. **검증 실행기 경계:** 외부 E2E 서버의 컴포넌트가 비어 있어도 기본 로컬 DB용 seed를 실행하던 fallback을 차단했다. 해당 외부 서버 DB를 먼저 준비하도록 실패시킨다. 이번 첫 seed 실패는 DB 초기화 전이었고, 복구 시에는 소유권 표식을 대조한 이번 MySQL만 시드했다. 비활성화 응답 유실 테스트는 요청 발송만으로 commit 완료를 가정하던 경합을 보완해 실제 응답 후 상태를 검사한다. assertion/제품 정책/timeout을 완화하지 않았다.

## 당시 미해결·미실행

관측 오류의 후속 수정·실제 MySQL 재검증은 [복구 기록](observability-recovery.md)을 따른다. 아래 항목은 최초 인수 검증 당시의 판정이다.

- **관측 결함:** 실제 로그에서 `SlowQueryMonitorService`의 `executionTime` MySQL 범위 초과 저장 오류, `QueryAnalyzerService`의 암호화 연결 설정 JSON 파싱 오류가 확인됐다. 제품 사용자 시나리오 통과와 별개로 남아 있는 결함이며 이번 수정에 포함하지 않았다. 원본 연결 문자열은 공개 문서에 싣지 않는다.
- **선택 Redis 경고:** Redis 미설정 환경에서도 CacheAlertService가 연결 끊김/낮은 hit 비율 경고를 반복한다. Redis/Bull 실제 실행·캐시 재시작은 이번 실행 범위 밖이다. 기존 main 통합 증빙을 이번 재실행으로 승격하지 않는다.
- 실제 Rill 화면 재비교, 모든 자연어/복합 부정·stale 변형, 전 writer 진행 중 경합, 대용량 성능, 외부 warehouse, 실휴대폰·VoiceOver·운영 migration/배포·업무 담당자 수용은 NOT_RUN이다.
- 이번 로컬 인수 시나리오의 17개 수와 FR014~025/NFR005~008의 16개 수용 항목은 다른 분모다. 테스트 통과 수를 전체 완성도 비율로 계산하지 않는다.

## 실행과 정리

`npm run build`는 Node 24 경로를 지정해 실행했다. 기존 `scripts/qa-enterprise-mysql.cjs`로 소유 런타임을 기동하고, `E2E_EXTERNAL_SERVER=1`/격리 API·FE URL/고유 테스트 계정/`QA_RUN_ROOT`를 지정해 `frontend-web`에서 `npx playwright test`를 실행했다. 해당 테스트가 데이터 쓰기/합성 공개 공유를 수행하므로 사용자 운영 서버에 그대로 실행하지 않는다. 컴포넌트가 없는 외부 서버에는 기본 로컬 seed를 대신 실행하지 않는다.

최종 권한 행렬은 `scripts/qa-enterprise-access-matrix.cjs`의 실행 `073fa1c8-8424-4334-8895-4ad34d8613df`다. Ego 122는 `finish({keep:[]})` 완료, 이번 소유 감독기의 인증된 `/stop`은 HTTP 200/stopped로 완료했다. 임시 MySQL 컨테이너·자격증명을 정리했으며 사용자 미추적 `.omx-state-locks*`는 보존했다. 이 기록은 최초 미커밋 후보 기준이다. 관측 오류 후속과 함께 develop에 반영하며 최종 전달 SHA는 Git 로그를 따른다.
