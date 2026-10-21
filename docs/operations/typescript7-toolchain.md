# TypeScript7 도구 운영

backend-api와 landing-page의 직접 TypeScript 의존성은7.0.2이며 Node24를 사용한다. frontend-web과 기존 Lambda layer의 TypeScript 버전은 이번 변경 대상이 아니다.

## Native 검사와 classic API 경계

`npm run typecheck`와 백엔드 `npm run build`의 첫 `tsc --noEmit`은 **실제 TS7 native CLI**다. 타입 오류를 무시하거나 TS5 검사로 대신하지 않는다. TS7에서 삭제된 baseUrl은 상대 paths로 전환했다. 백엔드는 기존의 전역 테스트 선언·비엄격 기본값을 유지하도록 moduleDetection=legacy, types=node/jest, strict=false를 명시했다. rootDir은 형제 디렉터리의 공유 이벤트 타입을 포함하며 실제 빌드는 기존 tsconfig.build.json의 rootDir을 유지한다.

Nest10 CLI·Jest28/ts-jest·ts-node·현재 ESLint parser는 구형 동기 JavaScript compiler API를 사용한다. `typescript-api`는 이에 필요한5.9.3의 **명시적 개발 의존성 별칭**이다. Node24 registerHooks는 허용한 도구의 typescript import만 이 별칭으로 보낸다. 일반 애플리케이션 import와 native CLI에는 TS7이 유지된다. 직접 AST를 읽는 기존 시험과 TypeORM ESM 변환기도 이 별칭을 명시한다.

따라서 Nest의 **JS 출력은 classic5.9.3**, 그 앞의 전체 타입 검사는 **native7**이다. 모든 단계가 native7로 바뀌었다고 표현하지 않는다. 이 경계는 구형 도구의 공식 native API 지원이 준비되면 별도 검증 후 제거한다.

## 지원 명령

backend-api에서:

```sh
npm ci --legacy-peer-deps --ignore-scripts
npm rebuild sqlite3
npm run test:toolchain
npm run typecheck
npm run build
npm run start:local
npm test -- --maxWorkers=2
npm run seed
npm run migration:run
```

마지막 seed/migration 명령은 **원하는 검증 DB를 명시한 경우에만** 실행한다. 이 문서는 운영 migration 실행 승인이 아니다. 기존 start/dev/debug·seed·migration 명령은 필요한 preload를 포함한다. 구형 도구를 직접 `npx nest`/`ts-node`로 우회 실행하기보다 npm 명령을 사용한다. 직접 Node 실행이 필요하면 `--require ./scripts/typescript-api-compat.cjs`를 해당 도구 앞에 둔다.

CI는6개 경계 시험, lint, native 검사+Nest build, 기존 전체 Jest를 실행한다. worker의 소스 실행은 같은 preload를 명시하고 운영의 컴파일된 worker는 그대로 실행한다. legacy/fast/e2e Jest 설정은 변환 경계를 맞췄지만 모든 별도 suite 통과를 기본 suite의 결과로 대신 주장하지 않는다.

## Oracle26

기본은 Oracle Client가 필요 없는 **Thin**이며 Oracle12.1 이상이 필요하다. 기존 Oracle Client나 구형 DB가 필요한 환경은 첫 연결 전에 Thick을 명시적으로 활성화한다.

```sh
# Oracle Client를 설치하고 OS의 라이브러리 검색 경로를 준비한 뒤
npm run start:prod:oracle-thick
```

이는 `node --require ./scripts/oracle-thick.cjs dist/src/main`으로 시작하며 `initOracleClient()` 실패를 숨기거나 Thin으로 우회하지 않는다. Linux는 LD_LIBRARY_PATH 등 Oracle Client의 공식 검색 설정을 사용한다. 실제 Client/DB 버전별 지원 범위는 [Oracle 공식 이전 안내](https://node-oracledb.readthedocs.io/en/latest/user_guide/migrate.html)를 확인한다. 이번 검증은 별도 Oracle Free26ai와 Client의 Thin/Thick·Node24·Knex2.5.1 조합이며 모든 구형 Oracle 버전을 수용한 결과가 아니다.
