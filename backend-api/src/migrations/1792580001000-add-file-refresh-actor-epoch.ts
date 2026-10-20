import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFileRefreshActorEpoch1792580001000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('file_refresh')) &&
      !(await runner.hasColumn('file_refresh', 'actorEpoch'))
    )
      await runner.addColumn(
        'file_refresh',
        new TableColumn({ name: 'actorEpoch', type: 'integer', isNullable: true }),
      );
  }
  async down(runner: QueryRunner): Promise<void> {
    if (
      (await runner.hasTable('file_refresh')) &&
      (await runner.hasColumn('file_refresh', 'actorEpoch'))
    )
      await runner.dropColumn('file_refresh', 'actorEpoch');
  }
}
