import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * UC-021 reuse permissions. Additive and idempotent: existing publications keep an empty
 * recipe, existing shares keep reuse disabled at version 0, and no row is rewritten.
 *
 * Rollback drops the columns again, so it refuses while a recipe, an enabled grant or a
 * non-zero grant version is stored; those values are the state a recipient's link depends on.
 */
export class AddDashboardReusePermissions1792120000000 implements MigrationInterface {
  /** The share table has no explicit @Entity name, so accept the default and mapped spellings. */
  private async shareTables(runner: QueryRunner) {
    const tables: string[] = [];
    for (const table of ['dashboard_share', 'DashboardShare'])
      if (await runner.hasTable(table)) tables.push(table);
    return tables;
  }

  private count(runner: QueryRunner, sql: string) {
    return runner
      .query(sql)
      .then((rows: Array<{ n: unknown }>) => Number(rows?.[0]?.n ?? 0))
      .catch(() => 0);
  }

  async up(runner: QueryRunner): Promise<void> {
    if (await runner.hasTable('dashboard_publication'))
      if (!(await runner.hasColumn('dashboard_publication', 'reuseDefinition')))
        await runner.addColumn(
          'dashboard_publication',
          new TableColumn({
            name: 'reuseDefinition',
            type: 'text',
            isNullable: true,
            comment: '재사용 내부 정의(소유자 캡처, UC-021)',
          }),
        );
    for (const table of await this.shareTables(runner)) {
      if (!(await runner.hasColumn(table, 'allowReuse')))
        await runner.addColumn(
          table,
          new TableColumn({
            name: 'allowReuse',
            type: 'boolean',
            default: 0,
            isNullable: false,
            comment: '재사용 허용 여부',
          }),
        );
      if (!(await runner.hasColumn(table, 'reuseVersion')))
        await runner.addColumn(
          table,
          new TableColumn({
            name: 'reuseVersion',
            type: 'integer',
            default: 0,
            isNullable: false,
            comment: '재사용 설정 버전',
          }),
        );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    // Every guard is evaluated before the first drop, so a refused rollback changes nothing.
    const publicationColumn =
      (await runner.hasTable('dashboard_publication')) &&
      (await runner.hasColumn('dashboard_publication', 'reuseDefinition'));
    const shares: Array<{ table: string; grant: boolean; version: boolean }> = [];
    for (const table of await this.shareTables(runner))
      shares.push({
        table,
        grant: await runner.hasColumn(table, 'allowReuse'),
        version: await runner.hasColumn(table, 'reuseVersion'),
      });
    if (publicationColumn) {
      const recipes = await this.count(
        runner,
        'SELECT COUNT(*) AS n FROM dashboard_publication WHERE reuseDefinition IS NOT NULL',
      );
      if (recipes)
        throw new Error(
          'Back up reuse recipes before rollback; published reuse links depend on this column.',
        );
    }
    for (const share of shares) {
      const enabled = share.grant
        ? await this.count(runner, `SELECT COUNT(*) AS n FROM ${share.table} WHERE allowReuse = 1`)
        : 0;
      const used = share.version
        ? await this.count(
            runner,
            `SELECT COUNT(*) AS n FROM ${share.table} WHERE reuseVersion > 0`,
          )
        : 0;
      if (enabled || used)
        throw new Error(
          'Back up reuse grants before rollback; shared reuse links depend on these columns.',
        );
    }
    if (publicationColumn) await runner.dropColumn('dashboard_publication', 'reuseDefinition');
    for (const share of shares) {
      if (share.grant) await runner.dropColumn(share.table, 'allowReuse');
      if (share.version) await runner.dropColumn(share.table, 'reuseVersion');
    }
  }
}
