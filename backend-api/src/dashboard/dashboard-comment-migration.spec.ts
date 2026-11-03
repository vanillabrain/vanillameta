import { DataSource, TableColumn } from 'typeorm';
import { AddArtifactComments1793560000000 } from '../migrations/postgres/1793560000000-add-artifact-comments';
import { AddDashboardCommentAnchor1793580000000 } from '../migrations/postgres/1793580000000-add-dashboard-comment-anchor';
import { REPORT_COMMENT_ENTITIES, ArtifactCommentThread } from '../reports/report-comment.entity';

describe('dashboard comment anchor PostgreSQL migration', () => {
  it('adds the three nullable thread columns only when missing', async () => {
    const added: Array<[string, TableColumn]> = [];
    const runner = {
      hasColumn: jest.fn(async () => false),
      addColumn: jest.fn(async (table: string, column: TableColumn) => {
        added.push([table, column]);
      }),
    };
    await new AddDashboardCommentAnchor1793580000000().up(runner as never);
    expect(
      added.map(([table, column]) => [
        table,
        column.name,
        column.type,
        column.length,
        column.isNullable,
      ]),
    ).toEqual([
      ['artifact_comment_thread', 'artifactRevision', 'varchar', '64', true],
      ['artifact_comment_thread', 'anchorLabel', 'text', '', true],
      ['artifact_comment_thread', 'anchorType', 'varchar', '32', true],
    ]);
    runner.hasColumn.mockResolvedValue(true);
    runner.addColumn.mockClear();
    await new AddDashboardCommentAnchor1793580000000().up(runner as never);
    expect(runner.addColumn).not.toHaveBeenCalled();
  });

  it('refuses an unreviewed rollback', async () => {
    await expect(new AddDashboardCommentAnchor1793580000000().down()).rejects.toThrow(
      'backup plan',
    );
  });

  it('keeps existing report threads and matches the entities on SQLite', async () => {
    const db = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: REPORT_COMMENT_ENTITIES,
    }).initialize();
    const runner = db.createQueryRunner();
    try {
      await new AddArtifactComments1793560000000().up(runner);
      await runner.query(
        `INSERT INTO "artifact_comment_thread" ("id", "artifactKind", "artifactId", "version",
          "anchorKind", "status", "statusVersion", "createdBy", "authorKind", "createdAt")
         VALUES ('t', 'report', 'r', 1, 'whole', 'open', 0, 7, 'user', 'now')`,
      );
      await new AddDashboardCommentAnchor1793580000000().up(runner);
      await new AddDashboardCommentAnchor1793580000000().up(runner);
      const diff = await db.driver.createSchemaBuilder().log();
      expect(diff.upQueries.map(query => query.query)).toEqual([]);
      expect(await db.manager.findOneByOrFail(ArtifactCommentThread, { id: 't' })).toMatchObject({
        artifactKind: 'report',
        artifactRevision: null,
        anchorLabel: null,
        anchorType: null,
      });
    } finally {
      await runner.release();
      await db.destroy();
    }
  });
});
