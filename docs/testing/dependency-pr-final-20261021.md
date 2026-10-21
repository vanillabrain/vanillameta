# 남은 의존성 PR 최종 통합 — 2026-10-21

사용자가 TypeScript7 보류 해제를 명시해 승인했다. develop에서 drumcap으로 **452 Oracle→448 landing TypeScript→458 backend TypeScript** 순서로 통합한다. 앞선 [1차19개 검토](dependency-pr-review-20261021.md)의 보류 상태는 당시의 기록이며 이 후속이 최신 판단이다.

## Oracle

고정 공개 이미지 `ghcr.io/gvenzl/oracle-free:23.26.3-slim`의 ARM64 Oracle26ai Free와 임시 일반 계정을 사용했다. 처음2GB 검증 VM에서 DB가 ORA-03113으로 종료돼, 다른 컨테이너가 없는 것을 확인하고4GB로 일시 확대했다. 검증 뒤 컨테이너/익명 볼륨/인증 파일·새 이미지와 Node 임시 바이너리를 정리하고2GB 및 기존 Docker context로 복구한다. 사용자/운영 DB에 접속하거나 인증정보를 탐색하지 않았다.

- macOS Node24·Oracle26 Thin: 실제 로그인/잘못된 암호 거절, bind, 소수 합계120/3행, commit/rollback, Knex2.5.1 페이지·transaction rollback·동시4조회/풀.
- Linux ARM64 Node24·Oracle Client·Oracle26 Thick: 같은 검증. 공식 Node 바이너리 체크섬을 확인했다.
- 대상 드라이버 주입 fixture의 초기 fetchAsString 초기화 누락을 바로잡았으며 제품 오류로 분류하지 않았다. 이후 **실제 backend node_modules의 Oracle26과 수정하지 않은 Knex client**로 Thin 검사를 다시 통과했다. Thick은 실제 제품 preload 스크립트로 통과했다.

기본 Thin과 명시 Thick 시작 명령을 제공한다. [도구/Oracle 운영 안내](../operations/typescript7-toolchain.md)를 따른다. Oracle11 등 모든 구형 DB/운영·실사용 환경 검증은 아니다.

## TypeScript7

- 두 프로젝트의 실제 native7 검사에서 삭제된 baseUrl을 재현하고 paths로 수정했다.
- landing의 실제 설치 버전7.0.2로 typecheck/build PASS.
- backend native7은 기존 전역 타입/모듈 해석을 명시했고, 동적 TypeORM count의 generic과 시험용 JS AST import를 올바르게 지정했다. 타입 검사 비활성화/as any 확대 없이 native7 전체 검사 PASS.
- Nest/Jest/ts-node/ESLint가 요구하는 동기 JS API는 typescript-api5.9.3 별칭과 허용한 도구 import만의 Node24 hook으로 구별한다. **JS 출력은 classic5.9.3이며, 그 전의 타입 검사는 native7**이다. 일반 코드의 TS7 유지와5개 구형 도구의 API를 확인한6개 경계 시험 PASS.
- 백엔드 native 검사+Nest build·lint PASS. seed는 이번 실행의 격리 DB에서 새 preload 명령으로 PASS. source 실행 DuckDB worker와 기본/legacy/fast/e2e Jest의 compiler 경계를 맞췄다. e2e JSON은 설정 파싱만 별도로 확인했고 해당 구형 API suite 전체 실행으로 확대하지 않는다.

## 회귀와 실제 브라우저

초기 전체 Jest는311 suites/5519 tests PASS·1개 HTTP parser 오류·175 SKIP였다. 같은 코드/설정에서 실패한 studio-remix.controller.spec.ts3개는 별도 재검사 PASS였다. 첫 실패를 지우거나 둘을 단순 합산해 전체 성공으로 표시하지 않는다. 원격 통합 CI는 해당 develop 커밋의 실행 결과를 따른다.

새로 빌드한 Nest/격리 SQLite/native DuckDB에서 기존 Playwright 핵심 **9개/1.0분 PASS**: 검토 조건→비교/Pivot/CSV/버전 변경 차단, 탐색 보기 저장/reload/복원/CSV/삭제, CSV 분석/정확 SUM/차트, 파일 영속 저장, 로그인 오류/성공/로그아웃, UI 위젯/대시보드/공개 공유·embed, smoke3개다. compiler/runtime 영향 때문에 선택한 범위이며 새 Rill/AI 시나리오 완료로 집계하지 않는다. UI 소스/스타일 변경은 없고 기존 디자인 화면 결과를 재사용한다.

gpt-6-luna 및 VoiceOver BLOCKED는 유지했고 실제 AI 호출은 새로 수행하지 않았다. 운영/실기기/전체16개 수용을 의미하지 않는다. 실행 로그/초기 실패/최종 결과는 저장소 밖 `phase2-fix-evidence/pr-final-20261021`에 보존한다. 일반 FE 전체 검사는 소스/lock이 그대로여도 최종 통합 CI 결과와 구분해 기록한다.
