import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Existing installations must receive auth column fixes without schema synchronization. */
export class FixMysqlAuthColumns1792130000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!['mysql', 'mariadb'].includes(runner.connection.options.type)) return;
    const refresh = (await runner.getTable('refresh_token'))?.findColumnByName('refreshToken');
    if (refresh && refresh.type === 'varchar')
      // TypeORM changeColumn can drop/recreate on type changes. MODIFY preserves active tokens.
      await runner.query(
        `ALTER TABLE \`refresh_token\` MODIFY COLUMN \`refreshToken\` TEXT ${
          refresh.isNullable ? 'NULL' : 'NOT NULL'
        }`,
      );
    for (const name of ['createdAt', 'updatedAt']) {
      const column = (await runner.getTable('user'))?.findColumnByName(name);
      if (!column || column.type !== 'datetime' || column.precision === 6) continue;
      await runner.changeColumn(
        'user',
        column,
        new TableColumn({
          ...column,
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          ...(name === 'updatedAt' ? { onUpdate: 'CURRENT_TIMESTAMP(6)' } : {}),
        }),
      );
    }
  }

  async down(): Promise<void> {
    throw new Error('Auth column rollback requires backup review; narrowing tokens can lose data.');
  }
}
