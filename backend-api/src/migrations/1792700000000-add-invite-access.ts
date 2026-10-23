import { MigrationInterface, QueryRunner, Table } from 'typeorm';

const id = {
  name: 'id',
  type: 'integer',
  isPrimary: true,
  isGenerated: true,
  generationStrategy: 'increment',
} as const;

/** Invitations, who redeemed them, and the waiting list for the invite-only beta. */
export class AddInviteAccess1792700000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // @CreateDateColumn is datetime(6) on MySQL; match it so the migrated schema equals the entity schema.
    const isMysql = runner.connection.options.type === 'mysql';
    const created = (name: string) =>
      isMysql
        ? { name, type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' }
        : { name, type: 'datetime', default: 'CURRENT_TIMESTAMP' };
    if (!(await runner.hasTable('invite_code')))
      await runner.createTable(
        new Table({
          name: 'invite_code',
          columns: [
            id,
            { name: 'codeHash', type: 'varchar', length: '64' },
            { name: 'label', type: 'varchar', length: '255', isNullable: true },
            { name: 'maxUses', type: 'integer', default: 1 },
            { name: 'usedCount', type: 'integer', default: 0 },
            { name: 'expiresAt', type: 'datetime', isNullable: true },
            { name: 'revokedAt', type: 'datetime', isNullable: true },
            created('createdAt'),
          ],
          indices: [{ name: 'UQ_invite_code_hash', columnNames: ['codeHash'], isUnique: true }],
        }),
      );
    if (!(await runner.hasTable('invite_redemption')))
      await runner.createTable(
        new Table({
          name: 'invite_redemption',
          columns: [
            id,
            { name: 'inviteCodeId', type: 'integer' },
            { name: 'userId', type: 'integer' },
            created('redeemedAt'),
          ],
          indices: [
            {
              name: 'UQ_invite_redemption_pair',
              columnNames: ['inviteCodeId', 'userId'],
              isUnique: true,
            },
          ],
        }),
      );
    if (!(await runner.hasTable('waitlist_entry')))
      await runner.createTable(
        new Table({
          name: 'waitlist_entry',
          columns: [
            id,
            { name: 'email', type: 'varchar', length: '255' },
            { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
            { name: 'inviteCodeId', type: 'integer', isNullable: true },
            created('createdAt'),
            { name: 'decidedAt', type: 'datetime', isNullable: true },
          ],
          indices: [{ name: 'UQ_waitlist_entry_email', columnNames: ['email'], isUnique: true }],
        }),
      );
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of ['waitlist_entry', 'invite_redemption', 'invite_code'])
      if (await runner.hasTable(table)) await runner.dropTable(table);
  }
}
