# 의존성 PR 검토 — 2026-10-21

검토 대상은 `vanillabrain/vanillameta`의 열린 Dependabot PR19개다. 기준 브랜치는 사용자 지정 `develop`이며 검토 중 원격 추가 이력을 fast-forward로 보존해 `3f35fe99` 기준으로 수정했다. 19개 모두 MERGEABLE이었으나 이는 호환성/CI 통과 판정이 아니다. 개별 PR diff·실패 실행 로그·공식 npm 버전 metadata와 실제 대상 패키지를 대조했다. 이 첫 검토에서는 PR 병합/승인/댓글을 실행하지 않았다. 아래 병합 후속은 사용자의 별도 병합 지시에 따른다.

## 공통 원인과 수정

최신 develop [CI39530819041](https://github.com/vanillabrain/vanillameta/actions/runs/39530819041)도 BE3 suites/4 tests가 실패했다. 의존성 PR의 실패를 모두 그 업데이트 탓으로 분류하지 않는다. 과거 lint 두 건은 최신 기준에서 통과하므로 같은 수정/검사를 새 사례로 집계하지 않았다.

- 메모리 일반/종료 lifecycle 검사가 실제 Jest 프로세스의 RSS에 의존했다. 정상 시나리오의 RSS를256MiB로 고정하고 기존80/90% 경고·거절 경계는 유지한다.
- 별도로 주기적 메모리 검사에서 임계치 예외가 timer 밖으로 나가 프로세스를 종료할 수 있었다. 배경 관측은 경고/GC/CloudWatch를 유지하되 요청용 예외를 던지지 않는다. 실제 요청은 기존대로 거절한다. 임계치 완화/전체 검사 비활성화가 아니다.
- 생성 준비 후 다른 SQLite 연결이 같은 지표를 저장하면 아직 create로 계산된 계획이 METRIC_NAME_CONFLICT를 반환했다. 현재 소스의 활성·유효한 동일 계산 신원만 PLAN_CHANGED/재미리보기로 구분한다. 비활성/외부/손상/다른 계산의 이름 충돌은 기존 거절이다. 두 연결을 실제로 사용하는 준비 뒤 commit 게이트로 순서를 고정해 재현했다. 패배 요청 영수증/대시보드 추가0과 지표1개를 확인한다.

새 실패 재현2개는 FAIL→수정 후 PASS다. 최종 대상4 suites/30 tests PASS와 실제 TypeOrmModule SQLite 초기화/조회/종료1 PASS는 별도 배치다. 이전29 PASS와 겹치므로 합산하지 않는다.

## PR별 판단

‘공통 수정 제공’은 최신 develop에 수정이 있다는 뜻이다. **해당 PR head의 재검사나 대상 버전의 전 기능 수용을 뜻하지 않는다.** 다음 버전을 전부 일괄 설치/병합하지 않았다.

| PR                                                          | 업데이트                           | 확인·조치                                                                                                                                                                                                           |
| ----------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [453](https://github.com/vanillabrain/vanillameta/pull/453) | @nestjs/typeorm12.0.2              | 실제 ESM export로 Jest28이168 suites를 읽지 못하는 오류 확인. Nest10/TypeORM0.3 peer 범위에는 맞는다. develop에12.0.2와 좁은 시험 로더 변환을 적용·기존 검사/실제 초기화 재검증.                                    |
| [457](https://github.com/vanillabrain/vanillameta/pull/457) | Swiper14.3.0                       | TS2614 Navigation export 제거를 수정. swiper/modules·컴포넌트 modules prop으로 변경하고 소수 슬라이드는 rewind로 유지. 실제14.3.0/타입·빌드·키보드/390·1440px 확인.                                                 |
| [458](https://github.com/vanillabrain/vanillameta/pull/458) | BE TypeScript7.0.2                 | 병합 보류 권고. 공식 배포의 root export는 version.cjs이며 기존 lib/typescript.js가 없다. ts-jest28/Nest CLI의 기존 JS compiler API 소비와 동등한 업그레이드가 아니다. compiler/test 도구 이전을 별도 검증해야 한다. |
| [448](https://github.com/vanillabrain/vanillameta/pull/448) | landing TypeScript7.0.2            | BE의 실패를 그대로 적용하지 않는다. Vite/tsconfig의 별도 호환성 검증 대상이다. 기존 CI에 빠진 landing 타입·빌드를 추가했으며 이번 로컬 검사는 기존5.9.3 기준이다.7 버전 PASS로 표시하지 않는다.                     |
| [445](https://github.com/vanillabrain/vanillameta/pull/445) | actions/checkout7                  | 공식 action.yml의 node24 확인. 과거 FE lint/BE 공통 실패와 구분. 최신 기준 재검사 후 판단.                                                                                                                          |
| [446](https://github.com/vanillabrain/vanillameta/pull/446) | actions/setup-node7                | 공식 action.yml의 node24 확인. 호스팅 runner CI에서 대상 버전 재검사 필요.                                                                                                                                          |
| [450](https://github.com/vanillabrain/vanillameta/pull/450) | Vite8.3.4                          | Node 요구^20.19 또는>=22.12로 현재24에 맞음. patch 업데이트이며 과거 공통 lint 실패를 재사용하지 않는다. 대상 버전 CI는 별도.                                                                                       |
| [451](https://github.com/vanillabrain/vanillameta/pull/451) | react-intersection-observer11.0.1  | React18 peer 범위 일치. 공통 CI 수정 제공, major 동작은 대상 PR 검사로 확정.                                                                                                                                        |
| [452](https://github.com/vanillabrain/vanillameta/pull/452) | oracledb26.0.0                     | Node peer만으로 실제 Oracle 연결을 수용하지 않는다. optional native/thin/thick·접속 실환경 검증을 구분. 공통 CI 수정 제공.                                                                                          |
| [454](https://github.com/vanillabrain/vanillameta/pull/454) | @sentry/react11.8.0                | React18/router6·Node24 범위 일치. 같은 major minor 업데이트, 공통 실패 수정 제공.                                                                                                                                   |
| [455](https://github.com/vanillabrain/vanillameta/pull/455) | mathjs15.2.0                       | Node24 지원. BE 계산/정밀도·직렬화는 major 영향 범위이며 공통 CI 실패만으로 수치 호환을 판정하지 않는다.                                                                                                            |
| [456](https://github.com/vanillabrain/vanillameta/pull/456) | react-router-dom7.18.4             | React>=18/Node>=20 범위 일치·과거 PR frontend 통과. 공통 BE 실패는 별도이며 실제 로그인/보호 탐색 수용은 재사용 범위를 확인한다.                                                                                    |
| [459](https://github.com/vanillabrain/vanillameta/pull/459) | mysql2 3.24.6                      | Node24 지원·과거 FE 통과/BE 공통3실패. 실제 MySQL 인증·transaction 결과를 검사해야 DB 호환 PASS로 올릴 수 있다.                                                                                                     |
| [460](https://github.com/vanillabrain/vanillameta/pull/460) | eslint-plugin-react-hooks7.1.1     | 공식 peer는 ESLint7도 지원한다. peer 불일치라고 오판하지 않는다. 최신 lint 설정에서 대상 버전 재검사 필요.                                                                                                          |
| [461](https://github.com/vanillabrain/vanillameta/pull/461) | layer aws-sdk2.1693.0              | v2 범위 floor 갱신이며 v3 이전이 아니다. Lambda 패키징은 일반 BE/FE CI와 별도.                                                                                                                                      |
| [462](https://github.com/vanillabrain/vanillameta/pull/462) | layer @nestjs/passport11.0.1       | 공식 peer는 Nest8/9/10을 지원하므로 layer Nest9와 숫자만 보고 불일치로 판정하지 않는다. 패키징/인증 검증은 별도.                                                                                                    |
| [463](https://github.com/vanillabrain/vanillameta/pull/463) | layer eslint-config-prettier10.1.8 | peer ESLint>=7. lockfile 대량 diff에는 v1→v3 형식 변경이 섞임. layer 도구/패키징 검증은 미실행.                                                                                                                     |
| [464](https://github.com/vanillabrain/vanillameta/pull/464) | landing lucide-react1.59.0         | React18 peer 일치. 새 landing 타입/빌드 검사에서 대상 버전을 확인할 수 있게 보완. 이번 target 설치는 하지 않음.                                                                                                     |
| [465](https://github.com/vanillabrain/vanillameta/pull/465) | landing cn0.5.0                    | Node>=22로 현재24에 맞음. 새 landing 검사 범위에 포함. 대상 버전 스타일/결합 동작은 별도.                                                                                                                           |

## TypeORM12 시험 경계

[공식 패키지](https://github.com/nestjs/typeorm)와 registry의12.0.2 peer/배포를 확인했다. Node24 실제 CommonJS 프로세스에서 패키지를 로드해 Nest application context→in-memory SQLite SELECT1→close를 통과했다. 운영 DB/파일 변경은 없다.

Jest28은 Node24의 ESM loader를 그대로 사용하지 않는다. 단순 ts-jest allowJs 설정만으로 해결되지 않았고, ESM의 createRequire(import.meta.url)도 CommonJS wrapper와 충돌했다. 특정 @nestjs/typeorm JS에만 TypeScript transpile을 적용하고 해당 compatibility helper의 중복 require 선언만 AST로 제거해 Jest의 동일 모듈 인스턴스를 유지했다. 제품 TS 검사/DB/API를 mock하거나 약화하지 않는다. transformer/TS 버전·instrument·입력·설정을 cache key에 반영한다. 기본/legacy/fast 설정의 순서를 맞췄으며 legacy/fast 전체 suite PASS는 주장하지 않는다.

## 화면·검증 범위

Swiper14의 실제 SecondStep 컴포넌트를 임시 Vite harness/Ego56에서 렌더링했다. 기존 인증/전체 추천 wizard를 반복한 검증은 아니다. Enter 다음 이동 Slide1→2, 이전/rewind Slide1→3(마지막 유효 viewport), 기존5개 슬라이드·390/1440px 넘침0·가시 초점을 확인했다. 새 독립 Playwright suite는 추가하지 않았다. 전체 페이지 디자인 개선으로 확대하지 않는다.

BE type/lint/build·FE type/대상 lint/build·기존 landing5.9.3 타입/빌드 PASS다. CI에 landing 설치/타입/빌드를 추가해 해당 PR들이 BE/FE 통과만으로 누락되지 않도록 했다. npm lock과 npm이 갱신한 yarn lock의 대상 버전 diff를 함께 보존하되 검증 설치는 npm 기준이다. 불필요한 전체 UI/실모델 검증은 반복하지 않았으며 gpt-6-luna 설정·VoiceOver BLOCKED는 변경하지 않았다.

로컬 증빙은 `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pr-review-20261021/`을 따른다. CI·registry 원문은 별도 실행 폴더에서 수집하고 공개 문서에는 필요한 요약/공식 링크만 남겼다. [모바일](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pr-review-20261021/swiper-390.png) · [데스크톱](/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pr-review-20261021/swiper-1440.png).

## develop 병합 후속

사용자 지시에 따라 drumcap으로 develop에 통합했다. 최초19개 중 **14개 변경 통합(PR13개 MERGED·459는 로컬 병합 뒤 Dependabot의 새 head가 반영 확인으로 CLOSED)**, 기존 적용 **453·457도 자동 종료**, **448·458(TypeScript7)과452(Oracle26)는 보류**다. 닫힌 PR을 다시 병합하거나 중복 적용하지 않았다.

통합 대상은445·446·450·451·454·455·456·459·460·461·462·463·464·465다. checkout/setup-node의 인접 workflow 충돌은 둘 다7로 유지했다. MySQL/mathjs·AWS/ESLint/Passport·landing cn/아이콘·Observer/Router lock 충돌은 앞서 통합한 버전을 되돌리지 않고 해결했다. 원격에 추가된 사용자 가이드 배포 이력도 병합해 보존했다. 강제 push/CI 보호 우회 옵션은 사용하지 않았다.

### 병합 중 발견한 오류

- 같은 생성 요청이 별도 SQLite 연결에서 initial receipt read 뒤 완료되면, 뒤늦은 준비가 새 지표를 보고 PLAN_CHANGED를 반환했다. 해당 오류 때 현재 actor/epoch·원 요청 digest·결과 소유/소스 read를 다시 검사하고 **정확히 같은 완료 영수증만** 반환한다. 다른 요청의 오래된 생성안은 계속 거절한다. 순서를 고정한 새 회귀는 수정 전 FAIL→수정 후 PASS이며 관련18개가 통과했다.
- 복구 기록의 ‘미래60초+1ms’ 검사가 실제 시계 진행에 따라 통과/실패했다. 검증 함수에 동일한 기준 시각을 전달해 경계를 고정했다. 제품 허용 시간/만료 정책은 바꾸지 않았다. 해당12개가 통과했다.
- 격리 MySQL 실행기가 Jest 설정 중복으로 기동하지 못해 package.json 설정을 명시했다. 재실행에서 **MySQL8.4.11/mysql2 3.24.6/native DuckDB의64개**가 통과했고 임시 컨테이너/인증 파일을 정리했다. 운영 migration/모든 DB 검증이 아니다.
- Vite·Observer·Hooks PR에 빠진 Yarn 대상 항목을 보강했다. npm의 전체 정렬/오래된 항목 정리를 그대로 커밋하지 않고 필요한 새 선택 항목만 추가했다. 공식 Yarn lock 파서로 대상107개 의존성 연결과 Vite의15개 플랫폼 binding을 확인했다. 실제 설치·빌드 검증은 npm 기준이며 Yarn 설치 전체 통과로 확대하지 않는다.

### 호환성·실행 범위

mathjs15는 소수 합계·문자열 평균·큰 값·소수 여섯 자리·음수 최댓값/최솟값·JSON 숫자 변환의7개를 확인했다. Lambda 세 PR은 각각의 정확한 package/lock을 임시 폴더에서 설치하고 AWS2.1693 S3 구성, Nest9/Passport11 로컬 인증 허용·401 거절, ESLint8/Prettier 설정10 로드를 확인했다. 실제 AWS 배포·기존 Node14 Lambda 운영 검증으로 확대하지 않는다.

Router7/Observer11/Sentry11.8/Vite8.3.4를 함께 설치해 FE 타입·린트·빌드와 landing cn0.5/아이콘1.59 타입·빌드를 확인했다. [통합 CI39538540154](https://github.com/vanillabrain/vanillameta/actions/runs/39538540154)는 코드3b97f422에서 backend/frontend 모두 SUCCESS이며 landing 검사도 포함한다. 이 CI의 npm 입력/제품 코드는 후속 Yarn 항목·증빙 문서 수정과 구분한다.

CI 중 다른 PR에서 DuckDB worker의20초 검사 제한 후 후속 queue timeout도 관찰했다. 해당11개는 동일 제품 코드의 격리 재실행 및 최종 통합 CI에서 통과했다. 제품 timeout/취소 경계를 완화하거나 이 실패를 무시하도록 변경하지 않았다. 대규모 운영 부하 전체 수용으로 표시하지 않는다.

### 브라우저 증빙

기존 Router 영향 경로만 선택했다. 격리 QA 첫 실행은 component seed 미준비로 NOT_RUN이었다. **이번 실행의 임시 DB 경로만** 지정해 기존 seed를 준비한 뒤 잘못된 비밀번호→로그인→로그아웃, 보호 경로, 미인증 알 수 없는 경로 **3개가6.5초에 PASS**했다. 이미 통과한 차트/AI 전체 흐름은 반복하지 않았다.

Ego57의 실제 로그인390/1440px에서 User ID→Tab→Password 초점과 가로 넘침0을 확인했다. 실제 LazyImage를 쓰는 임시 harness에서는 화면 밖 src 없음→앵커 Enter→실제 이미지 로드(naturalWidth105),390px 넘침0을 확인했다. harness는 전체 제품 화면이 아니며 검증 후 소스 파일과 작업 공간을 정리했다.

증빙: `/Users/moonklabs/workspace-vanilla/phase2-fix-evidence/pr-merge-20261021/`의 `router-login-390.png`, `router-login-1440.png`, `observer11-390.png`, `playwright-002.log`. gpt-6-luna 설정·VoiceOver BLOCKED를 유지했고 실제 AI 모델 검증을 새로 실행하지 않았다.

### 남은 PR

- **448·458:** 사용자 지정 TypeScript7 보류. 기존5.9.3 유지. compiler/test 도구의 별도 이전 계획 전까지 병합하지 않는다.
- **452:** Oracle26의 일반 타입/백엔드 CI 성공만으로 실제 접속 호환을 판정하지 않는다. 기존5.5를 유지하고 Oracle의 thin/thick·클라이언트·실제 인증/조회/트랜잭션을 격리 환경에서 확인한 뒤 결정한다. 사용자 Oracle 인증정보 탐색이나 운영 DB 접속은 하지 않았다.
