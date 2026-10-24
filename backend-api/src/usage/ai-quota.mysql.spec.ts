import { ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AddAiUsage1792700100000 } from '../migrations/1792700100000-add-ai-usage';
import { User } from '../user/entities/user.entity';
import { AiQuotaService } from './ai-quota.service';
import { AiUsageLedger } from './entities/ai-usage-ledger.entity';
import { UserQuota } from './entities/user-quota.entity';

// Explicit opt-in against a throwaway MySQL server; each test works in its own child schema.
// Example: VM_ACCESS_MYSQL_PORT=33998 VM_ACCESS_MYSQL_PASSWORD=... npm test -- ai-quota.mysql
const enabled = Boolean(process.env.VM_ACCESS_MYSQL_PORT);
const suite = enabled ? describe : describe.skip;
const ENTITIES = [User, AiUsageLedger, UserQuota];

suite('AI quota on MySQL', () => {
  jest.setTimeout(120000);
  const schemas: string[] = [];
  let admin: DataSource;
  const saved = {
    QUOTA_DAILY_CALLS: process.env.QUOTA_DAILY_CALLS,
    QUOTA_MONTHLY_TOKENS: process.env.QUOTA_MONTHLY_TOKENS,
  };

  const options = (database?: string) => ({
    type: 'mysql' as const,
    host: process.env.VM_ACCESS_MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.VM_ACCESS_MYSQL_PORT),
    username: process.env.VM_ACCESS_MYSQL_USER || 'root',
    password: process.env.VM_ACCESS_MYSQL_PASSWORD,
    database,
    extra: { connectionLimit: 12 },
  });

  async function schema() {
    const name = 'vm_quota_' + randomBytes(8).toString('hex');
    schemas.push(name);
    await admin.query(`CREATE DATABASE \`${name}\``);
    return name;
  }

  const shape = async (name: string) => ({
    columns: await admin.query(
      `SELECT table_name t, column_name c, column_type ty, is_nullable n, column_key k, extra e, column_default d
         FROM information_schema.columns WHERE table_schema = ? AND table_name IN ('ai_usage_ledger','user_quota') ORDER BY table_name, ordinal_position`,
      [name],
    ),
    indexes: await admin.query(
      `SELECT table_name t, index_name i, non_unique u, column_name c, seq_in_index s
         FROM information_schema.statistics WHERE table_schema = ? AND table_name IN ('ai_usage_ledger','user_quota') ORDER BY table_name, index_name, seq_in_index`,
      [name],
    ),
  });

  beforeAll(async () => {
    admin = await new DataSource(options()).initialize();
  });
  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    for (const name of schemas) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin?.destroy();
  });

  it('the migration builds the same tables as the entities (columns, types and indexes)', async () => {
    const migrated = await schema();
    // The migration only creates the two usage tables; the user table comes from the entity.
    await (
      await new DataSource({
        ...options(migrated),
        entities: [User],
        synchronize: true,
      }).initialize()
    ).destroy();
    const runner = await new DataSource({
      ...options(migrated),
      entities: ENTITIES,
      migrations: [AddAiUsage1792700100000],
      synchronize: false,
    }).initialize();
    await runner.runMigrations();
    await runner.destroy();
    const synced = await schema();
    const viaEntities = await new DataSource({
      ...options(synced),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    await viaEntities.destroy();
    expect(await shape(migrated)).toEqual(await shape(synced));
  });

  async function database() {
    const name = await schema();
    const db = await new DataSource({
      ...options(name),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    const users = db.getRepository(User);
    const user = await users.save({ userId: 'q', email: 'q@x.test', password: 'x' });
    return { db, user: user.id };
  }

  it('lets exactly the daily limit through under 12 concurrent reservations', async () => {
    process.env.QUOTA_DAILY_CALLS = '4';
    process.env.QUOTA_MONTHLY_TOKENS = '1000000';
    const { db, user } = await database();
    try {
      const quota = new AiQuotaService(db);
      const outcomes = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) => quota.reserve(user, 0, 'studio-creation', `r${i}`)),
      );
      expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(4);
      expect(
        outcomes
          .filter(o => o.status === 'rejected')
          .every(o => (o as any).reason.getStatus() === 429),
      ).toBe(true);
      const rows = await db.getRepository(AiUsageLedger).find();
      expect(rows.filter(r => r.status === 'reserved')).toHaveLength(4);
      // Every refusal committed its own row.
      expect(rows.filter(r => r.status === 'quota_denied')).toHaveLength(8);
      expect((await quota.summary(user)).daily.used).toBe(4);
    } finally {
      await db.destroy();
    }
  });

  // Mutation guard: a plain read before the user-row lock takes the REPEATABLE READ snapshot, so the
  // count cannot see rows the previous lock holder committed. The same reservation written that way
  // lets more calls through than the limit, which is what the lock and READ COMMITTED prevent.
  it('would overshoot the limit if a plain read came before the lock (why the order matters)', async () => {
    process.env.QUOTA_DAILY_CALLS = '2';
    const { db, user } = await database();
    try {
      const reserveBadly = (requestId: string) =>
        db.transaction(async (manager: EntityManager) => {
          await manager.getRepository(UserQuota).findOne({ where: { userId: user } });
          await manager.findOne(User, { where: { id: user }, lock: { mode: 'pessimistic_write' } });
          const count = await manager
            .getRepository(AiUsageLedger)
            .count({ where: { userId: user } });
          if (count >= 2) return false;
          await manager.getRepository(AiUsageLedger).insert({
            userId: user,
            feature: 'f',
            requestId,
            status: 'reserved',
          });
          return true;
        });
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => reserveBadly(`b${i}`)),
      );
      expect(results.filter(Boolean).length).toBeGreaterThan(2);

      // The service's own order never exceeds it, even for the same input.
      process.env.QUOTA_DAILY_CALLS = '2';
      await db.query('DELETE FROM ai_usage_ledger');
      const quota = new AiQuotaService(db);
      const good = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) => quota.reserve(user, 0, 'f', `g${i}`)),
      );
      expect(good.filter(o => o.status === 'fulfilled')).toHaveLength(2);
    } finally {
      await db.destroy();
    }
  });

  it('refuses a stale epoch under the same lock', async () => {
    const { db, user } = await database();
    try {
      await expect(new AiQuotaService(db).reserve(user, 9, 'f', 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(await db.getRepository(AiUsageLedger).count()).toBe(0);
    } finally {
      await db.destroy();
    }
  });
});
