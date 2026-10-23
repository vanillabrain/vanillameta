import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AddInviteAccess1792700000000 } from '../migrations/1792700000000-add-invite-access';
import { AccessService } from './access.service';
import { InviteCode } from './entities/invite-code.entity';
import { InviteRedemption } from './entities/invite-redemption.entity';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

// Explicit opt-in against a throwaway MySQL server; each test works in its own child schema.
// Example: VM_ACCESS_MYSQL_PORT=33998 VM_ACCESS_MYSQL_PASSWORD=... npm test -- access.mysql
const enabled = Boolean(process.env.VM_ACCESS_MYSQL_PORT);
const suite = enabled ? describe : describe.skip;
const ENTITIES = [InviteCode, InviteRedemption, WaitlistEntry];

suite('invite access on MySQL', () => {
  jest.setTimeout(120000);
  const schemas: string[] = [];
  let admin: DataSource;

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
    const name = 'vm_access_' + randomBytes(8).toString('hex');
    schemas.push(name);
    await admin.query(`CREATE DATABASE \`${name}\``);
    return name;
  }

  const shape = async (name: string) => ({
    columns: await admin.query(
      `SELECT table_name t, column_name c, column_type ty, is_nullable n, column_key k, extra e, column_default d
         FROM information_schema.columns WHERE table_schema = ? AND table_name <> 'migrations' ORDER BY table_name, ordinal_position`,
      [name],
    ),
    indexes: await admin.query(
      `SELECT table_name t, index_name i, non_unique u, column_name c, seq_in_index s
         FROM information_schema.statistics WHERE table_schema = ? AND table_name <> 'migrations' ORDER BY table_name, index_name, seq_in_index`,
      [name],
    ),
  });

  beforeAll(async () => {
    admin = await new DataSource(options()).initialize();
  });
  afterAll(async () => {
    for (const name of schemas) await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await admin?.destroy();
  });

  it('the migration builds the same tables as the entities (columns, types and indexes)', async () => {
    const migrated = await schema();
    const viaMigration = await new DataSource({
      ...options(migrated),
      entities: ENTITIES,
      migrations: [AddInviteAccess1792700000000],
      synchronize: false,
    }).initialize();
    await viaMigration.runMigrations();
    await viaMigration.destroy();
    const synced = await schema();
    const viaEntities = await new DataSource({
      ...options(synced),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    await viaEntities.destroy();
    expect(await shape(migrated)).toEqual(await shape(synced));
  });

  it('hands out exactly maxUses seats under 12 concurrent transactions and gives one back on rollback', async () => {
    const name = await schema();
    const db = await new DataSource({
      ...options(name),
      entities: ENTITIES,
      synchronize: true,
    }).initialize();
    try {
      const access = new AccessService();
      const { code, id } = await access.createInvite(db.manager, { maxUses: 3 });
      const outcomes = await Promise.allSettled(
        Array.from({ length: 12 }, () => db.transaction(manager => access.redeem(manager, code))),
      );
      expect(outcomes.filter(o => o.status === 'fulfilled')).toHaveLength(3);
      expect((await db.getRepository(InviteCode).findOneByOrFail({ id })).usedCount).toBe(3);

      const second = await access.createInvite(db.manager, { maxUses: 1 });
      await expect(
        db.transaction(async manager => {
          await access.redeem(manager, second.code);
          throw new Error('account insert failed');
        }),
      ).rejects.toThrow('account insert failed');
      expect(
        (await db.getRepository(InviteCode).findOneByOrFail({ id: second.id })).usedCount,
      ).toBe(0);
      await db.transaction(manager => access.redeem(manager, second.code));
      expect(
        (await db.getRepository(InviteCode).findOneByOrFail({ id: second.id })).usedCount,
      ).toBe(1);
    } finally {
      await db.destroy();
    }
  });
});
