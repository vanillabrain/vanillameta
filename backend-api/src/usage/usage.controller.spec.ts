jest.mock('../auth/guards/jwt-auth.guard', () => ({ JwtAuthGuard: class {} }));
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DuckDBService } from '../analysis/duckdb.service';
import { Database } from '../database/entities/database.entity';
import { SourceDeleteReceipt } from '../database/entities/source-delete-receipt.entity';
import { UserStorageService } from '../database/user-storage.service';
import { encryptConnectionConfig } from '../utils/crypto.util';
import { User } from '../user/entities/user.entity';
import { AiQuotaService } from './ai-quota.service';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';
import { UsageController } from './usage.controller';

describe('GET /me/usage (real SQLite, real files)', () => {
  let db: DataSource;
  let root: string;
  let controller: UsageController;
  let quota: AiQuotaService;
  let a: number;
  let b: number;
  const saved = {
    FILE_UPLOAD_DIR: process.env.FILE_UPLOAD_DIR,
    CONFIG_SECRET_KEY: process.env.CONFIG_SECRET_KEY,
    QUOTA_DAILY_CALLS: process.env.QUOTA_DAILY_CALLS,
    QUOTA_MONTHLY_TOKENS: process.env.QUOTA_MONTHLY_TOKENS,
    UPLOAD_MAX_SOURCES_PER_USER: process.env.UPLOAD_MAX_SOURCES_PER_USER,
    UPLOAD_MAX_BYTES_PER_USER: process.env.UPLOAD_MAX_BYTES_PER_USER,
  };

  beforeAll(async () => {
    process.env.CONFIG_SECRET_KEY = 'test-secret';
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'me-usage-'));
    process.env.FILE_UPLOAD_DIR = root;
    process.env.QUOTA_DAILY_CALLS = '5';
    process.env.QUOTA_MONTHLY_TOKENS = '1000';
    process.env.UPLOAD_MAX_SOURCES_PER_USER = '4';
    process.env.UPLOAD_MAX_BYTES_PER_USER = '9000000000';
    db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [User, Database, SourceDeleteReceipt, AiUsageLedger, UserQuota],
    }).initialize();
    quota = new AiQuotaService(db);
    controller = new UsageController(quota, new UserStorageService(db, new DuckDBService()), db);
    const users = db.getRepository(User);
    a = (await users.save({ userId: 'a', email: 'a@x.test', password: 'x' })).id;
    b = (await users.save({ userId: 'b', email: 'b@x.test', password: 'x' })).id;
  });
  afterAll(async () => {
    await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const as = (id: number) => ({ user: { accessKeyData: { id } } });

  it("returns only the caller's AI and storage numbers, with the limits in force", async () => {
    await quota.reserve(a, 0, 'studio-creation', 'r1');
    await quota.record(a, 'r1', { status: 'ok', inputTokens: 100, outputTokens: 50 });
    const directory = path.join(root, randomUUID());
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'data.duckdb'), Buffer.alloc(1234));
    await db.getRepository(Database).save({
      ownerId: a,
      name: 's',
      engine: 'duckdb',
      type: 'duckdb',
      connectionConfig: encryptConnectionConfig(
        JSON.stringify({
          client: 'duckdb',
          connection: { filename: path.join(directory, 'data.duckdb') },
          fileVersions: [{ filename: path.join(directory, 'data.duckdb') }],
        }),
      ),
    });

    const mine = await controller.usage(as(a));
    expect(mine.status).toBe('SUCCESS');
    expect(mine.data.ai).toMatchObject({
      daily: { used: 1, limit: 5 },
      monthlyTokens: { used: 150, limit: 1000 },
    });
    expect(mine.data.storage).toEqual({
      sources: { used: 1, limit: 4 },
      bytes: { used: 1234, limit: 9000000000 },
    });

    const theirs = await controller.usage(as(b));
    expect(theirs.data.ai.daily.used).toBe(0);
    expect(theirs.data.ai.monthlyTokens.used).toBe(0);
    expect(theirs.data.storage.sources.used).toBe(0);
    expect(theirs.data.storage.bytes.used).toBe(0);
  });

  it('reflects a per-user override', async () => {
    await quota.setOverride(b, { dailyCalls: 2 });
    expect((await controller.usage(as(b))).data.ai.daily.limit).toBe(2);
  });

  it('refuses a request with no account behind it instead of guessing one', async () => {
    for (const req of [{}, { user: {} }, { user: { shareKeyData: { uuid: 'x' } } }, as(0), as(1.5)])
      await expect(controller.usage(req)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
