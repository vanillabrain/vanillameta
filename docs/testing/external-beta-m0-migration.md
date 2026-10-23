# 외부 베타 M0 — 빈 DB 운영 마이그레이션 증빙

2026-10-23 · Draft / PASS_SELECTED. [계획](../plans/external-beta-launch.md) M0의 "기준선 마이그레이션과 빈 DB 증명" 단위다.

## 문제

마이그레이션 이력만으로는 빈 MySQL을 구성할 수 없다. 첫 마이그레이션(`1695999999999-add-clickhouse-database-type.ts`)이 `synchronize`로만 생기는 `databaseType`에 INSERT하고, 참조 데이터(컴포넌트·DB 유형·템플릿)는 local 전용 시더에만 있다. 운영은 `synchronize`를 끄므로 새 운영 DB가 만들어지지 않는다.

## 해결

`backend-api/src/database/migrate-prod.ts`의 `migrateProd(dataSource)`, 실행은 `npm run migration:run:prod`(컴파일된 `dist/src/database/migrate-prod.js`, `NODE_ENV=prod` 필수).

- **테이블이 하나도 없는 DB:** 엔티티로 스키마를 한 번 생성하고, 참조 데이터(`CreateInitialData.seedReferenceData`, 데모 `guest` 계정 제외)를 넣고, 기존 마이그레이션 전부를 실행하지 않고 "적용됨"으로 기록한다.
- **테이블이 이미 있는 DB:** `migrations` 기록이 있으면 대기 중인 마이그레이션만 실행한다. 동기화·재시드를 하지 않는다. **테이블은 있는데 기록이 없거나 0건이면 거부한다**(첫 실행이 `synchronize` 뒤에 중단됐거나 다른 앱의 스키마일 수 있다).
- 실행은 MySQL 이름 잠금(`GET_LOCK`, 기본 60초)으로 직렬화하고, 연결된 스키마가 설정된 `DB_NAME`과 같은지 확인한다.
- `CreateInitialData`는 `seedReferenceData`(운영 공통)와 `run`(참조 데이터 + 데모 계정, 기존 동작 유지)으로 나뉘었다.

## 실행 결과 (격리 MySQL 8.4 컨테이너, 호스트 loopback 전용 포트, 실행 후 삭제)

| 검사 | 결과 |
| --- | --- |
| 빈 DB 첫 실행 | `{"mode":"bootstrapped"}`, 테이블 83개, `migrations` 53건 기록 |
| 참조 데이터 | component 52, databaseType 16(clickhouse·trino·databricks 포함), template 포함 |
| 데모 계정 | `user` 0건 (`guest` 없음) |
| 두 번째 실행 | `{"mode":"migrated","ranMigrations":0}` |
| 마이그레이션이 만드는 테이블 | 엔티티 스키마에 모두 존재 (`background_job_results`, `queued_job_results`, `client_analytics_events` 등). 비교에서 걸린 3개 이름은 `legacy-table-separation.mysql.spec.ts` 픽스처에서만 나온다 |
| 중단된 첫 실행 흉내(`migrations` 기록 삭제, 83 테이블 유지) | `Schema "vm_real" has 83 tables but no recorded migrations ... Refusing to migrate it`, 테이블 수 불변 |
| `migrate-prod.mysql.spec.ts` + `production-guard.spec.ts` | 2 suites, 26 tests PASS (MySQL 스펙 6개: 빈 DB 초기화·재실행, 대기 중 마이그레이션만 실행, 기록 없는 스키마 거부, 빈 `migrations` 테이블 거부, 동시 2회 실행에서 정확히 1회만 초기화, 잠금 보유 시 실패. `VM_MIGRATE_PROD_MYSQL_PORT`/`..._PASSWORD`를 지정한 옵트인) |
| `npm run build`, eslint(변경 파일), `tsc --noEmit` | PASS |

## 부팅 가드 보강 (architect 검토 반영)

`NODE_ENV=production`(예: `backend-api/docker-compose.yml:70`)은 `app.module.ts`가 `!= 'prod'`로 판단해 `synchronize`를 켜고 swagger를 노출한다. 가드는 이 별칭을 항상 거부하고, 원격 `DB_HOST`에서 `NODE_ENV`가 미설정이거나 `local/dev/prod/test`가 아니면 거부한다. 운영에서 `.env.local`이 있으면(`main.ts`가 무조건 로드한다) 거부한다. 이미지에 파일이 들어가지 않게 하는 `.dockerignore` 확인은 이미지 단계에 남아 있다.

## 환경 주의

- `package.json` engines는 Node 24.x이지만 이 장비에는 22.23.1(`~/.local/bin`), 20, 26.12.1(Homebrew)만 있다. **Node 22에서는 `typescript-api-compat.cjs` 훅이 `nest build`에 적용되지 않아** `tsBinary.getParsedCommandLineOfConfigFile is not a function`으로 실패하고, `ts-node`도 TS7과 맞지 않는다. 위 결과는 Node 26.12.1에서 얻었다. Node 24에서의 재현은 미실행이다.
- `npm ci`는 `@nestjsplus/knex@1.0.0`의 peer(`@nestjs/common@^6`)와 설치된 `@nestjs/common@10` 충돌(ERESOLVE)로 실패하며 `--legacy-peer-deps`가 필요하다. 이 변경과 무관한 기존 상태이고, 이미지 빌드 단계에서 처리해야 한다.
- `jest`는 `jest.config.js`와 `package.json`의 `jest` 키가 함께 있어 `npx jest`만으로는 실행되지 않는다. `npm test`처럼 `--config package.json`을 쓴다.

## 한계 (통과로 보고하지 않는 항목)

- 마이그레이션 53건이 모두 DDL이거나 참조 시드가 이미 포함하는 DML(clickhouse·trino·databricks 행)이라는 검토와 `UQ_user_userId`/`UQ_user_email`/`FK_enterprise_membership_user` 표본 확인은 했지만, 53건 전부의 컬럼·인덱스·FK를 엔티티와 대조하지는 않았다.
- 마이그레이션이 만드는 컬럼·인덱스까지 엔티티와 같은지는 확인하지 않았다(테이블 존재만 비교). 이후 스키마 변경은 `migration:generate`로 만든다.
- 실제 운영 VM, Node 24, 대용량 데이터, 백업 복원은 미실행이다.
- 이 단위는 M0 전체가 아니다. 소스 유형 제한(SSRF), 이미지, `deploy/` compose, 배포 워크플로, 백업은 남아 있다.
