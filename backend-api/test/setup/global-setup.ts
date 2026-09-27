import { config } from 'dotenv';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');

/**
 * E2E 실행 전 1회 수행.
 * 이전 실행이 남긴 SQLite 파일을 제거해 항상 깨끗한 상태에서 시작한다.
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  config({ path: join(repoRoot, '.env.test') });

  const targets = [
    join(repoRoot, process.env.DB_NAME || 'test.sqlite.db'),
    join(repoRoot, 'test', 'fixtures', 'customer.sqlite'),
  ];

  for (const file of targets) {
    if (existsSync(file)) unlinkSync(file);
  }
}
