import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/** The AI usage ledger and per-user quota overrides. Must match the entities in src/usage/entities. */
export class AddAiUsage1792700100000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    // @CreateDateColumn / @UpdateDateColumn are datetime(6) on MySQL; match them so the migrated schema
    // equals the entity schema.
    const isMysql = runner.connection.options.type === 'mysql';
    const timestamp = (name: string) =>
      isMysql
        ? { name, type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' }
        : { name, type: 'datetime', default: 'CURRENT_TIMESTAMP' };
    if (!(await runner.hasTable('ai_usage_ledger')))
      await runner.createTable(
        new Table({
          name: 'ai_usage_ledger',
          columns: [
            {
              name: 'id',
              type: 'integer',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            { name: 'userId', type: 'integer' },
            { name: 'feature', type: 'varchar', length: '64' },
            { name: 'provider', type: 'varchar', length: '32', default: "''" },
            { name: 'model', type: 'varchar', length: '128', default: "''" },
            { name: 'inputTokens', type: 'integer', default: 0 },
            { name: 'outputTokens', type: 'integer', default: 0 },
            { name: 'status', type: 'varchar', length: '16' },
            { name: 'latencyMs', type: 'integer', isNullable: true },
            { name: 'requestId', type: 'varchar', length: '64' },
            timestamp('createdAt'),
          ],
          indices: [
            {
              name: 'UQ_ai_usage_ledger_user_request',
              columnNames: ['userId', 'requestId'],
              isUnique: true,
            },
            { name: 'IDX_ai_usage_ledger_user_created', columnNames: ['userId', 'createdAt'] },
            { name: 'IDX_ai_usage_ledger_created', columnNames: ['createdAt'] },
          ],
        }),
      );
    if (!(await runner.hasTable('user_quota')))
      await runner.createTable(
        new Table({
          name: 'user_quota',
          columns: [
            { name: 'userId', type: 'integer', isPrimary: true },
            { name: 'dailyCalls', type: 'integer', isNullable: true },
            { name: 'monthlyTokens', type: 'integer', isNullable: true },
            // @UpdateDateColumn is ON UPDATE CURRENT_TIMESTAMP(6) on MySQL.
            { ...timestamp('updatedAt'), ...(isMysql ? { onUpdate: 'CURRENT_TIMESTAMP(6)' } : {}) },
          ],
        }),
      );
  }

  async down(runner: QueryRunner): Promise<void> {
    for (const table of ['user_quota', 'ai_usage_ledger'])
      if (await runner.hasTable(table)) await runner.dropTable(table);
  }
}
