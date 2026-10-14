import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';
import { AddPersonalViews1791854000000 } from './1791854000000-add-personal-views';
export class AddExploreViews1791941000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    if (!(await runner.hasTable('personal_view')))
      await new AddPersonalViews1791854000000().up(runner);
    let table = await runner.getTable('personal_view');
    if (!table.findColumnByName('sourceId'))
      await runner.addColumn(
        'personal_view',
        new TableColumn({ name: 'sourceId', type: 'integer', isNullable: true }),
      );
    const dashboard = table.findColumnByName('dashboardId');
    if (!dashboard.isNullable)
      await runner.changeColumn(
        'personal_view',
        dashboard,
        new TableColumn({ ...dashboard, isNullable: true }),
      );
    table = await runner.getTable('personal_view');
    if (!table.indices.some(i => i.name === 'IDX_personal_view_source_owner'))
      await runner.createIndex(
        'personal_view',
        new TableIndex({
          name: 'IDX_personal_view_source_owner',
          columnNames: ['sourceId', 'userId'],
        }),
      );
  }
  async down(): Promise<void> {
    throw new Error('Explore saved views require backup before rollback.');
  }
}
