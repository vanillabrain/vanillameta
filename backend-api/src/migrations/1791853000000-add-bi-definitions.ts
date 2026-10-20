import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
export class AddBiDefinitions1791853000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    for (const [table, name] of [
      ['metric', 'definition'],
      ['dashboard', 'structuredDefinition'],
    ]) {
      if ((await runner.hasTable(table)) && !(await runner.hasColumn(table, name)))
        await runner.addColumn(table, new TableColumn({ name, type: 'text', isNullable: true }));
    }
  }
  async down(): Promise<void> {
    throw new Error('Definition snapshots require backup before rollback.');
  }
}
