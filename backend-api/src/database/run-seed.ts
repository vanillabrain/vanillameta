import { config } from 'dotenv';

config();

import dataSource from '../data-source';
import CreateInitialData from './seeds/create-initial-data';

/**
 * 로컬/개발 DB 초기 시드 러너.
 * typeorm-extension CLI 대신 앱과 동일한 DataSource(src/data-source.ts)를 직접 사용한다.
 * 모든 insert는 orIgnore()라서 재실행해도 기존 데이터를 유지한다(idempotent).
 */
async function main() {
  await dataSource.initialize();
  try {
    await new CreateInitialData().run(dataSource);
    // eslint-disable-next-line no-console
    console.log(
      `[seed] completed on ${dataSource.options.type} (${(dataSource.options as any).database})`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed:', err);
  process.exit(1);
});
